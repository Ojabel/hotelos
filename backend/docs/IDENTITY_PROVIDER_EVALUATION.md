# Managed identity provider evaluation

Research checked 2026-11-15 against official product documentation and public pricing pages. Pricing and feature plans change; confirm them with vendors before procurement. This is an evaluation and recommendation, not a provider selection or account setup.

| Provider | Central identity / org membership | Protocol and token verification | Invitations, recovery, MFA, SSO | Google Cloud fit | Cost and operating notes |
| --- | --- | --- | --- | --- | --- |
| Auth0 Organizations | Organization-aware B2B workflows; users can belong to multiple organizations. API deployments can remain isolated while using the same Auth0 tenant and API audience. | OIDC/OAuth 2.0 and JWT access tokens for a configured API audience; backend validates issuer, audience, signature and expiry against trusted keys. | Organization connections, membership, invitations and organization roles; MFA and enterprise SSO depend on plan/features. | Cloud-neutral managed SaaS; no GCP coupling. | Public pricing currently shows free up to 25k MAU and 5 organizations, with paid tiers/add-ons and B2B plan qualifications. Confirm limits, SSO/MFA, support, region and total cost. |
| Google Cloud Identity Platform | One project can contain identity tenants that isolate users/configuration. That isolation may conflict with the desired same central identity across separate HotelOS organizations unless a shared identity tenant/project design is chosen. HotelOS still needs its own membership/role database. | OIDC/SAML federation and signed ID tokens. Use the provider-supported verification path or validated issuer/JWKS configuration; do not treat client claims as HotelOS grants. | Supports configured sign-in methods and tenant management; MFA and email actions are available. Organization invitations and HotelOS business roles remain application concerns. | Strongest native GCP integration, IAM/project operations and billing. | Tiered MAU pricing; current docs show 50k free for Tier 1 methods and separate OIDC/SAML rates. SMS/MFA may incur separate charges. Estimate by method and deployment design. |
| WorkOS AuthKit / User Management | Explicit organizations, memberships, multi-organization selection and organization roles; central environment can issue tokens for users serving multiple isolated HotelOS deployments. | OIDC-style JWT/JWKS verification documented; check the exact access-token issuer/audience and JWKS values for the chosen AuthKit environment before launch. | Hosted AuthKit, email verification, password reset flows, MFA, passkeys, invitations and enterprise SSO/SCIM features. | Cloud-neutral managed service; works with GCP deployments without requiring GCP identity tenancy. | Current pricing page advertises up to 1M MAU free for AuthKit, with additional MAU and per-SSO-connection charges. Validate custom-domain, retention, support, staging/production and contractual terms. |

## Recommendation

Evaluate **WorkOS AuthKit first** for a proof of concept because its documented product combines central user management, organization membership, multi-organization sign-in, MFA and enterprise SSO while allowing HotelOS to remain the authorization authority. Keep Auth0 Organizations as the primary alternative because it has mature B2B organization workflows and a standards-based API token model. Identity Platform is a strong operational fit if GCP-native IAM and project-level controls outweigh the extra work of modeling central cross-tenant identity and organization membership.

Do not treat this recommendation as a final provider selection. Before choosing, compare contract/data-region requirements, provider availability, API audience/token claims, organization switching behavior, SSO/SCIM roadmap, MAU and connection pricing, support/SLA, account recovery controls, and migration/export options. Never make vendor organization roles authoritative for HotelOS data access.

## Dedicated deployment compatibility

One managed identity environment can serve multiple isolated customer deployments. Each API deployment has its own configured expected issuer, audience and tenant organization UUID; the central provider authenticates a person, while each deployment independently checks its local identity mapping, active membership, role assignments and hotel scope. Do not accept an organization ID, role, or permission from the browser as a tenant switch. If a future provider issues organization claims, use them only as an additional consistency check, not a grant source.

## Security and migration considerations

- Validate JWT signatures, `iss`, `aud`, `exp`, `nbf`, subject and allowed algorithms. Keep JWKS URLs fixed in server configuration.
- Treat identity as issuer plus subject. Do not auto-link two identities because their email strings match.
- Use short-lived access tokens and provider-managed sessions; backend-managed refresh tokens are out of scope.
- Keep HotelOS RBAC local so vendor changes do not migrate operational authorization implicitly.
- Plan a staged identity mapping/import and account recovery process before changing issuers. A change of issuer changes the external identity key even if email remains the same.
- Provider token/session revocation guarantees differ. This backend rechecks membership/permissions from PostgreSQL on each protected organization request; a suspended membership is blocked on the next request. A stolen bearer token can remain usable until its `exp` unless the provider supports a revocation/introspection mechanism that is deliberately integrated.

## Official sources

- [Auth0 Organizations](https://auth0.com/organizations), [Auth0 pricing](https://auth0.com/pricing), [Auth0 access token formats](https://support.auth0.com/center/s/article/opaque-versus-jwt-access-token).
- [Identity Platform multi-tenancy](https://cloud.google.com/identity-platform/docs/multi-tenancy), [tenant management](https://cloud.google.com/identity-platform/docs/multi-tenancy-managing-tenants), [pricing](https://cloud.google.com/identity-platform/pricing).
- [WorkOS AuthKit](https://workos.com/docs), [AuthKit token claims](https://workos.com/docs/authkit/connect/token-claims), [organizations](https://workos.com/docs/widgets-api/organizations), [pricing](https://workos.com/pricing).
