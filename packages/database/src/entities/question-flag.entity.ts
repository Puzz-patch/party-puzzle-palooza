import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GameRound } from './game-round.entity';

export enum FlagReason {
  INAPPROPRIATE = 'inappropriate',
  OFFENSIVE = 'offensive',
  SPAM = 'spam',
  DUPLICATE = 'duplicate',
  MISLEADING = 'misleading',
  OTHER = 'other'
}

@Entity('question_flags')
@Index(['questionId'])
@Index(['flaggedBy'])
@Index(['isResolved'])
@Index(['questionId', 'flaggedBy'], { unique: true })
export class QuestionFlag extends BaseEntity {
  @Column({ type: 'uuid' })
  questionId: string;

  @Column({ type: 'uuid' })
  flaggedBy: string;

  @Column({
    type: 'enum',
    enum: FlagReason,
  })
  reason: FlagReason;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  // Relationships
  @ManyToOne(() => GameRound, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: GameRound;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flaggedBy' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolvedBy' })
  moderator: User | null;
} 