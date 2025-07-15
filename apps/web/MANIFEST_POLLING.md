# Manifest Polling Feature

## Overview

The manifest polling feature provides real-time synchronization across multiple browser tabs by continuously polling the game manifest endpoint and automatically starting rounds when all players have contributed questions.

## Features

### Real-time Manifest Polling
- Polls `/api/games/:gid/manifest` every 2 seconds by default
- Detects changes in players, questions, and game state
- Updates Zustand store with latest manifest data
- Handles network errors gracefully with retry logic

### Automatic Round Start
- Monitors when all players have created at least one queued question
- Automatically calls `POST /api/games/:gid/rounds/start` when conditions are met
- Prevents duplicate round start calls with state tracking

### Multi-tab Synchronization
- All tabs receive the same manifest updates
- Question selections are synchronized across tabs
- Custom question creation is reflected in all tabs
- State changes are immediately visible across all instances

## Implementation

### useManifestPolling Hook

```typescript
const { isPolling, diff, error, startRound } = useManifestPolling(gameId, pollInterval);
```

**Parameters:**
- `gameId`: The game identifier
- `pollInterval`: Polling interval in milliseconds (default: 2000)

**Returns:**
- `isPolling`: Boolean indicating if polling is active
- `diff`: Object containing change detection information
- `error`: Error message if polling fails
- `startRound`: Function to manually start a round

### ManifestDiff Interface

```typescript
interface ManifestDiff {
  hasChanges: boolean;
  newQuestions?: number;
  newPlayers?: number;
  allPlayersHaveQuestions?: boolean;
}
```

### Change Detection Logic

The hook compares manifests to detect:
- New questions added
- New players joined
- Changes in question content
- All players having questions (for auto-start)

### Error Handling

- Network errors are displayed to users
- Aborted requests (tab switching) are handled gracefully
- Automatic retry on connection restoration
- Offline indicator when polling fails

## Usage in Components

### GameBuild Page Integration

```typescript
// In GameBuild.tsx
const { isPolling, diff, error: pollingError, startRound } = useManifestPolling(gid || '');

// Display polling status
<div data-testid="polling-status">
  {isPolling ? (
    <div className="flex items-center gap-1 text-sm text-blue-600">
      <RefreshCw className="h-3 w-3 animate-spin" />
      <span>Live</span>
    </div>
  ) : (
    <div className="flex items-center gap-1 text-sm text-gray-500">
      <RefreshCw className="h-3 w-3" />
      <span>Offline</span>
    </div>
  )}
</div>

// Display "All Ready" status
{diff.allPlayersHaveQuestions && (
  <Badge data-testid="all-ready-badge">
    <CheckCircle2 className="h-3 w-3" />
    All Ready
  </Badge>
)}

// Display error messages
{pollingError && (
  <div data-testid="polling-error">
    <AlertCircle className="h-4 w-4" />
    <span>Connection Error</span>
    <p>{pollingError}</p>
  </div>
)}
```

## Testing

### Cypress E2E Tests

The feature includes comprehensive Cypress tests covering:

1. **Multi-tab Synchronization**
   - Question selection sync across tabs
   - Custom question creation sync
   - State consistency during tab switching

2. **Auto-start Functionality**
   - Round start when all players have questions
   - Proper API call verification
   - State transition handling

3. **Error Handling**
   - Network interruption recovery
   - Error message display
   - Offline indicator functionality

4. **Rapid State Changes**
   - Concurrent modifications
   - Race condition handling
   - Final state consistency

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Open Cypress test runner
npm run test:e2e:open

# Run specific test file
npx cypress run --spec "cypress/e2e/game-build-multi-tab.cy.ts"
```

### Test Data Attributes

Key elements use `data-testid` attributes for reliable testing:

- `polling-status`: Polling indicator
- `all-ready-badge`: All players ready status
- `polling-error`: Error message container
- `selected-count`: Selected questions counter
- `question-card`: Individual question cards
- `custom-question`: Custom question cards
- `suggestions-tab` / `write-tab`: Tab triggers
- `question-input` / `category-input`: Form inputs
- `type-select` / `type-option-*`: Type selection
- `submit-question`: Form submission button

## Configuration

### Polling Interval

The default polling interval is 2 seconds. This can be adjusted based on:

- Network conditions
- Server load
- Real-time requirements
- Battery considerations

### API Endpoints

The feature expects these endpoints:

- `GET /api/games/:gid/manifest` - Fetch game manifest
- `POST /api/games/:gid/rounds/start` - Start game round

### Error Thresholds

- Network timeout: 10 seconds
- Retry attempts: Automatic on connection restore
- Error display: Immediate with user feedback

## Performance Considerations

### Memory Management
- AbortController for request cancellation
- Cleanup on component unmount
- Efficient diff detection with JSON comparison

### Network Optimization
- Minimal payload size
- Efficient change detection
- Graceful degradation on poor connections

### State Management
- Zustand store integration
- Minimal re-renders
- Efficient state updates

## Future Enhancements

### WebSocket Integration
- Replace polling with WebSocket for real-time updates
- Reduce server load and improve responsiveness
- Maintain backward compatibility

### Advanced Sync Features
- Conflict resolution for concurrent edits
- Optimistic updates with rollback
- Offline support with sync on reconnect

### Performance Monitoring
- Polling success rate metrics
- Response time tracking
- Error rate monitoring 