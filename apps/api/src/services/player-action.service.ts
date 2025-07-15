import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionResponseDto, PlayerActionType, ActionConstants } from '../dto/player-action.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PlayerActionService {
  private readonly logger = new Logger(PlayerActionService.name);

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepository: Repository<GamePlayer>,
    private dataSource: DataSource,
    private redisService: RedisService
  ) {}

  async performAction(
    roundId: string,
    playerId: string,
    playerGameId: string,
    actionDto: PlayerActionDto
  ): Promise<PlayerActionResponseDto> {
    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the round with game information
      const round = await queryRunner.manager.findOne(GameRound, {
        where: { id: roundId },
        relations: ['game', 'game.gamePlayers']
      });

      if (!round) {
        throw new NotFoundException('Round not found');
      }

      // Verify the round belongs to the player's game
      if (round.gameId !== playerGameId) {
        throw new ForbiddenException('Access denied: round does not belong to your game');
      }

      // Verify the round is active and in reveal_gamble phase
      if (round.status !== RoundStatus.ACTIVE) {
        throw new BadRequestException('Cannot perform action for inactive round');
      }

      const roundData = round.roundData || {};
      if (roundData.phase !== 'reveal_gamble') {
        throw new BadRequestException('Cannot perform action: not in reveal & gamble phase');
      }

      // Verify player is in the game
      const player = round.game.gamePlayers.find(gp => gp.userId === playerId);
      if (!player) {
        throw new ForbiddenException('Player not found in this game');
      }

      // Check if player has already performed an action this round
      const playerActions = roundData.playerActions || {};
      if (playerActions[playerId]) {
        throw new BadRequestException('Player has already performed an action this round');
      }

      // Validate action-specific requirements
      await this.validateAction(actionDto, round, playerId);

      // Perform coin-flip for action success
      const success = this.performCoinFlip(actionDto.actionType);
      const result = success ? 'heads' : 'tails';

      // Process the action based on success/failure
      const actionResult = await this.processAction(
        actionDto,
        success,
        round,
        playerId,
        queryRunner
      );

      // Update round data with action result
      const updatedRoundData = {
        ...roundData,
        playerActions: {
          ...playerActions,
          [playerId]: {
            actionType: actionDto.actionType,
            success,
            result,
            performedAt: new Date().toISOString(),
            targetPlayerId: actionDto.targetPlayerId,
            metadata: actionDto.metadata
          }
        },
        actionResults: {
          ...(roundData.actionResults || {}),
          [playerId]: actionResult
        }
      };

      await queryRunner.manager.update(GameRound, roundId, {
        roundData: updatedRoundData
      });

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast action performed event
      await this.redisService.publishToGameJson(round.gameId, {
        type: 'action_performed',
        data: {
          roundId,
          playerId,
          actionType: actionDto.actionType,
          success,
          result,
          targetPlayerId: actionDto.targetPlayerId,
          performedAt: updatedRoundData.playerActions[playerId].performedAt
        }
      });

      this.logger.log(`Action performed for round ${roundId}: ${playerId} ${actionDto.actionType} - ${success ? 'SUCCESS' : 'FAILURE'}`);

      return {
        roundId,
        playerId,
        actionType: actionDto.actionType,
        success,
        targetPlayerId: actionDto.targetPlayerId,
        result,
        message: this.generateActionMessage(actionDto.actionType, success, actionResult),
        roundStatePatch: this.generateRoundStatePatch(updatedRoundData, playerId)
      };

    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  private async validateAction(
    actionDto: PlayerActionDto,
    round: GameRound,
    playerId: string
  ): Promise<void> {
    const roundData = round.roundData || {};

    switch (actionDto.actionType) {
      case PlayerActionType.ROLL:
        // Roll is always valid
        break;

      case PlayerActionType.FORCE:
        if (!actionDto.targetPlayerId) {
          throw new BadRequestException('Target player ID is required for force action');
        }
        
        // Verify target player is in the game and not the same as the actor
        if (actionDto.targetPlayerId === playerId) {
          throw new BadRequestException('Cannot force yourself');
        }

        const targetPlayer = round.game.gamePlayers.find(gp => gp.userId === actionDto.targetPlayerId);
        if (!targetPlayer) {
          throw new BadRequestException('Target player not found in this game');
        }

        // Check if target has already been forced this round
        const forceTargets = roundData.forceTargets || {};
        if (forceTargets[actionDto.targetPlayerId]) {
          throw new BadRequestException('Target player has already been forced this round');
        }
        break;

      case PlayerActionType.SHIELD:
        // Check if player has already been shielded this round
        const shieldedPlayers = roundData.shieldedPlayers || {};
        if (shieldedPlayers[playerId]) {
          throw new BadRequestException('Player has already been shielded this round');
        }
        break;

      default:
        throw new BadRequestException('Invalid action type');
    }
  }

  private performCoinFlip(actionType: PlayerActionType): boolean {
    let successRate: number;

    switch (actionType) {
      case PlayerActionType.ROLL:
        successRate = ActionConstants.ROLL_SUCCESS_RATE;
        break;
      case PlayerActionType.FORCE:
        successRate = ActionConstants.FORCE_SUCCESS_RATE;
        break;
      case PlayerActionType.SHIELD:
        successRate = ActionConstants.SHIELD_SUCCESS_RATE;
        break;
      default:
        successRate = 0.5;
    }

    return Math.random() < successRate;
  }

  private async processAction(
    actionDto: PlayerActionDto,
    success: boolean,
    round: GameRound,
    playerId: string,
    queryRunner: any
  ): Promise<Record<string, any>> {
    const roundData = round.roundData || {};
    const actionResult: Record<string, any> = {
      success,
      timestamp: new Date().toISOString()
    };

    switch (actionDto.actionType) {
      case PlayerActionType.ROLL:
        if (success) {
          // Successful roll: player gets to see the correct answer
          actionResult.effect = 'reveal_answer';
          actionResult.correctAnswer = roundData.correctAnswer || 'unknown';
        } else {
          // Failed roll: no effect
          actionResult.effect = 'no_effect';
        }
        break;

      case PlayerActionType.FORCE:
        if (success && actionDto.targetPlayerId) {
          // Successful force: target player must reveal their answer
          actionResult.effect = 'force_reveal';
          actionResult.targetPlayerId = actionDto.targetPlayerId;
          
          // Update round data to mark target as forced
          const updatedRoundData = {
            ...roundData,
            forceTargets: {
              ...(roundData.forceTargets || {}),
              [actionDto.targetPlayerId]: {
                forcedBy: playerId,
                forcedAt: new Date().toISOString()
              }
            }
          };
          
          await queryRunner.manager.update(GameRound, round.id, {
            roundData: updatedRoundData
          });
        } else {
          // Failed force: no effect
          actionResult.effect = 'no_effect';
        }
        break;

      case PlayerActionType.SHIELD:
        if (success) {
          // Successful shield: player is protected from force actions
          actionResult.effect = 'shielded';
          actionResult.shieldExpiresAt = new Date(Date.now() + 30000).toISOString(); // 30 seconds
          
          // Update round data to mark player as shielded
          const updatedRoundData = {
            ...roundData,
            shieldedPlayers: {
              ...(roundData.shieldedPlayers || {}),
              [playerId]: {
                shieldedAt: new Date().toISOString(),
                expiresAt: actionResult.shieldExpiresAt
              }
            }
          };
          
          await queryRunner.manager.update(GameRound, round.id, {
            roundData: updatedRoundData
          });
        } else {
          // Failed shield: no effect
          actionResult.effect = 'no_effect';
        }
        break;
    }

    return actionResult;
  }

  private generateActionMessage(
    actionType: PlayerActionType,
    success: boolean,
    actionResult: Record<string, any>
  ): string {
    const baseMessage = success ? 'SUCCESS!' : 'FAILURE!';
    
    switch (actionType) {
      case PlayerActionType.ROLL:
        return success 
          ? `${baseMessage} You rolled heads and can see the correct answer!`
          : `${baseMessage} You rolled tails. Better luck next time!`;
      
      case PlayerActionType.FORCE:
        return success 
          ? `${baseMessage} Force successful! Target player must reveal their answer.`
          : `${baseMessage} Force failed. Target player remains protected.`;
      
      case PlayerActionType.SHIELD:
        return success 
          ? `${baseMessage} Shield activated! You are protected from force actions.`
          : `${baseMessage} Shield failed. You remain vulnerable.`;
      
      default:
        return `${baseMessage} Action completed.`;
    }
  }

  private generateRoundStatePatch(
    roundData: Record<string, any>,
    playerId: string
  ): Record<string, any> {
    return {
      phase: roundData.phase,
      playerActions: roundData.playerActions,
      actionResults: roundData.actionResults,
      forceTargets: roundData.forceTargets || {},
      shieldedPlayers: roundData.shieldedPlayers || {},
      currentPlayerAction: roundData.playerActions?.[playerId],
      remainingActions: this.calculateRemainingActions(roundData)
    };
  }

  private calculateRemainingActions(roundData: Record<string, any>): number {
    const totalPlayers = Object.keys(roundData.playerActions || {}).length;
    const maxActions = ActionConstants.MAX_ACTIONS_PER_ROUND;
    return Math.max(0, maxActions - totalPlayers);
  }

  async getRoundActions(roundId: string, playerGameId: string): Promise<Record<string, any>> {
    const round = await this.gameRoundRepository.findOne({
      where: { id: roundId },
      relations: ['game', 'game.gamePlayers']
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (round.gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: round does not belong to your game');
    }

    const roundData = round.roundData || {};
    
    return {
      roundId,
      phase: roundData.phase,
      playerActions: roundData.playerActions || {},
      actionResults: roundData.actionResults || {},
      forceTargets: roundData.forceTargets || {},
      shieldedPlayers: roundData.shieldedPlayers || {},
      remainingActions: this.calculateRemainingActions(roundData)
    };
  }
} 