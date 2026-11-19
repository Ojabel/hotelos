# Initial role and permission matrix

`npm run seed:access` idempotently creates the permission catalogue and organization-wide system role templates for organizations already present in the local database. It does not create members or assign users to roles. Custom role management is not exposed yet.

| Role | Initial grants |
| --- | --- |
| Owner | Every permission in the catalogue; owner status remains an explicit membership field and must be managed only by a future protected workflow. |
| Manager | Organization read; hotel, staff, rooms, reservations, guests, front desk, housekeeping, maintenance, restaurant, inventory operations; reports and settings. No finance or access-management grants. |
| Accountant | Organization read; finance read; payment read/manage; finance reports read/export; general report read/export. No staff security or ownership. |
| Receptionist | Hotel/room read, reservations read/manage, guest read, front-desk read/manage. No finance permissions. |
| Housekeeping | Hotel/room read and housekeeping read/manage. |
| Maintenance | Hotel/room read and maintenance read/manage. |
| Restaurant / Food and Beverage | Hotel read and restaurant read/manage. |
| Inventory / Procurement | Hotel read and inventory/procurement read/manage. |
| Custom | Not provisioned by the seed. A future role-management service must limit grants to permissions the acting manager may delegate. |

The catalogue uses specific `resource.action` identifiers. HotelOS business controllers must declare their required permissions and also check hotel scope when a hotel ID is present. UI visibility is not a security control. The seed updates only seeded system role grants; it does not alter custom roles or assign/remove memberships.
