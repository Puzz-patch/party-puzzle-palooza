# Shot System with Token Deduction

## Overview

The shot system allows players to take shots (provide answers) during game rounds with optional token betting. The system includes atomic token deduction, transaction ledger tracking, and support for chill mode where no tokens are deducted.

## Key Features

### 🎯 **Atomic Token Deduction**
- TypeORM transactions ensure data consistency
- Row-level locking prevents race conditions
- Automatic rollback on failures

### 📊 **Transaction Ledger**
- Complete audit trail of all token transactions
- Balance tracking with before/after amounts
- Metadata storage for shot details

### 😌 **Chill Mode Support**
- Optional mode where no tokens are deducted
- Respects game settings
- Maintains shot tracking without financial impact

## Database Schema

### UserBalance Entity
```typescript
@Entity('user_balances')
export class UserBalance extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int', default: 1000 })
  balance: number; // Starting balance of 1000 tokens

  @Column({ type: 'int', default: 0 })
  totalEarned: number;

  @Column({ type: 'int', default: 0 })
  totalSpent: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUpdatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
```

### TransactionLedger Entity
```typescript
@Entity('transaction_ledger')
export class TransactionLedger extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  gameRoundId: string | null;

  @Column({ type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Column({ type: 'int' })
  amount: number; // Positive for credits, negative for debits

  @Column({ type: 'int' })
  balanceBefore: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({ type: 'enum', enum: TransactionStatus, default: 'pending' })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
```

## API Endpoints

### POST /rounds/:rid/shot
Take a shot for a specific round

**Authentication:** Requires valid `player_token` cookie

**Request Body:**
```json
{
  "answer": "Fly",
  "betAmount": 5,
  "metadata": {
    "confidence": 0.8,
    "timeSpent": 15
  }
}
```

**Response:**
```json
{
  "roundId": "round-uuid",
  "playerId": "player-uuid",
  "answer": "Fly",
  "betAmount": 5,
  "balanceBefore": 1000,
  "balanceAfter": 995,
  "transactionId": "transaction-uuid",
  "isChillMode": false,
  "message": "Shot taken successfully! 5 tokens deducted."
}
```

### GET /rounds/balance
Get current player balance

**Response:**
```json
{
  "balance": 995,
  "totalEarned": 0,
  "totalSpent": 5
}
```

### GET /rounds/transactions
Get transaction history

**Query Parameters:**
- `limit` (optional): Number of transactions to return (default: 20)
- `offset` (optional): Number of transactions to skip (default: 0)

**Response:**
```json
{
  "transactions": [
    {
      "id": "transaction-uuid",
      "userId": "player-uuid",
      "gameRoundId": "round-uuid",
      "transactionType": "shot",
      "amount": -5,
      "balanceBefore": 1000,
      "balanceAfter": 995,
      "status": "completed",
      "description": "Shot taken with 5 token bet: Fly",
      "metadata": {
        "answer": "Fly",
        "betAmount": 5,
        "isChillMode": false
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

## Business Logic

### Shot Validation Rules

1. **Round Status**: Round must be active
2. **Phase Check**: Round must be in 'response' phase
3. **Player Authorization**: Only the selected responder can take a shot
4. **Duplicate Prevention**: Shot can only be taken once per round
5. **Balance Validation**: Sufficient tokens required (unless chill mode)

### Token Deduction Rules

1. **Default Bet**: 1 token if no bet amount specified
2. **Minimum Bet**: 1 token
3. **Maximum Bet**: 100 tokens
4. **Chill Mode**: 0 tokens deducted when `game.settings.chill_mode = true`
5. **Balance Check**: Must have sufficient tokens before deduction

### Transaction Types

```typescript
export enum TransactionType {
  SHOT = 'shot',           // Shot taken with bet
  EARNED = 'earned',       // Tokens earned from correct answers
  BONUS = 'bonus',         // Bonus tokens awarded
  PENALTY = 'penalty',     // Penalty tokens deducted
  REFUND = 'refund',       // Refunded tokens
  ADMIN_ADJUSTMENT = 'admin_adjustment' // Manual adjustment
}
```

## Implementation Details

### Atomic Transaction Flow

```typescript
async takeShot(roundId: string, playerId: string, gameId: string, dto: TakeShotDto) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Validate round and player
    const round = await this.validateRound(roundId, gameId, playerId);
    
    // 2. Get user balance with row lock
    const balance = await this.getUserBalanceWithLock(playerId);
    
    // 3. Calculate bet amount (respect chill mode)
    const betAmount = this.calculateBetAmount(dto, round.game.settings);
    
    // 4. Validate sufficient balance
    this.validateBalance(balance, betAmount);
    
    // 5. Update balance
    await this.updateBalance(balance, betAmount);
    
    // 6. Create transaction record
    const transaction = await this.createTransaction(playerId, roundId, betAmount, dto);
    
    // 7. Update round data
    await this.updateRoundData(roundId, dto, transaction.id);
    
    // 8. Commit transaction
    await queryRunner.commitTransaction();
    
    // 9. Broadcast event
    await this.broadcastShotTaken(round.gameId, playerId, dto, betAmount);
    
    return this.buildResponse(roundId, playerId, dto, betAmount, balance, transaction);
    
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

