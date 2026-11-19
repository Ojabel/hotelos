# Local frontend and PostgreSQL workflow

The application uses the backend by default. It does not silently switch to mock data after an API error. For an isolated mock UI demo, explicitly set `VITE_DATA_MODE=demo`; demo records and local guest selection are not backend identities.

## Start the local backend

1. In `backend/.env`, configure `NODE_ENV=development`, `AUTH_MODE=development`, a random server-only `DEV_AUTH_SECRET` of at least 32 characters, `TENANT_ORGANIZATION_ID`, and the local PostgreSQL `DATABASE_URL`. Keep the signing secret only in this backend file.
2. From `backend/`, run `npm run prisma:migrate:deploy`, `npm run seed:dev-tenant`, `npm run seed:access`, and `npm run seed:dev-hotel`. These commands apply migrations and provision the designated local tenant and `LOCAL` hotel without resetting the database.
3. Start the API with `npm run start:dev`.
4. Copy `hotelos/.env.example` to `hotelos/.env` and set `VITE_API_BASE_URL=http://localhost:3000` and `VITE_ENABLE_LOCAL_DEV_AUTH=true`.
5. From `hotelos/`, run `npm run dev`. On the local login screen, generate a 15-minute token in the backend terminal with `npm run auth:dev-token -- local-owner` and paste it into the local development token field. This token is available only when the Vite development server has local development authentication explicitly enabled. It stays in tab-scoped `sessionStorage`; sign out to remove it.
6. Use **Rooms → Add room → Create category** to create the first category, then create rooms. Guests and reservations can then be registered and managed from the existing screens.

## Firebase staff and guest sign-in

For Firebase-backed staff and guest authentication, configure the public client values in `hotelos/.env` and set the backend to `AUTH_MODE=firebase` with the matching `FIREBASE_PROJECT_ID` and server-side ADC credentials. Staff stays invitation-based. Guest registration offers Google or email/password; email/password users must verify their address before guest data is available. Password reset is handled by Firebase. See [Firebase Authentication setup](FIREBASE_AUTH_SETUP.md). Do not enable local development tokens in production.

The API uses `http://localhost:3000/api/v1`; `VITE_API_BASE_URL` accepts the server origin, with or without a trailing `/api/v1`. Guest portal account resolution requires Firebase verified email. Same-email existing profiles remain inaccessible until hotel staff verifies identity and links the profile; an email match alone never links or exposes reservations. A 401, 403, network failure, or empty response is shown as an error or empty state and never switches the UI to mock data.

## Connected workflow scope

Rooms/categories/status, guest contact records, availability, reservations, check-in/out, room transfers, housekeeping tasks and inspections, maintenance requests and work orders, guest portal profiles/reservations/cancellations/service requests, guest folios, charge ledgers, invoice snapshots, manual payments and allocations, receipts, refund approvals, and expenses use PostgreSQL-backed APIs. Guest ownership and staff membership permissions are enforced by the server. The general staff directory, payroll and guest identity documents are not connected to backend guest access. Finance amounts are displayed in NGN and stored as integer kobo with an explicit currency code. Payment and refund entry records settled manual activity; no gateway or external payout provider is connected.
