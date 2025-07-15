#!/bin/bash

set -e

echo "🔒 Running OWASP ZAP Security Scan..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
STAGING_URL=${STAGING_URL:-"https://staging.party-puzzle-palooza.com"}
API_URL="${STAGING_URL}/api"
WEB_URL="${STAGING_URL}"
SCAN_DURATION=${SCAN_DURATION:-300}  # 5 minutes
ZAP_PORT=${ZAP_PORT:-8080}
ZAP_HOST=${ZAP_HOST:-"localhost"}

# Create results directory
mkdir -p security-scan-results

# Function to check if ZAP is running
check_zap() {
    if curl -s "http://${ZAP_HOST}:${ZAP_PORT}/" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start ZAP
start_zap() {
    print_status "Starting OWASP ZAP..."
    
    # Check if ZAP is already running
    if check_zap; then
        print_warning "ZAP is already running on ${ZAP_HOST}:${ZAP_PORT}"
        return 0
    fi
    
    # Start ZAP in daemon mode
    docker run -d \
        --name zap-security-scan \
        -p ${ZAP_PORT}:8080 \
        -v $(pwd)/security-scan-results:/zap/wrk \
        -u zap \
        owasp/zap2docker-stable \
        zap.sh -daemon -host 0.0.0.0 -port 8080 -config api.addrs.addr.name=.* -config api.addrs.addr.regex=true -config api.addrs.addr.value=true -config api.key=test-key
    
    # Wait for ZAP to start
    print_status "Waiting for ZAP to start..."
    for i in {1..30}; do
        if check_zap; then
            print_success "ZAP started successfully"
            return 0
        fi
        sleep 2
    done
    
    print_error "Failed to start ZAP"
    return 1
}

# Function to run passive scan
run_passive_scan() {
    print_status "Running passive security scan..."
    
    # Spider the application
    print_status "Spidering application..."
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/spider/action/scan/" \
        -d "url=${WEB_URL}" \
        -d "maxChildren=10" \
        -d "recurse=true" \
        -d "contextName=party-puzzle-palooza" \
        -d "subtreeOnly=false"
    
    # Wait for spider to complete
    print_status "Waiting for spider to complete..."
    sleep 30
    
    # Run passive scan
    print_status "Running passive scan..."
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/pscan/action/scan/" \
        -d "url=${WEB_URL}"
    
    # Wait for passive scan
    print_status "Waiting for passive scan to complete..."
    sleep 60
}

# Function to run active scan
run_active_scan() {
    print_status "Running active security scan..."
    
    # Run active scan
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/ascan/action/scan/" \
        -d "url=${WEB_URL}" \
        -d "recurse=true" \
        -d "inScopeOnly=true" \
        -d "scanPolicyName=Default Policy" \
        -d "method=GET" \
        -d "postData="
    
    # Wait for active scan
    print_status "Active scan running for ${SCAN_DURATION} seconds..."
    sleep ${SCAN_DURATION}
}

# Function to check for PII leakage
check_pii_leakage() {
    print_status "Checking for PII leakage..."
    
    # Get alerts
    ALERTS=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/action/alerts/" \
        -d "baseurl=${WEB_URL}")
    
    # Check for PII-related alerts
    PII_ALERTS=$(echo "$ALERTS" | jq -r '.alerts[] | select(.risk == "High" or .risk == "Medium") | select(.name | test("PII|Personal|Email|Phone|Address|SSN|Credit|Password", "i")) | .name' 2>/dev/null || echo "")
    
    if [ -n "$PII_ALERTS" ]; then
        print_error "PII leakage detected:"
        echo "$PII_ALERTS"
        return 1
    else
        print_success "No PII leakage detected"
        return 0
    fi
}

# Function to check for UUID leakage
check_uuid_leakage() {
    print_status "Checking for UUID leakage..."
    
    # Get all alerts
    ALERTS=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/action/alerts/" \
        -d "baseurl=${WEB_URL}")
    
    # Check for UUID patterns in responses
    UUID_ALERTS=$(echo "$ALERTS" | jq -r '.alerts[] | select(.evidence | test("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "i")) | .name' 2>/dev/null || echo "")
    
    if [ -n "$UUID_ALERTS" ]; then
        print_error "UUID leakage detected:"
        echo "$UUID_ALERTS"
        return 1
    else
        print_success "No UUID leakage detected"
        return 0
    fi
}

# Function to check for cross-game data leakage
check_cross_game_leakage() {
    print_status "Checking for cross-game data leakage..."
    
    # Create test games and check for data isolation
    print_status "Creating test games for isolation testing..."
    
    # Create first game
    GAME1_RESPONSE=$(curl -s -X POST "${API_URL}/games" \
        -H "Content-Type: application/json" \
        -d '{"name":"Test Game 1","maxPlayers":2,"chillMode":false}')
    
    GAME1_ID=$(echo "$GAME1_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")
    
    if [ -z "$GAME1_ID" ]; then
        print_error "Failed to create test game 1"
        return 1
    fi
    
    # Create second game
    GAME2_RESPONSE=$(curl -s -X POST "${API_URL}/games" \
        -H "Content-Type: application/json" \
        -d '{"name":"Test Game 2","maxPlayers":2,"chillMode":false}')
    
    GAME2_ID=$(echo "$GAME2_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")
    
    if [ -z "$GAME2_ID" ]; then
        print_error "Failed to create test game 2"
        return 1
    fi
    
    # Join players to both games
    PLAYER1_TOKEN=$(curl -s -X POST "${API_URL}/games/${GAME1_ID}/join" \
        -H "Content-Type: application/json" \
        -d '{"name":"Player1","avatar":"🐰"}' | jq -r '.token' 2>/dev/null || echo "")
    
    PLAYER2_TOKEN=$(curl -s -X POST "${API_URL}/games/${GAME2_ID}/join" \
        -H "Content-Type: application/json" \
        -d '{"name":"Player2","avatar":"🐻"}' | jq -r '.token' 2>/dev/null || echo "")
    
    # Try to access game 1 data with game 2 token
    GAME1_MANIFEST=$(curl -s -X GET "${API_URL}/games/${GAME1_ID}/manifest" \
        -H "Cookie: player_token=${PLAYER2_TOKEN}")
    
    # Check if unauthorized access is possible
    if echo "$GAME1_MANIFEST" | jq -e '.players' > /dev/null 2>&1; then
        print_error "Cross-game data leakage detected! Player from game 2 can access game 1 data"
        return 1
    else
        print_success "Cross-game data isolation verified"
        return 0
    fi
}

# Function to generate report
generate_report() {
    print_status "Generating security report..."
    
    # Get all alerts
    ALERTS=$(curl -s "http://${ZAP_HOST}:${ZAP_PORT}/JSON/core/action/alerts/" \
        -d "baseurl=${WEB_URL}")
    
    # Generate HTML report
    curl -s "http://${ZAP_HOST}:${ZAP_PORT}/OTHER/core/other/htmlreport/" \
        -d "baseurl=${WEB_URL}" > security-scan-results/zap-report.html
    
    # Generate JSON report
    echo "$ALERTS" > security-scan-results/zap-alerts.json
    
    # Generate summary
    cat > security-scan-results/security-summary.md << EOF
# Security Scan Summary

**Scan Date:** $(date)
**Target URL:** ${STAGING_URL}
**Scan Duration:** ${SCAN_DURATION} seconds

## Scan Results

### High Risk Issues
$(echo "$ALERTS" | jq -r '.alerts[] | select(.risk == "High") | "- " + .name' 2>/dev/null || echo "None found")

### Medium Risk Issues
$(echo "$ALERTS" | jq -r '.alerts[] | select(.risk == "Medium") | "- " + .name' 2>/dev/null || echo "None found")

### Low Risk Issues
$(echo "$ALERTS" | jq -r '.alerts[] | select(.risk == "Low") | "- " + .name' 2>/dev/null || echo "None found")

### Informational Issues
$(echo "$ALERTS" | jq -r '.alerts[] | select(.risk == "Informational") | "- " + .name' 2>/dev/null || echo "None found")

## PII and UUID Leakage Check
- PII Leakage: $(if check_pii_leakage > /dev/null; then echo "✅ None detected"; else echo "❌ Detected"; fi)
- UUID Leakage: $(if check_uuid_leakage > /dev/null; then echo "✅ None detected"; else echo "❌ Detected"; fi)
- Cross-Game Leakage: $(if check_cross_game_leakage > /dev/null; then echo "✅ None detected"; else echo "❌ Detected"; fi)

## Recommendations
1. Review all High and Medium risk issues
2. Implement additional security headers
3. Consider implementing rate limiting
4. Review authentication mechanisms
5. Implement proper CORS policies

## Files Generated
- \`zap-report.html\` - Detailed HTML report
- \`zap-alerts.json\` - Raw alert data
- \`security-summary.md\` - This summary
EOF
    
    print_success "Security report generated in security-scan-results/"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Stop ZAP container
    docker stop zap-security-scan 2>/dev/null || true
    docker rm zap-security-scan 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting security scan against ${STAGING_URL}"
    
    # Check if staging URL is accessible
    if ! curl -s -f "${STAGING_URL}/health" > /dev/null 2>&1; then
        print_error "Staging URL ${STAGING_URL} is not accessible"
        exit 1
    fi
    
    # Start ZAP
    if ! start_zap; then
        exit 1
    fi
    
    # Run scans
    run_passive_scan
    run_active_scan
    
    # Check for specific issues
    PII_ISSUES=false
    UUID_ISSUES=false
    CROSS_GAME_ISSUES=false
    
    if ! check_pii_leakage; then
        PII_ISSUES=true
    fi
    
    if ! check_uuid_leakage; then
        UUID_ISSUES=true
    fi
    
    if ! check_cross_game_leakage; then
        CROSS_GAME_ISSUES=true
    fi
    
    # Generate report
    generate_report
    
    # Cleanup
    cleanup
    
    # Exit with appropriate code
    if [ "$PII_ISSUES" = true ] || [ "$UUID_ISSUES" = true ] || [ "$CROSS_GAME_ISSUES" = true ]; then
        print_error "Security issues detected! Check the report for details."
        exit 1
    else
        print_success "Security scan completed successfully! No critical issues found."
        exit 0
    fi
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main 