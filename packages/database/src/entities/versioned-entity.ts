import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Column,
  VersionColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export interface VersionedEntityData {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConflictResolutionResult<T> {
  success: boolean;
  data?: T;
  conflict?: {
    type: 'version_mismatch' | 'concurrent_modification' | 'data_conflict';
    message: string;
    currentVersion: number;
    expectedVersion: number;
    conflictingData?: any;
  };
  retry?: boolean;
}

export abstract class VersionedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastModifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastModifiedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changeHistory: Array<{
    version: number;
    timestamp: Date;
    userId: string | null;
    changes: Record<string, any>;
    operation: 'create' | 'update' | 'delete';
  }> | null;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @BeforeUpdate()
  updateVersion() {
    this.version = (this.version || 0) + 1;
    this.lastModifiedAt = new Date();
  }

  /**
   * Record a change in the change history
   */
  recordChange(
    userId: string | null,
    changes: Record<string, any>,
    operation: 'create' | 'update' | 'delete'
  ) {
    if (!this.changeHistory) {
      this.changeHistory = [];
    }

    this.changeHistory.push({
      version: this.version,
      timestamp: new Date(),
      userId,
      changes,
      operation,
    });

    // Keep only last 50 changes to prevent bloat
    if (this.changeHistory.length > 50) {
      this.changeHistory = this.changeHistory.slice(-50);
    }
  }

  /**
   * Get the current version info
   */
  getVersionInfo(): VersionedEntityData {
    return {
      id: this.id,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Check if this entity has been modified since a given version
   */
  isModifiedSince(version: number): boolean {
    return this.version > version;
  }

  /**
   * Get changes since a specific version
   */
  getChangesSince(version: number): Array<{
    version: number;
    timestamp: Date;
    userId: string | null;
    changes: Record<string, any>;
    operation: 'create' | 'update' | 'delete';
  }> {
    if (!this.changeHistory) {
      return [];
    }

    return this.changeHistory.filter(change => change.version > version);
  }
} 