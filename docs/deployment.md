# Deployment Guide

This guide covers deploying Party Puzzle Palooza to production environments.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Servers   │    │   Database      │
│   (ALB/Nginx)   │───▶│   (ECS/Fargate) │───▶│   (RDS)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis         │
                       │   (ElastiCache) │
                       └─────────────────┘
```

## Prerequisites

- **AWS Account** with appropriate permissions
- **Docker** installed locally
- **AWS CLI** configured
- **Terraform** installed
- **Domain name** (optional but recommended)

## Infrastructure Setup

### 1. AWS Infrastructure

The project includes Terraform configurations for AWS infrastructure:

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Plan the infrastructure
terraform plan

# Apply the infrastructure
terraform apply
```

This will create:
- **VPC** with public and private subnets
- **RDS** PostgreSQL instance
- **ElastiCache** Redis cluster
- **ECR** repositories for Docker images
- **ECS** Fargate cluster
- **Application Load Balancer**
- **CloudWatch** logs and monitoring

### 2. Environment Configuration

Create environment-specific configuration files:

```bash
# Production environment
cp .env.example .env.production

# Edit production environment variables
nano .env.production
```

Required production environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@your-rds-endpoint:5432/party_puzzle_palooza

# Redis
REDIS_URL=redis://your-elasticache-endpoint:6379

# JWT (use strong secret)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Frontend URL
FRONTEND_URL=https://your-domain.com

# API URL
API_URL=https://api.your-domain.com

# WebSocket URL
WS_URL=wss://api.your-domain.com/game

