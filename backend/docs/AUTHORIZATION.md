# Authorization

Every tenant API instance receives one trusted `TENANT_ORGANIZATION_ID` from server environment/deployment configuration. Request headers and bodies cannot switch it. The API resolves the active organization, issuer/subject identity mapping and active `OrganizationMembership` from PostgreSQL for each route carrying `@RequirePermissions(...)`.

Memberships in `INVITED`, `SUSPENDED`, `REMOVED`, or `REVOKED` state are denied. The code never accepts role or permission claims from JWTs. Organization role assignments and active hotel memberships contribute permission grants. A role attached to an organization membership gives organization-wide scope; hotel assignments yield only hotels for which the role grants `hotel.read`. `@CurrentAuthorization()` supplies the trusted result. `assertHotelAccess()` is provided for future hotel-ID routes; controllers must call it before looking up a hotel-scoped resource.

The global `AuthorizationGuard` enforces `@RequirePermissions(...)` and `@RequireRoles(...)` metadata from the context it loads from PostgreSQL. Missing context, permission or role fails closed. `@CurrentAuthorization()` provides the resolved context; `assertHotelAccess()` checks hotel scope. Current endpoints are:

- `GET /api/v1/auth/me`: any authenticated identity, no organization membership disclosure.
- `GET /api/v1/organizations/current`: requires `organization.read`.
- `GET /api/v1/memberships/me`: requires `organization.read`.
- `GET /api/v1/hotels`: requires `hotel.read`, returns only authorized hotels.
- `GET /api/v1/roles`: requires `access.read`.
- `GET /api/v1/permissions/me`: requires `organization.read`.

Membership/role mutation endpoints are intentionally not implemented. This prevents self-activation, self-role assignment and client-side status mutation in this milestone. Before adding them, require server-side delegation checks, prevent Owner escalation by non-owners, protect the final active Owner, and audit every change. `isOwner` remains existing persisted state; owner-level grants are not inferred from token claims.

No platform-admin bypass exists. Platform administrator identity, console access, impersonation and provisioning are separate future scopes.
