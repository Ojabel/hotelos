# Account migration strategy

## Preservation rules

Do not reset the database, delete migrations, merge identities by email, or import PostgreSQL password hashes into Firebase. Existing users, guest profiles, memberships, hotel assignments, roles, invitations and business records remain in PostgreSQL. The additive migration adds invitation token/delivery metadata only.

## Current external identity behavior

HotelOS maps a verified Firebase UID under the Firebase issuer to the existing `UserIdentity` table. It does not attach a new Firebase UID to an older record merely because the email matches. Existing OIDC identities and development identities continue to use their existing issuers. A same-email account with no Firebase mapping requires a separate, verified ownership-recovery process; that process is not yet available.

## Pre-migration review report

Before enabling Firebase for existing users, run a read-only report on a protected database connection. Return counts only by default; do not export password hashes, raw guest records or tokens.

```sql
SELECT
  COUNT(*) AS identity_count,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS identities_with_email,
  COUNT(*) FILTER (WHERE email_verified) AS verified_identity_emails,
  COUNT(*) FILTER (WHERE issuer LIKE 'https://securetoken.google.com/%') AS firebase_mapped_identities
FROM "UserIdentity";

SELECT COUNT(*) AS duplicate_normalized_identity_emails
FROM (
  SELECT lower(trim(email))
  FROM "UserIdentity"
  WHERE email IS NOT NULL
  GROUP BY lower(trim(email))
  HAVING COUNT(*) > 1
) duplicate_emails;

SELECT status, COUNT(*) FROM "OrganizationMembership" GROUP BY status ORDER BY status;
SELECT status, COUNT(*) FROM "MembershipInvitation" GROUP BY status ORDER BY status;
SELECT COUNT(*) AS guest_profiles FROM "HotelGuest";
```

Classify existing identities without Firebase mappings for administrator review. Do not automatically merge duplicate email rows. Preserve reservations, folios, payments, refunds, audit events and hotel scope while resolving account ownership.

## Controlled rollout

1. Back up PostgreSQL using the normal environment procedure and verify a restore path.
2. Apply additive migrations with `npm run prisma:migrate:deploy`; never use `migrate reset`.
3. Provision Firebase accounts through verified user flows or a reviewed, auditable admin migration that does not copy password hashes.
4. Require users to prove control of their existing verified email and any additional recovery proof required by the hotel before linking.
5. Record each identity-link decision and conflicts for administrator review; do not grant organization membership during guest registration.

No account merge or bulk migration was performed for this milestone.
