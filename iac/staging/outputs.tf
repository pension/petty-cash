output "connection_resource" {
  description = "Cloud Build v2 connection resource string."
  value       = module.cloudbuild_repo.connection_resource
}

output "repository_id" {
  description = "Cloud Build v2 repository id."
  value       = module.cloudbuild_repo.repository_id
}

output "trigger_id_api" {
  description = "Cloud Build trigger id for petty-cash-api."
  value       = google_cloudbuild_trigger.api_push.id
}

output "trigger_id_ui" {
  description = "Cloud Build trigger id for petty-cash-ui."
  value       = google_cloudbuild_trigger.ui_push.id
}
