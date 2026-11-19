# Authentication and authorization architecture

## Request flow

1. The browser signs in with Firebase Authentication and obtains an ID token through the Firebase SDK. The API client calls `getIdToken()` so Firebase refreshes tokens when needed. Explicit local development tokens remain supported only when opted in.
2. NestJS selects one configured verifier: Firebase Admin, the legacy OIDC/JWKS verifier, explicitly enabled development verifier, or disabled verifier.
3. Firebase Admin verifies signature, project audience, issuer, expiry and revocation. Verified UID becomes the subject under `https://securetoken.google.com/<project-id>`; email/provider are carried only from verified claims.
4. PostgreSQL `UserIdentity(issuer, subject)` maps the external identity to a HotelOS identity. A matching email does not link a pre-existing identity.
5. Global authorization guards load active organization membership, hotel assignments, roles and permissions from PostgreSQL. Suspended/revoked memberships and out-of-scope hotels remain rejected by existing server authorization.

Firebase is an identity provider, not the HotelOS authorization database. Firebase custom claims are not used for HotelOS roles or permissions. Platform administration is not granted by Firebase provider, email verification or hotel ownership.

## Staff and invitations

Staff invitation tokens are 32 random bytes, stored as SHA-256 hashes, expire in seven days, are rotated on resend and cleared after accept/revoke/expiry. Acceptance is locked and transactional, binds normalized verified email, enforces email/password provider for Firebase mode, activates membership, assigns only invitation roles and writes audit records. Role delegation retains the existing server-side permission subset checks and prevents Owner delegation.

Invitation email delivery uses a provider boundary. `local` mode captures complete messages in a permission-protected local outbox; `smtp` mode reports delivery success/failure; `disabled` never claims email was delivered. Invitation tokens are not written to audit metadata or ordinary logs.

Hotel-specific housekeeping and maintenance roles continue to be granted after organization invitation acceptance through the existing hotel-scoped role assignment APIs.

## Development and production

Local development authentication remains available with `AUTH_MODE=development`, a 32-character server-only secret and a configured tenant. Production rejects this mode and development secrets. Firebase emulator mode is non-production only. Production Firebase deployments use ADC/workload identity and must configure `FIREBASE_PROJECT_ID`, tenant ID, `APP_BASE_URL`, Firebase project credentials, CORS and an email provider.

## Identity linking and known limits

Identity mapping is by `(issuer, subject)`. Firebase sign-in never automatically attaches a same-email PostgreSQL guest profile. Verified Firebase identities map through `GuestIdentityLink` to hotel-scoped `HotelGuest` records. New profiles and links are created transactionally only if no same-email guest exists; existing-profile linking requires `guests.manage`, staff identity verification, verified-email equality and an audit event. Guest requests resolve ownership from those links and filter reservation/service queries in PostgreSQL. Guest identities with organization memberships cannot use the guest API. See [Guest identity linking](GUEST_IDENTITY_LINKING.md).

Guest API operations are `/api/v1/guest/account/resolve`, `/me`, `/reservations`, `/reservations/:id`, `/reservations/:id/cancel`, and `/service-requests`. The portal requires a verified Firebase Google or password identity. Email reset is handled by Firebase. Guest access does not receive staff organization permissions; staff/finance/organization routes continue through the existing membership and permission guards. Platform-admin control-plane accounts remain outside this milestone.
