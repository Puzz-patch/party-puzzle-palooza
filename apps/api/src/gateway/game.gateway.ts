import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  GameMessageDto,
  GameMessageType,
  SubscribeMessageDto,
  GameUpdateDto,
  PlayerActionDto,
  ChatMessageDto,
  JsonPatch,
} from '../dto/game-message.dto';
import { applyPatch, Operation } from 'fast-json-patch';

interface GameRoom {
  gameId: string;
  sockets: Set<string>;
  gameState: any;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private gameRooms: Map<string, GameRoom> = new Map();
  private socketToGame: Map<string, string> = new Map();
  private socketToUser: Map<string, string> = new Map();

  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    this.logger.log('Game Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Store connection info
    const gameId = client.handshake.query.gameId as string;
    const userId = client.handshake.query.userId as string;
    
    if (gameId) {
      this.socketToGame.set(client.id, gameId);
      this.socketToUser.set(client.id, userId);
      this.logger.log(`Client ${client.id} connected to game ${gameId} as user ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up connection info
    const gameId = this.socketToGame.get(client.id);
    if (gameId) {
      this.leaveGameRoom(client, gameId);
      this.socketToGame.delete(client.id);
      this.socketToUser.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: SubscribeMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Client ${client.id} subscribing to game ${data.gameId}`);
      
      // Join the Socket.IO room
      await client.join(`game:${data.gameId}`);
      
      // Join the game room
      this.joinGameRoom(client, data.gameId);
      
      // Subscribe to Redis channel
      await this.redisService.subscribeToGame(data.gameId, (redisMessage) => {
        this.handleRedisMessage(data.gameId, redisMessage);
      });
      
      // Send confirmation
      client.emit('subscribed', {
        gameId: data.gameId,
        userId: data.userId,
        timestamp: Date.now(),
      });
      
      // Notify other players
      this.broadcastToGame(data.gameId, {
        type: GameMessageType.PLAYER_JOIN,
        gameId: data.gameId,
        userId: data.userId,
        username: data.username,
        timestamp: Date.now(),
      }, client.id);
      
    } catch (error) {
      this.logger.error(`Error handling subscribe: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: 'Failed to subscribe to game',
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Client ${client.id} unsubscribing from game ${data.gameId}`);
      
      // Leave the Socket.IO room
      await client.leave(`game:${data.gameId}`);
      
      // Leave the game room
      this.leaveGameRoom(client, data.gameId);
      
      // Unsubscribe from Redis channel if no more clients
      const room = this.gameRooms.get(data.gameId);
      if (room && room.sockets.size === 0) {
        await this.redisService.unsubscribeFromGame(data.gameId);
        this.gameRooms.delete(data.gameId);
      }
      
      // Send confirmation
      client.emit('unsubscribed', {
        gameId: data.gameId,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      this.logger.error(`Error handling unsubscribe: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: 'Failed to unsubscribe from game',
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('game_update')
  async handleGameUpdate(
    @MessageBody() data: GameUpdateDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Game update for ${data.gameId}: ${data.patches.length} patches`);
      
      // Validate patch size (2KB limit)
      const patchSize = JSON.stringify(data.patches).length;
      if (patchSize > 2048) {
        throw new Error('Patch size exceeds 2KB limit');
      }
      
      // Apply patches to local game state
      const room = this.gameRooms.get(data.gameId);
      if (room) {
        try {
          room.gameState = applyPatch(room.gameState, data.patches as Operation[]).newDocument;
        } catch (patchError) {
          this.logger.error(`Error applying patches: ${patchError.message}`);
          throw new Error('Invalid patch operation');
        }
      }
      
      // Broadcast to all clients in the game room
      this.broadcastToGame(data.gameId, {
        type: GameMessageType.GAME_UPDATE,
        gameId: data.gameId,
        patches: data.patches,
        timestamp: data.timestamp || Date.now(),
      });
      
      // Publish to Redis for other server instances
      await this.redisService.publishToGameJson(data.gameId, {
        type: GameMessageType.GAME_UPDATE,
        gameId: data.gameId,
        patches: data.patches,
        timestamp: data.timestamp || Date.now(),
      });
      
    } catch (error) {
      this.logger.error(`Error handling game update: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: error.message,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @MessageBody() data: PlayerActionDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Player action: ${data.action} in game ${data.gameId}`);
      
      // Broadcast to all clients in the game room
      this.broadcastToGame(data.gameId, {
        type: GameMessageType.PLAYER_JOIN, // Use appropriate type
        gameId: data.gameId,
        userId: data.userId,
        action: data.action,
        data: data.data,
        timestamp: Date.now(),
      });
      
      // Publish to Redis for other server instances
      await this.redisService.publishToGameJson(data.gameId, {
        type: GameMessageType.PLAYER_JOIN, // Use appropriate type
        gameId: data.gameId,
        userId: data.userId,
        action: data.action,
        data: data.data,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      this.logger.error(`Error handling player action: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: 'Failed to process player action',
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @MessageBody() data: ChatMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Chat message in game ${data.gameId}: ${data.message.substring(0, 50)}...`);
      
      // Broadcast to all clients in the game room
      this.broadcastToGame(data.gameId, {
        type: GameMessageType.CHAT_MESSAGE,
        gameId: data.gameId,
        userId: data.userId,
        message: data.message,
        username: data.username,
        timestamp: Date.now(),
      });
      
      // Publish to Redis for other server instances
      await this.redisService.publishToGameJson(data.gameId, {
        type: GameMessageType.CHAT_MESSAGE,
        gameId: data.gameId,
        userId: data.userId,
        message: data.message,
        username: data.username,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      this.logger.error(`Error handling chat message: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: 'Failed to send chat message',
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('answer_submit')
  async handleAnswerSubmit(
    @MessageBody() data: { gameId: string; userId: string; answer: string; roundId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Answer submitted in game ${data.gameId} for round ${data.roundId}`);
      
      // Broadcast to all clients in the game room
      this.broadcastToGame(data.gameId, {
        type: GameMessageType.ANSWER_SUBMIT,
        gameId: data.gameId,
        userId: data.userId,
        answer: data.answer,
        roundId: data.roundId,
        timestamp: Date.now(),
      });
      
      // Publish to Redis for other server instances
      await this.redisService.publishToGameJson(data.gameId, {
        type: GameMessageType.ANSWER_SUBMIT,
        gameId: data.gameId,
        userId: data.userId,
        answer: data.answer,
        roundId: data.roundId,
        timestamp: Date.now(),
      });
      
    } catch (error) {
      this.logger.error(`Error handling answer submit: ${error.message}`);
      client.emit('error', {
        type: GameMessageType.ERROR,
        message: 'Failed to submit answer',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle incoming Redis messages
   */
  private handleRedisMessage(gameId: string, redisMessage: any) {
    try {
      const message = JSON.parse(redisMessage.message);
      
      // Don't broadcast back to the sender
      this.broadcastToGame(gameId, message);
      
    } catch (error) {
      this.logger.error(`Error handling Redis message: ${error.message}`);
    }
  }

  /**
   * Join a game room
   */
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
    this.logger.log(`Client ${client.id} joined game room ${gameId}. Total clients: ${room.sockets.size}`);
  }

  /**
   * Leave a game room
   */
  private leaveGameRoom(client: Socket, gameId: string) {
    const room = this.gameRooms.get(gameId);
    if (room) {
      room.sockets.delete(client.id);
      this.logger.log(`Client ${client.id} left game room ${gameId}. Total clients: ${room.sockets.size}`);
      
      if (room.sockets.size === 0) {
        this.gameRooms.delete(gameId);
        this.logger.log(`Game room ${gameId} deleted (no more clients)`);
      }
    }
  }

  /**
   * Broadcast message to all clients in a game room
   */
  private broadcastToGame(gameId: string, message: any, excludeSocketId?: string) {
    const room = this.gameRooms.get(gameId);
    if (room) {
      this.server.to(`game:${gameId}`).emit('game_message', message);
      this.logger.debug(`Broadcasted to game ${gameId}: ${JSON.stringify(message).substring(0, 100)}...`);
    }
  }

  /**
   * Get game room statistics
   */
  getGameRoomStats() {
    const stats = {};
    for (const [gameId, room] of this.gameRooms) {
      stats[gameId] = {
        clientCount: room.sockets.size,
        hasGameState: !!room.gameState,
      };
    }
    return stats;
  }

  /**
   * Get Redis connection status
   */
  getRedisStatus() {
    return {
      connected: this.redisService.isConnected(),
      gameRooms: this.gameRooms.size,
      totalClients: Array.from(this.gameRooms.values()).reduce((sum, room) => sum + room.sockets.size, 0),
    };
  }

  /**
   * Broadcast round archived event
   */
  async broadcastRoundArchived(gameId: string, roundData: any) {
    const message = {
      type: 'round_archived',
      gameId,
      data: {
        roundId: roundData.roundId,
        roundNumber: roundData.roundNumber,
        question: roundData.question,
        options: roundData.options,
        correctAnswer: roundData.correctAnswer,
        revealed: roundData.revealed,
        archivedAt: roundData.archivedAt,
        totalPlayers: roundData.totalPlayers,
        respondedPlayers: roundData.respondedPlayers,
        winner: roundData.winner,
        winnerScore: roundData.winnerScore,
      },
      timestamp: Date.now(),
    };

    // Broadcast to all clients in the game room
    this.broadcastToGame(gameId, message);

    // Publish to Redis for other server instances
    await this.redisService.publishToGameJson(gameId, message);
  }

  /**
   * Broadcast round revealed event
   */
  async broadcastRoundRevealed(gameId: string, roundData: any) {
    const message = {
      type: 'round_revealed',
      gameId,
      data: {
        roundId: roundData.roundId,
        roundNumber: roundData.roundNumber,
        correctAnswer: roundData.correctAnswer,
        winner: roundData.winner,
        winnerScore: roundData.winnerScore,
        revealedAt: roundData.revealedAt,
      },
      timestamp: Date.now(),
    };

    // Broadcast to all clients in the game room
    this.broadcastToGame(gameId, message);

    // Publish to Redis for other server instances
    await this.redisService.publishToGameJson(gameId, message);
  }

  /**
   * Broadcast round updated event
   */
  async broadcastRoundUpdated(gameId: string, roundData: any) {
    const message = {
      type: 'round_updated',
      gameId,
      data: {
        roundId: roundData.roundId,
        respondedPlayers: roundData.respondedPlayers,
        totalPlayers: roundData.totalPlayers,
        updatedAt: roundData.updatedAt,
      },
      timestamp: Date.now(),
    };

    // Broadcast to all clients in the game room
    this.broadcastToGame(gameId, message);

    // Publish to Redis for other server instances
    await this.redisService.publishToGameJson(gameId, message);
  }
} 