import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma, type HotelRoom } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthorizationContextService } from '../authorization/authorization-context.service';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';

const reservationInclude = {
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  room: { select: { id: true, number: true, floor: true, status: true } },
  category: { select: { id: true, name: true, capacity: true } },
} as const;
const blockingStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN'] as const;
const manualRoomTransitions: Record<HotelRoom['status'], HotelRoom['status'][]> = {
  AVAILABLE: ['DIRTY', 'MAINTENANCE', 'OUT_OF_SERVICE'],
  RESERVED: [],
  OCCUPIED: [],
  DIRTY: ['CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'],
  CLEANING: ['INSPECTED', 'DIRTY'],
  INSPECTED: ['AVAILABLE', 'DIRTY'],
  MAINTENANCE: ['DIRTY', 'OUT_OF_SERVICE'],
  OUT_OF_SERVICE: ['DIRTY', 'MAINTENANCE'],
};
type DateRange = { checkIn: string; checkOut: string };

function parseDateRange(input: DateRange) {
  const checkIn = new Date(`${input.checkIn}T00:00:00.000Z`);
  const checkOut = new Date(`${input.checkOut}T00:00:00.000Z`);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) ||
      checkIn.toISOString().slice(0, 10) !== input.checkIn || checkOut.toISOString().slice(0, 10) !== input.checkOut || checkOut <= checkIn) {
    throw new BadRequestException('Check-out must be after check-in using valid calendar dates.');
  }
  if (input.checkIn < new Date().toISOString().slice(0, 10)) throw new BadRequestException('Check-in cannot be in the past.');
  const nights = (checkOut.getTime() - checkIn.getTime()) / 86_400_000;
  return { checkIn, checkOut, nights };
}

function isOverlapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2004', 'P2010'].includes(error.code)) {
    const meta = JSON.stringify(error.meta ?? {});
    return meta.includes('HotelReservation_room_date_no_overlap') || meta.toLowerCase().includes('exclusion constraint');
  }
  return false;
}

