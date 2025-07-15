import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameRound, RoundStatus, GameStatus } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';

export interface GameResetResult {
  gameId: string;
  gameName: string;
  gameCode: string;
  status: string;
  playerCount: number;
  roundCount: number;
  resetAt: string;
}

@Injectable()
export class GameResetService {
  private readonly logger = new Logger(GameResetService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private dataSource: DataSource,
    private redisService: RedisService
  ) {}

  async resetGame(gameId: string): Promise<GameResetResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get game with all related data
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
        relations: ['gamePlayers', 'gameRounds']
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game can be reset (must be finished)
      if (game.status !== GameStatus.FINISHED) {
        throw new BadRequestException('Only finished games can be reset');
      }

      // Reset game status to waiting
      game.status = GameStatus.WAITING;
      game.startedAt = null;
      game.finishedAt = null;
      game.winnerId = null;

      // Reset game metadata
      game.metadata = {
        ...game.metadata,
        currentState: 'lobby',
        gameEndedAt: null,
        finale: null
      };

      // Reset all game rounds to pending
      for (const round of game.gameRounds) {
        round.status = RoundStatus.PENDING;
        round.startedAt = null;
        round.endedAt = null;
        round.revealed = false;
        round.revealedAt = null;
        round.archived = false;
        round.archivedAt = null;
        round.roundData = null;
        round.results = null;
        
        await queryRunner.manager.save(round);
      }

      // Reset player scores
      for (const gamePlayer of game.gamePlayers) {
        gamePlayer.score = 0;
        gamePlayer.correctAnswers = 0;
        gamePlayer.totalAnswers = 0;
        gamePlayer.gameStats = null;
        
        await queryRunner.manager.save(gamePlayer);
      }

      // Save the reset game
      await queryRunner.manager.save(game);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast game reset event
      await this.redisService.publishToGameJson(gameId, {
        type: 'game_reset',
        gameId,
        data: {
          gameId,
          gameName: game.name,
          gameCode: game.code,
          resetAt: new Date().toISOString(),
          playerCount: game.gamePlayers.length,
          roundCount: game.gameRounds.length
        },
        timestamp: Date.now()
      });

      this.logger.log(`Game ${gameId} reset successfully to lobby state`);

      return {
        gameId: game.id,
        gameName: game.name,
        gameCode: game.code,
        status: game.status,
        playerCount: game.gamePlayers.length,
        roundCount: game.gameRounds.length,
        resetAt: new Date().toISOString()
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error resetting game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async canResetGame(gameId: string): Promise<boolean> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId }
    });

    if (!game) {
      return false;
    }

    return game.status === GameStatus.FINISHED;
  }

  async getResetEligibility(gameId: string): Promise<{
    canReset: boolean;
    reason?: string;
    gameStatus?: string;
  }> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId }
    });

    if (!game) {
      return {
        canReset: false,
        reason: 'Game not found'
      };
    }

    if (game.status !== GameStatus.FINISHED) {
      return {
        canReset: false,
        reason: 'Only finished games can be reset',
        gameStatus: game.status
      };
    }

    return {
      canReset: true
    };
  }
} 