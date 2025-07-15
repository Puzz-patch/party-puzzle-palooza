import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameRound } from '@party-puzzle-palooza/database';
import { CacheService } from '../redis/cache.service';
import { CacheGame, InvalidateGame } from '../redis/cache.decorator';

export interface GameManifest {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  type: string;
  maxPlayers: number;
  currentPlayers: number;
  roundsPerGame: number;
  timePerRound: number;
  players: GamePlayer[];
  queuedQuestions: GameQuestion[];
  flags: GameFlags;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface GamePlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  isHost: boolean;
  isSpectator: boolean;
  joinedAt: Date;
}

export interface GameQuestion {
  id: string;
  question: string;
  type: string;
  options: string[];
  correctAnswer?: string | null;
  category: string;
  roundNumber: number;
  flagCount: number;
  isFlagged: boolean;
  isHidden: boolean;
}

export interface GameFlags {
  isPrivate: boolean;
  hasPassword: boolean;
  isStarted: boolean;
  isFinished: boolean;
  isFull: boolean;
  chillMode: boolean;
}

@Injectable()
export class CachedGameQueryService {
  private readonly logger = new Logger(CachedGameQueryService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private cacheService: CacheService
  ) {}

  /**
   * Get game by ID with caching
   */
  @CacheGame('gameId', 600) // 10 minutes cache
  async getGameById(gameId: string): Promise<Game> {
    this.logger.debug(`Fetching game from database: ${gameId}`);
    
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  /**
   * Get game manifest with caching
   */
  @CacheGame('gameId', 300) // 5 minutes cache
  async getGameManifest(gameId: string): Promise<GameManifest> {
    this.logger.debug(`Fetching game manifest from database: ${gameId}`);
    
    const game = await this.getGameById(gameId);

    const players = this.transformPlayers(game.gamePlayers);
    const queuedQuestions = this.transformQuestions(game.gameRounds, game.chillMode);
    const flags = this.generateGameFlags(game);

    return {
      id: game.id,
      name: game.name,
      code: game.code,
      description: game.description,
      status: game.status,
      type: game.type,
      maxPlayers: game.maxPlayers,
      currentPlayers: game.currentPlayers,
      roundsPerGame: game.roundsPerGame,
      timePerRound: game.timePerRound,
      players,
      queuedQuestions,
      flags,
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt
    };
  }

  /**
   * Get game with rounds with caching
   */
  @CacheGame('gameId', 300) // 5 minutes cache
  async getGameWithRounds(gameId: string): Promise<Game> {
    this.logger.debug(`Fetching game with rounds from database: ${gameId}`);
    
    return await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gameRounds']
    });
  }

  /**
   * Get game with all relations with caching
   */
  @CacheGame('gameId', 300) // 5 minutes cache
  async getGameWithAllRelations(gameId: string): Promise<Game> {
    this.logger.debug(`Fetching game with all relations from database: ${gameId}`);
    
    return await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
    });
  }

  /**
   * Get active games with caching
   */
  async getActiveGames(status?: string): Promise<Game[]> {
    // Try to get from cache first
    const cached = await this.cacheService.getActiveGames(status as any);
    if (cached) {
      this.logger.debug(`Cache HIT: active games with status ${status}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: fetching active games with status ${status} from database`);
    
    const query = this.gameRepository.createQueryBuilder('game')
      .leftJoinAndSelect('game.gamePlayers', 'gamePlayers')
      .leftJoinAndSelect('gamePlayers.user', 'user');

    if (status) {
      query.where('game.status = :status', { status });
    } else {
      query.where('game.status IN (:...statuses)', { statuses: ['waiting', 'playing'] });
    }

    const games = await query.getMany();
    
    // Cache the result
    await this.cacheService.setActiveGames(games, status as any, 120); // 2 minutes
    
    return games;
  }

  /**
   * Get games by user with caching
   */
  async getGamesByUser(userId: string, status?: string): Promise<Game[]> {
    // Try to get from cache first
    const cached = await this.cacheService.getUserGames(userId, status as any);
    if (cached) {
      this.logger.debug(`Cache HIT: user games for user ${userId}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: fetching user games for user ${userId} from database`);
    
    const query = this.gameRepository.createQueryBuilder('game')
      .leftJoinAndSelect('game.gamePlayers', 'gamePlayers')
      .leftJoinAndSelect('gamePlayers.user', 'user')
      .where('gamePlayers.userId = :userId', { userId });

    if (status) {
      query.andWhere('game.status = :status', { status });
    }

    const games = await query.getMany();
    
    // Cache the result
    await this.cacheService.setUserGames(userId, games, status as any, 300); // 5 minutes
    
    return games;
  }

  /**
   * Get game players with caching
   */
  async getGamePlayers(gameId: string, status?: string): Promise<any[]> {
    // Try to get from cache first
    const cached = await this.cacheService.getGamePlayers(gameId, status as any);
    if (cached) {
      this.logger.debug(`Cache HIT: game players for game ${gameId}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: fetching game players for game ${gameId} from database`);
    
    const query = this.gameRepository.createQueryBuilder('game')
      .leftJoinAndSelect('game.gamePlayers', 'gamePlayers')
      .leftJoinAndSelect('gamePlayers.user', 'user')
      .where('game.id = :gameId', { gameId });

    if (status) {
      query.andWhere('gamePlayers.status = :status', { status });
    }

    const game = await query.getOne();
    const players = game?.gamePlayers || [];
    
    // Cache the result
    await this.cacheService.setGamePlayers(gameId, players, status as any, 300); // 5 minutes
    
    return players;
  }

  /**
   * Get game rounds with caching
   */
  async getGameRounds(gameId: string, status?: string): Promise<GameRound[]> {
    // Try to get from cache first
    const cached = await this.cacheService.getGameRounds(gameId, status as any);
    if (cached) {
      this.logger.debug(`Cache HIT: game rounds for game ${gameId}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: fetching game rounds for game ${gameId} from database`);
    
    const query = this.gameRoundRepository.createQueryBuilder('round')
      .where('round.gameId = :gameId', { gameId });

    if (status) {
      query.andWhere('round.status = :status', { status });
    }

    query.orderBy('round.roundNumber', 'ASC');
    
    const rounds = await query.getMany();
    
    // Cache the result
    await this.cacheService.setGameRounds(gameId, rounds, status as any, 300); // 5 minutes
    
    return rounds;
  }

  /**
   * Invalidate game cache when game is updated
   */
  @InvalidateGame('gameId')
  async updateGame(gameId: string, updates: Partial<Game>): Promise<Game> {
    this.logger.debug(`Updating game: ${gameId}`);
    
    await this.gameRepository.update(gameId, updates);
    return this.getGameById(gameId);
  }

  /**
   * Invalidate game cache when player joins
   */
  @InvalidateGame('gameId')
  async addPlayerToGame(gameId: string, playerData: any): Promise<void> {
    this.logger.debug(`Adding player to game: ${gameId}`);
    
    // Implementation would add player to game
    // This is just a placeholder for demonstration
  }

  /**
   * Invalidate game cache when round is updated
   */
  @InvalidateGame('gameId')
  async updateRound(gameId: string, roundId: string, updates: Partial<GameRound>): Promise<GameRound> {
    this.logger.debug(`Updating round: ${roundId} in game: ${gameId}`);
    
    await this.gameRoundRepository.update(roundId, updates);
    return this.gameRoundRepository.findOne({ where: { id: roundId } });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clearAll();
    this.logger.log('All cache cleared');
  }

  /**
   * Clear cache for specific game
   */
  async clearGameCache(gameId: string): Promise<void> {
    await this.cacheService.invalidateGame(gameId);
    this.logger.log(`Cache cleared for game: ${gameId}`);
  }

  private transformPlayers(gamePlayers: any[]): GamePlayer[] {
    return gamePlayers.map(gp => ({
      id: gp.user.id,
      username: gp.user.username,
      firstName: gp.user.firstName,
      lastName: gp.user.lastName,
      avatarUrl: gp.user.avatarUrl,
      score: gp.score,
      correctAnswers: gp.correctAnswers,
      totalAnswers: gp.totalAnswers,
      isHost: gp.isHost,
      isSpectator: gp.isSpectator,
      joinedAt: gp.joinedAt || gp.createdAt
    }));
  }

  private transformQuestions(gameRounds: GameRound[], chillMode: boolean): GameQuestion[] {
    // Filter questions based on chill mode
    let queuedQuestions = gameRounds;
    
    if (chillMode) {
      // In chill mode, only show mild questions (not flagged, no flags)
      queuedQuestions = gameRounds.filter(round => 
        !round.flagged && round.flagCount === 0
      );
    }

    return queuedQuestions.map(round => ({
      id: round.id,
      question: round.question,
      type: round.type,
      options: round.options,
      correctAnswer: round.correctAnswer,
      category: round.category,
      roundNumber: round.roundNumber,
      flagCount: round.flagCount,
      isFlagged: round.flagged,
      isHidden: round.flagged && round.flagCount >= 3
    }));
  }

  private generateGameFlags(game: Game): GameFlags {
    return {
      isPrivate: game.isPrivate,
      hasPassword: !!game.password,
      isStarted: game.status === 'playing' || game.status === 'finished',
      isFinished: game.status === 'finished',
      isFull: game.currentPlayers >= game.maxPlayers,
      chillMode: game.chillMode
    };
  }
} 