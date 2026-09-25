# -----------------------------------------------------------------------------
# Flare infrastructure on Cloudflare (free plan throughout).
#
#   D1  -> relational store for users, conversations and transcripts
#   R2  -> optional public asset bucket for the 3D models
#   Pages -> the statically exported web client
#
# The API Worker itself is deployed by Wrangler from CI (`wrangler deploy`), which also
# manages its secrets; Terraform only provisions the resources the Worker binds to.
# -----------------------------------------------------------------------------

locals {
  name_prefix = var.project_name
}

module "database" {
  source     = "./modules/d1-database"
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-db"
}

module "assets" {
  source     = "./modules/r2-bucket"
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-assets"
  location   = var.r2_location
}

module "web" {
  source            = "./modules/pages-project"
  account_id        = var.cloudflare_account_id
  name              = "${local.name_prefix}-web"
  production_branch = "main"
}

# Existing state was created with top-level resources; keep their addresses stable so
# `terraform apply` does not try to destroy and recreate them.
moved {
  from = cloudflare_d1_database.flare_db
  to   = module.database.cloudflare_d1_database.this
}

moved {
  from = cloudflare_r2_bucket.app_assets
  to   = module.assets.cloudflare_r2_bucket.this
}

moved {
  from = cloudflare_pages_project.frontend
  to   = module.web.cloudflare_pages_project.this
}
