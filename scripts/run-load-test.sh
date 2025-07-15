#!/bin/bash

echo "🚀 Party Puzzle Palooza Load Test"
echo "=================================="

# Configuration
API_URL=${API_URL:-"http://localhost:3001"}
WS_URL=${WS_URL:-"ws://localhost:3001/game"}
TEST_DURATION="14m"  # 2m ramp-up + 10m test + 2m ramp-down
CONCURRENT_USERS=1000
OUTPUT_DIR="load-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📊 Test Configuration:"
echo "  API URL: $API_URL"
echo "  WebSocket URL: $WS_URL"
echo "  Duration: $TEST_DURATION"
echo "  Concurrent Users: $CONCURRENT_USERS"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed. Installing k6..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo "❌ Unsupported OS. Please install k6 manually: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
fi

# Check if API is running
echo "🔍 Checking API availability..."
if ! curl -f "$API_URL/health" > /dev/null 2>&1; then
    echo "❌ API is not accessible at $API_URL"
    echo "Please start the API server first:"
    echo "  cd apps/api && npm run start:dev"
    exit 1
fi

echo "✅ API is accessible"

# Start monitoring collection
echo "📈 Starting monitoring data collection..."

# Start Prometheus metrics collection (if available)
if command -v prometheus &> /dev/null; then
    echo "  - Prometheus metrics collection enabled"
fi

# Start system monitoring
echo "  - System monitoring enabled"
mkdir -p "$OUTPUT_DIR/system-metrics"

# Background process to collect system metrics
(
    while true; do
        timestamp=$(date +"%Y-%m-%d %H:%M:%S")
        
        # CPU usage
        cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
        
        # Memory usage
        memory_info=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        
        # Database connections (if PostgreSQL is running)
        db_connections=$(psql -h localhost -U postgres -d party_puzzle_palooza -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tail -n 1 | tr -d ' ' || echo "0")
        
        # Redis connections
        redis_connections=$(redis-cli client list 2>/dev/null | wc -l || echo "0")
        
        echo "$timestamp,$cpu_usage,$memory_info,$db_connections,$redis_connections" >> "$OUTPUT_DIR/system-metrics/system.csv"
        
        sleep 5
    done
) &
MONITORING_PID=$!

# Run the load test
echo "🚀 Starting k6 load test..."
echo ""

k6 run \
    --env API_URL="$API_URL" \
    --env WS_URL="$WS_URL" \
    --out json="$OUTPUT_DIR/k6-results-$TIMESTAMP.json" \
    --out influxdb=http://localhost:8086/k6 \
    --out prometheus=remote \
    --tag test_name="party-puzzle-palooza-load-test" \
    --tag concurrent_users="$CONCURRENT_USERS" \
    --tag test_duration="$TEST_DURATION" \
    load-tests/k6-load-test.js

TEST_EXIT_CODE=$?

# Stop monitoring
echo ""
echo "🛑 Stopping monitoring..."
kill $MONITORING_PID 2>/dev/null

# Generate report
echo "📊 Generating load test report..."

# Create summary report
cat > "$OUTPUT_DIR/load-test-report-$TIMESTAMP.md" << EOF
# Party Puzzle Palooza Load Test Report

**Test Date:** $(date)
**Duration:** $TEST_DURATION
**Concurrent Users:** $CONCURRENT_USERS
**API URL:** $API_URL
**WebSocket URL:** $WS_URL

## Test Configuration

- **Ramp-up:** 2 minutes to 1,000 users
- **Sustained Load:** 10 minutes at 1,000 users
- **Ramp-down:** 2 minutes to 0 users
- **Total Duration:** 14 minutes

## Performance Thresholds

- HTTP Response Time (p95): < 300ms
- Error Rate: < 5%
- WebSocket Latency (p95): < 100ms
- Room Creation Success Rate: > 95%
- Game Join Success Rate: > 95%

## Results Summary

