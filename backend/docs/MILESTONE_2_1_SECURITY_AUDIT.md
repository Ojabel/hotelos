# Milestone 2.1 security audit

Scope reviewed: `src/auth`, `src/authorization`, health and application bootstrap, Prisma schema/migrations/seeds, development token CLI, environment validation, exception/logging middleware, Swagger setup, frontend API use, and backend tests.

| Severity | Component | Finding and impact | Disposition |
| --- | --- | --- | --- |
| HIGH | Membership/role administration | No mutation API existed; invitations, status changes, role delegation and owner retention were unavailable. | Partially addressed with invitation, suspend/revoke and role assign/remove routes. Reactivation and owner transfer remain deliberately unavailable. |
| HIGH | `prisma/seed.ts` | The access seed iterated over every organization and could rewrite system role permissions without an environment boundary. Running it in production could unexpectedly mutate grants. | Fixed: only nonproduction development/test and the explicitly configured `TENANT_ORGANIZATION_ID` are accepted. |
| MEDIUM | `src/config/configuration.ts` | Production rejected development auth mode but accepted a stray `DEV_AUTH_SECRET` when OIDC was enabled. | Fixed: production config rejects any development signing secret. |
| MEDIUM | Membership lifecycle | Existing authorization context is loaded from PostgreSQL on each protected request; no cache or stale permission window was found. | Preserved. Suspension, revocation, and role changes affect the next protected request. |
| MEDIUM | Audit coverage | Initial denial events existed, but lifecycle events did not because lifecycle routes did not exist. | Partially addressed. Successful invitation/status/role assignment mutations, delegation denials, and last-owner denials use the existing `AuditEvent` table transactionally. Authentication failures and role create/update/archive remain unavailable. |
| LOW | Development tenant seed | The script protects the designated slug and does not promote/reactivate an existing membership. | Existing safeguards retained. It still requires operational control of its environment and database credentials. |
| INFORMATIONAL | Identity provider | OIDC verifier is provider-independent and verifies RS256/issuer/audience/exp/nbf using configured HTTPS JWKS with key rotation support. No provider or live interoperability test exists. | Deliberately unresolved; provider selection is out of scope. |
| INFORMATIONAL | Platform administration | No hotel-level platform administrator role or control-plane access was found. | No change. |

## Confirmed controls

- Organization scope is resolved from `TENANT_ORGANIZATION_ID`; request organization values are not used by existing authorization queries.
- Organization and hotel membership, role assignments, and grants are database-backed. Membership must be `ACTIVE`; hotel membership and hotel must also be active.
- OIDC identity tokens are not trusted for role/permission claims. Only verified email is retained for invitation binding.
- The global guard and `@Public()` metadata protect endpoints; health routes alone are intentionally public.
- Error responses do not include exception stacks; Pino redacts credentials and request URL/body token-like fields.
- Existing startup wildcard warning fix in `app.module.ts` uses `'{*path}'` and is unrelated to these lifecycle changes.

## Remaining material gaps

- No managed identity provider, invitation delivery, ownership transfer, membership reactivation, custom role CRUD/archive, or provider session revocation is implemented.
- Owner-preservation serialization covers the new status mutation service. Direct database writes and out-of-band admin tooling can bypass application safeguards and must be restricted operationally.
- PostgreSQL-backed HTTP tests now cover cross-tenant identifiers and simultaneous Owner suspension/revocation. They do not cover out-of-band SQL, Owner demotion (no endpoint exists), or hotel detail routes (not implemented).
- Do not treat this milestone as production-ready until the remaining workflows and integration/concurrency tests are completed and reviewed.
