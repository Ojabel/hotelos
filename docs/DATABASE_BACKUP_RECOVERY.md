# Database backup and recovery

## Current state

Local PostgreSQL is reachable. Prisma reports all nine unique migrations up to date on both `hotelos_dev` and `hotelos_m4_test`. The guest migration name is dated Nov 17 and its directory write time is Nov 16; it was one day future-dated when first applied, and is no longer future-dated as of Nov 20, 2026. In `hotelos_m4_test`, `_prisma_migrations` retains a rolled-back first attempt that failed because the SQL file began with a UTF-8 BOM before `ALTER`, followed by the successful applied attempt. `hotelos_dev` has one successful entry. The current migration is applied and the schema is up to date; do not rename or rewrite it. This audit did not find a configured backup job, retention policy, or existing recovery runbook in the repository. `psql`, `pg_dump`, and `pg_restore` are not installed/on PATH here, so a local backup/restore exercise was not run. No existing database was reset, dropped, or restored over; PostgreSQL tests used scoped synthetic fixtures in the preserved `hotelos_m4_test` database.

## Recommended Cloud SQL baseline

- Staging: automated daily backups, 7–14 day retention, PITR with at least 7 days of transaction logs, deletion protection, encryption, and an isolated restore target.
- Small production hotel: daily backups with 30–35 day retention, PITR at least 7 days (prefer 14–35 days if the business accepts the added log storage), and a retained final backup. Evaluate cross-region backup for regional failure.
- Growing hotel: use the recovery objective and data-change rate to select PITR retention and enhanced backup controls; alert on backup/PITR failures and verify recoverability monthly.
- Suggested initial objectives: staging RPO 24h/RTO 8h; production RPO 15m/RTO 4h after PITR is configured and measured. These are targets, not verified guarantees. Regional failover and stronger objectives require additional cost and a practiced runbook.

Cloud SQL supports automated and on-demand backups, retention controls, and PITR. PITR creates a new instance rather than overwriting the source. Backups/PITR have storage costs and must be monitored. Review the [Cloud SQL backup options](https://cloud.google.com/sql/docs/postgres/backup-recovery/backup-options), [backup overview](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups), and [PITR configuration](https://cloud.google.com/sql/docs/postgres/backup-recovery/configure-pitr) for the chosen edition and region.

## Restore exercise procedure

1. Select a recent staging backup and record its timestamp, migration state, and expected marker rows.
2. Restore to a **new isolated instance/database** with a unique name. Do not restore over `attendx`, `hotelos_dev`, `hotelos_m4_test`, or production.
3. Restrict access to the restore target; use synthetic records only.
4. Validate Prisma migration state, row counts, referential integrity, representative reservation/folio/invoice records, application startup, and tenant ownership checks.
5. Measure achieved RPO/RTO, capture evidence, and get an application owner to approve a cutover plan. Never swap production traffic during the exercise.
6. Retain or remove the isolated recovery target only through an explicit, reviewed retention action.

## Migration recovery

Use additive expand/contract migrations. Before an approved release, take or confirm a recoverable backup, run `prisma migrate status`, deploy migration in a controlled job, then smoke-test. Do not edit or rename an applied migration. For failed/partial deployment, stop application rollout, inspect `_prisma_migrations`, database logs, and backup status; use a forward corrective migration or restore to a new target. Never run `prisma migrate reset` on a shared or hosted database.

Actual Cloud SQL backup and restore remains unverified because no cloud instance exists and the local backup client tools are unavailable.
