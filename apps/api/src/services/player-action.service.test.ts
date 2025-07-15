import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlayerActionService } from './player-action.service';
import { RedisService } from '../redis/redis.service';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionType } from '../dto/player-action.dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('PlayerActionService', () => {
  let service: PlayerActionService;
  let gameRoundRepository: any;
  let gameRepository: any;
  let gamePlayerRepository: any;
  let dataSource: any;
  let redisService: any;

  const mockRound = {
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
    gamePlayers: [
      { userId: 'player-1', username: 'Player1' },
      { userId: 'player-2', username: 'Player2' }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => ({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              manager: {
                findOne: jest.fn(),
                update: jest.fn()
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

    service = module.get<PlayerActionService>(PlayerActionService);
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    gameRepository = module.get(getRepositoryToken(Game));
    gamePlayerRepository = module.get(getRepositoryToken(GamePlayer));
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('performAction - Token Balance Integrity', () => {
    const rollAction: PlayerActionDto = {
      actionType: PlayerActionType.ROLL
    };

    const forceAction: PlayerActionDto = {
      actionType: PlayerActionType.FORCE,
      targetPlayerId: 'player-2'
    };

    const shieldAction: PlayerActionDto = {
      actionType: PlayerActionType.SHIELD
    };

    describe('No Token Deduction', () => {
      it('should not affect token balances for roll action', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        const result = await service.performAction('round-1', 'player-1', 'game-1', rollAction);

        expect(result).toEqual({
          roundId: 'round-1',
          playerId: 'player-1',
          actionType: PlayerActionType.ROLL,
          success: expect.any(Boolean),
          result: expect.stringMatching(/heads|tails/),
          message: expect.any(String),
          roundStatePatch: expect.objectContaining({
            phase: 'reveal_gamble',
            playerActions: expect.objectContaining({
              'player-1': expect.objectContaining({
                actionType: PlayerActionType.ROLL
              })
            })
          })
        });

        // Verify no token-related operations were performed
        expect(queryRunner.manager.update).toHaveBeenCalledTimes(1); // Only round data update
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should not affect token balances for force action', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        const result = await service.performAction('round-1', 'player-1', 'game-1', forceAction);

        expect(result).toEqual({
          roundId: 'round-1',
          playerId: 'player-1',
          actionType: PlayerActionType.FORCE,
          success: expect.any(Boolean),
          targetPlayerId: 'player-2',
          result: expect.stringMatching(/heads|tails/),
          message: expect.any(String),
          roundStatePatch: expect.objectContaining({
            phase: 'reveal_gamble',
            playerActions: expect.objectContaining({
              'player-1': expect.objectContaining({
                actionType: PlayerActionType.FORCE,
                targetPlayerId: 'player-2'
              })
            })
          })
        });

        // Verify no token-related operations were performed
        expect(queryRunner.manager.update).toHaveBeenCalledTimes(1); // Only round data update
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should not affect token balances for shield action', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        const result = await service.performAction('round-1', 'player-1', 'game-1', shieldAction);

        expect(result).toEqual({
          roundId: 'round-1',
          playerId: 'player-1',
          actionType: PlayerActionType.SHIELD,
          success: expect.any(Boolean),
          result: expect.stringMatching(/heads|tails/),
          message: expect.any(String),
          roundStatePatch: expect.objectContaining({
            phase: 'reveal_gamble',
            playerActions: expect.objectContaining({
              'player-1': expect.objectContaining({
                actionType: PlayerActionType.SHIELD
              })
            })
          })
        });

        // Verify no token-related operations were performed
        expect(queryRunner.manager.update).toHaveBeenCalledTimes(1); // Only round data update
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });
    });

    describe('Action Validation Without Token Checks', () => {
      it('should validate actions without checking token balances', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        // Should succeed regardless of player's token balance
        const result = await service.performAction('round-1', 'player-1', 'game-1', rollAction);

        expect(result.success).toBeDefined();
        expect(result.result).toMatch(/heads|tails/);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should not query user balance for any action', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        await service.performAction('round-1', 'player-1', 'game-1', rollAction);

        // Verify no balance-related queries were made
        expect(queryRunner.manager.findOne).toHaveBeenCalledTimes(2); // Round and Game only
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });
    });

    describe('Transaction Integrity', () => {
      it('should rollback on round data update failure', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockRejectedValue(new Error('Round update failed'));

        await expect(
          service.performAction('round-1', 'player-1', 'game-1', rollAction)
        ).rejects.toThrow('Round update failed');

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      });

      it('should handle coin-flip randomness consistently', async () => {
        const queryRunner = dataSource.createQueryRunner();
        
        queryRunner.manager.findOne
          .mockResolvedValueOnce({ ...mockRound, game: mockGame })
          .mockResolvedValueOnce(mockGame);
        
        queryRunner.manager.update.mockResolvedValue({ affected: 1 });

        const result = await service.performAction('round-1', 'player-1', 'game-1', rollAction);

        expect(result.success).toBeDefined();
        expect(result.result).toMatch(/heads|tails/);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });
    });
  });

  describe('performAction - General Functionality', () => {
    const rollAction: PlayerActionDto = {
      actionType: PlayerActionType.ROLL
    };

    const forceAction: PlayerActionDto = {
      actionType: PlayerActionType.FORCE,
      targetPlayerId: 'player-2'
    };

    const shieldAction: PlayerActionDto = {
      actionType: PlayerActionType.SHIELD
    };

    it('should successfully perform a roll action', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const result = await service.performAction('round-1', 'player-1', 'game-1', rollAction);

      expect(result).toEqual({
        roundId: 'round-1',
        playerId: 'player-1',
        actionType: PlayerActionType.ROLL,
        success: expect.any(Boolean),
        result: expect.stringMatching(/heads|tails/),
        message: expect.any(String),
        roundStatePatch: expect.objectContaining({
          phase: 'reveal_gamble',
          playerActions: expect.objectContaining({
            'player-1': expect.objectContaining({
              actionType: PlayerActionType.ROLL
            })
          })
        })
      });

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.publishToGameJson).toHaveBeenCalledWith('game-1', {
        type: 'action_performed',
        data: expect.objectContaining({
          roundId: 'round-1',
          playerId: 'player-1',
          actionType: PlayerActionType.ROLL
        })
      });
    });

    it('should successfully perform a force action', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const result = await service.performAction('round-1', 'player-1', 'game-1', forceAction);

      expect(result).toEqual({
        roundId: 'round-1',
        playerId: 'player-1',
        actionType: PlayerActionType.FORCE,
        success: expect.any(Boolean),
        targetPlayerId: 'player-2',
        result: expect.stringMatching(/heads|tails/),
        message: expect.any(String),
        roundStatePatch: expect.objectContaining({
          phase: 'reveal_gamble',
          playerActions: expect.objectContaining({
            'player-1': expect.objectContaining({
              actionType: PlayerActionType.FORCE,
              targetPlayerId: 'player-2'
            })
          })
        })
      });
    });

    it('should successfully perform a shield action', async () => {
      const queryRunner = dataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockRound, game: mockGame })
        .mockResolvedValueOnce(mockGame);
      
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      const result = await service.performAction('round-1', 'player-1', 'game-1', shieldAction);

      expect(result).toEqual({
        roundId: 'round-1',
        playerId: 'player-1',
        actionType: PlayerActionType.SHIELD,
        success: expect.any(Boolean),
        result: expect.stringMatching(/heads|tails/),
        message: expect.any(String),
        roundStatePatch: expect.objectContaining({
          phase: 'reveal_gamble',
          playerActions: expect.objectContaining({
            'player-1': expect.objectContaining({
              actionType: PlayerActionType.SHIELD
            })
          })
        })
      });
    });

    it('should throw NotFoundException for non-existent round', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.performAction('invalid-round', 'player-1', 'game-1', rollAction)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong game', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'wrong-game', rollAction)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for inactive round', async () => {
      const inactiveRound = { ...mockRound, status: RoundStatus.FINISHED };
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...inactiveRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', rollAction)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong phase', async () => {
      const wrongPhaseRound = {
        ...mockRound,
        roundData: { ...mockRound.roundData, phase: 'response' }
      };
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...wrongPhaseRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', rollAction)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for player not in game', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'invalid-player', 'game-1', rollAction)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for duplicate action', async () => {
      const roundWithAction = {
        ...mockRound,
        roundData: {
          ...mockRound.roundData,
          playerActions: { 'player-1': { actionType: PlayerActionType.ROLL } }
        }
      };
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...roundWithAction, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', rollAction)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action without target', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', { actionType: PlayerActionType.FORCE })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action on self', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', {
          actionType: PlayerActionType.FORCE,
          targetPlayerId: 'player-1'
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action on invalid target', async () => {
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', {
          actionType: PlayerActionType.FORCE,
          targetPlayerId: 'invalid-target'
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action on already forced target', async () => {
      const roundWithForcedTarget = {
        ...mockRound,
        roundData: {
          ...mockRound.roundData,
          forceTargets: { 'player-2': { forcedBy: 'player-3' } }
        }
      };
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...roundWithForcedTarget, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', {
          actionType: PlayerActionType.FORCE,
          targetPlayerId: 'player-2'
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for shield action on already shielded player', async () => {
      const roundWithShieldedPlayer = {
        ...mockRound,
        roundData: {
          ...mockRound.roundData,
          shieldedPlayers: { 'player-1': { shieldedAt: new Date().toISOString() } }
        }
      };
      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue({ ...roundWithShieldedPlayer, game: mockGame });

      await expect(
        service.performAction('round-1', 'player-1', 'game-1', shieldAction)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRoundActions', () => {
    it('should return round actions', async () => {
      const roundWithActions = {
        ...mockRound,
        roundData: {
          ...mockRound.roundData,
          playerActions: {
            'player-1': { actionType: PlayerActionType.ROLL, success: true }
          }
        }
      };

      gameRoundRepository.findOne.mockResolvedValue({ ...roundWithActions, game: mockGame });

      const result = await service.getRoundActions('round-1', 'game-1');

      expect(result).toEqual({
        roundId: 'round-1',
        phase: 'reveal_gamble',
        playerActions: {
          'player-1': { actionType: PlayerActionType.ROLL, success: true }
        },
        actionResults: {},
        forceTargets: {},
        shieldedPlayers: {},
        remainingActions: 0
      });
    });

    it('should throw NotFoundException for non-existent round', async () => {
      gameRoundRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getRoundActions('invalid-round', 'game-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong game', async () => {
      gameRoundRepository.findOne.mockResolvedValue({ ...mockRound, game: mockGame });

      await expect(
        service.getRoundActions('round-1', 'wrong-game')
      ).rejects.toThrow(ForbiddenException);
    });
  });
}); 