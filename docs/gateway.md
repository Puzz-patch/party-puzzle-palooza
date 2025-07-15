# Game Gateway Documentation

This document describes the NestJS WebSocket Gateway with Redis pub/sub for real-time game communication in Party Puzzle Palooza.

## 🏗️ Architecture Overview

The game gateway provides real-time communication between players using:

- **NestJS WebSocket Gateway**: Handles WebSocket connections and message routing
- **Socket.IO**: Real-time bidirectional communication
- **Redis Pub/Sub**: Scalable message broadcasting across multiple server instances
- **JSON Patches**: Efficient state synchronization with 2KB size limit

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Web Client    │    │   Web Client    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   NestJS Gateway          │
                    │   (Socket.IO Server)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Redis Pub/Sub           │
                    │   Channel: game:{gid}     │
                    └───────────────────────────┘
```

## 🔌 Connection Setup

### Client Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/game', {
  query: {
    gameId: 'your-game-id',
    userId: 'your-user-id',
  },
  transports: ['websocket', 'polling'],
});
```

### Server Configuration

```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway {
  // Gateway implementation
}
```

## 📨 Message Types

### Core Message Types

| Type | Description | Payload |
|------|-------------|---------|
| `subscribe` | Join a game room | `{ gameId, userId, username? }` |
| `unsubscribe` | Leave a game room | `{ gameId }` |
| `game_update` | State synchronization | `{ gameId, patches[], timestamp? }` |
| `player_action` | Player interactions | `{ gameId, userId, action, data? }` |
| `chat_message` | In-game chat | `{ gameId, userId, message, username? }` |
| `answer_submit` | Submit round answer | `{ gameId, userId, answer, roundId }` |

### JSON Patch Operations

```typescript
interface JsonPatch {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}
```

## 🎮 Game Room Management

### Room Channel Pattern

All game rooms follow the Redis channel pattern: `game:{gameId}`

```typescript
// Subscribe to game room
await redisService.subscribeToGame(gameId, (message) => {
  // Handle incoming messages
});

// Publish to game room
await redisService.publishToGameJson(gameId, {
  type: 'game_update',
  patches: [...],
  timestamp: Date.now(),
});
```

### Room Lifecycle

1. **Creation**: When first client subscribes
2. **Active**: Multiple clients connected
3. **Cleanup**: When last client disconnects

```typescript
private joinGameRoom(client: Socket, gameId: string) {
  let room = this.gameRooms.get(gameId);
  if (!room) {
    room = {
      gameId,
      sockets: new Set(),
      gameState: {},
    };
    this.gameRooms.set(gameId, room);
  }
  room.sockets.add(client.id);
}
```

## 🔄 Message Flow

### 1. Client to Server

```typescript
// Client sends message
socket.emit('game_update', {
  gameId: 'game-123',
  patches: [
    { op: 'add', path: '/players/ready', value: true }
  ],
  timestamp: Date.now(),
});
```

### 2. Server Processing

```typescript
@SubscribeMessage('game_update')
async handleGameUpdate(@MessageBody() data: GameUpdateDto) {
  // Validate patch size (2KB limit)
  const patchSize = JSON.stringify(data.patches).length;
  if (patchSize > 2048) {
    throw new Error('Patch size exceeds 2KB limit');
  }
  
  // Apply patches to local state
  room.gameState = applyPatch(room.gameState, data.patches).newDocument;
  
  // Broadcast to local clients
  this.broadcastToGame(data.gameId, message);
  
  // Publish to Redis for other instances
  await this.redisService.publishToGameJson(data.gameId, message);
}
```

### 3. Redis Broadcasting

```typescript
// Redis subscriber receives message
private handleRedisMessage(gameId: string, redisMessage: any) {
  const message = JSON.parse(redisMessage.message);
  this.broadcastToGame(gameId, message);
}
```

### 4. Client Reception

```typescript
// Client receives broadcast
socket.on('game_message', (message) => {
  switch (message.type) {
    case 'game_update':
      // Apply patches to local state
      gameState = applyPatch(gameState, message.patches).newDocument;
      break;
  }
});
```

## 📊 Performance Optimizations

### JSON Patch Size Limits

- **Maximum patch size**: 2KB per message
- **Efficient updates**: Only changed data transmitted
- **Batch operations**: Multiple patches in single message

