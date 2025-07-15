#!/bin/bash

# Party Puzzle Palooza Infrastructure Setup Script
# This script helps set up the initial AWS infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-west-2"
PROJECT_NAME="party-puzzle-palooza"
S3_BUCKET_NAME="${PROJECT_NAME}-terraform-state"

echo -e "${BLUE}🚀 Party Puzzle Palooza Infrastructure Setup${NC}"
echo "=================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}🔍 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS credentials configured${NC}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Create S3 bucket for Terraform state
echo -e "${YELLOW}🔧 Creating S3 bucket for Terraform state...${NC}"
if aws s3 ls "s3://${S3_BUCKET_NAME}" 2>&1 > /dev/null; then
    echo -e "${GREEN}✅ S3 bucket ${S3_BUCKET_NAME} already exists${NC}"
else
    aws s3 mb "s3://${S3_BUCKET_NAME}" --region "${AWS_REGION}"
    aws s3api put-bucket-versioning \
        --bucket "${S3_BUCKET_NAME}" \
        --versioning-configuration Status=Enabled
    echo -e "${GREEN}✅ S3 bucket ${S3_BUCKET_NAME} created${NC}"
fi

# Create DynamoDB table for Terraform state locking
echo -e "${YELLOW}🔧 Creating DynamoDB table for state locking...${NC}"
TABLE_NAME="${PROJECT_NAME}-terraform-locks"
if aws dynamodb describe-table --table-name "${TABLE_NAME}" &> /dev/null; then
    echo -e "${GREEN}✅ DynamoDB table ${TABLE_NAME} already exists${NC}"
else
    aws dynamodb create-table \
        --table-name "${TABLE_NAME}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "${AWS_REGION}"
    echo -e "${GREEN}✅ DynamoDB table ${TABLE_NAME} created${NC}"
fi

# Update Terraform backend configuration
echo -e "${YELLOW}🔧 Updating Terraform backend configuration...${NC}"
cat > terraform/environments/staging/backend.tf << EOF
terraform {
  backend "s3" {
    bucket         = "${S3_BUCKET_NAME}"
    key            = "staging/terraform.tfstate"
    region         = "${AWS_REGION}"
    dynamodb_table = "${TABLE_NAME}"
    encrypt        = true
  }
}
EOF

echo -e "${GREEN}✅ Terraform backend configuration updated${NC}"

# Create .env file for local development
echo -e "${YELLOW}🔧 Creating .env file...${NC}"
cat > .env.example << EOF
# AWS Configuration
AWS_REGION=${AWS_REGION}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}

# Application Configuration
NODE_ENV=development
PORT=3001

# Database Configuration (if needed)
# DATABASE_URL=postgresql://user:password@localhost:5432/party_puzzle_palooza

# External Services (if needed)
# SUPABASE_URL=your-supabase-url
# SUPABASE_ANON_KEY=your-supabase-anon-key
EOF

echo -e "${GREEN}✅ .env.example file created${NC}"

# Display next steps
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Copy .env.example to .env and update with your values"
echo "2. Update certificate_arn in terraform/environments/staging/variables.tf"
echo "3. Configure GitHub secrets:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - AWS_ACCOUNT_ID"
echo ""
echo "4. Deploy infrastructure:"
echo "   cd terraform/environments/staging"
echo "   terraform init"
echo "   terraform plan"
echo "   terraform apply"
echo ""
echo "5. Push to main branch to trigger deployment:"
echo "   git add ."
echo "   git commit -m 'feat: add infrastructure setup'"
echo "   git push origin main"

echo -e "${GREEN}🎉 Setup complete!${NC}" 