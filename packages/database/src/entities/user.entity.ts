import { Entity, Column, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Game } from './game.entity';
import { GamePlayer } from './game-player.entity';
import { GameRound } from './game-round.entity';
import { PlayerAnswer } from './player-answer.entity';
import { UserBalance } from './user-balance.entity';
import { TransactionLedger } from './transaction-ledger.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any> | null;

  // Relationships
  @OneToMany(() => Game, (game) => game.createdBy)
  createdGames: Game[];

  @OneToMany(() => GamePlayer, (gamePlayer) => gamePlayer.user)
  gamePlayers: GamePlayer[];

  @OneToMany(() => GameRound, (gameRound) => gameRound.createdBy)
  createdRounds: GameRound[];

  @OneToMany(() => PlayerAnswer, (playerAnswer) => playerAnswer.user)
  playerAnswers: PlayerAnswer[];

  @OneToOne(() => UserBalance, (balance) => balance.user)
  balance: UserBalance;

  @OneToMany(() => TransactionLedger, (transaction) => transaction.user)
  transactions: TransactionLedger[];
} 