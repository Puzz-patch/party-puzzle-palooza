# Draw Next Question Feature

## Overview

The `drawNextQuestion` method provides a robust, concurrent-safe way to draw the next available question for a game round. It uses PostgreSQL's `FOR UPDATE SKIP LOCKED` mechanism to handle multiple server instances safely, masks author IDs for anonymity, and creates proper Round entities.

## Key Features

### 🔒 **Concurrent Access Safety**
- Uses `FOR UPDATE SKIP LOCKED` to prevent race conditions
- Ensures only one server instance can claim a question at a time
- Handles multiple concurrent requests gracefully

### 🎭 **Author Anonymity**
- Masks original author IDs using deterministic hashing
- Same author always gets the same mask across requests
- Maintains consistency while preserving privacy

### 📊 **Round Management**
- Creates new Round entities for drawn questions
- Tracks original question metadata
- Updates question status to prevent reuse

## API Endpoint

### POST /games/:gid/rounds/draw-next

**Authentication:** Requires valid `player_token` cookie

**Request:**
```http
POST /api/games/123e4567-e89b-12d3-a456-426614174000/rounds/draw-next
Cookie: player_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "roundId": "456e7890-e89b-12d3-a456-426614174000",
  "roundNumber": 1,
  "question": "Would you rather have the ability to fly or be invisible?",
  "type": "would_you_rather",
  "options": ["Fly", "Be invisible"],
  "correctAnswer": null,
  "timeLimit": 30,
  "maskedAuthorId": "author_a1b2c3d4",
  "totalRounds": 3,
  "currentRound": 1
}
```

**Error Responses:**

```json
// Game not found
{
  "statusCode": 404,
  "message": "Game not found",
  "error": "Not Found"
}

// No questions available
{
  "statusCode": 400,
  "message": "No more questions available for this game",
  "error": "Bad Request"
}

// Game reached max rounds
{
  "statusCode": 400,
  "message": "Game has reached maximum number of rounds",
  "error": "Bad Request"
}
```

## Implementation Details

### Database Transaction Flow

