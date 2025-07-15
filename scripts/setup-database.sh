#!/bin/bash

# Party Puzzle Palooza Database Setup Script
# This script sets up the database with migrations and initial data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  Party Puzzle Palooza Database Setup${NC}"
echo "=============================================="

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env file created from .env.example${NC}"
        echo -e "${YELLOW}⚠️  Please update the .env file with your database credentials${NC}"
    else
        echo -e "${RED}❌ .env.example file not found. Please create a .env file with database credentials.${NC}"
        exit 1
    fi
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install

# Build database package
echo -e "${YELLOW}🔨 Building database package...${NC}"
cd packages/database
pnpm build
cd ../..

# Run migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
cd packages/database
pnpm migration:run
cd ../..

echo -e "${GREEN}✅ Database setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Verify database connection by running the API server:"
echo "   cd apps/api"
echo "   pnpm dev"
echo ""
echo "2. Test the health endpoint:"
echo "   curl http://localhost:3001/health"
echo ""
echo "3. Check database tables:"
echo "   psql \$DATABASE_URL -c '\\dt'" 