```typescript
// Validate patch size
const patchSize = JSON.stringify(data.patches).length;
if (patchSize > 2048) {
  throw new Error('Patch size exceeds 2KB limit');
}
```

### Redis Connection Management

- **Connection pooling**: Reusable Redis connections
- **Reconnection strategy**: Exponential backoff
- **Error handling**: Graceful degradation

```typescript
const redisClient = Redis.createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis reconnection failed');
      return Math.min(retries * 100, 3000);
    },
  },
});
```

### Room Cleanup

- **Automatic cleanup**: Empty rooms removed
- **Memory management**: Socket references cleaned up
- **Redis unsubscription**: Channels unsubscribed when empty

## 🔒 Security Features

### Input Validation

```typescript
export class GameUpdateDto {
  @IsUUID()
  gameId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsonPatch)
  patches: JsonPatch[];

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
```

### CORS Configuration

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

### Rate Limiting

- **Message frequency**: Configurable limits per client
- **Patch size**: 2KB maximum per message
- **Connection limits**: Per-game client limits

## 🚀 Usage Examples

### Basic Client Setup

```typescript
import { GameClient } from './examples/game-client.example';

const client = new GameClient(
  'game-123',
  'user-456',
  'PlayerName'
);

// Subscribe to game
client.subscribeToGame();

// Send chat message
client.sendChatMessage('Hello everyone!');

// Submit answer
client.submitAnswer('Canberra', 'round-1');

// Send game update
client.sendGameUpdate([
  { op: 'add', path: '/players/ready', value: true }
]);
```

### Server-Side Integration

```typescript
// In your NestJS service
@Injectable()
export class GameService {
  constructor(private redisService: RedisService) {}

  async broadcastGameUpdate(gameId: string, patches: JsonPatch[]) {
    await this.redisService.publishToGameJson(gameId, {
      type: GameMessageType.GAME_UPDATE,
      gameId,
      patches,
      timestamp: Date.now(),
    });
  }
}
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useGameSocket(gameId: string, userId: string) {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({});

  useEffect(() => {
    const newSocket = io('http://localhost:3001/game', {
      query: { gameId, userId },
    });

    newSocket.on('game_message', (message) => {
      if (message.type === 'game_update') {
        setGameState(prev => applyPatch(prev, message.patches).newDocument);
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [gameId, userId]);

  return { socket, gameState };
}
```

## 📈 Monitoring and Debugging

### Gateway Status Endpoint

```bash
curl http://localhost:3001/api/gateway/status
```

Response:
```json
{
  "redis": {
    "connected": true,
    "gameRooms": 5,
    "totalClients": 23
  },
  "rooms": {
    "game-123": {
      "clientCount": 4,
      "hasGameState": true
    }
  }
}
```

### Redis Monitoring

```bash
# Monitor Redis channels
redis-cli monitor

# Check specific game channel
redis-cli subscribe game:game-123
```

### Logging

```typescript
// Gateway logs
this.logger.log(`Client ${client.id} subscribed to game ${gameId}`);
this.logger.debug(`Broadcasted to game ${gameId}: ${message}`);
this.logger.error(`Error handling message: ${error.message}`);
```

## 🔧 Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3001
```

### Gateway Options

```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/game',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Failed**
   ```bash
   # Check Redis connection
   redis-cli ping
   
   # Check server logs
   tail -f logs/gateway.log
   ```

2. **Messages Not Received**
   ```bash
   # Verify room subscription
   curl http://localhost:3001/api/gateway/status
   
   # Check Redis channels
   redis-cli pubsub channels "game:*"
   ```

3. **Patch Size Exceeded**
   ```typescript
   // Split large updates into smaller patches
   const patches = generatePatches(gameState);
   const chunks = chunk(patches, 10); // Send in chunks
   ```

### Debug Mode

```typescript
// Enable debug logging
const socket = io('http://localhost:3001/game', {
  debug: true,
  query: { gameId, userId },
});
```

## 📚 Related Documentation

- [Database Setup](./database.md)
- [API Documentation](./api.md)
- [Deployment Guide](./deployment.md)

## 🤝 Contributing

When working with the gateway:

1. Follow the message type conventions
2. Respect the 2KB patch size limit
3. Use proper error handling
4. Test with multiple clients
5. Monitor Redis performance 