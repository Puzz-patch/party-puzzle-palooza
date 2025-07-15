import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GamesService } from './games.service';
import { Game, GameRound, GameStatus, RoundStatus } from '@party-puzzle-palooza/database';
import { ModerationService } from './moderation.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GamesService - Chill Mode', () => {
  let service: GamesService;
  let gameRepository: any;
  let gameRoundRepository: any;
  let dataSource: any;

  const mockGame = {
    id: 'game-123',
    name: 'Test Game',
    chillMode: true,
    roundsPerGame: 5,
    timePerRound: 30,
    gameRounds: [],
    status: GameStatus.WAITING
  };

  const mockMildQuestion = {
    id: 'question-1',
    gameId: 'game-123',
    question: 'What is your favorite color?',
    type: 'would_you_rather',
    options: ['Red', 'Blue'],
    status: RoundStatus.PENDING,
    flagged: false,
    flagCount: 0,
    createdById: 'user-1'
  };

  const mockFlaggedQuestion = {
    id: 'question-2',
    gameId: 'game-123',
    question: 'Inappropriate question',
    type: 'would_you_rather',
    options: ['Option A', 'Option B'],
    status: RoundStatus.PENDING,
    flagged: true,
    flagCount: 3,
    createdById: 'user-2'
  };

  beforeEach(async () => {
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
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          setOnLocked: jest.fn().mockReturnThis(),
          getOne: jest.fn()
        })
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: getRepositoryToken(Game),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GameRound),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: ModerationService,
          useValue: {
            moderateContent: jest.fn(),
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkRateLimit: jest.fn(),
            recordRequest: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            publishToGameJson: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    gameRepository = module.get(getRepositoryToken(Game));
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGameManifest - Chill Mode', () => {
    it('should filter out flagged questions when chill mode is enabled', async () => {
      const gameWithMixedQuestions = {
        ...mockGame,
        gamePlayers: [],
        gameRounds: [mockMildQuestion, mockFlaggedQuestion]
      };

      gameRepository.findOne.mockResolvedValue(gameWithMixedQuestions);

      const manifest = await service.getGameManifest('game-123');

      expect(manifest.flags.chillMode).toBe(true);
      expect(manifest.queuedQuestions).toHaveLength(1);
      expect(manifest.queuedQuestions[0].id).toBe('question-1');
      expect(manifest.queuedQuestions[0].isFlagged).toBe(false);
      expect(manifest.queuedQuestions[0].isHidden).toBe(false);
    });

    it('should include all questions when chill mode is disabled', async () => {
      const gameWithMixedQuestions = {
        ...mockGame,
        chillMode: false,
        gamePlayers: [],
        gameRounds: [mockMildQuestion, mockFlaggedQuestion]
      };

      gameRepository.findOne.mockResolvedValue(gameWithMixedQuestions);

      const manifest = await service.getGameManifest('game-123');

      expect(manifest.flags.chillMode).toBe(false);
      expect(manifest.queuedQuestions).toHaveLength(2);
      expect(manifest.queuedQuestions.find(q => q.id === 'question-1')).toBeDefined();
      expect(manifest.queuedQuestions.find(q => q.id === 'question-2')).toBeDefined();
    });

    it('should include flag information in question data', async () => {
      const gameWithQuestions = {
        ...mockGame,
        gamePlayers: [],
        gameRounds: [mockMildQuestion, mockFlaggedQuestion]
      };

      gameRepository.findOne.mockResolvedValue(gameWithQuestions);

      const manifest = await service.getGameManifest('game-123');

      const mildQuestion = manifest.queuedQuestions.find(q => q.id === 'question-1');
      const flaggedQuestion = manifest.queuedQuestions.find(q => q.id === 'question-2');

      expect(mildQuestion.flagCount).toBe(0);
      expect(mildQuestion.isFlagged).toBe(false);
      expect(mildQuestion.isHidden).toBe(false);

      if (flaggedQuestion) { // Only present when chill mode is false
        expect(flaggedQuestion.flagCount).toBe(3);
        expect(flaggedQuestion.isFlagged).toBe(true);
        expect(flaggedQuestion.isHidden).toBe(true);
      }
    });
  });

  describe('drawNextQuestion - Chill Mode', () => {
    it('should only draw mild questions when chill mode is enabled', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne.mockResolvedValue(mockGame);
      mockQueryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockMildQuestion);
      mockQueryRunner.manager.create.mockReturnValue({
        ...mockMildQuestion,
        roundNumber: 1,
        status: RoundStatus.ACTIVE
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'round-1',
        ...mockMildQuestion
      });

      const result = await service.drawNextQuestion('game-123');

      expect(result).toBeDefined();
      expect(result.question).toBe('What is your favorite color?');
      
      // Verify the query builder was called with chill mode filters
      const queryBuilder = mockQueryRunner.manager.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('round.flagged = :flagged', { flagged: false });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('round.flagCount = :flagCount', { flagCount: 0 });
    });

    it('should throw error when no mild questions available in chill mode', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne.mockResolvedValue(mockGame);
      mockQueryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(
        service.drawNextQuestion('game-123')
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should draw any available question when chill mode is disabled', async () => {
      const gameWithoutChillMode = { ...mockGame, chillMode: false };
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne.mockResolvedValue(gameWithoutChillMode);
      mockQueryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockFlaggedQuestion);
      mockQueryRunner.manager.create.mockReturnValue({
        ...mockFlaggedQuestion,
        roundNumber: 1,
        status: RoundStatus.ACTIVE
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'round-1',
        ...mockFlaggedQuestion
      });

      const result = await service.drawNextQuestion('game-123');

      expect(result).toBeDefined();
      expect(result.question).toBe('Inappropriate question');
      
      // Verify the query builder was NOT called with chill mode filters
      const queryBuilder = mockQueryRunner.manager.createQueryBuilder();
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('round.flagged = :flagged', { flagged: false });
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('round.flagCount = :flagCount', { flagCount: 0 });
    });
  });

  describe('chill mode edge cases', () => {
    it('should handle games with no questions gracefully', async () => {
      const emptyGame = {
        ...mockGame,
        gamePlayers: [],
        gameRounds: []
      };

      gameRepository.findOne.mockResolvedValue(emptyGame);

      const manifest = await service.getGameManifest('game-123');

      expect(manifest.queuedQuestions).toHaveLength(0);
      expect(manifest.flags.chillMode).toBe(true);
    });

    it('should handle questions with null flag count', async () => {
      const questionWithNullFlags = {
        ...mockMildQuestion,
        flagCount: null
      };

      const gameWithNullFlags = {
        ...mockGame,
        gamePlayers: [],
        gameRounds: [questionWithNullFlags]
      };

      gameRepository.findOne.mockResolvedValue(gameWithNullFlags);

      const manifest = await service.getGameManifest('game-123');

      // Should filter out questions with null flag count in chill mode
      expect(manifest.queuedQuestions).toHaveLength(0);
    });
  });
}); 