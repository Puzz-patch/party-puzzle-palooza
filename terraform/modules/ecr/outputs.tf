output "repository_urls" {
  description = "ECR repository URLs"
  value = {
    for name, repo in aws_ecr_repository.repositories : name => repo.repository_url
  }
}

output "repository_arns" {
  description = "ECR repository ARNs"
  value = {
    for name, repo in aws_ecr_repository.repositories : name => repo.arn
  }
} 