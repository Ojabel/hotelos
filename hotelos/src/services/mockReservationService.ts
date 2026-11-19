import { categoryById } from '@/data/roomCatalog';
import { useHotelStore } from '@/store/useHotelStore';
import { addDays, nightsBetween, today } from '@/utils/demoClock';
import { findAvailableRooms, isRoomBookable } from '@/utils/reservationRules';
import { recomputeRoomStatus } from '@/utils/roomRules';
import type { IsoDate, PaymentMethod, Reservation, ReservationStatus, Result, Room } from '@/types';
import { delay } from './delay';
import { calculateConfiguredBreakdown, useAdminStore } from '@/store/useAdminStore';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/** MOCK SERVICE — backend integration point for bookings and availability. */

export interface AvailabilityQuery {
  hotelId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  categoryId?: string;
  guests?: number;
  /** Only rooms physically ready now (walk-ins). */
  readyNow?: boolean;
  ignoreReservationId?: string;
}

export async function checkAvailability(q: AvailabilityQuery): Promise<Room[]> {
  if (backendMode) return backendOperations.availability(q.hotelId, { checkIn: q.checkIn, checkOut: q.checkOut, categoryId: q.categoryId, guests: q.guests });
  await delay(450); // simulated availability lookup
  expirePendingHolds();
  const { rooms, reservations } = useHotelStore.getState();
  return findAvailableRooms(rooms, reservations, q, (id) => categoryById(id).capacity);
}

/** Releases expired public holds while retaining a visible reservation history record. */
export function expirePendingHolds(now = Date.now()): number {
  const s = useHotelStore.getState();
  const expired = s.reservations.filter((r) => r.status === 'pending' && r.holdExpiresAt && Date.parse(r.holdExpiresAt) <= now);
  if (!expired.length) return 0;
  const ids = new Set(expired.map((r) => r.id));
  s.setReservations((rs) => rs.map((r) => ids.has(r.id) ? { ...r, status: 'expired', notes: [r.notes, 'Public booking hold expired; reservation history retained.'].filter(Boolean).join(' ') } : r));
  relinkRooms(expired.map((r) => r.roomId));
  s.log(`${expired.length} public booking hold${expired.length === 1 ? '' : 's'} expired`, 'booking');
  return expired.length;
}

function configuredCharges(subtotal: number) {
  return calculateConfiguredBreakdown(subtotal);
}

function addConfiguredFolioCharges(reservationId: string, guestId: string, hotelId: string, subtotal: number, date: IsoDate, replaceExisting = false) {
  const s = useHotelStore.getState();
  const existing = s.charges.filter((c) => c.reservationId === reservationId && c.category === 'other' && (c.description === 'Tax' || c.description === 'Service charge'));
  const parts = configuredCharges(subtotal);
  s.setCharges((charges) => [
    ...charges.filter((c) => !replaceExisting || !existing.some((e) => e.id === c.id)),
    ...(parts.taxAmount > 0 ? [{ id: `${reservationId}-tax`, reservationId, guestId, hotelId, category: 'other' as const, description: 'Tax', amount: parts.taxAmount, date }] : []),
    ...(parts.serviceAmount > 0 ? [{ id: `${reservationId}-service`, reservationId, guestId, hotelId, category: 'other' as const, description: 'Service charge', amount: parts.serviceAmount, date }] : []),
  ]);
}

export interface ReservationInput {
  hotelId: string;
  roomId: string;
  guestId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  nightlyRate: number;
  deposit: number;
  method: PaymentMethod;
  status: Extract<ReservationStatus, 'pending' | 'confirmed' | 'checked_in'>;
  notes?: string;
  publicHold?: boolean;
}

function relinkRooms(roomIds: string[]) {
  const { reservations, setRooms } = useHotelStore.getState();
  setRooms((rs) => rs.map((r) => (roomIds.includes(r.id) ? { ...r, status: recomputeRoomStatus(r, reservations, today()) } : r)));
}

