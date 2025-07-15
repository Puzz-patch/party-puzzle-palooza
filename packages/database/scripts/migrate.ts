#!/usr/bin/env ts-node

import { AppDataSource } from '../src/config/data-source';

async function runMigrations() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();

    console.log('🔄 Running migrations...');
    await AppDataSource.runMigrations();

    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

runMigrations(); 