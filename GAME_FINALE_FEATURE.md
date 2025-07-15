# Game Finale Feature

## Overview

The Game Finale feature provides a comprehensive end-game system that validates deck usage requirements, computes final scores, distributes unused prompt tokens, and stores complete game results. This ensures games are properly concluded with fair token distribution and complete statistics.

## Key Features

### 🎯 **Deck Usage Validation**
- **Minimum 50% requirement** for game completion
- **Real-time calculation** of used vs. total questions
- **Clear error messaging** when requirement not met
- **Prevents premature finalization**

### 🏆 **Score Computation**
- **Comprehensive scoring** from all rounds and player actions
- **Rank-based leaderboard** with proper tie-breaking
- **Accuracy calculations** and performance metrics
- **Winner determination** with detailed statistics

### 🪙 **Token Distribution**
- **Unused prompt tokens** automatically granted to creators
- **Atomic transactions** with proper ledger tracking
- **Balance updates** with transaction history
- **Fair distribution** based on unused question count

### 📊 **Complete Results Storage**
- **Game metadata** with completion statistics
- **Player rankings** and final scores
- **Deck usage metrics** and validation status
- **Timestamp tracking** for audit purposes

## API Endpoint

### POST /api/games/:gid/finale

**Authentication:** Requires valid `player_token` cookie

**Request:**
```http
POST /api/games/123e4567-e89b-12d3-a456-426614174000/finale
Cookie: player_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Game \"Test Game\" finalized successfully! Winner: player1 with 250 points.",
  "data": {
    "gameId": "123e4567-e89b-12d3-a456-426614174000",
    "gameName": "Test Game",
    "gameCode": "TEST123",
    "totalRounds": 3,
    "deckUsagePercentage": 75.0,
    "deckUsageRequirementMet": true,
    "winner": {
      "playerId": "player-1",
      "username": "player1",
      "firstName": "John",
      "lastName": "Doe",
      "finalScore": 250,
      "correctAnswers": 4,
      "totalAnswers": 5,
      "unusedPromptTokens": 2,
      "rank": 1,
      "stats": {
        "averageScore": 50.0,
        "accuracy": 80.0,
        "roundsParticipated": 3,
        "highestRoundScore": 100
      }
    },
    "playerScores": [
      {
        "playerId": "player-1",
        "username": "player1",
        "firstName": "John",
        "lastName": "Doe",
        "finalScore": 250,
        "correctAnswers": 4,
        "totalAnswers": 5,
        "unusedPromptTokens": 2,
        "rank": 1,
        "stats": { ... }
      },
      {
        "playerId": "player-2",
        "username": "player2",
        "firstName": "Jane",
        "lastName": "Smith",
        "finalScore": 200,
        "correctAnswers": 3,
        "totalAnswers": 5,
        "unusedPromptTokens": 1,
        "rank": 2,
        "stats": { ... }
      }
    ],
    "totalUnusedPromptTokens": 3,
    "completedAt": "2024-01-15T10:30:00.000Z",
    "gameStats": {
      "totalQuestions": 4,
      "usedQuestions": 3,
      "averageScore": 225.0,
      "totalCorrectAnswers": 7,
      "totalAnswers": 10
    }
  }
}
```

**Error Responses:**

```json
// Deck usage requirement not met
{
  "statusCode": 400,
  "message": "Deck usage requirement not met. Used 25% of questions, minimum 50% required.",
  "error": "Bad Request"
}

// Game already finalized
{
  "statusCode": 400,
  "message": "Game is already finalized",
  "error": "Bad Request"
}

// Game not found
{
  "statusCode": 404,
  "message": "Game not found",
  "error": "Not Found"
}
```

## Implementation Details

### Deck Usage Calculation

```typescript
private async checkDeckUsage(game: Game): Promise<{
  usagePercentage: number;
  requirementMet: boolean;
  usedQuestions: number;
  totalQuestions: number;
}> {
  const totalQuestions = game.gameRounds.length;
  const usedQuestions = game.gameRounds.filter(round => 
    round.status === RoundStatus.FINISHED || round.status === RoundStatus.ACTIVE
  ).length;

  const usagePercentage = totalQuestions > 0 ? (usedQuestions / totalQuestions) * 100 : 0;
  const requirementMet = usagePercentage >= 50;

  return {
    usagePercentage: Math.round(usagePercentage * 100) / 100,
    requirementMet,
    usedQuestions,
    totalQuestions
  };
}
```

### Score Computation

