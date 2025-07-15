import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameRound, GameType, RoundStatus, RoundType } from '@party-puzzle-palooza/database';
import { CreateCustomQuestionDto, CustomQuestionResponseDto } from '../dto/custom-question.dto';
import { ModerationService } from './moderation.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';
import { GameStatus } from '@party-puzzle-palooza/database/src/game.entity';

export interface DrawNextQuestionResult {
  roundId: string;
  roundNumber: number;
  question: string;
  type: RoundType;
  options: string[];
  correctAnswer?: string;
  timeLimit: number;
  maskedAuthorId: string;
  totalRounds: number;
  currentRound: number;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private dataSource: DataSource,
    private moderationService: ModerationService,
    private rateLimitService: RateLimitService,
    private redisService: RedisService
  ) {}

  async getGameById(gameId: string): Promise<Game> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  async getGameManifest(gameId: string): Promise<any> {
    const game = await this.getGameById(gameId);

    // Transform to DTO format
    const players = game.gamePlayers.map(gp => ({
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

    // Filter questions based on chill mode
    let queuedQuestions = game.gameRounds;
    
    if (game.chillMode) {
      // In chill mode, only show mild questions (not flagged, no flags)
      queuedQuestions = game.gameRounds.filter(round => 
        !round.flagged && round.flagCount === 0
      );
    }

    const transformedQuestions = queuedQuestions.map(round => ({
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

    const flags = {
      isPrivate: game.isPrivate,
      hasPassword: !!game.password,
      isStarted: game.status === 'playing' || game.status === 'finished',
      isFinished: game.status === 'finished',
      isFull: game.currentPlayers >= game.maxPlayers,
      chillMode: game.chillMode
    };

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
      queuedQuestions: transformedQuestions,
      flags,
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt
    };
  }

  async drawNextQuestion(gameId: string): Promise<DrawNextQuestionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get game with current round count
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
        relations: ['gameRounds']
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game has reached max rounds
      const currentRoundCount = game.gameRounds.length;
      if (currentRoundCount >= game.roundsPerGame) {
        throw new BadRequestException('Game has reached maximum number of rounds');
      }

      // Use different query based on chill mode
      let nextQuestion: GameRound;
      
      if (game.chillMode) {
        // In chill mode, use the mild questions view
        nextQuestion = await queryRunner.manager
          .createQueryBuilder(GameRound, 'round')
          .where('round.gameId = :gameId', { gameId })
          .andWhere('round.status = :status', { status: RoundStatus.PENDING })
          .andWhere('round.flagged = :flagged', { flagged: false })
          .andWhere('round.flagCount = :flagCount', { flagCount: 0 })
          .orderBy('round.roundNumber', 'ASC')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();
      } else {
        // Normal mode - get any available question
        nextQuestion = await queryRunner.manager
          .createQueryBuilder(GameRound, 'round')
          .where('round.gameId = :gameId', { gameId })
          .andWhere('round.status = :status', { status: RoundStatus.PENDING })
          .orderBy('round.roundNumber', 'ASC')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();
      }

      if (!nextQuestion) {
        const modeMessage = game.chillMode 
          ? 'No mild questions available for this game' 
          : 'No more questions available for this game';
        throw new BadRequestException(modeMessage);
      }

      // Calculate the next round number
      const nextRoundNumber = currentRoundCount + 1;

      // Create a new round entry for the drawn question
      const newRound = queryRunner.manager.create(GameRound, {
        gameId: gameId,
        roundNumber: nextRoundNumber,
        type: nextQuestion.type,
        status: RoundStatus.ACTIVE,
        question: nextQuestion.question,
        options: nextQuestion.options,
        correctAnswer: nextQuestion.correctAnswer,
        timeLimit: game.timePerRound,
        startedAt: new Date(),
        createdById: nextQuestion.createdById, // Preserve original creator
        roundData: {
          drawnFromQuestionId: nextQuestion.id,
          drawnAt: new Date().toISOString(),
          originalRoundNumber: nextQuestion.roundNumber,
          chillMode: game.chillMode
        }
      });

      // Save the new round
      const savedRound = await queryRunner.manager.save(newRound);

      // Update the original question status to indicate it's been used
      await queryRunner.manager.update(GameRound, nextQuestion.id, {
        status: RoundStatus.FINISHED,
        roundData: {
          ...nextQuestion.roundData,
          usedInRound: nextRoundNumber,
          usedAt: new Date().toISOString()
        }
      });

      // Mask the author ID for anonymity
      const maskedAuthorId = this.maskAuthorId(nextQuestion.createdById);

      await queryRunner.commitTransaction();

      this.logger.log(`Drew question for game ${gameId}, round ${nextRoundNumber}, chill mode: ${game.chillMode}`);

      return {
        roundId: savedRound.id,
        roundNumber: nextRoundNumber,
        question: nextQuestion.question,
        type: nextQuestion.type,
        options: nextQuestion.options,
        correctAnswer: nextQuestion.correctAnswer,
        timeLimit: game.timePerRound,
        maskedAuthorId,
        totalRounds: game.roundsPerGame,
        currentRound: nextRoundNumber
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error drawing next question for game ${gameId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Masks an author ID to provide anonymity while maintaining consistency
   * Uses a deterministic hash to ensure the same author always gets the same mask
   */
  private maskAuthorId(authorId: string): string {
    const hash = createHash('sha256')
      .update(authorId + process.env.AUTHOR_MASK_SALT || 'default_salt')
      .digest('hex');
    
    // Return first 8 characters of hash for readability
    return `author_${hash.substring(0, 8)}`;
  }

  async createCustomQuestion(
    gameId: string,
    playerId: string,
    createDto: CreateCustomQuestionDto,
    ip: string
  ): Promise<CustomQuestionResponseDto> {
    // Check if game exists
    const game = await this.gameRepository.findOne({
      where: { id: gameId }
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check rate limits
    const ipRateLimit = await this.rateLimitService.checkIpRateLimit(ip);
    if (!ipRateLimit.allowed) {
      throw new BadRequestException(`Rate limit exceeded. Try again in ${Math.ceil((ipRateLimit.resetTime - Date.now()) / 1000)} seconds`);
    }

    const playerRateLimit = await this.rateLimitService.checkPlayerRateLimit(playerId);
    if (!playerRateLimit.allowed) {
      throw new BadRequestException(`Player rate limit exceeded. Try again in ${Math.ceil((playerRateLimit.resetTime - Date.now()) / 1000)} seconds`);
    }

    // Moderate content
    const isAppropriate = await this.moderationService.isContentAppropriate(createDto.question);
    if (!isAppropriate) {
      throw new BadRequestException('Question content violates community guidelines');
    }

    // Create idempotency key
    const idempotencyKey = this.createIdempotencyKey(gameId, playerId, createDto);
    
    // Check if this exact question was already created by this player
    const existingQuestion = await this.gameRoundRepository.findOne({
      where: {
        gameId,
        createdById: playerId,
        question: createDto.question,
        type: createDto.type
      }
    });

    if (existingQuestion) {
      // Return existing question (idempotent behavior)
      return this.mapToCustomQuestionResponse(existingQuestion);
    }

    // Get next round number for this game
    const currentRoundCount = await this.gameRoundRepository.count({
      where: { gameId }
    });

    // Create new question
    const newQuestion = this.gameRoundRepository.create({
      gameId,
      roundNumber: currentRoundCount + 1,
      type: createDto.type,
      status: RoundStatus.PENDING,
      question: createDto.question,
      options: createDto.options || [],
      correctAnswer: createDto.correctAnswer,
      timeLimit: game.timePerRound,
      createdById: playerId,
      roundData: {
        category: createDto.category,
        isCustom: true,
        createdAt: new Date().toISOString()
      }
    });

    const savedQuestion = await this.gameRoundRepository.save(newQuestion);

    // Broadcast question creation to game room
    await this.redisService.publishToGameJson(gameId, {
      type: 'question_created',
      data: {
        questionId: savedQuestion.id,
        question: savedQuestion.question,
        type: savedQuestion.type,
        createdBy: this.maskAuthorId(playerId),
        timestamp: new Date().toISOString()
      }
    });

    return this.mapToCustomQuestionResponse(savedQuestion);
  }

  private createIdempotencyKey(gameId: string, playerId: string, createDto: CreateCustomQuestionDto): string {
    const content = `${gameId}:${playerId}:${createDto.question}:${createDto.type}`;
    return createHash('sha256').update(content).digest('hex');
  }

  private mapToCustomQuestionResponse(question: GameRound): CustomQuestionResponseDto {
    return {
      id: question.id,
      question: question.question,
      type: question.type,
      options: question.options,
      correctAnswer: question.correctAnswer,
      category: question.roundData?.category,
      gameId: question.gameId,
      createdBy: this.maskAuthorId(question.createdById),
      status: question.status
    };
  }

  async resetGame(gameId: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get game with all related data
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
        relations: ['gamePlayers', 'gameRounds']
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game can be reset (must be finished)
      if (game.status !== GameStatus.FINISHED) {
        throw new BadRequestException('Only finished games can be reset');
      }

      // Reset game status to waiting
      game.status = GameStatus.WAITING;
      game.startedAt = null;
      game.finishedAt = null;
      game.winnerId = null;

      // Reset game metadata
      game.metadata = {
        ...game.metadata,
        currentState: 'lobby',
        gameEndedAt: null,
        finale: null
      };

      // Reset all game rounds to pending
      for (const round of game.gameRounds) {
        round.status = RoundStatus.PENDING;
        round.startedAt = null;
        round.endedAt = null;
        round.revealed = false;
        round.revealedAt = null;
        round.archived = false;
        round.archivedAt = null;
        round.roundData = null;
        round.results = null;
        
        await queryRunner.manager.save(round);
      }

      // Reset player scores
      for (const gamePlayer of game.gamePlayers) {
        gamePlayer.score = 0;
        gamePlayer.correctAnswers = 0;
        gamePlayer.totalAnswers = 0;
        gamePlayer.gameStats = null;
        
        await queryRunner.manager.save(gamePlayer);
      }

      // Save the reset game
      await queryRunner.manager.save(game);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast game reset event
      await this.redisService.publishToGameJson(gameId, {
        type: 'game_reset',
        gameId,
        data: {
          gameId,
          gameName: game.name,
          gameCode: game.code,
          resetAt: new Date().toISOString(),
          playerCount: game.gamePlayers.length,
          roundCount: game.gameRounds.length
        },
        timestamp: Date.now()
      });

      this.logger.log(`Game ${gameId} reset successfully to lobby state`);

      return {
        gameId: game.id,
        gameName: game.name,
        gameCode: game.code,
        status: game.status,
        playerCount: game.gamePlayers.length,
        roundCount: game.gameRounds.length,
        resetAt: new Date().toISOString()
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error resetting game ${gameId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
} 