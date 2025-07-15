import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus, GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { StateTransitionService, GameState, GameStateTransitionError } from './state-transition.service';

@Injectable()
export class GameStateService {
  private readonly logger = new Logger(GameStateService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private redisService: RedisService,
    private stateTransitionService: StateTransitionService
  ) {}

  /**
   * Get current game state based on game status and metadata
   */
  getCurrentState(game: Game): GameState {
    return this.stateTransitionService.getCurrentState(game);
  }

  /**
   * Validate and execute state transition
   */
  async transitionTo(
    game: Game,
    targetState: GameState,
    currentRound?: GameRound
  ): Promise<{ game: Game; currentRound?: GameRound }> {
    return await this.stateTransitionService.transitionTo(game, targetState, currentRound);
  }

  /**
   * Get available transitions for current state
   */
  getAvailableTransitions(game: Game): GameState[] {
    return this.stateTransitionService.getAvailableTransitions(game);
  }

  /**
   * Check if transition is possible
   */
  async canTransitionTo(game: Game, targetState: GameState, currentRound?: GameRound): Promise<boolean> {
    return await this.stateTransitionService.canTransitionTo(game, targetState, currentRound);
  }

  /**
   * Get current active round for a game
   */
  async getCurrentRound(gameId: string): Promise<GameRound | null> {
    return await this.gameRoundRepository.findOne({
      where: { 
        gameId,
        status: RoundStatus.ACTIVE
      },
      order: { roundNumber: 'DESC' }
    });
  }

  /**
   * Get game state summary
   */
  async getGameStateSummary(gameId: string): Promise<{
    currentState: GameState;
    availableTransitions: GameState[];
    currentRound?: GameRound;
    metadata: Record<string, any>;
  }> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gameRounds']
    });

    if (!game) {
      throw new Error('Game not found');
    }

    const currentState = this.getCurrentState(game);
    const availableTransitions = this.getAvailableTransitions(game);
    const currentRound = await this.getCurrentRound(gameId);

    return {
      currentState,
      availableTransitions,
      currentRound: currentRound || undefined,
      metadata: game.metadata || {}
    };
  }

  /**
   * Force state transition (for admin/debug purposes)
   */
  async forceStateTransition(
    gameId: string,
    targetState: GameState,
    reason?: string
  ): Promise<{ game: Game; currentRound?: GameRound }> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gameRounds']
    });

    if (!game) {
      throw new Error('Game not found');
    }

    this.logger.warn(`Forcing state transition for game ${gameId} to ${targetState}. Reason: ${reason || 'No reason provided'}`);

    // Update game metadata to force state
    game.metadata = {
      ...game.metadata,
      currentState: targetState,
      forcedTransition: {
        to: targetState,
        at: new Date().toISOString(),
        reason: reason || 'Admin override'
      }
    };

    const savedGame = await this.gameRepository.save(game);

    // Broadcast forced state change
    await this.redisService.publishToGameJson(gameId, {
      type: 'state_forced',
      data: {
        gameId,
        targetState,
        reason,
        timestamp: new Date().toISOString()
      }
    });

    return { game: savedGame };
  }
} 