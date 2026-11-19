# Tenant and hotel isolation

The deployment's `TENANT_ORGANIZATION_ID` is the only organization context. Controllers do not accept a tenant selector. Membership, roles and invitations are looked up with this organization ID, and invitation-role and membership-role relations carry organization scope. Unknown membership/role references produce safe not-found responses.

Authorization context is loaded from PostgreSQL for every protected permission route. Suspended/revoked memberships are denied; only active hotel memberships for active hotels contribute hotel-scoped grants. Role permissions are loaded from database relations. No authorization cache is present.

The existing unit tests cover hotel scope substitution, mismatched hotel-scoped role grants and inactive membership denial. `npm run test:security` additionally uses real PostgreSQL fixtures and actual guarded HTTP requests to test hostile tenant headers/query parameters, rejected tenant body values, cross-organization membership/role/invitation IDs, foreign organization membership rejection, and suspended/revoked membership rejection. It confirms hotel and role lists do not contain foreign tenant rows. Hotel-specific detail endpoints do not exist yet, so path-based hotel access is not applicable; no RLS was introduced.
