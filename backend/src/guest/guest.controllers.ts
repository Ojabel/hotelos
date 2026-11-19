import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { CurrentAuthorization, CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedIdentity, AuthorizationContext, AuthenticatedRequest } from '../auth/auth.types';
import { GuestAuthService } from './guest-auth.service';

class ResolveGuestDto {
  @IsString() @MinLength(2) @MaxLength(200) fullName!: string;
}
class UpdateGuestProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) preferences?: string[];
}
class GuestServiceRequestDto {
  @IsOptional() @IsUUID() hotelId?: string;
  @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @IsString() @MinLength(5) @MaxLength(1000) description!: string;
}
class StaffLinkDto {
  @IsUUID() hotelId!: string;
  @IsUUID() guestId!: string;
  @IsUUID() identityId!: string;
  @IsIn(['IN_PERSON_ID', 'RESERVATION_VERIFICATION', 'MANAGER_REVIEW']) verificationMethod!: 'IN_PERSON_ID' | 'RESERVATION_VERIFICATION' | 'MANAGER_REVIEW';
  @IsString() @MinLength(4) @MaxLength(100) verificationCaseReference!: string;
}

@Injectable()
export class GuestIdentityGuard implements CanActivate {
  constructor(private readonly guest: GuestAuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.identity) throw new UnauthorizedException('Authenticated identity required.');
    await this.guest.assertGuestRequest(request.identity);
    return true;
  }
}

function correlationId(request: Request) { return typeof request.id === 'string' ? request.id : 'unknown'; }

@ApiTags('guest portal')
@ApiBearerAuth()
@Controller('guest')
export class GuestController {
  constructor(private readonly guest: GuestAuthService) {}

  @Post('account/resolve')
  resolve(@Body() body: ResolveGuestDto, @CurrentUser() identity: AuthenticatedIdentity, @Req() request: Request) {
    return this.guest.resolve(identity, body.fullName, correlationId(request));
  }

  @Get('me')
  @UseGuards(GuestIdentityGuard)
  me(@CurrentUser() identity: AuthenticatedIdentity) { return this.guest.me(identity); }

  @Patch('me')
  @UseGuards(GuestIdentityGuard)
  update(@Body() body: UpdateGuestProfileDto, @CurrentUser() identity: AuthenticatedIdentity) { return this.guest.updateProfile(identity, body); }

  @Get('reservations')
  @UseGuards(GuestIdentityGuard)
  reservations(@CurrentUser() identity: AuthenticatedIdentity) { return this.guest.reservations(identity); }

  @Get('reservations/:id')
  @UseGuards(GuestIdentityGuard)
  reservation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() identity: AuthenticatedIdentity) { return this.guest.reservation(identity, id); }

  @Post('reservations/:id/cancel')
  @UseGuards(GuestIdentityGuard)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() identity: AuthenticatedIdentity) { return this.guest.cancel(identity, id); }

  @Get('service-requests')
  @UseGuards(GuestIdentityGuard)
  serviceRequests(@CurrentUser() identity: AuthenticatedIdentity) { return this.guest.serviceRequests(identity); }

  @Post('service-requests')
  @UseGuards(GuestIdentityGuard)
  createServiceRequest(@Body() body: GuestServiceRequestDto, @CurrentUser() identity: AuthenticatedIdentity) { return this.guest.createServiceRequest(identity, body); }

  @Post('identity-links/staff-verified')
  @RequirePermissions('guests.manage')
  linkExisting(@Body() body: StaffLinkDto, @CurrentUser() actor: AuthenticatedIdentity, @CurrentAuthorization() context: AuthorizationContext, @Req() request: Request) {
    return this.guest.linkByStaff(context, actor, body, correlationId(request));
  }
}
