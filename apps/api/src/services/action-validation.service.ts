import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionType } from '../dto/player-action.dto';

export interface ValidationContext {
  round: GameRound;
  playerId: string;
  playerGameId: string;
  roundData: Record<string, any>;
}

@Injectable()
export class ActionValidationService {
  validateRoundAccess(round: GameRound, playerGameId: string): void {
    if (round.gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: round does not belong to your game');
    }
  }

  validateRoundStatus(round: GameRound): void {
    if (round.status !== RoundStatus.ACTIVE) {
      throw new BadRequestException('Cannot perform action for inactive round');
    }

    const roundData = round.roundData || {};
    if (roundData.phase !== 'reveal_gamble') {
      throw new BadRequestException('Cannot perform action: not in reveal & gamble phase');
    }
  }

  validatePlayerInGame(round: GameRound, playerId: string): void {
    const player = round.game.gamePlayers.find(gp => gp.userId === playerId);
    if (!player) {
      throw new ForbiddenException('Player not found in this game');
    }
  }

  validateNoPreviousAction(roundData: Record<string, any>, playerId: string): void {
    const playerActions = roundData.playerActions || {};
    if (playerActions[playerId]) {
      throw new BadRequestException('Player has already performed an action this round');
    }
  }

  validateAction(
    actionDto: PlayerActionDto,
    context: ValidationContext
  ): void {
    const { round, playerId, roundData } = context;

    switch (actionDto.actionType) {
      case PlayerActionType.ROLL:
        // Roll is always valid
        break;

      case PlayerActionType.FORCE:
        this.validateForceAction(actionDto, round, playerId);
        break;

      case PlayerActionType.SHIELD:
        this.validateShieldAction(roundData, playerId);
        break;

      default:
        throw new BadRequestException('Invalid action type');
    }
  }

  private validateForceAction(
    actionDto: PlayerActionDto,
    round: GameRound,
    playerId: string
  ): void {
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
    const roundData = round.roundData || {};
    const forceTargets = roundData.forceTargets || {};
    if (forceTargets[actionDto.targetPlayerId]) {
      throw new BadRequestException('Target player has already been forced this round');
    }
  }

  private validateShieldAction(
    roundData: Record<string, any>,
    playerId: string
  ): void {
    // Check if player has already been shielded this round
    const shieldedPlayers = roundData.shieldedPlayers || {};
    if (shieldedPlayers[playerId]) {
      throw new BadRequestException('Player has already been shielded this round');
    }
  }

  validateCompleteContext(context: ValidationContext): void {
    this.validateRoundAccess(context.round, context.playerGameId);
    this.validateRoundStatus(context.round);
    this.validatePlayerInGame(context.round, context.playerId);
    this.validateNoPreviousAction(context.roundData, context.playerId);
  }

  canPerformAction(
    round: GameRound,
    playerId: string,
    playerGameId: string
  ): boolean {
    try {
      const roundData = round.roundData || {};
      const context: ValidationContext = {
        round,
        playerId,
        playerGameId,
        roundData
      };

      this.validateCompleteContext(context);
      return true;
    } catch {
      return false;
    }
  }
} 