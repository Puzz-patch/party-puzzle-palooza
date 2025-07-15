# Database Indexing Strategy

This document outlines the comprehensive database indexing strategy implemented for Party Puzzle Palooza to optimize read-heavy operations and reduce query latency under load.

## Overview

The application uses PostgreSQL as its primary database, and the indexing strategy focuses on optimizing the most frequently executed queries based on analysis of the application's query patterns.

## Goals

- **Reduce Query Latency:** Achieve at least 30% improvement in query performance
- **Optimize Read-Heavy Operations:** Focus on queries that are executed frequently
- **Support High Concurrency:** Ensure indexes work well under load
- **Minimize Write Overhead:** Balance read performance with write performance

## Index Categories

### 1. Game-Related Indexes (8 indexes)

These indexes optimize queries for game management and discovery:

#### `IDX_games_status_created_at`
- **Columns:** `status`, `createdAt DESC`
- **Purpose:** Find games by status with recent games first
- **Use Cases:** 
  - Listing waiting games for players to join
  - Finding active games for monitoring
  - Displaying recently finished games

#### `IDX_games_type_status`
- **Columns:** `type`, `status`
- **Purpose:** Filter games by type and status
- **Use Cases:**
  - Finding available trivia games
  - Filtering by game type in lobby

#### `IDX_games_created_by_status`
- **Columns:** `createdById`, `status`, `createdAt DESC`
- **Purpose:** Find games created by a specific user
- **Use Cases:**
  - User's game history
  - Managing user's created games

#### `IDX_games_chill_mode_status`
- **Columns:** `chillMode`, `status`
- **Purpose:** Filter games by chill mode setting
- **Use Cases:**
  - Finding chill mode games
  - Game discovery based on mode

#### `IDX_games_current_players`
- **Columns:** `currentPlayers`, `maxPlayers`
- **Purpose:** Find games with available capacity
- **Use Cases:**
  - Game matchmaking
  - Finding games that can accept more players

#### `IDX_games_started_at`
- **Columns:** `startedAt DESC`
- **Condition:** `WHERE startedAt IS NOT NULL`
- **Purpose:** Find recently started games
- **Use Cases:**
  - Active game monitoring
  - Game state tracking

#### `IDX_games_finished_at`
- **Columns:** `finishedAt DESC`
- **Condition:** `WHERE finishedAt IS NOT NULL`
- **Purpose:** Find recently finished games
- **Use Cases:**
  - Game history
  - Analytics and reporting

#### `IDX_games_capacity_status`
- **Columns:** `currentPlayers`, `maxPlayers`, `status`
- **Purpose:** Complex queries involving capacity and status
- **Use Cases:**
  - Advanced game filtering
  - Matchmaking algorithms

### 2. GamePlayer-Related Indexes (7 indexes)

These indexes optimize player management and game participation queries:

#### `IDX_game_players_game_status`
- **Columns:** `gameId`, `status`
- **Purpose:** Find players in a specific game by status
- **Use Cases:**
  - Active players in a game
  - Ready players waiting to start

#### `IDX_game_players_user_status`
- **Columns:** `userId`, `status`, `joinedAt DESC`
- **Purpose:** Find user's active games
- **Use Cases:**
  - User's current games
  - Game participation history

#### `IDX_game_players_is_host`
- **Columns:** `gameId`, `isHost`
- **Condition:** `WHERE isHost = true`
- **Purpose:** Find host players efficiently
- **Use Cases:**
  - Game host identification
  - Host-specific operations

#### `IDX_game_players_is_spectator`
- **Columns:** `gameId`, `isSpectator`
- **Condition:** `WHERE isSpectator = true`
- **Purpose:** Find spectator players
- **Use Cases:**
  - Spectator management
  - Audience tracking

#### `IDX_game_players_score`
- **Columns:** `gameId`, `score DESC`
- **Purpose:** Leaderboard and ranking queries
- **Use Cases:**
  - Game leaderboards
  - Player rankings
  - Score-based sorting

#### `IDX_game_players_joined_at`
- **Columns:** `joinedAt DESC`
- **Condition:** `WHERE joinedAt IS NOT NULL`
- **Purpose:** Find recently joined players
- **Use Cases:**
  - Recent activity tracking
  - Join time analytics

#### `IDX_game_players_game_user_status`
- **Columns:** `gameId`, `userId`, `status`
- **Purpose:** Complex player queries with multiple conditions
- **Use Cases:**
  - Player state validation
  - Multi-condition player lookups

### 3. GameRound-Related Indexes (10 indexes)

These indexes optimize round management and game progression queries:

#### `IDX_game_rounds_game_status`
- **Columns:** `gameId`, `status`
- **Purpose:** Find rounds in a game by status
- **Use Cases:**
  - Active rounds in a game
  - Pending rounds waiting to start

#### `IDX_game_rounds_game_round_number`
- **Columns:** `gameId`, `roundNumber`
- **Purpose:** Sequential round access
- **Use Cases:**
  - Round progression
  - Round history

