terraform {
  backend "gcs" {}
}

provider "google" {
  project = "staging-278118"
  region  = "asia-northeast1"
}

provider "google-beta" {
  project = "staging-278118"
  region  = "asia-northeast1"
}
