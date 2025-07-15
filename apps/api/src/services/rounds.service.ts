import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { SetTargetResponseDto } from '../dto/set-target.dto';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../telemetry/metrics.service';

@Injectable()
export class RoundsService {
  private readonly logger = new Logger(RoundsService.name);

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepository: Repository<GamePlayer>,
    private redisService: RedisService,
    private metricsService: MetricsService
  ) {}

  async setTarget(
    roundId: string,
    askerId: string,
    targetPlayerId: string,
    playerGameId: string
  ): Promise<SetTargetResponseDto> {
    // Get the round with game information
    const round = await this.gameRoundRepository.findOne({
      where: { id: roundId },
      relations: ['game', 'game.gamePlayers', 'game.gamePlayers.user']
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    // Verify the round belongs to the player's game
    if (round.gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: round does not belong to your game');
    }

    // Verify the round is active
    if (round.status !== RoundStatus.ACTIVE) {
      throw new BadRequestException('Cannot set target for inactive round');
    }

    // Verify the asker is the one who created this round
    if (round.createdById !== askerId) {
      throw new ForbiddenException('Only the question asker can set the target');
    }

    // Get the target player
    const targetPlayer = await this.gamePlayerRepository.findOne({
      where: { 
        gameId: round.gameId,
        userId: targetPlayerId
      },
      relations: ['user']
    });

    if (!targetPlayer) {
      throw new NotFoundException('Target player not found in this game');
    }

    // Verify target player is not a spectator
    if (targetPlayer.isSpectator) {
      throw new BadRequestException('Cannot target a spectator');
    }

    // Verify target player is not the asker
    if (targetPlayer.userId === askerId) {
      throw new BadRequestException('Cannot target yourself');
    }

    // Check if target is already set for this round
    if (round.roundData?.targetPlayerId) {
      throw new BadRequestException('Target has already been set for this round');
    }

    // Update the round with target information
    const updatedRoundData = {
      ...round.roundData,
      targetPlayerId,
      targetSetAt: new Date().toISOString(),
      targetSetBy: askerId,
      phase: 'response', // Start response phase
      responseStartTime: new Date().toISOString(),
      responseEndTime: new Date(Date.now() + 30000).toISOString(), // 30 seconds for response
    };

    await this.gameRoundRepository.update(roundId, {
      roundData: updatedRoundData
    });

    // Get updated round
    const updatedRound = await this.gameRoundRepository.findOne({
      where: { id: roundId }
    });

    if (!updatedRound) {
      throw new NotFoundException('Failed to update round');
    }

    const targetPlayerName = `${targetPlayer.user.firstName} ${targetPlayer.user.lastName}`;

    // Broadcast target selection to game room (private to asker)
    await this.redisService.publishToGameJson(round.gameId, {
      type: 'target_set',
      data: {
        roundId,
        askerId,
        targetPlayerId,
        targetPlayerName,
        setAt: updatedRoundData.targetSetAt,
        isPrivate: true // Only visible to asker
      }
    });

    // Broadcast responder information to all players
    await this.redisService.publishToGameJson(round.gameId, {
      type: 'responder_selected',
      data: {
        roundId,
        responderId: targetPlayerId,
        responderName: targetPlayerName,
        responderAvatar: targetPlayer.user.avatarUrl,
        phase: 'response',
        responseStartTime: updatedRoundData.responseStartTime,
        responseEndTime: updatedRoundData.responseEndTime,
        countdownDuration: 30000, // 30 seconds in milliseconds
        nextPhase: 'reveal_gamble'
      }
    });

    this.logger.log(`Target set for round ${roundId}: ${askerId} -> ${targetPlayerId}`);

    return {
      roundId,
      askerId,
      targetPlayerId,
      targetPlayerName,
      setAt: updatedRoundData.targetSetAt,
      message: `Target set successfully: ${targetPlayerName}`
    };
  }

  async getRoundTarget(roundId: string, playerId: string): Promise<any> {
    const round = await this.gameRoundRepository.findOne({
      where: { id: roundId },
      relations: ['game', 'game.gamePlayers', 'game.gamePlayers.user']
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    // Only the asker can see the target
    if (round.createdById !== playerId) {
      throw new ForbiddenException('Only the question asker can view the target');
    }

    const targetPlayerId = round.roundData?.targetPlayerId;
    if (!targetPlayerId) {
      return { targetSet: false };
    }

    const targetPlayer = round.game.gamePlayers.find(
      gp => gp.userId === targetPlayerId
    );

    if (!targetPlayer) {
      return { targetSet: false };
    }

    return {
      targetSet: true,
      targetPlayerId,
      targetPlayerName: `${targetPlayer.user.firstName} ${targetPlayer.user.lastName}`,
      setAt: round.roundData.targetSetAt
    };
  }

  async getRoundPhase(roundId: string): Promise<any> {
    const round = await this.gameRoundRepository.findOne({
      where: { id: roundId }
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    const roundData = round.roundData || {};
    
    return {
      roundId,
      phase: roundData.phase || 'pending',
      responseStartTime: roundData.responseStartTime,
      responseEndTime: roundData.responseEndTime,
      countdownDuration: roundData.countdownDuration || 30000,
      nextPhase: roundData.nextPhase || 'reveal_gamble'
    };
  }
} 