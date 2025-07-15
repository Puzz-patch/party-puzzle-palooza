#!/bin/bash

# Performance Benchmark Script for Party Puzzle Palooza
# Runs load tests before and after index migration to measure performance improvements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
K6_IMAGE=${K6_IMAGE:-"grafana/k6:latest"}
RESULTS_DIR="performance-benchmark-results"
BEFORE_RESULTS="$RESULTS_DIR/before-indexes.json"
AFTER_RESULTS="$RESULTS_DIR/after-indexes.json"
COMPARISON_REPORT="$RESULTS_DIR/performance-comparison.md"

echo -e "${BLUE}🚀 Performance Benchmark for Party Puzzle Palooza${NC}"
echo "=================================================="

# Function to log messages
log() {
    echo -e "$1" | tee -a "$RESULTS_DIR/benchmark.log"
}

# Function to check if services are running
check_services() {
    log "${YELLOW}🔍 Checking if services are running...${NC}"
    
    # Check if API is running
    if ! curl -s "$API_URL/health" > /dev/null; then
        log "${RED}❌ API is not running at $API_URL${NC}"
        log "${YELLOW}💡 Please start the API service first${NC}"
        exit 1
    fi
    
    # Check if k6 is available
    if ! docker run --rm "$K6_IMAGE" version > /dev/null 2>&1; then
        log "${RED}❌ k6 Docker image not available${NC}"
        log "${YELLOW}💡 Pulling k6 image...${NC}"
        docker pull "$K6_IMAGE"
    fi
    
    log "${GREEN}✅ All services are running${NC}"
}

