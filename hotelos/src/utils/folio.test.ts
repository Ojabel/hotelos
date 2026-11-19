import { describe, expect, it } from 'vitest';
import type { FolioCharge, Payment, Refund, Reservation } from '@/types';
import { computeFolio, maxRefundable, netPaidFor } from './folio';

const res: Reservation = {
  id: 'res-900', reference: 'HOS-2611-900', guestId: 'g-001', hotelId: 'h-vi', roomId: 'rm-101', categoryId: 'cat-std',
  checkIn: '2026-11-08', checkOut: '2026-11-11', adults: 2, children: 0, status: 'checked_in',
  nightlyRate: 65000, total: 195000, deposit: 0, paid: 0, createdAt: '2026-11-01',
};
const pay = (id: string, amount: number, status: Payment['status'] = 'paid'): Payment => ({ id, reference: `PAY-2611-${id}`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, amount, method: 'cash', status, date: '2026-11-08' });
const charge = (id: string, amount: number): FolioCharge => ({ id, reservationId: res.id, date: '2026-11-08', category: 'restaurant', description: 'Dinner', amount });
const refund = (id: string, amount: number, status: Refund['status']): Refund => ({ id, reference: `RFD-${id}`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, amount, reason: 'test', status, requestedAt: '2026-11-09' });

describe('folio calculations', () => {
  it('bills one room line per night and adds extra services', () => {
    const f = computeFolio(res, [charge('c1', 14500), charge('c2', 6000)], [], []);
    expect(f.lines.filter((l) => l.category === 'room')).toHaveLength(3);
    expect(f.roomTotal).toBe(195000);
    expect(f.extrasTotal).toBe(20500);
    expect(f.total).toBe(215500);
    expect(f.balance).toBe(215500);
    expect(f.status).toBe('pending');
  });

  it('handles partial payments and then full settlement', () => {
    const partial = computeFolio(res, [], [pay('a', 50000)], []);
    expect(partial.balance).toBe(145000);
    expect(partial.status).toBe('partially_paid');
    const full = computeFolio(res, [], [pay('a', 50000), pay('b', 145000)], []);
    expect(full.balance).toBe(0);
    expect(full.status).toBe('paid');
  });

  it('ignores pending and failed payments', () => {
    const f = computeFolio(res, [], [pay('a', 100000, 'pending'), pay('b', 100000, 'failed')], []);
    expect(f.netPaid).toBe(0);
    expect(f.balance).toBe(195000);
  });

  it('subtracts only processed refunds', () => {
    const payments = [pay('a', 195000)];
    expect(netPaidFor(res.id, payments, [refund('r1', 50000, 'pending')])).toBe(195000);
    expect(netPaidFor(res.id, payments, [refund('r1', 50000, 'processed')])).toBe(145000);
  });

  it('caps refunds at what is collected minus requests already open', () => {
    const payments = [pay('a', 100000)];
    expect(maxRefundable(res.id, payments, [])).toBe(100000);
    expect(maxRefundable(res.id, payments, [refund('r1', 30000, 'pending'), refund('r2', 20000, 'approved')])).toBe(50000);
    expect(maxRefundable(res.id, payments, [refund('r3', 30000, 'rejected')])).toBe(100000);
  });

  it('bills nothing for cancelled bookings and reports refunded status', () => {
    const cancelled = { ...res, status: 'cancelled' as const };
    const f = computeFolio(cancelled, [], [pay('a', 80000, 'refunded')], [refund('r1', 80000, 'processed')]);
    expect(f.total).toBe(0);
    expect(f.netPaid).toBe(0);
    expect(f.status).toBe('refunded');
  });
});
