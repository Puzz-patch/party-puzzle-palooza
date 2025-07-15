import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinaleService } from './finale.service';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../gateway/game.gateway';
import { Game, GameStatus, GameRound, RoundStatus, GamePlayer, UserBalance, TransactionLedger } from '@party-puzzle-palooza/database';

describe('FinaleService', () => {
  let service: FinaleService;
  let mockGameRepository: any;
  let mockGameRoundRepository: any;
  let mockGamePlayerRepository: any;
  let mockUserBalanceRepository: any;
  let mockTransactionLedgerRepository: any;
  let mockDataSource: any;
  let mockRedisService: any;
  let mockGameGateway: any;

  const mockGame = {
    id: 'game-1',
    name: 'Test Game',
    code: 'TEST123',
    status: GameStatus.PLAYING,
    gamePlayers: [
      {
        userId: 'player-1',
        score: 100,
        correctAnswers: 3,
        totalAnswers: 5,
        user: {
          id: 'player-1',
          username: 'player1',
          firstName: 'John',
          lastName: 'Doe'
        }
      },
      {
        userId: 'player-2',
        score: 150,
        correctAnswers: 4,
        totalAnswers: 5,
        user: {
          id: 'player-2',
          username: 'player2',
          firstName: 'Jane',
          lastName: 'Smith'
        }
      }
    ],
    gameRounds: [
      {
        id: 'round-1',
        status: RoundStatus.FINISHED,
        createdById: 'player-1',
        results: {
          'player-1': { score: 50, correct: true, answered: true },
          'player-2': { score: 75, correct: true, answered: true }
        }
      },
      {
        id: 'round-2',
        status: RoundStatus.FINISHED,
        createdById: 'player-2',
        results: {
          'player-1': { score: 50, correct: true, answered: true },
          'player-2': { score: 75, correct: true, answered: true }
        }
      },
      {
        id: 'round-3',
        status: RoundStatus.PENDING,
        createdById: 'player-1'
      },
      {
        id: 'round-4',
        status: RoundStatus.PENDING,
        createdById: 'player-2'
      }
    ]
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
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner)
    };

    mockGameRepository = {
      findOne: jest.fn()
    };

    mockGameRoundRepository = {
      find: jest.fn()
    };

    mockGamePlayerRepository = {
      find: jest.fn()
    };

    mockUserBalanceRepository = {
      findOne: jest.fn(),
      save: jest.fn()
    };

    mockTransactionLedgerRepository = {
      create: jest.fn(),
      save: jest.fn()
    };

    mockRedisService = {
      publishToGameJson: jest.fn()
    };

    mockGameGateway = {
      broadcastToGame: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinaleService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository
        },
        {
          provide: getRepositoryToken(GameRound),
          useValue: mockGameRoundRepository
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository
        },
        {
          provide: getRepositoryToken(UserBalance),
          useValue: mockUserBalanceRepository
        },
        {
          provide: getRepositoryToken(TransactionLedger),
          useValue: mockTransactionLedgerRepository
        },
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        {
          provide: RedisService,
          useValue: mockRedisService
        },
        {
          provide: GameGateway,
          useValue: mockGameGateway
        }
      ]
    }).compile();

    service = module.get<FinaleService>(FinaleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('finalizeGame', () => {
    it('should successfully finalize a game with valid deck usage', async () => {
      // Mock successful deck usage check (50% used)
      const mockGameWithValidUsage = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED, createdById: 'player-1' },
          { status: RoundStatus.FINISHED, createdById: 'player-2' },
          { status: RoundStatus.PENDING, createdById: 'player-1' },
          { status: RoundStatus.PENDING, createdById: 'player-2' }
        ]
      };

      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(mockGameWithValidUsage);
      mockUserBalanceRepository.findOne.mockResolvedValue({ balance: 10, userId: 'player-1' });
      mockUserBalanceRepository.save.mockResolvedValue({ balance: 12, userId: 'player-1' });
      mockTransactionLedgerRepository.create.mockReturnValue({ id: 'tx-1' });
      mockTransactionLedgerRepository.save.mockResolvedValue({ id: 'tx-1' });

      const result = await service.finalizeGame('game-1');

      expect(result.gameId).toBe('game-1');
      expect(result.deckUsageRequirementMet).toBe(true);
      expect(result.deckUsagePercentage).toBe(50);
      expect(result.winner).toBeDefined();
      expect(result.playerScores).toHaveLength(2);
      expect(result.totalUnusedPromptTokens).toBeGreaterThan(0);
    });

    it('should throw error when deck usage is below 50%', async () => {
      // Mock insufficient deck usage (25% used)
      const mockGameWithLowUsage = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED, createdById: 'player-1' },
          { status: RoundStatus.PENDING, createdById: 'player-1' },
          { status: RoundStatus.PENDING, createdById: 'player-2' },
          { status: RoundStatus.PENDING, createdById: 'player-2' }
        ]
      };

      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(mockGameWithLowUsage);

      await expect(service.finalizeGame('game-1')).rejects.toThrow(
        'Deck usage requirement not met. Used 25% of questions, minimum 50% required.'
      );
    });

    it('should throw error when game is already finalized', async () => {
      const finalizedGame = { ...mockGame, status: GameStatus.FINISHED };
      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(finalizedGame);

      await expect(service.finalizeGame('game-1')).rejects.toThrow('Game is already finalized');
    });

    it('should throw error when game not found', async () => {
      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(null);

      await expect(service.finalizeGame('game-1')).rejects.toThrow('Game not found');
    });

    it('should correctly compute final scores and ranks', async () => {
      const mockGameWithScores = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED, createdById: 'player-1' },
          { status: RoundStatus.FINISHED, createdById: 'player-2' }
        ]
      };

      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(mockGameWithScores);
      mockUserBalanceRepository.findOne.mockResolvedValue({ balance: 10, userId: 'player-1' });
      mockUserBalanceRepository.save.mockResolvedValue({ balance: 12, userId: 'player-1' });
      mockTransactionLedgerRepository.create.mockReturnValue({ id: 'tx-1' });
      mockTransactionLedgerRepository.save.mockResolvedValue({ id: 'tx-1' });

      const result = await service.finalizeGame('game-1');

      expect(result.playerScores).toHaveLength(2);
      expect(result.playerScores[0].rank).toBe(1); // Winner
      expect(result.playerScores[1].rank).toBe(2); // Runner-up
      expect(result.winner.finalScore).toBeGreaterThan(result.playerScores[1].finalScore);
    });

    it('should grant unused prompt tokens correctly', async () => {
      const mockGameWithUnusedQuestions = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED, createdById: 'player-1' },
          { status: RoundStatus.FINISHED, createdById: 'player-2' },
          { status: RoundStatus.PENDING, createdById: 'player-1' }, // Unused
          { status: RoundStatus.PENDING, createdById: 'player-2' }  // Unused
        ]
      };

      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(mockGameWithUnusedQuestions);
      mockUserBalanceRepository.findOne.mockResolvedValue({ balance: 10, userId: 'player-1' });
      mockUserBalanceRepository.save.mockResolvedValue({ balance: 12, userId: 'player-1' });
      mockTransactionLedgerRepository.create.mockReturnValue({ id: 'tx-1' });
      mockTransactionLedgerRepository.save.mockResolvedValue({ id: 'tx-1' });

      const result = await service.finalizeGame('game-1');

      expect(result.totalUnusedPromptTokens).toBe(2); // 1 unused per player
      expect(result.playerScores[0].unusedPromptTokens).toBe(1);
      expect(result.playerScores[1].unusedPromptTokens).toBe(1);
    });

    it('should broadcast finale event after successful finalization', async () => {
      const mockGameWithValidUsage = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED, createdById: 'player-1' },
          { status: RoundStatus.FINISHED, createdById: 'player-2' }
        ]
      };

      mockDataSource.createQueryRunner().manager.findOne.mockResolvedValue(mockGameWithValidUsage);
      mockUserBalanceRepository.findOne.mockResolvedValue({ balance: 10, userId: 'player-1' });
      mockUserBalanceRepository.save.mockResolvedValue({ balance: 12, userId: 'player-1' });
      mockTransactionLedgerRepository.create.mockReturnValue({ id: 'tx-1' });
      mockTransactionLedgerRepository.save.mockResolvedValue({ id: 'tx-1' });

      await service.finalizeGame('game-1');

      expect(mockGameGateway.broadcastToGame).toHaveBeenCalledWith('game-1', expect.objectContaining({
        type: 'game_finale',
        gameId: 'game-1'
      }));
      expect(mockRedisService.publishToGameJson).toHaveBeenCalledWith('game-1', expect.objectContaining({
        type: 'game_finale',
        gameId: 'game-1'
      }));
    });

    it('should handle database transaction rollback on error', async () => {
      mockDataSource.createQueryRunner().manager.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.finalizeGame('game-1')).rejects.toThrow('Database error');

      const mockQueryRunner = mockDataSource.createQueryRunner();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('checkDeckUsage', () => {
    it('should calculate deck usage correctly', async () => {
      const gameWithMixedRounds = {
        ...mockGame,
        gameRounds: [
          { status: RoundStatus.FINISHED },
          { status: RoundStatus.FINISHED },
          { status: RoundStatus.PENDING },
          { status: RoundStatus.PENDING }
        ]
      };

      const result = await service['checkDeckUsage'](gameWithMixedRounds);

      expect(result.usagePercentage).toBe(50);
      expect(result.requirementMet).toBe(true);
      expect(result.usedQuestions).toBe(2);
      expect(result.totalQuestions).toBe(4);
    });

    it('should handle edge case with no questions', async () => {
      const gameWithNoRounds = {
        ...mockGame,
        gameRounds: []
      };

      const result = await service['checkDeckUsage'](gameWithNoRounds);

      expect(result.usagePercentage).toBe(0);
      expect(result.requirementMet).toBe(false);
      expect(result.usedQuestions).toBe(0);
      expect(result.totalQuestions).toBe(0);
    });
  });

  describe('computeFinalScores', () => {
    it('should calculate scores correctly with round results', async () => {
      const gameWithResults = {
        ...mockGame,
        gameRounds: [
          {
            status: RoundStatus.FINISHED,
            results: {
              'player-1': { score: 50, correct: true, answered: true },
              'player-2': { score: 75, correct: true, answered: true }
            }
          }
        ]
      };

      const result = await service['computeFinalScores'](gameWithResults);

      expect(result).toHaveLength(2);
      expect(result[0].finalScore).toBe(150); // 100 base + 50 from round
      expect(result[1].finalScore).toBe(225); // 150 base + 75 from round
      expect(result[0].correctAnswers).toBe(4); // 3 base + 1 from round
      expect(result[1].correctAnswers).toBe(5); // 4 base + 1 from round
    });

    it('should assign ranks correctly based on scores', async () => {
      const gameWithResults = {
        ...mockGame,
        gameRounds: []
      };

      const result = await service['computeFinalScores'](gameWithResults);

      expect(result[0].rank).toBe(1); // Higher score
      expect(result[1].rank).toBe(2); // Lower score
      expect(result[0].finalScore).toBeGreaterThan(result[1].finalScore);
    });
  });
}); 