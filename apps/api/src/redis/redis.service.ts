import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'redis';

export interface RedisMessage {
  channel: string;
  message: string;
  timestamp: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: Redis.RedisClientType;
  private subscriber: Redis.RedisClientType;
  private messageHandlers: Map<string, (message: RedisMessage) => void> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
      
      // Create publisher client
      this.publisher = Redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // Create subscriber client
      this.subscriber = Redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // Handle connection events
      this.publisher.on('connect', () => {
        this.logger.log('Redis publisher connected');
      });

      this.publisher.on('error', (error) => {
        this.logger.error('Redis publisher error:', error);
      });

      this.subscriber.on('connect', () => {
        this.logger.log('Redis subscriber connected');
      });

      this.subscriber.on('error', (error) => {
        this.logger.error('Redis subscriber error:', error);
      });

      // Handle incoming messages
      this.subscriber.on('message', (channel, message) => {
        this.handleMessage(channel, message);
      });

      // Connect to Redis
      await this.publisher.connect();
      await this.subscriber.connect();

      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Redis service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a Redis channel
   */
  async subscribe(channel: string, handler: (message: RedisMessage) => void): Promise<void> {
    try {
      this.messageHandlers.set(channel, handler);
      await this.subscriber.subscribe(channel, (message) => {
        this.handleMessage(channel, message);
      });
      this.logger.log(`Subscribed to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a Redis channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      this.messageHandlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
      this.logger.log(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Publish a message to a Redis channel
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      const result = await this.publisher.publish(channel, message);
      this.logger.debug(`Published message to channel ${channel}: ${message.substring(0, 100)}...`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to publish message to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Publish a JSON message to a Redis channel
   */
  async publishJson(channel: string, data: any): Promise<number> {
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now(),
    });
    return this.publish(channel, message);
  }

  /**
   * Subscribe to a game room channel
   */
  async subscribeToGame(gameId: string, handler: (message: RedisMessage) => void): Promise<void> {
    const channel = `game:${gameId}`;
    return this.subscribe(channel, handler);
  }

  /**
   * Unsubscribe from a game room channel
   */
  async unsubscribeFromGame(gameId: string): Promise<void> {
    const channel = `game:${gameId}`;
    return this.unsubscribe(channel);
  }

  /**
   * Publish a message to a game room channel
   */
  async publishToGame(gameId: string, message: string): Promise<number> {
    const channel = `game:${gameId}`;
    return this.publish(channel, message);
  }

  /**
   * Publish a JSON message to a game room channel
   */
  async publishToGameJson(gameId: string, data: any): Promise<number> {
    const channel = `game:${gameId}`;
    return this.publishJson(channel, data);
  }

  /**
   * Handle incoming Redis messages
   */
  private handleMessage(channel: string, message: string): void {
    try {
      const handler = this.messageHandlers.get(channel);
      if (handler) {
        const parsedMessage: RedisMessage = {
          channel,
          message,
          timestamp: Date.now(),
        };
        handler(parsedMessage);
      }
    } catch (error) {
      this.logger.error(`Error handling message from channel ${channel}:`, error);
    }
  }

  /**
   * Get Redis connection status
   */
  isConnected(): boolean {
    return this.publisher.isReady && this.subscriber.isReady;
  }

  /**
   * Get Redis client for direct operations
   */
  getClient(): Redis.RedisClientType {
    return this.publisher;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting Redis clients...');
      
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      
      if (this.publisher) {
        await this.publisher.quit();
      }
      
      this.logger.log('Redis clients disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis clients:', error);
    }
  }
} 