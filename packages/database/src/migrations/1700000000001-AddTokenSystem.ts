import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenSystem1700000000001 implements MigrationInterface {
  name = 'AddTokenSystem1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transaction type enum
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_type_enum" AS ENUM(
        'shot', 'earned', 'bonus', 'penalty', 'refund', 'admin_adjustment'
      )
    `);

    // Create transaction status enum
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_status_enum" AS ENUM(
        'pending', 'completed', 'failed', 'cancelled'
      )
    `);

    // Create user_balances table
    await queryRunner.query(`
      CREATE TABLE "user_balances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "balance" integer NOT NULL DEFAULT '1000',
        "totalEarned" integer NOT NULL DEFAULT '0',
        "totalSpent" integer NOT NULL DEFAULT '0',
        "lastUpdatedAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "UQ_user_balances_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_user_balances" PRIMARY KEY ("id")
      )
    `);

    // Create transaction_ledger table
    await queryRunner.query(`
      CREATE TABLE "transaction_ledger" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "gameRoundId" uuid,
        "transactionType" "public"."transaction_type_enum" NOT NULL,
        "amount" integer NOT NULL,
        "balanceBefore" integer NOT NULL,
        "balanceAfter" integer NOT NULL,
        "status" "public"."transaction_status_enum" NOT NULL DEFAULT 'pending',
        "reference" character varying(255),
        "metadata" jsonb,
        "description" text,
        CONSTRAINT "PK_transaction_ledger" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_user_balances_userId" ON "user_balances" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_ledger_userId" ON "transaction_ledger" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_ledger_gameRoundId" ON "transaction_ledger" ("gameRoundId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_ledger_transactionType" ON "transaction_ledger" ("transactionType")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_ledger_status" ON "transaction_ledger" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_ledger_createdAt" ON "transaction_ledger" ("createdAt")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_balances" ADD CONSTRAINT "FK_user_balances_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_ledger" ADD CONSTRAINT "FK_transaction_ledger_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_ledger" ADD CONSTRAINT "FK_transaction_ledger_gameRoundId" 
      FOREIGN KEY ("gameRoundId") REFERENCES "game_rounds"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Insert default balances for existing users
    await queryRunner.query(`
      INSERT INTO "user_balances" ("userId", "balance", "totalEarned", "totalSpent", "lastUpdatedAt")
      SELECT "id", 1000, 0, 0, now()
      FROM "users"
      WHERE "id" NOT IN (SELECT "userId" FROM "user_balances")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "transaction_ledger" DROP CONSTRAINT "FK_transaction_ledger_gameRoundId"`);
    await queryRunner.query(`ALTER TABLE "transaction_ledger" DROP CONSTRAINT "FK_transaction_ledger_userId"`);
    await queryRunner.query(`ALTER TABLE "user_balances" DROP CONSTRAINT "FK_user_balances_userId"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_transaction_ledger_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_ledger_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_ledger_transactionType"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_ledger_gameRoundId"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_ledger_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_balances_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "transaction_ledger"`);
    await queryRunner.query(`DROP TABLE "user_balances"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transaction_type_enum"`);
  }
} 