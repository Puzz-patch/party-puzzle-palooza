#!/bin/bash

set -e

echo "📚 Generating Swagger documentation..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if API server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    print_status "Starting API server..."
    cd apps/api
    pnpm run start:dev &
    API_PID=$!
    
    # Wait for server to start
    print_status "Waiting for API server to start..."
    sleep 10
    
    # Check if server started successfully
    if ! curl -s http://localhost:3001/health > /dev/null; then
        echo "❌ Failed to start API server"
        exit 1
    fi
else
    print_status "API server is already running"
fi

# Generate Swagger JSON
print_status "Generating Swagger JSON..."
curl -s http://localhost:3001/docs-json > docs/swagger.json

if [ $? -eq 0 ]; then
    print_success "Swagger JSON generated successfully!"
    print_status "Documentation available at: http://localhost:3001/docs"
    print_status "JSON file saved to: docs/swagger.json"
else
    echo "❌ Failed to generate Swagger JSON"
    exit 1
fi

# Generate TypeScript interfaces (if nest-swagger-gen is available)
if command -v nest-swagger-gen &> /dev/null; then
    print_status "Generating TypeScript interfaces..."
    nest-swagger-gen --input docs/swagger.json --output src/types/api.ts
    print_success "TypeScript interfaces generated!"
else
    print_status "nest-swagger-gen not found, skipping TypeScript generation"
    print_status "Install with: npm install -g nest-swagger-gen"
fi

# Stop API server if we started it
if [ ! -z "$API_PID" ]; then
    print_status "Stopping API server..."
    kill $API_PID
fi

print_success "Swagger documentation generation complete! 🎉" 