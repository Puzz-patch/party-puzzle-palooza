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
    key    = "development/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "development"
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

# RDS Database (Dev)
module "rds" {
  source = "../../modules/rds"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnets
  ecs_security_group_id = module.vpc.ecs_security_group_id
  
  database_name     = var.database_name
  database_username = var.database_username
  database_password = var.database_password
  
  # Development-specific settings
  instance_class = "db.t3.micro"
  allocated_storage = 10
  max_allocated_storage = 20
  backup_retention_period = 1
  deletion_protection = false
  
  depends_on = [module.vpc]
} 