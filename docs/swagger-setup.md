# Swagger API Documentation Setup

This document describes the Swagger/OpenAPI documentation setup for the Party Puzzle Palooza API.

## Overview

The API uses NestJS Swagger module to automatically generate interactive API documentation. The documentation is available at `/docs` endpoint and provides:

- Interactive API explorer
- Request/response examples
- Authentication documentation
- Schema definitions
- Try-it-out functionality

## Configuration

### Dependencies

The following dependencies are added to `apps/api/package.json`:

```json
{
  "@nestjs/swagger": "^7.1.17"
}
```

### Main Configuration

The Swagger configuration is set up in `apps/api/src/index.ts`:

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Party Puzzle Palooza API')
  .setDescription('API for the Party Puzzle Palooza game platform')
  .setVersion('1.0.0')
  .addTag('games', 'Game management endpoints')
  .addTag('rounds', 'Game round management')
  .addTag('players', 'Player management')
  .addTag('questions', 'Question management and flagging')
  .addTag('shots', 'Shot system for competitive gameplay')
  .addTag('actions', 'Player actions (roll, force, shield)')
  .addTag('archived-prompts', 'Archived game prompts')
  .addTag('finale', 'Game finale and scoring')
  .addTag('health', 'Health check and monitoring')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addCookieAuth(
    'player_token',
    {
      type: 'apiKey',
      in: 'cookie',
      name: 'player_token',
      description: 'Player authentication token from cookie',
    },
    'cookie-auth',
  )
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document, {
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  },
  customSiteTitle: 'Party Puzzle Palooza API Documentation',
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #6366f1 }
    .swagger-ui .scheme-container { background: #f8fafc }
  `,
});
```

## API Endpoints Documentation

### Authentication

The API supports two authentication methods:

1. **JWT Bearer Token** - For API access
2. **Cookie Authentication** - For web application access

### Available Endpoints

#### Games
- `GET /games/:gid/manifest` - Get game manifest
- `POST /games/:gid/questions/custom` - Submit custom question
- `POST /games/:gid/state/transition` - Transition game state
- `POST /games/:gid/finale` - End game and compute scores

#### Rounds
- `POST /rounds/:rid/start` - Start a new round
- `POST /rounds/:rid/target` - Set round target
- `GET /rounds/:rid/phase` - Get current round phase

#### Shots
- `POST /rounds/:rid/shot` - Take a shot (deduct tokens)

#### Player Actions
- `POST /rounds/:rid/actions` - Submit player action (roll/force/shield)

#### Questions
- `POST /questions/:qid/flag` - Flag a question

#### Archived Prompts
- `GET /games/:gid/archived-prompts` - Get archived prompts

#### Health & Monitoring
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `GET /api/gateway/status` - WebSocket gateway status

## DTOs and Schemas

All endpoints use class-validator DTOs that are automatically documented:

### Example DTO

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateCustomQuestionDto {
  @ApiProperty({
    description: 'The question text',
    example: 'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?',
    maxLength: 500
  })
  @IsString()
  @MaxLength(500)
  question: string;

  @ApiProperty({
    description: 'Optional category for the question',
    example: 'funny',
    required: false
  })
  @IsOptional()
  @IsString()
  category?: string;
}
```

## Usage

### Accessing Documentation

1. **Local Development**: http://localhost:3001/docs
2. **Production**: https://your-domain.com/docs

### Generating Swagger JSON

```bash
# Generate Swagger JSON file
./scripts/generate-swagger.sh

# The JSON will be saved to docs/swagger.json
```

### Testing Endpoints

The Swagger UI provides a "Try it out" feature for each endpoint:

1. Click on an endpoint
2. Click "Try it out"
3. Fill in required parameters
4. Click "Execute"

### Authentication in Swagger

1. **JWT Authentication**: Click the "Authorize" button and enter your JWT token
2. **Cookie Authentication**: The cookie will be automatically included in requests

## Customization

### Styling

The Swagger UI can be customized by modifying the `customCss` option in the configuration.

### Tags

Endpoints are organized by tags. To add a new tag:

1. Add the tag to the DocumentBuilder configuration
2. Use the `@ApiTags()` decorator on your controllers

```typescript
@ApiTags('new-feature')
@Controller('new-feature')
export class NewFeatureController {
  // ...
}
```

### Response Examples

You can provide custom response examples:

```typescript
@ApiResponse({
  status: 200,
  description: 'Successfully retrieved game manifest',
  schema: {
    type: 'object',
    properties: {
      gameId: { type: 'string' },
      players: { type: 'array' },
      questions: { type: 'array' }
    }
  }
})
```

## Integration with Frontend

The generated Swagger documentation can be used to:

1. **Generate TypeScript interfaces** using tools like `swagger-typescript-api`
2. **Create API clients** for different languages
3. **Validate API contracts** in CI/CD pipelines

### TypeScript Interface Generation

```bash
# Install swagger-typescript-api
npm install -g swagger-typescript-api

# Generate TypeScript interfaces
swagger-typescript-api -p http://localhost:3001/docs-json -o src/types/api.ts
```

## Best Practices

1. **Always document DTOs** with `@ApiProperty()` decorators
2. **Use meaningful descriptions** for all properties
3. **Provide examples** for complex objects
4. **Group related endpoints** using tags
5. **Document error responses** with `@ApiResponse()`
6. **Keep documentation up to date** with code changes

## Troubleshooting

### Common Issues

1. **Documentation not updating**: Restart the API server
2. **Missing endpoints**: Ensure controllers are properly decorated
3. **Authentication issues**: Check JWT token format and cookie settings

### Debugging

```bash
# Check if Swagger JSON is accessible
curl http://localhost:3001/docs-json

# Check if documentation page loads
curl http://localhost:3001/docs
```

## Future Enhancements

- [ ] Add more detailed response examples
- [ ] Include rate limiting documentation
- [ ] Add WebSocket event documentation
- [ ] Generate client SDKs
- [ ] Add API versioning support 