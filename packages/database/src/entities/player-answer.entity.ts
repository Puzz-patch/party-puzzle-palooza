import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GameRound } from './game-round.entity';

export enum AnswerStatus {
  SUBMITTED = 'submitted',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  TIMEOUT = 'timeout',
}

@Entity('player_answers')
@Index(['gameRoundId', 'userId'], { unique: true })
@Index(['gameRoundId'])
@Index(['userId'])
export class PlayerAnswer extends BaseEntity {
  @Column({ type: 'uuid' })
  gameRoundId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  answer: string;

  @Column({
    type: 'enum',
    enum: AnswerStatus,
    default: AnswerStatus.SUBMITTED,
  })
  status: AnswerStatus;

  @Column({ type: 'int', default: 0 })
  pointsEarned: number;

  @Column({ type: 'int', default: 0 })
  timeToAnswer: number; // in seconds

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  answerData: Record<string, any> | null;

  // Relationships
  @ManyToOne(() => GameRound, (gameRound) => gameRound.playerAnswers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameRoundId' })
  gameRound: GameRound;

  @ManyToOne(() => User, (user) => user.playerAnswers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
} 