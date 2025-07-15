# 🚀 Project Startup Scripts

This directory contains convenient scripts to run the Party Puzzle Palooza project.

## 📋 Prerequisites

Before running any scripts, ensure you have:

- **Node.js 18+** installed
- **pnpm** package manager installed
- **Docker** and **Docker Compose** installed and running
- **Git** installed

## 🎯 Scripts Overview

### 1. `./run-project.sh` - Full Setup (First Time)

**Use this script for the first time setup or when you need a complete clean start.**

This script will:
- ✅ Check all prerequisites
- 📦 Install all dependencies
- 🐳 Start infrastructure services (PostgreSQL, Redis, PgAdmin)
- 🗄️ Setup and migrate the database
- 🌱 Seed the database with demo data
- 🚀 Start all development servers

```bash
./run-project.sh
```

### 2. `./quick-start.sh` - Quick Start (Subsequent Runs)

**Use this script when you've already run the full setup and just want to start the services.**

This script will:
- 🐳 Start infrastructure services
- 🚀 Start development servers

```bash
./quick-start.sh
```

### 3. `./stop-project.sh` - Stop All Services

**Use this script to cleanly stop all running services.**

```bash
./stop-project.sh
```

## 🌐 Service URLs

Once started, the following services will be available:

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **Web App** | http://localhost:5173 | Main game interface |
| 🔧 **API Server** | http://localhost:3001 | Backend API |
| 📚 **API Documentation** | http://localhost:3001/docs | Swagger API docs |
| 🔌 **WebSocket Gateway** | ws://localhost:3001/game | Real-time game communication |
| 🗄️ **PgAdmin** | http://localhost:8080 | Database administration |
| 📊 **Redis Commander** | http://localhost:8081 | Redis data browser |

### PgAdmin Credentials
- **Email:** `admin@party-puzzle-palooza.com`
- **Password:** `admin`

## 🚨 Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   # Start Docker Desktop and try again
   ```

2. **Port conflicts**
   ```bash
   # Stop other services using ports 3001, 5173, 8080, 8081
   ./stop-project.sh
   ```

3. **Database connection issues**
   ```bash
   # Run full setup to reset database
   ./run-project.sh
   ```

4. **Dependencies out of sync**
   ```bash
   # Clear and reinstall dependencies
   rm -rf node_modules
   pnpm install
   ./run-project.sh
   ```

### Manual Commands

If you prefer to run commands manually, you can use:

```bash
# Install dependencies
pnpm install

# Start infrastructure
pnpm run dev:start

# Setup database
pnpm run db:setup

# Seed demo data
pnpm run db:seed:demo

# Start development servers
pnpm run dev

# Stop services
pnpm run dev:stop
```

## 🔄 Workflow

**First time setup:**
```bash
./run-project.sh
```

**Daily development:**
```bash
./quick-start.sh
# ... do your development work ...
./stop-project.sh
```

**When something goes wrong:**
```bash
./stop-project.sh
./run-project.sh  # Full reset
```

---

**Happy coding! 🎮✨** 