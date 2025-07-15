# Responder Highlighting & Countdown Feature

## Overview

The responder highlighting feature provides real-time visual feedback when a target is selected, highlighting the responder's avatar and displaying a countdown to the Reveal/Gamble phase. This creates an engaging, interactive experience for all players.

## Key Features

### 🎯 **Responder Selection Broadcast**
- Real-time notification when target is selected
- Broadcasts responder information to all players
- Includes responder name, avatar, and phase timing

### ⏰ **Countdown Timer**
- 30-second countdown for response phase
- Visual progress bar with time remaining
- Warning indicators when time is running low
- Automatic phase transition to Reveal/Gamble

### 🎨 **Visual Highlighting**
- Animated avatar highlighting for responder
- Phase-specific color coding
- Progress indicators and status badges
- Smooth transitions between phases

## Implementation

### Backend Broadcast

When a target is set, the server broadcasts two events:

```typescript
// 1. Private target confirmation (for asker only)
await redisService.publishToGameJson(gameId, {
  type: 'target_set',
  data: {
    roundId,
    askerId,
    targetPlayerId,
    targetPlayerName,
    setAt: timestamp,
    isPrivate: true
  }
});

// 2. Public responder selection (for all players)
await redisService.publishToGameJson(gameId, {
  type: 'responder_selected',
  data: {
    roundId,
    responderId: targetPlayerId,
    responderName: targetPlayerName,
    responderAvatar: targetPlayer.user.avatarUrl,
    phase: 'response',
    responseStartTime: startTime,
    responseEndTime: endTime,
    countdownDuration: 30000,
    nextPhase: 'reveal_gamble'
  }
});
```

### Frontend Components

#### ResponderHighlight Component

```typescript
<ResponderHighlight
  responderId={responderData.responderId}
  responderName={responderData.responderName}
  responderAvatar={responderData.responderAvatar}
  countdownDuration={responderData.countdownDuration}
  onCountdownComplete={handleCountdownComplete}
  phase={responderData.phase}
/>
```

**Features:**
- **Animated Avatar**: Pulsing ring around responder's avatar
- **Countdown Display**: Real-time countdown with progress bar
- **Phase Indicators**: Color-coded badges for different phases
- **Warning System**: Visual alerts when time is running low

#### useResponderState Hook

```typescript
const {
  responderData,
  isResponderSelected,
  isCountdownActive,
  timeRemaining,
  formattedTime,
  countdownProgress,
  clearResponderData,
  isCurrentUserResponder,
} = useResponderState({
  roundId: 'round-1',
  onPhaseChange: (phase) => {
    // Handle phase transitions
  },
});
```

**Capabilities:**
- **WebSocket Integration**: Listens for responder selection events
- **Time Calculations**: Real-time countdown and progress tracking
- **Phase Management**: Handles transitions between game phases
- **Toast Notifications**: User-friendly notifications for events

## Game Phases

### 1. **Pending Phase**
- Waiting for target selection
- No countdown active
- Neutral visual state

### 2. **Response Phase** ⏰
- 30-second countdown active
- Responder avatar highlighted with pulsing animation
- Progress bar shows time remaining
- Warning indicators when ≤10 seconds remain

### 3. **Reveal & Gamble Phase** ⚡
- Countdown completed
- Orange color scheme
- Time for answer revelation and betting
- Different visual indicators

### 4. **Finished Phase** ✅
- Round complete
- Green color scheme
- Final results displayed

## Visual Design

### Color Scheme

```css
/* Response Phase */
.response-phase {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 2px solid #3b82f6;
}

/* Reveal & Gamble Phase */
.reveal-gamble-phase {
  background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
  border: 2px solid #f97316;
}

/* Finished Phase */
.finished-phase {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border: 2px solid #22c55e;
}
```

### Animation States

