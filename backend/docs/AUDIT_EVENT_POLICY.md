# Audit event policy

The existing `AuditEvent` model remains the single audit store. Invitation creation, acceptance, activation, expiry-on-attempt and cancellation; membership suspension/revocation; role assignment/removal; delegation denials; and last-Owner protection denial are recorded with actor, configured organization, request correlation ID, target and safe metadata. Successful mutations write audit rows in the same transaction. Last-Owner denial writes and commits its denial event before raising the authorization error.

Raw tokens, secrets, private keys and passwords are not written to audit metadata. Invitation metadata can include intended email and role IDs because those are necessary administration records; access to logs and database backups must be restricted. Audit records have no organization API for mutation.

Authentication failures are returned as generic errors and are not currently persisted as audit records. Authorization guard denials are attempted through the existing audit service. Role definition create/update/archive and ownership transfer events are absent because those workflows do not exist. Audit storage is not cryptographically tamper-evident; privileged database operators can alter it.
