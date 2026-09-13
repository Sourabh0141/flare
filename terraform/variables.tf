variable "cloudflare_account_id" {
  description = "The target Cloudflare Account ID tag"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token with permissions for D1, R2, Pages, and Workers. Can also be sourced from CLOUDFLARE_API_TOKEN env var."
  type        = string
  sensitive   = true
  default     = null
}

variable "project_name" {
  description = "Prefix identifier applied to all provisioned Cloudflare resources"
  type        = string
  default     = "flare"
}

variable "environment" {
  description = "Deployment environment identifier (e.g. production, staging, development)"
  type        = string
  default     = "production"
}

variable "r2_location" {
  description = "Geographical location hint for R2 buckets (auto, wnam, enam, weur, eeur, apac)"
  type        = string
  default     = "auto"
}
