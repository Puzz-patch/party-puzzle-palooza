import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from '../services/games.service';
import { CreateCustomQuestionDto } from '../dto/custom-question.dto';
import { GameType } from '@party-puzzle-palooza/database';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GamesController', () => {
  let controller: GamesController;
  let gamesService: jest.Mocked<GamesService>;

  const mockGamesService = {
    getGameManifest: jest.fn(),
    createCustomQuestion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: mockGamesService,
        },
      ],
    }).compile();

    controller = module.get<GamesController>(GamesController);
    gamesService = module.get(GamesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /games/:gid/manifest', () => {
    const gameId = 'test-game-id';
    const playerGameId = 'test-game-id';

    it('should return game manifest successfully', async () => {
      const mockManifest = {
        id: gameId,
        name: 'Test Game',
        code: 'TEST123',
        status: 'waiting',
        type: GameType.WOULD_YOU_RATHER,
        players: [],
        queuedQuestions: [],
        flags: {
          isPrivate: false,
          hasPassword: false,
          isStarted: false,
          isFinished: false,
          isFull: false,
        },
      };

      gamesService.getGameManifest.mockResolvedValue(mockManifest);

      const result = await controller.getGameManifest(gameId, playerGameId);

      expect(gamesService.getGameManifest).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(mockManifest);
    });

    it('should throw error when game ID mismatch', async () => {
      const differentGameId = 'different-game-id';

      await expect(
        controller.getGameManifest(gameId, differentGameId)
      ).rejects.toThrow('Access denied: game ID mismatch');

      expect(gamesService.getGameManifest).not.toHaveBeenCalled();
    });

    it('should handle 404 when game not found', async () => {
      gamesService.getGameManifest.mockRejectedValue(new NotFoundException('Game not found'));

      await expect(
        controller.getGameManifest(gameId, playerGameId)
      ).rejects.toThrow(NotFoundException);

      expect(gamesService.getGameManifest).toHaveBeenCalledWith(gameId);
    });
  });

  describe('POST /games/:gid/questions/custom', () => {
    const gameId = 'test-game-id';
    const playerId = 'test-player-id';
    const playerGameId = 'test-game-id';
    const ip = '127.0.0.1';

    const mockCreateDto: CreateCustomQuestionDto = {
      question: 'Would you rather have the ability to fly or be invisible?',
      type: GameType.WOULD_YOU_RATHER,
      category: 'fun',
    };

    const mockRequest = {
      ip,
      connection: { remoteAddress: '127.0.0.1' },
    };

    const mockResponse = {
      id: 'question-id',
      question: mockCreateDto.question,
      type: mockCreateDto.type,
      gameId,
      createdBy: playerId,
      status: 'pending',
    };

    it('should create custom question successfully', async () => {
      gamesService.createCustomQuestion.mockResolvedValue(mockResponse);

      const result = await controller.createCustomQuestion(
        gameId,
        mockCreateDto,
        playerId,
        playerGameId,
        mockRequest
      );

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        ip
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when game ID mismatch', async () => {
      const differentGameId = 'different-game-id';

      await expect(
        controller.createCustomQuestion(
          gameId,
          mockCreateDto,
          playerId,
          differentGameId,
          mockRequest
        )
      ).rejects.toThrow('Access denied: game ID mismatch');

      expect(gamesService.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should handle rate limit exceeded', async () => {
      gamesService.createCustomQuestion.mockRejectedValue(
        new BadRequestException('Rate limit exceeded. Try again in 30 seconds')
      );

      await expect(
        controller.createCustomQuestion(
          gameId,
          mockCreateDto,
          playerId,
          playerGameId,
          mockRequest
        )
      ).rejects.toThrow(BadRequestException);

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        ip
      );
    });

    it('should handle content moderation failure', async () => {
      gamesService.createCustomQuestion.mockRejectedValue(
        new BadRequestException('Question content violates community guidelines')
      );

      await expect(
        controller.createCustomQuestion(
          gameId,
          mockCreateDto,
          playerId,
          playerGameId,
          mockRequest
        )
      ).rejects.toThrow(BadRequestException);

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        ip
      );
    });

    it('should handle 404 when game not found', async () => {
      gamesService.createCustomQuestion.mockRejectedValue(
        new NotFoundException('Game not found')
      );

      await expect(
        controller.createCustomQuestion(
          gameId,
          mockCreateDto,
          playerId,
          playerGameId,
          mockRequest
        )
      ).rejects.toThrow(NotFoundException);

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        ip
      );
    });

    it('should use fallback IP when request.ip is not available', async () => {
      const requestWithoutIp = {
        connection: { remoteAddress: '192.168.1.1' },
      };

      gamesService.createCustomQuestion.mockResolvedValue(mockResponse);

      await controller.createCustomQuestion(
        gameId,
        mockCreateDto,
        playerId,
        playerGameId,
        requestWithoutIp
      );

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        '192.168.1.1'
      );
    });

    it('should use unknown IP when no IP is available', async () => {
      const requestWithoutIp = {};

      gamesService.createCustomQuestion.mockResolvedValue(mockResponse);

      await controller.createCustomQuestion(
        gameId,
        mockCreateDto,
        playerId,
        playerGameId,
        requestWithoutIp
      );

      expect(gamesService.createCustomQuestion).toHaveBeenCalledWith(
        gameId,
        playerId,
        mockCreateDto,
        'unknown'
      );
    });
  });
}); 