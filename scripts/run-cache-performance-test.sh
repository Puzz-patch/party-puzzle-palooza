#!/bin/bash

# Cache Performance Test Runner
# Validates cache hit rate target of 80% in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
TEST_DURATION=${TEST_DURATION:-"20m"}
MAX_VUS=${MAX_VUS:-100}
TARGET_HIT_RATE=${TARGET_HIT_RATE:-80}
RESULTS_DIR="cache-performance-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🎯 Cache Performance Test Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Target Hit Rate: ${GREEN}${TARGET_HIT_RATE}%${NC}"
echo -e "Test Duration: ${GREEN}${TEST_DURATION}${NC}"
echo -e "Max Virtual Users: ${GREEN}${MAX_VUS}${NC}"
echo -e "API URL: ${GREEN}${API_URL}${NC}"
echo ""

# Create results directory
mkdir -p "${RESULTS_DIR}"

# Function to check if API is available
check_api_health() {
    echo -e "${YELLOW}🔍 Checking API health...${NC}"
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "${API_URL}/health" > /dev/null; then
            echo -e "${GREEN}✅ API is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Waiting for API to be ready... (attempt ${attempt}/${max_attempts})${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ API health check failed after ${max_attempts} attempts${NC}"
    return 1
}

# Function to check cache service
check_cache_service() {
    echo -e "${YELLOW}🔍 Checking cache service...${NC}"
    
    if curl -s -f "${API_URL}/cache/health" > /dev/null; then
        echo -e "${GREEN}✅ Cache service is healthy${NC}"
        
        # Get cache status
        local cache_status=$(curl -s "${API_URL}/cache/status" | jq -r '.status // "unknown"')
        echo -e "${BLUE}📊 Cache Status: ${cache_status}${NC}"
        
        return 0
    else
        echo -e "${RED}❌ Cache service is not available${NC}"
        return 1
    fi
}

# Function to clear cache before test
clear_cache() {
    echo -e "${YELLOW}🧹 Clearing cache before test...${NC}"
    
    if curl -s -X DELETE "${API_URL}/cache/clear" > /dev/null; then
        echo -e "${GREEN}✅ Cache cleared successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to clear cache (continuing anyway)${NC}"
    fi
}

# Function to run cache performance test
run_cache_test() {
    echo -e "${YELLOW}🚀 Starting cache performance test...${NC}"
    
    local test_file="load-tests/cache-performance-test.js"
    local results_file="${RESULTS_DIR}/cache-test-${TIMESTAMP}.json"
    
    # Set environment variables for k6
    export API_URL="${API_URL}"
    export TEST_GAME_ID="cache-test-game-${TIMESTAMP}"
    export TEST_USER_ID="cache-test-user-${TIMESTAMP}"
    
    # Run k6 test
    k6 run \
        --out json="${results_file}" \
        --env API_URL="${API_URL}" \
        --env TEST_GAME_ID="${TEST_GAME_ID}" \
        --env TEST_USER_ID="${TEST_USER_ID}" \
        "${test_file}"
    
    return $?
}

# Function to analyze results
analyze_results() {
    echo -e "${YELLOW}📊 Analyzing test results...${NC}"
    
    local results_file="${RESULTS_DIR}/cache-test-${TIMESTAMP}.json"
    local summary_file="${RESULTS_DIR}/cache-performance-summary.json"
    
    if [ ! -f "${results_file}" ]; then
        echo -e "${RED}❌ Test results file not found: ${results_file}${NC}"
        return 1
    fi
    
    # Extract metrics from k6 results
    local hit_rate=$(jq -r '.metrics.cache_hit_rate.rate // 0' "${results_file}")
    local miss_rate=$(jq -r '.metrics.cache_miss_rate.rate // 0' "${results_file}")
    local avg_response_with_cache=$(jq -r '.metrics.response_time_with_cache.avg // 0' "${results_file}")
    local avg_response_without_cache=$(jq -r '.metrics.response_time_without_cache.avg // 0' "${results_file}")
    local total_requests=$(jq -r '.metrics.http_reqs.count // 0' "${results_file}")
    local error_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "${results_file}")
    
    # Calculate hit rate percentage
    local hit_rate_percent=$(echo "${hit_rate} * 100" | bc -l)
    
    # Check if target is met
    local target_met=false
    if (( $(echo "${hit_rate_percent} >= ${TARGET_HIT_RATE}" | bc -l) )); then
        target_met=true
    fi
    
    # Generate summary
    cat > "${summary_file}" << EOF
{
  "test_timestamp": "${TIMESTAMP}",
  "target_hit_rate": ${TARGET_HIT_RATE},
  "actual_hit_rate": ${hit_rate_percent},
  "target_met": ${target_met},
  "metrics": {
    "hit_rate": ${hit_rate},
    "miss_rate": ${miss_rate},
    "avg_response_with_cache_ms": ${avg_response_with_cache},
    "avg_response_without_cache_ms": ${avg_response_without_cache},
    "total_requests": ${total_requests},
    "error_rate": ${error_rate}
  },
  "performance_improvement": {
    "response_time_reduction_percent": $(echo "(${avg_response_without_cache} - ${avg_response_with_cache}) / ${avg_response_without_cache} * 100" | bc -l),
    "cache_effectiveness": $(echo "${avg_response_without_cache} / ${avg_response_with_cache}" | bc -l)
  },
  "recommendations": [
    $(if [ "$target_met" = false ]; then
      echo '"Increase cache TTL for frequently accessed data",'
      echo '"Add more cacheable endpoints",'
      echo '"Review cache invalidation patterns",'
      echo '"Optimize cache key generation"'
    else
      echo '"Cache performance target achieved - monitor for degradation"'
    fi)
  ]
}
EOF
    
    # Display results
    echo -e "${BLUE}📈 Test Results Summary${NC}"
    echo -e "${BLUE}======================${NC}"
    echo -e "Target Hit Rate: ${GREEN}${TARGET_HIT_RATE}%${NC}"
    echo -e "Actual Hit Rate: ${GREEN}${hit_rate_percent}%${NC}"
    echo -e "Total Requests: ${GREEN}${total_requests}${NC}"
    echo -e "Error Rate: ${GREEN}${error_rate}%${NC}"
    echo -e "Avg Response (with cache): ${GREEN}${avg_response_with_cache}ms${NC}"
    echo -e "Avg Response (without cache): ${GREEN}${avg_response_without_cache}ms${NC}"
    
    if [ "$target_met" = true ]; then
        echo -e "${GREEN}🎉 SUCCESS: Cache hit rate target achieved!${NC}"
    else
        echo -e "${RED}❌ FAILED: Cache hit rate target not met${NC}"
        echo -e "${YELLOW}💡 Recommendations:${NC}"
        echo -e "   - Increase cache TTL for frequently accessed data"
        echo -e "   - Add more cacheable endpoints"
        echo -e "   - Review cache invalidation patterns"
        echo -e "   - Optimize cache key generation"
    fi
    
    echo ""
    echo -e "${BLUE}📁 Results saved to:${NC}"
    echo -e "   ${results_file}"
    echo -e "   ${summary_file}"
}

