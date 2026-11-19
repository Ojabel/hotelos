# Owner protection

Normal API operations cannot set or clear `OrganizationMembership.isOwner`. The protected `Owner` system role cannot be delegated and does not itself create owner authority. Ownership transfer is unsupported; the initial Owner must be provisioned through the separately controlled development/bootstrap process or an operator-reviewed recovery.

Suspending or revoking an active Owner obtains a PostgreSQL transaction-scoped advisory lock keyed by the configured organization, then counts active Owners and performs the mutation while holding the lock. The denial audit is committed before the safe 403 is returned. This serializes status changes performed through this service and prevents two such requests from both removing the final Owner.

`npm run test:security` drives simultaneous HTTP suspension and revocation attempts against local PostgreSQL with two active Owners. It verifies one succeeds, one receives 403, exactly one active Owner remains, the denial audit commits, the denied target remains active, and the successful status change has its audit record. Owner demotion/transfer endpoints do not exist, so those transitions are not tested. Out-of-band SQL can bypass the application policy.

Manual recovery: restrict writes, establish a verified operator-approved identity, add/restore one active Owner through a reviewed database change, record evidence in the operational audit trail, and verify access before reopening writes. Do not use ordinary staff roles as a workaround.
