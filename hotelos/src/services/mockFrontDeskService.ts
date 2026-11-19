import { categoryById } from '@/data/roomCatalog';
import { useHotelStore } from '@/store/useHotelStore';
import { addDays, nightsBetween, today } from '@/utils/demoClock';
import { computeFolio, invoiceNumber } from '@/utils/folio';
import { isRoomBookable } from '@/utils/reservationRules';
import { recomputeRoomStatus } from '@/utils/roomRules';
import type { PaymentMethod, Reservation, Result } from '@/types';
import { delay } from './delay';
import { ensureTaskForRoom } from './mockHousekeepingService';
import { addCharge, recordPayment, syncPaid } from './mockPaymentService';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/** MOCK SERVICE — backend integration point for check-in, check-out and room moves. */

export const EARLY_CHECK_IN_RATE = 0.25; // of the nightly rate
export const LATE_CHECK_OUT_RATE = 0.5;

const READY = ['available', 'inspected'];

function relink(roomIds: string[]) {
  const { reservations, setRooms } = useHotelStore.getState();
  setRooms((rs) => rs.map((r) => (roomIds.includes(r.id) ? { ...r, status: recomputeRoomStatus(r, reservations, today()) } : r)));
}

export interface CheckInInput {
  reservationId: string;
  roomId?: string;
  earlyCheckIn?: boolean;
  payment?: { amount: number; method: PaymentMethod };
}

export async function checkIn(input: CheckInInput): Promise<Result<Reservation>> {
  if (backendMode) {
    const current = useHotelStore.getState().reservations.find((r) => r.id === input.reservationId);
    if (!current) return { ok: false, error: 'Reservation not found.' };
    const targetRoomId = input.roomId ?? current.roomId;
    if (targetRoomId !== current.roomId) {
      const moved = await backendOperations.modifyReservation(current.hotelId, current.id, {
        roomId: targetRoomId, checkIn: current.checkIn, checkOut: current.checkOut,
        adults: current.adults, children: current.children, notes: current.notes,
      });
      if (!moved.ok) return moved;
    }
    return backendOperations.changeReservationStatus(current.hotelId, current.id, 'CHECKED_IN');
  }
  await delay(500);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  if (res.status !== 'pending' && res.status !== 'confirmed') return { ok: false, error: 'Only pending or confirmed reservations can be checked in.' };
  const t = today();
  if (res.checkIn > t) return { ok: false, error: 'This guest is not due until a later date.' };
  if (res.checkOut <= t) return { ok: false, error: 'This stay has already ended.' };

  const roomId = input.roomId ?? res.roomId;
  const room = s.rooms.find((r) => r.id === roomId);
  if (!room || room.hotelId !== res.hotelId) return { ok: false, error: 'Choose a room at the guest’s property.' };
  const own = roomId === res.roomId;
  if (!(READY.includes(room.status) || (own && room.status === 'reserved'))) {
    return { ok: false, error: `Room ${room.number} is not ready (${room.status.replace('_', ' ')}). Assign a ready room.` };
  }
  if (!own && !isRoomBookable(room, s.reservations, res.checkIn, res.checkOut, res.id)) return { ok: false, error: `Room ${room.number} is booked for part of this stay.` };

  const oldRoomId = res.roomId;
  const updated: Reservation = { ...res, status: 'checked_in', roomId, categoryId: room.categoryId };
  s.setReservations((rs) => rs.map((r) => (r.id === res.id ? updated : r)));
  s.setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, status: 'occupied' } : r)));
  relink([oldRoomId]);

  const guest = s.guests.find((g) => g.id === res.guestId);
  s.log(`${guest?.fullName} checked in to room ${room.number}`, 'booking');
  if (input.earlyCheckIn) await addCharge({ reservationId: res.id, category: 'other', description: 'Early check-in fee', amount: Math.round(res.nightlyRate * EARLY_CHECK_IN_RATE) });
  if (input.payment && input.payment.amount > 0) {
    const p = await recordPayment({ reservationId: res.id, ...input.payment });
    if (!p.ok) return { ok: false, error: `Checked in, but the payment failed: ${p.error}` };
  }
  return { ok: true, value: useHotelStore.getState().reservations.find((r) => r.id === res.id)! };
}

