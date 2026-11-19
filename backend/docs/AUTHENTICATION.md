# Authentication

The API has a provider-independent `IdentityVerifier` contract and an OIDC JWT adapter implemented with `jose`. OIDC mode retrieves public keys only from the configured HTTPS JWKS URL; the URL cannot be supplied by a request. It allows RS256, validates exact issuer, audience, signature, expiration and not-before, requires a non-empty subject and expiration claim, and normalizes only verified email plus optional `amr`. Tokens and claims are not logged.

`AuthenticationGuard` runs globally for controller routes. Missing or invalid bearer tokens return 401 with the common safe error envelope. `@Public()` is required to make a route public; health routes explicitly use it. `@CurrentUser()` supplies the normalized verified identity. `/api/v1/auth/me` returns safe identity fields.

## Modes and configuration

- `AUTH_MODE=disabled` (local default): no protected request can authenticate. Public health and optional development Swagger remain available.
- `AUTH_MODE=development`: local testing only. Requires `NODE_ENV` other than production, a server-only `DEV_AUTH_SECRET` of at least 32 characters, and `TENANT_ORGANIZATION_ID`. `npm run seed:dev-tenant` creates or validates only the designated `hotelos-local-development` organization and its initial development owner; `npm run seed:access` then adds the role catalogue. It accepts only HS256 tokens signed by that secret with issuer `hotelos-development`, audience `hotelos-api-development`, expiry and maximum age 15 minutes. There is no token minting HTTP endpoint or password login.
- `AUTH_MODE=oidc`: requires `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI` (HTTPS) and `TENANT_ORGANIZATION_ID`. Production configuration rejects other modes and fails validation if these values are absent.

Never expose `DEV_AUTH_SECRET` to the browser or enable development auth in production. For manual local development, set `AUTH_MODE=development`, a random `DEV_AUTH_SECRET`, a designated UUID in `TENANT_ORGANIZATION_ID`, and optionally `DEV_AUTH_SUBJECT` (default `local-owner`). Run `npm run seed:dev-tenant`, `npm run seed:access`, then `npm run auth:dev-token -- <DEV_AUTH_SUBJECT>`. The token script is server-side, refuses production or other modes, and prints a 15-minute HS256 bearer token. Do not commit the generated token or secret. There is no public dev token endpoint.

Production config examples are in `.env.example`. The identity provider is not yet selected or connected, so production authentication cannot be enabled until the provider's actual issuer, API audience and JWKS URL are verified.

The existing frontend mock login remains untouched. `ApiClient` already supports an optional `getAccessToken()` callback for later integration; no provider SDK was added.