```typescript
private async computeFinalScores(game: Game): Promise<PlayerFinalScoreDto[]> {
  const playerScores: PlayerFinalScoreDto[] = [];

  for (const gamePlayer of game.gamePlayers) {
    // Base score from game player entity
    let finalScore = gamePlayer.score;
    let correctAnswers = gamePlayer.correctAnswers;
    let totalAnswers = gamePlayer.totalAnswers;

    // Add scores from round results
    for (const round of game.gameRounds) {
      if (round.status === RoundStatus.FINISHED && round.results) {
        const playerResult = round.results[gamePlayer.userId];
        if (playerResult) {
          finalScore += playerResult.score || 0;
          if (playerResult.correct) correctAnswers++;
          if (playerResult.answered) totalAnswers++;
        }
      }
    }

    // Calculate statistics
    const stats = {
      averageScore: totalAnswers > 0 ? finalScore / totalAnswers : 0,
      accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
      roundsParticipated: game.gameRounds.filter(r => 
        r.status === RoundStatus.FINISHED && r.results?.[gamePlayer.userId]
      ).length,
      highestRoundScore: Math.max(
        ...game.gameRounds
          .filter(r => r.status === RoundStatus.FINISHED && r.results?.[gamePlayer.userId])
          .map(r => r.results[gamePlayer.userId]?.score || 0)
      )
    };

    playerScores.push({
      playerId: gamePlayer.userId,
      username: gamePlayer.user.username,
      firstName: gamePlayer.user.firstName,
      lastName: gamePlayer.user.lastName,
      finalScore,
      correctAnswers,
      totalAnswers,
      unusedPromptTokens: 0, // Calculated later
      rank: 0, // Assigned after sorting
      stats
    });
  }

  // Sort by score and assign ranks
  playerScores.sort((a, b) => b.finalScore - a.finalScore);
  playerScores.forEach((player, index) => {
    player.rank = index + 1;
  });

  return playerScores;
}
```

### Token Distribution

```typescript
private async grantUnusedPromptTokens(
  game: Game, 
  playerScores: PlayerFinalScoreDto[], 
  queryRunner: any
): Promise<{ totalTokens: number; playerTokens: Map<string, number> }> {
  const playerTokens = new Map<string, number>();
  let totalTokens = 0;

  for (const gamePlayer of game.gamePlayers) {
    // Count unused questions by this player
    const playerQuestions = game.gameRounds.filter(round => 
      round.createdById === gamePlayer.userId && round.status === RoundStatus.PENDING
    );

    const unusedTokens = playerQuestions.length;
    playerTokens.set(gamePlayer.userId, unusedTokens);
    totalTokens += unusedTokens;

    if (unusedTokens > 0) {
      // Get or create user balance
      let userBalance = await queryRunner.manager.findOne(UserBalance, {
        where: { userId: gamePlayer.userId }
      });

      if (!userBalance) {
        userBalance = queryRunner.manager.create(UserBalance, {
          userId: gamePlayer.userId,
          balance: 0,
          lastUpdated: new Date()
        });
      }

      // Update balance
      const oldBalance = userBalance.balance;
      userBalance.balance += unusedTokens;
      userBalance.lastUpdated = new Date();

      await queryRunner.manager.save(userBalance);

      // Create transaction ledger entry
      const transaction = queryRunner.manager.create(TransactionLedger, {
        userId: gamePlayer.userId,
        gameId: game.id,
        type: 'unused_prompt_tokens',
        amount: unusedTokens,
        balanceBefore: oldBalance,
        balanceAfter: userBalance.balance,
        description: `Unused prompt tokens from game ${game.code}`,
        metadata: {
          gameId: game.id,
          gameCode: game.code,
          unusedQuestions: playerQuestions.map(q => q.id),
          reason: 'game_finale'
        }
      });

      await queryRunner.manager.save(transaction);

      // Update player score with token count
      const playerScore = playerScores.find(p => p.playerId === gamePlayer.userId);
      if (playerScore) {
        playerScore.unusedPromptTokens = unusedTokens;
      }
    }
  }

  return { totalTokens, playerTokens };
}
```

## Database Transactions

### Atomic Operations
All finale operations are wrapped in database transactions to ensure data consistency:

1. **Deck usage validation**
2. **Score computation**
3. **Token distribution**
4. **Game status update**
5. **Metadata storage**

### Rollback Handling
If any operation fails, the entire transaction is rolled back:

