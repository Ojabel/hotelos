# Development authentication security

Development HS256 auth is opt-in through `AUTH_MODE=development`, a 32-character-or-longer `DEV_AUTH_SECRET`, and a configured tenant UUID. Configuration rejects development mode in production; it now also rejects a development secret in any production configuration. Production requires OIDC issuer, audience and HTTPS JWKS configuration.

The development token CLI checks `NODE_ENV=development` and `AUTH_MODE=development` before signing and issues a 15-minute token. It is a local command, not an HTTP route. The development tenant bootstrap requires both values and an explicit `TENANT_ORGANIZATION_ID`, validates the designated slug, and refuses to promote an existing membership. The access catalogue seed requires `NODE_ENV=development` or `test` and exactly one configured tenant, rather than iterating over all organizations.

Never commit `.env` or put secrets in frontend variables. Keep token output out of logs and terminals shared with others. Tests cover production rejection of development mode and signing secrets. Operational scripts still rely on correct environment and database credentials, which must be controlled by deployment tooling.
