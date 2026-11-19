# Backend architecture

## Direction

HotelOS uses an independently deployable NestJS + TypeScript backend with PostgreSQL and Prisma in a modular monolith. The existing React/Vite prototype remains in `hotelos/`; no frontend files were moved. Each customer organization is intended to run in a dedicated GCP environment. A hotel group is represented by one organization and multiple hotels. A separate platform control plane and centrally managed identity system coordinate provisioning and identity; neither is implemented in this milestone.

## Backend boundaries

`backend/src/` separates cross-cutting HTTP infrastructure (`common/`), validated configuration (`config/`), Prisma lifecycle (`database/`), health endpoints (`health/`) and domain modules (`modules/`). Domain modules must own use cases and repositories/services; controllers should validate/translate HTTP input and should never accept client authority for tenant scope. The first audit module directory establishes a location but does not yet expose audit mutation APIs.

The initial API uses `/api/v1`. DTO validation, a shared exception envelope, response envelope, correlation ID, structured Pino logging, Helmet headers, configured CORS, request timeout and a global throttler are installed centrally. OpenAPI is available at `/api/docs` in non-production configuration. Readiness returns only an availability result; it does not reveal database details.

## Tenant boundaries

The organization is the tenant and owns hotels, memberships and roles. A user identity is an internal UUID mapped by the unique external `(issuer, subject)` pair. A user may have memberships in many organizations. Organization membership can carry owner status and organization roles; hotel membership grants narrower hotel scope. Composite foreign keys tie hotel records and membership assignments to the same organization. Organization and hotel IDs in incoming requests remain untrusted selectors until authorization verifies active membership.

Dedicated organization infrastructure is the primary isolation boundary. Tenant-scoped database rows and composite constraints are defense in depth inside an organization deployment. Platform operations must not get an implicit end-user role or unrestricted access to customer databases.

## Runtime and operations

Configuration is validated before Nest starts and secrets are supplied through environment/secret injection, never source control. Prisma 7 generates a client under `backend/src/generated/prisma` and uses the PostgreSQL driver adapter. Migrations are checked into `backend/prisma/migrations`; production rollout uses `prisma migrate deploy`. Health endpoints are `/api/v1/health` and `/api/v1/health/database`.

## Identity decision deferred

The provider is intentionally not selected yet. Evaluate Auth0 Organizations first and Okta as an alternative against GCP integration, customer federation, lifecycle APIs, region/data handling and the control-plane provisioning lifecycle. The eventual API must validate issuer, signature against rotated JWKS, audience, expiry, not-before, and allowed algorithms; map `(iss, sub)` to `UserIdentity`; then load active organization and hotel memberships and permissions server-side. Prefer a same-site BFF/HttpOnly Secure SameSite cookie for browser sessions when deployment topology allows; otherwise exchange central identity for very short-lived, audience-restricted API tokens, with refresh handled outside localStorage. These remain recommendations, not implemented auth.

## Current limitations

No business API, authentication guard, authorization guard, audit writer, control plane, provisioning integration, Terraform, deployment configuration or production readiness claim is included. The development rate limiter uses Nest's in-memory storage and must be replaced with a shared store for horizontally scaled deployments. Database application could not be verified in the local environment because no PostgreSQL service is available.
