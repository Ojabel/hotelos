import { beforeEach, describe, expect, it } from 'vitest';
import { useHotelStore } from '@/store/useHotelStore';
import { computeFolio } from '@/utils/folio';
import { findAvailableRooms } from '@/utils/reservationRules';
import { DEMO_TODAY } from '@/utils/demoClock';
import { checkIn, checkOut, transferRoom } from './mockFrontDeskService';
import { confirmPendingPayment, folioFor, recordPayment, requestRefund, advanceRefund } from './mockPaymentService';
import { createReservation, expirePendingHolds } from './mockReservationService';
import { createGuest } from './mockGuestService';

const state = () => useHotelStore.getState();
const res = (id: string) => state().reservations.find((r) => r.id === id)!;
const room = (id: string) => state().rooms.find((r) => r.id === id)!;

beforeEach(() => state().reset());

describe('check-in', () => {
  it('checks in a confirmed arrival: reservation, room and activity update together', async () => {
    expect(room('rm-201').status).toBe('reserved');
    const r = await checkIn({ reservationId: 'res-004' });
    expect(r.ok).toBe(true);
    expect(res('res-004').status).toBe('checked_in');
    expect(room('rm-201').status).toBe('occupied');
    expect(state().activity[0].text).toContain('checked in to room 201');
  });

  it('refuses a room that is not ready, then succeeds with a ready room', async () => {
    expect(room('rm-303').status).toBe('dirty'); // res-010 arrives today into a dirty room
    const blocked = await checkIn({ reservationId: 'res-010' });
    expect(blocked.ok).toBe(false);
    expect(res('res-010').status).toBe('pending');

    const ready = findAvailableRooms(state().rooms, state().reservations, { hotelId: 'h-vi', checkIn: DEMO_TODAY, checkOut: res('res-010').checkOut, readyNow: true, ignoreReservationId: 'res-010' })[0];
    const ok = await checkIn({ reservationId: 'res-010', roomId: ready.id });
    expect(ok.ok).toBe(true);
    expect(res('res-010').roomId).toBe(ready.id);
    expect(room(ready.id).status).toBe('occupied');
    expect(room('rm-303').status).toBe('dirty');
  });

  it('refuses guests who are not due yet', async () => {
    const r = await checkIn({ reservationId: 'res-008' });
    expect(r.ok).toBe(false);
  });

  it('adds an early check-in fee to the folio', async () => {
    const before = folioFor('res-004')!.extrasTotal;
    await checkIn({ reservationId: 'res-004', earlyCheckIn: true });
    expect(folioFor('res-004')!.extrasTotal).toBeGreaterThan(before);
  });
});