```typescript
try {
  await queryRunner.connect();
  await queryRunner.startTransaction();

  // All finale operations...

  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

## WebSocket Broadcasting

### Finale Event
When a game is finalized, a WebSocket event is broadcast to all players:

```json
{
  "type": "game_finale",
  "gameId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "gameId": "123e4567-e89b-12d3-a456-426614174000",
    "gameName": "Test Game",
    "gameCode": "TEST123",
    "winner": {
      "playerId": "player-1",
      "username": "player1",
      "finalScore": 250
    },
    "playerScores": [...],
    "deckUsage": 75.0,
    "completedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": 1705312200000
}
```

## Frontend Integration

### useGameFinale Hook
```typescript
const {
  isFinalizing,
  finaleResult,
  error,
  finalizeGame,
  winner,
  topPlayers,
  deckUsageStatus,
  totalTokensDistributed,
  gameStats,
  playerStatsSummary,
  completionTime,
  formattedCompletionTime,
  getPlayerByRank,
  isDeckUsageRequirementMet,
  isGameFinalized,
  hasFinaleResult,
  canFinalize
} = useGameFinale({ gameId });
```

### GameFinaleResults Component
```tsx
<GameFinaleResults
  finaleResult={finaleResult}
  onPlayAgain={() => navigate('/games/new')}
  onViewArchive={() => setArchiveOpen(true)}
  onShareResults={() => shareResults(finaleResult)}
/>
```

## Error Handling

### Validation Errors
- **Deck usage < 50%**: Clear error message with usage percentage
- **Game already finalized**: Prevents duplicate finalization
- **Game not found**: 404 error for invalid game IDs
- **Access denied**: 403 error for unauthorized access

### Database Errors
- **Transaction rollback**: Automatic rollback on any database error
- **Connection issues**: Proper error propagation
- **Constraint violations**: Detailed error messages

### Network Errors
- **Request timeouts**: Retry logic in frontend
- **Connection failures**: Graceful degradation
- **Partial responses**: Error state management

## Testing

### Unit Tests
- **Deck usage calculation**: Various usage scenarios
- **Score computation**: Different scoring algorithms
- **Token distribution**: Edge cases and validation
- **Error handling**: All error conditions

### Integration Tests
- **End-to-end finale flow**: Complete game finalization
- **Database transactions**: Atomicity verification
- **WebSocket broadcasting**: Real-time updates
- **Token ledger integrity**: Balance consistency

### E2E Tests
- **User finalization flow**: Complete user journey
- **Multi-player scenarios**: Concurrent finalization
- **Error recovery**: Network and database failures
- **Mobile responsiveness**: Cross-device testing

## Performance Considerations

### Database Optimization
- **Indexed queries**: Proper indexing on game and round tables
- **Batch operations**: Efficient bulk updates
- **Connection pooling**: Optimized database connections
- **Query optimization**: Minimal database round trips

### Caching Strategy
- **Redis caching**: Game state caching
- **Result caching**: Finale results caching
- **Token balance caching**: User balance caching
- **Invalidation strategy**: Proper cache invalidation

### Scalability
- **Horizontal scaling**: Multiple server instances
- **Load balancing**: Distributed finale requests
- **Queue management**: Background processing for large games
- **Resource limits**: Memory and CPU optimization

## Security

### Access Control
- **JWT validation**: Secure token-based authentication
- **Game ownership**: Player can only finalize their games
- **Rate limiting**: Prevent abuse of finale endpoint
- **Input validation**: Comprehensive request validation

### Data Integrity
- **Transaction isolation**: ACID compliance
- **Audit logging**: Complete transaction history
- **Data validation**: Schema and business rule validation
- **Backup strategy**: Regular data backups

## Monitoring

### Metrics
- **Finalization success rate**: Track successful finalizations
- **Deck usage distribution**: Monitor usage patterns
- **Token distribution**: Track token economy
- **Performance metrics**: Response times and throughput

### Alerts
- **High failure rates**: Alert on finale failures
- **Deck usage violations**: Monitor requirement compliance
- **Token distribution anomalies**: Detect unusual patterns
- **Performance degradation**: Monitor response times

## Future Enhancements

### Planned Features
- **Advanced scoring algorithms**: Weighted scoring systems
- **Achievement system**: Badges and milestones
- **Tournament mode**: Multi-game competitions
- **Analytics dashboard**: Detailed game analytics

### Technical Improvements
- **Real-time updates**: Live score updates
- **Offline support**: Offline finale processing
- **Advanced caching**: Multi-level caching strategy
- **Performance optimization**: Query and algorithm optimization 