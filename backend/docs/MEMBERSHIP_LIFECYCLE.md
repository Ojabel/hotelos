# Membership lifecycle

## States and supported transitions

Invitation records transition `PENDING -> ACCEPTED | CANCELLED | EXPIRED`. They expire after seven days. Expired invitations are marked when acceptance is attempted. A verified access-token email must match the normalized intended email; email alone never creates a `UserIdentity`.

Accepted invitations atomically create an `ACTIVE` organization membership, assign the pre-approved organization roles, mark the invitation accepted, and write an audit event. The invitation UUID is not a bearer secret; knowing it does not bypass the verified email check. No email delivery is implemented or claimed.

Active memberships may be suspended or revoked by an authorized user. Subsequent protected requests load the current membership from PostgreSQL and deny access. Self-status changes are rejected. Revoked or suspended memberships require administrator review; normal invitation acceptance does not silently reactivate them. Reactivation is not exposed. Recovery policy: verify the person out-of-band, involve an existing active Owner, and use a reviewed administrative recovery procedure; if no Owner remains, use the documented database operator recovery with change control and audit evidence.

## Endpoints

- `POST /api/v1/memberships/invitations` — `staff.manage` or `access.manage`; accepts email and organization role IDs.
- `GET /api/v1/memberships/invitations`, `GET /api/v1/memberships` — same permissions; results are bounded and tenant scoped.
- `POST /api/v1/memberships/invitations/:id/accept` — authenticated identity with a currently verified matching email.
- `POST /api/v1/memberships/invitations/:id/cancel` — membership administration permission.
- `POST /api/v1/memberships/:id/suspend|revoke` — membership administration permission.
- `POST /api/v1/memberships/:id/roles`, `DELETE /api/v1/memberships/:id/roles/:roleId` — delegated role assignment rules apply.

All tenant IDs come from deployment configuration. No acceptance token or secret is returned.
