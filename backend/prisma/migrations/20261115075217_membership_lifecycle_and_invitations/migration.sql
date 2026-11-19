-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "MembershipInvitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipInvitationRole" (
    "organizationId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "MembershipInvitationRole_pkey" PRIMARY KEY ("invitationId","roleId")
);

-- CreateIndex
CREATE INDEX "MembershipInvitation_organizationId_status_expiresAt_idx" ON "MembershipInvitation"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "MembershipInvitation_organizationId_email_idx" ON "MembershipInvitation"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipInvitation_organizationId_id_key" ON "MembershipInvitation"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MembershipInvitationRole_organizationId_roleId_idx" ON "MembershipInvitationRole"("organizationId", "roleId");

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitationRole" ADD CONSTRAINT "MembershipInvitationRole_organizationId_invitationId_fkey" FOREIGN KEY ("organizationId", "invitationId") REFERENCES "MembershipInvitation"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitationRole" ADD CONSTRAINT "MembershipInvitationRole_organizationId_roleId_fkey" FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
