import { Test, TestingModule } from '@nestjs/testing';
import { ActionValidationService, ValidationContext } from './action-validation.service';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionType } from '../dto/player-action.dto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ActionValidationService', () => {
  let service: ActionValidationService;

  const mockRound = {
    id: 'round-1',
    gameId: 'game-1',
    status: RoundStatus.ACTIVE,
    roundData: {
      phase: 'reveal_gamble',
      playerActions: {},
      forceTargets: {},
      shieldedPlayers: {}
    },
    game: {
      gamePlayers: [
        { userId: 'player-1' },
        { userId: 'player-2' },
        { userId: 'player-3' }
      ]
    }
  };

  const mockContext: ValidationContext = {
    round: mockRound as any,
    playerId: 'player-1',
    playerGameId: 'game-1',
    roundData: mockRound.roundData
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionValidationService],
    }).compile();

    service = module.get<ActionValidationService>(ActionValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateRoundAccess', () => {
    it('should not throw when round belongs to player game', () => {
      expect(() => {
        service.validateRoundAccess(mockRound as any, 'game-1');
      }).not.toThrow();
    });

    it('should throw ForbiddenException when round does not belong to player game', () => {
      expect(() => {
        service.validateRoundAccess(mockRound as any, 'different-game');
      }).toThrow(ForbiddenException);
    });
  });

  describe('validateRoundStatus', () => {
    it('should not throw when round is active and in correct phase', () => {
      expect(() => {
        service.validateRoundStatus(mockRound as any);
      }).not.toThrow();
    });

    it('should throw BadRequestException when round is not active', () => {
      const inactiveRound = { ...mockRound, status: RoundStatus.PENDING };
      expect(() => {
        service.validateRoundStatus(inactiveRound as any);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when round is not in reveal_gamble phase', () => {
      const wrongPhaseRound = {
        ...mockRound,
        roundData: { ...mockRound.roundData, phase: 'wrong_phase' }
      };
      expect(() => {
        service.validateRoundStatus(wrongPhaseRound as any);
      }).toThrow(BadRequestException);
    });
  });

  describe('validatePlayerInGame', () => {
    it('should not throw when player is in game', () => {
      expect(() => {
        service.validatePlayerInGame(mockRound as any, 'player-1');
      }).not.toThrow();
    });

    it('should throw ForbiddenException when player is not in game', () => {
      expect(() => {
        service.validatePlayerInGame(mockRound as any, 'player-999');
      }).toThrow(ForbiddenException);
    });
  });

  describe('validateNoPreviousAction', () => {
    it('should not throw when player has not performed action', () => {
      expect(() => {
        service.validateNoPreviousAction(mockRound.roundData, 'player-1');
      }).not.toThrow();
    });

    it('should throw BadRequestException when player has already performed action', () => {
      const roundDataWithAction = {
        ...mockRound.roundData,
        playerActions: { 'player-1': { actionType: 'roll' } }
      };
      expect(() => {
        service.validateNoPreviousAction(roundDataWithAction, 'player-1');
      }).toThrow(BadRequestException);
    });
  });

  describe('validateAction', () => {
    it('should validate roll action successfully', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.ROLL
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).not.toThrow();
    });

    it('should validate force action with valid target', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-2'
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).not.toThrow();
    });

    it('should throw BadRequestException for force action without target', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.FORCE
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action targeting self', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-1'
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action targeting non-existent player', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-999'
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for force action targeting already forced player', () => {
      const roundDataWithForceTarget = {
        ...mockRound.roundData,
        forceTargets: { 'player-2': { forcedBy: 'player-3' } }
      };
      const contextWithForceTarget = { ...mockContext, roundData: roundDataWithForceTarget };

      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.FORCE,
        targetPlayerId: 'player-2'
      };

      expect(() => {
        service.validateAction(actionDto, contextWithForceTarget);
      }).toThrow(BadRequestException);
    });

    it('should validate shield action successfully', () => {
      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.SHIELD
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).not.toThrow();
    });

    it('should throw BadRequestException for shield action when already shielded', () => {
      const roundDataWithShield = {
        ...mockRound.roundData,
        shieldedPlayers: { 'player-1': { shieldedAt: new Date() } }
      };
      const contextWithShield = { ...mockContext, roundData: roundDataWithShield };

      const actionDto: PlayerActionDto = {
        actionType: PlayerActionType.SHIELD
      };

      expect(() => {
        service.validateAction(actionDto, contextWithShield);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid action type', () => {
      const actionDto: PlayerActionDto = {
        actionType: 'invalid' as PlayerActionType
      };

      expect(() => {
        service.validateAction(actionDto, mockContext);
      }).toThrow(BadRequestException);
    });
  });

  describe('validateCompleteContext', () => {
    it('should validate complete context successfully', () => {
      expect(() => {
        service.validateCompleteContext(mockContext);
      }).not.toThrow();
    });

    it('should throw error when round access is invalid', () => {
      const invalidContext = { ...mockContext, playerGameId: 'wrong-game' };
      expect(() => {
        service.validateCompleteContext(invalidContext);
      }).toThrow(ForbiddenException);
    });
  });

  describe('canPerformAction', () => {
    it('should return true when action can be performed', () => {
      const result = service.canPerformAction(mockRound as any, 'player-1', 'game-1');
      expect(result).toBe(true);
    });

    it('should return false when action cannot be performed', () => {
      const inactiveRound = { ...mockRound, status: RoundStatus.PENDING };
      const result = service.canPerformAction(inactiveRound as any, 'player-1', 'game-1');
      expect(result).toBe(false);
    });
  });
}); 