import { Entity, Column, Index, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('user_balances')
@Index(['userId'], { unique: true })
export class UserBalance extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int', default: 1000 })
  balance: number; // Starting balance of 1000 tokens

  @Column({ type: 'int', default: 0 })
  totalEarned: number;

  @Column({ type: 'int', default: 0 })
  totalSpent: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUpdatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // Relationships
  @OneToOne(() => User, (user) => user.balance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
} 