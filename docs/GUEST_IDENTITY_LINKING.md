# Guest identity linking and recovery

## Mapping model

Firebase Authentication owns credentials and sign-in. The verified token subject (Firebase UID) and issuer are resolved to `UserIdentity` by the existing `(issuer, subject)` unique key. `GuestIdentityLink` then maps that HotelOS identity to one hotel-scoped `HotelGuest` profile. Reservation, folio and other business records remain attached to their existing `HotelGuest.id`; Firebase UID is never used as a guest or reservation key.

The link is unique per hotel for both Firebase identity and guest profile. A Firebase identity with any organization membership is not accepted as a guest identity. Hotel/organization IDs are checked against the server tenant and profile links; guest API requests never accept a guest ID for ownership.

## New guest

After Firebase email verification (or Google sign-in), the browser calls `POST /api/v1/guest/account/resolve`. The API creates a hotel guest profile and identity link in one PostgreSQL transaction only when no existing profile has the verified email and the organization has exactly one active hotel. Public registration cannot choose a hotel, organization, role or permission. When the organization has multiple active hotels, account setup must start from a trusted hotel stay/reservation flow or be resolved by hotel support; the guest API returns no hotel list and does not accept a client-supplied hotel ID. Signup cannot create a staff membership.

## Existing guest profile and proof

A matching email alone never links a Firebase identity. Account resolution returns a safe conflict and writes a denial audit event without returning candidate profile IDs or reservation data. Do not ask the guest to provide a reservation ID, name or phone number as sole proof; those values are not secrets.

Hotel staff with `guests.manage` must verify the guest in person or through the hotel's separately approved identity process. Once verified, an authorized staff client may call `POST /api/v1/guest/identity-links/staff-verified` with `hotelId`, `guestId`, the Firebase-backed `identityId`, a `verificationMethod` (`IN_PERSON_ID`, `RESERVATION_VERIFICATION` or `MANAGER_REVIEW`) and a `verificationCaseReference`. The API checks verified email equality, rejects identities with staff membership, prevents duplicate/conflicting links, commits the mapping transactionally and records the declared method and case reference in the audit event. This is a staff-attested verification action; the API does not inspect identity documents. Do not send identity document numbers or copies in the API request. The case reference points to the hotel's separately controlled verification record.

If multiple HotelGuest profiles in the same hotel share the address, do not merge them or choose one automatically. Both self-registration and staff-assisted linking return a controlled conflict until an administrator resolves the duplicate through the hotel's existing data governance process. A guest with legitimate profiles at different hotels may be linked by authorized staff at each hotel after separately verifying each relationship. The conflict audit records the ambiguous-match count, without exposing candidates to the guest.

## Recovery and unlinking

Password recovery uses Firebase's reset email. Firebase account recovery does not grant HotelOS profile ownership. If the guest loses access to the Firebase account, staff must verify the person again and use the approved Firebase account recovery process before creating a new mapping. Never copy a mapping to a new UID based only on email. The current API has no self-service unlink or account merge operation; staff should escalate mapping changes through a controlled database change with an audit/case reference.

## Data protection

Guest profile, reservations, cancellation and service request queries are filtered by the server-resolved guest links. Missing or foreign reservation IDs return not found. Staff endpoints remain guarded by their existing PostgreSQL permissions. Guest profiles are hotel-scoped so one identity may access linked profiles at more than one hotel without changing reservation ownership.
