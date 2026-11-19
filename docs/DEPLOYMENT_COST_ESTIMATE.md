# Deployment cost estimate

**Estimate date: 2026-11-20.** USD/month, before taxes, support plans, discounts, currency conversion, and region-specific variance. These are planning ranges, not a quote. Cloud SQL dominates idle cost; confirm the exact region/edition/tier in Google's calculator before approval. Africa-region egress and storage prices can differ from the example rates.

## Assumptions and component ranges

**Mostly fixed baseline:** Cloud SQL compute/storage, any Cloud Run minimum instances, domain registration, and chosen backup retention. **Usage-sensitive:** Cloud Run request CPU/memory, network egress, logs/metrics volume, SMTP volume/plan, Firebase Auth plan/MAUs, Secret Manager versions/access, and any object storage. Secret Manager is usually negligible at this scale; email/domain costs depend on vendors not yet selected.

| Component | Staging / low usage | Small hotel production | Growing hotel |
|---|---:|---:|---:|
| Cloud SQL PostgreSQL | $50–75: 1 vCPU, ~3.75 GiB, 20 GiB SSD, zonal, backups | $105–170: HA pair, ~1 vCPU/3.75 GiB per node, 20–50 GiB SSD, backup/PITR | $240–450+: HA 2 vCPU/8 GiB per node, ~100 GiB SSD and retained backup/PITR |
| Cloud Run API | $0–15 scale-to-zero, low traffic | $10–40 | $50–200+ by CPU time, memory, min instances and requests |
| Frontend hosting | $0–10 low usage | $0–20 | $10–50+ by build/egress |
| Egress/network | $0–10 | $5–30 | $50–250+ |
| Logging/monitoring | $0–10 low volume | $5–25 | $25–100+ |
| Secret Manager | usually <$1 at a handful of versions/reads | <$2 | $1–10+ based on versions and reads |
| Email provider | $0–20 (provider-dependent; free quota may apply) | $10–30 | $20–100+ |
| Object/file storage | $0 now; no app file storage integration found | $0 until implemented; then usage-based | $5–50+ once documents/photos exist |
| Domain/SSL | $0–3 monthly equivalent (domain registration varies; managed TLS generally no separate line item) | $1–5 | $1–10 |
| **Planning total** | **$55–140** | **$150–350** | **$400–1,100+** |

The estimate assumes a paid Cloud SQL instance even when Cloud Run scales to zero. Small hotel production uses a regional HA database; the growing case adds capacity, backups, logs, and egress. If staging is kept online continuously, SQL still incurs fixed compute. A shared Cloud SQL instance can lower staging cost but violates the isolated per-organization deployment boundary; do not share staging production data.

## Price references and calculation notes

- Google publishes Cloud SQL Enterprise starting rates around $0.0413/vCPU-hour and $0.007/GiB-hour memory, with SSD storage from $0.17/GB-month on listed pricing. A 1-vCPU, 3.75-GiB node is about $49/month compute+memory at 730 hours before region/edition adjustments; 20 GiB SSD adds about $3.40. HA approximately doubles the node component; backup/PITR and actual region add cost. [Cloud SQL pricing](https://cloud.google.com/sql/pricing).
- Cloud Run request-based pricing has monthly free quotas and is usage-based; minimum instances and always allocated CPU increase cost. Model actual request durations and chosen region. [Cloud Run pricing](https://cloud.google.com/run/pricing).
- Secret Manager includes six active versions and 10,000 access operations per month at no cost in the published free allowance; beyond that it charges by active versions and access operations. [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing).
- Firebase Auth currently lists no-cost thresholds for ordinary email/social auth; Identity Platform upgrades introduce MAU pricing/quotas. Confirm the existing project plan and usage before staging. [Firebase pricing](https://firebase.google.com/pricing), [Firebase Auth pricing details](https://firebase.google.com/docs/auth).
- Standard Cloud Storage and egress have location, operation, and network charges; no in-app object storage integration was found. [Cloud Storage pricing](https://cloud.google.com/storage/pricing), [Network pricing](https://cloud.google.com/network-tiers/pricing).
- SMTP, domain, and support pricing cannot be finalized until provider/domain/plan are selected. Firebase verification/reset mail is Firebase-managed and subject to current product quota/configuration.

## Cost controls before provisioning

Set a project budget/alerts, Cloud Run max instances and request/CPU ceilings, Cloud SQL storage autosize bounds where supported, log exclusions/retention, backup retention, and egress dashboards. Budget alerts do not automatically stop charges. Obtain a calculator estimate for the chosen region and a signed budget before `terraform apply`.
