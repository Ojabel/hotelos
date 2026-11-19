# Security testing

Run from `backend/`:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npm test -- --runInBand
```

Automated coverage includes RS256/JWKS signature verification, wrong signature, expiry, wrong issuer/audience, disallowed algorithm, production auth-mode configuration, active/revoked/suspended/invited membership behavior, hotel-scope denial, public health behavior, validation, Swagger, and common errors. External identity provider calls are not needed by the tests.

The current suite is a foundation, not complete assurance. Still required before production: live OIDC interoperability against the selected provider; HTTP guard tests for missing/malformed bearer tokens and every public route; cross-organization and request-ID tampering integration tests; role delegation/final-owner mutation tests (after mutation APIs exist); audit-write failure behavior; log redaction regression; rate-limit checks on provider-facing flows; frontend build, tests and mock login regression. Do not run integration tests against production data.

No refresh-token storage or revocation cache is implemented. Membership and role rows are read on each protected request, so changes take effect on the next request. A valid stolen JWT remains usable until expiry unless provider revocation/introspection is integrated; configure a short access-token lifetime with the selected provider.
