output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "db_endpoint" {
  description = "Database endpoint"
  value       = module.rds.db_endpoint
}

output "db_connection_string" {
  description = "Database connection string (without password)"
  value       = module.rds.db_connection_string
} 