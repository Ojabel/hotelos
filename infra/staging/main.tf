locals {
  required_apis = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "hotelos-staging-runtime"
  display_name = "HotelOS staging Cloud Run runtime"
}

resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_sql_database_instance" "staging" {
  project             = var.project_id
  name                = "hotelos-staging-db"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = var.sql_tier
    availability_type = var.sql_availability_type
    disk_type         = "PD_SSD"
    disk_size         = 20
    disk_autoresize   = true
    disk_autoresize_limit = 100
    activation_policy = "ALWAYS"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 14
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled        = true
      ssl_mode            = "ENCRYPTED_ONLY"
      enable_private_path_for_google_cloud_services = true
    }
  }

  depends_on = [google_project_service.required]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_sql_database" "hotelos" {
  project  = var.project_id
  name     = "hotelos_staging"
  instance = google_sql_database_instance.staging.name
}

resource "google_secret_manager_secret_iam_member" "runtime_database_url" {
  project   = var.project_id
  secret_id = var.database_url_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_smtp_user" {
  project   = var.project_id
  secret_id = var.smtp_user_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_smtp_password" {
  project   = var.project_id
  secret_id = var.smtp_password_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "api" {
  project             = var.project_id
  name                = "hotelos-staging-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  template {
    service_account = google_service_account.runtime.email
    timeout         = "60s"
    max_instance_request_concurrency = 40

    scaling {
      min_instance_count = var.minimum_cloud_run_instances
      max_instance_count = var.maximum_cloud_run_instances
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "AUTH_MODE"
        value = "firebase"
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.firebase_project_id
      }
      env {
        name  = "FIREBASE_AUTH_MODE"
        value = "standard"
      }
      env {
        name  = "TENANT_ORGANIZATION_ID"
        value = var.organization_id
      }
      env {
        name  = "CORS_ORIGINS"
        value = var.frontend_origin
      }
      env {
        name  = "APP_BASE_URL"
        value = var.frontend_origin
      }
      env {
        name  = "API_DOCS_ENABLED"
        value = "false"
      }
      env {
        name  = "EMAIL_DELIVERY_MODE"
        value = "smtp"
      }
      env {
        name  = "EMAIL_FROM"
        value = var.email_from
      }
      env {
        name  = "SMTP_HOST"
        value = var.smtp_host
      }
      env {
        name  = "SMTP_PORT"
        value = "587"
      }
      env {
        name  = "SMTP_SECURE"
        value = "false"
      }
      env {
        name  = "DATABASE_POOL_MAX"
        value = "5"
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SMTP_USER"
        value_source {
          secret_key_ref {
            secret  = var.smtp_user_secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SMTP_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = var.smtp_password_secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 12
        http_get {
          path = "/api/v1/health"
          port = 8080
        }
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.staging.connection_name]
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.cloud_sql_client,
    google_secret_manager_secret_iam_member.runtime_database_url,
    google_secret_manager_secret_iam_member.runtime_smtp_user,
    google_secret_manager_secret_iam_member.runtime_smtp_password,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_api_invoker" {
  count    = var.api_public_invoker ? 1 : 0
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
