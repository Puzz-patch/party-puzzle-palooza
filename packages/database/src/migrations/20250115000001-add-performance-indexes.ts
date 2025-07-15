import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes20250115000001 implements MigrationInterface {
  name = 'AddPerformanceIndexes20250115000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Game-related indexes for high-frequency queries
    
    // Index for finding games by status (very frequent in game state queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_status_created_at" 
      ON "games" ("status", "createdAt" DESC)
    `);

    // Index for finding games by type and status (game filtering)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_type_status" 
      ON "games" ("type", "status")
    `);

    // Index for finding games by createdBy and status (user's games)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_created_by_status" 
      ON "games" ("createdById", "status", "createdAt" DESC)
    `);

    // Index for finding games by chillMode and status (chill mode filtering)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_chill_mode_status" 
      ON "games" ("chillMode", "status")
    `);

    // Index for finding games by currentPlayers (game capacity queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_current_players" 
      ON "games" ("currentPlayers", "maxPlayers")
    `);

    // Index for finding games by startedAt (active games)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_started_at" 
      ON "games" ("startedAt" DESC) WHERE "startedAt" IS NOT NULL
    `);

    // Index for finding games by finishedAt (recently finished games)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_finished_at" 
      ON "games" ("finishedAt" DESC) WHERE "finishedAt" IS NOT NULL
    `);

    // 2. GamePlayer-related indexes for player queries
    
    // Index for finding players by game and status (active players in game)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_game_status" 
      ON "game_players" ("gameId", "status")
    `);

    // Index for finding players by user and status (user's active games)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_user_status" 
      ON "game_players" ("userId", "status", "joinedAt" DESC)
    `);

    // Index for finding host players (game host queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_is_host" 
      ON "game_players" ("gameId", "isHost") WHERE "isHost" = true
    `);

    // Index for finding spectators (spectator queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_is_spectator" 
      ON "game_players" ("gameId", "isSpectator") WHERE "isSpectator" = true
    `);

    // Index for score-based queries (leaderboard, ranking)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_score" 
      ON "game_players" ("gameId", "score" DESC)
    `);

    // Index for joinedAt queries (recent joins)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_joined_at" 
      ON "game_players" ("joinedAt" DESC) WHERE "joinedAt" IS NOT NULL
    `);

    // 3. GameRound-related indexes for round queries
    
    // Index for finding rounds by game and status (active/pending rounds)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_game_status" 
      ON "game_rounds" ("gameId", "status")
    `);

    // Index for finding rounds by game and round number (sequential access)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_game_round_number" 
      ON "game_rounds" ("gameId", "roundNumber")
    `);

    // Index for finding rounds by status and type (round filtering)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_status_type" 
      ON "game_rounds" ("status", "type")
    `);

    // Index for finding rounds by createdBy (user's created rounds)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_created_by" 
      ON "game_rounds" ("createdById", "createdAt" DESC)
    `);

    // Index for finding flagged rounds (moderation queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_flagged" 
      ON "game_rounds" ("flagged", "flagCount") WHERE "flagged" = true
    `);

    // Index for finding revealed rounds (round state queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_revealed" 
      ON "game_rounds" ("gameId", "revealed") WHERE "revealed" = true
    `);

    // Index for finding archived rounds (archived content queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_archived" 
      ON "game_rounds" ("gameId", "archived") WHERE "archived" = true
    `);

    // Index for finding rounds by startedAt (active rounds)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_started_at" 
      ON "game_rounds" ("startedAt" DESC) WHERE "startedAt" IS NOT NULL
    `);

    // Index for finding rounds by endedAt (recently ended rounds)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_ended_at" 
      ON "game_rounds" ("endedAt" DESC) WHERE "endedAt" IS NOT NULL
    `);

    // 4. PlayerAnswer-related indexes for answer queries
    
    // Index for finding answers by round and user (user's answers)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_round_user" 
      ON "player_answers" ("gameRoundId", "userId")
    `);

    // Index for finding answers by round and status (answer processing)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_round_status" 
      ON "player_answers" ("gameRoundId", "status")
    `);

    // Index for finding answers by user and status (user's answer history)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_user_status" 
      ON "player_answers" ("userId", "status", "submittedAt" DESC)
    `);

    // Index for finding correct answers (scoring queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_is_correct" 
      ON "player_answers" ("gameRoundId", "isCorrect") WHERE "isCorrect" = true
    `);

    // Index for finding answers by submittedAt (recent answers)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_submitted_at" 
      ON "player_answers" ("submittedAt" DESC) WHERE "submittedAt" IS NOT NULL
    `);

    // Index for finding answers by timeToAnswer (performance analysis)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_time_to_answer" 
      ON "player_answers" ("gameRoundId", "timeToAnswer")
    `);

    // 5. User-related indexes for user queries
    
    // Index for finding users by status (active users)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_status" 
      ON "users" ("status")
    `);

    // Index for finding users by role (admin queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_role" 
      ON "users" ("role")
    `);

    // Index for finding users by lastLoginAt (recent activity)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_last_login" 
      ON "users" ("lastLoginAt" DESC) WHERE "lastLoginAt" IS NOT NULL
    `);

    // Index for finding users by emailVerifiedAt (verified users)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_email_verified" 
      ON "users" ("emailVerifiedAt") WHERE "emailVerifiedAt" IS NOT NULL
    `);

    // 6. Composite indexes for complex queries
    
    // Index for finding games with players count (game capacity queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_capacity_status" 
      ON "games" ("currentPlayers", "maxPlayers", "status")
    `);

    // Index for finding rounds with game context (game round queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_game_status_round" 
      ON "game_rounds" ("gameId", "status", "roundNumber")
    `);

    // Index for finding players with game context (game player queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_game_user_status" 
      ON "game_players" ("gameId", "userId", "status")
    `);

    // Index for finding answers with round context (round answer queries)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_round_user_status" 
      ON "player_answers" ("gameRoundId", "userId", "status")
    `);

    // 7. Partial indexes for specific conditions
    
    // Index for active games only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_active_only" 
      ON "games" ("createdAt" DESC) WHERE "status" IN ('waiting', 'playing')
    `);

    // Index for finished games only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_games_finished_only" 
      ON "games" ("finishedAt" DESC) WHERE "status" = 'finished'
    `);

    // Index for active rounds only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_active_only" 
      ON "game_rounds" ("gameId", "roundNumber") WHERE "status" = 'active'
    `);

    // Index for pending rounds only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_rounds_pending_only" 
      ON "game_rounds" ("gameId", "roundNumber") WHERE "status" = 'pending'
    `);

    // Index for active players only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_game_players_active_only" 
      ON "game_players" ("gameId", "userId") WHERE "status" IN ('joined', 'ready', 'playing')
    `);

    // Index for submitted answers only
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_player_answers_submitted_only" 
      ON "player_answers" ("gameRoundId", "userId") WHERE "status" = 'submitted'
    `);

    this.log('Performance indexes created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes in reverse order
    const indexes = [
      'IDX_player_answers_submitted_only',
      'IDX_game_players_active_only',
      'IDX_game_rounds_pending_only',
      'IDX_game_rounds_active_only',
      'IDX_games_finished_only',
      'IDX_games_active_only',
      'IDX_player_answers_round_user_status',
      'IDX_game_players_game_user_status',
      'IDX_game_rounds_game_status_round',
      'IDX_games_capacity_status',
      'IDX_users_email_verified',
      'IDX_users_last_login',
      'IDX_users_role',
      'IDX_users_status',
      'IDX_player_answers_time_to_answer',
      'IDX_player_answers_submitted_at',
      'IDX_player_answers_is_correct',
      'IDX_player_answers_user_status',
      'IDX_player_answers_round_status',
      'IDX_player_answers_round_user',
      'IDX_game_rounds_ended_at',
      'IDX_game_rounds_started_at',
      'IDX_game_rounds_archived',
      'IDX_game_rounds_revealed',
      'IDX_game_rounds_flagged',
      'IDX_game_rounds_created_by',
      'IDX_game_rounds_status_type',
      'IDX_game_rounds_game_round_number',
      'IDX_game_rounds_game_status',
      'IDX_game_players_joined_at',
      'IDX_game_players_score',
      'IDX_game_players_is_spectator',
      'IDX_game_players_is_host',
      'IDX_game_players_user_status',
      'IDX_game_players_game_status',
      'IDX_games_finished_at',
      'IDX_games_started_at',
      'IDX_games_current_players',
      'IDX_games_chill_mode_status',
      'IDX_games_created_by_status',
      'IDX_games_type_status',
      'IDX_games_status_created_at'
    ];

    for (const index of indexes) {
      try {
        await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${index}"`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`Warning: Could not drop index ${index}: ${errorMessage}`);
      }
    }

    this.log('Performance indexes dropped successfully');
  }

  private log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
} 