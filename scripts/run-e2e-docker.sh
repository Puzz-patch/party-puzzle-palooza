#!/bin/bash

set -e

echo "🧪 Running E2E tests in Docker..."

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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create test results directory
mkdir -p test-results

# Stop any existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.e2e.yml down -v 2>/dev/null || true

# Build and start the E2E test environment
print_status "Building and starting E2E test environment..."
docker-compose -f docker-compose.e2e.yml up -d --build

# Wait for services to be healthy
print_status "Waiting for services to be ready..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
until docker exec party-puzzle-palooza-postgres-e2e pg_isready -U postgres -d party_puzzle_palooza_e2e; do
    echo "⏳ Waiting for PostgreSQL..."
    sleep 5
done
print_success "PostgreSQL is ready"

# Wait for Redis
print_status "Waiting for Redis..."
until docker exec party-puzzle-palooza-redis-e2e redis-cli ping; do
    echo "⏳ Waiting for Redis..."
    sleep 5
done
print_success "Redis is ready"

# Wait for API server
print_status "Waiting for API server..."
until curl -f http://localhost:3002/health 2>/dev/null; do
    echo "⏳ Waiting for API server..."
    sleep 5
done
print_success "API server is ready"

# Wait for Web server
print_status "Waiting for Web server..."
until curl -f http://localhost:5174 2>/dev/null; do
    echo "⏳ Waiting for Web server..."
    sleep 5
done
print_success "Web server is ready"

# Setup test database
print_status "Setting up test database..."
docker exec party-puzzle-palooza-postgres-e2e psql -U postgres -d party_puzzle_palooza_e2e -c "
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
"

# Run database migrations
print_status "Running database migrations..."
docker exec party-puzzle-palooza-api-e2e npm run db:migrate || true

# Seed test data
print_status "Seeding test data..."
docker exec party-puzzle-palooza-api-e2e npm run db:seed:demo || true

# Run the E2E tests
print_status "Running E2E tests..."
docker-compose -f docker-compose.e2e.yml run --rm e2e-test

# Check test results
if [ -f test-results/summary.json ]; then
    TEST_STATUS=$(cat test-results/summary.json | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$TEST_STATUS" = "PASSED" ]; then
        print_success "E2E tests passed! 🎉"
        
        # Display test summary
        echo ""
        print_status "Test Summary:"
        cat test-results/summary.json | jq '.' 2>/dev/null || cat test-results/summary.json
        
        # Generate test report
        if [ -f test-results/results.json ]; then
            print_status "Generating test report..."
            npx playwright show-report test-results/ 2>/dev/null || true
        fi
        
    else
        print_error "E2E tests failed! ❌"
        
        # Display error details
        echo ""
        print_status "Error Details:"
        cat test-results/summary.json | jq '.' 2>/dev/null || cat test-results/summary.json
        
        # Show logs
        echo ""
        print_status "Container Logs:"
        docker-compose -f docker-compose.e2e.yml logs api-e2e
        docker-compose -f docker-compose.e2e.yml logs web-e2e
        
        exit 1
    fi
else
    print_error "No test results found!"
    exit 1
fi

# Cleanup
print_status "Cleaning up..."
docker-compose -f docker-compose.e2e.yml down -v

print_success "E2E test run completed!" 