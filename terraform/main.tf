# -----------------------------------------------------------------------------
# Cloudflare R2 Buckets
# -----------------------------------------------------------------------------

# 1. Private bucket for Terraform remote state locking
resource "cloudflare_r2_bucket" "terraform_state" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-tf-state"
  location   = var.r2_location != "auto" ? var.r2_location : null
}

# 2. Public application assets bucket (avatar.glb, animations.glb, fallback.mp3)
resource "cloudflare_r2_bucket" "app_assets" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-assets"
  location   = var.r2_location != "auto" ? var.r2_location : null
}

# -----------------------------------------------------------------------------
# Cloudflare D1 Relational SQLite Database
# -----------------------------------------------------------------------------

resource "cloudflare_d1_database" "flare_db" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-db"
}

# -----------------------------------------------------------------------------
# Cloudflare Pages Project for Next.js Frontend
# -----------------------------------------------------------------------------

resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "${var.project_name}-web"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "out"
    root_dir        = "apps/web"
  }

  deployment_configs {
    production {
      environment_variables = {
        NODE_VERSION = "22"
      }
    }
  }
}
