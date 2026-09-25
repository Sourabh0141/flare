terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.52"
    }
  }
}

variable "account_id" {
  description = "Cloudflare account that owns the bucket"
  type        = string
}

variable "name" {
  description = "Bucket name"
  type        = string
}

variable "location" {
  description = "Location hint (auto, wnam, enam, weur, eeur, apac); `auto` lets Cloudflare choose"
  type        = string
  default     = "auto"
}

resource "cloudflare_r2_bucket" "this" {
  account_id = var.account_id
  name       = var.name
  location   = var.location != "auto" ? var.location : null
}

output "name" {
  value = cloudflare_r2_bucket.this.name
}
