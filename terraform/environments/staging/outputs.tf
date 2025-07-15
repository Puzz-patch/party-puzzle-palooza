output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "web_service_url" {
  description = "Web service URL"
  value       = "https://${var.domain_name}"
}

output "api_service_url" {
  description = "API service URL"
  value       = "https://${var.domain_name}/api"
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "web_service_name" {
  description = "Web service name"
  value       = module.ecs.web_service_name
}

output "api_service_name" {
  description = "API service name"
  value       = module.ecs.api_service_name
}

output "db_endpoint" {
  description = "Database endpoint"
  value       = module.rds.db_endpoint
}

output "db_connection_string" {
  description = "Database connection string (without password)"
  value       = module.rds.db_connection_string
} 