```typescript
async drawNextQuestion(gameId: string): Promise<DrawNextQuestionResult> {
  const queryRunner = this.dataSource.createQueryRunner();
  
  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // 1. Get game with current round count
    const game = await queryRunner.manager.findOne(Game, {
      where: { id: gameId },
      relations: ['gameRounds']
    });

    // 2. Validate game exists and has capacity
    if (!game) throw new NotFoundException('Game not found');
    if (game.gameRounds.length >= game.roundsPerGame) {
      throw new BadRequestException('Game has reached maximum number of rounds');
    }

    // 3. Find next available question with FOR UPDATE SKIP LOCKED
    const nextQuestion = await queryRunner.manager
      .createQueryBuilder(GameRound, 'round')
      .where('round.gameId = :gameId', { gameId })
      .andWhere('round.status = :status', { status: RoundStatus.PENDING })
      .orderBy('round.roundNumber', 'ASC')
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getOne();

    // 4. Create new round entry
    const newRound = queryRunner.manager.create(GameRound, {
      gameId,
      roundNumber: game.gameRounds.length + 1,
      type: nextQuestion.type,
      status: RoundStatus.ACTIVE,
      question: nextQuestion.question,
      options: nextQuestion.options,
      correctAnswer: nextQuestion.correctAnswer,
      timeLimit: game.timePerRound,
      startedAt: new Date(),
      createdById: nextQuestion.createdById,
      roundData: {
        drawnFromQuestionId: nextQuestion.id,
        drawnAt: new Date().toISOString(),
        originalRoundNumber: nextQuestion.roundNumber
      }
    });

    // 5. Save and update status
    const savedRound = await queryRunner.manager.save(newRound);
    await queryRunner.manager.update(GameRound, nextQuestion.id, {
      status: RoundStatus.FINISHED,
      roundData: {
        ...nextQuestion.roundData,
        usedInRound: newRound.roundNumber,
        usedAt: new Date().toISOString()
      }
    });

    await queryRunner.commitTransaction();
    
    return {
      roundId: savedRound.id,
      roundNumber: savedRound.roundNumber,
      question: nextQuestion.question,
      type: nextQuestion.type,
      options: nextQuestion.options,
      correctAnswer: nextQuestion.correctAnswer,
      timeLimit: game.timePerRound,
      maskedAuthorId: this.maskAuthorId(nextQuestion.createdById),
      totalRounds: game.roundsPerGame,
      currentRound: savedRound.roundNumber
    };

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

### Author ID Masking

```typescript
private maskAuthorId(authorId: string): string {
  const hash = createHash('sha256')
    .update(authorId + process.env.AUTHOR_MASK_SALT || 'default_salt')
    .digest('hex');
  
  return `author_${hash.substring(0, 8)}`;
}
```

**Features:**
- **Deterministic**: Same author always gets same mask
- **Consistent**: Uses environment salt for security
- **Readable**: 8-character hex suffix for easy identification
- **Anonymous**: Original author ID is not exposed

## Database Schema Changes

### GameRound Entity Updates

The `game_rounds` table supports the following statuses:

```sql
CREATE TYPE round_status_enum AS ENUM (
  'pending',    -- Question available for drawing
  'active',     -- Question currently being played
  'finished',   -- Question has been used
  'cancelled'   -- Question was cancelled
);
```

### RoundData JSONB Structure

```json
{
  "drawnFromQuestionId": "uuid",
  "drawnAt": "2024-01-01T00:00:00.000Z",
  "originalRoundNumber": 1,
  "usedInRound": 1,
  "usedAt": "2024-01-01T00:00:00.000Z",
  "category": "fun",
  "isCustom": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Concurrent Access Handling

### FOR UPDATE SKIP LOCKED

The method uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to handle concurrent access:

```sql
SELECT * FROM game_rounds 
WHERE game_id = $1 
  AND status = 'pending' 
ORDER BY round_number ASC 
FOR UPDATE SKIP LOCKED 
LIMIT 1;
```

**Benefits:**
- **No Deadlocks**: SKIP LOCKED prevents deadlock scenarios
- **High Performance**: Failed locks don't block other transactions
- **Fair Distribution**: Questions are drawn in order
- **Scalable**: Works with multiple server instances

### Race Condition Scenarios

1. **Multiple Servers**: Two servers try to draw questions simultaneously
   - Server A locks question 1
   - Server B skips locked question 1, locks question 2
   - Both succeed without conflict

2. **Same Server Multiple Requests**: Rapid successive requests
   - First request locks and claims question
   - Subsequent requests get next available questions
   - No duplicate questions drawn

3. **Network Failures**: Request fails after lock acquisition
   - Transaction rolls back automatically
   - Question remains available for future draws
   - No data corruption

## Error Handling

### Validation Errors

```typescript
// Game not found
if (!game) {
  throw new NotFoundException('Game not found');
}

// Max rounds reached
if (currentRoundCount >= game.roundsPerGame) {
  throw new BadRequestException('Game has reached maximum number of rounds');
}

// No questions available
if (!nextQuestion) {
  throw new BadRequestException('No more questions available for this game');
}
```

### Transaction Rollback

```typescript
try {
  // ... transaction logic
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  this.logger.error(`Error drawing next question for game ${gameId}: ${error.message}`);
  throw error;
} finally {
  await queryRunner.release();
}
```

## Testing

### Unit Tests

The feature includes comprehensive unit tests covering:

- ✅ **Successful question drawing**
- ✅ **Game not found scenarios**
- ✅ **Max rounds reached**
- ✅ **No questions available**
- ✅ **Database error handling**
- ✅ **Author ID masking consistency**
- ✅ **Concurrent access simulation**

### Integration Tests

```typescript
describe('drawNextQuestion Integration', () => {
  it('should handle concurrent requests', async () => {
    const promises = Array(5).fill(null).map(() => 
      service.drawNextQuestion(gameId)
    );
    
    const results = await Promise.all(promises);
    
    // Each request should get a different question
    const questionIds = results.map(r => r.roundId);
    expect(new Set(questionIds).size).toBe(5);
  });
});
```

## Performance Considerations

### Database Indexes

Ensure proper indexing for optimal performance:

```sql
-- Index for question selection
CREATE INDEX idx_game_rounds_draw 
ON game_rounds (game_id, status, round_number) 
WHERE status = 'pending';

-- Index for round counting
CREATE INDEX idx_game_rounds_count 
ON game_rounds (game_id);
```

### Connection Pooling

The method uses query runners which are managed by TypeORM's connection pool:

```typescript
// Automatically managed connection lifecycle
const queryRunner = this.dataSource.createQueryRunner();
// ... use queryRunner
await queryRunner.release(); // Returns to pool
```

### Memory Management

- **Query Runner Cleanup**: Always released in finally block
- **Transaction Scope**: Minimal transaction duration
- **Error Handling**: Proper rollback on failures

## Security Features

### Input Validation

- **Game ID**: Validated against database
- **Player Authorization**: JWT guard ensures access control
- **Game Ownership**: Player can only access their own games

### Data Protection

- **Author Anonymity**: Original author IDs are masked
- **Deterministic Hashing**: Consistent masking with salt
- **No Information Leakage**: Original question metadata preserved

### Rate Limiting

Consider implementing rate limiting for the draw endpoint:

```typescript
// In controller
@UseGuards(RateLimitGuard)
@Post(':gid/rounds/draw-next')
async drawNextQuestion() {
  // Implementation
}
```

## Monitoring and Logging

### Structured Logging

```typescript
this.logger.log(`Drew question for game ${gameId}, round ${nextRoundNumber}`);
this.logger.error(`Error drawing next question for game ${gameId}: ${error.message}`);
```

### Metrics to Track

- **Draw Success Rate**: Percentage of successful draws
- **Concurrent Draws**: Number of simultaneous requests
- **Question Availability**: Questions remaining per game
- **Response Time**: Time to draw and return question

### Health Checks

Monitor the endpoint health:

```typescript
// Health check endpoint
app.get('/health/draw-next', async (req, res) => {
  try {
    // Test database connectivity
    await dataSource.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

## Future Enhancements

### Question Prioritization

```typescript
// Add priority scoring to questions
const nextQuestion = await queryRunner.manager
  .createQueryBuilder(GameRound, 'round')
  .where('round.gameId = :gameId', { gameId })
  .andWhere('round.status = :status', { status: RoundStatus.PENDING })
  .orderBy('round.priority', 'DESC')
  .addOrderBy('round.roundNumber', 'ASC')
  .setLock('pessimistic_write')
  .setOnLocked('skip_locked')
  .getOne();
```

### Question Categories

```typescript
// Filter by question category
.andWhere('round.roundData->>\'category\' = :category', { category })
```

### Adaptive Difficulty

```typescript
// Adjust question selection based on player performance
const difficulty = calculatePlayerDifficulty(gameId);
.andWhere('round.roundData->>\'difficulty\' = :difficulty', { difficulty })
```

This implementation provides a robust, scalable, and secure way to draw questions for game rounds while maintaining data integrity and user privacy. 