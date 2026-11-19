import { ForbiddenException } from '@nestjs/common';
import { AuthorizationContextService } from '../src/authorization/authorization-context.service';

describe('authorization context and hotel isolation', () => {
  const hotelA = { id: 'hotel-a', name: 'Hotel A', code: 'A' };
  const identity = { issuer: 'https://id.test/', subject: 'sub', identityId: 'identity-1', emailVerified: false };
  const makeService = (membership: object | null) => {
    const prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Org', slug: 'org' }) },
      organizationMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
      hotel: { findMany: jest.fn().mockResolvedValue([hotelA, { id: 'hotel-b', name: 'Hotel B', code: 'B' }]) },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    } as never;
    const config = { get: jest.fn().mockReturnValue('org-1') } as never;
    return { service: new AuthorizationContextService(config, prisma), prisma };
  };
  const activeMembership = {
    id: 'membership-1', status: 'ACTIVE', isOwner: false,
    roleAssignments: [],
    hotelMemberships: [{
      hotel: hotelA,
      roleAssignments: [{ role: { id: 'role-a', name: 'Front Desk', hotelId: 'hotel-a', permissions: [
        { permission: { resource: 'hotel', action: 'read' } },
        { permission: { resource: 'frontdesk', action: 'read' } },
      ] } }],
    }],
  };

  it('grants only assigned hotel scope and rejects a substituted hotel ID', async () => {
    const { service } = makeService(activeMembership);
    const context = await service.load(identity);
    expect(context.accessibleHotels).toEqual([hotelA]);
    expect(() => service.assertHotelAccess(context, 'hotel-b')).toThrow(ForbiddenException);
    expect(() => service.assertHotelAccess(context, 'hotel-a')).not.toThrow();
  });

  it('grants organization-wide hotel scope only for an active owner or organization-level hotel grant', async () => {
    const { service } = makeService({ ...activeMembership, isOwner: true });
    const context = await service.load(identity);
    expect(context.organizationWideHotelAccess).toBe(true);
    expect(context.accessibleHotels.map(({ id }) => id)).toEqual(['hotel-a', 'hotel-b']);
    expect(() => service.assertHotelAccess(context, 'hotel-b')).not.toThrow();
  });

  it('ignores a hotel-scoped role assigned to the wrong hotel', async () => {
    const { service } = makeService({
      ...activeMembership,
      roleAssignments: [{ role: { id: 'wrong-org-scope', name: 'wrong', hotelId: 'hotel-b', isSystem: false, permissions: [
        { permission: { resource: 'hotel', action: 'read' } },
      ] } }],
      hotelMemberships: [{
        hotel: hotelA,
        roleAssignments: [{ role: { id: 'wrong-hotel-scope', name: 'wrong', hotelId: 'hotel-b', permissions: [
          { permission: { resource: 'hotel', action: 'read' } },
          { permission: { resource: 'finance', action: 'read' } },
        ] } }],
      }],
    });
    const context = await service.load(identity);
    expect(context.permissions).toEqual([]);
    expect(context.accessibleHotels).toEqual([]);
  });

  it.each(['INVITED', 'SUSPENDED', 'REVOKED', 'REMOVED'])('denies a %s organization membership', async (status) => {
    const { service, prisma } = makeService({ ...activeMembership, status } as object);
    await expect(service.load(identity, 'correlation')).rejects.toThrow(ForbiddenException);
    expect((prisma as { auditEvent: { create: jest.Mock } }).auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'organization.membership.denied', outcome: 'DENIED', correlationId: 'correlation' }),
    }));
  });

  it('denies identities without a local membership in the configured organization', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.load(identity, 'cross-org-correlation')).rejects.toThrow(ForbiddenException);
    expect((prisma as { organizationMembership: { findUnique: jest.Mock } }).organizationMembership.findUnique)
      .toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_userId: { organizationId: 'org-1', userId: 'identity-1' } } }));
  });
});
