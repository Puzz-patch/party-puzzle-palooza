import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { GamesService, DrawNextQuestionResult } from './games.service';
import { Game, GameRound, GameStatus, GameType, RoundStatus, RoundType } from '@party-puzzle-palooza/database';
import { ModerationService } from './moderation.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GamesService', () => {
  let service: GamesService;
  let gameRepository: jest.Mocked<Repository<Game>>;
  let gameRoundRepository: jest.Mocked<Repository<GameRound>>;
  let dataSource: jest.Mocked<DataSource>;
  let moderationService: jest.Mocked<ModerationService>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let redisService: jest.Mocked<RedisService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockGameRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockGameRoundRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
  };

  const mockModerationService = {
    isContentAppropriate: jest.fn(),
  };

  const mockRateLimitService = {
    checkIpRateLimit: jest.fn(),
    checkPlayerRateLimit: jest.fn(),
  };

  const mockRedisService = {
    publishToGameJson: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GameRound),
          useValue: mockGameRoundRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ModerationService,
          useValue: mockModerationService,
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    gameRepository = module.get(getRepositoryToken(Game));
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    dataSource = module.get(DataSource);
    moderationService = module.get(ModerationService);
    rateLimitService = module.get(RateLimitService);
    redisService = module.get(RedisService);

    // Setup query runner mock
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('drawNextQuestion', () => {
    const gameId = 'test-game-id';
    const authorId = 'test-author-id';
    const maskedAuthorId = 'author_a1b2c3d4';

    const mockGame: Partial<Game> = {
      id: gameId,
      name: 'Test Game',
      code: 'TEST123',
      status: GameStatus.PLAYING,
      type: GameType.WOULD_YOU_RATHER,
      maxPlayers: 4,
      currentPlayers: 2,
      roundsPerGame: 3,
      timePerRound: 30,
      gameRounds: [],
    };

    const mockQuestion: Partial<GameRound> = {
      id: 'question-id',
      gameId,
      roundNumber: 1,
      type: RoundType.WOULD_YOU_RATHER,
      status: RoundStatus.PENDING,
      question: 'Would you rather have the ability to fly or be invisible?',
      options: ['Fly', 'Be invisible'],
      correctAnswer: null,
      timeLimit: 30,
      createdById: authorId,
      roundData: {
        category: 'fun',
        isCustom: true,
      },
    };

    const mockNewRound: Partial<GameRound> = {
      id: 'new-round-id',
      gameId,
      roundNumber: 1,
      type: RoundType.WOULD_YOU_RATHER,
      status: RoundStatus.ACTIVE,
      question: mockQuestion.question,
      options: mockQuestion.options,
      correctAnswer: mockQuestion.correctAnswer,
      timeLimit: 30,
      createdById: authorId,
      startedAt: new Date(),
      roundData: {
        drawnFromQuestionId: mockQuestion.id,
        drawnAt: expect.any(String),
        originalRoundNumber: mockQuestion.roundNumber,
      },
    };

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    beforeEach(() => {
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should successfully draw next question', async () => {
      // Arrange
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame as Game)
        .mockResolvedValueOnce(mockQuestion as GameRound);

      mockQueryBuilder.getOne.mockResolvedValue(mockQuestion as GameRound);
      mockQueryRunner.manager.create.mockReturnValue(mockNewRound as GameRound);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewRound as GameRound);

      // Act
      const result = await service.drawNextQuestion(gameId);

      // Assert
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(Game, {
        where: { id: gameId },
        relations: ['gameRounds'],
      });

      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockQueryBuilder.setOnLocked).toHaveBeenCalledWith('skip_locked');

      expect(result).toEqual({
        roundId: mockNewRound.id,
        roundNumber: 1,
        question: mockQuestion.question,
        type: mockQuestion.type,
        options: mockQuestion.options,
        correctAnswer: mockQuestion.correctAnswer,
        timeLimit: mockGame.timePerRound,
        maskedAuthorId: expect.stringMatching(/^author_[a-f0-9]{8}$/),
        totalRounds: mockGame.roundsPerGame,
        currentRound: 1,
      });
    });

    it('should throw NotFoundException when game not found', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.drawNextQuestion(gameId)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when game has reached max rounds', async () => {
      // Arrange
      const gameWithMaxRounds = {
        ...mockGame,
        roundsPerGame: 3,
        gameRounds: [
          { id: 'round1', roundNumber: 1 },
          { id: 'round2', roundNumber: 2 },
          { id: 'round3', roundNumber: 3 },
        ],
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(gameWithMaxRounds as Game);

      // Act & Assert
      await expect(service.drawNextQuestion(gameId)).rejects.toThrow(
        new BadRequestException('Game has reached maximum number of rounds')
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no questions available', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue(mockGame as Game);
      mockQueryBuilder.getOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.drawNextQuestion(gameId)).rejects.toThrow(
        new BadRequestException('No more questions available for this game')
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockQueryRunner.manager.findOne.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.drawNextQuestion(gameId)).rejects.toThrow(dbError);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should update original question status to FINISHED', async () => {
      // Arrange
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame as Game)
        .mockResolvedValueOnce(mockQuestion as GameRound);

      mockQueryBuilder.getOne.mockResolvedValue(mockQuestion as GameRound);
      mockQueryRunner.manager.create.mockReturnValue(mockNewRound as GameRound);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewRound as GameRound);

      // Act
      await service.drawNextQuestion(gameId);

      // Assert
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        GameRound,
        mockQuestion.id,
        {
          status: RoundStatus.FINISHED,
          roundData: {
            ...mockQuestion.roundData,
            usedInRound: 1,
            usedAt: expect.any(String),
          },
        }
      );
    });

    it('should create new round with correct metadata', async () => {
      // Arrange
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame as Game)
        .mockResolvedValueOnce(mockQuestion as GameRound);

      mockQueryBuilder.getOne.mockResolvedValue(mockQuestion as GameRound);
      mockQueryRunner.manager.create.mockReturnValue(mockNewRound as GameRound);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewRound as GameRound);

      // Act
      await service.drawNextQuestion(gameId);

      // Assert
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(GameRound, {
        gameId,
        roundNumber: 1,
        type: mockQuestion.type,
        status: RoundStatus.ACTIVE,
        question: mockQuestion.question,
        options: mockQuestion.options,
        correctAnswer: mockQuestion.correctAnswer,
        timeLimit: mockGame.timePerRound,
        startedAt: expect.any(Date),
        createdById: mockQuestion.createdById,
        roundData: {
          drawnFromQuestionId: mockQuestion.id,
          drawnAt: expect.any(String),
          originalRoundNumber: mockQuestion.roundNumber,
        },
      });
    });

    it('should mask author ID consistently', async () => {
      // Arrange
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame as Game)
        .mockResolvedValueOnce(mockQuestion as GameRound);

      mockQueryBuilder.getOne.mockResolvedValue(mockQuestion as GameRound);
      mockQueryRunner.manager.create.mockReturnValue(mockNewRound as GameRound);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewRound as GameRound);

      // Act
      const result1 = await service.drawNextQuestion(gameId);
      const result2 = await service.drawNextQuestion(gameId);

      // Assert
      expect(result1.maskedAuthorId).toMatch(/^author_[a-f0-9]{8}$/);
      expect(result2.maskedAuthorId).toMatch(/^author_[a-f0-9]{8}$/);
      // Same author should get same mask
      expect(result1.maskedAuthorId).toBe(result2.maskedAuthorId);
    });

    it('should handle concurrent access with FOR UPDATE SKIP LOCKED', async () => {
      // Arrange
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame as Game)
        .mockResolvedValueOnce(mockQuestion as GameRound);

      mockQueryBuilder.getOne.mockResolvedValue(mockQuestion as GameRound);
      mockQueryRunner.manager.create.mockReturnValue(mockNewRound as GameRound);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewRound as GameRound);

      // Act
      await service.drawNextQuestion(gameId);

      // Assert
      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockQueryBuilder.setOnLocked).toHaveBeenCalledWith('skip_locked');
    });
  });

  describe('maskAuthorId', () => {
    it('should generate consistent masked IDs', () => {
      const authorId = 'test-author-123';
      
      // Call the private method through reflection or test it indirectly
      const result1 = (service as any).maskAuthorId(authorId);
      const result2 = (service as any).maskAuthorId(authorId);
      
      expect(result1).toMatch(/^author_[a-f0-9]{8}$/);
      expect(result2).toMatch(/^author_[a-f0-9]{8}$/);
      expect(result1).toBe(result2);
    });

    it('should generate different masks for different authors', () => {
      const author1 = 'author-1';
      const author2 = 'author-2';
      
      const mask1 = (service as any).maskAuthorId(author1);
      const mask2 = (service as any).maskAuthorId(author2);
      
      expect(mask1).not.toBe(mask2);
    });
  });
}); 