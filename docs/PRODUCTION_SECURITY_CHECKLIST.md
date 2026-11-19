# Production security checklist

## Current source audit

### Critical

- None confirmed in the reviewed paths; this is not a penetration test or full compliance certification.

### High

- **Staff-assisted guest identity linking is an attestation, not a technically verified case workflow.** The endpoint accepts an enum and a free-text case reference plus a staff permission. The mapping is audited and unique constraints prevent duplicate links, and email matching alone is not sufficient. But the server does not verify that an in-person ID/reservation verification occurred or require independent approval. Restrict the permission to trained staff, require a real case reference under hotel SOP, review audit events, and close this gap with an independently approved verification case before broad rollout. Do not expose to untrusted support operators.
- **No real staging security integration has been executed.** Firebase Console/project app inspection returned HTTP 403; SMTP and Cloud Run runtime identities are not configured. Guest emulator results are not production-provider verification.

### Medium

- Invitation delivery is synchronous SMTP with no durable retry/outbox or provider bounce reconciliation. Local mail capture previously reported delivery; this milestone fixes its result to `NOT_SENT` and the staff UI now states that no email was sent.
- Nest throttling is in-process. Per-instance limits do not aggregate across Cloud Run instances; set Cloud Run max instances, monitor abuse, and add edge/distributed throttling before large public traffic.
- No automated dependency vulnerability audit or live webhook/payment-provider configuration was verified in this milestone. Existing finance records use idempotency/audit patterns, but do not treat payment recording as a live gateway integration. No raw-card storage was found in the inspected schema/API search; complete a full PCI/security review before a payment gateway launch.
- Guest identity links and profile update path require a reviewed multi-hotel test. Database guest ownership checks are scoped to server-loaded links; verify data privacy expectations when reservations span hotels.

### Low / operational

- Firebase app list is blocked by permission; confirm existing applications, provider settings, API key restrictions, authorized domains, sender templates, and project IAM with its owner.
- Current Docker/Terraform deployment artifacts are new and were not deployed; Terraform CLI is unavailable for validation.
- `hotelos_dev` uses local development auth for local operation; ensure staging/production use Firebase, no development secret, strict CORS, disabled API docs, and no emulator.

## Release checklist

- [ ] Firebase project ID and Web App are confirmed by project owner; only staging domain is authorized.
- [ ] Production auth uses Firebase standard mode, ADC/workload identity, revocation check, verified-email guest guard, database membership and role checks.
- [ ] Invitation-only staff registration; verified email, expiry, single use, token hash, role delegation, suspended/revoked membership denial.
- [ ] Guest profile/reservation/service ownership and cross-tenant/hotel denial tested against PostgreSQL.
- [ ] Staff linking permission and two-person/case verification process approved; duplicate identities remain blocked.
- [ ] CORS exact origin allowlist, Helmet, rate limits, body/schema validation, correlation ID, authorization/URL/token/password/card-field log redaction, safe errors.
- [ ] Cloud Run runtime service account least privilege; no service-account key; Secret Manager access scoped per secret; SQL connector/TLS; no public DB access rules.
- [ ] Cloud Run max instances and PostgreSQL pool sizing are jointly bounded; database backup/PITR alerts tested.
- [ ] SMTP sender verified; Firebase templates delivered; email failure alerts and resend process tested.
- [ ] Payment provider/webhook is not enabled until signatures, idempotency, duplicate prevention, refund/invoice/receipt integrity and reconciliation are tested. Never store PAN/CVV.
- [ ] Dependency audit, SAST/DAST, external penetration test, incident contact/runbook, privacy notice, retention and breach procedure approved.

Readiness is **not production-ready** until the high and medium findings have owners and staging tests have real provider evidence.
