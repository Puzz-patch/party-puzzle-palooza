#!/bin/bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is required but not installed. Please install it first."
        exit 1
    fi
}

# Function to check if Docker is running
check_docker_running() {
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Function to wait for services to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$port" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_warning "$service_name is taking longer than expected to start."
    return 1
}

# Function to cleanup on script exit
cleanup() {
    print_status "Cleaning up..."
    # Don't stop services on exit as user might want them to keep running
}

# Set trap for cleanup
trap cleanup EXIT

echo -e "${BLUE}"
echo "🎉 Party Puzzle Palooza Setup Script 🎉"
echo "======================================="
echo -e "${NC}"

# Check prerequisites
print_status "Checking prerequisites..."

check_command "node"
check_command "npm"
check_command "docker"
check_command "docker-compose"
check_command "git"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_NODE_VERSION="18"
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    print_error "Node.js version 18+ is required. Current version: $NODE_VERSION"
    exit 1
fi

check_docker_running

print_success "All prerequisites met!"

# Install dependencies
print_status "Installing dependencies..."
npm install

print_success "Dependencies installed!"

# Stop any existing services
print_status "Stopping any existing services..."
npm run dev:stop 2>/dev/null || true

# Start infrastructure services
print_status "Starting infrastructure services (PostgreSQL, Redis, PgAdmin)..."
npm run dev:start

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 10

# Setup database
print_status "Setting up database with migrations..."
npm run db:setup

print_success "Database setup complete!"

# Seed with demo data
print_status "Seeding database with demo data..."
npm run db:seed:demo

print_success "Demo data seeded!"

# Start development servers
print_status "Starting development servers..."
print_status "This will start both the API server and the web application..."

echo -e "${GREEN}"
echo "🚀 Setup Complete! Starting development servers..."
echo ""
echo "Services will be available at:"
echo "  🌐 Web App:        http://localhost:5173"
echo "  🔧 API Server:     http://localhost:3001"
echo "  📚 API Docs:       http://localhost:3001/docs"
echo "  🔌 WebSocket:      ws://localhost:3001/game"
echo "  🗄️  PgAdmin:        http://localhost:8080"
echo "  📊 Redis Commander: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all services"
echo -e "${NC}"

# Start development servers (this will run in foreground)
npm run dev 