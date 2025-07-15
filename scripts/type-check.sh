#!/bin/bash

# Type Check Script for Party Puzzle Palooza
# This script runs TypeScript type checking across all packages

set -e

echo "🔍 Running TypeScript type checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if TypeScript is installed
if ! command_exists tsc; then
  echo -e "${RED}❌ TypeScript is not installed. Please install it first.${NC}"
  exit 1
fi

# Function to run type check on a package
check_package() {
  local package=$1
  local package_path=$2
  
  echo -e "\n${YELLOW}📦 Checking $package...${NC}"
  
  if [ -d "$package_path" ]; then
    cd "$package_path"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
      echo -e "${RED}❌ No package.json found in $package_path${NC}"
      return 1
    fi
    
    # Run TypeScript compiler with strict mode
    if npx tsc --noEmit --strict; then
      echo -e "${GREEN}✅ $package type check passed${NC}"
    else
      echo -e "${RED}❌ $package type check failed${NC}"
      return 1
    fi
    
    cd - > /dev/null
  else
    echo -e "${YELLOW}⚠️  Package $package not found at $package_path${NC}"
  fi
}

# Check for 'any' types in TypeScript files
echo -e "\n${YELLOW}🔍 Checking for 'any' types...${NC}"
ANY_TYPES_FOUND=false

# Search for 'any' types in TypeScript files
while IFS= read -r -d '' file; do
  # Skip node_modules, test files, and spec files
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]]; then
    continue
  fi
  
  # Check if file contains 'any' type
  if grep -q "\bany\b" "$file"; then
    echo -e "${RED}❌ Found 'any' type in: $file${NC}"
    ANY_TYPES_FOUND=true
  fi
done < <(find apps/ packages/ -name "*.ts" -o -name "*.tsx" -print0)

if [ "$ANY_TYPES_FOUND" = false ]; then
  echo -e "${GREEN}✅ No 'any' types found${NC}"
else
  echo -e "${RED}❌ Please replace 'any' types with proper TypeScript types${NC}"
  exit 1
fi

# Run type checks on all packages
echo -e "\n${YELLOW}🔍 Running TypeScript compiler checks...${NC}"

check_package "web" "apps/web"
check_package "api" "apps/api"
check_package "shared" "packages/shared"
check_package "database" "packages/database"

echo -e "\n${GREEN}🎉 All type checks passed!${NC}"
echo -e "${GREEN}✅ TypeScript strict mode is enforced${NC}"
echo -e "${GREEN}✅ No 'any' types found${NC}"
echo -e "${GREEN}✅ All packages compile successfully${NC}" 