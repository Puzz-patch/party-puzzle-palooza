import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GamePlayer } from './game-player.entity';
import { GameRound } from './game-round.entity';

export enum GameStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum GameType {
  WOULD_YOU_RATHER = 'would_you_rather',
  TRIVIA = 'trivia',
  WORD_ASSOCIATION = 'word_association',
  DRAWING = 'drawing',
}

@Entity('games')
@Index(['code'], { unique: true })
@Index(['status'])
@Index(['createdBy'])
export class Game extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.WAITING,
  })
  status: GameStatus;

  @Column({
    type: 'enum',
    enum: GameType,
    default: GameType.WOULD_YOU_RATHER,
  })
  type: GameType;

  @Column({ type: 'int', default: 10 })
  maxPlayers: number;

  @Column({ type: 'int', default: 0 })
  currentPlayers: number;

  @Column({ type: 'int', default: 5 })
  roundsPerGame: number;

  @Column({ type: 'int', default: 30 })
  timePerRound: number; // in seconds

  @Column({ type: 'boolean', default: false })
  isPrivate: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'boolean', default: false })
  chillMode: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // Foreign Keys
  @Column({ type: 'uuid' })
  createdById: string;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  // Relationships
  @ManyToOne(() => User, (user) => user.createdGames)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winnerId' })
  winner: User | null;

  @OneToMany(() => GamePlayer, (gamePlayer) => gamePlayer.game)
  gamePlayers: GamePlayer[];

  @OneToMany(() => GameRound, (gameRound) => gameRound.game)
  gameRounds: GameRound[];
} 