export async function createReservation(input: ReservationInput): Promise<Result<Reservation>> {
  if (backendMode) {
    const idempotencyKey = globalThis.crypto?.randomUUID?.();
    const created = await backendOperations.createReservation(input.hotelId, {
      roomId: input.roomId, guestId: input.guestId, checkIn: input.checkIn, checkOut: input.checkOut,
      adults: input.adults, children: input.children, status: input.status === 'pending' ? 'PENDING' : 'CONFIRMED', notes: input.notes,
    }, idempotencyKey);
    if (!created.ok || input.status !== 'checked_in') return created;
    return backendOperations.changeReservationStatus(input.hotelId, created.value.id, 'CHECKED_IN');
  }
  await delay(500);
  expirePendingHolds();
  const state = useHotelStore.getState();
  const room = state.rooms.find((r) => r.id === input.roomId);
  if (!room || room.hotelId !== input.hotelId) return { ok: false, error: 'Selected room is not part of this property.' };
  if (!state.guests.some((g) => g.id === input.guestId)) return { ok: false, error: 'Select or create a guest first.' };
  if (input.checkIn < today()) return { ok: false, error: 'Check-in cannot be in the past.' };
  if (input.checkOut <= input.checkIn) return { ok: false, error: 'Check-out must be after check-in.' };
  if (!isRoomBookable(room, state.reservations, input.checkIn, input.checkOut)) {
    return { ok: false, error: `Room ${room.number} is no longer available for these dates.` };
  }
  const cat = categoryById(room.categoryId);
  if (input.adults < 1 || input.adults + input.children > cat.capacity) return { ok: false, error: `${cat.name} sleeps up to ${cat.capacity} guests.` };
  if (input.status === 'checked_in' && (input.checkIn !== today() || !['available', 'inspected'].includes(room.status))) {
    return { ok: false, error: `Room ${room.number} is not ready for immediate check-in.` };
  }
  const subtotal = input.nightlyRate * nightsBetween(input.checkIn, input.checkOut);
  const total = configuredCharges(subtotal).total;
  if (input.deposit < 0 || input.deposit > total) return { ok: false, error: 'Deposit must be between zero and the total amount.' };

  const maxN = Math.max(0, ...state.reservations.map((r) => Number(r.id.replace('res-', '')) || 0));
  const n = String(maxN + 1).padStart(3, '0');
  const t = today();
  const holdMinutes = useAdminStore.getState().settings.preferences.bookingHoldMinutes;
  const publicHold = input.status === 'pending' && input.publicHold === true && holdMinutes > 0;
  const taxSettings = useAdminStore.getState().settings.tax;
  const reservation: Reservation = {
    id: `res-${n}`,
    reference: `HOS-${t.slice(2, 4)}${t.slice(5, 7)}-${n}`,
    guestId: input.guestId,
    hotelId: input.hotelId,
    roomId: input.roomId,
    categoryId: room.categoryId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    status: input.status,
    nightlyRate: input.nightlyRate,
    total,
    deposit: input.deposit,
    paid: input.deposit,
    createdAt: t,
    notes: input.notes,
    holdExpiresAt: publicHold ? new Date(Date.now() + holdMinutes * 60_000).toISOString() : undefined,
    roomTaxRate: taxSettings.active && taxSettings.applicable.includes('Room') && !taxSettings.inclusive ? taxSettings.percentage : 0,
    roomServiceChargeRate: taxSettings.active && taxSettings.applicable.includes('Room') ? taxSettings.serviceCharge : 0,
    roomTaxInclusive: taxSettings.inclusive,
  };
  state.setReservations((rs) => [reservation, ...rs]);
  addConfiguredFolioCharges(reservation.id, reservation.guestId, reservation.hotelId, subtotal, t);
  if (input.deposit > 0) {
    const pn = String(state.payments.length + 1).padStart(4, '0');
    state.addPayment({ id: `pay-${pn}`, reference: `PAY-${t.slice(2, 4)}${t.slice(5, 7)}-${pn}`, reservationId: reservation.id, guestId: input.guestId, hotelId: input.hotelId, amount: input.deposit, method: input.method, status: 'paid', date: t });
  }
  relinkRooms([room.id]);
  const guest = state.guests.find((g) => g.id === input.guestId)!;
  state.log(input.status === 'checked_in' ? `${guest.fullName} checked in to room ${room.number} (walk-in)` : `Reservation ${reservation.reference} created for ${guest.fullName}`, 'booking');
  return { ok: true, value: reservation };
}

export interface ReservationPatch { checkIn: IsoDate; checkOut: IsoDate; roomId: string; adults: number; children: number; notes?: string }

