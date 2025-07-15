import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  name = 'InitialMigration1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgcrypto extension for UUID generation
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "public"."user_role_enum" AS ENUM('admin', 'user')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."user_status_enum" AS ENUM('active', 'inactive', 'suspended')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."game_status_enum" AS ENUM('waiting', 'playing', 'finished', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."game_type_enum" AS ENUM('would_you_rather', 'trivia', 'word_association', 'drawing')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."player_status_enum" AS ENUM('joined', 'ready', 'playing', 'left', 'disconnected')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."round_status_enum" AS ENUM('pending', 'active', 'finished', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."round_type_enum" AS ENUM('would_you_rather', 'trivia', 'word_association', 'drawing')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."answer_status_enum" AS ENUM('submitted', 'correct', 'incorrect', 'timeout')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "username" character varying(50) NOT NULL,
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "firstName" character varying(100) NOT NULL,
        "lastName" character varying(100) NOT NULL,
        "avatarUrl" character varying(255),
        "role" "public"."user_role_enum" NOT NULL DEFAULT 'user',
        "status" "public"."user_status_enum" NOT NULL DEFAULT 'active',
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
        "emailVerificationToken" character varying(255),
        "passwordResetToken" character varying(255),
        "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE,
        "preferences" jsonb,
        CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    // Create games table
    await queryRunner.query(`
      CREATE TABLE "games" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(100) NOT NULL,
        "code" character varying(10) NOT NULL,
        "description" text,
        "status" "public"."game_status_enum" NOT NULL DEFAULT 'waiting',
        "type" "public"."game_type_enum" NOT NULL DEFAULT 'would_you_rather',
        "maxPlayers" integer NOT NULL DEFAULT '10',
        "currentPlayers" integer NOT NULL DEFAULT '0',
        "roundsPerGame" integer NOT NULL DEFAULT '5',
        "timePerRound" integer NOT NULL DEFAULT '30',
        "isPrivate" boolean NOT NULL DEFAULT false,
        "password" character varying(255),
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "settings" jsonb,
        "metadata" jsonb,
        "createdById" uuid NOT NULL,
        "winnerId" uuid,
        CONSTRAINT "UQ_7c6c5c5c5c5c5c5c5c5c5c5c5c5" UNIQUE ("code"),
        CONSTRAINT "PK_c9b16b3b3b3b3b3b3b3b3b3b3b3" PRIMARY KEY ("id")
      )
    `);

    // Create game_players table
    await queryRunner.query(`
      CREATE TABLE "game_players" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "gameId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "status" "public"."player_status_enum" NOT NULL DEFAULT 'joined',
        "score" integer NOT NULL DEFAULT '0',
        "correctAnswers" integer NOT NULL DEFAULT '0',
        "totalAnswers" integer NOT NULL DEFAULT '0',
        "joinedAt" TIMESTAMP WITH TIME ZONE,
        "leftAt" TIMESTAMP WITH TIME ZONE,
        "isHost" boolean NOT NULL DEFAULT false,
        "isSpectator" boolean NOT NULL DEFAULT false,
        "gameStats" jsonb,
        CONSTRAINT "UQ_game_player_unique" UNIQUE ("gameId", "userId"),
        CONSTRAINT "PK_game_players" PRIMARY KEY ("id")
      )
    `);

    // Create game_rounds table
    await queryRunner.query(`
      CREATE TABLE "game_rounds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "gameId" uuid NOT NULL,
        "roundNumber" integer NOT NULL,
        "type" "public"."round_type_enum" NOT NULL DEFAULT 'would_you_rather',
        "status" "public"."round_status_enum" NOT NULL DEFAULT 'pending',
        "question" character varying(255) NOT NULL,
        "options" jsonb NOT NULL,
        "correctAnswer" character varying(255),
        "timeLimit" integer NOT NULL DEFAULT '30',
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "roundData" jsonb,
        "results" jsonb,
        "createdById" uuid NOT NULL,
        CONSTRAINT "UQ_game_round_unique" UNIQUE ("gameId", "roundNumber"),
        CONSTRAINT "PK_game_rounds" PRIMARY KEY ("id")
      )
    `);

    // Create player_answers table
    await queryRunner.query(`
      CREATE TABLE "player_answers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "gameRoundId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "answer" character varying(255) NOT NULL,
        "status" "public"."answer_status_enum" NOT NULL DEFAULT 'submitted',
        "pointsEarned" integer NOT NULL DEFAULT '0',
        "timeToAnswer" integer NOT NULL DEFAULT '0',
        "isCorrect" boolean NOT NULL DEFAULT false,
        "submittedAt" TIMESTAMP WITH TIME ZONE,
        "answerData" jsonb,
        CONSTRAINT "UQ_player_answer_unique" UNIQUE ("gameRoundId", "userId"),
        CONSTRAINT "PK_player_answers" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_games_status" ON "games" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_games_createdBy" ON "games" ("createdById")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_players_gameId" ON "game_players" ("gameId")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_players_userId" ON "game_players" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_rounds_gameId" ON "game_rounds" ("gameId")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_rounds_status" ON "game_rounds" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_player_answers_gameRoundId" ON "player_answers" ("gameRoundId")`);
    await queryRunner.query(`CREATE INDEX "IDX_player_answers_userId" ON "player_answers" ("userId")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "games" ADD CONSTRAINT "FK_games_createdBy" 
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "games" ADD CONSTRAINT "FK_games_winner" 
      FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "game_players" ADD CONSTRAINT "FK_game_players_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "game_players" ADD CONSTRAINT "FK_game_players_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "game_rounds" ADD CONSTRAINT "FK_game_rounds_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "game_rounds" ADD CONSTRAINT "FK_game_rounds_createdBy" 
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "player_answers" ADD CONSTRAINT "FK_player_answers_gameRound" 
      FOREIGN KEY ("gameRoundId") REFERENCES "game_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "player_answers" ADD CONSTRAINT "FK_player_answers_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "player_answers" DROP CONSTRAINT "FK_player_answers_user"`);
    await queryRunner.query(`ALTER TABLE "player_answers" DROP CONSTRAINT "FK_player_answers_gameRound"`);
    await queryRunner.query(`ALTER TABLE "game_rounds" DROP CONSTRAINT "FK_game_rounds_createdBy"`);
    await queryRunner.query(`ALTER TABLE "game_rounds" DROP CONSTRAINT "FK_game_rounds_game"`);
    await queryRunner.query(`ALTER TABLE "game_players" DROP CONSTRAINT "FK_game_players_user"`);
    await queryRunner.query(`ALTER TABLE "game_players" DROP CONSTRAINT "FK_game_players_game"`);
    await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_games_winner"`);
    await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_games_createdBy"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_player_answers_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_player_answers_gameRoundId"`);
    await queryRunner.query(`DROP INDEX "IDX_game_rounds_status"`);
    await queryRunner.query(`DROP INDEX "IDX_game_rounds_gameId"`);
    await queryRunner.query(`DROP INDEX "IDX_game_players_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_game_players_gameId"`);
    await queryRunner.query(`DROP INDEX "IDX_games_createdBy"`);
    await queryRunner.query(`DROP INDEX "IDX_games_status"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "player_answers"`);
    await queryRunner.query(`DROP TABLE "game_rounds"`);
    await queryRunner.query(`DROP TABLE "game_players"`);
    await queryRunner.query(`DROP TABLE "games"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "public"."answer_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."round_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."round_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."player_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."game_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."game_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);

    // Drop pgcrypto extension
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
  }
} 