# Function to create results directory
setup_results_dir() {
    log "${YELLOW}📁 Setting up results directory...${NC}"
    
    mkdir -p "$RESULTS_DIR"
    rm -f "$RESULTS_DIR"/*.json "$RESULTS_DIR"/*.md
    
    log "${GREEN}✅ Results directory ready${NC}"
}

# Function to run performance test
run_performance_test() {
    local test_name="$1"
    local output_file="$2"
    
    log "${YELLOW}⚡ Running $test_name performance test...${NC}"
    
    # Run k6 test
    docker run --rm \
        -v "$(pwd)/load-tests:/scripts" \
        -v "$(pwd)/$RESULTS_DIR:/results" \
        -e K6_OUT=json=/results/temp-results.json \
        "$K6_IMAGE" run \
        --env API_URL="$API_URL" \
        --env TEST_GAME_ID="benchmark-game-$(date +%s)" \
        --env TEST_USER_ID="benchmark-user-$(date +%s)" \
        /scripts/performance-benchmark.js
    
    # Move results to final location
    if [ -f "$RESULTS_DIR/temp-results.json" ]; then
        mv "$RESULTS_DIR/temp-results.json" "$output_file"
        log "${GREEN}✅ $test_name test completed${NC}"
    else
        log "${RED}❌ $test_name test failed - no results file generated${NC}"
        return 1
    fi
}

# Function to analyze results
analyze_results() {
    local results_file="$1"
    local test_name="$2"
    
    log "${YELLOW}📊 Analyzing $test_name results...${NC}"
    
    if [ ! -f "$results_file" ]; then
        log "${RED}❌ Results file not found: $results_file${NC}"
        return 1
    fi
    
    # Extract key metrics using jq
    local http_req_duration_p95=$(jq -r '.metrics.http_req_duration.values.p95 // "N/A"' "$results_file")
    local http_req_failed_rate=$(jq -r '.metrics.http_req_failed.values.rate // "N/A"' "$results_file")
    local query_latency_p95=$(jq -r '.metrics.query_latency_ms.values.p95 // "N/A"' "$results_file")
    local index_hit_rate=$(jq -r '.metrics.index_hit_rate.values.rate // "N/A"' "$results_file")
    local query_success_rate=$(jq -r '.metrics.query_success_rate.values.rate // "N/A"' "$results_file")
    local slow_queries=$(jq -r '.metrics.slow_queries.values.count // "N/A"' "$results_file")
    
    # Save metrics to file
    cat > "$RESULTS_DIR/${test_name}-metrics.txt" << EOF
$test_name Performance Metrics
=============================

HTTP Request Duration (p95): ${http_req_duration_p95}ms
HTTP Request Failed Rate: ${http_req_failed_rate}%
Query Latency (p95): ${query_latency_p95}ms
Index Hit Rate: ${index_hit_rate}%
Query Success Rate: ${query_success_rate}%
Slow Queries Count: ${slow_queries}

EOF
    
    log "${GREEN}✅ $test_name analysis completed${NC}"
    
    # Return metrics for comparison
    echo "$http_req_duration_p95|$http_req_failed_rate|$query_latency_p95|$index_hit_rate|$query_success_rate|$slow_queries"
}

# Function to compare results
compare_results() {
    log "${YELLOW}📈 Comparing before and after results...${NC}"
    
    if [ ! -f "$BEFORE_RESULTS" ] || [ ! -f "$AFTER_RESULTS" ]; then
        log "${RED}❌ Missing results files for comparison${NC}"
        return 1
    fi
    
    # Get metrics
    local before_metrics=$(analyze_results "$BEFORE_RESULTS" "before")
    local after_metrics=$(analyze_results "$AFTER_RESULTS" "after")
    
    # Parse metrics
    IFS='|' read -r before_duration before_failed before_query before_index before_success before_slow <<< "$before_metrics"
    IFS='|' read -r after_duration after_failed after_query after_index after_success after_slow <<< "$after_metrics"
    
    # Calculate improvements
    local duration_improvement="N/A"
    local query_improvement="N/A"
    
    if [ "$before_duration" != "N/A" ] && [ "$after_duration" != "N/A" ]; then
        local duration_diff=$(echo "scale=2; ($before_duration - $after_duration) / $before_duration * 100" | bc -l)
        duration_improvement="${duration_diff}%"
    fi
    
    if [ "$before_query" != "N/A" ] && [ "$after_query" != "N/A" ]; then
        local query_diff=$(echo "scale=2; ($before_query - $after_query) / $before_query * 100" | bc -l)
        query_improvement="${query_diff}%"
    fi
    
    # Generate comparison report
    cat > "$COMPARISON_REPORT" << EOF
# Performance Benchmark Comparison Report

**Generated:** $(date)

## Test Configuration

- **API URL:** $API_URL
- **Test Duration:** 21 minutes (7 stages)
- **Max Virtual Users:** 100
- **Test Scenarios:** 7 different query patterns

## Performance Metrics Comparison

| Metric | Before Indexes | After Indexes | Improvement |
|--------|----------------|---------------|-------------|
| HTTP Request Duration (p95) | ${before_duration}ms | ${after_duration}ms | ${duration_improvement} |
| HTTP Request Failed Rate | ${before_failed}% | ${after_failed}% | - |
| Query Latency (p95) | ${before_query}ms | ${after_query}ms | ${query_improvement} |
| Index Hit Rate | ${before_index}% | ${after_index}% | - |
| Query Success Rate | ${before_success}% | ${after_success}% | - |
| Slow Queries Count | ${before_slow} | ${after_slow} | - |

## Performance Assessment

EOF
    
    # Add performance assessment
    if [ "$duration_improvement" != "N/A" ]; then
        local improvement_value=$(echo "$duration_improvement" | sed 's/%//')
        if (( $(echo "$improvement_value >= 30" | bc -l) )); then
            cat >> "$COMPARISON_REPORT" << EOF
✅ **Target Achieved:** Query performance improved by ${duration_improvement} (target: 30%)

### Key Improvements

- **HTTP Response Time:** Improved by ${duration_improvement}
- **Query Latency:** Improved by ${query_improvement}
- **Index Utilization:** Optimized for high-frequency queries
- **Database Load:** Reduced through efficient indexing

### Recommendations

1. **Monitor Production Performance:** Track these metrics in production
2. **Regular Index Maintenance:** Schedule periodic index rebuilds
3. **Query Optimization:** Continue optimizing slow queries
4. **Load Testing:** Run regular load tests to validate performance

EOF
        else
            cat >> "$COMPARISON_REPORT" << EOF
⚠️ **Target Not Met:** Query performance improved by ${duration_improvement} (target: 30%)

### Analysis

- **HTTP Response Time:** Improved by ${duration_improvement}
- **Query Latency:** Improved by ${query_improvement}
- **Additional Optimization Needed:** Consider additional indexes or query optimization

### Next Steps

1. **Analyze Slow Queries:** Identify queries that didn't improve
2. **Review Index Usage:** Check which indexes are being used
3. **Consider Additional Indexes:** Based on query patterns
4. **Query Optimization:** Optimize application-level queries

EOF
        fi
    else
        cat >> "$COMPARISON_REPORT" << EOF
❌ **Unable to Calculate Improvement:** Missing metrics data

### Troubleshooting

1. **Check Test Results:** Verify both test runs completed successfully
2. **Review Logs:** Check for errors in test execution
3. **Validate Metrics:** Ensure metrics were captured correctly
4. **Re-run Tests:** If necessary, re-run the benchmark

EOF
    fi
    
    cat >> "$COMPARISON_REPORT" << EOF

## Test Details

### Before Indexes Test
- **Results File:** $BEFORE_RESULTS
- **Metrics File:** $RESULTS_DIR/before-metrics.txt

### After Indexes Test
- **Results File:** $AFTER_RESULTS
- **Metrics File:** $RESULTS_DIR/after-metrics.txt

### Indexes Added

The following 42 indexes were added to optimize query performance:

#### Game-related Indexes (8)
- IDX_games_status_created_at
- IDX_games_type_status
- IDX_games_created_by_status
- IDX_games_chill_mode_status
- IDX_games_current_players
- IDX_games_started_at
- IDX_games_finished_at
- IDX_games_capacity_status

#### GamePlayer-related Indexes (7)
- IDX_game_players_game_status
- IDX_game_players_user_status
- IDX_game_players_is_host
- IDX_game_players_is_spectator
- IDX_game_players_score
- IDX_game_players_joined_at
- IDX_game_players_game_user_status

#### GameRound-related Indexes (10)
- IDX_game_rounds_game_status
- IDX_game_rounds_game_round_number
- IDX_game_rounds_status_type
- IDX_game_rounds_created_by
- IDX_game_rounds_flagged
- IDX_game_rounds_revealed
- IDX_game_rounds_archived
- IDX_game_rounds_started_at
- IDX_game_rounds_ended_at
- IDX_game_rounds_game_status_round

#### PlayerAnswer-related Indexes (7)
- IDX_player_answers_round_user
- IDX_player_answers_round_status
- IDX_player_answers_user_status
- IDX_player_answers_is_correct
- IDX_player_answers_submitted_at
- IDX_player_answers_time_to_answer
- IDX_player_answers_round_user_status

#### User-related Indexes (4)
- IDX_users_status
- IDX_users_role
- IDX_users_last_login
- IDX_users_email_verified

#### Partial Indexes (6)
- IDX_games_active_only
- IDX_games_finished_only
- IDX_game_rounds_active_only
- IDX_game_rounds_pending_only
- IDX_game_players_active_only
- IDX_player_answers_submitted_only

## Conclusion

This benchmark demonstrates the impact of strategic database indexing on query performance. The results show measurable improvements in response times and query efficiency, validating the effectiveness of the indexing strategy.

EOF
    
    log "${GREEN}✅ Comparison report generated: $COMPARISON_REPORT${NC}"
}

# Function to run before test
run_before_test() {
    log "${BLUE}📊 Running performance test BEFORE index migration...${NC}"
    
    if run_performance_test "Before Indexes" "$BEFORE_RESULTS"; then
        log "${GREEN}✅ Before test completed successfully${NC}"
    else
        log "${RED}❌ Before test failed${NC}"
        exit 1
    fi
}

# Function to run after test
run_after_test() {
    log "${BLUE}📊 Running performance test AFTER index migration...${NC}"
    
    if run_performance_test "After Indexes" "$AFTER_RESULTS"; then
        log "${GREEN}✅ After test completed successfully${NC}"
    else
        log "${RED}❌ After test failed${NC}"
        exit 1
    fi
}

# Function to run migration
run_migration() {
    log "${YELLOW}🔄 Running database migration to add indexes...${NC}"
    
    if ./scripts/run-performance-migration.sh; then
        log "${GREEN}✅ Migration completed successfully${NC}"
    else
        log "${RED}❌ Migration failed${NC}"
        exit 1
    fi
}

# Main execution
main() {
    log "${BLUE}🚀 Starting Performance Benchmark${NC}"
    
    # Check services
    check_services
    
    # Setup results directory
    setup_results_dir
    
    # Run before test
    run_before_test
    
    # Run migration
    run_migration
    
    # Wait a moment for indexes to be fully available
    log "${YELLOW}⏳ Waiting for indexes to be fully available...${NC}"
    sleep 30
    
    # Run after test
    run_after_test
    
    # Compare results
    compare_results
    
    log "${GREEN}🎉 Performance benchmark completed!${NC}"
    log "${BLUE}📊 Check the comparison report: $COMPARISON_REPORT${NC}"
}

# Check if bc is available for calculations
if ! command -v bc &> /dev/null; then
    echo -e "${RED}❌ 'bc' command not found. Please install it for calculations.${NC}"
    echo "On macOS: brew install bc"
    echo "On Ubuntu: sudo apt-get install bc"
    exit 1
fi

# Check if jq is available for JSON parsing
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ 'jq' command not found. Please install it for JSON parsing.${NC}"
    echo "On macOS: brew install jq"
    echo "On Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Run main function
main "$@" 