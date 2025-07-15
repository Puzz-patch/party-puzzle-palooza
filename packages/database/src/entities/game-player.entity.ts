import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Game } from './game.entity';

export enum PlayerStatus {
  JOINED = 'joined',
  READY = 'ready',
  PLAYING = 'playing',
  LEFT = 'left',
  DISCONNECTED = 'disconnected',
}

@Entity('game_players')
@Index(['gameId', 'userId'], { unique: true })
@Index(['gameId'])
@Index(['userId'])
export class GamePlayer extends BaseEntity {
  @Column({ type: 'uuid' })
  gameId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: PlayerStatus,
    default: PlayerStatus.JOINED,
  })
  status: PlayerStatus;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  totalAnswers: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  joinedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  leftAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isHost: boolean;

  @Column({ type: 'boolean', default: false })
  isSpectator: boolean;

  @Column({ type: 'jsonb', nullable: true })
  gameStats: Record<string, any> | null;

  // Relationships
  @ManyToOne(() => Game, (game) => game.gamePlayers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @ManyToOne(() => User, (user) => user.gamePlayers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
} 