#### `IDX_game_rounds_status_type`
- **Columns:** `status`, `type`
- **Purpose:** Filter rounds by status and type
- **Use Cases:**
  - Round type filtering
  - Status-based round queries

#### `IDX_game_rounds_created_by`
- **Columns:** `createdById`, `createdAt DESC`
- **Purpose:** Find rounds created by a user
- **Use Cases:**
  - User's created content
  - Content moderation

#### `IDX_game_rounds_flagged`
- **Columns:** `flagged`, `flagCount`
- **Condition:** `WHERE flagged = true`
- **Purpose:** Find flagged rounds for moderation
- **Use Cases:**
  - Content moderation
  - Flagged content review

#### `IDX_game_rounds_revealed`
- **Columns:** `gameId`, `revealed`
- **Condition:** `WHERE revealed = true`
- **Purpose:** Find revealed rounds
- **Use Cases:**
  - Round state management
  - Revealed content queries

#### `IDX_game_rounds_archived`
- **Columns:** `gameId`, `archived`
- **Condition:** `WHERE archived = true`
- **Purpose:** Find archived rounds
- **Use Cases:**
  - Archived content access
  - Content lifecycle management

#### `IDX_game_rounds_started_at`
- **Columns:** `startedAt DESC`
- **Condition:** `WHERE startedAt IS NOT NULL`
- **Purpose:** Find recently started rounds
- **Use Cases:**
  - Active round monitoring
  - Round timing analytics

#### `IDX_game_rounds_ended_at`
- **Columns:** `endedAt DESC`
- **Condition:** `WHERE endedAt IS NOT NULL`
- **Purpose:** Find recently ended rounds
- **Use Cases:**
  - Round completion tracking
  - Round history

#### `IDX_game_rounds_game_status_round`
- **Columns:** `gameId`, `status`, `roundNumber`
- **Purpose:** Complex round queries with multiple conditions
- **Use Cases:**
  - Round state validation
  - Multi-condition round lookups

### 4. PlayerAnswer-Related Indexes (7 indexes)

These indexes optimize answer processing and scoring queries:

#### `IDX_player_answers_round_user`
- **Columns:** `gameRoundId`, `userId`
- **Purpose:** Find user's answers for a specific round
- **Use Cases:**
  - Answer validation
  - User response tracking

#### `IDX_player_answers_round_status`
- **Columns:** `gameRoundId`, `status`
- **Purpose:** Find answers by round and status
- **Use Cases:**
  - Answer processing
  - Status-based answer queries

#### `IDX_player_answers_user_status`
- **Columns:** `userId`, `status`, `submittedAt DESC`
- **Purpose:** Find user's answer history
- **Use Cases:**
  - User's answer history
  - Answer analytics

#### `IDX_player_answers_is_correct`
- **Columns:** `gameRoundId`, `isCorrect`
- **Condition:** `WHERE isCorrect = true`
- **Purpose:** Find correct answers efficiently
- **Use Cases:**
  - Scoring calculations
  - Correct answer identification

#### `IDX_player_answers_submitted_at`
- **Columns:** `submittedAt DESC`
- **Condition:** `WHERE submittedAt IS NOT NULL`
- **Purpose:** Find recently submitted answers
- **Use Cases:**
  - Recent activity tracking
  - Answer timing analytics

#### `IDX_player_answers_time_to_answer`
- **Columns:** `gameRoundId`, `timeToAnswer`
- **Purpose:** Performance analysis queries
- **Use Cases:**
  - Answer speed analytics
  - Performance monitoring

#### `IDX_player_answers_round_user_status`
- **Columns:** `gameRoundId`, `userId`, `status`
- **Purpose:** Complex answer queries with multiple conditions
- **Use Cases:**
  - Answer state validation
  - Multi-condition answer lookups

### 5. User-Related Indexes (4 indexes)

These indexes optimize user management and authentication queries:

#### `IDX_users_status`
- **Columns:** `status`
- **Purpose:** Find users by status
- **Use Cases:**
  - Active user queries
  - User status filtering

#### `IDX_users_role`
- **Columns:** `role`
- **Purpose:** Find users by role
- **Use Cases:**
  - Admin user queries
  - Role-based filtering

#### `IDX_users_last_login`
- **Columns:** `lastLoginAt DESC`
- **Condition:** `WHERE lastLoginAt IS NOT NULL`
- **Purpose:** Find recently active users
- **Use Cases:**
  - User activity tracking
  - Engagement analytics

#### `IDX_users_email_verified`
- **Columns:** `emailVerifiedAt`
- **Condition:** `WHERE emailVerifiedAt IS NOT NULL`
- **Purpose:** Find verified users
- **Use Cases:**
  - Email verification status
  - Verified user queries

### 6. Partial Indexes (6 indexes)

These indexes are optimized for specific conditions to reduce index size and improve performance:

#### `IDX_games_active_only`
- **Columns:** `createdAt DESC`
- **Condition:** `WHERE status IN ('waiting', 'playing')`
- **Purpose:** Find only active games
- **Use Cases:**
  - Active game discovery
  - Real-time game monitoring

