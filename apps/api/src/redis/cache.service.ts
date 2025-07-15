import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

// Type definitions for entities
interface Game {
  id: string;
  status: string;
  type: string;
  maxPlayers: number;
  currentPlayers: number;
  chillMode: boolean;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

interface GamePlayer {
  id: string;
  gameId: string;
  userId: string;
  status: string;
  score: number;
  isHost: boolean;
  isSpectator: boolean;
  joinedAt?: Date | null;
}

interface GameRound {
  id: string;
  gameId: string;
  roundNumber: number;
  status: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer?: string | null;
  flagged: boolean;
  flagCount: number;
}

interface PlayerAnswer {
  id: string;
  gameRoundId: string;
  userId: string;
  answer: string;
  status: string;
  isCorrect: boolean;
  submittedAt?: Date | null;
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

type GameStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';
type PlayerStatus = 'joined' | 'ready' | 'playing' | 'left' | 'disconnected';
type RoundStatus = 'pending' | 'active' | 'finished' | 'cancelled';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  keysCount: number;
  memoryUsage: number;
}

export interface CacheKey {
  entity: string;
  id: string;
  operation?: string;
  filters?: Record<string, any> | undefined;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 300; // 5 minutes
  private readonly stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

  // Cache key prefixes
  private readonly PREFIXES = {
    GAME: 'game',
    GAME_PLAYERS: 'game_players',
    GAME_ROUNDS: 'game_rounds',
    PLAYER_ANSWERS: 'player_answers',
    USER: 'user',
    GAME_STATE: 'game_state',
    GAME_MANIFEST: 'game_manifest',
    ACTIVE_GAMES: 'active_games',
    USER_GAMES: 'user_games',
  };

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a cache key from components
   */
  private generateKey(components: CacheKey): string {
    const { entity, id, operation, filters } = components;
    let key = `${entity}:${id}`;
    
    if (operation) {
      key += `:${operation}`;
    }
    
    if (filters && Object.keys(filters).length > 0) {
      const filterString = Object.entries(filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
      key += `:${filterString}`;
    }
    
    return key;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: CacheKey): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    this.stats.totalRequests++;
    
    try {
      const value = await this.redisService.getClient().get(cacheKey);
      
      if (value) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache MISS: ${cacheKey}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting from cache: ${cacheKey}`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: CacheKey, value: T, options: CacheOptions = {}): Promise<void> {
    const cacheKey = this.generateKey(key);
    const ttl = options.ttl || this.defaultTTL;
    
    try {
      await this.redisService.getClient().setEx(
        cacheKey,
        ttl,
        JSON.stringify(value)
      );
      this.logger.debug(`Cache SET: ${cacheKey} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Error setting cache: ${cacheKey}`, error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: CacheKey): Promise<void> {
    const cacheKey = this.generateKey(key);
    
    try {
      await this.redisService.getClient().del(cacheKey);
      this.logger.debug(`Cache DELETE: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Error deleting from cache: ${cacheKey}`, error);
    }
  }

  /**
   * Delete multiple keys with pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisService.getClient().keys(pattern);
      if (keys.length > 0) {
        await this.redisService.getClient().del(keys);
        this.logger.debug(`Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern from cache: ${pattern}`, error);
    }
  }

  /**
   * Invalidate all cache entries for a game
   */
  async invalidateGame(gameId: string): Promise<void> {
    const patterns = [
      `${this.PREFIXES.GAME}:${gameId}:*`,
      `${this.PREFIXES.GAME_PLAYERS}:${gameId}:*`,
      `${this.PREFIXES.GAME_ROUNDS}:${gameId}:*`,
      `${this.PREFIXES.GAME_STATE}:${gameId}:*`,
      `${this.PREFIXES.GAME_MANIFEST}:${gameId}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
    
    this.logger.log(`Invalidated all cache entries for game: ${gameId}`);
  }

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    const patterns = [
      `${this.PREFIXES.USER}:${userId}:*`,
      `${this.PREFIXES.USER_GAMES}:${userId}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
    
    this.logger.log(`Invalidated all cache entries for user: ${userId}`);
  }

  /**
   * Invalidate all cache entries for a round
   */
  async invalidateRound(roundId: string): Promise<void> {
    const patterns = [
      `${this.PREFIXES.GAME_ROUNDS}:${roundId}:*`,
      `${this.PREFIXES.PLAYER_ANSWERS}:${roundId}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
    
    this.logger.log(`Invalidated all cache entries for round: ${roundId}`);
  }

  // Game caching methods

  /**
   * Get game from cache
   */
  async getGame(gameId: string): Promise<Game | null> {
    return this.get<Game>({
      entity: this.PREFIXES.GAME,
      id: gameId,
    });
  }

  /**
   * Set game in cache
   */
  async setGame(game: Game, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.GAME,
        id: game.id,
      },
      game,
      { ttl: ttl || 600 } // 10 minutes for games
    );
  }

  /**
   * Get game players from cache
   */
  async getGamePlayers(gameId: string, status?: PlayerStatus): Promise<GamePlayer[] | null> {
    return this.get<GamePlayer[]>({
      entity: this.PREFIXES.GAME_PLAYERS,
      id: gameId,
      filters: status ? { status } : undefined,
    });
  }

