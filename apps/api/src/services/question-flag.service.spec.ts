import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuestionFlagService } from './question-flag.service';
import { GameRound, QuestionFlag } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { FlagReason } from '../dto/question-flag.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuestionFlagService', () => {
  let service: QuestionFlagService;
  let gameRoundRepository: any;
  let questionFlagRepository: any;
  let dataSource: any;
  let redisService: any;

  const mockGameRound = {
    id: 'question-123',
    question: 'Test question?',
    flagged: false,
    flagCount: 0,
  };

  const mockFlag = {
    id: 'flag-123',
    questionId: 'question-123',
    flaggedBy: 'user-123',
    reason: FlagReason.INAPPROPRIATE,
    details: 'Test flag',
    isResolved: false,
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
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionFlagService,
        {
          provide: getRepositoryToken(GameRound),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(QuestionFlag),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
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

    service = module.get<QuestionFlagService>(QuestionFlagService);
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    questionFlagRepository = module.get(getRepositoryToken(QuestionFlag));
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('flagQuestion', () => {
    it('should successfully flag a question', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGameRound) // Find question
        .mockResolvedValueOnce(null); // No existing flag
      
      mockQueryRunner.manager.create.mockReturnValue(mockFlag);
      mockQueryRunner.manager.save.mockResolvedValue(mockFlag);
      mockQueryRunner.manager.count.mockResolvedValue(1);

      const result = await service.flagQuestion(
        'question-123',
        'user-123',
        {
          questionId: 'question-123',
          reason: FlagReason.INAPPROPRIATE,
          details: 'Test flag',
        }
      );

      expect(result.success).toBe(true);
      expect(result.flagCount).toBe(1);
      expect(result.isFlagged).toBe(false);
      expect(result.isHidden).toBe(false);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.publishToGameJson).toHaveBeenCalled();
    });

    it('should throw error if question not found', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.flagQuestion(
          'nonexistent-question',
          'user-123',
          {
            questionId: 'nonexistent-question',
            reason: FlagReason.INAPPROPRIATE,
          }
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw error if user already flagged the question', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGameRound) // Find question
        .mockResolvedValueOnce(mockFlag); // Existing flag

      await expect(
        service.flagQuestion(
          'question-123',
          'user-123',
          {
            questionId: 'question-123',
            reason: FlagReason.INAPPROPRIATE,
          }
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should auto-flag question after 3 unique flags', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGameRound) // Find question
        .mockResolvedValueOnce(null); // No existing flag
      
      mockQueryRunner.manager.create.mockReturnValue(mockFlag);
      mockQueryRunner.manager.save.mockResolvedValue(mockFlag);
      mockQueryRunner.manager.count.mockResolvedValue(3); // 3 flags total

      const result = await service.flagQuestion(
        'question-123',
        'user-123',
        {
          questionId: 'question-123',
          reason: FlagReason.INAPPROPRIATE,
        }
      );

      expect(result.success).toBe(true);
      expect(result.flagCount).toBe(3);
      expect(result.isFlagged).toBe(true);
      expect(result.isHidden).toBe(true);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        GameRound,
        'question-123',
        expect.objectContaining({
          flagged: true,
          flagCount: 3,
        })
      );
    });

    it('should handle transaction rollback on error', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.flagQuestion(
          'question-123',
          'user-123',
          {
            questionId: 'question-123',
            reason: FlagReason.INAPPROPRIATE,
          }
        )
      ).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getQuestionFlags', () => {
    it('should return flags for a question', async () => {
      const mockFlags = [mockFlag];
      questionFlagRepository.find.mockResolvedValue(mockFlags);

      const result = await service.getQuestionFlags('question-123');

      expect(result).toEqual(mockFlags);
      expect(questionFlagRepository.find).toHaveBeenCalledWith({
        where: { questionId: 'question-123' },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('resolveFlag', () => {
    it('should successfully resolve a flag', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne.mockResolvedValue(mockFlag);
      mockQueryRunner.manager.count.mockResolvedValue(2); // 2 active flags after resolution

      await service.resolveFlag('flag-123', 'moderator-123', 'Resolved');

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        QuestionFlag,
        'flag-123',
        expect.objectContaining({
          isResolved: true,
          resolvedBy: 'moderator-123',
          resolution: 'Resolved',
        })
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should unflag question if flag count drops below threshold', async () => {
      const mockQueryRunner = dataSource.createQueryRunner();
      
      mockQueryRunner.manager.findOne.mockResolvedValue(mockFlag);
      mockQueryRunner.manager.count.mockResolvedValue(2); // Below threshold of 3

      await service.resolveFlag('flag-123', 'moderator-123', 'Resolved');

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        GameRound,
        'question-123',
        expect.objectContaining({
          flagged: false,
          flaggedAt: null,
        })
      );
    });
  });

  describe('getFlaggedQuestions', () => {
    it('should return flagged questions', async () => {
      const mockQuestions = [mockGameRound];
      gameRoundRepository.find.mockResolvedValue(mockQuestions);

      const result = await service.getFlaggedQuestions();

      expect(result).toEqual(mockQuestions);
      expect(gameRoundRepository.find).toHaveBeenCalledWith({
        where: { flagged: true },
        relations: ['createdBy', 'game'],
        order: { flaggedAt: 'DESC' },
      });
    });
  });

  describe('getFlagStatistics', () => {
    it('should return flag statistics', async () => {
      const mockCounts = [10, 5, 3, 7]; // total, flagged, resolved, pending
      
      questionFlagRepository.count
        .mockResolvedValueOnce(mockCounts[0]) // total
        .mockResolvedValueOnce(mockCounts[2]) // resolved
        .mockResolvedValueOnce(mockCounts[3]); // pending
      
      gameRoundRepository.count.mockResolvedValue(mockCounts[1]); // flagged

      const result = await service.getFlagStatistics();

      expect(result).toEqual({
        totalFlags: 10,
        flaggedQuestions: 5,
        resolvedFlags: 3,
        pendingFlags: 7,
      });
    });
  });
}); 