# Function to generate performance report
generate_report() {
    echo -e "${YELLOW}📋 Generating performance report...${NC}"
    
    local report_file="${RESULTS_DIR}/cache-performance-report-${TIMESTAMP}.md"
    local summary_file="${RESULTS_DIR}/cache-performance-summary.json"
    
    if [ ! -f "${summary_file}" ]; then
        echo -e "${RED}❌ Summary file not found${NC}"
        return 1
    fi
    
    local target_hit_rate=$(jq -r '.target_hit_rate' "${summary_file}")
    local actual_hit_rate=$(jq -r '.actual_hit_rate' "${summary_file}")
    local target_met=$(jq -r '.target_met' "${summary_file}")
    local total_requests=$(jq -r '.metrics.total_requests' "${summary_file}")
    local error_rate=$(jq -r '.metrics.error_rate' "${summary_file}")
    local avg_response_with_cache=$(jq -r '.metrics.avg_response_with_cache_ms' "${summary_file}")
    local avg_response_without_cache=$(jq -r '.metrics.avg_response_without_cache_ms' "${summary_file}")
    local response_time_reduction=$(jq -r '.performance_improvement.response_time_reduction_percent' "${summary_file}")
    
    cat > "${report_file}" << EOF
# Cache Performance Test Report

**Generated:** $(date)
**Test Duration:** ${TEST_DURATION}
**Max Virtual Users:** ${MAX_VUS}
**API URL:** ${API_URL}

## Executive Summary

- **Target Hit Rate:** ${target_hit_rate}%
- **Actual Hit Rate:** ${actual_hit_rate}%
- **Target Met:** ${target_met}
- **Total Requests:** ${total_requests}
- **Error Rate:** ${error_rate}%

## Performance Metrics

### Cache Effectiveness
- **Response Time (with cache):** ${avg_response_with_cache}ms
- **Response Time (without cache):** ${avg_response_without_cache}ms
- **Performance Improvement:** ${response_time_reduction}%

### Cache Hit Rate Analysis
$(if [ "$target_met" = true ]; then
    echo "- ✅ **SUCCESS:** Cache hit rate target of ${target_hit_rate}% achieved"
    echo "- 🎯 **Performance:** Excellent cache utilization"
else
    echo "- ❌ **FAILED:** Cache hit rate target of ${target_hit_rate}% not met"
    echo "- 📉 **Current Performance:** ${actual_hit_rate}% hit rate"
fi)

## Recommendations

$(jq -r '.recommendations[]' "${summary_file}" | sed 's/^/- /')

## Test Configuration

- **Test Duration:** ${TEST_DURATION}
- **Max Virtual Users:** ${MAX_VUS}
- **Target Hit Rate:** ${target_hit_rate}%
- **API Endpoint:** ${API_URL}

## Next Steps

$(if [ "$target_met" = true ]; then
    echo "1. ✅ Monitor cache performance in production"
    echo "2. 📊 Set up automated cache performance alerts"
    echo "3. 🔄 Schedule regular cache performance tests"
else
    echo "1. 🔧 Implement recommended optimizations"
    echo "2. 📈 Increase cache TTL for frequently accessed data"
    echo "3. 🎯 Add more cacheable endpoints"
    echo "4. 🔄 Re-run performance test after optimizations"
fi)
EOF
    
    echo -e "${GREEN}✅ Performance report generated: ${report_file}${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting cache performance validation...${NC}"
    
    # Check API health
    if ! check_api_health; then
        exit 1
    fi
    
    # Check cache service
    if ! check_cache_service; then
        echo -e "${YELLOW}⚠️  Cache service not available, but continuing with test${NC}"
    fi
    
    # Clear cache
    clear_cache
    
    # Run test
    if run_cache_test; then
        echo -e "${GREEN}✅ Cache performance test completed successfully${NC}"
    else
        echo -e "${RED}❌ Cache performance test failed${NC}"
        exit 1
    fi
    
    # Analyze results
    analyze_results
    
    # Generate report
    generate_report
    
    echo -e "${GREEN}🎉 Cache performance validation completed!${NC}"
}

# Run main function
main "$@" 