import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameStatus, GameRound, RoundStatus, GamePlayer, UserBalance, TransactionLedger } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../gateway/game.gateway';
import { FinaleRequestDto, GameFinaleResultDto, PlayerFinalScoreDto } from '../dto/finale.dto';

@Injectable()
export class FinaleService {
  private readonly logger = new Logger(FinaleService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepository: Repository<GamePlayer>,
    @InjectRepository(UserBalance)
    private userBalanceRepository: Repository<UserBalance>,
    @InjectRepository(TransactionLedger)
    private transactionLedgerRepository: Repository<TransactionLedger>,
    private dataSource: DataSource,
    private redisService: RedisService,
    private gameGateway: GameGateway,
  ) {}

  async finalizeGame(gameId: string): Promise<GameFinaleResultDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Get game with all related data
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
        relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds', 'gameRounds.playerAnswers']
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game is already finalized
      if (game.status === GameStatus.FINISHED) {
        throw new BadRequestException('Game is already finalized');
      }

      // Check deck usage requirement (≥ 50%)
      const deckUsageResult = await this.checkDeckUsage(game);
      if (!deckUsageResult.requirementMet) {
        throw new BadRequestException(
          `Deck usage requirement not met. Used ${deckUsageResult.usagePercentage}% of questions, minimum 50% required.`
        );
      }

      // Compute final scores for all players
      const playerScores = await this.computeFinalScores(game);

      // Determine winner
      const winner = playerScores.reduce((prev, current) => 
        prev.finalScore > current.finalScore ? prev : current
      );

      // Grant unused prompt tokens
      const tokenDistribution = await this.grantUnusedPromptTokens(game, playerScores, queryRunner);

      // Update game status and metadata
      await this.updateGameFinale(game, winner, deckUsageResult, queryRunner);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast finale event
      await this.broadcastFinaleEvent(game, playerScores, winner, deckUsageResult);

      this.logger.log(`Game ${gameId} finalized successfully. Winner: ${winner.username} with ${winner.finalScore} points`);