@Injectable()
export class HotelOperationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationContextService,
  ) {}

  private organizationId() {
    const organizationId = this.config.get<string>('app.tenantOrganizationId');
    if (!organizationId) throw new ForbiddenException('Tenant context is unavailable.');
    return organizationId;
  }

  private assertHotel(context: AuthorizationContext, hotelId: string) {
    this.authorization.assertHotelAccess(context, hotelId);
    return this.organizationId();
  }

  private async audit(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, actor: AuthenticatedIdentity,
    correlationId: string, action: string, resource: string, resourceId: string, metadata?: Prisma.InputJsonValue) {
    await tx.auditEvent.create({ data: {
      organizationId, hotelId, actorUserId: actor.identityId, correlationId, action, resource, resourceId,
      ...(metadata ? { metadata } : {}),
    } });
  }

  async listCategories(context: AuthorizationContext, hotelId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.roomCategory.findMany({ where: { organizationId, hotelId }, orderBy: { name: 'asc' } });
  }

  async createCategory(context: AuthorizationContext, hotelId: string, input: {
    name: string; description?: string; basePrice: number; capacity: number; bedConfiguration: string; amenities: string[];
  }, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const hotel = await this.prisma.hotel.findFirst({ where: { id: hotelId, organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.roomCategory.create({ data: { organizationId, hotelId, ...input } });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.room-category.created', 'room-category', category.id);
      return category;
    });
  }

  async listRooms(context: AuthorizationContext, hotelId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.hotelRoom.findMany({
      where: { organizationId, hotelId }, include: { category: true }, orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  async createRoom(context: AuthorizationContext, hotelId: string, input: { number: string; floor: number; categoryId: string },
    actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const hotel = await this.prisma.hotel.findFirst({ where: { id: hotelId, organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!hotel) throw new NotFoundException('Hotel not found.');
    const category = await this.prisma.roomCategory.findFirst({ where: { id: input.categoryId, organizationId, hotelId }, select: { id: true } });
    if (!category) throw new NotFoundException('Room category not found.');
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoom.create({ data: { organizationId, hotelId, ...input }, include: { category: true } });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.room.created', 'hotel-room', room.id);
      return room;
    });
  }

  async updateRoom(context: AuthorizationContext, hotelId: string, roomId: string,
    input: { number: string; floor: number; categoryId: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const category = await this.prisma.roomCategory.findFirst({ where: { id: input.categoryId, organizationId, hotelId }, select: { id: true } });
    if (!category) throw new NotFoundException('Room category not found.');
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId, hotelId }, select: { id: true, number: true, floor: true, categoryId: true } });
      if (!room) throw new NotFoundException('Room not found.');
      const updated = await tx.hotelRoom.update({ where: { id: room.id }, data: input, include: { category: true } });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.room.updated', 'hotel-room', room.id,
        { fromNumber: room.number, toNumber: input.number, fromCategoryId: room.categoryId, toCategoryId: input.categoryId });
      return updated;
    });
  }

  async availability(context: AuthorizationContext, hotelId: string, range: DateRange, categoryId?: string, guests?: number) {
    const organizationId = this.assertHotel(context, hotelId);
    const { checkIn, checkOut } = parseDateRange(range);
    const rooms = await this.prisma.hotelRoom.findMany({
      where: {
        organizationId, hotelId,
        status: { in: ['AVAILABLE', 'INSPECTED'] },
        ...(categoryId ? { categoryId } : {}),
        ...(guests ? { category: { capacity: { gte: guests } } } : {}),
        reservations: { none: { status: { in: [...blockingStatuses] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } },
      },
      include: { category: true }, orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
    return rooms;
  }

  async updateRoomStatus(context: AuthorizationContext, hotelId: string, roomId: string,
    status: 'AVAILABLE' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE',
    actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId, hotelId } });
      if (!room) throw new NotFoundException('Room not found.');
      if (!manualRoomTransitions[room.status].includes(status)) {
        throw new ConflictException(`A ${room.status.toLowerCase().replaceAll('_', ' ')} room cannot be changed to ${status.toLowerCase().replaceAll('_', ' ')}.`);
      }
      const update = await tx.hotelRoom.update({ where: { id: room.id }, data: { status } });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.room.status-changed', 'hotel-room', room.id, { from: room.status, to: status });
      return update;
    });
  }

  async listGuests(context: AuthorizationContext, hotelId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.hotelGuest.findMany({ where: { organizationId, hotelId }, orderBy: { fullName: 'asc' }, take: 500 });
  }

  async createGuest(context: AuthorizationContext, hotelId: string, input: {
    fullName: string; email?: string; phone?: string; nationality?: string; notes?: string;
  }, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const hotel = await this.prisma.hotel.findFirst({ where: { id: hotelId, organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.hotelGuest.create({ data: { organizationId, hotelId, ...input } });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.guest.created', 'hotel-guest', guest.id);
      return guest;
    });
  }

  async updateGuest(context: AuthorizationContext, hotelId: string, guestId: string, input: {
    fullName: string; email?: string; phone?: string; nationality?: string; notes?: string;
  }, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.hotelGuest.findFirst({ where: { id: guestId, organizationId, hotelId }, select: { id: true, fullName: true } });
      if (!guest) throw new NotFoundException('Guest not found.');
      const updated = await tx.hotelGuest.update({ where: { id: guest.id }, data: input });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.guest.updated', 'hotel-guest', guest.id,
        { fromName: guest.fullName, toName: input.fullName });
      return updated;
    });
  }

  async listReservations(context: AuthorizationContext, hotelId: string, from?: string, to?: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const whereRange = from && to ? parseDateRange({ checkIn: from, checkOut: to }) : undefined;
    return this.prisma.hotelReservation.findMany({
      where: { organizationId, hotelId, ...(whereRange ? { checkIn: { lt: whereRange.checkOut }, checkOut: { gt: whereRange.checkIn } } : {}) },
      include: reservationInclude, orderBy: [{ checkIn: 'asc' }, { createdAt: 'desc' }], take: 500,
    });
  }

  async getReservation(context: AuthorizationContext, hotelId: string, reservationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const reservation = await this.prisma.hotelReservation.findFirst({
      where: { id: reservationId, organizationId, hotelId }, include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('Reservation not found.');
    return reservation;
  }

  async createReservation(context: AuthorizationContext, hotelId: string, input: {
    roomId: string; guestId: string; checkIn: string; checkOut: string; adults: number; children: number;
    status?: 'PENDING' | 'CONFIRMED'; notes?: string;
  }, idempotencyKey: string | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const { checkIn, checkOut, nights } = parseDateRange(input);
    if (!input.adults || input.adults < 1 || input.children < 0) throw new BadRequestException('At least one adult is required and child count cannot be negative.');
    if (idempotencyKey && (idempotencyKey.length > 100 || !/^[a-zA-Z0-9._:-]+$/.test(idempotencyKey))) {
      throw new BadRequestException('Idempotency key must be 1–100 safe characters.');
    }
    const [hotel, room, guest] = await Promise.all([
      this.prisma.hotel.findFirst({ where: { id: hotelId, organizationId, status: 'ACTIVE' }, select: { id: true } }),
      this.prisma.hotelRoom.findFirst({ where: { id: input.roomId, organizationId, hotelId }, include: { category: true } }),
      this.prisma.hotelGuest.findFirst({ where: { id: input.guestId, organizationId, hotelId }, select: { id: true } }),
    ]);
    if (!hotel) throw new NotFoundException('Hotel not found.');
    if (!room) throw new NotFoundException('Room not found.');
    if (!guest) throw new NotFoundException('Guest not found.');
    if (!['AVAILABLE', 'INSPECTED'].includes(room.status)) throw new ConflictException('Room is not ready to be reserved.');
    if (input.adults + input.children > room.category.capacity) throw new BadRequestException('Guest count exceeds this room category capacity.');
    const nightlyRate = room.category.basePrice;
    const total = nightlyRate * nights;
    if (!Number.isSafeInteger(total) || total > 2_147_483_647) throw new BadRequestException('Reservation total is outside the supported range.');
    const status = input.status ?? 'CONFIRMED';
    const makeReference = () => `HOS-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${room.id}))`;
        if (idempotencyKey) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${hotelId}:${idempotencyKey}`}))`;
          const previous = await tx.hotelReservation.findUnique({ where: { hotelId_idempotencyKey: { hotelId, idempotencyKey } }, include: reservationInclude });
          if (previous) {
            const sameRequest = previous.roomId === input.roomId && previous.guestId === input.guestId &&
              previous.checkIn.getTime() === checkIn.getTime() && previous.checkOut.getTime() === checkOut.getTime() &&
              previous.adults === input.adults && previous.children === input.children && previous.status === status;
            if (!sameRequest) throw new ConflictException('Idempotency key was already used for a different reservation request.');
            return previous;
          }
        }
        const overlap = await tx.hotelReservation.findFirst({
          where: { organizationId, hotelId, roomId: room.id, status: { in: [...blockingStatuses] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
          select: { id: true },
        });
        if (overlap) throw new ConflictException('Room is not available for the selected dates.');
        const reservation = await tx.hotelReservation.create({
          data: {
            organizationId, hotelId, roomId: room.id, guestId: guest.id, categoryId: room.categoryId,
            reference: makeReference(), status, checkIn, checkOut, adults: input.adults, children: input.children,
            nightlyRate, total, notes: input.notes, ...(idempotencyKey ? { idempotencyKey } : {}),
          }, include: reservationInclude,
        });
        await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.reservation.created', 'hotel-reservation', reservation.id,
          { reference: reservation.reference, status, roomId: room.id });
        return reservation;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isOverlapError(error)) throw new ConflictException('Room is not available for the selected dates.');
      throw error;
    }
  }

  async modifyReservation(context: AuthorizationContext, hotelId: string, reservationId: string, input: {
    roomId: string; checkIn: string; checkOut: string; adults: number; children: number; notes?: string;
  }, actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    const { checkIn, checkOut, nights } = parseDateRange(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.hotelReservation.findFirst({ where: { id: reservationId, organizationId, hotelId } });
      if (!current) throw new NotFoundException('Reservation not found.');
      if (!['PENDING', 'CONFIRMED'].includes(current.status)) throw new ConflictException('Only pending or confirmed reservations can be modified.');
      const room = await tx.hotelRoom.findFirst({ where: { id: input.roomId, organizationId, hotelId }, include: { category: true } });
      if (!room) throw new NotFoundException('Room not found.');
      if (!['AVAILABLE', 'INSPECTED'].includes(room.status)) throw new ConflictException('Room is not ready to be reserved.');
      if (input.adults < 1 || input.children < 0 || input.adults + input.children > room.category.capacity) throw new BadRequestException('Guest count is invalid for this room category.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${room.id}))`;
      const conflict = await tx.hotelReservation.findFirst({
        where: { organizationId, hotelId, roomId: room.id, id: { not: current.id }, status: { in: [...blockingStatuses] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Room is not available for the selected dates.');
      const nightlyRate = room.categoryId === current.categoryId ? current.nightlyRate : room.category.basePrice;
      const total = nightlyRate * nights;
      if (!Number.isSafeInteger(total) || total > 2_147_483_647) throw new BadRequestException('Reservation total is outside the supported range.');
      const updated = await tx.hotelReservation.update({
        where: { id: current.id }, data: { roomId: room.id, categoryId: room.categoryId, checkIn, checkOut,
          adults: input.adults, children: input.children, nightlyRate, total, notes: input.notes }, include: reservationInclude,
      });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.reservation.modified', 'hotel-reservation', current.id,
        { fromRoomId: current.roomId, toRoomId: room.id });
      return updated;
    }).catch((error: unknown) => {
      if (isOverlapError(error)) throw new ConflictException('Room is not available for the selected dates.');
      throw error;
    });
  }

  async changeReservationStatus(context: AuthorizationContext, hotelId: string, reservationId: string,
    status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW', actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservationId}))`;
      const current = await tx.hotelReservation.findFirst({ where: { id: reservationId, organizationId, hotelId }, include: { room: true } });
      if (!current) throw new NotFoundException('Reservation not found.');
      const today = new Date().toISOString().slice(0, 10);
      if (status === 'CONFIRMED') {
        if (current.status !== 'PENDING') throw new ConflictException('Only pending reservations can be confirmed.');
      } else if (status === 'CHECKED_IN') {
        if (!['PENDING', 'CONFIRMED'].includes(current.status) || today < current.checkIn.toISOString().slice(0, 10) || today >= current.checkOut.toISOString().slice(0, 10)) {
          throw new ConflictException('Reservation is not eligible for check-in today.');
        }
        if (!['AVAILABLE', 'INSPECTED'].includes(current.room.status)) throw new ConflictException('Room is not ready for check-in.');
        await tx.hotelRoom.update({ where: { id: current.room.id }, data: { status: 'OCCUPIED' } });
      } else if (status === 'CHECKED_OUT') {
        if (current.status !== 'CHECKED_IN') throw new ConflictException('Only checked-in reservations can check out.');
        await tx.hotelRoom.update({ where: { id: current.room.id }, data: { status: 'DIRTY' } });
      } else if (status === 'CANCELLED') {
        if (!['PENDING', 'CONFIRMED'].includes(current.status)) throw new ConflictException('Only pending or confirmed reservations can be cancelled.');
      } else if (status === 'NO_SHOW') {
        if (current.status !== 'CONFIRMED' || today < current.checkIn.toISOString().slice(0, 10)) throw new ConflictException('Reservation cannot be marked no-show yet.');
      }
      const updated = await tx.hotelReservation.update({ where: { id: current.id }, data: { status }, include: reservationInclude });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, `hotel.reservation.${status.toLowerCase()}`,
        'hotel-reservation', current.id, { reference: current.reference });
      return updated;
    });
  }

  async transferRoom(context: AuthorizationContext, hotelId: string, reservationId: string, targetRoomId: string,
    actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.assertHotel(context, hotelId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.hotelReservation.findFirst({ where: { id: reservationId, organizationId, hotelId }, include: { room: true } });
        if (!current) throw new NotFoundException('Reservation not found.');
        if (current.status !== 'CHECKED_IN') throw new ConflictException('Only an in-house reservation can transfer rooms.');
        const target = await tx.hotelRoom.findFirst({ where: { id: targetRoomId, organizationId, hotelId } });
        if (!target) throw new NotFoundException('Room not found.');
        if (!['AVAILABLE', 'INSPECTED'].includes(target.status)) throw new ConflictException('Target room is not ready.');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${target.id}))`;
        await tx.hotelRoom.update({ where: { id: current.room.id }, data: { status: 'DIRTY' } });
        await tx.hotelRoom.update({ where: { id: target.id }, data: { status: 'OCCUPIED' } });
        const updated = await tx.hotelReservation.update({ where: { id: current.id }, data: { roomId: target.id, categoryId: target.categoryId }, include: reservationInclude });
        await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.reservation.room-transferred',
          'hotel-reservation', current.id, { fromRoomId: current.roomId, toRoomId: target.id });
        return updated;
      });
    } catch (error) {
      if (isOverlapError(error)) throw new ConflictException('Target room is unavailable for this stay.');
      throw error;
    }
  }
}
