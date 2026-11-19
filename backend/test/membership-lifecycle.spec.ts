import { ForbiddenException } from '@nestjs/common';
import { MembershipLifecycleService } from '../src/auth/membership-lifecycle.service';

describe('membership lifecycle security rules', () => {
  const organizationId = 'd2719dd4-f0e8-4b89-8fd6-44ab7f138d73';
  const actor = { issuer: 'https://identity.test/', subject: 'owner', identityId: 'owner-id', emailVerified: true, email: 'owner@example.test' };
  const ownerContext = { organization: { id: organizationId, name: 'HotelOS', slug: 'hotelos' }, membership: { id: 'owner-membership', status: 'ACTIVE', isOwner: true },
    permissions: ['access.manage', 'staff.manage', 'hotel.read'], accessibleHotels: [], organizationWideHotelAccess: true, roles: [] };
  const config = { get: jest.fn(() => organizationId) } as never;

  it('commits the last-owner denial audit while leaving the membership active', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'owner-membership', userId: 'other-owner', isOwner: true, status: 'ACTIVE' }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as never;
    const service = new MembershipLifecycleService(config, prisma, {} as never);

    await expect(service.setStatus('owner-membership', 'SUSPENDED', actor, 'req-1')).rejects.toThrow(ForbiddenException);
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'membership.last-owner.protection-triggered', outcome: 'DENIED', correlationId: 'req-1',
    }) }));
  });

  it('rejects delegation of permissions the actor does not hold', async () => {
    const prisma = {
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      role: { findMany: jest.fn().mockResolvedValue([{
      id: 'finance-role', hotelId: null, isSystem: false,
      permissions: [{ permission: { resource: 'finance', action: 'payments.manage' } }],
      }]) },
    } as never;
    const service = new MembershipLifecycleService(config, prisma, {} as never);
    await expect(service.invite(actor, ownerContext, 'staff@example.test', ['finance-role'], 'req-2'))
      .rejects.toThrow(ForbiddenException);
  });

  it('binds invitation acceptance to a currently verified matching email and audits mismatch', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      membershipInvitation: { findFirst: jest.fn().mockResolvedValue({
        id: 'invite-id', email: 'intended@example.test', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), roles: [],
      }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as never;
    const service = new MembershipLifecycleService(config, prisma, { sendInvitation: jest.fn() } as never);
    await expect(service.accept('invite-id', {
      issuer: 'https://identity.test/', subject: 'wrong', identityId: 'wrong-id', emailVerified: true, email: 'other@example.test',
    }, 'req-3')).rejects.toThrow(ForbiddenException);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'membership.invitation.acceptance-denied', outcome: 'DENIED',
    }) }));
  });

  it('rejects Google provider identities from Firebase staff invitation acceptance', async () => {
    const prisma = { auditEvent: { create: jest.fn().mockResolvedValue({}) } } as never;
    const firebaseConfig = { get: (key: string) => key === 'app.authMode' ? 'firebase' : organizationId } as never;
    const service = new MembershipLifecycleService(firebaseConfig, prisma, {} as never);
    await expect(service.accept('a'.repeat(43), {
      issuer: 'https://securetoken.google.com/project', subject: 'google-user', identityId: 'identity-id',
      emailVerified: true, email: 'staff@example.test', authenticationProvider: 'google.com',
    }, 'req-4')).rejects.toThrow('email and password');
    expect((prisma as unknown as { auditEvent: { create: jest.Mock } }).auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'membership.invitation.acceptance-denied', metadata: { reason: 'email_password_provider_required' } }),
    }));
  });
});
