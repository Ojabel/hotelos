-- Additive identity-provider invitation hardening. Existing invitations are
-- preserved and can be resent to receive a fresh single-use token.
ALTER TABLE "MembershipInvitation"
  ADD COLUMN "tokenHash" VARCHAR(64),
  ADD COLUMN "deliveryStatus" VARCHAR(20) NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN "deliveryError" VARCHAR(80),
  ADD COLUMN "lastDeliveryAt" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "MembershipInvitation_tokenHash_key"
  ON "MembershipInvitation"("tokenHash");
