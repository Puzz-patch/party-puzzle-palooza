# Player Actions System

## Overview

The player actions system allows players to perform special actions during the reveal & gamble phase of a round. Each player can perform one action per round with coin-flip odds for success.

## Key Features

### 🎲 **Three Action Types**
- **Roll**: Reveal the correct answer (50% success rate)
- **Force**: Make another player reveal their answer (50% success rate)
- **Shield**: Protect yourself from force actions (50% success rate)

### ⚖️ **One Action Per Player Per Round**
- Enforced at the database level
- Prevents action spam
- Ensures fair gameplay

### 🪙 **Coin-Flip Odds**
- All actions have 50% success rate
- Random but fair outcomes
- Consistent across all action types

### 📊 **Round State Patches**
- Real-time updates to round state
- Complete action history
- Player status tracking

## Action Types

### 🎲 Roll Action
**Purpose**: Reveal the correct answer to the current question

**Success Effect**: Player can see the correct answer
**Failure Effect**: No effect

**Usage**: No target required
```json
{
  "actionType": "roll"
}
```

### ⚡ Force Action
**Purpose**: Make another player reveal their answer

**Success Effect**: Target player must reveal their answer
**Failure Effect**: No effect

**Usage**: Requires target player ID
```json
{
  "actionType": "force",
  "targetPlayerId": "player-uuid"
}
```

**Validation Rules**:
- Cannot force yourself
- Cannot force a player who has already been forced this round
- Target must be in the same game

### 🛡️ Shield Action
**Purpose**: Protect yourself from force actions

**Success Effect**: Protected from force actions for 30 seconds
**Failure Effect**: No effect

**Usage**: No target required
```json
{
  "actionType": "shield"
}
```

## API Endpoints

### POST /rounds/:rid/action
Perform a player action

**Authentication**: Requires valid `player_token` cookie

**Request Body**:
```json
{
  "actionType": "roll|force|shield",
  "targetPlayerId": "player-uuid", // Required for force action
  "metadata": {
    "confidence": 0.8,
    "reason": "gut feeling"
  }
}
```

**Response**:
```json
{
  "roundId": "round-uuid",
  "playerId": "player-uuid",
  "actionType": "roll",
  "success": true,
  "targetPlayerId": null,
  "result": "heads",
  "message": "SUCCESS! You rolled heads and can see the correct answer!",
  "roundStatePatch": {
    "phase": "reveal_gamble",
    "playerActions": {
      "player-1": {
        "actionType": "roll",
        "success": true,
        "result": "heads",
        "performedAt": "2024-01-01T00:00:00.000Z"
      }
    },
    "actionResults": {
      "player-1": {
        "success": true,
        "effect": "reveal_answer",
        "correctAnswer": "Fly",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    },
    "forceTargets": {},
    "shieldedPlayers": {},
    "currentPlayerAction": {
      "actionType": "roll",
      "success": true,
      "result": "heads"
    },
    "remainingActions": 0
  }
}
```

### GET /rounds/:rid/actions
Get current round actions and state

**Response**:
```json
{
  "roundId": "round-uuid",
  "phase": "reveal_gamble",
  "playerActions": {
    "player-1": {
      "actionType": "roll",
      "success": true,
      "result": "heads",
      "performedAt": "2024-01-01T00:00:00.000Z"
    },
    "player-2": {
      "actionType": "force",
      "success": false,
      "result": "tails",
      "targetPlayerId": "player-3",
      "performedAt": "2024-01-01T00:00:01.000Z"
    }
  },
  "actionResults": {
    "player-1": {
      "success": true,
      "effect": "reveal_answer",
      "correctAnswer": "Fly",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "player-2": {
      "success": false,
      "effect": "no_effect",
      "timestamp": "2024-01-01T00:00:01.000Z"
    }
  },
  "forceTargets": {},
  "shieldedPlayers": {
    "player-3": {
      "shieldedAt": "2024-01-01T00:00:02.000Z",
      "expiresAt": "2024-01-01T00:00:32.000Z"
    }
  },
  "remainingActions": 1
}
```

## Business Logic

### Action Validation Rules

1. **Round Status**: Round must be active
2. **Phase Check**: Round must be in 'reveal_gamble' phase
3. **Player Authorization**: Player must be in the game
4. **One Action Per Round**: Player can only perform one action per round
5. **Action-Specific Rules**:
   - **Force**: Requires valid target player ID
   - **Shield**: Player cannot be already shielded

### Success Rate Constants

```typescript
export class ActionConstants {
  static readonly ROLL_SUCCESS_RATE = 0.5; // 50% chance
  static readonly FORCE_SUCCESS_RATE = 0.5; // 50% chance
  static readonly SHIELD_SUCCESS_RATE = 0.5; // 50% chance
  static readonly MAX_ACTIONS_PER_ROUND = 1;
  static readonly ACTION_COOLDOWN_MS = 5000; // 5 seconds
}
```

### Action Effects

#### Roll Action
- **Success**: Player gets access to correct answer
- **Failure**: No effect

#### Force Action
- **Success**: Target player must reveal their answer
- **Failure**: No effect

#### Shield Action
- **Success**: Player protected from force actions for 30 seconds
- **Failure**: No effect

## Implementation Details

### Atomic Transaction Flow

