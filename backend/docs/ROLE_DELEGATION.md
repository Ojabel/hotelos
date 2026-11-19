# Role delegation

Membership managers need `staff.manage` or `access.manage`. An actor can assign only organization-wide roles in the configured organization, and every permission on the selected role must already be in the actor's effective database-derived permissions. System `Owner` cannot be delegated. Self-role mutation is denied. Role assignment/removal and invitation role grants are audited in the same transaction as the mutation.

This is permission-subset delegation, not delegation by display name. Thus a manager cannot assign finance permissions the manager does not hold; an accountant without staff/access management cannot manage memberships. Owner authority comes from the trusted `isOwner` membership flag, not a client claim or an assignable role.

Custom role create/update/archive endpoints are not implemented. System role templates cannot be edited through the API. Direct database access remains privileged and must be restricted. No platform administration permission exists in the hotel role catalogue.
