# Archived Prompts Feature

## Overview

The Archived Prompts feature provides a sidebar interface that displays completed game rounds with fog-of-war mechanics. Players can view archived rounds, but the content is only revealed based on the `round.revealed` status.

## Features

### 🗂️ Archive Sidebar
- **Collapsible sidebar** that slides in from the right
- **Toggle button** with archive icon for easy access
- **Real-time updates** via WebSocket for new archived rounds
- **Fog-of-war mechanics** hiding unrevealed content

### 🌫️ Fog of War System
- **Hidden rounds** show fog-of-war emoji (🌫️) and placeholder text
- **Revealed rounds** display full question, options, and correct answers
- **Progressive disclosure** maintains game suspense
- **Visual indicators** for reveal status

### 📊 Round Information
- **Round number** and completion date
- **Player participation** statistics
- **Winner information** (when revealed)
- **Completion status** badges
- **Response rates** and player counts

## Components

### ArchivedPrompts Component
```typescript
interface ArchivedPrompt {
  id: string;
  roundId: string;
  roundNumber: number;
  question: string;
  options: string[];
  correctAnswer?: string;
  revealed: boolean;
  archivedAt: string;
  totalPlayers: number;
  respondedPlayers: number;
  winner?: string;
  winnerScore?: number;
}
```

**Features:**
- Collapsible sidebar with smooth animations
- Card-based layout for each archived round
- Status badges for reveal and completion states
- Responsive design with mobile considerations
- Empty state with helpful messaging

### useArchivedPrompts Hook
```typescript
const {
  archivedPrompts,
  revealedPrompts,
  hiddenPrompts,
  isLoading,
  error,
  completionStats,
  getPromptById,
  getPromptByRoundId,
  isRoundArchived,
  refresh
} = useArchivedPrompts({ gameId });
```

**Features:**
- Automatic fetching of archived prompts
- WebSocket event listeners for real-time updates
- Toast notifications for new archives and reveals
- Computed statistics and filtering
- Error handling and loading states

## Backend API

### GET /api/games/:gid/archived-prompts
Returns all archived prompts for a game with reveal status.

**Response:**
```json
{
  "prompts": [
    {
      "id": "round-uuid",
      "roundId": "round-uuid",
      "roundNumber": 1,
      "question": "Would you rather...",
      "options": ["Option A", "Option B"],
      "correctAnswer": "Option A",
      "revealed": true,
      "archivedAt": "2024-01-15T10:30:00Z",
      "totalPlayers": 4,
      "respondedPlayers": 4,
      "winner": "John Doe",
      "winnerScore": 100
    }
  ]
}
```

### WebSocket Events

#### round_archived
Broadcasted when a round is completed and archived.

```json
{
  "type": "round_archived",
  "gameId": "game-uuid",
  "data": {
    "roundId": "round-uuid",
    "roundNumber": 1,
    "question": "Would you rather...",
    "options": ["Option A", "Option B"],
    "correctAnswer": "Option A",
    "revealed": false,
    "archivedAt": "2024-01-15T10:30:00Z",
    "totalPlayers": 4,
    "respondedPlayers": 4,
    "winner": null,
    "winnerScore": null
  },
  "timestamp": 1705312200000
}
```

#### round_revealed
Broadcasted when a round's content is revealed.

```json
{
  "type": "round_revealed",
  "gameId": "game-uuid",
  "data": {
    "roundId": "round-uuid",
    "roundNumber": 1,
    "correctAnswer": "Option A",
    "winner": "John Doe",
    "winnerScore": 100,
    "revealedAt": "2024-01-15T10:35:00Z"
  },
  "timestamp": 1705312500000
}
```

#### round_updated
Broadcasted when round statistics are updated.

```json
{
  "type": "round_updated",
  "gameId": "game-uuid",
  "data": {
    "roundId": "round-uuid",
    "respondedPlayers": 3,
    "totalPlayers": 4,
    "updatedAt": "2024-01-15T10:32:00Z"
  },
  "timestamp": 1705312320000
}
```

