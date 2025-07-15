# Game State Transition Service

A comprehensive NestJS service that manages game state transitions with validation, mutation, and error handling.

## Overview

The `GameStateService` provides a robust state machine for managing game lifecycle transitions. It ensures that only valid state transitions occur and throws `ERR_STATE_TRANSITION` errors for invalid hops.

## Game States

### Core States
- **`LOBBY`**: Initial state when players are joining
- **`QUESTION_BUILD`**: Players are building/selecting questions
- **`ROUND_ACTIVE`**: A round is currently being played
- **`ROUND_RESULTS`**: Round has ended, showing results
- **`GAME_FINISHED`**: All rounds completed, game is over
- **`CANCELLED`**: Game was cancelled

## State Transition Flow

```
LOBBY → QUESTION_BUILD → ROUND_ACTIVE → ROUND_RESULTS → ROUND_ACTIVE → ... → GAME_FINISHED
  ↓
CANCELLED
```

## Valid Transitions

| From State | To State | Conditions |
|------------|----------|------------|
| `LOBBY` | `QUESTION_BUILD` | ≥2 players, questions available |
| `LOBBY` | `CANCELLED` | Game not finished/cancelled |
| `QUESTION_BUILD` | `ROUND_ACTIVE` | Round is pending |
| `QUESTION_BUILD` | `CANCELLED` | Game not finished/cancelled |
| `ROUND_ACTIVE` | `ROUND_RESULTS` | Round is active |
| `ROUND_RESULTS` | `ROUND_ACTIVE` | More rounds available |
| `ROUND_RESULTS` | `GAME_FINISHED` | All rounds completed |

## Usage

### Basic State Transition

```typescript
// Transition from LOBBY to QUESTION_BUILD
const result = await gameStateService.transitionTo(game, GameState.QUESTION_BUILD);

// Transition with round context
const result = await gameStateService.transitionTo(
  game, 
  GameState.ROUND_ACTIVE, 
  currentRound
);
```

### Check Available Transitions

```typescript
const availableTransitions = gameStateService.getAvailableTransitions(game);
// Returns: ['question_build', 'cancelled']
```

### Validate Transition Possibility

```typescript
const canTransition = await gameStateService.canTransitionTo(
  game, 
  GameState.QUESTION_BUILD
);
// Returns: true/false
```

### Get Current State

```typescript
const currentState = gameStateService.getCurrentState(game);
// Returns: GameState enum value
```

## Error Handling

### GameStateTransitionError

Thrown when:
- Invalid transition attempted
- Transition conditions not met
- State machine rules violated

```typescript
try {
  await gameStateService.transitionTo(game, GameState.GAME_FINISHED);
} catch (error) {
  if (error instanceof GameStateTransitionError) {
    console.log(`Cannot transition from ${error.currentState} to ${error.targetState}`);
    console.log(`Error: ${error.message}`);
  }
}
```

### Error Properties

- `name`: Always `'ERR_STATE_TRANSITION'`
- `message`: Human-readable error description
- `currentState`: Current game state
- `targetState`: Attempted target state

## State Conditions

### LOBBY → QUESTION_BUILD
- Minimum 2 players joined
- At least 1 question available
- Game not already started

### QUESTION_BUILD → ROUND_ACTIVE
- Round status is `PENDING`
- Game is in `PLAYING` status
- Valid round provided

### ROUND_ACTIVE → ROUND_RESULTS
- Round status is `ACTIVE`
- Round timer expired or all answers submitted

### ROUND_RESULTS → ROUND_ACTIVE
- More rounds available (roundNumber < roundsPerGame)
- Next round exists and is `PENDING`

### ROUND_RESULTS → GAME_FINISHED
- All rounds completed (roundsPerGame reached)
- All rounds have `FINISHED` status

## State Actions

Each transition can trigger specific actions:

### onEnterQuestionBuild
- Sets game status to `PLAYING`
- Records start time
- Updates metadata with state

### onEnterRoundActive
- Sets round status to `ACTIVE`
- Records round start time
- Updates game metadata with round info

### onEnterRoundResults
- Sets round status to `FINISHED`
- Records round end time
- Updates game metadata

### onStartNextRound
- Finds next round by number
- Activates next round
- Updates metadata with new round info

### onGameFinished
- Sets game status to `FINISHED`
- Records game end time
- Updates metadata

### onGameCancelled
- Sets game status to `CANCELLED`
- Records cancellation time
- Updates metadata

## Real-time Broadcasting

All state transitions are broadcast to the game room via Redis:

```json
{
  "type": "state_transition",
  "data": {
    "fromState": "lobby",
    "toState": "question_build",
    "gameId": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "metadata": { ... }
  }
}
```

## Database Integration

### Game Metadata Updates
The service updates the game's `metadata` JSONB field with:
- `currentState`: Current game state
- `lastStateChange`: Timestamp of last transition
- `currentRoundId`: Active round ID (if applicable)
- `currentRoundNumber`: Active round number (if applicable)
- State-specific timestamps

### Round Status Updates
When transitioning to/from round states:
- Round `status` is updated
- Round `startedAt`/`endedAt` timestamps are set
- Round is saved to database

## API Endpoints

### POST /games/:gid/state/transition
Transition game to a new state.

**Request:**
```json
{
  "targetState": "question_build",
  "roundId": "optional-round-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully transitioned to question_build",
  "data": {
    "gameId": "uuid",
    "fromState": "lobby",
    "toState": "question_build",
    "currentRound": null
  }
}
```

### POST /games/:gid/state/available-transitions
Get available transitions for current state.

**Response:**
```json
{
  "currentState": "lobby",
  "availableTransitions": ["question_build", "cancelled"],
  "gameId": "uuid"
}
```

### POST /games/:gid/state/can-transition
Check if a specific transition is possible.

**Request:**
```json
{
  "targetState": "question_build",
  "roundId": "optional-round-id"
}
```

**Response:**
```json
{
  "canTransition": true,
  "currentState": "lobby",
  "targetState": "question_build",
  "gameId": "uuid"
}
```

## Testing

The service includes comprehensive unit tests covering:
- All valid state transitions
- Invalid transition attempts
- Condition checking
- Error handling
- Edge cases

Run tests with:
```bash
npm test game-state.service.test.ts
```

## Configuration

### Environment Variables
- `REDIS_URL`: Redis connection for broadcasting
- `JWT_SECRET`: JWT secret for authentication

### Dependencies
- `@nestjs/typeorm`: Database integration
- `@party-puzzle-palooza/database`: Entity definitions
- `RedisService`: Real-time broadcasting

## Best Practices

1. **Always check conditions before transitioning**
2. **Handle GameStateTransitionError appropriately**
3. **Use available transitions to guide UI**
4. **Monitor state changes via Redis broadcasts**
5. **Validate game state before operations**
6. **Log all state transitions for debugging**

## Example Integration

```typescript
@Injectable()
export class GameController {
  constructor(private gameStateService: GameStateService) {}

  async startGame(gameId: string) {
    const game = await this.getGame(gameId);
    
    // Check if we can start
    const canStart = await this.gameStateService.canTransitionTo(
      game, 
      GameState.QUESTION_BUILD
    );
    
    if (!canStart) {
      throw new BadRequestException('Cannot start game yet');
    }
    
    // Perform transition
    const result = await this.gameStateService.transitionTo(
      game, 
      GameState.QUESTION_BUILD
    );
    
    return result;
  }
}
``` 