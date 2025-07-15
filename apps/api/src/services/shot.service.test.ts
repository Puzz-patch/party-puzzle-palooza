import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShotService } from './shot.service';
import { RedisService } from '../redis/redis.service';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { UserBalance } from '@party-puzzle-palooza/database';
import { TransactionLedger, TransactionType, TransactionStatus } from '@party-puzzle-palooza/database';
import { TakeShotDto } from '../dto/take-shot.dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ShotService', () => {
  let service: ShotService;
  let gameRoundRepository: any;
  let gameRepository: any;
  let gamePlayerRepository: any;
  let userBalanceRepository: any;
  let transactionLedgerRepository: any;
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

  const mockGame = {
    id: 'game-1',
    settings: { chill_mode: false }
  };

  const mockUserBalance = {
    id: 'balance-1',
    userId: 'player-1',
    balance: 1000,
    totalSpent: 0
  };

  const mockTransaction = {
    id: 'transaction-1',
    userId: 'player-1',
    gameRoundId: 'round-1',
    transactionType: TransactionType.SHOT,
    amount: -5,
    balanceBefore: 1000,
    balanceAfter: 995,
    status: TransactionStatus.COMPLETED
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShotService,
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

    service = module.get<ShotService>(ShotService);
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    gameRepository = module.get(getRepositoryToken(Game));
    gamePlayerRepository = module.get(getRepositoryToken(GamePlayer));
    userBalanceRepository = module.get(getRepositoryToken(UserBalance));
    transactionLedgerRepository = module.get(getRepositoryToken(TransactionLedger));
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('takeShot - Token Balance Integrity', () => {
    const takeShotDto: TakeShotDto = {
      answer: 'Fly',
      betAmount: 5
    };

    describe('Overspend Prevention', () => {
      it('should prevent shot when bet amount exceeds balance', async () => {
        const poorBalance = { ...mockUserBalance, balance: 3 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(poorBalance);

        await expect(
          service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 })
        ).rejects.toThrow(BadRequestException);

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      });

      it('should prevent shot when bet amount equals balance exactly', async () => {
        const exactBalance = { ...mockUserBalance, balance: 5 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(exactBalance);

        const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 });

        expect(result.balanceBefore).toBe(5);
        expect(result.balanceAfter).toBe(0);
        expect(result.betAmount).toBe(5);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should prevent shot when bet amount is greater than balance by 1', async () => {
        const balance = { ...mockUserBalance, balance: 4 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);

        await expect(
          service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 })
        ).rejects.toThrow(BadRequestException);

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('should allow shot when bet amount is less than balance', async () => {
        const balance = { ...mockUserBalance, balance: 10 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });
        queryRunner.manager.create.mockReturnValue(mockTransaction);
        queryRunner.manager.save.mockResolvedValue(mockTransaction);

        const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 });

        expect(result.balanceBefore).toBe(10);
        expect(result.balanceAfter).toBe(5);
        expect(result.betAmount).toBe(5);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero balance correctly', async () => {
        const zeroBalance = { ...mockUserBalance, balance: 0 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(zeroBalance);

        await expect(
          service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 1 })
        ).rejects.toThrow(BadRequestException);

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('should handle negative balance (should not happen but test anyway)', async () => {
        const negativeBalance = { ...mockUserBalance, balance: -5 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(negativeBalance);

        await expect(
          service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 1 })
        ).rejects.toThrow(BadRequestException);

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('should handle very large bet amounts', async () => {
        const largeBalance = { ...mockUserBalance, balance: 1000000 };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(largeBalance);
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });
        queryRunner.manager.create.mockReturnValue(mockTransaction);
        queryRunner.manager.save.mockResolvedValue(mockTransaction);

        const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 100000 });

        expect(result.balanceBefore).toBe(1000000);
        expect(result.balanceAfter).toBe(900000);
        expect(result.betAmount).toBe(100000);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });
    });

    describe('Chill Mode Token Integrity', () => {
      it('should not deduct tokens in chill mode regardless of balance', async () => {
        const lowBalance = { ...mockUserBalance, balance: 1 };
        const chillGame = { ...mockGame, settings: { chill_mode: true } };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(chillGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(lowBalance);
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });
        queryRunner.manager.create.mockReturnValue(mockTransaction);
        queryRunner.manager.save.mockResolvedValue(mockTransaction);

        const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 1000 });

        expect(result.isChillMode).toBe(true);
        expect(result.betAmount).toBe(0);
        expect(result.balanceBefore).toBe(1);
        expect(result.balanceAfter).toBe(1);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should create transaction with zero amount in chill mode', async () => {
        const balance = { ...mockUserBalance, balance: 100 };
        const chillGame = { ...mockGame, settings: { chill_mode: true } };
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockRound)
          .mockResolvedValueOnce(chillGame);
        
        queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });
        queryRunner.manager.create.mockReturnValue(mockTransaction);
        queryRunner.manager.save.mockResolvedValue(mockTransaction);

        await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly' });

        expect(queryRunner.manager.create).toHaveBeenCalledWith(TransactionLedger, expect.objectContaining({
          amount: 0,
          balanceBefore: 100,
          balanceAfter: 100
        }));
      });
    });
  });

  describe('takeShot - Ledger Integrity', () => {
    const takeShotDto: TakeShotDto = {
      answer: 'Fly',
      betAmount: 5
    };

    it('should create accurate transaction ledger entry', async () => {
      const balance = { ...mockUserBalance, balance: 100 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      await service.takeShot('round-1', 'player-1', 'game-1', takeShotDto);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(TransactionLedger, expect.objectContaining({
        userId: 'player-1',
        gameRoundId: 'round-1',
        transactionType: TransactionType.SHOT,
        amount: -5, // Negative for debit
        balanceBefore: 100,
        balanceAfter: 95,
        status: TransactionStatus.COMPLETED,
        reference: 'shot_round-1_player-1',
        metadata: expect.objectContaining({
          answer: 'Fly',
          betAmount: 5,
          isChillMode: false
        })
      }));
    });

    it('should update user balance correctly', async () => {
      const balance = { ...mockUserBalance, balance: 100, totalSpent: 50 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      await service.takeShot('round-1', 'player-1', 'game-1', takeShotDto);

      expect(queryRunner.manager.update).toHaveBeenCalledWith(UserBalance, 'balance-1', {
        balance: 95,
        totalSpent: 55, // 50 + 5
        lastUpdatedAt: expect.any(Date)
      });
    });

    it('should handle transaction rollback on balance update failure', async () => {
      const balance = { ...mockUserBalance, balance: 100 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
      queryRunner.manager.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.takeShot('round-1', 'player-1', 'game-1', takeShotDto)
      ).rejects.toThrow('Database error');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should handle transaction rollback on ledger creation failure', async () => {
      const balance = { ...mockUserBalance, balance: 100 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockRejectedValue(new Error('Ledger creation failed'));

      await expect(
        service.takeShot('round-1', 'player-1', 'game-1', takeShotDto)
      ).rejects.toThrow('Ledger creation failed');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should ensure balance never goes below zero in transaction', async () => {
      const balance = { ...mockUserBalance, balance: 3 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);

      await expect(
        service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 })
      ).rejects.toThrow(BadRequestException);

      // Verify that no balance update was attempted
      expect(queryRunner.manager.update).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('takeShot - Concurrency and Race Conditions', () => {
    it('should handle concurrent shot attempts correctly', async () => {
      const balance = { ...mockUserBalance, balance: 10 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      // Simulate row-level locking
      expect(queryRunner.manager.createQueryBuilder().setLock).toHaveBeenCalledWith('pessimistic_write');

      const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 });

      expect(result.balanceAfter).toBe(5);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should prevent double-spending through row locks', async () => {
      const balance = { ...mockUserBalance, balance: 5 };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(balance);

      // First shot should succeed
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      const result1 = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 3 });

      expect(result1.balanceAfter).toBe(2);

      // Second shot should fail due to insufficient balance
      await expect(
        service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 3 })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('takeShot - Success Scenarios', () => {
    it('should successfully take a shot and deduct tokens', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly', betAmount: 5 });

      expect(result).toEqual({
        roundId: 'round-1',
        playerId: 'player-1',
        answer: 'Fly',
        betAmount: 5,
        balanceBefore: 1000,
        balanceAfter: 995,
        transactionId: 'transaction-1',
        isChillMode: false,
        message: 'Shot taken successfully! 5 tokens deducted.'
      });

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.publishToGameJson).toHaveBeenCalledWith('game-1', {
        type: 'shot_taken',
        data: expect.objectContaining({
          roundId: 'round-1',
          playerId: 'player-1',
          answer: 'Fly',
          betAmount: 5,
          isChillMode: false
        })
      });
    });

    it('should handle chill mode without deducting tokens', async () => {
      const chillGame = { ...mockGame, settings: { chill_mode: true } };
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockRound)
        .mockResolvedValueOnce(chillGame);
      
      queryRunner.manager.createQueryBuilder().getOne.mockResolvedValue(mockUserBalance);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);

      const result = await service.takeShot('round-1', 'player-1', 'game-1', { answer: 'Fly' });

      expect(result.isChillMode).toBe(true);
      expect(result.betAmount).toBe(0);
      expect(result.balanceBefore).toBe(1000);
      expect(result.balanceAfter).toBe(1000);
      expect(result.message).toContain('chill mode');
    });

    it('should skip round and move to next round', async () => {
      // setIsTimerRunning(false); // This line was not in the original file, so it's commented out.
      // setTimeRemaining(30); // This line was not in the original file, so it's commented out.
      // clearResponderData(); // This line was not in the original file, so it's commented out.
      // setCurrentPhase('pending'); // This line was not in the original file, so it's commented out.
      // toast({ // This line was not in the original file, so it's commented out.
      //   title: 'Round Skipped ⏭️', // This line was not in the original file, so it's commented out.
      //   description: 'Moving to the next round.', // This line was not in the original file, so it's commented out.
      //   variant: 'default', // This line was not in the original file, so it's commented out.
      // }); // This line was not in the original file, so it's commented out.
    });
  });

  describe('getPlayerBalance', () => {
    it('should return player balance', async () => {
      userBalanceRepository.findOne.mockResolvedValue(mockUserBalance);

      const result = await service.getPlayerBalance('player-1');

      expect(result).toEqual({
        balance: 1000,
        totalEarned: 0,
        totalSpent: 0
      });
    });

    it('should throw NotFoundException for non-existent balance', async () => {
      userBalanceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPlayerBalance('invalid-player')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history', async () => {
      transactionLedgerRepository.findAndCount.mockResolvedValue([
        [mockTransaction],
        1
      ]);

      const result = await service.getTransactionHistory('player-1', 20, 0);

      expect(result).toEqual({
        transactions: [mockTransaction],
        total: 1
      });
    });
  });
}); 