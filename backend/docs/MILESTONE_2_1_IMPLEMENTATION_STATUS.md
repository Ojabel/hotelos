# Milestone 2.1 implementation status

Status: **PARTIALLY COMPLETE**.

Implemented: production rejection of development signing secrets; access seeding restricted to one explicitly configured nonproduction tenant; additive invitation schema; verified-email invitation acceptance without a returned bearer secret; invitation listing/cancellation; role-subset delegation; membership listing/suspend/revoke; self-change prevention; owner status-operation guard with PostgreSQL advisory locking; transactional audit for implemented successful mutations and last-Owner denial.

Not implemented: invitation provider/email delivery; custom role creation/update/archive; role permission editing; membership reactivation; ownership transfer; deletion; hotel-specific invitation scope; full integration/adversarial HTTP suite; simultaneous PostgreSQL owner-removal test; live OIDC provider test; persistent authentication-failure audit; audit tamper evidence. Owner transfer is deliberately blocked pending a dedicated flow.

The central identity provider remains unselected. The backend is not production-ready. See the security audit, membership lifecycle, delegation, owner, audit, tenant isolation, token lifecycle, and development-auth documents for operating details and limits.
