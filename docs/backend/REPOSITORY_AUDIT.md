# HotelOS repository audit

Audit date: 2026-11-10. The repository root contains one application directory, `hotelos/`; there is no Git metadata at the supplied workspace root and no repository-level agent instruction file was found.

## Current architecture

- `hotelos/` is a Vite single-page React 18 and TypeScript application. `src/main.tsx` mounts `App` in `BrowserRouter`; `src/App.tsx` composes React Router routes, `AppShell`, the route registry, and guest site/portal routes.
- `src/routes/nav.ts` is the navigation and frontend role-visibility source; `src/routes/pageRegistry.ts` maps implemented pages. The existing page families cover dashboard, front desk, reservations, rooms, guests, housekeeping, restaurant, billing, reports, settings, staff/admin, guest site, and guest portal.
- `src/store/` uses Zustand. `useHotelStore` initializes operational data from typed seed data and persists operational state in localStorage. `useAppStore` persists demo session and UI preferences across local/session storage. `useAdminStore` persists demo administration state. Guest portal and mock audit services also persist browser-local state.
- `src/services/` contains domain-oriented `mock*Service.ts` modules and `delay.ts`; components call these services rather than a remote backend consistently. The service layer is the primary incremental migration seam. `src/data/` provides interdependent typed mock records; `src/types/index.ts` is the frontend domain type source.
- Demo login in `mockAuthService.ts` validates hardcoded demonstration accounts/password locally. Role and property selectors and route/permission checks are UI behavior only; none provides server-side security.
- Frontend build uses TypeScript 5.6, Vite 8, ESLint 9 and Vitest 5 (Node 24.16/npm 11.13 were present at audit time). `npm test` runs `src/**/*.test.ts`; service and utility tests exist. There is no backend, shared workspace, root package, deployment config, Docker config, or frontend API client today. The app README documents local demo usage.
- Frontend environment configuration is currently limited to Vite mode; no `.env` file was found. Browser storage is used by app, operational, admin, audit, guest and booking demo flows. No production identity integration was found.

## Integration points and preservation requirements

Preserve the frontend directory, routing and layouts, design system, route visibility, service signatures, seed records, demo auth, and local storage behavior. The front-end service modules already group reservation, room, guest, billing/payment, housekeeping, inventory, restaurant, staff, maintenance and guest portal operations. Those modules can move to an API implementation behind the same function contracts in domain slices. Zustand remains a UI/demo cache; it must not become the authority for backend access.

## Risks and dependencies

- Operational records have string demo IDs and frontend-specific shapes; they need deliberate DTO/domain mappings rather than direct persistence of UI state.
- Some mock services mutate Zustand directly and append demo audit rows, so each service migration needs a clear cache invalidation/update policy.
- Role, property, and tenant identifiers supplied by the browser are untrusted. Server authorization must derive organization/property scopes from verified identity and persisted membership.
- Existing browser sessions, seeded state, financial mock values, and demo credentials are not production data or authentication.
- A PostgreSQL service is not available in the audited environment (`psql`, Docker and database environment variables are absent). Migration SQL generation is verifiable, but applying it to a live test database is not possible here.
- The workspace has no Git metadata at its root, so change-diff review and branch-based isolation are not available through Git commands.

## Architecture decision and directory layout

Use a lightweight repository-level multi-project layout without moving the frontend: `hotelos/` remains the frontend, `backend/` is an independently installed NestJS package, and `docs/backend/` stores architecture records. Do not introduce a root workspace yet: the frontend and server have unrelated build tools and dependency graphs, and no shared runtime contract has been established. Add a versioned, manually maintained API contract at `hotelos/src/services/api/contracts.ts` for now. If generated/shared contracts become useful, introduce a versioned `packages/contracts` package in a later milestone and keep it free of server-only and frontend runtime dependencies.

## Recommended implementation sequence

1. Preserve and characterize the frontend's current build, tests, route tree, stores and service boundaries.
2. Add the isolated NestJS package, validated runtime config, request IDs, logging, API error/response conventions, security headers, rate limiting, docs and liveness/readiness endpoints.
3. Establish PostgreSQL/Prisma organization, hotel, identity mapping, memberships, authorization vocabulary and audit foundation; apply migrations against a disposable PostgreSQL instance in CI/developer setup.
4. Decide central identity provider and token exchange/validation model before implementing authentication. Implement server-side membership/property authorization before business APIs.
5. Migrate one low-risk domain at a time behind existing frontend service contracts, keeping an explicit demo mode until a real backend is configured.

## Open decisions

- Central identity provider and whether frontend sessions use a BFF/secure cookie or short-lived API access tokens.
- How separate organization infrastructure is provisioned, bootstrapped, upgraded and linked to the central control plane.
- Whether audit retention/immutability, regional hosting, data retention, and financial ledger rules require dedicated database or compliance controls.
- Role and permission catalog ownership, hotel-role inheritance, owner transfer rules, invitation lifecycle and support access model.
- Production database HA/backup/restore, secrets manager, telemetry/export, and Terraform modules.
