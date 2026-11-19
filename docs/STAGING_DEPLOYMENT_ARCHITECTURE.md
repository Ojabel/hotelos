# Staging deployment architecture

## Proposed topology

- React/Vite static frontend hosted as a **separate Firebase Hosting site** in the already selected Firebase project `com-example-geminitestap-8198d`. Create/inspect the Hosting site only after the Firebase project administrator confirms it will not affect the project's other apps.
- NestJS API container on Cloud Run, with Firebase ID tokens verified by Firebase Admin and PostgreSQL-backed HotelOS authorization.
- A dedicated Cloud SQL PostgreSQL instance and database per organization environment. Multiple hotels inside the organization share that environment, with existing organization/hotel authorization retained. Platform administration remains a separate trust boundary.
- Secret Manager for the database connection string and SMTP credentials. Cloud Run uses its runtime service account/Application Default Credentials; never mount an Admin private key.
- Cloud Logging/Monitoring from structured stdout/stderr and health endpoints. Cloud Storage is not wired as an application file service in this repository; do not upload guest documents until that integration and retention policy exist.

No Google Cloud resource was created. `infra/staging` is a review scaffold; its defaults protect the SQL instance from accidental deletion and keep Cloud Run IAM-private until explicitly made public for Firebase-token-based API access. `terraform apply` can create billable resources and expose a service if the public invoker option is enabled.

## Network and scaling

Start with Cloud Run request-based billing, scale-to-zero, a small maximum instance count, bounded PostgreSQL pool size, Cloud SQL connector attachment, and TLS enforced by Cloud SQL. The application defaults to `DATABASE_POOL_MAX=5`; review `pool maximum × Cloud Run max instances` against the chosen Cloud SQL connection limit before increasing either. A Cloud SQL connector provides authenticated encrypted connectivity; do not add broad authorized networks. Use private IP/VPC only after the organization chooses its network and accepts the additional network cost and operational work.

Configure Cloud Run startup/liveness at `/api/v1/health`; monitor database readiness at `/api/v1/health/database`. Configure an explicit production `CORS_ORIGINS`, `APP_BASE_URL`, `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID=com-example-geminitestap-8198d`, `FIREBASE_AUTH_MODE=standard`, and `EMAIL_DELIVERY_MODE=smtp`. Do not expose Swagger in production.

## Environment boundaries

Use different Firebase Auth Emulator projects for tests and the confirmed real Firebase project for staging. Keep the PostgreSQL test database `hotelos_m4_test`, local `hotelos_dev`, and any future staging Cloud SQL database separate. Use synthetic test guests only. Never point browser cleanup at either local database.

Use one isolated Cloud Run/Cloud SQL environment per organization. Keep the platform-admin service identity separate and restrict it to audited support actions. Do not make hotel IDs or organization IDs client-authoritative.

## Readiness gates

1. Firebase project owner confirms existing Web App, provider settings, authorized domains, and a dedicated staging Hosting site/domain.
2. Create a dedicated staging Google Cloud project or confirm an isolated project, region, billing owner, and organization tenancy bootstrap process.
3. Provision only after cost approval; populate Secret Manager out of band; deploy a reviewed image by immutable digest.
4. Apply migrations with a dedicated migration identity, then run the staging plan in `STAGING_TEST_PLAN.md`.
5. Validate backup restore, alerting, rollback, CORS, auth revocation and invitation email before inviting staff or entering guest data.

See [Google Cloud deployment](GOOGLE_CLOUD_DEPLOYMENT.md), [backup/recovery](DATABASE_BACKUP_RECOVERY.md), and [runbook](PRODUCTION_RUNBOOK.md).
