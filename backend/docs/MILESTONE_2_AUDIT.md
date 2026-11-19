# Milestone 2 repository and security audit

Audit date: 2026-11-15. This audit records the workspace as it existed before the Milestone 2 changes in this branch.

## Existing implementation

- NestJS 11.2.9, TypeScript 5.6, Prisma 7.10.1, PostgreSQL adapter, Express 5.2.1, `nestjs-pino` 4.4.1, Swagger 11.4.8, Helmet, CORS and throttling.
- `backend/src/main.ts` configures `/api/v1`, Swagger at `/api/docs`, Helmet, allowlisted CORS, global validation, timeout and response interceptors.
- `backend/src/app.module.ts` registers Pino, rate limiting, a global exception filter, response/timeout interceptors, the database and health modules.
- The Prisma schema already contains Organization, Hotel, UserIdentity, OrganizationMembership, HotelMembership, Role, Permission, assignment joins and AuditEvent. Composite organization keys on hotel and membership joins constrain cross-organization relations.
- The initial migration is `prisma/migrations/20261110000000_initial_foundation/migration.sql`.
- The frontend API client has an optional asynchronous bearer-token callback. Frontend sign-in remains local mock authentication in `hotelos/src/services/mockAuthService.ts`; no provider SDK or live backend session is used.
- The mock account/password values and browser-side state are demo conveniences, not security controls. Any future API data must be protected by backend bearer verification, membership and permission checks regardless of frontend navigation or localStorage.
- Dependency audit on 2026-11-15 (`npm audit`): 28 development-tree advisory records (5 low, 23 moderate; no high/critical), primarily Jest, Nest CLI and TypeScript ESLint tooling; `npm audit --omit=dev` reported zero production dependency advisories. Fixes offered by npm include major toolchain upgrades and were not applied as part of this milestone.

## Security controls already present

Validation rejects unexpected DTO fields; exceptions use a stable envelope; Pino redacts authorization, cookies, URLs, query and selected sensitive body keys; CORS is configured from environment; the app uses Helmet, throttling, request timeouts and correlation IDs. Password reset and demo login are explicitly mock-only frontend behavior.

## Gaps identified

- No bearer authentication, signature verification, public-route metadata, current identity context, or global authentication guard.
- Existing identity mapping had no verified-email flag. Membership states lacked an explicit `REVOKED` value and lifecycle timestamps.
- No server-side tenant organization context or membership/role/permission enforcement.
- Role and permission tables existed but had no catalogue seed or least-privilege role templates.
- AuditEvent existed but no authz denial integration.
- No auth/authz tests or provider evaluation documentation existed.

## Risks and compatibility notes

- A tenant API must bind to a server-configured organization UUID. A browser-selected organization header/body cannot establish tenant context.
- Identity keys are `(issuer, subject)`; email is mutable and never used to link identities or memberships.
- Existing `REMOVED` membership rows are retained; new `REVOKED` state is additive. Both are denied.
- Current NestJS/global-prefix, Swagger, response-envelope, health and Pino middleware behavior is preserved. `nestjs-pino`’s package default wildcard was overridden earlier with a named wildcard for Express 5 compatibility.
- The managed provider remains unselected. OIDC mode fails configuration validation unless issuer, audience, JWKS URI and tenant organization ID are supplied.

## Recommended implementation sequence

1. Keep API enforcement provider-independent and validate OIDC JWT signatures, issuer, audience, expiry and signing algorithm.
2. Bind each deployment to one configured organization and resolve active memberships and grants from PostgreSQL.
3. Seed the small RBAC catalogue; authorize using server-side rows only.
4. Select and configure a managed provider, then integrate hosted sign-in/invitation lifecycle.
5. Add managed membership/role mutation APIs with owner safeguards and audit events before enabling administration from UI.
6. Migrate the frontend only after provider and session-flow decisions are approved.

## Current milestone status

The provider-independent read/authentication foundation and lifecycle schema change are implemented. Provider login, invitations, membership/role mutation, complete owner safeguards and broad adversarial integration coverage remain incomplete; see `IMPLEMENTATION_STATUS.md`.
