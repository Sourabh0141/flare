output "d1_database_id" {
  description = "UUID of the D1 database; must match `database_id` in apps/api/wrangler.jsonc"
  value       = module.database.id
}

output "d1_database_name" {
  value = module.database.name
}

output "r2_assets_bucket_name" {
  value = module.assets.name
}

output "r2_state_bucket_name" {
  description = "Bucket holding Terraform state; bootstrapped outside this configuration"
  value       = "${var.project_name}-tf-state"
}

output "pages_project_name" {
  value = module.web.name
}

output "pages_subdomain" {
  description = "Default *.pages.dev hostname of the web client"
  value       = module.web.subdomain
}
