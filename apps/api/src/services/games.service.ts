import { Injectable, Logger } from '@nestjs/common';
import { GameQueryService, GameManifest } from './game-query.service';
import { QuestionDrawingService, DrawNextQuestionResult } from './question-drawing.service';
import { CustomQuestionService } from './custom-question.service';
import { GameResetService, GameResetResult } from './game-reset.service';
import { CreateCustomQuestionDto, CustomQuestionResponseDto } from '../dto/custom-question.dto';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private gameQueryService: GameQueryService,
    private questionDrawingService: QuestionDrawingService,
    private customQuestionService: CustomQuestionService,
    private gameResetService: GameResetService
  ) {}

  async getGameById(gameId: string) {
    return await this.gameQueryService.getGameById(gameId);
  }

  async getGameManifest(gameId: string): Promise<GameManifest> {
    return await this.gameQueryService.getGameManifest(gameId);
  }

  async drawNextQuestion(gameId: string): Promise<DrawNextQuestionResult> {
    return await this.questionDrawingService.drawNextQuestion(gameId);
  }

  async createCustomQuestion(
    gameId: string,
    playerId: string,
    createDto: CreateCustomQuestionDto,
    ip: string
  ): Promise<CustomQuestionResponseDto> {
    return await this.customQuestionService.createCustomQuestion(gameId, playerId, createDto, ip);
  }

  async resetGame(gameId: string): Promise<GameResetResult> {
    return await this.gameResetService.resetGame(gameId);
  }

  async getAvailableQuestionsCount(gameId: string, chillMode: boolean): Promise<number> {
    return await this.questionDrawingService.getAvailableQuestionsCount(gameId, chillMode);
  }

  async getCustomQuestionsByPlayer(gameId: string, playerId: string): Promise<CustomQuestionResponseDto[]> {
    return await this.customQuestionService.getCustomQuestionsByPlayer(gameId, playerId);
  }

  async getCustomQuestionsCount(gameId: string): Promise<number> {
    return await this.customQuestionService.getCustomQuestionsCount(gameId);
  }

  async canResetGame(gameId: string): Promise<boolean> {
    return await this.gameResetService.canResetGame(gameId);
  }

  async getResetEligibility(gameId: string) {
    return await this.gameResetService.getResetEligibility(gameId);
  }
} 