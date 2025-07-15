variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnets" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "web_image_uri" {
  description = "Web container image URI"
  type        = string
}

variable "api_image_uri" {
  description = "API container image URI"
  type        = string
}

variable "ecs_security_group_id" {
  description = "ECS security group ID"
  type        = string
} 