\`\`\`
$(if [ -f "$OUTPUT_DIR/k6-results-$TIMESTAMP.json" ]; then
    echo "Results file: k6-results-$TIMESTAMP.json"
    echo "System metrics: system-metrics/system.csv"
else
    echo "No results file found"
fi)
\`\`\`

## Key Findings

### Performance Metrics
- **HTTP Response Time (p95):** [To be analyzed]
- **WebSocket Latency (p95):** [To be analyzed]
- **Error Rate:** [To be analyzed]
- **Throughput:** [To be analyzed]

### System Resources
- **CPU Usage:** [To be analyzed]
- **Memory Usage:** [To be analyzed]
- **Database Connections:** [To be analyzed]
- **Redis Connections:** [To be analyzed]

### Business Metrics
- **Room Creation Success Rate:** [To be analyzed]
- **Game Join Success Rate:** [To be analyzed]
- **Question Flag Rate:** [To be analyzed]

## Recommendations

[To be filled based on analysis]

## Next Steps

1. Analyze detailed metrics
2. Identify bottlenecks
3. Optimize performance
4. Re-run tests after optimizations
EOF

# Generate graphs if Python is available
if command -v python3 &> /dev/null; then
    echo "📈 Generating performance graphs..."
    
    cat > "$OUTPUT_DIR/generate-graphs.py" << 'PYTHON_EOF'
import pandas as pd
import matplotlib.pyplot as plt
import json
import sys
from datetime import datetime

def generate_graphs(results_file, system_file, output_dir):
    # Load k6 results
    with open(results_file, 'r') as f:
        k6_data = json.load(f)
    
    # Load system metrics
    system_df = pd.read_csv(system_file, names=['timestamp', 'cpu', 'memory', 'db_connections', 'redis_connections'])
    system_df['timestamp'] = pd.to_datetime(system_df['timestamp'])
    
    # Create graphs
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Party Puzzle Palooza Load Test Results', fontsize=16)
    
    # CPU Usage
    axes[0, 0].plot(system_df['timestamp'], system_df['cpu'])
    axes[0, 0].set_title('CPU Usage')
    axes[0, 0].set_ylabel('CPU %')
    axes[0, 0].tick_params(axis='x', rotation=45)
    
    # Database Connections
    axes[0, 1].plot(system_df['timestamp'], system_df['db_connections'])
    axes[0, 1].set_title('Database Connections')
    axes[0, 1].set_ylabel('Connections')
    axes[0, 1].tick_params(axis='x', rotation=45)
    
    # Redis Connections
    axes[1, 0].plot(system_df['timestamp'], system_df['redis_connections'])
    axes[1, 0].set_title('Redis Connections')
    axes[1, 0].set_ylabel('Connections')
    axes[1, 0].tick_params(axis='x', rotation=45)
    
    # Memory Usage
    axes[1, 1].plot(system_df['timestamp'], system_df['memory'])
    axes[1, 1].set_title('Memory Usage')
    axes[1, 1].set_ylabel('Memory (pages)')
    axes[1, 1].tick_params(axis='x', rotation=45)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/performance-graphs-{datetime.now().strftime("%Y%m%d_%H%M%S")}.png', dpi=300, bbox_inches='tight')
    print(f"Graphs saved to {output_dir}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 generate-graphs.py <k6_results.json> <system_metrics.csv> <output_dir>")
        sys.exit(1)
    
    generate_graphs(sys.argv[1], sys.argv[2], sys.argv[3])
PYTHON_EOF
    
    if [ -f "$OUTPUT_DIR/k6-results-$TIMESTAMP.json" ] && [ -f "$OUTPUT_DIR/system-metrics/system.csv" ]; then
        python3 "$OUTPUT_DIR/generate-graphs.py" \
            "$OUTPUT_DIR/k6-results-$TIMESTAMP.json" \
            "$OUTPUT_DIR/system-metrics/system.csv" \
            "$OUTPUT_DIR"
    fi
fi

# Final summary
echo ""
echo "✅ Load test completed!"
echo ""
echo "📁 Results saved to: $OUTPUT_DIR"
echo "📊 Report: load-test-report-$TIMESTAMP.md"
echo "📈 Data: k6-results-$TIMESTAMP.json"
echo "🖥️  System metrics: system-metrics/system.csv"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All performance thresholds met!"
else
    echo "⚠️  Some performance thresholds were exceeded. Check the report for details."
fi

echo ""
echo "📋 Next steps:"
echo "1. Review the generated report"
echo "2. Analyze performance graphs"
echo "3. Identify optimization opportunities"
echo "4. Re-run tests after improvements" 