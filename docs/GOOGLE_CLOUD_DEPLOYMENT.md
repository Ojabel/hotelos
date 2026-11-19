# Google Cloud deployment preparation

No project resources were provisioned. A Cloud Run/Cloud SQL/Secret Manager Terraform scaffold is in `infra/staging`; `terraform apply` is intentionally not run. The active local Google Cloud identity does not have verified access to the Firebase project, and no Google Cloud project/region/billing approval was confirmed.

## Preconditions

- Confirm a dedicated Google Cloud project, billing account, owner, region, organization ID, domain, and monthly spending alert.
- Review and initialize Terraform state in a protected remote backend with locking and access controls; the scaffold defaults to local state until configured.
- Build/test the backend container, publish it to a private Artifact Registry repository, and deploy by immutable image digest.
- Create database and SMTP secrets out of band. Grant Cloud Run's runtime service account Secret Accessor only on the named secrets, Cloud SQL Client on the instance, and the minimum Firebase Auth permission needed for revocation checks.
- Decide whether the Cloud Run API is intentionally invokable by `allUsers` at the network layer. The application still verifies Firebase bearer tokens and database authorization; keep public invoker disabled until security review approves it.

The runtime `DATABASE_URL` must point to the Cloud SQL Unix socket mounted by the Cloud Run connector, using a properly URL-encoded password, for example `postgresql://hotelos_app:<encoded-password>@/hotelos_staging?host=%2Fcloudsql%2F<project>:<region>:hotelos-staging-db`. Provision the database role separately with least privilege. Use a separate owner/migration identity for `prisma migrate deploy`; do not give the runtime application role schema-owner privileges unless the reviewed migration procedure requires it.

## Local preparation (does not provision cloud resources)

```powershell
cd backend
npm ci
npm run prisma:validate
npm run typecheck
npm run build
docker build -t hotelos-api:staging .
```

The container expects Cloud Run's `PORT` (typically 8080), uses `/api/v1/health` for liveness and `/api/v1/health/database` for readiness. Run migrations separately using a controlled migration job and a database URL stored in Secret Manager; do not run `prisma migrate dev` against staging/production.

## Terraform preview and apply (billable)

```powershell
cd infra/staging
terraform init
terraform validate
terraform plan -var-file=staging.tfvars
```

Review the entire plan, cost, IAM and public-invoker state. `terraform apply` can create billable Cloud SQL, Cloud Run and supporting resources. Do not run it until the user explicitly approves the exact plan. Cloud SQL deletion protection is enabled and lifecycle `prevent_destroy` is set; recovery or teardown must be deliberate.

The scaffold is a starting point, not a verified production module. Terraform is not installed on the current machine, so formatting/validation has not been executed here. Do not apply it without validation and a reviewed remote state backend.

## Deploy and smoke test after approval

After approved infrastructure and CI setup, deploy the immutable image with `gcloud run deploy` to the named service/project/region, inject Secret Manager versions, and attach the Cloud SQL instance. Migrate first using a separate migration job. Verify:

```powershell
curl.exe -fsS https://<api-host>/api/v1/health
curl.exe -fsS https://<api-host>/api/v1/health/database
```

Then test guest/staff Firebase login, CORS, SMTP delivery, revocation, organization scope, logs/alerts, and rollback using `STAGING_TEST_PLAN.md`. Never deploy publicly or create paid resources until the plan and budget have explicit approval.

## Rollback

Deploy the previous immutable image digest; do not use an unreviewed Terraform destroy. For schema changes, use expand/contract additive migrations and verify backward compatibility before rolling back an application image. Restore data only to a new isolated Cloud SQL instance/database, then direct a reviewed recovery cutover.
