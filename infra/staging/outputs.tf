output "cloud_run_api_uri" {
  value       = google_cloud_run_v2_service.api.uri
  description = "API URL; IAM remains private unless api_public_invoker is explicitly enabled."
}

output "cloud_sql_connection_name" {
  value       = google_sql_database_instance.staging.connection_name
  description = "Connection name used by the Cloud Run Cloud SQL connector mount."
}

output "runtime_service_account" {
  value       = google_service_account.runtime.email
  description = "Cloud Run runtime workload identity principal."
}
