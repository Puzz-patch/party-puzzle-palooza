# End-to-End Testing Guide

This document describes the end-to-end (E2E) testing setup for Party Puzzle Palooza, which validates the complete game flow from lobby creation to game finale.

## Overview

The E2E testing system provides:

- **Complete Game Flow Testing** - Validates the entire lobby→finale flow
- **Headless Execution** - Runs without UI for CI/CD pipelines
- **Docker-based Environment** - Isolated test environment
- **Multiple Testing Approaches** - Node.js script and Playwright tests
- **Comprehensive Coverage** - API, WebSocket, database, and UI testing

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   E2E Test      │    │   Test API      │    │   Test Database │
│   Runner        │───▶│   Server        │───▶│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Test Web      │    │   Test Redis    │
│   Server        │    │   (Cache)       │
└─────────────────┘    └─────────────────┘
```

## Test Flow

The E2E test validates the following complete game flow:

1. **Health Check** - Verify all services are running
2. **Game Creation** - Create a new game via API
3. **Player Joining** - Join 4 players to the game
4. **Custom Questions** - Submit custom questions from each player
5. **State Transitions** - Move through game states (lobby → question_build → gameplay)
6. **Round Execution** - Start round, set target, take shot, submit actions
7. **Game Finale** - Complete game and compute scores
8. **WebSocket Testing** - Validate real-time communication
9. **Web Interface** - Test UI interactions with Playwright
10. **Database Integrity** - Verify data consistency

## Running E2E Tests

### Prerequisites

- **Docker** and Docker Compose
- **Node.js** 18+ and pnpm
- **Git**

### Quick Start

```bash
# Run E2E tests in Docker (recommended)
./scripts/run-e2e-docker.sh

# Or run locally with existing services
pnpm run e2e:test
```

### Local Development Testing

```bash
# Start infrastructure services
pnpm run dev:start

# Setup database
pnpm run db:setup

# Seed demo data
pnpm run db:seed:demo

# Run E2E tests
pnpm run e2e:test
```

### Playwright Tests

```bash
# Install Playwright browsers
pnpm run e2e:install

# Run Playwright tests
pnpm run e2e:playwright

# View test report
pnpm run e2e:report
```

## Test Configuration

### Environment Variables

```bash
# API Configuration
API_URL=http://localhost:3001
WEB_URL=http://localhost:5173

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/party_puzzle_palooza_test

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Test Configuration
NODE_ENV=test
JWT_SECRET=e2e-test-jwt-secret
OPENAI_API_KEY=test-key
```

### Docker Configuration

The E2E test environment uses `docker-compose.e2e.yml`:

- **PostgreSQL** - Test database on port 5433
- **Redis** - Test cache on port 6380
- **API Server** - Test API on port 3002
- **Web Server** - Test web app on port 5174
- **E2E Test Runner** - Isolated test container

## Test Components

### 1. Node.js E2E Script (`scripts/e2e-test.js`)

A comprehensive Node.js script that:

- **Tests API Endpoints** - Validates all REST endpoints
- **Simulates Game Flow** - Creates players, submits questions, executes rounds
- **Validates WebSocket** - Tests real-time communication
- **Checks Database** - Verifies data integrity
- **Generates Reports** - Creates test summaries and logs

### 2. Playwright Tests (`tests/e2e/`)

Browser-based tests that:

- **Test UI Interactions** - Validates user interface
- **Simulate User Actions** - Clicks, form submissions, navigation
- **Validate Visual Elements** - Screenshots and visual regression
- **Test Responsiveness** - Mobile and desktop layouts

### 3. GitHub Actions Workflow (`.github/workflows/e2e-test.yml`)

CI/CD integration that:

- **Spins Up Test Environment** - Docker containers in CI
- **Runs Complete Test Suite** - All E2E tests
- **Generates Artifacts** - Test results and reports
- **Handles Failures** - Proper cleanup and error reporting

## Test Scenarios

### Happy Path Testing

```javascript
// Complete game flow
await testHealthCheck();
await testGameCreation();
await testPlayerJoining();
await testCustomQuestionSubmission();
await testGameStateTransition();
await testRoundExecution();
await testGameFinale();
```

### Error Scenarios

- **Invalid Game State Transitions**
- **Rate Limiting**
- **Authentication Failures**
- **Database Connection Issues**
- **WebSocket Disconnections**

### Performance Testing

- **Concurrent Player Joining**
- **Multiple Game Creation**
- **WebSocket Message Throughput**
- **Database Query Performance**

## Test Results

### Output Files

```
test-results/
├── summary.json          # Test execution summary
├── results.json          # Detailed test results
├── results.xml           # JUnit XML format
├── game-flow-complete.png # Screenshot of completed game
├── lobby-screenshot.png  # Screenshot of lobby
└── logs/                 # Detailed test logs
```

### Sample Summary

```json
{
  "status": "PASSED",
  "duration": 45.23,
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "roundId": "550e8400-e29b-41d4-a716-446655440001",
  "playerCount": 4,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Debugging

### Common Issues

1. **Service Startup Timeouts**
   ```bash
   # Check service health
   docker-compose -f docker-compose.e2e.yml ps
   
   # View service logs
   docker-compose -f docker-compose.e2e.yml logs api-e2e
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   docker exec party-puzzle-palooza-postgres-e2e pg_isready -U postgres
   
   # Check database schema
   docker exec party-puzzle-palooza-postgres-e2e psql -U postgres -d party_puzzle_palooza_e2e -c "\dt"
   ```

3. **WebSocket Connection Issues**
   ```bash
   # Test WebSocket endpoint
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" http://localhost:3002/game
   ```

### Debug Mode

```bash
# Run with debug logging
DEBUG=* pnpm run e2e:test

# Run with verbose output
VERBOSE=true pnpm run e2e:test
```

## Integration with CI/CD

### GitHub Actions

The E2E tests run automatically on:

- **Push to main/develop** - Full test suite
- **Pull Requests** - Validate changes
- **Manual Trigger** - On-demand testing

### Local CI

```bash
# Run full CI pipeline locally
./scripts/run-ci-local.sh
```

## Best Practices

### Test Design

1. **Isolation** - Each test should be independent
2. **Cleanup** - Always clean up test data
3. **Timeouts** - Use appropriate timeouts for async operations
4. **Retries** - Implement retry logic for flaky operations

### Performance

1. **Parallel Execution** - Run independent tests in parallel
2. **Resource Limits** - Set appropriate Docker resource limits
3. **Caching** - Cache dependencies and build artifacts
4. **Optimization** - Minimize test execution time

### Maintenance

1. **Regular Updates** - Keep test dependencies updated
2. **Test Data** - Maintain realistic test data
3. **Documentation** - Keep test documentation current
4. **Monitoring** - Track test performance and reliability

## Future Enhancements

- [ ] **Visual Regression Testing** - Compare screenshots across versions
- [ ] **Load Testing Integration** - Combine with k6 load tests
- [ ] **Mobile Testing** - Test on mobile devices and browsers
- [ ] **Accessibility Testing** - Validate accessibility compliance
- [ ] **Internationalization Testing** - Test multiple languages
- [ ] **Cross-browser Testing** - Test on multiple browsers
- [ ] **Performance Benchmarking** - Track performance metrics
- [ ] **Test Data Management** - Automated test data generation 