      return {
        gameId: game.id,
        gameName: game.name,
        gameCode: game.code,
        totalRounds: game.gameRounds.filter(r => r.status === RoundStatus.FINISHED).length,
        deckUsagePercentage: deckUsageResult.usagePercentage,
        deckUsageRequirementMet: deckUsageResult.requirementMet,
        winner,
        playerScores,
        totalUnusedPromptTokens: tokenDistribution.totalTokens,
        completedAt: new Date().toISOString(),
        gameStats: {
          totalQuestions: game.gameRounds.length,
          usedQuestions: deckUsageResult.usedQuestions,
          averageScore: playerScores.reduce((sum, p) => sum + p.finalScore, 0) / playerScores.length,
          totalCorrectAnswers: playerScores.reduce((sum, p) => sum + p.correctAnswers, 0),
          totalAnswers: playerScores.reduce((sum, p) => sum + p.totalAnswers, 0),
        }
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error finalizing game ${gameId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkDeckUsage(game: Game): Promise<{
    usagePercentage: number;
    requirementMet: boolean;
    usedQuestions: number;
    totalQuestions: number;
  }> {
    const totalQuestions = game.gameRounds.length;
    const usedQuestions = game.gameRounds.filter(round => 
      round.status === RoundStatus.FINISHED || round.status === RoundStatus.ACTIVE
    ).length;

    const usagePercentage = totalQuestions > 0 ? (usedQuestions / totalQuestions) * 100 : 0;
    const requirementMet = usagePercentage >= 50;

    return {
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      requirementMet,
      usedQuestions,
      totalQuestions
    };
  }

  private async computeFinalScores(game: Game): Promise<PlayerFinalScoreDto[]> {
    const playerScores: PlayerFinalScoreDto[] = [];

    for (const gamePlayer of game.gamePlayers) {
      // Calculate final score from all rounds
      let finalScore = gamePlayer.score;
      let correctAnswers = gamePlayer.correctAnswers;
      let totalAnswers = gamePlayer.totalAnswers;

      // Additional scoring from round-specific data
      for (const round of game.gameRounds) {
        if (round.status === RoundStatus.FINISHED && round.results) {
          const playerResult = round.results[gamePlayer.userId];
          if (playerResult) {
            finalScore += playerResult.score || 0;
            if (playerResult.correct) correctAnswers++;
            if (playerResult.answered) totalAnswers++;
          }
        }
      }

      // Calculate player statistics
      const stats = {
        averageScore: totalAnswers > 0 ? finalScore / totalAnswers : 0,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        roundsParticipated: game.gameRounds.filter(r => 
          r.status === RoundStatus.FINISHED && r.results?.[gamePlayer.userId]
        ).length,
        highestRoundScore: Math.max(
          ...game.gameRounds
            .filter(r => r.status === RoundStatus.FINISHED && r.results?.[gamePlayer.userId])
            .map(r => r.results[gamePlayer.userId]?.score || 0)
        )
      };

      playerScores.push({
        playerId: gamePlayer.userId,
        username: gamePlayer.user.username,
        firstName: gamePlayer.user.firstName,
        lastName: gamePlayer.user.lastName,
        finalScore,
        correctAnswers,
        totalAnswers,
        unusedPromptTokens: 0, // Will be calculated later
        rank: 0, // Will be calculated after sorting
        stats
      });
    }

    // Sort by final score (descending) and assign ranks
    playerScores.sort((a, b) => b.finalScore - a.finalScore);
    playerScores.forEach((player, index) => {
      player.rank = index + 1;
    });

    return playerScores;
  }

  private async grantUnusedPromptTokens(
    game: Game, 
    playerScores: PlayerFinalScoreDto[], 
    queryRunner: any
  ): Promise<{ totalTokens: number; playerTokens: Map<string, number> }> {
    const playerTokens = new Map<string, number>();
    let totalTokens = 0;

    // Calculate unused questions per player
    for (const gamePlayer of game.gamePlayers) {
      const playerQuestions = game.gameRounds.filter(round => 
        round.createdById === gamePlayer.userId && round.status === RoundStatus.PENDING
      );

      const unusedTokens = playerQuestions.length;
      playerTokens.set(gamePlayer.userId, unusedTokens);
      totalTokens += unusedTokens;

      if (unusedTokens > 0) {
        // Get or create user balance
        let userBalance = await queryRunner.manager.findOne(UserBalance, {
          where: { userId: gamePlayer.userId }
        });

        if (!userBalance) {
          userBalance = queryRunner.manager.create(UserBalance, {
            userId: gamePlayer.userId,
            balance: 0,
            lastUpdated: new Date()
          });
        }

        // Update balance
        const oldBalance = userBalance.balance;
        userBalance.balance += unusedTokens;
        userBalance.lastUpdated = new Date();

        await queryRunner.manager.save(userBalance);

        // Create transaction ledger entry
        const transaction = queryRunner.manager.create(TransactionLedger, {
          userId: gamePlayer.userId,
          gameId: game.id,
          type: 'unused_prompt_tokens',
          amount: unusedTokens,
          balanceBefore: oldBalance,
          balanceAfter: userBalance.balance,
          description: `Unused prompt tokens from game ${game.code}`,
          metadata: {
            gameId: game.id,
            gameCode: game.code,
            unusedQuestions: playerQuestions.map(q => q.id),
            reason: 'game_finale'
          }
        });

        await queryRunner.manager.save(transaction);

        // Update player score with token count
        const playerScore = playerScores.find(p => p.playerId === gamePlayer.userId);
        if (playerScore) {
          playerScore.unusedPromptTokens = unusedTokens;
        }
      }
    }

    return { totalTokens, playerTokens };
  }

  private async updateGameFinale(
    game: Game, 
    winner: PlayerFinalScoreDto, 
    deckUsage: any, 
    queryRunner: any
  ): Promise<void> {
    // Update game status
    game.status = GameStatus.FINISHED;
    game.finishedAt = new Date();
    game.winnerId = winner.playerId;

    // Update game metadata
    game.metadata = {
      ...game.metadata,
      finale: {
        completedAt: new Date().toISOString(),
        deckUsage: deckUsage.usagePercentage,
        deckUsageRequirementMet: deckUsage.requirementMet,
        winner: {
          playerId: winner.playerId,
          username: winner.username,
          finalScore: winner.finalScore
        },
        totalPlayers: game.gamePlayers.length,
        totalRounds: game.gameRounds.filter(r => r.status === RoundStatus.FINISHED).length
      }
    };

    await queryRunner.manager.save(game);

    // Archive all remaining pending rounds
    const pendingRounds = game.gameRounds.filter(r => r.status === RoundStatus.PENDING);
    for (const round of pendingRounds) {
      round.archived = true;
      round.archivedAt = new Date();
      round.status = RoundStatus.CANCELLED;
      await queryRunner.manager.save(round);
    }
  }

  private async broadcastFinaleEvent(
    game: Game, 
    playerScores: PlayerFinalScoreDto[], 
    winner: PlayerFinalScoreDto, 
    deckUsage: any
  ): Promise<void> {
    const finaleEvent = {
      type: 'game_finale',
      gameId: game.id,
      data: {
        gameId: game.id,
        gameName: game.name,
        gameCode: game.code,
        winner: {
          playerId: winner.playerId,
          username: winner.username,
          finalScore: winner.finalScore
        },
        playerScores: playerScores.map(p => ({
          playerId: p.playerId,
          username: p.username,
          finalScore: p.finalScore,
          rank: p.rank,
          unusedPromptTokens: p.unusedPromptTokens
        })),
        deckUsage: deckUsage.usagePercentage,
        completedAt: new Date().toISOString()
      },
      timestamp: Date.now()
    };

    // Broadcast to game room
    await this.gameGateway.broadcastToGame(game.id, finaleEvent);

    // Publish to Redis for other server instances
    await this.redisService.publishToGameJson(game.id, finaleEvent);
  }
} 