/** The reservation as it will stand after check-out: early departures are shortened (minimum one night). */
export function projectedCheckoutReservation(res: Reservation): Reservation {
  const t = today();
  if (res.checkOut <= t) return res;
  const newOut = t > addDays(res.checkIn, 1) ? t : addDays(res.checkIn, 1);
  const subtotal = res.nightlyRate * nightsBetween(res.checkIn, newOut);
  const taxAmount = Math.round(subtotal * (res.roomTaxRate ?? 0) / 100);
  const serviceAmount = Math.round(subtotal * (res.roomServiceChargeRate ?? 0) / 100);
  return { ...res, checkOut: newOut, total: subtotal + taxAmount + serviceAmount };
}

export interface CheckOutResult { reservation: Reservation; invoiceNumber: string; shortened: boolean }

export async function checkOut(input: { reservationId: string; payment?: { amount: number; method: PaymentMethod } }): Promise<Result<CheckOutResult>> {
  if (backendMode) {
    const current = useHotelStore.getState().reservations.find((r) => r.id === input.reservationId);
    if (!current) return { ok: false, error: 'Reservation not found.' };
    const saved = await backendOperations.changeReservationStatus(current.hotelId, current.id, 'CHECKED_OUT');
    return saved.ok ? { ok: true, value: { reservation: saved.value, invoiceNumber: '', shortened: false } } : saved;
  }
  await delay(500);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  if (res.status !== 'checked_in') return { ok: false, error: 'Only in-house guests can be checked out.' };
  const t = today();

  // early departure shortens the stay; same-day departure is billed as one night
  const shortened = res.checkOut > t;
  const adjusted = projectedCheckoutReservation(res);
  s.setReservations((rs) => rs.map((r) => (r.id === res.id ? adjusted : r)));

  if (adjusted.checkOut !== res.checkOut) {
    const roomSubtotal = adjusted.nightlyRate * nightsBetween(adjusted.checkIn, adjusted.checkOut);
    const service = Math.round(roomSubtotal * (adjusted.roomServiceChargeRate ?? 0) / 100);
    const tax = Math.round(roomSubtotal * (adjusted.roomTaxRate ?? 0) / 100);
    s.setCharges((charges) => [
      ...charges.filter((c) => !(c.reservationId === res.id && c.category === 'other' && ['Tax', 'Service charge'].includes(c.description))),
      ...(tax ? [{ id: `${res.id}-tax`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, category: 'other' as const, description: 'Tax', amount: tax, date: t }] : []),
      ...(service ? [{ id: `${res.id}-service`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, category: 'other' as const, description: 'Service charge', amount: service, date: t }] : []),
    ]);
    adjusted.total = roomSubtotal + service + tax;
    s.setReservations((rs) => rs.map((r) => (r.id === res.id ? adjusted : r)));
  }

  if (input.payment && input.payment.amount > 0) {
    const p = await recordPayment({ reservationId: res.id, ...input.payment });
    if (!p.ok) {
      s.setReservations((rs) => rs.map((r) => (r.id === res.id ? res : r)));
      if (adjusted.checkOut !== res.checkOut) s.setCharges((charges) => charges.filter((c) => !(c.reservationId === res.id && c.category === 'other' && ['Tax', 'Service charge'].includes(c.description))));
      return { ok: false, error: p.error };
    }
  }

  const after = useHotelStore.getState();
  const folio = computeFolio(adjusted, after.charges, after.payments, after.refunds);
  if (folio.balance > 0) {
    after.setReservations((rs) => rs.map((r) => (r.id === res.id ? res : r)));
    if (adjusted.checkOut !== res.checkOut) after.setCharges((charges) => charges.filter((c) => !(c.reservationId === res.id && c.category === 'other' && ['Tax', 'Service charge'].includes(c.description))));
    return { ok: false, error: `Outstanding balance of ${folio.balance.toLocaleString('en-NG')} must be settled before check-out.` };
  }
  if (folio.balance < 0) {
    // stay was shortened and the guest has overpaid — queue the difference as a refund request
    const n = String(Math.max(0, ...after.refunds.map((r) => Number(r.id.replace('rf-', '')) || 0)) + 1).padStart(3, '0');
    after.setRefunds((rs) => [{ id: `rf-${n}`, reference: `RFD-${t.slice(2, 4)}${t.slice(5, 7)}-${n}`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, amount: -folio.balance, reason: 'Early departure — overpayment', status: 'pending', requestedAt: t }, ...rs]);
  }
  const done: Reservation = { ...adjusted, status: 'checked_out' };
  after.setReservations((rs) => rs.map((r) => (r.id === res.id ? done : r)));
  after.setRooms((rs) => rs.map((r) => (r.id === res.roomId ? { ...r, status: 'dirty' } : r)));
  syncPaid(res.id);
  ensureTaskForRoom(res.roomId, 'Turnover after check-out.');
  const room = after.rooms.find((r) => r.id === res.roomId);
  const guest = after.guests.find((g) => g.id === res.guestId);
  after.log(`${guest?.fullName} checked out of room ${room?.number}; room marked dirty`, 'booking');
  return { ok: true, value: { reservation: useHotelStore.getState().reservations.find((r) => r.id === res.id)!, invoiceNumber: invoiceNumber(done, t), shortened } };
}

