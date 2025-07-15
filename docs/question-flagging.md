# Question Flagging System

The question flagging system allows users to report inappropriate or problematic questions, with automatic moderation after three unique flags.

## Overview

- Users can flag questions for various reasons (inappropriate, offensive, spam, etc.)
- Each user can only flag a question once
- After 3 unique flags, questions are automatically flagged and hidden
- Moderators are notified via email when questions are auto-flagged
- Flagged questions are hidden from the game interface

## Database Schema

### QuestionFlag Entity
```typescript
interface QuestionFlag {
  id: string;
  questionId: string;
  flaggedBy: string;
  reason: FlagReason;
  details?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### GameRound Updates
- `flagged: boolean` - Whether the question is flagged
- `flaggedAt: Date` - When the question was flagged
- `flagCount: number` - Number of active flags

## API Endpoints

### POST /questions/:qid/flag
Flag a question for moderation.

**Request Body:**
```json
{
  "questionId": "uuid",
  "reason": "inappropriate|offensive|spam|duplicate|misleading|other",
  "details": "Optional additional context"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Question flagged successfully. 2 more flags needed for moderation.",
  "flagCount": 1,
  "isFlagged": false,
  "isHidden": false
}
```

### GET /questions/:qid/flags
Get all flags for a specific question (moderator only).

### GET /questions/flagged
Get all flagged questions (moderator only).

### GET /questions/flags/statistics
Get flagging statistics (moderator only).

## Frontend Components

### FlagButton
A reusable component that handles question flagging with:
- Reason selection dropdown
- Optional details textarea
- Flag count display
- Different states for flagged/hidden questions

### useQuestionFlag Hook
Custom hook for managing flag-related API calls and state.

## Automatic Moderation

### Flag Threshold
- Questions are automatically flagged after 3 unique flags
- Auto-flagged questions are hidden from the game interface
- Moderators receive email notifications

### Database Triggers
- `update_question_flag_count()` - Updates flag count when flags are added/removed
- `auto_flag_question()` - Automatically flags questions after threshold
- `update_updated_at_column()` - Maintains updated_at timestamps

## WebSocket Events

### question_flagged
Broadcasted when a question is flagged:
```json
{
  "type": "question_flagged",
  "data": {
    "questionId": "uuid",
    "flagCount": 3,
    "isFlagged": true,
    "isHidden": true,
    "flaggedAt": "2024-01-01T00:00:00Z"
  }
}
```

## Moderation Workflow

1. **User flags question** → Flag is recorded in database
2. **Flag count reaches 3** → Question is auto-flagged and hidden
3. **Moderators notified** → Email sent to moderation team
4. **Moderators review** → Can resolve flags or take action
5. **Question restored** → If flags are resolved and count drops below threshold

## Security Considerations

- Rate limiting on flag submissions
- One flag per user per question
- JWT authentication required
- Moderator-only endpoints for flag management
- Audit trail of all flag actions

## Testing

### Unit Tests
- QuestionFlagService tests cover all flagging scenarios
- Transaction rollback on errors
- Auto-flagging threshold logic
- Flag resolution and question restoration

### Integration Tests
- End-to-end flagging workflow
- WebSocket event broadcasting
- Database trigger functionality

## Configuration

### Environment Variables
- `FLAG_THRESHOLD` - Number of flags before auto-flagging (default: 3)
- `MODERATOR_EMAIL` - Email for moderation notifications

### Rate Limiting
- IP-based rate limiting for flag submissions
- Player ID-based rate limiting to prevent abuse

## Future Enhancements

- Machine learning-based content moderation
- Community voting on flagged content
- Appeal process for flagged questions
- Moderator dashboard for flag management
- Integration with external moderation services 