```typescript
async performAction(roundId: string, playerId: string, gameId: string, actionDto: PlayerActionDto) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Validate round and player
    const round = await this.validateRound(roundId, gameId, playerId);
    
    // 2. Validate action-specific requirements
    await this.validateAction(actionDto, round, playerId);
    
    // 3. Perform coin-flip for success
    const success = this.performCoinFlip(actionDto.actionType);
    
    // 4. Process action effects
    const actionResult = await this.processAction(actionDto, success, round, playerId);
    
    // 5. Update round data
    await this.updateRoundData(roundId, playerId, actionDto, success, actionResult);
    
    // 6. Commit transaction
    await queryRunner.commitTransaction();
    
    // 7. Broadcast event
    await this.broadcastActionPerformed(round.gameId, playerId, actionDto, success);
    
    return this.buildResponse(roundId, playerId, actionDto, success, actionResult);
    
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

### Coin-Flip Implementation

```typescript
private performCoinFlip(actionType: PlayerActionType): boolean {
  let successRate: number;

  switch (actionType) {
    case PlayerActionType.ROLL:
      successRate = ActionConstants.ROLL_SUCCESS_RATE;
      break;
    case PlayerActionType.FORCE:
      successRate = ActionConstants.FORCE_SUCCESS_RATE;
      break;
    case PlayerActionType.SHIELD:
      successRate = ActionConstants.SHIELD_SUCCESS_RATE;
      break;
    default:
      successRate = 0.5;
  }

  return Math.random() < successRate;
}
```

### Round State Management

```typescript
private generateRoundStatePatch(roundData: Record<string, any>, playerId: string) {
  return {
    phase: roundData.phase,
    playerActions: roundData.playerActions,
    actionResults: roundData.actionResults,
    forceTargets: roundData.forceTargets || {},
    shieldedPlayers: roundData.shieldedPlayers || {},
    currentPlayerAction: roundData.playerActions?.[playerId],
    remainingActions: this.calculateRemainingActions(roundData)
  };
}
```

## WebSocket Events

### action_performed
Broadcasted when a player performs an action

```json
{
  "type": "action_performed",
  "data": {
    "roundId": "round-uuid",
    "playerId": "player-uuid",
    "actionType": "roll",
    "success": true,
    "result": "heads",
    "targetPlayerId": null,
    "performedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Handling

### Common Error Scenarios

1. **Invalid Round State**
   ```json
   {
     "statusCode": 400,
     "message": "Cannot perform action: not in reveal & gamble phase",
     "error": "Bad Request"
   }
   ```

2. **Duplicate Action**
   ```json
   {
     "statusCode": 400,
     "message": "Player has already performed an action this round",
     "error": "Bad Request"
   }
   ```

3. **Invalid Force Target**
   ```json
   {
     "statusCode": 400,
     "message": "Cannot force yourself",
     "error": "Bad Request"
   }
   ```

4. **Already Shielded**
   ```json
   {
     "statusCode": 400,
     "message": "Player has already been shielded this round",
     "error": "Bad Request"
   }
   ```

## Testing

### Unit Tests

```typescript
describe('PlayerActionService', () => {
  it('should successfully perform a roll action', async () => {
    // Test successful roll
  });

  it('should handle force action with valid target', async () => {
    // Test force action
  });

  it('should prevent duplicate actions', async () => {
    // Test duplicate prevention
  });

  it('should validate force action requirements', async () => {
    // Test force validation
  });
});
```

### Integration Tests

```typescript
describe('Player Action API', () => {
  it('should perform action via API endpoint', async () => {
    // Test full API flow
  });

  it('should handle concurrent actions correctly', async () => {
    // Test race condition handling
  });
});
```

## Performance Considerations

### Database Optimizations

1. **Atomic Transactions**: Ensure data consistency
2. **Efficient Queries**: Optimize round data updates
3. **Indexing**: Proper indexes on frequently queried fields
4. **Connection Pooling**: Efficient database connection management

### Caching Strategy

1. **Round State Caching**: Cache active round states
2. **Action History Caching**: Cache recent actions
3. **Redis Integration**: Use Redis for real-time updates

## Security Considerations

### Input Validation

1. **Action Type Validation**: Validate action type enum
2. **Target Player Validation**: Verify target player exists and is valid
3. **Rate Limiting**: Prevent action spam
4. **Authorization**: Verify player permissions

### Data Protection

1. **Action Logging**: Complete audit trail of all actions
2. **State Verification**: Verify round state consistency
3. **Rollback Capability**: Automatic rollback on errors
4. **Idempotency**: Prevent duplicate actions

## Future Enhancements

### Advanced Features

1. **Action Combinations**: Allow multiple actions with cooldowns
2. **Dynamic Success Rates**: Variable success rates based on game state
3. **Action Trading**: Allow players to trade actions
4. **Tournament Mode**: Special action rules for tournaments

### Analytics

1. **Action Analytics**: Track action usage patterns
2. **Success Rate Analysis**: Monitor actual vs expected success rates
3. **Player Behavior**: Analyze action preferences
4. **Game Balance**: Ensure fair action distribution

This implementation provides a robust, secure, and engaging player action system that adds strategic depth to the reveal & gamble phase while maintaining fair and balanced gameplay. 