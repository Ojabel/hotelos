import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity, AuthorizationContext } from './auth.types';
import { EmailDeliveryService } from './email-delivery.service';

const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MembershipLifecycleService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService, private readonly email: EmailDeliveryService) {}

  private tenantId() {
    const id = this.config.get<string>('app.tenantOrganizationId');
    if (!id) throw new ForbiddenException('Tenant context is unavailable.');
    return id;
  }

  private async assertDelegable(context: AuthorizationContext, roleIds: string[], organizationId: string, actor: AuthenticatedIdentity, correlationId: string) {
    const deny = async (reason: string, exception: Error = new ForbiddenException('Role delegation is not permitted.')) => {
      await this.prisma.auditEvent.create({ data: {
        organizationId, actorUserId: actor.identityId, correlationId, action: 'access.delegation.denied',
        resource: 'role-assignment', resourceId: roleIds.join(',').slice(0, 200), outcome: 'DENIED', metadata: { reason },
      } });
      throw exception;
    };
    if (!context.permissions.includes('staff.manage') && !context.permissions.includes('access.manage')) {
      await deny('membership_administration_permission_required');
    }
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, organizationId },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== new Set(roleIds).size) await deny('role_not_found_or_outside_organization', new NotFoundException('Role not found.'));
    for (const role of roles) {
      if (role.hotelId !== null || role.isSystem && role.name === 'Owner') {
        await deny('protected_or_hotel_scoped_role');
      }
      if (role.permissions.some(({ permission }) => !context.permissions.includes(`${permission.resource}.${permission.action}`))) {
        await deny('permission_escalation_attempt');
      }
    }
    return roles;
  }

  async invite(identity: AuthenticatedIdentity, context: AuthorizationContext, emailInput: string, roleIds: string[], correlationId: string) {
    const organizationId = this.tenantId();
    await this.assertDelegable(context, roleIds, organizationId, identity, correlationId);
    const email = emailInput.trim().toLowerCase();
    if (identity.emailVerified && identity.email?.toLowerCase() === email) {
      throw new BadRequestException('Self-invitation is not permitted.');
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const created = await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.membershipInvitation.create({
        data: {
          organizationId,
          email,
          invitedByUserId: identity.identityId,
          expiresAt: new Date(Date.now() + invitationTtlMs),
          tokenHash,
          roles: { create: roleIds.map((roleId) => ({
            role: { connect: { organizationId_id: { organizationId, id: roleId } } },
          })) },
        },
        select: { id: true, email: true, status: true, expiresAt: true, createdAt: true },
      });
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId,
        action: 'membership.invitation.created', resource: 'membership-invitation', resourceId: invitation.id,
        metadata: { email, roleIds },
      } });
      return invitation;
    });
    const delivery = await this.email.sendInvitation(email, token, created.expiresAt);
    await this.prisma.membershipInvitation.update({ where: { id: created.id }, data: {
      deliveryStatus: delivery.status, deliveryError: delivery.error ?? null, lastDeliveryAt: new Date(),
    } });
    return { ...created, deliveryStatus: delivery.status };
  }

  async listInvitations() {
    return this.prisma.membershipInvitation.findMany({
      where: { organizationId: this.tenantId() },
      select: { id: true, email: true, status: true, deliveryStatus: true, deliveryError: true, expiresAt: true, acceptedAt: true, cancelledAt: true, createdAt: true,
        invitedBy: { select: { email: true } },
        roles: { select: { role: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async resend(invitationId: string, identity: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.tenantId();
    const invitation = await this.prisma.membershipInvitation.findFirst({
      where: { id: invitationId, organizationId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    if (!invitation) throw new BadRequestException('Invitation is no longer pending or has expired.');
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const updated = await this.prisma.membershipInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { tokenHash, deliveryStatus: 'PENDING', deliveryError: null },
    });
    if (updated.count !== 1) throw new BadRequestException('Invitation is no longer pending or has expired.');
    const delivery = await this.email.sendInvitation(invitation.email, token, invitation.expiresAt);
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipInvitation.update({ where: { id: invitation.id }, data: {
        deliveryStatus: delivery.status, deliveryError: delivery.error ?? null, lastDeliveryAt: new Date(),
      } });
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.resent',
        resource: 'membership-invitation', resourceId: invitation.id,
        metadata: { deliveryStatus: delivery.status },
      } });
    });
    return { id: invitation.id, status: invitation.status, deliveryStatus: delivery.status, expiresAt: invitation.expiresAt };
  }

  async validateInvitationToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.membershipInvitation.findFirst({
      where: { tokenHash, organizationId: this.tenantId() },
      include: { roles: { include: { role: { select: { name: true } } } } },
    });
    if (!invitation) return { status: 'INVALID' as const };
    if (invitation.status !== 'PENDING') return { status: invitation.status };
    if (invitation.expiresAt <= new Date()) return { status: 'EXPIRED' as const };
    return { status: 'PENDING' as const, email: invitation.email, expiresAt: invitation.expiresAt, roles: invitation.roles.map(({ role }) => role.name) };
  }

  async accept(token: string, identity: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.tenantId();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (this.config.get<string>('app.authMode') === 'firebase' && identity.authenticationProvider !== 'password') {
      await this.prisma.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.acceptance-denied',
        resource: 'membership-invitation', outcome: 'DENIED', metadata: { reason: 'email_password_provider_required' },
      } });
      throw new ForbiddenException('Staff invitations must be accepted using email and password sign-in.');
    }
    if (!identity.emailVerified || !identity.email) {
      await this.prisma.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.acceptance-denied',
        resource: 'membership-invitation', outcome: 'DENIED', metadata: { reason: 'verified_email_required' },
      } });
      throw new ForbiddenException('A verified invitation email is required.');
    }
    const verifiedEmail = identity.email.toLowerCase();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tokenHash}))`;
      const invitation = await tx.membershipInvitation.findFirst({
        where: { tokenHash, organizationId }, include: { roles: true },
      });
      if (!invitation) {
        await tx.auditEvent.create({ data: {
          organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.acceptance-denied',
          resource: 'membership-invitation', outcome: 'DENIED', metadata: { reason: 'not_found' },
        } });
        return { problem: 'not_found' as const };
      }
      if (invitation.email !== verifiedEmail) {
        await tx.auditEvent.create({ data: {
          organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.acceptance-denied',
          resource: 'membership-invitation', resourceId: invitation.id, outcome: 'DENIED', metadata: { reason: 'identity_mismatch' },
        } });
        return { problem: 'identity' as const };
      }
      if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) {
        if (invitation.status === 'PENDING' && invitation.expiresAt <= new Date()) {
          await tx.membershipInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED', tokenHash: null } });
          await tx.auditEvent.create({ data: {
            organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.expired',
            resource: 'membership-invitation', resourceId: invitation.id, outcome: 'DENIED',
          } });
        } else {
          await tx.auditEvent.create({ data: {
            organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.acceptance-denied',
            resource: 'membership-invitation', resourceId: invitation.id, outcome: 'DENIED', metadata: { reason: 'not_pending' },
          } });
        }
        return { problem: 'expired' as const };
      }
      const existing = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId: identity.identityId } },
      });
      if (existing && existing.status !== 'INVITED') throw new BadRequestException('An existing membership requires administrator review.');
      const now = new Date();
      const membership = existing
        ? await tx.organizationMembership.update({ where: { id: existing.id }, data: { status: 'ACTIVE', activatedAt: now, suspendedAt: null, revokedAt: null } })
        : await tx.organizationMembership.create({ data: { organizationId, userId: identity.identityId, status: 'ACTIVE', activatedAt: now } });
      for (const { roleId } of invitation.roles) {
        await tx.organizationMembershipRole.create({ data: { organizationId, organizationMembershipId: membership.id, roleId } });
      }
      await tx.membershipInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: now, tokenHash: null } });
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.accepted',
        resource: 'organization-membership', resourceId: membership.id, metadata: { invitationId: invitation.id },
      } });
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.activated',
        resource: 'organization-membership', resourceId: membership.id, metadata: { invitationId: invitation.id },
      } });
      return { value: { id: membership.id, status: membership.status, activatedAt: membership.activatedAt } };
    });
    if ('problem' in result) {
      if (result.problem === 'identity') throw new ForbiddenException('Invitation is not for this identity.');
      if (result.problem === 'not_found') throw new NotFoundException('Invitation not found.');
      throw new BadRequestException('Invitation is no longer valid.');
    }
    return result.value;
  }

  async cancel(invitationId: string, identity: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.tenantId();
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.membershipInvitation.findFirst({ where: { id: invitationId, organizationId } });
      if (!invitation) throw new NotFoundException('Invitation not found.');
      if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation is no longer pending.');
      const result = await tx.membershipInvitation.updateMany({ where: { id: invitation.id, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date(), tokenHash: null } });
      if (result.count !== 1) throw new BadRequestException('Invitation is no longer pending.');
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId, action: 'membership.invitation.cancelled',
        resource: 'membership-invitation', resourceId: invitation.id,
      } });
      return { id: invitation.id, status: 'CANCELLED' as const };
    });
  }

  async listMemberships() {
    return this.prisma.organizationMembership.findMany({
      where: { organizationId: this.tenantId() },
      select: { id: true, status: true, isOwner: true, invitedAt: true, activatedAt: true, suspendedAt: true, revokedAt: true,
        user: { select: { email: true, emailVerified: true } },
        roleAssignments: { select: { role: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async setStatus(membershipId: string, status: 'SUSPENDED' | 'REVOKED', actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.tenantId();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const membership = await tx.organizationMembership.findFirst({ where: { id: membershipId, organizationId } });
      if (!membership) throw new NotFoundException('Membership not found.');
      if (membership.userId === actor.identityId) throw new ForbiddenException('You cannot change your own membership status.');
      if (membership.isOwner && membership.status === 'ACTIVE') {
        const owners = await tx.organizationMembership.count({ where: { organizationId, isOwner: true, status: 'ACTIVE' } });
        if (owners <= 1) {
          await tx.auditEvent.create({ data: {
            organizationId, actorUserId: actor.identityId, correlationId,
            action: 'membership.last-owner.protection-triggered', resource: 'organization-membership',
            resourceId: membership.id, outcome: 'DENIED', metadata: { attemptedStatus: status },
          } });
          return { denied: true as const };
        }
      }
      const now = new Date();
      const updated = await tx.organizationMembership.update({
        where: { id: membership.id },
        data: { status, ...(status === 'SUSPENDED' ? { suspendedAt: now } : { revokedAt: now }) },
        select: { id: true, status: true, isOwner: true },
      });
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: actor.identityId, correlationId,
        action: `membership.${status.toLowerCase()}`, resource: 'organization-membership', resourceId: membership.id,
      } });
      return { denied: false as const, updated };
    });
    if (result.denied) throw new ForbiddenException('The last active Owner cannot be suspended or revoked.');
    return result.updated;
  }

  async assignRole(membershipId: string, roleId: string, identity: AuthenticatedIdentity, context: AuthorizationContext, correlationId: string, remove = false) {
    const organizationId = this.tenantId();
    const [membership] = await this.prisma.organizationMembership.findMany({ where: { id: membershipId, organizationId }, take: 1 });
    if (!membership) throw new NotFoundException('Membership not found.');
    if (membership.status !== 'ACTIVE') throw new BadRequestException('Only active memberships can have roles changed.');
    if (membership.userId === identity.identityId) throw new ForbiddenException('You cannot modify your own role assignments.');
    const roles = await this.assertDelegable(context, [roleId], organizationId, identity, correlationId);
    const role = roles[0];
    if (role.isSystem && role.name === 'Owner') throw new ForbiddenException('Owner delegation requires a separate ownership-transfer workflow.');
    return this.prisma.$transaction(async (tx) => {
      if (remove) {
        await tx.organizationMembershipRole.deleteMany({ where: { organizationId, organizationMembershipId: membership.id, roleId } });
      } else {
        await tx.organizationMembershipRole.upsert({
          where: { organizationMembershipId_roleId: { organizationMembershipId: membership.id, roleId } },
          create: { organizationId, organizationMembershipId: membership.id, roleId }, update: {},
        });
      }
      await tx.auditEvent.create({ data: {
        organizationId, actorUserId: identity.identityId, correlationId,
        action: remove ? 'membership.role.removed' : 'membership.role.assigned',
        resource: 'organization-membership', resourceId: membership.id, metadata: { roleId },
      } });
      return { membershipId: membership.id, roleId, assigned: !remove };
    });
  }
}
