import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus, GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';

export enum GameState {
  LOBBY = 'lobby',
  QUESTION_BUILD = 'question_build',
  ROUND_ACTIVE = 'round_active',
  ROUND_RESULTS = 'round_results',
  GAME_FINISHED = 'game_finished',
  CANCELLED = 'cancelled'
}

export interface StateTransition {
  from: GameState;
  to: GameState;
  conditions?: (game: Game, currentRound?: GameRound) => boolean;
  actions?: (game: Game, currentRound?: GameRound) => Promise<void>;
}

export class GameStateTransitionError extends Error {
  constructor(message: string, public readonly currentState: GameState, public readonly targetState: GameState) {
    super(message);
    this.name = 'ERR_STATE_TRANSITION';
  }
}

@Injectable()
export class GameStateService {
  private readonly logger = new Logger(GameStateService.name);

  // Define valid state transitions
  private readonly stateTransitions: StateTransition[] = [
    {
      from: GameState.LOBBY,
      to: GameState.QUESTION_BUILD,
      conditions: (game) => this.canStartQuestionBuild(game),
      actions: async (game) => await this.onEnterQuestionBuild(game)
    },
    {
      from: GameState.QUESTION_BUILD,
      to: GameState.ROUND_ACTIVE,
      conditions: (game, currentRound) => this.canStartRound(game, currentRound),
      actions: async (game, currentRound) => await this.onEnterRoundActive(game, currentRound)
    },
    {
      from: GameState.ROUND_ACTIVE,
      to: GameState.ROUND_RESULTS,
      conditions: (game, currentRound) => this.canEndRound(game, currentRound),
      actions: async (game, currentRound) => await this.onEnterRoundResults(game, currentRound)
    },
    {
      from: GameState.ROUND_RESULTS,
      to: GameState.ROUND_ACTIVE,
      conditions: (game, currentRound) => this.canStartNextRound(game, currentRound),
      actions: async (game, currentRound) => await this.onStartNextRound(game, currentRound)
    },
    {
      from: GameState.ROUND_RESULTS,
      to: GameState.GAME_FINISHED,
      conditions: (game) => this.isGameComplete(game),
      actions: async (game) => await this.onGameFinished(game)
    },
    {
      from: GameState.LOBBY,
      to: GameState.CANCELLED,
      conditions: (game) => this.canCancelGame(game),
      actions: async (game) => await this.onGameCancelled(game)
    },
    {
      from: GameState.QUESTION_BUILD,
      to: GameState.CANCELLED,
      conditions: (game) => this.canCancelGame(game),
      actions: async (game) => await this.onGameCancelled(game)
    }
  ];

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private redisService: RedisService
  ) {}

  /**
   * Get current game state based on game status and metadata
   */
  getCurrentState(game: Game): GameState {
    if (game.status === GameStatus.CANCELLED) {
      return GameState.CANCELLED;
    }

    if (game.status === GameStatus.FINISHED) {
      return GameState.GAME_FINISHED;
    }

    // Check metadata for more granular state
    const metadata = game.metadata || {};
    
    if (metadata.currentState) {
      return metadata.currentState as GameState;
    }

    // Default mapping based on game status
    switch (game.status) {
      case GameStatus.WAITING:
        return GameState.LOBBY;
      case GameStatus.PLAYING:
        return GameState.ROUND_ACTIVE;
      default:
        return GameState.LOBBY;
    }
  }

  /**
   * Validate and execute state transition
   */
  async transitionTo(
    game: Game,
    targetState: GameState,
    currentRound?: GameRound
  ): Promise<{ game: Game; currentRound?: GameRound }> {
    const currentState = this.getCurrentState(game);
    
    this.logger.log(`Attempting state transition: ${currentState} → ${targetState} for game ${game.id}`);

    // Check if transition is valid
    const transition = this.findValidTransition(currentState, targetState);
    if (!transition) {
      throw new GameStateTransitionError(
        `Invalid state transition from ${currentState} to ${targetState}`,
        currentState,
        targetState
      );
    }

    // Check conditions
    if (transition.conditions && !transition.conditions(game, currentRound)) {
      throw new GameStateTransitionError(
        `State transition conditions not met for ${currentState} → ${targetState}`,
        currentState,
        targetState
      );
    }

    // Execute transition actions
    if (transition.actions) {
      await transition.actions(game, currentRound);
    }

    // Update game state
    const updatedGame = await this.updateGameState(game, targetState);
    
    // Broadcast state change
    await this.broadcastStateChange(updatedGame, currentState, targetState);

    this.logger.log(`Successfully transitioned game ${game.id} from ${currentState} to ${targetState}`);

    return { game: updatedGame, currentRound };
  }

  /**
   * Find valid transition between states
   */
  private findValidTransition(from: GameState, to: GameState): StateTransition | null {
    return this.stateTransitions.find(
      transition => transition.from === from && transition.to === to
    ) || null;
  }

  /**
   * Condition checks
   */
  private canStartQuestionBuild(game: Game): boolean {
    return game.currentPlayers >= 2 && game.gameRounds.length > 0;
  }

  private canStartRound(game: Game, currentRound?: GameRound): boolean {
    if (!currentRound) return false;
    return currentRound.status === RoundStatus.PENDING;
  }

  private canEndRound(game: Game, currentRound?: GameRound): boolean {
    if (!currentRound) return false;
    return currentRound.status === RoundStatus.ACTIVE;
  }

  private canStartNextRound(game: Game, currentRound?: GameRound): boolean {
    if (!currentRound) return false;
    const nextRoundNumber = currentRound.roundNumber + 1;
    return nextRoundNumber <= game.roundsPerGame;
  }

  private isGameComplete(game: Game): boolean {
    const activeRounds = game.gameRounds.filter(round => 
      round.status === RoundStatus.FINISHED
    );
    return activeRounds.length >= game.roundsPerGame;
  }

  private canCancelGame(game: Game): boolean {
    return game.status !== GameStatus.FINISHED && game.status !== GameStatus.CANCELLED;
  }

  /**
   * Transition actions
   */
  private async onEnterQuestionBuild(game: Game): Promise<void> {
    // Update game status to playing
    game.status = GameStatus.PLAYING;
    game.startedAt = new Date();
    
    // Set metadata
    game.metadata = {
      ...game.metadata,
      currentState: GameState.QUESTION_BUILD,
      questionBuildStartedAt: new Date().toISOString()
    };
  }

  private async onEnterRoundActive(game: Game, currentRound: GameRound): Promise<void> {
    if (!currentRound) return;

    // Update round status
    currentRound.status = RoundStatus.ACTIVE;
    currentRound.startedAt = new Date();

    // Update game metadata
    game.metadata = {
      ...game.metadata,
      currentState: GameState.ROUND_ACTIVE,
      currentRoundId: currentRound.id,
      currentRoundNumber: currentRound.roundNumber,
      roundStartedAt: new Date().toISOString()
    };

    await this.gameRoundRepository.save(currentRound);
  }

  private async onEnterRoundResults(game: Game, currentRound: GameRound): Promise<void> {
    if (!currentRound) return;

    // Update round status
    currentRound.status = RoundStatus.FINISHED;
    currentRound.endedAt = new Date();

    // Update game metadata
    game.metadata = {
      ...game.metadata,
      currentState: GameState.ROUND_RESULTS,
      roundEndedAt: new Date().toISOString()
    };

    await this.gameRoundRepository.save(currentRound);
  }

  private async onStartNextRound(game: Game, currentRound: GameRound): Promise<void> {
    if (!currentRound) return;

    const nextRoundNumber = currentRound.roundNumber + 1;
    const nextRound = await this.gameRoundRepository.findOne({
      where: { gameId: game.id, roundNumber: nextRoundNumber }
    });

    if (nextRound) {
      nextRound.status = RoundStatus.ACTIVE;
      nextRound.startedAt = new Date();

      game.metadata = {
        ...game.metadata,
        currentState: GameState.ROUND_ACTIVE,
        currentRoundId: nextRound.id,
        currentRoundNumber: nextRound.roundNumber,
        roundStartedAt: new Date().toISOString()
      };

      await this.gameRoundRepository.save(nextRound);
    }
  }

  private async onGameFinished(game: Game): Promise<void> {
    game.status = GameStatus.FINISHED;
    game.finishedAt = new Date();

    game.metadata = {
      ...game.metadata,
      currentState: GameState.GAME_FINISHED,
      gameEndedAt: new Date().toISOString()
    };
  }

  private async onGameCancelled(game: Game): Promise<void> {
    game.status = GameStatus.CANCELLED;
    game.finishedAt = new Date();

    game.metadata = {
      ...game.metadata,
      currentState: GameState.CANCELLED,
      gameCancelledAt: new Date().toISOString()
    };
  }

  /**
   * Update game state in database
   */
  private async updateGameState(game: Game, newState: GameState): Promise<Game> {
    // Update metadata with new state
    game.metadata = {
      ...game.metadata,
      currentState: newState,
      lastStateChange: new Date().toISOString()
    };

    return await this.gameRepository.save(game);
  }

  /**
   * Broadcast state change to game room
   */
  private async broadcastStateChange(
    game: Game,
    fromState: GameState,
    toState: GameState
  ): Promise<void> {
    await this.redisService.publishToGameJson(game.id, {
      type: 'state_transition',
      data: {
        fromState,
        toState,
        gameId: game.id,
        timestamp: new Date().toISOString(),
        metadata: game.metadata
      }
    });
  }

  /**
   * Get available transitions for current state
   */
  getAvailableTransitions(game: Game): GameState[] {
    const currentState = this.getCurrentState(game);
    return this.stateTransitions
      .filter(transition => transition.from === currentState)
      .map(transition => transition.to);
  }

  /**
   * Validate if a specific transition is possible
   */
  async canTransitionTo(game: Game, targetState: GameState, currentRound?: GameRound): Promise<boolean> {
    try {
      const currentState = this.getCurrentState(game);
      const transition = this.findValidTransition(currentState, targetState);
      
      if (!transition) return false;
      
      if (transition.conditions) {
        return transition.conditions(game, currentRound);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
} 