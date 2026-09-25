terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.52"
    }
  }
}

variable "account_id" {
  description = "Cloudflare account that owns the database"
  type        = string
}

variable "name" {
  description = "Database name; must match the `database_name` in the Worker's wrangler.jsonc"
  type        = string
}

resource "cloudflare_d1_database" "this" {
  account_id = var.account_id
  name       = var.name
}

output "id" {
  description = "Database UUID for the Worker's `database_id` binding"
  value       = cloudflare_d1_database.this.id
}

output "name" {
  value = cloudflare_d1_database.this.name
}
