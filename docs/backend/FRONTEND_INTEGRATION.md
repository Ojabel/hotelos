# Frontend integration plan

The current React application stays in `hotelos/`. Its domain service modules and stable UI function signatures are the migration seam; seed data, local persistence and demo login remain available while no API is configured.

## Preparation included

`hotelos/src/services/api/client.ts` provides an opt-in typed fetch client with an environment base URL (`VITE_API_BASE_URL`), timeout/abort, correlation ID, JSON parsing, normalized API errors and a credentials/auth extension point. `contracts.ts` defines the common success/error and pagination envelopes. No page or existing mock service is connected to it yet. Vite variables are public; never put secrets or privileged keys there.

## Incremental migration order

1. Organization/property discovery and authenticated session once identity is decided; keep demo mode explicit.
2. Rooms/availability read APIs, then room mutations.
3. Guests and reservations with server-side transactional availability rules; remove no demo behavior until backend mode is deliberately enabled.
4. Front desk, housekeeping and maintenance workflows.
5. Folios, invoices, expenses, payments/refunds only after financial ledger, authorization, idempotency and provider requirements are specified.
6. Inventory, restaurant, workforce/payroll, reports, settings, audit and guest portal as their domain contracts stabilize.

For each slice, implement a remote adapter with the existing `mock*Service` signatures, map API DTOs to existing frontend types, and update Zustand only after successful server responses. Keep mock adapter injection as the local demo fallback; do not merge browser-local data into production records automatically. Add contract tests for each adapter and preserve current routes/layouts.
