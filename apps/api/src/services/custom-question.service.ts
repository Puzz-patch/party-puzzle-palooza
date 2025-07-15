import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { CreateCustomQuestionDto, CustomQuestionResponseDto } from '../dto/custom-question.dto';
import { ModerationService } from './moderation.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';

@Injectable()
export class CustomQuestionService {
  private readonly logger = new Logger(CustomQuestionService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private moderationService: ModerationService,
    private rateLimitService: RateLimitService,
    private redisService: RedisService
  ) {}

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

  /**
   * Masks an author ID to provide anonymity while maintaining consistency
   */
  private maskAuthorId(authorId: string): string {
    const hash = createHash('sha256')
      .update(authorId + (process.env['AUTHOR_MASK_SALT'] || 'default_salt'))
      .digest('hex');
    
    return `author_${hash.substring(0, 8)}`;
  }

  async getCustomQuestionsByPlayer(gameId: string, playerId: string): Promise<CustomQuestionResponseDto[]> {
    const questions = await this.gameRoundRepository.find({
      where: {
        gameId,
        createdById: playerId,
        roundData: { isCustom: true }
      },
      order: { createdAt: 'DESC' }
    });

    return questions.map(question => this.mapToCustomQuestionResponse(question));
  }

  async getCustomQuestionsCount(gameId: string): Promise<number> {
    return await this.gameRoundRepository.count({
      where: {
        gameId,
        roundData: { isCustom: true }
      }
    });
  }
} 