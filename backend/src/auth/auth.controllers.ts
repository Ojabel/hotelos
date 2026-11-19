import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { CurrentAuthorization, CurrentUser, Public, RequireAnyPermissions, RequirePermissions } from './auth.decorators';
import type { AuthenticatedIdentity, AuthorizationContext } from './auth.types';
import { MembershipLifecycleService } from './membership-lifecycle.service';
import { EmailDeliveryService } from './email-delivery.service';

class CreateInvitationDto {
  @IsEmail() email!: string;
  @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true }) roleIds!: string[];
}

class RoleAssignmentDto {
  @IsUUID() roleId!: string;
}

class InvitationTokenDto {
  @IsString() @MinLength(32) @MaxLength(100) token!: string;
}

function correlationId(request: Request) {
  return typeof request.id === 'string' ? request.id : 'unknown';
}

@ApiTags('authentication')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiOkResponse({ description: 'Verified identity for the current bearer token.' })
  me(@CurrentUser() user: AuthenticatedIdentity) {
    return {
      subject: user.subject,
      issuer: user.issuer,
      ...(user.emailVerified && user.email ? { email: user.email } : {}),
      emailVerified: user.emailVerified,
      authenticationProvider: user.authenticationProvider,
      authenticationMethods: user.authenticationMethods ?? [],
    };
  }
}

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationContextController {
  @Get('current')
  @RequirePermissions('organization.read')
  @ApiOkResponse({ description: 'Current organization selected by trusted deployment configuration.' })
  current(@CurrentAuthorization() context: AuthorizationContext) {
    return context.organization;
  }
}

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly lifecycle: MembershipLifecycleService, private readonly email: EmailDeliveryService) {}

  @Get('me')
  @RequirePermissions('organization.read')
  @ApiOkResponse({ description: 'Current organization membership and assigned access scope.' })
  me(@CurrentAuthorization() context: AuthorizationContext) {
    return { ...context.membership, roles: context.roles, accessibleHotels: context.accessibleHotels };
  }

  @Get()
  @RequireAnyPermissions('staff.manage', 'access.manage')
  @ApiOkResponse({ description: 'Memberships in the configured organization.' })
  list() { return this.lifecycle.listMemberships(); }

  @Get('invitations')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  listInvitations() { return this.lifecycle.listInvitations(); }

  @Get('invitations/outbox')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  invitationOutbox() { return this.email.listLocalOutbox(); }

  @Post('invitations/validate')
  @Public()
  validateInvitation(@Body() body: InvitationTokenDto) {
    return this.lifecycle.validateInvitationToken(body.token);
  }

  @Post('invitations')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  invite(@Body() body: CreateInvitationDto, @CurrentUser() user: AuthenticatedIdentity,
    @CurrentAuthorization() context: AuthorizationContext, @Req() request: Request) {
    return this.lifecycle.invite(user, context, body.email, body.roleIds, correlationId(request));
  }

  @Post('invitations/:id/accept')
  accept(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.accept(id, user, correlationId(request));
  }

  @Post('invitations/:id/cancel')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.cancel(id, user, correlationId(request));
  }

  @Post('invitations/:id/resend')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  resend(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.resend(id, user, correlationId(request));
  }

  @Post('invitations/accept')
  acceptInvitation(@Body() body: InvitationTokenDto, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.accept(body.token, user, correlationId(request));
  }

  @Post(':id/suspend')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  suspend(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.setStatus(id, 'SUSPENDED', user, correlationId(request));
  }

  @Post(':id/revoke')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  revoke(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.lifecycle.setStatus(id, 'REVOKED', user, correlationId(request));
  }

  @Post(':id/roles')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  assignRole(@Param('id', new ParseUUIDPipe()) membershipId: string, @Body() body: RoleAssignmentDto,
    @CurrentUser() user: AuthenticatedIdentity, @CurrentAuthorization() context: AuthorizationContext, @Req() request: Request) {
    return this.lifecycle.assignRole(membershipId, body.roleId, user, context, correlationId(request));
  }

  @Delete(':id/roles/:roleId')
  @RequireAnyPermissions('staff.manage', 'access.manage')
  removeRole(@Param('id', new ParseUUIDPipe()) membershipId: string, @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @CurrentUser() user: AuthenticatedIdentity, @CurrentAuthorization() context: AuthorizationContext, @Req() request: Request) {
    return this.lifecycle.assignRole(membershipId, roleId, user, context, correlationId(request), true);
  }
}

@ApiTags('hotels')
@ApiBearerAuth()
@Controller('hotels')
export class HotelsController {
  @Get()
  @RequirePermissions('hotel.read')
  @ApiOkResponse({ description: 'Hotels visible to the current membership.' })
  list(@CurrentAuthorization() context: AuthorizationContext) {
    return context.accessibleHotels;
  }
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('access.read')
  @ApiOkResponse({ description: 'Roles defined for the current organization.' })
  async list(@CurrentAuthorization() context: AuthorizationContext) {
    return this.prisma.role.findMany({
      where: { organizationId: context.organization.id },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        hotelId: true,
        permissions: { select: { permission: { select: { resource: true, action: true } } } },
      },
      orderBy: [{ hotelId: 'asc' }, { name: 'asc' }],
    }).then((roles) => roles.map(({ permissions, ...role }) => ({
      ...role,
      permissions: permissions.map(({ permission }) => `${permission.resource}.${permission.action}`).sort(),
    })));
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  @Get('me')
  @RequirePermissions('organization.read')
  @ApiOkResponse({ description: 'Effective permissions in the current deployment organization.' })
  me(@CurrentAuthorization() context: AuthorizationContext) {
    return context.permissions;
  }
}
