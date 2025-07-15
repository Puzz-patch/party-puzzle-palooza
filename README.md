# Party Puzzle Palooza 🎉

A real-time multiplayer party game where players create and answer custom questions, compete for tokens, and experience the thrill of strategic gameplay!

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git**

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd party-puzzle-palooza

# Install dependencies
npm install

# Start infrastructure services
npm run dev:start

# Setup database
npm run db:setup

# Seed with demo data
npm run db:seed:demo

# Start development servers
npm run dev
```

### Access Services

- **Web App**: http://localhost:5173
- **API Server**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs
- **WebSocket Gateway**: ws://localhost:3001/game
- **PgAdmin**: http://localhost:8080 (admin@party-puzzle-palooza.com / admin)
- **Redis Commander**: http://localhost:8081

## 📚 Documentation

- **[Local Development Guide](docs/local-development.md)** - Complete setup and development workflow
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions
- **[API Documentation](http://localhost:3001/docs)** - Interactive Swagger documentation
- **[Load Testing Guide](docs/load-testing.md)** - Performance testing and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │   Database      │
│   (Next.js)     │◄──►│   (NestJS)      │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis         │
                       │   (Pub/Sub)     │
                       └─────────────────┘
```

## 🎮 Game Features

- **Real-time Multiplayer**: WebSocket-based real-time gameplay
- **Custom Questions**: Players can create and submit their own questions
- **Token Economy**: Strategic token spending and earning system
- **Moderation**: OpenAI-powered content moderation
- **Game States**: Lobby → Question Building → Gameplay → Finale
- **Player Actions**: Roll, Force, Shield mechanics with coin-flip odds
- **Archived Prompts**: Fog-of-war style prompt history
- **Question Flagging**: Community-driven content moderation

## 🛠️ Tech Stack

### Frontend
- **Next.js** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.IO Client** - Real-time communication

### Backend
- **NestJS** - Node.js framework
- **TypeORM** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub
- **Socket.IO** - WebSocket server
- **OpenAI** - Content moderation
- **JWT** - Authentication

### Infrastructure
- **Docker** - Containerization
- **Terraform** - Infrastructure as Code
- **AWS ECS** - Container orchestration
- **AWS RDS** - Managed PostgreSQL
- **AWS ElastiCache** - Managed Redis
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards
- **Tempo** - Distributed tracing

## 📊 Monitoring & Observability

### Metrics
- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **OpenTelemetry** - Distributed tracing
- **Tempo** - Trace storage and querying

### Health Checks
- **API Health**: `GET /health`
- **Gateway Status**: `GET /api/gateway/status`
- **Metrics**: `GET /metrics`

### Load Testing
```bash
# Run load tests
npm run load:test

# Analyze results
npm run load:analyze
```

### End-to-End Testing
```bash
# Run E2E tests in Docker (recommended)
./scripts/run-e2e-docker.sh

# Run E2E tests locally
npm run e2e:test

# Run Playwright tests
npm run e2e:playwright

# View test report
npm run e2e:report
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev                    # Start all apps in development mode
npm run dev:start             # Start infrastructure services
npm run dev:stop              # Stop infrastructure services

# Database
npm run db:setup              # Setup database with migrations
npm run db:migrate            # Run database migrations
npm run db:seed:demo          # Seed with demo data

# Testing
npm run test                  # Run all tests
npm run test:watch            # Run tests in watch mode

# Monitoring
npm run monitoring:setup      # Setup monitoring stack
npm run monitoring:start      # Start monitoring services
npm run monitoring:stop       # Stop monitoring services

# Production
npm run prod:start            # Start production stack
npm run prod:stop             # Stop production stack

# Load Testing
npm run load:test             # Run load tests
npm run load:analyze          # Analyze load test results
```

### Project Structure

```
party-puzzle-palooza/
├── apps/
│   ├── web/                   # Next.js frontend
│   └── api/                   # NestJS backend
├── packages/
│   ├── database/              # Database entities and migrations
│   └── shared/                # Shared utilities and types
├── terraform/                 # Infrastructure as Code
├── docs/                      # Documentation
├── scripts/                   # Utility scripts
├── monitoring/                # Monitoring configurations
└── load-tests/                # Performance testing
```

## 🚀 Deployment

### Local Production Stack

```bash
# Setup monitoring
npm run monitoring:setup

# Start production stack
npm run prod:start

# Access services
open https://localhost
```

### AWS Deployment

See the [Deployment Guide](docs/deployment.md) for detailed AWS deployment instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` folder
- **API Docs**: Visit http://localhost:3001/docs
- **Issues**: Create an issue in the repository
- **Discussions**: Use GitHub Discussions for questions

---

**Happy gaming! 🎮✨**
