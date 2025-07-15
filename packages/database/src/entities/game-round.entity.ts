import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Game } from './game.entity';
import { PlayerAnswer } from './player-answer.entity';

export enum RoundStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum RoundType {
  WOULD_YOU_RATHER = 'would_you_rather',
  TRIVIA = 'trivia',
  WORD_ASSOCIATION = 'word_association',
  DRAWING = 'drawing',
}

@Entity('game_rounds')
@Index(['gameId', 'roundNumber'], { unique: true })
@Index(['gameId'])
@Index(['status'])
export class GameRound extends BaseEntity {
  @Column({ type: 'uuid' })
  gameId: string;

  @Column({ type: 'int' })
  roundNumber: number;

  @Column({
    type: 'enum',
    enum: RoundType,
    default: RoundType.WOULD_YOU_RATHER,
  })
  type: RoundType;

  @Column({
    type: 'enum',
    enum: RoundStatus,
    default: RoundStatus.PENDING,
  })
  status: RoundStatus;

  @Column({ type: 'varchar', length: 255 })
  question: string;

  @Column({ type: 'jsonb' })
  options: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  correctAnswer: string | null;

  @Column({ type: 'int', default: 30 })
  timeLimit: number; // in seconds

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  roundData: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  results: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  revealed: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revealedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  archived: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  archivedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  flagged: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  flaggedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  flagCount: number;

  // Foreign Keys
  @Column({ type: 'uuid' })
  createdById: string;

  // Relationships
  @ManyToOne(() => Game, (game) => game.gameRounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @ManyToOne(() => User, (user) => user.createdRounds)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => PlayerAnswer, (playerAnswer) => playerAnswer.gameRound)
  playerAnswers: PlayerAnswer[];
} 