terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.52"
    }
  }

  # S3-compatible remote state backend targeting Cloudflare R2.
  #
  # R2 credentials and endpoint are injected dynamically during `terraform init`:
  #   terraform init \
  #     -backend-config="access_key=${R2_ACCESS_KEY_ID}" \
  #     -backend-config="secret_key=${R2_SECRET_ACCESS_KEY}" \
  #     -backend-config="endpoints={s3=\"https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com\"}"
  #
  # Note on bootstrapping:
  # For a fresh environment, comment out this backend block for the first run,
  # execute `terraform apply` locally to provision the state bucket, then uncomment
  # this block and run `terraform init -migrate-state`.
  backend "s3" {
    bucket                      = "flare-tf-state"
    key                         = "production/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
