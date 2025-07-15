import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GameRound } from './game-round.entity';

export enum TransactionType {
  SHOT = 'shot',
  EARNED = 'earned',
  BONUS = 'bonus',
  PENALTY = 'penalty',
  REFUND = 'refund',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('transaction_ledger')
@Index(['userId'])
@Index(['gameRoundId'])
@Index(['transactionType'])
@Index(['status'])
@Index(['createdAt'])
export class TransactionLedger extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  gameRoundId: string | null;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({ type: 'int' })
  amount: number; // Positive for credits, negative for debits

  @Column({ type: 'int' })
  balanceBefore: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null; // External reference ID

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Relationships
  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => GameRound, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gameRoundId' })
  gameRound: GameRound | null;
} 