# Monitoring
TEMPO_ENDPOINT=https://your-tempo-endpoint:4318/v1/traces
PROMETHEUS_PORT=9464

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Slack (for alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK

# PagerDuty (for critical alerts)
PAGERDUTY_KEY=your-pagerduty-key
```

## Docker Deployment

### 1. Build Docker Images

```bash
# Build API image
docker build -t party-puzzle-palooza-api:latest -f apps/api/Dockerfile .

# Build Web image
docker build -t party-puzzle-palooza-web:latest -f apps/web/Dockerfile .

# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.us-east-1.amazonaws.com

docker tag party-puzzle-palooza-api:latest your-account-id.dkr.ecr.us-east-1.amazonaws.com/party-puzzle-palooza-api:latest
docker tag party-puzzle-palooza-web:latest your-account-id.dkr.ecr.us-east-1.amazonaws.com/party-puzzle-palooza-web:latest
```

### 2. Push to ECR

```bash
# Push API image
docker push your-account-id.dkr.ecr.us-east-1.amazonaws.com/party-puzzle-palooza-api:latest

# Push Web image
docker push your-account-id.dkr.ecr.us-east-1.amazonaws.com/party-puzzle-palooza-web:latest
```

### 3. Deploy to ECS

```bash
# Update ECS service
aws ecs update-service --cluster party-puzzle-palooza --service api-service --force-new-deployment

# Check deployment status
aws ecs describe-services --cluster party-puzzle-palooza --services api-service
```

## CI/CD Pipeline

### GitHub Actions

The project includes GitHub Actions workflows for automated deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push API image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: party-puzzle-palooza-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster party-puzzle-palooza --service api-service --force-new-deployment
```

### Required Secrets

Configure these secrets in your GitHub repository:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`

## Database Migration

### 1. Run Migrations

```bash
# Connect to production database
psql $DATABASE_URL

# Run migrations
\i supabase/migrations/*.sql

# Verify migrations
\dt
```

### 2. Seed Production Data

```bash
# Run seed script
NODE_ENV=production ./scripts/seed-demo.sh
```

## Monitoring Setup

### 1. CloudWatch

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard --dashboard-name "Party-Puzzle-Palooza" --dashboard-body file://monitoring/cloudwatch-dashboard.json
```

### 2. Prometheus & Grafana

```bash
# Deploy monitoring stack
cd monitoring
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Alerting

```bash
# Configure CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "API-High-Error-Rate" \
  --alarm-description "High error rate on API endpoints" \
  --metric-name "ErrorRate" \
  --namespace "PartyPuzzlePalooza" \
  --statistic "Average" \
  --period 300 \
  --threshold 0.05 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2
```

## SSL/TLS Configuration

### 1. ACM Certificate

```bash
# Request certificate
aws acm request-certificate \
  --domain-name api.your-domain.com \
  --validation-method DNS
```

### 2. Load Balancer Configuration

Update the ALB listener to use HTTPS:

```bash
# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn your-alb-arn \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=your-certificate-arn \
  --default-actions Type=forward,TargetGroupArn=your-target-group-arn
```

## Security Configuration

### 1. Security Groups

Ensure security groups are properly configured:

```bash
# API security group
aws ec2 create-security-group \
  --group-name party-puzzle-palooza-api \
  --description "Security group for API servers"

# Allow HTTPS from ALB
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 443 \
  --source-group sg-alb-security-group
```

### 2. IAM Roles

```bash
# Create ECS task role
aws iam create-role \
  --role-name party-puzzle-palooza-ecs-task-role \
  --assume-role-policy-document file://terraform/iam/ecs-task-role-trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name party-puzzle-palooza-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

## Performance Optimization

### 1. Auto Scaling

```bash
# Create auto scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/party-puzzle-palooza/api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://monitoring/auto-scaling-policy.json
```

### 2. CDN Configuration

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://terraform/cloudfront/distribution-config.json
```

## Backup Strategy

### 1. Database Backups

```bash
# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier party-puzzle-palooza \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00"
```

### 2. Application Data

```bash
# Create S3 bucket for backups
aws s3 mb s3://party-puzzle-palooza-backups

# Configure lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket party-puzzle-palooza-backups \
  --lifecycle-configuration file://terraform/s3/backup-lifecycle.json
```

## Rollback Strategy

### 1. Blue/Green Deployment

```bash
# Create new task definition
aws ecs register-task-definition --cli-input-json file://task-definition-new.json

# Update service with new task definition
aws ecs update-service \
  --cluster party-puzzle-palooza \
  --service api-service \
  --task-definition party-puzzle-palooza-api:2
```

### 2. Quick Rollback

```bash
# Rollback to previous task definition
aws ecs update-service \
  --cluster party-puzzle-palooza \
  --service api-service \
  --task-definition party-puzzle-palooza-api:1
```

## Health Checks

### 1. Application Health

```bash
# Health check endpoint
curl https://api.your-domain.com/health

# Expected response
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "telemetry": "enabled",
  "swagger": "/docs"
}
```

### 2. Load Balancer Health

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn your-target-group-arn
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check security groups
   - Verify connection string
   - Check RDS status

2. **Redis Connection Issues**
   - Verify ElastiCache endpoint
   - Check security groups
   - Monitor memory usage

3. **High Latency**
   - Check CloudWatch metrics
   - Review auto scaling configuration
   - Monitor database performance

4. **Memory Issues**
   - Check container memory limits
   - Monitor Redis memory usage
   - Review application memory usage

### Useful Commands

```bash
# View ECS logs
aws logs tail /ecs/party-puzzle-palooza-api --follow

# Check service status
aws ecs describe-services --cluster party-puzzle-palooza --services api-service

# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=api-service \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 300 \
  --statistics Average
```

## Maintenance

### Regular Tasks

1. **Security Updates**
   - Update base Docker images
   - Patch dependencies
   - Review security groups

2. **Performance Monitoring**
   - Review CloudWatch metrics
   - Optimize database queries
   - Monitor auto scaling

3. **Backup Verification**
   - Test database restore procedures
   - Verify backup integrity
   - Update backup retention policies

4. **Cost Optimization**
   - Review unused resources
   - Optimize instance sizes
   - Monitor data transfer costs

## Support

For deployment issues:

1. Check CloudWatch logs
2. Review ECS service events
3. Verify infrastructure configuration
4. Contact the development team 