import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { PlayerActionDto, PlayerActionResponseDto } from '../dto/player-action.dto';
import { RedisService } from '../redis/redis.service';
import { ActionValidationService, ValidationContext } from './action-validation.service';
import { ActionProcessingService } from './action-processing.service';

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
    private redisService: RedisService,
    private actionValidationService: ActionValidationService,
    private actionProcessingService: ActionProcessingService
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
        throw new Error('Round not found');
      }

      // Create validation context
      const roundData = round.roundData || {};
      const context: ValidationContext = {
        round,
        playerId,
        playerGameId,
        roundData
      };

      // Validate action
      this.actionValidationService.validateCompleteContext(context);
      this.actionValidationService.validateAction(actionDto, context);

      // Perform coin-flip for action success
      const success = this.actionProcessingService.performCoinFlip(actionDto.actionType);
      const result = success ? 'heads' : 'tails';

      // Process the action based on success/failure
      const actionResult = await this.actionProcessingService.processAction(
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
          ...roundData['playerActions'],
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
          ...(roundData['actionResults'] || {}),
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
          performedAt: updatedRoundData['playerActions'][playerId].performedAt
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
        message: this.actionProcessingService.generateActionMessage(actionDto.actionType, success, actionResult),
        roundStatePatch: this.actionProcessingService.generateRoundStatePatch(updatedRoundData, playerId)
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

  async getRoundActions(roundId: string, playerGameId: string): Promise<Record<string, any>> {
    const round = await this.gameRoundRepository.findOne({
      where: { id: roundId },
      relations: ['game']
    });

    if (!round) {
      throw new Error('Round not found');
    }

    // Verify the round belongs to the player's game
    if (round.gameId !== playerGameId) {
      throw new Error('Access denied: round does not belong to your game');
    }

    const roundData = round.roundData || {};
    
    return {
      roundId,
      gameId: round.gameId,
      playerActions: roundData['playerActions'] || {},
      actionResults: roundData['actionResults'] || {},
      remainingActions: this.actionProcessingService['calculateRemainingActions'](roundData),
      phase: roundData['phase'],
      totalPlayers: roundData['totalPlayers'] || 0
    };
  }
} 