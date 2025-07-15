# Local Development Guide

This guide will help you set up and run Party Puzzle Palooza locally for development.

## Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Docker** and Docker Compose
- **Git**

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd party-puzzle-palooza

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and monitoring tools
docker-compose -f docker-compose.dev.yml up -d

# Optional: Start monitoring stack
docker-compose -f docker-compose.dev.yml --profile monitoring up -d
```

### 3. Setup Database

```bash
# Run database migrations
./scripts/setup-database.sh

# Seed with demo data
./scripts/seed-demo.sh
```

### 4. Start Development Servers

```bash
# Start API server
cd apps/api
pnpm run start:dev

# In another terminal, start web app
cd apps/web
pnpm run dev
```

### 5. Access Services

- **Web App**: http://localhost:5173
- **API Server**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs
- **WebSocket Gateway**: ws://localhost:3001/game
- **PgAdmin**: http://localhost:8080 (admin@party-puzzle-palooza.com / admin)
- **Redis Commander**: http://localhost:8081
- **Grafana**: http://localhost:3000 (admin/admin) - if monitoring enabled
- **Prometheus**: http://localhost:9090 - if monitoring enabled

## Development Workflow

### Database Development

```bash
# Create a new migration
cd supabase
npx supabase migration new your_migration_name

# Reset database (careful - this deletes all data)
npx supabase db reset

# Generate types from database
npx supabase gen types typescript --local > packages/database/src/types.ts
```

### API Development

```bash
# Run tests
cd apps/api
pnpm test

# Run tests in watch mode
pnpm test:watch

# Check linting
pnpm lint

# Format code
pnpm format
```

### Web App Development

```bash
# Run tests
cd apps/web
pnpm test

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Load Testing

```bash
# Run load tests
./scripts/run-load-test.sh

# Analyze results
python3 scripts/analyze-load-test.py --k6-results load-test-results/k6-results-*.json
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/party_puzzle_palooza

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# OpenAI (for moderation)
OPENAI_API_KEY=your-openai-api-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# API URL
API_URL=http://localhost:3001

# WebSocket URL
WS_URL=ws://localhost:3001/game

# Monitoring
TEMPO_ENDPOINT=http://localhost:4318/v1/traces
PROMETHEUS_PORT=9464
```

### Optional Environment Variables

```bash
# Email service (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Slack (for alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK

# PagerDuty (for critical alerts)
PAGERDUTY_KEY=your-pagerduty-key
```

## Database Management

### Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: party_puzzle_palooza
- **Username**: postgres
- **Password**: password

### Useful Commands

```bash
# Connect to database
psql -h localhost -U postgres -d party_puzzle_palooza

# View tables
\dt

# View table structure
\d table_name

# Run SQL file
psql -h localhost -U postgres -d party_puzzle_palooza -f your_file.sql
```

### Redis Management

```bash
# Connect to Redis CLI
redis-cli

# View all keys
KEYS *

# Monitor Redis commands
MONITOR

# View Redis info
INFO
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs party-puzzle-palooza-postgres

# Restart PostgreSQL
docker-compose -f docker-compose.dev.yml restart postgres
```

#### 2. Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Check logs
docker logs party-puzzle-palooza-redis

# Restart Redis
docker-compose -f docker-compose.dev.yml restart redis
```

#### 3. Port Conflicts

If you get port conflicts, check what's using the ports:

```bash
# Check what's using port 3001
lsof -i :3001

# Check what's using port 5432
lsof -i :5432

# Check what's using port 6379
lsof -i :6379
```

#### 4. Permission Issues

```bash
# Fix Docker permissions (Linux)
sudo chown $USER:$USER ~/.docker -R

# Fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

### Performance Issues

#### 1. Slow Database Queries

```bash
# Enable query logging
docker exec -it party-puzzle-palooza-postgres psql -U postgres -d party_puzzle_palooza -c "SET log_statement = 'all';"

# Check slow queries
docker exec -it party-puzzle-palooza-postgres psql -U postgres -d party_puzzle_palooza -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### 2. High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services
docker-compose -f docker-compose.dev.yml restart
```

## Development Tools

### VS Code Extensions

Recommended extensions for development:

- **TypeScript and JavaScript Language Features**
- **PostgreSQL** - Database management
- **Redis** - Redis management
- **Docker** - Docker integration
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Thunder Client** - API testing
- **GitLens** - Git integration

### Useful Commands

```bash
# View all running containers
docker ps

# View logs for all services
docker-compose -f docker-compose.dev.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.dev.yml logs -f postgres

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (careful - this deletes data)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild containers
docker-compose -f docker-compose.dev.yml build --no-cache

# Clean up unused Docker resources
docker system prune -a
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run specific test file
pnpm test -- --testNamePattern="UserService"

# Run e2e tests
pnpm test:e2e
```

### Load Testing

```bash
# Install k6
brew install k6  # macOS
# or follow instructions at https://k6.io/docs/getting-started/installation/

# Run load test
./scripts/run-load-test.sh

# View results
open load-test-results/load-test-report-*.md
```

## Monitoring

### Enable Monitoring Stack

```bash
# Start monitoring services
docker-compose -f docker-compose.dev.yml --profile monitoring up -d

# Access monitoring tools
open http://localhost:3000  # Grafana
open http://localhost:9090  # Prometheus
```

### View Metrics

- **API Metrics**: http://localhost:3001/metrics
- **Health Check**: http://localhost:3001/health
- **Gateway Status**: http://localhost:3001/api/gateway/status

## Next Steps

1. **Explore the API**: Visit http://localhost:3001/docs
2. **Create a game**: Use the web interface at http://localhost:5173
3. **Monitor performance**: Check Grafana dashboards
4. **Run tests**: Ensure everything is working correctly
5. **Start developing**: Make changes and see them live!

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs: `docker-compose -f docker-compose.dev.yml logs`
3. Check the documentation in the `docs/` folder
4. Create an issue in the repository 