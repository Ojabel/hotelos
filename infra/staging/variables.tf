variable "project_id" {
  description = "Dedicated Google Cloud project approved for this organization staging environment."
  type        = string
}

variable "region" {
  description = "Cloud Run and Cloud SQL region. Confirm data location and service availability before provisioning."
  type        = string
  default     = "africa-south1"
}

variable "organization_id" {
  description = "Existing HotelOS organization UUID assigned to this isolated environment."
  type        = string
}

variable "firebase_project_id" {
  description = "Existing Firebase project ID. Review existing apps and IAM before granting the runtime service account any Firebase permissions."
  type        = string
  default     = "com-example-geminitestap-8198d"
}

variable "api_image" {
  description = "Immutable backend container image digest in a private Artifact Registry repository."
  type        = string
}

variable "frontend_origin" {
  description = "Exact HTTPS staging frontend origin allowed by API CORS."
  type        = string
}

variable "api_public_invoker" {
  description = "Set true only after application auth/security review; Firebase bearer tokens are still required by protected API routes."
  type        = bool
  default     = false
}

variable "sql_tier" {
  description = "Cloud SQL machine tier; estimate region-specific cost before use."
  type        = string
  default     = "db-custom-1-3840"
}

variable "sql_availability_type" {
  description = "Use ZONAL for staging; evaluate REGIONAL for production availability and cost."
  type        = string
  default     = "ZONAL"
  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.sql_availability_type)
    error_message = "sql_availability_type must be ZONAL or REGIONAL."
  }
}

variable "database_url_secret_id" {
  description = "Existing Secret Manager secret ID containing the PostgreSQL URL (not the value)."
  type        = string
  default     = "hotelos-staging-database-url"
}

variable "smtp_user_secret_id" {
  description = "Existing Secret Manager secret ID containing SMTP username."
  type        = string
  default     = "hotelos-staging-smtp-user"
}

variable "smtp_password_secret_id" {
  description = "Existing Secret Manager secret ID containing SMTP password."
  type        = string
  default     = "hotelos-staging-smtp-password"
}

variable "smtp_host" {
  description = "Verified SMTP provider host."
  type        = string
  default     = ""
}

variable "email_from" {
  description = "Verified sender address, for example HotelOS <no-reply@example.com>."
  type        = string
  default     = ""
}

variable "minimum_cloud_run_instances" {
  description = "Keep scale-to-zero for staging unless an approved availability requirement requires a warm instance."
  type        = number
  default     = 0
}

variable "maximum_cloud_run_instances" {
  type    = number
  default = 3
}
