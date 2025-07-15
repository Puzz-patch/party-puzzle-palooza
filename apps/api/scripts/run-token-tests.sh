#!/bin/bash

# Token Integrity Test Runner
# This script runs comprehensive tests to ensure no action allows player tokens to go below 0

set -e

echo "🧪 Running Token Integrity Tests..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests and check results
run_test_suite() {
    local test_file=$1
    local test_name=$2
    
    echo -e "\n${YELLOW}Running $test_name...${NC}"
    
    if npm test -- --testPathPattern="$test_file" --verbose; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Track overall success
overall_success=true

# Run individual test suites
echo -e "\n${YELLOW}1. Shot Service Token Tests${NC}"
if run_test_suite "shot.service.test.ts" "Shot Service Token Integrity"; then
    echo "   - Overspend prevention ✓"
    echo "   - Balance validation ✓"
    echo "   - Ledger integrity ✓"
    echo "   - Chill mode handling ✓"
else
    overall_success=false
fi

echo -e "\n${YELLOW}2. Player Action Service Tests${NC}"
if run_test_suite "player-action.service.test.ts" "Player Action Service"; then
    echo "   - No token deduction ✓"
    echo "   - Action validation ✓"
    echo "   - Transaction integrity ✓"
else
    overall_success=false
fi

echo -e "\n${YELLOW}3. Integration Tests${NC}"
if run_test_suite "token-integrity.integration.test.ts" "Token Integrity Integration"; then
    echo "   - Cross-service integrity ✓"
    echo "   - Race condition handling ✓"
    echo "   - Edge case scenarios ✓"
else
    overall_success=false
fi

# Run specific test patterns
echo -e "\n${YELLOW}4. Specific Token Tests${NC}"

echo "   Testing overspend prevention..."
if npm test -- --testNamePattern="should prevent shot when bet amount exceeds balance" --verbose; then
    echo -e "   ${GREEN}✓ Overspend prevention${NC}"
else
    echo -e "   ${RED}✗ Overspend prevention${NC}"
    overall_success=false
fi

echo "   Testing zero balance handling..."
if npm test -- --testNamePattern="should handle zero balance correctly" --verbose; then
    echo -e "   ${GREEN}✓ Zero balance handling${NC}"
else
    echo -e "   ${RED}✗ Zero balance handling${NC}"
    overall_success=false
fi

echo "   Testing ledger integrity..."
if npm test -- --testNamePattern="should create accurate transaction ledger entry" --verbose; then
    echo -e "   ${GREEN}✓ Ledger integrity${NC}"
else
    echo -e "   ${RED}✗ Ledger integrity${NC}"
    overall_success=false
fi

echo "   Testing action token independence..."
if npm test -- --testNamePattern="should not affect token balances for roll action" --verbose; then
    echo -e "   ${GREEN}✓ Action token independence${NC}"
else
    echo -e "   ${RED}✗ Action token independence${NC}"
    overall_success=false
fi

# Summary
echo -e "\n${YELLOW}=================================="
echo "Token Integrity Test Summary"
echo "==================================${NC}"

if [ "$overall_success" = true ]; then
    echo -e "${GREEN}🎉 All token integrity tests passed!${NC}"
    echo ""
    echo "✅ No action allows player.tokens < 0"
    echo "✅ Overspend scenarios are properly handled"
    echo "✅ Ledger integrity is maintained"
    echo "✅ Chill mode respects token rules"
    echo "✅ Player actions don't affect token balances"
    echo "✅ Race conditions are prevented"
    echo "✅ Edge cases are handled correctly"
    exit 0
else
    echo -e "${RED}💥 Some token integrity tests failed!${NC}"
    echo ""
    echo "Please review the failed tests above and ensure:"
    echo "❌ No action allows player.tokens < 0"
    echo "❌ Overspend scenarios are properly handled"
    echo "❌ Ledger integrity is maintained"
    exit 1
fi 