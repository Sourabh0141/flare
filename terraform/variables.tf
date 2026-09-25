variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns every resource"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be the 32-character hex account ID."
  }
}

variable "cloudflare_api_token" {
  description = "API token with D1, R2 and Pages permissions. May also come from CLOUDFLARE_API_TOKEN."
  type        = string
  sensitive   = true
  default     = null
}

variable "project_name" {
  description = "Prefix applied to every resource name"
  type        = string
  default     = "flare"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,30}$", var.project_name))
    error_message = "project_name must be lowercase letters, digits and hyphens."
  }
}

variable "environment" {
  description = "Deployment environment label (production, staging, ...)"
  type        = string
  default     = "production"
}

variable "r2_location" {
  description = "Location hint for the assets bucket (auto, wnam, enam, weur, eeur, apac)"
  type        = string
  default     = "auto"

  validation {
    condition     = contains(["auto", "wnam", "enam", "weur", "eeur", "apac"], var.r2_location)
    error_message = "r2_location must be one of auto, wnam, enam, weur, eeur, apac."
  }
}
