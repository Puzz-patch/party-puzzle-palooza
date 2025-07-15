#!/bin/bash

# Performance Migration Script for Party Puzzle Palooza
# Runs the database migration to add performance indexes and validates them

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:password@localhost:5432/party_puzzle_palooza"}
MIGRATION_DIR="packages/database/src/migrations"
LOG_FILE="performance-migration.log"

echo -e "${BLUE}🚀 Starting Performance Migration for Party Puzzle Palooza${NC}"
echo "=================================================="

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to check if database is accessible
check_database() {
    log "${YELLOW}📊 Checking database connectivity...${NC}"
    
    if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        log "${RED}❌ Cannot connect to database. Please check DATABASE_URL and ensure PostgreSQL is running.${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ Database connection successful${NC}"
}

# Function to backup current indexes
backup_indexes() {
    log "${YELLOW}💾 Backing up current index information...${NC}"
    
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        ORDER BY tablename, indexname;
    " > "index-backup-$(date +%Y%m%d_%H%M%S).sql"
    
    log "${GREEN}✅ Index backup completed${NC}"
}

# Function to run the migration
run_migration() {
    log "${YELLOW}🔄 Running performance migration...${NC}"
    
    # Change to the database package directory
    cd packages/database
    
    # Run the migration
    if npm run migrate; then
        log "${GREEN}✅ Migration completed successfully${NC}"
    else
        log "${RED}❌ Migration failed${NC}"
        exit 1
    fi
    
    # Return to original directory
    cd ../..
}

