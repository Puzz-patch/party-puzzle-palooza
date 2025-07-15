variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnets" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "ALB security group ID"
  type        = string
}

variable "web_target_group_arn" {
  description = "Web target group ARN"
  type        = string
}

variable "api_target_group_arn" {
  description = "API target group ARN"
  type        = string
}

variable "certificate_arn" {
  description = "SSL certificate ARN"
  type        = string
  default     = ""
} 