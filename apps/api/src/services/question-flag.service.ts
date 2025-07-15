import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameRound, QuestionFlag, FlagReason } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { FlagQuestionDto, FlagQuestionResponseDto } from '../dto/question-flag.dto';

@Injectable()
export class QuestionFlagService {
  private readonly logger = new Logger(QuestionFlagService.name);
  private readonly FLAG_THRESHOLD = 3; // Number of unique flags before auto-flagging

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(QuestionFlag)
    private questionFlagRepository: Repository<QuestionFlag>,
    private dataSource: DataSource,
    private redisService: RedisService,
  ) {}

  async flagQuestion(
    questionId: string,
    userId: string,
    flagDto: FlagQuestionDto
  ): Promise<FlagQuestionResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get the question
      const question = await queryRunner.manager.findOne(GameRound, {
        where: { id: questionId }
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      // Check if user has already flagged this question
      const existingFlag = await queryRunner.manager.findOne(QuestionFlag, {
        where: { questionId, flaggedBy: userId }
      });

      if (existingFlag) {
        throw new BadRequestException('You have already flagged this question');
      }

      // Create the flag
      const flag = queryRunner.manager.create(QuestionFlag, {
        questionId,
        flaggedBy: userId,
        reason: flagDto.reason,
        details: flagDto.details,
        isResolved: false
      });

      await queryRunner.manager.save(flag);

      // Get total unique flags for this question
      const flagCount = await queryRunner.manager.count(QuestionFlag, {
        where: { questionId, isResolved: false }
      });

      let isFlagged = question.flagged;
      let isHidden = false;

      // Check if we've reached the threshold for auto-flagging
      if (flagCount >= this.FLAG_THRESHOLD && !question.flagged) {
        // Auto-flag the question
        await queryRunner.manager.update(GameRound, questionId, {
          flagged: true,
          flaggedAt: new Date(),
          flagCount
        });

        isFlagged = true;
        isHidden = true;

        // Send email to moderators
        await this.notifyModerators(question, flagCount);

        this.logger.log(`Question ${questionId} auto-flagged after ${flagCount} flags`);
      } else {
        // Update flag count
        await queryRunner.manager.update(GameRound, questionId, {
          flagCount
        });
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast flag event
      await this.broadcastFlagEvent(questionId, flagCount, isFlagged, isHidden);

      this.logger.log(`Question ${questionId} flagged by user ${userId}. Total flags: ${flagCount}`);

      return {
        success: true,
        message: isFlagged 
          ? `Question flagged and hidden after ${flagCount} reports`
          : `Question flagged successfully. ${this.FLAG_THRESHOLD - flagCount} more flags needed for moderation.`,
        flagCount,
        isFlagged,
        isHidden
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error flagging question ${questionId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getQuestionFlags(questionId: string): Promise<QuestionFlag[]> {
    return this.questionFlagRepository.find({
      where: { questionId },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });
  }

  async resolveFlag(
    flagId: string,
    moderatorId: string,
    resolution: string
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const flag = await queryRunner.manager.findOne(QuestionFlag, {
        where: { id: flagId }
      });

      if (!flag) {
        throw new NotFoundException('Flag not found');
      }

      // Update flag as resolved
      await queryRunner.manager.update(QuestionFlag, flagId, {
        isResolved: true,
        resolvedBy: moderatorId,
        resolvedAt: new Date(),
        resolution
      });

      // Recalculate flag count for the question
      const activeFlagCount = await queryRunner.manager.count(QuestionFlag, {
        where: { questionId: flag.questionId, isResolved: false }
      });

      // Update question flag count
      await queryRunner.manager.update(GameRound, flag.questionId, {
        flagCount: activeFlagCount
      });

      // If flag count drops below threshold, unflag the question
      if (activeFlagCount < this.FLAG_THRESHOLD) {
        await queryRunner.manager.update(GameRound, flag.questionId, {
          flagged: false,
          flaggedAt: null
        });
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Flag ${flagId} resolved by moderator ${moderatorId}`);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error resolving flag ${flagId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getFlaggedQuestions(): Promise<GameRound[]> {
    return this.gameRoundRepository.find({
      where: { flagged: true },
      relations: ['createdBy', 'game'],
      order: { flaggedAt: 'DESC' }
    });
  }

  private async notifyModerators(question: GameRound, flagCount: number): Promise<void> {
    try {
      // This would integrate with your email service
      // For now, we'll log the notification
      this.logger.warn(`MODERATION ALERT: Question "${question.question}" has been flagged ${flagCount} times and requires review.`);
      
      // You could integrate with services like SendGrid, AWS SES, etc.
      // await this.emailService.sendModeratorAlert({
      //   questionId: question.id,
      //   question: question.question,
      //   flagCount,
      //   createdAt: question.createdAt,
      //   createdBy: question.createdById
      // });
      
    } catch (error) {
      this.logger.error(`Failed to notify moderators: ${error.message}`);
    }
  }

  private async broadcastFlagEvent(
    questionId: string, 
    flagCount: number, 
    isFlagged: boolean, 
    isHidden: boolean
  ): Promise<void> {
    try {
      const event = {
        type: 'question_flagged',
        data: {
          questionId,
          flagCount,
          isFlagged,
          isHidden,
          flaggedAt: new Date().toISOString()
        },
        timestamp: Date.now()
      };

      // Broadcast to all connected clients
      await this.redisService.publishToGameJson('global', event);
      
    } catch (error) {
      this.logger.error(`Failed to broadcast flag event: ${error.message}`);
    }
  }

  async getFlagStatistics(): Promise<{
    totalFlags: number;
    flaggedQuestions: number;
    resolvedFlags: number;
    pendingFlags: number;
  }> {
    const [totalFlags, flaggedQuestions, resolvedFlags, pendingFlags] = await Promise.all([
      this.questionFlagRepository.count(),
      this.gameRoundRepository.count({ where: { flagged: true } }),
      this.questionFlagRepository.count({ where: { isResolved: true } }),
      this.questionFlagRepository.count({ where: { isResolved: false } })
    ]);

    return {
      totalFlags,
      flaggedQuestions,
      resolvedFlags,
      pendingFlags
    };
  }
} 