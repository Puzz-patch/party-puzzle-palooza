import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { UserBalance } from '@party-puzzle-palooza/database';
import { TransactionLedger, TransactionType, TransactionStatus } from '@party-puzzle-palooza/database';
import { TakeShotDto, TakeShotResponseDto } from '../dto/take-shot.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ShotService {
  private readonly logger = new Logger(ShotService.name);

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepository: Repository<GamePlayer>,
    @InjectRepository(UserBalance)
    private userBalanceRepository: Repository<UserBalance>,
    @InjectRepository(TransactionLedger)
    private transactionLedgerRepository: Repository<TransactionLedger>,
    private dataSource: DataSource,
    private redisService: RedisService
  ) {}

  async takeShot(
    roundId: string,
    playerId: string,
    playerGameId: string,
    takeShotDto: TakeShotDto
  ): Promise<TakeShotResponseDto> {
    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the round with game information
      const round = await queryRunner.manager.findOne(GameRound, {
        where: { id: roundId },
        relations: ['game']
      });

      if (!round) {
        throw new NotFoundException('Round not found');
      }

      // Verify the round belongs to the player's game
      if (round.gameId !== playerGameId) {
        throw new ForbiddenException('Access denied: round does not belong to your game');
      }

      // Verify the round is active and in response phase
      if (round.status !== RoundStatus.ACTIVE) {
        throw new BadRequestException('Cannot take shot for inactive round');
      }

      const roundData = round.roundData || {};
      if (roundData.phase !== 'response') {
        throw new BadRequestException('Cannot take shot: not in response phase');
      }

      // Check if player is the responder
      if (roundData.targetPlayerId !== playerId) {
        throw new ForbiddenException('Only the selected responder can take a shot');
      }

      // Check if shot already taken
      if (roundData.shotTaken) {
        throw new BadRequestException('Shot has already been taken for this round');
      }

      // Get player's balance with row lock
      const userBalance = await queryRunner.manager
        .createQueryBuilder(UserBalance, 'balance')
        .setLock('pessimistic_write')
        .where('balance.userId = :userId', { userId: playerId })
        .getOne();

      if (!userBalance) {
        throw new NotFoundException('User balance not found');
      }

      // Determine bet amount (default to 1, respect chill_mode)
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: round.gameId }
      });

      const isChillMode = game?.settings?.chill_mode === true;
      const betAmount = isChillMode ? 0 : (takeShotDto.betAmount || 1);

      // Validate bet amount
      if (!isChillMode && betAmount > userBalance.balance) {
        throw new BadRequestException('Insufficient tokens for bet');
      }

      if (!isChillMode && betAmount < 1) {
        throw new BadRequestException('Bet amount must be at least 1 token');
      }

      if (!isChillMode && betAmount > 100) {
        throw new BadRequestException('Bet amount cannot exceed 100 tokens');
      }

      // Calculate new balance
      const balanceBefore = userBalance.balance;
      const balanceAfter = isChillMode ? balanceBefore : balanceBefore - betAmount;

      // Update user balance
      await queryRunner.manager.update(UserBalance, userBalance.id, {
        balance: balanceAfter,
        totalSpent: userBalance.totalSpent + (isChillMode ? 0 : betAmount),
        lastUpdatedAt: new Date()
      });

      // Create transaction ledger entry
      const transaction = queryRunner.manager.create(TransactionLedger, {
        userId: playerId,
        gameRoundId: roundId,
        transactionType: TransactionType.SHOT,
        amount: isChillMode ? 0 : -betAmount, // Negative for debit
        balanceBefore,
        balanceAfter,
        status: TransactionStatus.COMPLETED,
        reference: `shot_${roundId}_${playerId}`,
        metadata: {
          answer: takeShotDto.answer,
          betAmount,
          isChillMode,
          roundNumber: round.roundNumber,
          gameId: round.gameId,
          ...takeShotDto.metadata
        },
        description: isChillMode 
          ? `Shot taken in chill mode: ${takeShotDto.answer}`
          : `Shot taken with ${betAmount} token bet: ${takeShotDto.answer}`
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update round data to mark shot as taken
      const updatedRoundData = {
        ...roundData,
        shotTaken: true,
        shotTakenAt: new Date().toISOString(),
        shotAnswer: takeShotDto.answer,
        shotBetAmount: betAmount,
        shotTransactionId: savedTransaction.id
      };

      await queryRunner.manager.update(GameRound, roundId, {
        roundData: updatedRoundData
      });

      // Commit transaction
      await queryRunner.commitTransaction();

      // Broadcast shot taken event
      await this.redisService.publishToGameJson(round.gameId, {
        type: 'shot_taken',
        data: {
          roundId,
          playerId,
          answer: takeShotDto.answer,
          betAmount,
          isChillMode,
          transactionId: savedTransaction.id,
          takenAt: updatedRoundData.shotTakenAt
        }
      });

      this.logger.log(`Shot taken for round ${roundId}: ${playerId} bet ${betAmount} tokens on "${takeShotDto.answer}"`);

      return {
        roundId,
        playerId,
        answer: takeShotDto.answer,
        betAmount,
        balanceBefore,
        balanceAfter,
        transactionId: savedTransaction.id,
        isChillMode,
        message: isChillMode 
          ? `Shot taken successfully in chill mode!`
          : `Shot taken successfully! ${betAmount} tokens deducted.`
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

  async getPlayerBalance(playerId: string): Promise<{ balance: number; totalEarned: number; totalSpent: number }> {
    const userBalance = await this.userBalanceRepository.findOne({
      where: { userId: playerId }
    });

    if (!userBalance) {
      throw new NotFoundException('User balance not found');
    }

    return {
      balance: userBalance.balance,
      totalEarned: userBalance.totalEarned,
      totalSpent: userBalance.totalSpent
    };
  }

  async getTransactionHistory(
    playerId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ transactions: any[]; total: number }> {
    const [transactions, total] = await this.transactionLedgerRepository.findAndCount({
      where: { userId: playerId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
      relations: ['gameRound']
    });

    return { transactions, total };
  }
} 