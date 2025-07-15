# Chill Mode Feature

The chill mode feature provides a more relaxed gaming experience by filtering out flagged questions and disabling the shot system.

## Overview

When chill mode is enabled:
- Only mild questions (not flagged, no flags) are used in the game
- Shot system UI is completely hidden from the client
- Game focuses on question-asking and answering without competitive elements

## Database Implementation

### SQL View: `mild_questions`
```sql
CREATE OR REPLACE VIEW mild_questions AS
SELECT 
  gr.*,
  g.chill_mode,
  g.name as game_name,
  u.username as created_by_username
FROM game_rounds gr
JOIN games g ON gr.game_id = g.id
JOIN users u ON gr.created_by_id = u.id
WHERE g.chill_mode = true
  AND gr.flagged = false
  AND gr.flag_count = 0
  AND gr.status = 'pending';
```

### Game Entity Updates
- Added `chillMode: boolean` field to Game entity
- Default value: `false`
- Controls question filtering and UI display

### Database Functions
- `get_mild_questions_for_game(game_uuid)` - Get mild questions for specific game
- `is_game_chill_mode(game_uuid)` - Check if game is in chill mode

## Backend Implementation

### GamesService Updates
- `drawNextQuestion()` - Uses different query logic based on chill mode
- `getGameManifest()` - Filters questions based on chill mode
- Chill mode questions exclude flagged content

### Question Filtering Logic
```typescript
if (game.chillMode) {
  // Only show mild questions (not flagged, no flags)
  queuedQuestions = game.gameRounds.filter(round => 
    !round.flagged && round.flagCount === 0
  );
}
```

## Frontend Implementation

### Conditional UI Rendering
- Shot system UI completely hidden when `chillMode = true`
- Chill mode indicator shown when active
- Game flags include `chillMode` boolean

### GamePlay Component
```typescript
const isChillMode = gameFlags?.chillMode || false;

// Shot UI only shows when NOT in chill mode
{!isChillMode && (
  <Card className="mb-8 border-orange-200 bg-orange-50">
    {/* Shot system components */}
  </Card>
)}

// Chill mode indicator
{isChillMode && (
  <Card className="mb-8 border-green-200 bg-green-50">
    <CardContent>
      <div className="flex items-center gap-2 p-3 bg-green-100 rounded-md">
        <Shield className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-800">
          Chill Mode Active - Shot system disabled for a more relaxed experience
        </span>
      </div>
    </CardContent>
  </Card>
)}
```

## API Endpoints

### Manifest Response
The game manifest now includes chill mode status:
```json
{
  "flags": {
    "isPrivate": false,
    "hasPassword": false,
    "isStarted": false,
    "isFinished": false,
    "isFull": false,
    "chillMode": true
  }
}
```

### Question Filtering
Questions in chill mode are filtered to exclude:
- Flagged questions (`flagged = true`)
- Questions with flags (`flagCount > 0`)

## User Experience

### Chill Mode Active
- Clean, focused interface without competitive elements
- Only mild, community-approved questions
- Relaxed gameplay without shot mechanics
- Clear visual indicator of chill mode status

### Normal Mode
- Full shot system available
- All questions included (subject to flagging)
- Competitive gameplay elements

## Configuration

### Database Migration
```sql
-- Add chill_mode column to games table
ALTER TABLE games 
ADD COLUMN chill_mode BOOLEAN DEFAULT FALSE;

-- Create index for chill mode queries
CREATE INDEX idx_games_chill_mode ON games(chill_mode);
```

### Environment Variables
- No additional environment variables required
- Chill mode is a per-game setting

## Benefits

1. **Accessibility** - Provides a more inclusive gaming experience
2. **Content Safety** - Automatically filters out problematic content
3. **User Choice** - Game hosts can choose the experience level
4. **Scalability** - Easy to extend with additional filtering rules

## Future Enhancements

- Age-appropriate content filtering
- Custom chill mode rules per game
- Parental controls integration
- Content rating system
- Automatic chill mode suggestions based on player demographics 