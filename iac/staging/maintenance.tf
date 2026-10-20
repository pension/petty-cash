# Opt in only after the app's verified deployment inputs are available.
variable "float_operations" {
  type = object({
    image                     = string
    receipt_bucket            = string
    app_service_account       = string
    scheduler_service_account = string
    database_url_secret       = string
    cloud_sql_instance        = string
    vpc_connector             = string
  })
  default = null
}
resource "google_storage_bucket" "receipts" {
  count                       = var.float_operations == null ? 0 : 1
  name                        = var.float_operations.receipt_bucket
  project                     = local.project_id
  location                    = local.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
}
resource "google_storage_bucket_iam_member" "receipt_access" {
  count  = var.float_operations == null ? 0 : 1
  bucket = google_storage_bucket.receipts[0].name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${var.float_operations.app_service_account}"
}
resource "google_cloud_run_v2_job" "maintenance" {
  count    = var.float_operations == null ? 0 : 1
  name     = "petty-cash-maintenance"
  location = local.location
  project  = local.project_id
  template {
    template {
      service_account = var.float_operations.app_service_account
      max_retries     = 2
      timeout         = "900s"
      vpc_access {
        connector = var.float_operations.vpc_connector
        egress    = "PRIVATE_RANGES_ONLY"
      }
      volumes {
        name = "cloudsql"
        cloud_sql_instance { instances = [var.float_operations.cloud_sql_instance] }
      }
      containers {
        image   = var.float_operations.image
        command = ["node"]
        args    = ["dist/src/cli.js", "maintenance"]
        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
        env {
          name  = "FILE_STORAGE"
          value = "gcs"
        }
        env {
          name  = "STORAGE_MEDIA_BUCKET"
          value = var.float_operations.receipt_bucket
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.float_operations.database_url_secret
              version = "latest"
            }
          }
        }
      }
    }
  }
}
resource "google_cloud_run_v2_job_iam_member" "maintenance_invoker" {
  count    = var.float_operations == null ? 0 : 1
  project  = local.project_id
  location = local.location
  name     = google_cloud_run_v2_job.maintenance[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.float_operations.scheduler_service_account}"
}
resource "google_cloud_scheduler_job" "maintenance" {
  count     = var.float_operations == null ? 0 : 1
  name      = "petty-cash-maintenance"
  project   = local.project_id
  region    = local.location
  schedule  = "0 9 * * *"
  time_zone = "Indian/Maldives"
  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${local.project_id}/locations/${local.location}/jobs/${google_cloud_run_v2_job.maintenance[0].name}:run"
    oauth_token { service_account_email = var.float_operations.scheduler_service_account }
  }
}
