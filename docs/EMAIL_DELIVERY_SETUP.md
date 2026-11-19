# Email delivery setup

## Current implementation

Staff invitations use `EmailDeliveryService` with `EMAIL_DELIVERY_MODE=local|smtp|disabled`. Local capture is an in-memory development outbox and is not delivery. This milestone corrects local capture to report `NOT_SENT`; only a successful SMTP provider acceptance reports `DELIVERED`. SMTP errors are reported without logging message content or tokens. The outbox is volatile and not suitable for staging or production.

Guest verification and password reset are sent by Firebase Authentication, not HotelOS SMTP. Configure their Firebase templates and sender independently. There is no durable email queue, retry worker, provider webhook, or delivery-event store. Nodemailer SMTP's accepted response is transport acceptance, not final inbox delivery; monitor provider bounces separately before describing a message as received.

## SMTP environment

Use distinct staging/production provider accounts and verified sender identities. Store credentials in Secret Manager; never place them in frontend variables or source control.

```dotenv
EMAIL_DELIVERY_MODE=smtp
EMAIL_FROM=HotelOS <verified-sender@example.com>
SMTP_HOST=<provider SMTP hostname>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<SMTP username>
SMTP_PASSWORD=<Secret Manager injected value>
APP_BASE_URL=https://<environment frontend domain>
```

Port 587 usually uses STARTTLS (`SMTP_SECURE=false`); use the provider's documented TLS mode/port. Configure SPF, DKIM, and DMARC for the sender domain. Use separate credentials per environment, least privilege, rotation, provider rate limits, and bounce/complaint alerts. Check daily limits and accepted sender rules before sending invitations.

## Firebase-managed guest mail

Firebase sends guest verification and password-reset messages. Configure templates, action domains, sender display, language, link behavior, and authorized domains in the existing Firebase project. Test delivery to controlled staging mailboxes, including spam folder and link completion. Do not claim guest email is live from the local emulator.

## Failure and retry

The current invitation send is synchronous and records `NOT_SENT`/`FAILED` if unavailable; use the authorized Resend operation after fixing the provider. It prevents claiming a local capture succeeded, but it is not a durable retry queue and can leave the invitation record pending without delivery. Before a high-volume production launch, add a reviewed outbox/queue with idempotent attempts and provider event reconciliation; keep invitation tokens hashed in the database and redact raw token URLs in logs.

Keep local capture enabled only in local development and Playwright setup. The app rejects local mail mode in production. Live SMTP credentials and a verified sender domain have not been provided or tested, so live delivery remains unverified.
