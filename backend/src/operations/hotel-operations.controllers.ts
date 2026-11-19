import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { CurrentAuthorization, CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';
import { HotelOperationsService } from './hotel-operations.service';

class CreateRoomCategoryDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) basePrice!: number;
  @IsInt() @Min(1) @Max(1000) capacity!: number;
  @IsString() @MaxLength(200) bedConfiguration!: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) amenities!: string[];
}

class CreateRoomDto {
  @IsString() @MaxLength(30) number!: string;
  @IsInt() @Min(-10) @Max(300) floor!: number;
  @IsUUID() categoryId!: string;
}

class UpdateRoomDto extends CreateRoomDto {}

class RoomStatusDto {
  @IsIn(['AVAILABLE', 'DIRTY', 'CLEANING', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_SERVICE']) status!: 'AVAILABLE' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
}

class CreateGuestDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class UpdateGuestDto extends CreateGuestDto {}

class CreateReservationDto {
  @IsUUID() roomId!: string;
  @IsUUID() guestId!: string;
  @IsDateString({ strict: true }) @MaxLength(10) checkIn!: string;
  @IsDateString({ strict: true }) @MaxLength(10) checkOut!: string;
  @IsInt() @Min(1) @Max(1000) adults!: number;
  @IsInt() @Min(0) @Max(1000) children!: number;
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED']) status?: 'PENDING' | 'CONFIRMED';
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class ModifyReservationDto {
  @IsUUID() roomId!: string;
  @IsDateString({ strict: true }) @MaxLength(10) checkIn!: string;
  @IsDateString({ strict: true }) @MaxLength(10) checkOut!: string;
  @IsInt() @Min(1) @Max(1000) adults!: number;
  @IsInt() @Min(0) @Max(1000) children!: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class ReservationStatusDto {
  @IsIn(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']) status!: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
}

class TransferRoomDto { @IsUUID() targetRoomId!: string; }

function correlationId(request: Request) { return typeof request.id === 'string' ? request.id : 'unknown'; }

@ApiTags('hotel-operations')
@ApiBearerAuth()
@Controller('hotels/:hotelId')
export class HotelResourcesController {
  constructor(private readonly operations: HotelOperationsService) {}

  @Get('room-categories')
  @RequirePermissions('hotel.read')
  categories(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() context: AuthorizationContext) {
    return this.operations.listCategories(context, hotelId);
  }

  @Post('room-categories')
  @RequirePermissions('hotel.read', 'hotel.manage')
  createCategory(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateRoomCategoryDto,
    @CurrentAuthorization() context: AuthorizationContext, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.createCategory(context, hotelId, body, user, correlationId(request));
  }

  @Get('rooms')
  @RequirePermissions('hotel.read')
  rooms(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() context: AuthorizationContext) {
    return this.operations.listRooms(context, hotelId);
  }

  @Post('rooms')
  @RequirePermissions('hotel.read', 'hotel.manage')
  createRoom(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateRoomDto,
    @CurrentAuthorization() context: AuthorizationContext, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.createRoom(context, hotelId, body, user, correlationId(request));
  }

  @Patch('rooms/:roomId')
  @RequirePermissions('hotel.read', 'hotel.manage')
  updateRoom(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: UpdateRoomDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.updateRoom(context, hotelId, roomId, body, user, correlationId(request));
  }

  @Get('rooms/availability')
  @RequirePermissions('hotel.read', 'reservations.read')
  availability(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string, @Query('categoryId') categoryId: string | undefined,
    @Query('guests') guests: string | undefined, @CurrentAuthorization() context: AuthorizationContext) {
    const guestCount = guests === undefined ? undefined : Number(guests);
    if (guestCount !== undefined && (!Number.isInteger(guestCount) || guestCount < 1)) throw new BadRequestException('Invalid guest count.');
    return this.operations.availability(context, hotelId, { checkIn, checkOut }, categoryId, guestCount);
  }

  @Patch('rooms/:roomId/status')
  @RequirePermissions('hotel.read', 'housekeeping.manage')
  roomStatus(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: RoomStatusDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.updateRoomStatus(context, hotelId, roomId, body.status, user, correlationId(request));
  }

  @Get('guests')
  @RequirePermissions('hotel.read', 'guests.read')
  guests(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() context: AuthorizationContext) {
    return this.operations.listGuests(context, hotelId);
  }

  @Post('guests')
  @RequirePermissions('hotel.read', 'guests.manage')
  createGuest(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateGuestDto,
    @CurrentAuthorization() context: AuthorizationContext, @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.createGuest(context, hotelId, body, user, correlationId(request));
  }

  @Patch('guests/:guestId')
  @RequirePermissions('hotel.read', 'guests.manage')
  updateGuest(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('guestId', ParseUUIDPipe) guestId: string,
    @Body() body: UpdateGuestDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.updateGuest(context, hotelId, guestId, body, user, correlationId(request));
  }
}

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('hotels/:hotelId/reservations')
export class HotelReservationsController {
  constructor(private readonly operations: HotelOperationsService) {}

  @Get()
  @RequirePermissions('hotel.read', 'reservations.read')
  list(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Query('from') from: string | undefined,
    @Query('to') to: string | undefined, @CurrentAuthorization() context: AuthorizationContext) {
    return this.operations.listReservations(context, hotelId, from, to);
  }

  @Post()
  @RequirePermissions('hotel.read', 'reservations.manage')
  create(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.createReservation(context, hotelId, body, idempotencyKey, user, correlationId(request));
  }

  @Get(':reservationId')
  @RequirePermissions('hotel.read', 'reservations.read')
  get(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentAuthorization() context: AuthorizationContext) {
    return this.operations.getReservation(context, hotelId, reservationId);
  }

  @Patch(':reservationId')
  @RequirePermissions('hotel.read', 'reservations.manage')
  modify(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() body: ModifyReservationDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.modifyReservation(context, hotelId, reservationId, body, user, correlationId(request));
  }

  @Post(':reservationId/status')
  @RequirePermissions('hotel.read', 'reservations.manage')
  status(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() body: ReservationStatusDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.changeReservationStatus(context, hotelId, reservationId, body.status, user, correlationId(request));
  }

  @Post(':reservationId/transfer')
  @RequirePermissions('hotel.read', 'reservations.manage', 'frontdesk.manage')
  transfer(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() body: TransferRoomDto, @CurrentAuthorization() context: AuthorizationContext,
    @CurrentUser() user: AuthenticatedIdentity, @Req() request: Request) {
    return this.operations.transferRoom(context, hotelId, reservationId, body.targetRoomId, user, correlationId(request));
  }
}
