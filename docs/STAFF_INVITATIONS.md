# Staff invitations

## Administrator workflow

Open **Staff → Staff Invitations**. Select an email and a delegable organization role, review the invitation, then send it. Owner and hotel-scoped roles are not offered. The backend independently enforces `staff.manage`/`access.manage`, role delegation limits and seven-day expiry. After a staff member accepts, an authorized manager can grant housekeeping or maintenance roles at a specific hotel using the existing operations staff screens.

Invitation states are `PENDING`, `ACCEPTED`, `EXPIRED`, or `CANCELLED` (shown as revoked in user-facing copy). Email delivery is tracked separately. A failed delivery is not shown as sent; resend rotates the single-use secret while preserving the original expiry. Resend and revoke are available only to authorized organization administrators.

## Recipient workflow

The invitation link opens `/accept-invitation`. The page validates the token with the backend, then permits email/password sign-in or account creation only for the email in the invitation. New accounts must verify email before acceptance. The backend again checks provider, verified email, token hash, expiry, status, organization, membership and invited roles in a transaction. A Google provider token cannot accept a staff invitation in Firebase mode.

Passwords are never sent in invitation messages. Firebase handles password creation, verification and reset. The backend does not trust the selected role or any organization/hotel ID from the browser.

## Delivery configuration

For local capture set `EMAIL_DELIVERY_MODE=local`, `APP_BASE_URL=http://localhost:5173`. Authorized administrators can inspect the local outbox from the invitation screen. The outbox is process-memory only and is cleared when the API restarts.

For SMTP set `EMAIL_DELIVERY_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, and `APP_BASE_URL`. Credentials belong only in a server-side secret manager/environment. With `disabled`, invitations are created but their delivery status is failed/unavailable; the API does not claim a message was sent. Production forbids local capture.

## Current limitations

Invitation role assignment currently supports delegable organization roles. Hotel-specific roles remain a follow-up hotel assignment after the organization membership becomes active. Invitation UI and token workflow have type/build coverage; live SMTP and Firebase Emulator browser acceptance still require configuration and verification.
