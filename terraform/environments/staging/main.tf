terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "party-puzzle-palooza-terraform-state"
    key    = "staging/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "staging"
      Project     = "party-puzzle-palooza"
      ManagedBy   = "terraform"
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "../../modules/vpc"
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  azs         = var.availability_zones
}

# ECR Repositories
module "ecr" {
  source = "../../modules/ecr"
  
  environment = var.environment
  repositories = [
    "party-puzzle-palooza-web",
    "party-puzzle-palooza-api"
  ]
}

# ECS Cluster and Services
module "ecs" {
  source = "../../modules/ecs"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnets     = module.vpc.private_subnets
  
  web_image_uri = module.ecr.repository_urls["party-puzzle-palooza-web"]
  api_image_uri = module.ecr.repository_urls["party-puzzle-palooza-api"]
  ecs_security_group_id = module.vpc.ecs_security_group_id
  
  depends_on = [module.vpc, module.ecr]
}

# RDS Database
module "rds" {
  source = "../../modules/rds"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnets
  ecs_security_group_id = module.vpc.ecs_security_group_id
  
  database_name     = var.database_name
  database_username = var.database_username
  database_password = var.database_password
  
  depends_on = [module.vpc]
}

# Application Load Balancer
module "alb" {
  source = "../../modules/alb"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnets     = module.vpc.public_subnets
  alb_security_group_id = module.vpc.alb_security_group_id
  
  web_target_group_arn = module.ecs.web_target_group_arn
  api_target_group_arn = module.ecs.api_target_group_arn
  certificate_arn = var.certificate_arn
  
  depends_on = [module.vpc, module.ecs]
} 