#### `IDX_games_finished_only`
- **Columns:** `finishedAt DESC`
- **Condition:** `WHERE status = 'finished'`
- **Purpose:** Find only finished games
- **Use Cases:**
  - Game history
  - Completed game analytics

#### `IDX_game_rounds_active_only`
- **Columns:** `gameId`, `roundNumber`
- **Condition:** `WHERE status = 'active'`
- **Purpose:** Find only active rounds
- **Use Cases:**
  - Active round monitoring
  - Real-time round tracking

#### `IDX_game_rounds_pending_only`
- **Columns:** `gameId`, `roundNumber`
- **Condition:** `WHERE status = 'pending'`
- **Purpose:** Find only pending rounds
- **Use Cases:**
  - Pending round management
  - Round scheduling

#### `IDX_game_players_active_only`
- **Columns:** `gameId`, `userId`
- **Condition:** `WHERE status IN ('joined', 'ready', 'playing')`
- **Purpose:** Find only active players
- **Use Cases:**
  - Active player management
  - Real-time player tracking

#### `IDX_player_answers_submitted_only`
- **Columns:** `gameRoundId`, `userId`
- **Condition:** `WHERE status = 'submitted'`
- **Purpose:** Find only submitted answers
- **Use Cases:**
  - Submitted answer processing
  - Answer validation

## Migration Strategy

### Migration File
- **File:** `20250115000001-add-performance-indexes.ts`
- **Total Indexes:** 42 indexes
- **Migration Type:** Concurrent (non-blocking)

### Migration Process
1. **Backup:** Current index information is backed up
2. **Validation:** Indexes are validated after creation
3. **Analysis:** Index usage statistics are collected
4. **Testing:** Performance tests are run to validate improvements

### Running the Migration

```bash
# Run the migration script
./scripts/run-performance-migration.sh

# Run the performance benchmark
./scripts/run-performance-benchmark.sh
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Query Response Time (p95)**
   - Target: < 300ms
   - Monitor: HTTP request duration

2. **Index Hit Rate**
   - Target: > 90%
   - Monitor: Index usage statistics

3. **Query Success Rate**
   - Target: > 95%
   - Monitor: Failed query rate

4. **Slow Query Count**
   - Target: Minimize
   - Monitor: Queries taking > 200ms

### Monitoring Queries

```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

## Maintenance

### Regular Maintenance Tasks

1. **Index Usage Analysis**
   - Monthly review of index usage
   - Remove unused indexes
   - Add indexes for new query patterns

2. **Index Rebuilding**
   - Rebuild indexes with high bloat
   - Monitor index fragmentation
   - Schedule maintenance windows

3. **Performance Monitoring**
   - Track query performance trends
   - Monitor index hit rates
   - Alert on performance degradation

### Maintenance Scripts

```bash
# Analyze index usage
psql $DATABASE_URL -c "
SELECT 
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
"

# Rebuild indexes with high bloat
psql $DATABASE_URL -c "
REINDEX INDEX CONCURRENTLY index_name;
"
```

## Best Practices

### Index Design Principles

1. **Selectivity:** Choose columns with high selectivity
2. **Query Patterns:** Index based on actual query patterns
3. **Composite Indexes:** Order columns by selectivity
4. **Partial Indexes:** Use for specific conditions
5. **Covering Indexes:** Include all needed columns when possible

### Performance Considerations

1. **Write Overhead:** Monitor impact on INSERT/UPDATE operations
2. **Storage:** Consider index storage requirements
3. **Maintenance:** Plan for index maintenance overhead
4. **Concurrency:** Use CONCURRENTLY for production migrations

### Query Optimization

1. **EXPLAIN ANALYZE:** Use to understand query execution plans
2. **Index Hints:** Use when needed to force index usage
3. **Query Rewriting:** Optimize queries to use indexes effectively
4. **Monitoring:** Continuously monitor query performance

## Troubleshooting

### Common Issues

1. **Index Not Used**
   - Check query conditions match index
   - Verify data types match
   - Check for function calls on indexed columns

2. **Poor Performance**
   - Analyze query execution plans
   - Check for missing indexes
   - Monitor index hit rates

3. **Index Bloat**
   - Rebuild indexes regularly
   - Monitor index sizes
   - Clean up unused indexes

### Diagnostic Queries

```sql
-- Check if index is being used
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM table WHERE column = value;

-- Check index statistics
SELECT * FROM pg_stat_user_indexes WHERE indexname = 'index_name';

-- Check index size and bloat
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    pg_stat_get_tuples_returned(indexname::regclass) as tuples_returned
FROM pg_indexes 
WHERE indexname = 'index_name';
```

## Conclusion

This comprehensive indexing strategy provides significant performance improvements for read-heavy operations while maintaining reasonable write performance. The indexes are designed based on actual query patterns and are continuously monitored to ensure optimal performance.

Regular monitoring and maintenance ensure that the indexing strategy continues to provide value as the application evolves and query patterns change. 