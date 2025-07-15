# Party Puzzle Palooza API

A NestJS-based API for the Party Puzzle Palooza game platform.

## Features

- **Game Management**: Create, join, and manage game sessions
- **Real-time Communication**: WebSocket gateway with Redis pub/sub
- **Custom Questions**: Player-generated questions with OpenAI moderation
- **Rate Limiting**: IP and player-based rate limiting
- **Authentication**: JWT-based player authentication
- **Database Integration**: TypeORM with PostgreSQL

## Endpoints

### Authentication
All endpoints require a valid `player_token` cookie set by the JWT guard.

### Game Manifest
```
GET /games/:gid/manifest
```

Returns comprehensive game information including:
- Game details (name, code, status, type)
- Player list with scores and status
- Queued questions
- Game flags (privacy, password, etc.)

**Response:**
```json
{
  "id": "uuid",
  "name": "Game Name",
  "code": "ABC123",
  "status": "waiting",
  "type": "would_you_rather",
  "maxPlayers": 10,
  "currentPlayers": 4,
  "players": [...],
  "queuedQuestions": [...],
  "flags": {
    "isPrivate": false,
    "hasPassword": false,
    "isStarted": false,
    "isFinished": false,
    "isFull": false
  }
}
```

### Custom Questions
```
POST /games/:gid/questions/custom
```

Creates a custom question with:
- OpenAI content moderation
- Rate limiting (IP + player ID)
- Idempotent insert (prevents duplicates)

**Request Body:**
```json
{
  "question": "Would you rather have the ability to fly or be invisible?",
  "type": "would_you_rather",
  "options": ["Fly", "Be invisible"],
  "category": "fun"
}
```

**Response:**
```json
{
  "id": "uuid",
  "question": "Would you rather have the ability to fly or be invisible?",
  "type": "would_you_rather",
  "options": ["Fly", "Be invisible"],
  "category": "fun",
  "gameId": "uuid",
  "createdBy": "player-uuid",
  "status": "pending"
}
```

## Rate Limiting

### IP Rate Limiting
- **Window**: 1 minute
- **Limit**: 10 requests per minute
- **Key**: `rate_limit:ip:{ip}`

### Player Rate Limiting
- **Window**: 5 minutes
- **Limit**: 5 custom questions per 5 minutes
- **Key**: `rate_limit:player:{playerId}`

## Content Moderation

Uses OpenAI's moderation API to check for:
- Hate speech
- Violence
- Sexual content
- Self-harm content
- Inappropriate content

If moderation fails, content is rejected conservatively.

## Idempotency

Custom question creation is idempotent:
- Checks for existing questions with same content by same player
- Returns existing question if duplicate found
- Prevents duplicate submissions

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/party_puzzle

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# OpenAI (for moderation)
OPENAI_API_KEY=your-openai-api-key
```

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- OpenAI API key (optional, for moderation)

### Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run database migrations:
   ```bash
   pnpm run migration:run
   ```

4. Start development server:
   ```bash
   pnpm run dev
   ```

### Testing
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run specific test file
pnpm test games.controller.test.ts
```

## Architecture

### Services
- **GamesService**: Core game logic and database operations
- **ModerationService**: OpenAI content moderation
- **RateLimitService**: Redis-based rate limiting
- **RedisService**: Redis pub/sub for real-time communication

### Guards
- **JwtPlayerGuard**: Validates player tokens and extracts player/game context

### DTOs
- **CreateCustomQuestionDto**: Input validation for custom questions
- **GameManifestResponseDto**: Game manifest response structure
- **CustomQuestionResponseDto**: Custom question response structure

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `201`: Created (custom question)
- `400`: Bad Request (validation, rate limit, moderation)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (game access denied)
- `404`: Not Found (game not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Security

- JWT token validation
- Content moderation via OpenAI
- Rate limiting to prevent abuse
- Input validation with class-validator
- SQL injection protection via TypeORM
- CORS configuration
- Helmet security headers

## Monitoring

- Structured logging with NestJS Logger
- Redis connection monitoring
- Database query logging
- Rate limit tracking
- Moderation result logging 