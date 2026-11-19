# Token lifecycle

OIDC access tokens must verify with the configured HTTPS issuer, audience and JWKS; only RS256 is accepted. `jose` remote JWKS resolution supports trusted key rotation. JWKS URLs are configuration-only. Expiry and not-before are validated with five seconds clock tolerance. Tokens and credential headers are redacted from application request logs.

HotelOS does not store refresh tokens and has no token denylist. A valid stolen access token can remain cryptographically valid until expiry. Provider session revocation affects future provider issuance according to provider behavior; it does not necessarily invalidate an already-issued JWT. HotelOS membership suspension/revocation or role updates are effective on the next protected request because authorization state is fetched from PostgreSQL each time.

Incident response: suspend or revoke the affected organization membership; contact the identity provider to disable/recover the identity and revoke provider sessions; ask the user to sign out and rotate credentials; investigate audit and provider logs; if signing key compromise is suspected, coordinate key removal/rotation with the provider and monitor JWKS rollover. Do not claim global immediate token revocation.