## Database Schema

### GameRound Entity Updates
Added new fields to track archive and reveal status:

```sql
ALTER TABLE game_rounds 
ADD COLUMN revealed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN revealed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Indexes for performance
CREATE INDEX idx_game_rounds_revealed ON game_rounds(revealed);
CREATE INDEX idx_game_rounds_archived ON game_rounds(archived);
CREATE INDEX idx_game_rounds_game_revealed ON game_rounds(game_id, revealed);
CREATE INDEX idx_game_rounds_game_archived ON game_rounds(game_id, archived);
```

## Usage Examples

### Basic Integration
```tsx
import { ArchivedPrompts } from '../components/ArchivedPrompts';
import { useArchivedPrompts } from '../hooks/useArchivedPrompts';

const GamePlay = () => {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const { archivedPrompts } = useArchivedPrompts({ gameId: 'game-uuid' });

  return (
    <div>
      {/* Main game content */}
      
      <ArchivedPrompts
        gameId="game-uuid"
        isOpen={isArchiveOpen}
        onToggle={() => setIsArchiveOpen(!isArchiveOpen)}
        prompts={archivedPrompts}
        onPromptSelect={(prompt) => {
          console.log('Selected prompt:', prompt);
        }}
      />
    </div>
  );
};
```

### Backend Service Integration
```typescript
import { ArchivedPromptsService } from './archived-prompts.service';
import { GameGateway } from './gateway/game.gateway';

@Injectable()
export class RoundsService {
  constructor(
    private archivedPromptsService: ArchivedPromptsService,
    private gameGateway: GameGateway,
  ) {}

  async completeRound(roundId: string) {
    // Archive the round
    await this.archivedPromptsService.archiveRound(roundId);
    
    // Get round data for broadcasting
    const roundData = await this.getRoundData(roundId);
    
    // Broadcast to all players
    await this.gameGateway.broadcastRoundArchived(roundData.gameId, roundData);
  }

  async revealRound(roundId: string) {
    // Reveal the round
    await this.archivedPromptsService.revealRound(roundId);
    
    // Get updated round data
    const roundData = await this.getRoundData(roundId);
    
    // Broadcast to all players
    await this.gameGateway.broadcastRoundRevealed(roundData.gameId, roundData);
  }
}
```

## Styling

### Status Badges
- **Revealed**: Green with eye icon
- **Hidden**: Gray with eye-off icon
- **Complete**: Blue with trophy icon
- **In Progress**: Yellow with clock icon
- **Low Participation**: Orange with users icon

### Fog of War Styling
- **Hidden content**: Grayed out with placeholder text
- **Fog emoji**: 🌫️ for visual indication
- **Placeholder options**: Bullet points (••••••••)
- **Revealed content**: Full color with correct answer highlighting

## Performance Considerations

### Frontend
- **Virtual scrolling** for large archive lists
- **Debounced updates** to prevent excessive re-renders
- **Memoized components** for archived prompt cards
- **Lazy loading** of archive data

### Backend
- **Database indexes** on frequently queried fields
- **Redis caching** for archive data
- **Pagination** for large archive lists
- **Efficient queries** with proper joins

## Testing

### Unit Tests
- Component rendering with different states
- Hook behavior with various data scenarios
- WebSocket event handling
- Error states and loading states

### Integration Tests
- End-to-end archive flow
- WebSocket broadcasting
- Database operations
- API endpoint responses

### E2E Tests
- User interactions with archive sidebar
- Real-time updates across multiple tabs
- Mobile responsiveness
- Accessibility features

## Future Enhancements

### Planned Features
- **Search and filtering** of archived rounds
- **Export functionality** for game history
- **Analytics dashboard** with round statistics
- **Custom archive categories** and tags
- **Bulk reveal** options for game hosts

### Technical Improvements
- **Offline support** with service workers
- **Push notifications** for new archives
- **Advanced caching** strategies
- **Performance monitoring** and metrics 