  /**
   * Set game players in cache
   */
  async setGamePlayers(gameId: string, players: GamePlayer[], status?: PlayerStatus, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.GAME_PLAYERS,
        id: gameId,
        filters: status ? { status } : undefined,
      },
      players,
      { ttl: ttl || 300 } // 5 minutes for players
    );
  }

  /**
   * Get game rounds from cache
   */
  async getGameRounds(gameId: string, status?: RoundStatus): Promise<GameRound[] | null> {
    return this.get<GameRound[]>({
      entity: this.PREFIXES.GAME_ROUNDS,
      id: gameId,
      filters: status ? { status } : undefined,
    });
  }

  /**
   * Set game rounds in cache
   */
  async setGameRounds(gameId: string, rounds: GameRound[], status?: RoundStatus, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.GAME_ROUNDS,
        id: gameId,
        filters: status ? { status } : undefined,
      },
      rounds,
      { ttl: ttl || 300 } // 5 minutes for rounds
    );
  }

  /**
   * Get player answers from cache
   */
  async getPlayerAnswers(roundId: string, status?: string): Promise<PlayerAnswer[] | null> {
    return this.get<PlayerAnswer[]>({
      entity: this.PREFIXES.PLAYER_ANSWERS,
      id: roundId,
      filters: status ? { status } : undefined,
    });
  }

  /**
   * Set player answers in cache
   */
  async setPlayerAnswers(roundId: string, answers: PlayerAnswer[], status?: string, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.PLAYER_ANSWERS,
        id: roundId,
        filters: status ? { status } : undefined,
      },
      answers,
      { ttl: ttl || 180 } // 3 minutes for answers
    );
  }

  /**
   * Get user from cache
   */
  async getUser(userId: string): Promise<User | null> {
    return this.get<User>({
      entity: this.PREFIXES.USER,
      id: userId,
    });
  }

  /**
   * Set user in cache
   */
  async setUser(user: User, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.USER,
        id: user.id,
      },
      user,
      { ttl: ttl || 1800 } // 30 minutes for users
    );
  }

  /**
   * Get active games from cache
   */
  async getActiveGames(status?: GameStatus): Promise<Game[] | null> {
    return this.get<Game[]>({
      entity: this.PREFIXES.ACTIVE_GAMES,
      id: 'list',
      filters: status ? { status } : undefined,
    });
  }

  /**
   * Set active games in cache
   */
  async setActiveGames(games: Game[], status?: GameStatus, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.ACTIVE_GAMES,
        id: 'list',
        filters: status ? { status } : undefined,
      },
      games,
      { ttl: ttl || 120 } // 2 minutes for active games list
    );
  }

  /**
   * Get user games from cache
   */
  async getUserGames(userId: string, status?: GameStatus): Promise<Game[] | null> {
    return this.get<Game[]>({
      entity: this.PREFIXES.USER_GAMES,
      id: userId,
      filters: status ? { status } : undefined,
    });
  }

  /**
   * Set user games in cache
   */
  async setUserGames(userId: string, games: Game[], status?: GameStatus, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.USER_GAMES,
        id: userId,
        filters: status ? { status } : undefined,
      },
      games,
      { ttl: ttl || 300 } // 5 minutes for user games
    );
  }

  /**
   * Get game state from cache
   */
  async getGameState(gameId: string): Promise<any | null> {
    return this.get<any>({
      entity: this.PREFIXES.GAME_STATE,
      id: gameId,
    });
  }

  /**
   * Set game state in cache
   */
  async setGameState(gameId: string, state: any, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.GAME_STATE,
        id: gameId,
      },
      state,
      { ttl: ttl || 60 } // 1 minute for game state
    );
  }

  /**
   * Get game manifest from cache
   */
  async getGameManifest(gameId: string): Promise<any | null> {
    return this.get<any>({
      entity: this.PREFIXES.GAME_MANIFEST,
      id: gameId,
    });
  }

  /**
   * Set game manifest in cache
   */
  async setGameManifest(gameId: string, manifest: any, ttl?: number): Promise<void> {
    await this.set(
      {
        entity: this.PREFIXES.GAME_MANIFEST,
        id: gameId,
      },
      manifest,
      { ttl: ttl || 300 } // 5 minutes for game manifest
    );
  }

  // Cache statistics and monitoring

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalRequests: this.stats.totalRequests,
      keysCount: 0, // Would need to implement key counting
      memoryUsage: 0, // Would need to implement memory usage tracking
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.totalRequests = 0;
    this.logger.log('Cache statistics reset');
  }

  /**
   * Get cache keys count
   */
  async getKeysCount(): Promise<number> {
    try {
      const keys = await this.redisService.getClient().keys('*');
      return keys.length;
    } catch (error) {
      this.logger.error('Error getting keys count', error);
      return 0;
    }
  }

  /**
   * Get cache memory usage
   */
  async getMemoryUsage(): Promise<number> {
    try {
      const info = await this.redisService.getClient().info('memory');
      if (info) {
        const usedMemoryMatch = info.match(/used_memory:(\d+)/);
        return usedMemoryMatch ? parseInt(usedMemoryMatch[1], 10) : 0;
      }
      return 0;
    } catch (error) {
      this.logger.error('Error getting memory usage', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await this.redisService.getClient().flushDb();
      this.logger.log('All cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache', error);
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redisService.getClient().ping();
      return true;
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return false;
    }
  }
} 