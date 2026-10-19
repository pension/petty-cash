locals {
  project_id             = "staging-278118"
  location               = "asia-northeast1"
  github_owner           = "pension"
  repo_name              = "petty-cash"
  github_connection_name = "github-conn"

  trigger_branch_name = "staging"

  # One GitHub repo, two deployable apps (petty-cash-api, petty-cash-ui) built from
  # the same Dockerfile via different --target values (see Dockerfile /
  # cloudbuild-stag*.yml) — each needs its own trigger + yaml path, since
  # this org's cloudbuild_trigger module has no path-filter support, so
  # every push to `staging` fires BOTH triggers regardless of which app
  # actually changed.
  cloudbuild_yaml_path_api = "cloudbuild-stag-api.yml"
  cloudbuild_yaml_path_ui  = "cloudbuild-stag-ui.yml"
}

# Just the Cloud Build v2 repo connection + push triggers — no Pub/Sub
# (petty-cash doesn't use it) and no Cloud SQL/DB resources (the staging DB
# already exists; Cloud Run's own --set-cloudsql-instances flag in
# cloudbuild-stag-api.yml is what actually wires the connection, not Terraform).
module "cloudbuild_repo" {
  source = "git::https://github.com/pension/iac.git//modules/cloudbuild_repo?ref=v1.0.0"

  project_id             = local.project_id
  location               = local.location
  github_owner           = local.github_owner
  repo_name              = local.repo_name
  github_connection_name = local.github_connection_name
}

# NOT using the shared cloudbuild_trigger module here (unlike cloudbuild_repo
# above) — it hardcodes `service_account` to the legacy default Cloud Build
# SA (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`, confirmed unchanged
# even at its latest tag, v1.2.1, and not exposed as an overridable
# variable), which this project's build validation rejects outright:
# "invalid value for `build.service_account`: provide a user-managed service
# account or leave unset". Defining the trigger resource directly instead,
# with no `service_account` set — Cloud Build then picks one itself, per
# that same error message's own suggested fix.
resource "google_cloudbuild_trigger" "api_push" {
  provider = google-beta

  location = local.location
  name     = "petty-cash-api-push-trigger"

  git_file_source {
    path       = local.cloudbuild_yaml_path_api
    repo_type  = "GITHUB"
    repository = module.cloudbuild_repo.repository_id
  }

  repository_event_config {
    repository = module.cloudbuild_repo.repository_id
    push {
      branch = "^${local.trigger_branch_name}$"
    }
  }
}

resource "google_cloudbuild_trigger" "ui_push" {
  provider = google-beta

  location = local.location
  name     = "petty-cash-ui-push-trigger"

  git_file_source {
    path       = local.cloudbuild_yaml_path_ui
    repo_type  = "GITHUB"
    repository = module.cloudbuild_repo.repository_id
  }

  repository_event_config {
    repository = module.cloudbuild_repo.repository_id
    push {
      branch = "^${local.trigger_branch_name}$"
    }
  }
}