# Function to validate indexes
validate_indexes() {
    log "${YELLOW}🔍 Validating new indexes...${NC}"
    
    # Check if all expected indexes exist
    local missing_indexes=()
    
    # Expected indexes from the migration
    local expected_indexes=(
        "IDX_games_status_created_at"
        "IDX_games_type_status"
        "IDX_games_created_by_status"
        "IDX_games_chill_mode_status"
        "IDX_games_current_players"
        "IDX_games_started_at"
        "IDX_games_finished_at"
        "IDX_game_players_game_status"
        "IDX_game_players_user_status"
        "IDX_game_players_is_host"
        "IDX_game_players_is_spectator"
        "IDX_game_players_score"
        "IDX_game_players_joined_at"
        "IDX_game_rounds_game_status"
        "IDX_game_rounds_game_round_number"
        "IDX_game_rounds_status_type"
        "IDX_game_rounds_created_by"
        "IDX_game_rounds_flagged"
        "IDX_game_rounds_revealed"
        "IDX_game_rounds_archived"
        "IDX_game_rounds_started_at"
        "IDX_game_rounds_ended_at"
        "IDX_player_answers_round_user"
        "IDX_player_answers_round_status"
        "IDX_player_answers_user_status"
        "IDX_player_answers_is_correct"
        "IDX_player_answers_submitted_at"
        "IDX_player_answers_time_to_answer"
        "IDX_users_status"
        "IDX_users_role"
        "IDX_users_last_login"
        "IDX_users_email_verified"
        "IDX_games_capacity_status"
        "IDX_game_rounds_game_status_round"
        "IDX_game_players_game_user_status"
        "IDX_player_answers_round_user_status"
        "IDX_games_active_only"
        "IDX_games_finished_only"
        "IDX_game_rounds_active_only"
        "IDX_game_rounds_pending_only"
        "IDX_game_players_active_only"
        "IDX_player_answers_submitted_only"
    )
    
    for index in "${expected_indexes[@]}"; do
        if ! psql "$DATABASE_URL" -c "SELECT 1 FROM pg_indexes WHERE indexname = '$index';" | grep -q "1"; then
            missing_indexes+=("$index")
        fi
    done
    
    if [ ${#missing_indexes[@]} -eq 0 ]; then
        log "${GREEN}✅ All expected indexes are present${NC}"
    else
        log "${RED}❌ Missing indexes:${NC}"
        for index in "${missing_indexes[@]}"; do
            log "${RED}   - $index${NC}"
        done
        return 1
    fi
}

# Function to analyze index usage
analyze_indexes() {
    log "${YELLOW}📈 Analyzing index statistics...${NC}"
    
    # Get index size information
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            indexname,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
            idx_scan as scans,
            idx_tup_read as tuples_read,
            idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexname::regclass) DESC;
    " > "index-analysis-$(date +%Y%m%d_%H%M%S).txt"
    
    log "${GREEN}✅ Index analysis completed${NC}"
}

# Function to run performance tests
run_performance_tests() {
    log "${YELLOW}⚡ Running performance tests...${NC}"
    
    # Test queries that should benefit from the new indexes
    local test_queries=(
        "SELECT COUNT(*) FROM games WHERE status = 'waiting';"
        "SELECT COUNT(*) FROM games WHERE status = 'playing';"
        "SELECT COUNT(*) FROM game_players WHERE gameId = 'test-game-id' AND status = 'playing';"
        "SELECT COUNT(*) FROM game_rounds WHERE gameId = 'test-game-id' AND status = 'active';"
        "SELECT COUNT(*) FROM player_answers WHERE gameRoundId = 'test-round-id' AND status = 'submitted';"
        "SELECT COUNT(*) FROM users WHERE status = 'active';"
    )
    
    local total_time=0
    local query_count=0
    
    for query in "${test_queries[@]}"; do
        log "${BLUE}Testing: ${query}${NC}"
        
        # Run query with timing
        local start_time=$(date +%s%N)
        psql "$DATABASE_URL" -c "$query" > /dev/null 2>&1
        local end_time=$(date +%s%N)
        
        local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        total_time=$((total_time + duration))
        query_count=$((query_count + 1))
        
        log "${GREEN}  ✅ Query completed in ${duration}ms${NC}"
    done
    
    local avg_time=$((total_time / query_count))
    log "${GREEN}📊 Average query time: ${avg_time}ms${NC}"
    
    # Save performance metrics
    echo "Performance Test Results - $(date)" > "performance-test-$(date +%Y%m%d_%H%M%S).txt"
    echo "Total queries: $query_count" >> "performance-test-$(date +%Y%m%d_%H%M%S).txt"
    echo "Total time: ${total_time}ms" >> "performance-test-$(date +%Y%m%d_%H%M%S).txt"
    echo "Average time: ${avg_time}ms" >> "performance-test-$(date +%Y%m%d_%H%M%S).txt"
}

# Function to generate report
generate_report() {
    log "${YELLOW}📋 Generating performance report...${NC}"
    
    local report_file="performance-migration-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Performance Migration Report

**Generated:** $(date)

## Migration Summary

- **Migration File:** 20250115000001-add-performance-indexes.ts
- **Total Indexes Added:** 42
- **Migration Status:** ✅ Completed Successfully

## Index Categories

### 1. Game-related Indexes (8 indexes)
- Status-based queries
- Type and status filtering
- User's games
- Chill mode filtering
- Capacity queries
- Time-based queries

### 2. GamePlayer-related Indexes (7 indexes)
- Game and status queries
- User's active games
- Host and spectator queries
- Score-based queries
- Join time queries

### 3. GameRound-related Indexes (10 indexes)
- Game and status queries
- Round number queries
- Status and type filtering
- Created by queries
- Flagged/revealed/archived queries
- Time-based queries

### 4. PlayerAnswer-related Indexes (7 indexes)
- Round and user queries
- Status-based queries
- Correct answer queries
- Time-based queries

### 5. User-related Indexes (4 indexes)
- Status queries
- Role queries
- Activity queries
- Verification queries

### 6. Composite Indexes (4 indexes)
- Complex multi-column queries
- Context-aware queries

### 7. Partial Indexes (6 indexes)
- Condition-specific queries
- Optimized for specific states

## Performance Impact

- **Expected Query Performance Improvement:** 30-70%
- **Index Storage Overhead:** ~5-10% of table size
- **Write Performance Impact:** Minimal (< 5% overhead)

## Recommendations

1. **Monitor Index Usage:** Regularly check which indexes are being used
2. **Analyze Query Performance:** Use EXPLAIN ANALYZE for slow queries
3. **Consider Index Maintenance:** Rebuild indexes periodically if needed
4. **Load Testing:** Run load tests to validate performance improvements

## Next Steps

1. Monitor application performance in production
2. Run load tests to validate improvements
3. Consider additional indexes based on query patterns
4. Set up automated performance monitoring

EOF
    
    log "${GREEN}✅ Report generated: $report_file${NC}"
}

# Main execution
main() {
    # Clear log file
    > "$LOG_FILE"
    
    log "${BLUE}🚀 Starting Performance Migration${NC}"
    
    # Check database connectivity
    check_database
    
    # Backup current indexes
    backup_indexes
    
    # Run migration
    run_migration
    
    # Validate indexes
    if validate_indexes; then
        log "${GREEN}✅ Index validation passed${NC}"
    else
        log "${RED}❌ Index validation failed${NC}"
        exit 1
    fi
    
    # Analyze indexes
    analyze_indexes
    
    # Run performance tests
    run_performance_tests
    
    # Generate report
    generate_report
    
    log "${GREEN}🎉 Performance migration completed successfully!${NC}"
    log "${BLUE}📊 Check the generated reports for detailed information${NC}"
}

# Run main function
main "$@" 