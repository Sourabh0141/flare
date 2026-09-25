terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.52"
    }
  }
}

variable "account_id" {
  description = "Cloudflare account that owns the project"
  type        = string
}

variable "name" {
  description = "Pages project name; also the `<name>.pages.dev` subdomain"
  type        = string
}

variable "production_branch" {
  type    = string
  default = "main"
}

variable "node_version" {
  description = "Node.js version used by Pages builds (deploys from CI use direct upload instead)"
  type        = string
  default     = "22"
}

resource "cloudflare_pages_project" "this" {
  account_id        = var.account_id
  name              = var.name
  production_branch = var.production_branch

  build_config {
    build_command   = "npm run build --workspace=@flare/web"
    destination_dir = "out"
    root_dir        = "apps/web"
  }

  deployment_configs {
    production {
      environment_variables = {
        NODE_VERSION = var.node_version
      }
    }
    preview {
      environment_variables = {
        NODE_VERSION = var.node_version
      }
    }
  }
}

output "name" {
  value = cloudflare_pages_project.this.name
}

output "subdomain" {
  description = "Default `*.pages.dev` hostname"
  value       = cloudflare_pages_project.this.subdomain
}
