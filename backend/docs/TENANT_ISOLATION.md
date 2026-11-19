# Tenant isolation

Each deployed customer environment has its own database and backend. Deployment configuration binds that instance to exactly one organization with `TENANT_ORGANIZATION_ID`; production OIDC mode requires the UUID. The backend checks that organization is ACTIVE and then resolves the local identity and active membership. An arbitrary organization ID in a request never changes this context.

Central identity can be shared across deployments: a provider subject is mapped by exact `(issuer, subject)` to a local `UserIdentity` in each dedicated database. Membership/role data is local. Email equality does not link accounts. An identity without an active local membership can authenticate `/auth/me` but receives no organization context. Local development uses an explicitly configured UUID; `seed:dev-tenant` refuses to bootstrap an existing organization unless it is the designated active `hotelos-local-development` organization.

Hotel scope is derived from active `HotelMembership` records and local role grants. An organization-level role with `hotel.read` is organization-wide; otherwise only hotels with an active hotel membership and a hotel-scoped `hotel.read` grant are returned. Hotel ID resource routes must invoke `AuthorizationContextService.assertHotelAccess()` before data access. New Prisma queries must include configured organization and authorized hotel scope in the database predicate; checking after fetching another tenant's row is insufficient.

No `X-Organization-ID` header is read. A central identity service may later list a user's memberships for user experience, but selecting a deployment URL must never bypass that deployment's own local membership check.
