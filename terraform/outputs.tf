# -----------------------------------------------------------------------------
# D1 Database Outputs
# -----------------------------------------------------------------------------

output "d1_database_id" {
  description = "UUID of the D1 database (used for database_id binding in wrangler.toml)"
  value       = cloudflare_d1_database.flare_db.id
}

output "d1_database_name" {
  description = "Name of the D1 database"
  value       = cloudflare_d1_database.flare_db.name
}

# -----------------------------------------------------------------------------
# R2 Storage Outputs
# -----------------------------------------------------------------------------

output "r2_assets_bucket_name" {
  description = "Name of the public assets R2 bucket"
  value       = cloudflare_r2_bucket.app_assets.name
}

output "r2_state_bucket_name" {
  description = "Name of the private Terraform state R2 bucket"
  value       = cloudflare_r2_bucket.terraform_state.name
}

# -----------------------------------------------------------------------------
# Cloudflare Pages Outputs
# -----------------------------------------------------------------------------

output "pages_project_name" {
  description = "Name of the Cloudflare Pages project"
  value       = cloudflare_pages_project.frontend.name
}

output "pages_subdomain" {
  description = "Default *.pages.dev subdomain for the deployed frontend"
  value       = cloudflare_pages_project.frontend.subdomain
}
