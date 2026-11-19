# API standards

- Root prefix: `/api/v1`. Do not silently change semantics within a version.
- Success response: `{ "data": <result>, "meta": { "correlationId": "..." } }`.
- Error response: `{ "statusCode": number, "error": string, "message": string | object, "correlationId": string, "timestamp": ISO string, "path": string }`. Do not expose stack traces or database details to clients.
- Validate and transform boundary inputs; reject unknown/unexpected fields in DTO schemas. Business services accept explicit input objects rather than spreading request bodies into Prisma data.
- Lists should use `page` (1-based), `pageSize` (default 25, maximum 100), with `{ items, page, pageSize, total, totalPages }`. Domain endpoints define allowed filters and sort fields explicitly; never interpolate client field names into raw SQL.
- Use ISO 8601 timestamps with UTC offsets. Use ISO calendar dates for hotel business dates. Currency amounts must have explicit currency and decimal-safe representation.
- Use conventional HTTP status codes; use `409` for domain conflicts and `422` only when a documented semantic validation convention is adopted. Return `404` for inaccessible tenant resources where that avoids resource enumeration.
- Health liveness: `GET /api/v1/health`. Database readiness: `GET /api/v1/health/database`.
- OpenAPI is served at `/api/docs` when enabled. Production defaults docs off; protect documentation if enabled externally.
- Pagination/filter/sort and success/error conventions are documented now; business endpoint implementations and their detailed schemas are future work.
