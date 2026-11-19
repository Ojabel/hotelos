# Milestone 4.1 readiness report

**Audit date:** 2026-11-20. **Decision:** **Not ready** for a real staging deployment. The repository has working local auth/database/browser foundations, but Firebase project access, SMTP credentials, Cloud project configuration, Terraform validation, staging deployment, and real backup restoration are missing or unverified.

## A. Audit findings

- Workspace: `C:\Users\OJ TECH\Downloads\hotelos-m5`. There is no `.git` directory at workspace, backend, or frontend level; no branch or Git working-tree status can be obtained. Preserve existing files, including local `backend/.env`, root `firebase-debug.log`, and Firebase Emulator config.
- Backend `.env` is local development configuration and points at `hotelos_dev`; frontend `.env` is absent, `.env.example` uses blank Firebase values. No credential values are reproduced here.
- Local PostgreSQL is reachable. `prisma migrate status` reports all 9 unique migrations current on `hotelos_dev` and `hotelos_m4_test`. The `20261117090000_guest_firebase_identity` directory was written Nov 16 and dated Nov 17, so was one day future-dated when first applied; the current date is Nov 20. `hotelos_dev` records a successful application. `hotelos_m4_test` has a rolled-back first attempt (UTF-8 BOM before `ALTER`) followed by a successful application; there is no unresolved failed migration. The applied migration was not renamed or rewritten. Existing financial migrations remain intact.
- Existing tests/builds from the prior milestone: backend unit 29 passed; PostgreSQL integration/e2e 9 passed; frontend unit 118 passed; Playwright operations/facilities/finance 3 passed, guest emulator 2 passed; frontend/backend typecheck and builds passed. Emulator workflows are not real provider verification.
- `hotelos_m4_test` is preserved and was used for scoped synthetic PostgreSQL integration/browser fixtures; scoped fixtures were cleaned up by the tests. No reset/drop was performed. `hotelos_dev` and `attendx` were not changed. This milestone made no database schema migration.
- No repository Terraform, Dockerfile, staging deployment, monitoring, or backup/restore runbook existed at audit start. PostgreSQL command-line backup utilities and Terraform are not installed. No actual backup/restore was performed.

## B. Firebase and email

- Required project: `com-example-geminitestap-8198d`; frontend config is expected through Vite environment variables. Project ID/domain/sender/app IDs match user-supplied values in setup guidance; no source hardcodes the real project into auth initialization.
- Read-only Firebase CLI app listing returned HTTP 403 `PERMISSION_DENIED`. Existing Web Apps, email/password and Google provider settings, authorized domains, mail templates, key restrictions, and project IAM could not be checked. No real Firebase login was attempted.
- Firebase Admin uses ADC/workload identity in standard mode and calls `verifyIdToken(token, true)` for revocation checking. Database membership/guest ownership remains the HotelOS authorization source. Emulator browser tests passed previously.
- Staff email is configurable SMTP; live provider credentials/sender are absent. Guest verification/password reset are Firebase-managed. Local capture is not sending email and is now recorded `NOT_SENT`; real email remains unverified.

## C. Changes in this milestone

- Fixed local invitation capture to report `NOT_SENT` instead of `DELIVERED`; adjusted staff invitation UI messages and added email delivery regression tests.
- Bounded PostgreSQL pool configuration with `DATABASE_POOL_MAX` default 5 for Cloud Run scaling control.
- Added deployment, Firebase, email, backup/recovery, security, staging test, runbook, cost estimate, and milestone report documents.
- Added a backend container and Terraform staging scaffold under `backend/` and `infra/staging/`. No infrastructure was applied.
- No Prisma migration was required; no database schema was changed.

## D. Test results

After changes: backend unit tests 31 passed (`cd backend; npm test -- --runInBand`); PostgreSQL e2e 9 passed (`npm run test:e2e` against `hotelos_m4_test`); frontend unit tests 118 passed (`cd hotelos; npm test -- --reporter=dot`); operations/finance/facilities Playwright 3 passed (`npm run test:browser`); guest Auth Emulator Playwright 2 passed (`npm run test:browser:guest`). Backend and frontend typecheck/build passed; backend lint passed; frontend lint passed with one pre-existing unused-disable warning in `src/pages/billing/BillingOverview.tsx:41`. Production dependency audits reported zero vulnerabilities for both packages; full audits still report development dependency advisories (backend 5 low/23 moderate; frontend 7 moderate). Browser tests use local PostgreSQL and Auth Emulator, not real Firebase/SMTP/Cloud Run. Terraform validation cannot run because Terraform is not installed. Real staging Firebase, SMTP, Cloud Run, Cloud SQL, and restore tests have not executed.

