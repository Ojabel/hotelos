# Database foundation

## Implemented schema

The initial Prisma schema defines `Organization`, `Hotel`, `UserIdentity`, `OrganizationMembership`, `HotelMembership`, `Role`, `Permission`, `OrganizationMembershipRole`, `HotelMembershipRole`, `RolePermission`, and `AuditEvent`. It deliberately excludes reservations, guests, rooms, payments and accounting entities.

Every primary key is UUID. Mutable records have `createdAt` and `updatedAt`; immutable join/audit rows have creation/occurrence timestamps. Foreign keys use restrictive deletion for durable organization, hotel, identity and audit references; permission assignments use cascade only when their owning role/membership assignment is removed.

`UserIdentity.issuer + subject` uniquely maps a provider identity without storing credentials. Organization membership is unique by `(organizationId,userId)`, while the same identity can join many organizations. Hotel membership is unique by `(hotelId,userId)`. Composite keys and foreign keys bind hotels and scoped role assignments to their organization. Owners are represented on organization membership, not as a global user role. Roles and permissions are normalized many-to-many; a role can be organization-scoped or hotel-scoped. Audit events can carry organization, hotel and actor scope and are indexed by scope/time and correlation ID.

Uniqueness/indexes cover organization slug, hotel code per organization, external identity pair, membership pairs/status, role names within scope, permission resource/action, join pairs, and common audit access paths.

## Migration

The first migration is `prisma/migrations/20261110000000_initial_foundation/migration.sql`, generated from the Prisma schema using Prisma 7. `migration_lock.toml` fixes PostgreSQL as provider. Use `npm run prisma:migrate:dev` for local development and `npm run prisma:migrate:deploy` for controlled deployment. The migration was generated and the schema validated locally; it was not applied because the environment has no running PostgreSQL server.

## Expansion strategy

Add domain tables in separate reviewed migrations after requirements and invariants are defined. Business records should carry organization scope and, where applicable, hotel scope; use composite foreign keys to prevent cross-organization references. Use database transactions for multi-record workflows. For audit durability and financial ledger requirements, define append-only permissions, retention, export and reconciliation before implementing. Do not persist frontend store snapshots directly.