describe('check-out', () => {
  it('blocks check-out while a balance is outstanding', async () => {
    const before = folioFor('res-006')!.balance;
    expect(before).toBeGreaterThan(0);
    const r = await checkOut({ reservationId: 'res-006' });
    expect(r.ok).toBe(false);
    expect(res('res-006').status).toBe('checked_in');
    expect(room('rm-203').status).toBe('occupied');
  });

  it('settles the balance, issues an invoice number and marks the room dirty', async () => {
    const balance = folioFor('res-006')!.balance;
    const r = await checkOut({ reservationId: 'res-006', payment: { amount: balance, method: 'pos' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.invoiceNumber).toMatch(/^INV-\d{4}-\d{3}$/);
    expect(res('res-006').status).toBe('checked_out');
    expect(room('rm-203').status).toBe('dirty');
    expect(folioFor('res-006')!.balance).toBe(0);
    expect(res('res-006').paid).toBe(res('res-006').total + folioFor('res-006')!.extrasTotal);
  });

  it('queues a refund request when an early departure leaves the guest overpaid', async () => {
    const r = await checkOut({ reservationId: 'res-002' }); // booked 3 nights, leaving after 1
    if (!r.ok) throw new Error(r.error);
    expect(r.value.shortened).toBe(true);
    const f = folioFor('res-002')!;
    expect(f.balance).toBeLessThanOrEqual(0);
    const rf = state().refunds.find((x) => x.reservationId === 'res-002');
    expect(rf?.status).toBe('pending');
    expect(rf?.amount).toBe(-computeFolio({ ...res('res-002') }, state().charges, state().payments, state().refunds).balance);
  });
});

describe('payments and refunds', () => {
  it('accepts partial payments and rejects overpayment', async () => {
    const start = folioFor('res-001')!;
    const over = await recordPayment({ reservationId: 'res-001', amount: start.balance + 1, method: 'cash' });
    expect(over.ok).toBe(false);
    const part = await recordPayment({ reservationId: 'res-001', amount: 50000, method: 'cash' });
    expect(part.ok).toBe(true);
    const after = folioFor('res-001')!;
    expect(after.balance).toBe(start.balance - 50000);
    expect(after.status).toBe('partially_paid');
    expect(res('res-001').paid).toBe(start.netPaid + 50000);
  });

  it('keeps pending transfers out of the balance until confirmed; failed payments never count', async () => {
    const start = folioFor('res-001')!.balance;
    const p = await recordPayment({ reservationId: 'res-001', amount: 40000, method: 'bank_transfer', outcome: 'pending' });
    const failed = await recordPayment({ reservationId: 'res-001', amount: 40000, method: 'online', outcome: 'failed' });
    expect(p.ok && failed.ok).toBe(true);
    expect(folioFor('res-001')!.balance).toBe(start);
    if (p.ok) await confirmPendingPayment(p.value.id);
    expect(folioFor('res-001')!.balance).toBe(start - 40000);
  });

  it('moves a refund through approval and processing and reconciles the booking', async () => {
    const pending = state().refunds.find((r) => r.status === 'pending')!;
    const before = res(pending.reservationId).paid;
    expect((await advanceRefund(pending.id, 'processed')).ok).toBe(false); // must be approved first
    expect((await advanceRefund(pending.id, 'approved')).ok).toBe(true);
    expect((await advanceRefund(pending.id, 'processed')).ok).toBe(true);
    expect(res(pending.reservationId).paid).toBe(before - pending.amount);
  });

  it('refuses refunds larger than what was collected', async () => {
    const r = await requestRefund({ reservationId: 'res-001', amount: 9_999_999, reason: 'test' });
    expect(r.ok).toBe(false);
  });
});

describe('booking totals and guest access integration', () => {
  it('posts configured room tax and service charges to the folio exactly once', async () => {
    const guest = state().guests[0];
    const checkInDate = '2027-03-01'; const checkOutDate = '2027-03-03';
    const room = state().rooms.find((r) => r.hotelId === 'h-vi' && ['available', 'inspected', 'dirty'].includes(r.status) && !state().reservations.some((x) => x.roomId === r.id && x.status !== 'cancelled' && x.status !== 'no_show' && x.checkIn < checkOutDate && checkInDate < x.checkOut))!;
    const result = await createReservation({ hotelId: room.hotelId, roomId: room.id, guestId: guest.id, checkIn: checkInDate, checkOut: checkOutDate, adults: 2, children: 0, nightlyRate: 100000, deposit: 0, method: 'cash', status: 'confirmed' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const folio = folioFor(result.value.id)!;
    expect(folio.total).toBe(result.value.total);
    expect(state().charges.filter((c) => c.reservationId === result.value.id && ['Tax', 'Service charge'].includes(c.description))).toHaveLength(2);
  });

  it('expires public holds, keeps their history and allows the guest to re-enter the portal', async () => {
    const guestResult = await createGuest({ fullName: 'New Demo Guest', email: 'new.demo@example.test', phone: '+2348000000000', nationality: 'Nigeria' });
    expect(guestResult.ok).toBe(true);
    if (!guestResult.ok) return;
    const { demoGuestLogin } = await import('./mockAuthService');
    await expect(demoGuestLogin(guestResult.value.id)).resolves.toBeUndefined();
    const room = state().rooms.find((r) => r.hotelId === 'h-vi')!;
    const hold = { ...state().reservations[0], id: 'res-hold-test', roomId: room.id, guestId: guestResult.value.id, status: 'pending' as const, holdExpiresAt: new Date(Date.now() - 1000).toISOString() };
    state().setReservations((rs) => [hold, ...rs]);
    expect(expirePendingHolds()).toBe(1);
    expect(state().reservations.find((r) => r.id === hold.id)?.status).toBe('expired');
  });
});

describe('room transfer', () => {
  it('moves an in-house guest, dirties the old room and occupies the new one', async () => {
    const target = findAvailableRooms(state().rooms, state().reservations, { hotelId: 'h-vi', checkIn: DEMO_TODAY, checkOut: res('res-001').checkOut, readyNow: true, ignoreReservationId: 'res-001' })[0];
    const r = await transferRoom({ reservationId: 'res-001', newRoomId: target.id, reason: 'Guest requested a quieter room' });
    expect(r.ok).toBe(true);
    expect(res('res-001').roomId).toBe(target.id);
    expect(room('rm-101').status).toBe('dirty');
    expect(room(target.id).status).toBe('occupied');
  });

  it('rejects transfers into rooms that are not ready', async () => {
    const r = await transferRoom({ reservationId: 'res-001', newRoomId: 'rm-205', reason: 'test' }); // dirty
    expect(r.ok).toBe(false);
    expect(res('res-001').roomId).toBe('rm-101');
  });
});