### Row-Level Locking

```typescript
const userBalance = await queryRunner.manager
  .createQueryBuilder(UserBalance, 'balance')
  .setLock('pessimistic_write')
  .where('balance.userId = :userId', { userId: playerId })
  .getOne();
```

### Chill Mode Detection

```typescript
const isChillMode = game?.settings?.chill_mode === true;
const betAmount = isChillMode ? 0 : (takeShotDto.betAmount || 1);
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Balance**
   ```json
   {
     "statusCode": 400,
     "message": "Insufficient tokens for bet",
     "error": "Bad Request"
   }
   ```

2. **Invalid Round State**
   ```json
   {
     "statusCode": 400,
     "message": "Cannot take shot: not in response phase",
     "error": "Bad Request"
   }
   ```

3. **Unauthorized Player**
   ```json
   {
     "statusCode": 403,
     "message": "Only the selected responder can take a shot",
     "error": "Forbidden"
   }
   ```

4. **Duplicate Shot**
   ```json
   {
     "statusCode": 400,
     "message": "Shot has already been taken for this round",
     "error": "Bad Request"
   }
   ```

## WebSocket Events

### shot_taken
Broadcasted when a shot is successfully taken

```json
{
  "type": "shot_taken",
  "data": {
    "roundId": "round-uuid",
    "playerId": "player-uuid",
    "answer": "Fly",
    "betAmount": 5,
    "isChillMode": false,
    "transactionId": "transaction-uuid",
    "takenAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Testing

### Unit Tests

```typescript
describe('ShotService', () => {
  it('should successfully take a shot and deduct tokens', async () => {
    // Test successful shot with token deduction
  });

  it('should handle chill mode without deducting tokens', async () => {
    // Test chill mode functionality
  });

  it('should throw error for insufficient tokens', async () => {
    // Test balance validation
  });

  it('should throw error for unauthorized player', async () => {
    // Test authorization
  });
});
```

### Integration Tests

```typescript
describe('Shot API', () => {
  it('should take shot via API endpoint', async () => {
    // Test full API flow
  });

  it('should handle concurrent shots correctly', async () => {
    // Test race condition handling
  });
});
```

## Performance Considerations

### Database Optimizations

1. **Indexes**: Proper indexing on frequently queried fields
2. **Row Locking**: Prevents race conditions on balance updates
3. **Transaction Isolation**: Ensures data consistency
4. **Connection Pooling**: Efficient database connection management

### Caching Strategy

1. **Balance Caching**: Cache user balances with short TTL
2. **Game State Caching**: Cache active game states
3. **Redis Integration**: Use Redis for real-time updates

## Security Considerations

### Input Validation

1. **Bet Amount Limits**: Enforce minimum/maximum bet amounts
2. **Answer Validation**: Validate answer format and length
3. **Rate Limiting**: Prevent rapid-fire shots
4. **Authorization**: Verify player permissions

### Data Protection

1. **Transaction Logging**: Complete audit trail
2. **Balance Verification**: Double-check balance calculations
3. **Rollback Capability**: Automatic rollback on errors
4. **Idempotency**: Prevent duplicate transactions

## Future Enhancements

### Advanced Features

1. **Dynamic Betting**: Variable bet amounts based on confidence
2. **Token Rewards**: Earn tokens for correct answers
3. **Leaderboards**: Track token earnings across games
4. **Tournament Mode**: Special token rules for tournaments

### Analytics

1. **Shot Analytics**: Track shot patterns and success rates
2. **Token Flow**: Monitor token circulation and economy
3. **Player Behavior**: Analyze betting patterns
4. **Game Balance**: Ensure fair token distribution

This implementation provides a robust, secure, and scalable shot system with comprehensive token management and audit capabilities. 