# Staging integration test plan

Use a dedicated Cloud SQL staging database and controlled Firebase staging identities in the existing project. Use synthetic guests and staff only. Keep `hotelos_dev` and `hotelos_m4_test` separate from deployed staging.

## Preflight

- Confirm authorized staging project/domain, Cloud Run service account, SQL connection, Secret Manager, SMTP sender, Firebase providers/templates, CORS and budget alerts.
- Apply reviewed migrations with a dedicated job; verify all nine current migrations and additive future changes.
- Confirm `/api/v1/health` and `/api/v1/health/database`, logs, correlation ID, dashboards and alerts.
- Record app image digest, database migration version, Firebase project, test identities, start time and rollback image digest.

## Test matrix

| Area | Required cases |
|---|---|
| Guest auth | Email registration and verification; verification pending denial; login; password reset email; Google popup; logout; refresh; expired/revoked token; account change clears previous guest state. |
| Guest identity | New profile; verified existing guest linking by authorized staff case; matching-email without proof denied; duplicate record conflict; reservation history preserved. |
| Guest authorization | Own profile/reservations/services; cross-guest lookup and cancel denial; profile field allowlist; no staff, finance-admin, or organization-admin access. |
| Staff auth | Invitation email delivered by SMTP; verified password account accepts; guest Google account rejected; expiry; one-time token; duplicate prevention; suspended/revoked membership; permission changes. |
| Hotel operations | Room/category, guest, reservation create/edit/cancel, overlap prevention, check-in, transfer, checkout, housekeeping, inspection, maintenance/work order. |
| Finance | Folio/charges, invoice, payment record, receipt, refund, expense, audit/idempotency, persisted values after reload. Use test-only payment providers; no live funds. |
| Tenancy/security | Cross-organization and cross-hotel access; wrong role/permission; token for another Firebase project; revoked Firebase session; input validation, rate limit, CORS, log redaction. |
| Recovery | Restore Cloud SQL backup/PITR to new isolated target; check migration state, tenant integrity, representative operations; record achieved RPO/RTO and clean test routing. |

Run the current local tests first: backend `npm test`, `npm run test:e2e` (requires isolated `hotelos_m4_test`), frontend `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`, `npm run test:browser:guest` from their respective folders. Guest browser test is Auth Emulator-backed; it is not evidence of real Google OAuth, Firebase emails, SMTP, or Cloud Run.

For staging, use a separate Playwright config and explicit staging URL/credentials held in CI secret storage. Require an explicit opt-in variable and dedicated `hotelos_staging_test` database. Never run destructive fixture cleanup against the live staging dataset without an isolated test tenant and scoped cleanup. Count discovered/executed/passed/failed/skipped separately; any skip requires a documented owner and reason.

## Release gate

All categories above must execute against staging without hidden skips; no production PII or live payment; no outstanding critical/high finding without accepted mitigation; smoke test previous image rollback; successful isolated restore; verified mail receipts and Firebase provider flow. Record evidence in `MILESTONE_4_1_REPORT.md` and sign off with operations/security owners.
