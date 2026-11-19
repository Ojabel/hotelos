# Milestone 2 implementation status

Status as of 2026-11-15. This is not a production security readiness statement.

| Area | Status | Notes |
| --- | --- | --- |
| Repository audit | COMPLETE | See `MILESTONE_2_AUDIT.md`. |
| Provider evaluation | COMPLETE | Recommendation is WorkOS AuthKit for proof-of-concept evaluation; provider selection remains BLOCKED pending owner decision and procurement review. |
| OIDC verification abstraction | PARTIALLY COMPLETE | RS256, trusted configured HTTPS JWKS, issuer/audience, expiry, nbf, exp requirement, subject and normalized verified claims. Live provider integration/interoperability is BLOCKED on provider selection. |
| Development test auth | PARTIALLY COMPLETE | Explicit opt-in HS256 mode, production guard, local tenant/owner seed and local CLI token helper; HTTP integration coverage remains. |
| Global auth/public routes | PARTIALLY COMPLETE | Guard and `@Public()` are present; health routes are public. Need complete HTTP guard regression suite. |
| Identity mapping | PARTIALLY COMPLETE | Exact issuer+subject mapping and verified email storage; provider invitation/activation lifecycle not integrated. |
| Organization membership and tenant context | PARTIALLY COMPLETE | Trusted configured organization, active membership check, lifecycle columns and REVOKED enum. No invitation/activation/suspension management endpoints. |
| Hotel scope | PARTIALLY COMPLETE | Active authorized hotel list and reusable `assertHotelAccess`; no operational hotel-resource controllers exist yet for integration. |
| Roles and permissions | PARTIALLY COMPLETE | Reusable guard/decorator, catalogue seed and least-privilege templates. No role/membership mutation API or final-owner/delegation workflows. |
| Audit integration | PARTIALLY COMPLETE | Membership and permission denials create AuditEvent rows. Auth-success, failed-token, membership/role lifecycle events and resilient audit policy remain. |
| Security tests | PARTIALLY COMPLETE | Unit tests cover token signature/expiry/issuer/audience/algorithm, production config, membership lifecycle, role guards and hotel scope; full adversarial matrix and live OIDC tests remain. |
| Frontend compatibility | COMPLETE | No frontend auth changes; existing mock auth remains; existing optional API bearer callback remains available. Frontend checks are reported in the implementation run. |
| Database migration | COMPLETE | Additive migration applied to the local `hotelos_dev` database and verified up to date. Other deployments must apply it before running the new code. |
| Production readiness | NOT STARTED | Provider, production configuration, mutation controls, full security tests, operational monitoring and deployment review are outstanding. |

## Expected environment

See `.env.example`. `AUTH_MODE=disabled` closes protected routes locally by default. `AUTH_MODE=development` requires a strong server-only secret and a real local organization UUID. Production must use OIDC mode with issuer, audience, JWKS URL and tenant organization ID. Never commit `.env` or secrets.

## Migration and local setup

The additive migration is already applied to the local `hotelos_dev` database. For another deployment, check `npx prisma migrate status`, review the SQL, run `npm run prisma:migrate:deploy`, then `npm run prisma:generate`, and run `npm run seed:access` after the organization's row exists. These commands are not run automatically by build. Do not reset the database.

## Remaining identity-provider decisions

Select provider, environment/tenant model, API audience, issuer/JWKS values, access-token lifetime, SSO/SCIM requirements, contractual region and pricing. Only then should frontend provider integration and provider membership lifecycle be implemented. Do not start Milestone 3 until these gaps have been reviewed.
