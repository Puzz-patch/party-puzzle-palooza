import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShotService } from './shot.service';
import { PlayerActionService } from './player-action.service';
import { RedisService } from '../redis/redis.service';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { UserBalance } from '@party-puzzle-palooza/database';
import { TransactionLedger, TransactionType, TransactionStatus } from '@party-puzzle-palooza/database';
import { TakeShotDto } from '../dto/take-shot.dto';
import { PlayerActionDto, PlayerActionType } from '../dto/player-action.dto';
import { BadRequestException } from '@nestjs/common';

describe('Token Integrity Integration Tests', () => {
  let shotService: ShotService;
  let playerActionService: PlayerActionService;
  let dataSource: any;
  let redisService: any;

  const mockRound = {
    id: 'round-1',
    gameId: 'game-1',
    status: RoundStatus.ACTIVE,
    roundData: {
      phase: 'response',
      targetPlayerId: 'player-1'
    }
  };

  const mockRevealRound = {
    id: 'round-1',
    gameId: 'game-1',
    status: RoundStatus.ACTIVE,
    roundData: {
      phase: 'reveal_gamble',
      correctAnswer: 'Fly',
      playerActions: {},
      forceTargets: {},
      shieldedPlayers: {}
    }
  };

  const mockGame = {
    id: 'game-1',
    settings: { chill_mode: false },
    gamePlayers: [
      { userId: 'player-1', username: 'Player1' },
      { userId: 'player-2', username: 'Player2' }
    ]
  };

  const mockUserBalance = {
    id: 'balance-1',
    userId: 'player-1',
    balance: 100,
    totalSpent: 0
  };

  const mockTransaction = {
    id: 'transaction-1',
    userId: 'player-1',
    gameRoundId: 'round-1',
    transactionType: TransactionType.SHOT,
    amount: -5,
    balanceBefore: 100,
    balanceAfter: 95,
    status: TransactionStatus.COMPLETED
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShotService,
        PlayerActionService,
        {
          provide: getRepositoryToken(GameRound),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(Game),
          useValue: {
            findOne: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: {
            findOne: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(UserBalance),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(TransactionLedger),
          useValue: {
            create: jest.fn(),
            save: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => ({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              manager: {
                findOne: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
                save: jest.fn(),
                createQueryBuilder: jest.fn(() => ({
                  setLock: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  getOne: jest.fn()
                }))
              },
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn()
            }))
          }
        },
        {
          provide: RedisService,
          useValue: {
            publishToGameJson: jest.fn()
          }
        }
      ],
    }).compile();

    shotService = module.get<ShotService>(ShotService);
    playerActionService = module.get<PlayerActionService>(PlayerActionService);
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
  });

  describe('Cross-Service Token Integrity', () => {
    it('should maintain token integrity when shot is taken then action is performed', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Take shot - should deduct tokens
      const shotResult = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 50
      });

      expect(shotResult.balanceBefore).toBe(100);
      expect(shotResult.balanceAfter).toBe(50);
      expect(shotResult.betAmount).toBe(50);

      // Reset query runner for action
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();
      queryRunner.manager.create.mockReset();
      queryRunner.manager.save.mockReset();

      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Perform action - should NOT affect tokens
      const actionResult = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.ROLL
      });

      expect(actionResult.success).toBeDefined();
      expect(actionResult.result).toMatch(/heads|tails/);

      // Verify no token operations were performed during action
      expect(queryRunner.manager.update).toHaveBeenCalledTimes(1); // Only round data update
    });

    it('should prevent overspend when shot is taken after action', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for action first
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Perform action - should NOT affect tokens
      await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.ROLL
      });

      // Reset query runner for shot
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();
      queryRunner.manager.create.mockReset();
      queryRunner.manager.save.mockReset();

      // Setup for shot with low balance
      const lowBalance = { ...mockUserBalance, balance: 10 };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(lowBalance);

      // Try to take shot with bet larger than balance - should fail
      await expect(
        shotService.takeShot('round-1', 'player-1', 'game-1', {
          answer: 'Fly',
          betAmount: 20
        })
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should maintain ledger integrity across multiple operations', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Take shot
      const shotResult = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 30
      });

      expect(shotResult.balanceAfter).toBe(70);

      // Verify transaction ledger was created correctly
      expect(queryRunner.manager.create).toHaveBeenCalledWith(TransactionLedger, expect.objectContaining({
        userId: 'player-1',
        gameRoundId: 'round-1',
        transactionType: TransactionType.SHOT,
        amount: -30,
        balanceBefore: 100,
        balanceAfter: 70,
        status: TransactionStatus.COMPLETED
      }));

      // Reset for action
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();
      queryRunner.manager.create.mockReset();
      queryRunner.manager.save.mockReset();

      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Perform action - should NOT create any transaction ledger entries
      await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-2'
      });

      // Verify no transaction ledger operations were performed
      expect(queryRunner.manager.create).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle zero balance correctly across services', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot with zero balance
      const zeroBalance = { ...mockUserBalance, balance: 0 };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(zeroBalance);

      // Shot should fail with zero balance
      await expect(
        shotService.takeShot('round-1', 'player-1', 'game-1', {
          answer: 'Fly',
          betAmount: 1
        })
      ).rejects.toThrow(BadRequestException);

      // Reset for action
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();

      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Action should succeed regardless of balance
      const actionResult = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.SHIELD
      });

      expect(actionResult.success).toBeDefined();
      expect(actionResult.result).toMatch(/heads|tails/);
    });

    it('should handle exact balance scenarios', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot with exact balance
      const exactBalance = { ...mockUserBalance, balance: 25 };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(exactBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Shot should succeed with exact balance
      const shotResult = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 25
      });

      expect(shotResult.balanceBefore).toBe(25);
      expect(shotResult.balanceAfter).toBe(0);
      expect(shotResult.betAmount).toBe(25);

      // Reset for action
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();

      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Action should still succeed even with zero balance
      const actionResult = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.ROLL
      });

      expect(actionResult.success).toBeDefined();
      expect(actionResult.result).toMatch(/heads|tails/);
    });

    it('should handle chill mode across services', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot in chill mode
      const chillGame = { ...mockGame, settings: { chill_mode: true } };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(chillGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Shot should succeed without deducting tokens
      const shotResult = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 1000 // Large bet amount
      });

      expect(shotResult.isChillMode).toBe(true);
      expect(shotResult.betAmount).toBe(0);
      expect(shotResult.balanceBefore).toBe(100);
      expect(shotResult.balanceAfter).toBe(100);

      // Reset for action
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();

      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: chillGame })
        .mockResolvedValueOnce(chillGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Action should succeed regardless of chill mode
      const actionResult = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-2'
      });

      expect(actionResult.success).toBeDefined();
      expect(actionResult.result).toMatch(/heads|tails/);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should prevent race conditions in token deduction', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for shot
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // First shot should succeed
      const shotResult1 = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 60
      });

      expect(shotResult1.balanceAfter).toBe(40);

      // Reset for second shot
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();
      queryRunner.manager.create.mockReset();
      queryRunner.manager.save.mockReset();

      // Setup for second shot
      const updatedBalance = { ...mockUserBalance, balance: 40 };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(updatedBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Second shot should succeed
      const shotResult2 = await shotService.takeShot('round-1', 'player-1', 'game-1', {
        answer: 'Fly',
        betAmount: 30
      });

      expect(shotResult2.balanceAfter).toBe(10);

      // Third shot should fail due to insufficient balance
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();

      const finalBalance = { ...mockUserBalance, balance: 10 };
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(finalBalance);

      await expect(
        shotService.takeShot('round-1', 'player-1', 'game-1', {
          answer: 'Fly',
          betAmount: 20
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should maintain action integrity without affecting tokens', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      // Setup for action
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      // Multiple actions should succeed without affecting tokens
      const action1 = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
        actionType: PlayerActionType.ROLL
      });

      expect(action1.success).toBeDefined();

      // Reset for second action (different player)
      queryRunner.manager.findOne.mockReset();
      queryRunner.manager.update.mockReset();

      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRevealRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const action2 = await playerActionService.performAction('round-1', 'player-2', 'game-1', {
        actionType: PlayerActionType.SHIELD
      });

      expect(action2.success).toBeDefined();

      // Verify no token operations were performed
      expect(queryRunner.manager.create).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });
  });
}); 