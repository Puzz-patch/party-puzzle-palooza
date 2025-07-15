import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { GameStateService, GameState, GameStateTransitionError } from '../services/game-state.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId, GameId } from '../auth/player.decorator';
import { GamesService } from '../services/games.service';

export class StateTransitionDto {
  targetState: GameState;
  roundId?: string;
}

@Controller('games/:gid/state')
@UseGuards(JwtPlayerGuard)
export class GameStateController {
  constructor(
    private readonly gameStateService: GameStateService,
    private readonly gamesService: GamesService
  ) {}

  @Post('transition')
  @HttpCode(HttpStatus.OK)
  async transitionGameState(
    @Param('gid') gameId: string,
    @Body() transitionDto: StateTransitionDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ) {
    // Ensure player is transitioning state for their own game
    if (gameId !== playerGameId) {
      throw new BadRequestException('Access denied: game ID mismatch');
    }

    try {
      // Get current game with all relations
      const game = await this.gamesService.getGameById(gameId);
      if (!game) {
        throw new BadRequestException('Game not found');
      }

      let currentRound = undefined;
      if (transitionDto.roundId) {
        currentRound = await this.getCurrentRound(gameId, transitionDto.roundId);
      }

      // Attempt state transition
      const result = await this.gameStateService.transitionTo(
        game,
        transitionDto.targetState,
        currentRound
      );

      return {
        success: true,
        message: `Successfully transitioned to ${transitionDto.targetState}`,
        data: {
          gameId: result.game.id,
          fromState: this.gameStateService.getCurrentState(game),
          toState: transitionDto.targetState,
          currentRound: currentRound ? {
            id: currentRound.id,
            roundNumber: currentRound.roundNumber,
            status: currentRound.status
          } : null
        }
      };
    } catch (error) {
      if (error instanceof GameStateTransitionError) {
        throw new BadRequestException({
          error: 'ERR_STATE_TRANSITION',
          message: error.message,
          currentState: error.currentState,
          targetState: error.targetState
        });
      }
      throw error;
    }
  }

  @Post('available-transitions')
  @HttpCode(HttpStatus.OK)
  async getAvailableTransitions(
    @Param('gid') gameId: string,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ) {
    // Ensure player is requesting transitions for their own game
    if (gameId !== playerGameId) {
      throw new BadRequestException('Access denied: game ID mismatch');
    }

    const game = await this.gamesService.getGameById(gameId);
    if (!game) {
      throw new BadRequestException('Game not found');
    }

    const currentState = this.gameStateService.getCurrentState(game);
    const availableTransitions = this.gameStateService.getAvailableTransitions(game);

    return {
      currentState,
      availableTransitions,
      gameId: game.id
    };
  }

  @Post('can-transition')
  @HttpCode(HttpStatus.OK)
  async canTransitionTo(
    @Param('gid') gameId: string,
    @Body() transitionDto: StateTransitionDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ) {
    // Ensure player is checking transitions for their own game
    if (gameId !== playerGameId) {
      throw new BadRequestException('Access denied: game ID mismatch');
    }

    const game = await this.gamesService.getGameById(gameId);
    if (!game) {
      throw new BadRequestException('Game not found');
    }

    let currentRound = undefined;
    if (transitionDto.roundId) {
      currentRound = await this.getCurrentRound(gameId, transitionDto.roundId);
    }

    const canTransition = await this.gameStateService.canTransitionTo(
      game,
      transitionDto.targetState,
      currentRound
    );

    return {
      canTransition,
      currentState: this.gameStateService.getCurrentState(game),
      targetState: transitionDto.targetState,
      gameId: game.id
    };
  }

  private async getCurrentRound(gameId: string, roundId: string) {
    // This would typically come from a rounds service
    // For now, we'll return null to keep it simple
    return null;
  }
} 