```css
/* Pulsing Avatar */
.responder-avatar {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Countdown Progress */
.countdown-progress {
  transition: width 1s linear;
}

/* Warning Flash */
.warning-flash {
  animation: flash 1s ease-in-out infinite;
}

@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## API Endpoints

### POST /rounds/:rid/target
Set target for a round (asker only)

**Request:**
```json
{
  "targetPlayerId": "player-uuid"
}
```

**Response:**
```json
{
  "roundId": "round-uuid",
  "askerId": "asker-uuid",
  "targetPlayerId": "target-uuid",
  "targetPlayerName": "John Doe",
  "setAt": "2024-01-01T00:00:00.000Z",
  "message": "Target set successfully: John Doe"
}
```

### GET /rounds/:rid/phase
Get current phase information

**Response:**
```json
{
  "roundId": "round-uuid",
  "phase": "response",
  "responseStartTime": "2024-01-01T00:00:00.000Z",
  "responseEndTime": "2024-01-01T00:00:30.000Z",
  "countdownDuration": 30000,
  "nextPhase": "reveal_gamble"
}
```

## WebSocket Events

### responder_selected
Broadcasted when a responder is selected

```json
{
  "type": "responder_selected",
  "data": {
    "roundId": "round-uuid",
    "responderId": "responder-uuid",
    "responderName": "John Doe",
    "responderAvatar": "https://example.com/avatar.jpg",
    "phase": "response",
    "responseStartTime": "2024-01-01T00:00:00.000Z",
    "responseEndTime": "2024-01-01T00:00:30.000Z",
    "countdownDuration": 30000,
    "nextPhase": "reveal_gamble"
  }
}
```

### phase_change
Broadcasted when game phase changes

```json
{
  "type": "phase_change",
  "data": {
    "roundId": "round-uuid",
    "phase": "reveal_gamble",
    "timestamp": "2024-01-01T00:00:30.000Z"
  }
}
```

## User Experience Flow

### 1. **Target Selection**
1. Asker selects target from modal
2. Optimistic UI update shows selection
3. Success toast notification
4. Backend validates and saves target

### 2. **Responder Broadcast**
1. Server broadcasts responder selection
2. All players receive real-time update
3. Responder avatar highlights with animation
4. Countdown timer starts automatically

### 3. **Countdown Phase**
1. 30-second countdown with progress bar
2. Visual warnings when time is low (≤10s)
3. Real-time updates every second
4. Smooth progress bar animation

### 4. **Phase Transition**
1. Countdown reaches zero
2. Automatic transition to Reveal/Gamble phase
3. Color scheme changes to orange
4. Toast notification for phase change

### 5. **Completion**
1. Round finishes
2. Final results displayed
3. Green completion indicators
4. Ready for next round

## Accessibility Features

### Visual Indicators
- **High Contrast**: Clear color differentiation between phases
- **Large Text**: Readable countdown timers
- **Icons**: Intuitive phase and status icons
- **Animations**: Smooth, non-distracting animations

### Screen Reader Support
- **ARIA Labels**: Proper labeling for all interactive elements
- **Status Announcements**: Live region updates for phase changes
- **Progress Indicators**: Announced countdown progress
- **Focus Management**: Logical tab order and focus indicators

### Keyboard Navigation
- **Tab Navigation**: All interactive elements accessible
- **Space/Enter**: Activate buttons and controls
- **Escape**: Close modals and dialogs
- **Arrow Keys**: Navigate through options

## Performance Considerations

### Optimizations
- **Debounced Updates**: Countdown updates throttled to 1 second
- **Memoized Calculations**: Time calculations cached
- **Conditional Rendering**: Components only render when needed
- **Efficient Animations**: CSS transforms for smooth performance

### Memory Management
- **Cleanup Functions**: Proper cleanup of intervals and listeners
- **State Reset**: Clear state when moving to new rounds
- **Event Cleanup**: Remove WebSocket listeners on unmount

## Testing

### Unit Tests
- ✅ **Countdown Accuracy**: Timer precision and formatting
- ✅ **Phase Transitions**: Correct phase state changes
- ✅ **WebSocket Events**: Proper event handling
- ✅ **Visual States**: Correct styling for each phase

### Integration Tests
- ✅ **End-to-End Flow**: Complete target → countdown → transition
- ✅ **Multi-Player Sync**: All players see same state
- ✅ **Network Resilience**: Handles connection issues
- ✅ **Performance**: Smooth animations and updates

### User Acceptance Tests
- ✅ **Visual Feedback**: Clear responder highlighting
- ✅ **Time Awareness**: Accurate countdown display
- ✅ **Phase Clarity**: Obvious phase transitions
- ✅ **Accessibility**: Screen reader compatibility

## Future Enhancements

### Advanced Features
- **Custom Countdown Duration**: Configurable response times
- **Multiple Responders**: Support for multiple targets
- **Phase Extensions**: Ability to extend time limits
- **Advanced Animations**: More sophisticated visual effects

### Analytics
- **Response Time Tracking**: Measure actual response times
- **Phase Duration Metrics**: Track phase completion rates
- **User Engagement**: Monitor interaction patterns
- **Performance Monitoring**: Track animation smoothness

This implementation provides a robust, engaging, and accessible responder highlighting system that enhances the multiplayer game experience with real-time feedback and clear visual communication. 