## E. Security findings

- Critical: none confirmed by the limited source audit (not a penetration test).
- High dependency advisories in backend Nodemailer and transitive `@grpc/grpc-js` were addressed by updating Nodemailer and pinning the transitive dependency to a patched release. Production-only `npm audit --omit=dev` reports 0 vulnerabilities in both packages; full audit still reports development dependency findings (backend 5 low/23 moderate; frontend 7 moderate).
- High: staff-assisted guest identity linking accepts staff-selected verification method and free-text case reference; server audits the action but does not independently verify that identity proof/manager review occurred. Require trained trusted operators and a verifiable, independently reviewed case workflow before broad staging use.
- High: no live provider/deployment integration tests or Firebase app review due missing project access and provider configuration.
- Medium: invitation delivery has no durable retry/outbox/provider bounce reconciliation; local success misreporting fixed.
- Medium: throttling is per process/instance, not a distributed Cloud Run-wide limit; bound autoscaling and add edge controls for public load.
- Medium: payment provider/webhook live readiness is not established; no live payment credentials/webhooks were tested. No raw card data storage was identified in reviewed schema paths.
- Medium: no local restore test (tools absent), no Cloud SQL backup configured, no production-provider exercise.
- Nigeria privacy assessment is preliminary: review NDPA 2023 lawful basis, privacy notice, data rights/retention, breach handling, processor terms, and cross-border transfer conditions with a qualified privacy/legal professional. No legal compliance claim is made.

## F. Deployment readiness

Prepared: source-level configuration, container recipe, bounded database pool, Cloud Run/Cloud SQL/Secret Manager architecture, Terraform scaffold, health endpoints, deployment and rollback instructions. Not ready: Firebase Console permission, Cloud project/region/billing approval, SMTP sender and secrets, dedicated staging database, Terraform CLI validation/remote state, deployment, live browser tests, monitoring, and isolated restore.

## G. Costs

Planning ranges (USD/month, estimate date 2026-11-20): staging $55-140; small hotel HA production $150-350; growing hotel $400-1,100+. Detailed assumptions and official price links are in [deployment cost estimate](DEPLOYMENT_COST_ESTIMATE.md). These are not quotes; confirm region, edition, egress, backup, email, domain, and Firebase plan.

## H. Manual actions required

1. Firebase project owner must grant access or verify existing Web App/provider/auth domains/templates and Cloud Run service-account permissions in the existing project.
2. Confirm a dedicated Google Cloud project/region/budget and an organization tenant ID; no paid resources are created by this work.
3. Choose and configure verified SMTP sender/provider and store staging credentials in Secret Manager.
4. Install/approve Terraform, configure protected remote state, review `terraform plan`, and explicitly approve a billable plan before apply.
5. Install PostgreSQL client tools and run an isolated backup/restore exercise only against a new disposable recovery target.
6. Implement/approve robust guest identity verification case workflow and run all staging categories from `STAGING_TEST_PLAN.md`.

## I. Known limitations

- No staging deploy, actual Firebase Web App/settings audit, real Google/email-auth test, SMTP delivery, Cloud SQL operations, backup restore, monitoring, live payment, or legal assessment was completed.
- Firebase CLI app list was denied (403). No project settings were changed.
- Terraform scaffold is unvalidated on this machine and must be reviewed before use.
- No frontend hosting site was created because existing Firebase project apps/settings are not visible to the current account.
- No existing database was reset, dropped, overwritten, or schema-migrated during this milestone. PostgreSQL tests did create and clean up scoped synthetic rows in `hotelos_m4_test`.

## J. Final readiness

**Not ready.** Local development and the existing emulator/PostgreSQL suite are working, and deployment preparation is documented, but staging requires Firebase project owner access, email delivery, cloud approval/provisioning, Terraform validation, and actual integration/recovery evidence.