export async function modifyReservation(id: string, patch: ReservationPatch): Promise<Result<Reservation>> {
  if (backendMode) {
    const current = useHotelStore.getState().reservations.find((r) => r.id === id);
    if (!current) return { ok: false, error: 'Reservation not found.' };
    return backendOperations.modifyReservation(current.hotelId, id, patch);
  }
  await delay(400);
  expirePendingHolds();
  const state = useHotelStore.getState();
  const current = state.reservations.find((r) => r.id === id);
  if (!current) return { ok: false, error: 'Reservation not found.' };
  if (current.status !== 'pending' && current.status !== 'confirmed') return { ok: false, error: 'Only pending or confirmed reservations can be modified here.' };
  const room = state.rooms.find((r) => r.id === patch.roomId);
  if (!room || room.hotelId !== current.hotelId) return { ok: false, error: 'Choose a room at the same property.' };
  if (patch.checkIn < today()) return { ok: false, error: 'Check-in cannot be in the past.' };
  if (patch.checkOut <= patch.checkIn) return { ok: false, error: 'Check-out must be after check-in.' };
  if (!isRoomBookable(room, state.reservations, patch.checkIn, patch.checkOut, id)) return { ok: false, error: `Room ${room.number} is not available for these dates.` };
  const cat = categoryById(room.categoryId);
  if (patch.adults < 1 || patch.adults + patch.children > cat.capacity) return { ok: false, error: `${cat.name} sleeps up to ${cat.capacity} guests.` };

  const rate = room.categoryId === current.categoryId ? current.nightlyRate : cat.basePrice;
  const subtotal = rate * nightsBetween(patch.checkIn, patch.checkOut);
  const taxSettings = useAdminStore.getState().settings.tax;
  const updated: Reservation = { ...current, ...patch, categoryId: room.categoryId, nightlyRate: rate, total: configuredCharges(subtotal).total, roomTaxRate: taxSettings.active && taxSettings.applicable.includes('Room') && !taxSettings.inclusive ? taxSettings.percentage : 0, roomServiceChargeRate: taxSettings.active && taxSettings.applicable.includes('Room') ? taxSettings.serviceCharge : 0, roomTaxInclusive: taxSettings.inclusive };
  if (updated.paid > updated.total) return { ok: false, error: 'New total is lower than the amount already paid. Contact finance for a refund first.' };
  state.setReservations((rs) => rs.map((r) => (r.id === id ? updated : r)));
  addConfiguredFolioCharges(updated.id, updated.guestId, updated.hotelId, subtotal, today(), true);
  relinkRooms([current.roomId, updated.roomId]);
  state.log(`Reservation ${updated.reference} modified`, 'booking');
  return { ok: true, value: updated };
}

const ALLOWED: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'no_show'],
};

export async function setReservationStatus(id: string, status: ReservationStatus): Promise<Result<Reservation>> {
  if (backendMode) {
    const current = useHotelStore.getState().reservations.find((r) => r.id === id);
    if (!current) return { ok: false, error: 'Reservation not found.' };
    const mapped = { confirmed: 'CONFIRMED', checked_in: 'CHECKED_IN', checked_out: 'CHECKED_OUT', cancelled: 'CANCELLED', no_show: 'NO_SHOW' } as const;
    if (!(status in mapped)) return { ok: false, error: `The backend does not support changing a reservation to ${status}.` };
    return backendOperations.changeReservationStatus(current.hotelId, id, mapped[status as keyof typeof mapped]);
  }
  await delay(300);
  expirePendingHolds();
  const state = useHotelStore.getState();
  const current = state.reservations.find((r) => r.id === id);
  if (!current) return { ok: false, error: 'Reservation not found.' };
  if (current.status === 'pending' && current.holdExpiresAt && Date.parse(current.holdExpiresAt) <= Date.now()) {
    expirePendingHolds();
    return { ok: false, error: 'This booking hold expired. Please search availability and create a new reservation.' };
  }
  if (!(ALLOWED[current.status] ?? []).includes(status)) return { ok: false, error: 'That status change is not allowed for this reservation.' };
  if (status === 'no_show' && current.checkIn > today()) return { ok: false, error: 'A reservation can only be marked no-show on or after its arrival date.' };
  const updated = { ...current, status };
  state.setReservations((rs) => rs.map((r) => (r.id === id ? updated : r)));
  relinkRooms([current.roomId]);
  const label = status === 'confirmed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : 'marked no-show';
  state.log(`Reservation ${current.reference} ${label}`, 'booking');
  return { ok: true, value: updated };
}

export const earliestCheckOut = (checkIn: IsoDate) => addDays(checkIn, 1);
