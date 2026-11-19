import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';

@Injectable()
export class AuthorizationContextService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async load(identity: AuthenticatedIdentity, correlationId = 'unknown'): Promise<AuthorizationContext> {
    const organizationId = this.config.get<string>('app.tenantOrganizationId');
    if (!organizationId) throw new ForbiddenException('Tenant context is unavailable.');
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) throw new ForbiddenException('Tenant context is unavailable.');
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: identity.identityId } },
      include: {
        roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        hotelMemberships: {
          where: { status: 'ACTIVE', hotel: { status: 'ACTIVE' } },
          include: {
            hotel: { select: { id: true, name: true, code: true } },
            roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        },
      },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      await this.prisma.auditEvent.create({ data: {
        organizationId,
        actorUserId: identity.identityId,
        correlationId,
        action: 'organization.membership.denied',
        resource: 'organization-membership',
        outcome: 'DENIED',
      } });
      throw new ForbiddenException('Active organization membership required.');
    }

    const permissions = new Set<string>();
    const roles: AuthorizationContext['roles'] = [];
    for (const assignment of membership.roleAssignments.filter(({ role }) => role.hotelId === null)) {
      if (assignment.role.isSystem && assignment.role.name === 'Owner' && !membership.isOwner) continue;
      roles.push({ id: assignment.role.id, name: assignment.role.name, hotelId: assignment.role.hotelId });
      for (const { permission } of assignment.role.permissions) permissions.add(`${permission.resource}.${permission.action}`);
    }
    const organizationWideHotelAccess = membership.isOwner || permissions.has('hotel.read');
    const hotelRoleGrantsRead = (hotelMembership: typeof membership.hotelMemberships[number]) =>
      hotelMembership.roleAssignments.some(({ role }) =>
        (role.hotelId === null || role.hotelId === hotelMembership.hotel.id) &&
        role.permissions.some(({ permission }) => permission.resource === 'hotel' && permission.action === 'read'),
      );
    const accessibleHotels = organizationWideHotelAccess
      ? await this.prisma.hotel.findMany({
        where: { organizationId, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      })
      : membership.hotelMemberships.filter(hotelRoleGrantsRead).map(({ hotel }) => hotel);
    if (!organizationWideHotelAccess) for (const hotelMembership of membership.hotelMemberships.filter(({ hotel }) => accessibleHotels.some(({ id }) => id === hotel.id))) {
      for (const assignment of hotelMembership.roleAssignments) {
        if (assignment.role.hotelId !== null && assignment.role.hotelId !== hotelMembership.hotel.id) continue;
        roles.push({ id: assignment.role.id, name: assignment.role.name, hotelId: assignment.role.hotelId });
        for (const { permission } of assignment.role.permissions) permissions.add(`${permission.resource}.${permission.action}`);
      }
    }
    if (membership.isOwner) {
      const catalog = await this.prisma.permission.findMany({ select: { resource: true, action: true } });
      for (const permission of catalog) permissions.add(`${permission.resource}.${permission.action}`);
      permissions.add('organization.read');
      permissions.add('organization.manage');
    }
    return {
      organization,
      membership: { id: membership.id, status: membership.status, isOwner: membership.isOwner },
      permissions: [...permissions].sort(),
      accessibleHotels,
      organizationWideHotelAccess,
      roles,
    };
  }

  async recordPermissionDenial(identity: AuthenticatedIdentity, correlationId: string, path: string, permissions: string[]) {
    const organizationId = this.config.get<string>('app.tenantOrganizationId');
    if (!organizationId) return;
    await this.prisma.auditEvent.create({ data: {
      organizationId,
      actorUserId: identity.identityId,
      correlationId,
      action: 'authorization.permission.denied',
      resource: 'api-route',
      resourceId: path.slice(0, 200),
      outcome: 'DENIED',
      metadata: { requiredPermissions: permissions },
    } });
  }

  assertHotelAccess(context: AuthorizationContext, hotelId: string): void {
    if (!context.accessibleHotels.some((hotel) => hotel.id === hotelId)) {
      throw new ForbiddenException('Hotel access denied.');
    }
  }
}
