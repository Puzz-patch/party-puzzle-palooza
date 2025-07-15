import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GameRound, GamePlayer } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionType, ActionConstants } from '../dto/player-action.dto';

export interface ActionResult {
  success: boolean;
  result: string;
  scoreChange?: number;
  targetAffected?: boolean;
  metadata?: Record<string, any>;
}

// Point values for different actions
const ACTION_POINTS = {
  ROLL_SUCCESS: 10,
  ROLL_FAILURE: -5,
  FORCE_SUCCESS: 15,
  FORCE_FAILURE: -10,
  FORCE_TARGET_PENALTY: 20,
  SHIELD_SUCCESS: 8,
  SHIELD_FAILURE: -8
} as const;

@Injectable()
export class ActionProcessingService {
  private readonly logger = new Logger(ActionProcessingService.name);

  constructor(private dataSource: DataSource) {}

  performCoinFlip(actionType: PlayerActionType): boolean {
    // Different actions have different success rates
    const successRates = {
      [PlayerActionType.ROLL]: ActionConstants.ROLL_SUCCESS_RATE,
      [PlayerActionType.FORCE]: ActionConstants.FORCE_SUCCESS_RATE,
      [PlayerActionType.SHIELD]: ActionConstants.SHIELD_SUCCESS_RATE
    };

    const successRate = successRates[actionType] || 0.5;
    return Math.random() < successRate;
  }

  async processAction(
    actionDto: PlayerActionDto,
    success: boolean,
    round: GameRound,
    playerId: string,
    queryRunner: any
  ): Promise<Record<string, any>> {
    const actionResult: ActionResult = {
      success,
      result: success ? 'heads' : 'tails'
    };

    switch (actionDto.actionType) {
      case PlayerActionType.ROLL:
        return await this.processRollAction(actionResult, round, playerId, queryRunner);

      case PlayerActionType.FORCE:
        return await this.processForceAction(actionResult, actionDto, round, playerId, queryRunner);

      case PlayerActionType.SHIELD:
        return await this.processShieldAction(actionResult, round, playerId, queryRunner);

      default:
        throw new Error('Invalid action type');
    }
  }

  private async processRollAction(
    actionResult: ActionResult,
    round: GameRound,
    playerId: string,
    queryRunner: any
  ): Promise<Record<string, any>> {
    if (actionResult.success) {
      // Successful roll: gain points
      actionResult.scoreChange = ACTION_POINTS.ROLL_SUCCESS;
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actionResult.scoreChange);
    } else {
      // Failed roll: lose points
      actionResult.scoreChange = ACTION_POINTS.ROLL_FAILURE;
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actionResult.scoreChange);
    }

    return {
      type: 'roll',
      success: actionResult.success,
      scoreChange: actionResult.scoreChange,
      message: actionResult.success 
        ? `Rolled heads! +${actionResult.scoreChange} points`
        : `Rolled tails! ${actionResult.scoreChange} points`
    };
  }

  private async processForceAction(
    actionResult: ActionResult,
    actionDto: PlayerActionDto,
    round: GameRound,
    playerId: string,
    queryRunner: any
  ): Promise<Record<string, any>> {
    if (actionResult.success) {
      // Successful force: target loses points, actor gains some
      const targetScoreChange = -ACTION_POINTS.FORCE_TARGET_PENALTY;
      const actorScoreChange = ACTION_POINTS.FORCE_SUCCESS;

      await this.updatePlayerScore(queryRunner, round.gameId, actionDto.targetPlayerId!, targetScoreChange);
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actorScoreChange);

      actionResult.scoreChange = actorScoreChange;
      actionResult.targetAffected = true;

      return {
        type: 'force',
        success: true,
        scoreChange: actionResult.scoreChange,
        targetScoreChange,
        targetPlayerId: actionDto.targetPlayerId,
        message: `Force successful! ${actionDto.targetPlayerId} loses ${Math.abs(targetScoreChange)} points, you gain ${actorScoreChange} points`
      };
    } else {
      // Failed force: actor loses points
      actionResult.scoreChange = ACTION_POINTS.FORCE_FAILURE;
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actionResult.scoreChange);

      return {
        type: 'force',
        success: false,
        scoreChange: actionResult.scoreChange,
        message: `Force failed! You lose ${Math.abs(actionResult.scoreChange)} points`
      };
    }
  }

  private async processShieldAction(
    actionResult: ActionResult,
    round: GameRound,
    playerId: string,
    queryRunner: any
  ): Promise<Record<string, any>> {
    if (actionResult.success) {
      // Successful shield: gain points and protection
      actionResult.scoreChange = ACTION_POINTS.SHIELD_SUCCESS;
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actionResult.scoreChange);

      return {
        type: 'shield',
        success: true,
        scoreChange: actionResult.scoreChange,
        shielded: true,
        message: `Shield successful! +${actionResult.scoreChange} points and you're protected`
      };
    } else {
      // Failed shield: lose points
      actionResult.scoreChange = ACTION_POINTS.SHIELD_FAILURE;
      await this.updatePlayerScore(queryRunner, round.gameId, playerId, actionResult.scoreChange);

      return {
        type: 'shield',
        success: false,
        scoreChange: actionResult.scoreChange,
        message: `Shield failed! ${actionResult.scoreChange} points`
      };
    }
  }

  private async updatePlayerScore(
    queryRunner: any,
    gameId: string,
    playerId: string,
    scoreChange: number
  ): Promise<void> {
    await queryRunner.manager
      .createQueryBuilder()
      .update('game_player')
      .set({
        score: () => `score + ${scoreChange}`,
        updatedAt: new Date()
      })
      .where('gameId = :gameId', { gameId })
      .andWhere('userId = :playerId', { playerId })
      .execute();
  }

  generateActionMessage(
    actionType: PlayerActionType,
    success: boolean,
    actionResult: Record<string, any>
  ): string {
    const baseMessages = {
      [PlayerActionType.ROLL]: {
        success: 'Rolled heads!',
        failure: 'Rolled tails!'
      },
      [PlayerActionType.FORCE]: {
        success: 'Force successful!',
        failure: 'Force failed!'
      },
      [PlayerActionType.SHIELD]: {
        success: 'Shield successful!',
        failure: 'Shield failed!'
      }
    };

    const baseMessage = baseMessages[actionType]?.[success ? 'success' : 'failure'] || 'Action completed';
    
    if (actionResult.scoreChange) {
      const sign = actionResult.scoreChange > 0 ? '+' : '';
      return `${baseMessage} ${sign}${actionResult.scoreChange} points`;
    }

    return baseMessage;
  }

  generateRoundStatePatch(
    roundData: Record<string, any>,
    playerId: string
  ): Record<string, any> {
    const playerActions = roundData['playerActions'] || {};
    const actionResults = roundData['actionResults'] || {};
    
    return {
      playerActions,
      actionResults,
      remainingActions: this.calculateRemainingActions(roundData),
      playerAction: playerActions[playerId],
      playerActionResult: actionResults[playerId]
    };
  }

  private calculateRemainingActions(roundData: Record<string, any>): number {
    const playerActions = roundData['playerActions'] || {};
    const totalPlayers = roundData['totalPlayers'] || 0;
    return Math.max(0, totalPlayers - Object.keys(playerActions).length);
  }
} 