export async function transferRoom(input: { reservationId: string; newRoomId: string; reason: string }): Promise<Result<Reservation>> {
  if (backendMode) {
    const current = useHotelStore.getState().reservations.find((r) => r.id === input.reservationId);
    if (!current) return { ok: false, error: 'Reservation not found.' };
    if (!input.reason.trim()) return { ok: false, error: 'Give a reason for the transfer.' };
    return backendOperations.transferRoom(current.hotelId, current.id, input.newRoomId);
  }
  await delay(400);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res || res.status !== 'checked_in') return { ok: false, error: 'Only in-house guests can be moved.' };
  if (!input.reason.trim()) return { ok: false, error: 'Give a reason for the transfer.' };
  const room = s.rooms.find((r) => r.id === input.newRoomId);
  if (!room || room.hotelId !== res.hotelId) return { ok: false, error: 'Choose a room at the same property.' };
  if (room.id === res.roomId) return { ok: false, error: 'The guest is already in this room.' };
  if (!READY.includes(room.status)) return { ok: false, error: `Room ${room.number} is not ready (${room.status.replace('_', ' ')}).` };
  if (!isRoomBookable(room, s.reservations, today(), res.checkOut, res.id)) return { ok: false, error: `Room ${room.number} is booked during the rest of this stay.` };

  const oldId = res.roomId;
  const updated: Reservation = { ...res, roomId: room.id, categoryId: room.categoryId };
  s.setReservations((rs) => rs.map((r) => (r.id === res.id ? updated : r)));
  s.setRooms((rs) => rs.map((r) => (r.id === oldId ? { ...r, status: 'dirty' } : r.id === room.id ? { ...r, status: 'occupied' } : r)));
  ensureTaskForRoom(oldId, 'Vacated after room transfer.');
  const oldRoom = s.rooms.find((r) => r.id === oldId);
  const guest = s.guests.find((g) => g.id === res.guestId);
  s.log(`${guest?.fullName} moved from room ${oldRoom?.number} to ${room.number}`, 'room');
  return { ok: true, value: updated };
}

export async function postLateCheckOut(reservationId: string): Promise<Result<true>> {
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === reservationId);
  if (!res || res.status !== 'checked_in') return { ok: false, error: 'Only in-house guests can have a late check-out.' };
  if (s.charges.some((c) => c.reservationId === reservationId && c.description === 'Late check-out fee')) return { ok: false, error: 'A late check-out has already been arranged for this guest.' };
  const r = await addCharge({ reservationId, category: 'other', description: 'Late check-out fee', amount: Math.round(res.nightlyRate * LATE_CHECK_OUT_RATE) });
  return r.ok ? { ok: true, value: true } : r;
}

export const roomCategoryName = (categoryId: string) => categoryById(categoryId).name;
