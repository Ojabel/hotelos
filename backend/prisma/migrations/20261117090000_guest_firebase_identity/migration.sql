ALTER TABLE "HotelGuest" ADD COLUMN "preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "GuestIdentityLink" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "hotelId" UUID NOT NULL,
  "guestId" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "linkedById" UUID,
  "linkMethod" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestIdentityLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuestIdentityLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestIdentityLink_hotelId_organizationId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestIdentityLink_guestId_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId", "guestId") REFERENCES "HotelGuest"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestIdentityLink_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestIdentityLink_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GuestIdentityLink_hotelId_identityId_key" ON "GuestIdentityLink"("hotelId", "identityId");
CREATE UNIQUE INDEX "GuestIdentityLink_hotelId_guestId_key" ON "GuestIdentityLink"("hotelId", "guestId");
CREATE INDEX "GuestIdentityLink_organizationId_identityId_idx" ON "GuestIdentityLink"("organizationId", "identityId");

CREATE TABLE "GuestServiceRequest" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "hotelId" UUID NOT NULL,
  "guestId" UUID NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "GuestServiceRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuestServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestServiceRequest_hotelId_organizationId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestServiceRequest_guestId_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId", "guestId") REFERENCES "HotelGuest"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GuestServiceRequest_organizationId_hotelId_id_key" ON "GuestServiceRequest"("organizationId", "hotelId", "id");
CREATE INDEX "GuestServiceRequest_organizationId_hotelId_guestId_createdAt_idx" ON "GuestServiceRequest"("organizationId", "hotelId", "guestId", "createdAt");
