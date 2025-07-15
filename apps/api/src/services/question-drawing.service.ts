import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameRound, RoundStatus, RoundType } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';

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
export class QuestionDrawingService {
  private readonly logger = new Logger(QuestionDrawingService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private dataSource: DataSource,
    private redisService: RedisService
  ) {}

  async drawNextQuestion(gameId: string): Promise<DrawNextQuestionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get game with current round count
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
        relations: ['gameRounds']
      }) as Game & { gameRounds: GameRound[] };

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game has reached max rounds
      const currentRoundCount = game.gameRounds.length;
      if (currentRoundCount >= game.roundsPerGame) {
        throw new BadRequestException('Game has reached maximum number of rounds');
      }

      // Get next available question
      const nextQuestion = await this.getNextAvailableQuestion(queryRunner, gameId, game.chillMode);

      if (!nextQuestion) {
        const modeMessage = game.chillMode 
          ? 'No mild questions available for this game' 
          : 'No more questions available for this game';
        throw new BadRequestException(modeMessage);
      }

      // Calculate the next round number
      const nextRoundNumber = currentRoundCount + 1;

      // Create a new round entry for the drawn question
      const newRound = await this.createNewRound(queryRunner, gameId, nextRoundNumber, nextQuestion, game);

      // Update the original question status to indicate it's been used
      await this.markQuestionAsUsed(queryRunner, nextQuestion, nextRoundNumber);

      // Mask the author ID for anonymity
      const maskedAuthorId = this.maskAuthorId(nextQuestion.createdById);

      await queryRunner.commitTransaction();

      this.logger.log(`Drew question for game ${gameId}, round ${nextRoundNumber}, chill mode: ${game.chillMode}`);

      return {
        roundId: newRound.id,
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
      this.logger.error(`Error drawing next question for game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async getNextAvailableQuestion(
    queryRunner: any,
    gameId: string,
    chillMode: boolean
  ): Promise<GameRound | null> {
    if (chillMode) {
      // In chill mode, use the mild questions view
      return await queryRunner.manager
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
      return await queryRunner.manager
        .createQueryBuilder(GameRound, 'round')
        .where('round.gameId = :gameId', { gameId })
        .andWhere('round.status = :status', { status: RoundStatus.PENDING })
        .orderBy('round.roundNumber', 'ASC')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getOne();
    }
  }

  private async createNewRound(
    queryRunner: any,
    gameId: string,
    roundNumber: number,
    sourceQuestion: GameRound,
    game: Game
  ): Promise<GameRound> {
    const newRound = queryRunner.manager.create(GameRound, {
      gameId: gameId,
      roundNumber: roundNumber,
      type: sourceQuestion.type,
      status: RoundStatus.ACTIVE,
      question: sourceQuestion.question,
      options: sourceQuestion.options,
      correctAnswer: sourceQuestion.correctAnswer,
      timeLimit: game.timePerRound,
      startedAt: new Date(),
      createdById: sourceQuestion.createdById, // Preserve original creator
      roundData: {
        drawnFromQuestionId: sourceQuestion.id,
        drawnAt: new Date().toISOString(),
        originalRoundNumber: sourceQuestion.roundNumber,
        chillMode: game.chillMode
      }
    });

    return await queryRunner.manager.save(newRound);
  }

  private async markQuestionAsUsed(
    queryRunner: any,
    question: GameRound,
    usedInRound: number
  ): Promise<void> {
    await queryRunner.manager.update(GameRound, question.id, {
      status: RoundStatus.FINISHED,
      roundData: {
        ...question.roundData,
        usedInRound: usedInRound,
        usedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Masks an author ID to provide anonymity while maintaining consistency
   * Uses a deterministic hash to ensure the same author always gets the same mask
   */
  private maskAuthorId(authorId: string): string {
    const hash = createHash('sha256')
      .update(authorId + (process.env['AUTHOR_MASK_SALT'] || 'default_salt'))
      .digest('hex');
    
    // Return first 8 characters of hash for readability
    return `author_${hash.substring(0, 8)}`;
  }

  async getAvailableQuestionsCount(gameId: string, chillMode: boolean): Promise<number> {
    const queryBuilder = this.gameRoundRepository
      .createQueryBuilder('round')
      .where('round.gameId = :gameId', { gameId })
      .andWhere('round.status = :status', { status: RoundStatus.PENDING });

    if (chillMode) {
      queryBuilder
        .andWhere('round.flagged = :flagged', { flagged: false })
        .andWhere('round.flagCount = :flagCount', { flagCount: 0 });
    }

    return await queryBuilder.getCount();
  }
} 