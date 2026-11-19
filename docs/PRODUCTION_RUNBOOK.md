# Production operations runbook (staging preparation)

This is an operational template. There is no deployed Google Cloud service yet.

## Availability and health

Check Cloud Run service status and `/api/v1/health`; check `/api/v1/health/database` for database readiness. Inspect Cloud Monitoring for request count/latency/5xx, Cloud SQL CPU/storage/connections, backup/PITR completion, SMTP delivery failures, Firebase auth failures, and logs. Alert on sustained 5xx, readiness failure, exhausted connections, storage headroom, failed backup, or elevated auth denial spikes.

## Logs and incidents

Use Cloud Logging filtered by Cloud Run service, revision and `x-correlation-id`. App logs redact authorization/cookies, request URLs/query, passwords, tokens, refresh tokens and card security fields. Do not paste raw tokens, invitation links, guest PII, or secrets into tickets. Preserve relevant audit events with controlled access and retention.

## Failed deployment / rollback

1. Halt rollout and record service revision, image digest, migration state, correlation IDs and time.
2. Check health, startup errors, secret versions, ADC/IAM, SQL connections and recent schema changes.
3. If app-only, route traffic back to the prior immutable Cloud Run revision or deploy the previous digest.
4. Do not reverse/drop an applied migration. Use additive forward fix unless a separately approved restore plan is needed.
5. Verify health, authentication, one synthetic reservation read/write, finance read/write in test environment, and alert recovery.

## Database recovery

Use `DATABASE_BACKUP_RECOVERY.md`. Restore PITR/backup to a new isolated Cloud SQL instance; verify tenant integrity and app behavior; obtain owner approval before any connection cutover. Do not restore over a source database.

## Account and security incident

Suspend/revoke the HotelOS membership in the appropriate organization; revoke Firebase refresh tokens via an authorized admin process; verify API denial; rotate affected secrets and SMTP credentials; preserve audit events and provider logs; follow the privacy breach assessment and notification process with the designated privacy lead. Do not disable unrelated Firebase applications or rotate project-wide keys without owner impact review.

## Status

No Cloud Logging alert policy, uptime check, email alert, backup monitor, or incident escalation route is configured or tested yet. Assign on-call, privacy, database, Firebase, and billing owners before a real staging launch.
