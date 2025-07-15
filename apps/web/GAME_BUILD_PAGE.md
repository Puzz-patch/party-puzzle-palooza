# Game Build Page

A Next.js page for the game question build phase with suggestions/write tabs, Tailwind card grid, lock & load button, and Zustand store integration.

## Overview

The Game Build page (`/game/[gid]/build`) allows players to select questions for the game and write custom questions. It features a modern UI with real-time updates via WebSocket integration.

## Features

### 🎯 Core Functionality
- **Question Selection**: Browse and select from pre-made questions
- **Custom Questions**: Write and submit custom questions
- **Real-time Updates**: Live synchronization via WebSocket
- **State Management**: Zustand store for client-side state
- **Progress Tracking**: Visual progress indicator for question selection

### 🎨 UI Components
- **Tabs Interface**: Suggestions and Write custom questions
- **Card Grid**: Responsive grid layout for questions
- **Filtering**: Filter by question type and search functionality
- **Progress Bar**: Visual feedback for selection progress
- **Lock & Load**: Button to finalize question selection

## Page Structure

### Header Section
- Game name and code display
- Player count and round timer
- Real-time player status

### Progress Section
- Question selection progress bar
- Selected vs. custom question counts
- Lock/Unlock functionality
- Start game button (when locked)

### Main Content Tabs

#### 💡 Suggestions Tab
- **Type Filters**: All, Would You Rather, Trivia, Word Association, Drawing
- **Search**: Text search across questions and categories
- **Question Grid**: Responsive card layout
- **Selection State**: Visual indicators for selected questions

#### ✍️ Write Custom Tab
- **Custom Question Form**: Comprehensive form for creating questions
- **Question Types**: Support for all game question types
- **Validation**: Client-side validation with Zod
- **Custom Questions List**: Display of user-created questions

## Components

### QuestionCard
Reusable card component for displaying questions with:
- Question type badges with icons
- Selection state indicators
- Action buttons (Select/Remove)
- Custom question management (Edit/Delete)
- Responsive design

### CustomQuestionForm
Form component for creating custom questions with:
- Question type selection
- Text input with validation
- Options management for multiple choice
- Category assignment
- Form validation with error handling

### GameBuild
Main page component with:
- Zustand store integration
- WebSocket connection management
- Tab navigation
- Progress tracking
- State management

## State Management

### Zustand Store (game-store.ts)
```typescript
interface GameStore {
  // State
  game: GameState | null;
  selectedQuestions: string[];
  customQuestions: GameQuestion[];
  isLocked: boolean;
  
  // Actions
  selectQuestion: (questionId: string) => void;
  deselectQuestion: (questionId: string) => void;
  addCustomQuestion: (question: GameQuestion) => void;
  lockQuestions: () => void;
  loadQuestions: () => void;
  applyPatch: (patch: any) => void;
}
```

### WebSocket Integration
- Real-time question updates
- Player join/leave notifications
- State transition broadcasts
- Custom question additions

## User Flow

### 1. Question Selection
1. User navigates to `/game/[gid]/build`
2. Views available questions in Suggestions tab
3. Filters by type or searches for specific questions
4. Clicks "Select" on desired questions
5. Sees progress bar update with selection count

### 2. Custom Question Creation
1. Switches to "Write Custom" tab
2. Clicks "Write Custom Question" button
3. Fills out question form with type, text, category
4. Adds options for multiple choice questions
5. Submits form to create custom question
6. Custom question appears in list and can be selected

### 3. Lock & Load Process
1. User selects enough questions to meet game requirements
2. "Lock & Load" button becomes enabled
3. User clicks to lock question selection
4. UI updates to show locked state
5. "Start Game" button appears
6. User clicks to begin the game

## API Integration

### WebSocket Messages
```typescript
// Subscribe to game room
{
  type: 'subscribe',
  gameId: string
}

// Question selection
{
  type: 'question_selected',
  questionId: string
}

// Custom question creation
{
  type: 'custom_question_added',
  question: GameQuestion
}

// State transition
{
  type: 'state_transition',
  data: {
    fromState: string,
    toState: string,
    gameId: string
  }
}
```

### REST API Endpoints
- `GET /games/:gid/manifest` - Get game state and questions
- `POST /games/:gid/questions/custom` - Create custom question
- `POST /games/:gid/state/transition` - Transition game state

## Styling

### Tailwind CSS Classes
- **Responsive Grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Card Layout**: `bg-white rounded-lg shadow-md`
- **Progress Bar**: `w-full bg-gray-200 rounded-full`
- **Button States**: `bg-primary hover:bg-primary/90 disabled:opacity-50`
- **Type Badges**: Color-coded badges for question types

### Design System
- **Colors**: Primary blue, success green, warning orange, error red
- **Spacing**: Consistent 4px grid system
- **Typography**: Inter font family with proper hierarchy
- **Animations**: Smooth transitions and hover effects

## Error Handling

### Form Validation
- Required field validation
- Character length limits
- Question type validation
- Real-time error feedback

### WebSocket Errors
- Connection retry logic
- Graceful degradation
- Error state display
- Reconnection handling

### State Errors
- Invalid question selection
- Lock/unlock validation
- Progress tracking errors
- Store synchronization issues

## Performance Optimizations

### React Optimizations
- Memoized selectors for Zustand store
- React.memo for card components
- Lazy loading for question lists
- Debounced search input

### WebSocket Optimizations
- Connection pooling
- Message batching
- Heartbeat monitoring
- Automatic reconnection

## Testing

### Unit Tests
- Component rendering tests
- State management tests
- Form validation tests
- WebSocket message handling

### Integration Tests
- End-to-end user flows
- API integration tests
- WebSocket communication tests
- State synchronization tests

## Accessibility

### ARIA Labels
- Proper form labels
- Button descriptions
- Progress indicators
- Error announcements

### Keyboard Navigation
- Tab order management
- Focus indicators
- Keyboard shortcuts
- Screen reader support

## Browser Support

### Modern Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Features
- WebSocket API
- CSS Grid
- Flexbox
- ES2020+ features

## Deployment

### Build Process
```bash
npm run build
npm run build:dev  # Development build
```

### Environment Variables
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
NODE_ENV=development
```

### Production Considerations
- CDN for static assets
- WebSocket SSL/TLS
- API rate limiting
- Error monitoring

## Future Enhancements

### Planned Features
- Question preview mode
- Collaborative editing
- Question rating system
- Advanced filtering options
- Question templates
- Bulk question import

### Technical Improvements
- Service Worker for offline support
- WebSocket fallback to polling
- Advanced caching strategies
- Performance monitoring
- A/B testing framework 