#!/bin/bash

# Party Puzzle Palooza Database Seeder
# This script seeds the database with demo data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 Party Puzzle Palooza Database Seeder${NC}"
echo "=============================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Please create one with database credentials.${NC}"
    echo "Example .env file:"
    echo "DB_HOST=localhost"
    echo "DB_PORT=5432"
    echo "DB_USERNAME=postgres"
    echo "DB_PASSWORD=your_password"
    echo "DB_NAME=partypuzzlepalooza"
    exit 1
fi

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
npm install

# Build database package
echo -e "${YELLOW}🔨 Building database package...${NC}"
cd packages/database
npm run build
cd ../..

# Run migrations first
echo -e "${YELLOW}🔄 Running migrations...${NC}"
npm run db:migrate

# Seed the database
echo -e "${YELLOW}🌱 Seeding database with demo data...${NC}"
npm run db:seed

echo -e "${GREEN}✅ Database seeding completed!${NC}"
echo ""
echo -e "${BLUE}📋 Demo Data Created:${NC}"
echo "- 4 demo users (alice_gamer, bob_quizmaster, charlie_puzzle, diana_admin)"
echo "- 1 demo game lobby (Friday Night Trivia - Code: DEMO123)"
echo "- 10 AI-authored questions (trivia, would you rather, word association, drawing)"
echo ""
echo -e "${BLUE}🔗 Test the API:${NC}"
echo "curl http://localhost:3001/health"
echo "curl http://localhost:3001/api/games"
echo ""
echo -e "${BLUE}👤 Demo User Credentials:${NC}"
echo "Username: alice_gamer"
echo "Password: password123"
echo ""
echo -e "${YELLOW}💡 To customize seeding, use: npm run db:seed:cli --help${NC}" 