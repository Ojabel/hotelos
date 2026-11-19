import type { Payment, PaymentMethod } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { mockRefunds } from './mockRefunds';
import { mockReservations } from './mockReservations';

const METHODS: PaymentMethod[] = ['bank_transfer', 'pos', 'cash', 'online'];
const yyMM = DEMO_TODAY.slice(2, 4) + DEMO_TODAY.slice(5, 7);

/** Derived from reservations so paid amounts always reconcile: deposit at booking, balance at check-out. */
export const mockPayments: Payment[] = (() => {
  const out: Payment[] = [];
  const add = (r: (typeof mockReservations)[number], amount: number, date: string) => {
    const n = out.length + 1;
    out.push({
      id: `pay-${String(n).padStart(4, '0')}`,
      reference: `PAY-${yyMM}-${String(n).padStart(4, '0')}`,
      reservationId: r.id,
      guestId: r.guestId,
      hotelId: r.hotelId,
      amount,
      method: METHODS[n % METHODS.length],
      status: 'paid',
      date,
    });
  };
  for (const r of mockReservations) {
    const depositDate = addDays(r.createdAt, 1) > DEMO_TODAY ? DEMO_TODAY : addDays(r.createdAt, 1);
    if (r.deposit > 0) add(r, r.deposit, depositDate);
    if (r.status === 'checked_out' && r.total - r.deposit > 0) add(r, r.total - r.deposit, r.checkOut);
  }
  // refunded deposits are flagged on the original payment
  const refundedRes = new Set(mockRefunds.filter((f) => f.status === 'processed').map((f) => f.reservationId));
  for (const p of out) if (refundedRes.has(p.reservationId)) p.status = 'refunded';

  // attempts that never collected money: pending bank transfers and failed online payments
  const pendingRes = mockReservations.filter((r) => r.status === 'pending').slice(0, 4);
  pendingRes.forEach((r, i) => {
    const n = out.length + 1;
    out.push({ id: `pay-${String(n).padStart(4, '0')}`, reference: `PAY-${yyMM}-${String(n).padStart(4, '0')}`, reservationId: r.id, guestId: r.guestId, hotelId: r.hotelId, amount: Math.round(r.total / 2 / 1000) * 1000, method: 'bank_transfer', status: 'pending', date: addDays(DEMO_TODAY, -(i % 2)) });
  });
  mockReservations.filter((r) => r.status === 'confirmed' && r.checkIn > DEMO_TODAY).slice(0, 3).forEach((r, i) => {
    const n = out.length + 1;
    out.push({ id: `pay-${String(n).padStart(4, '0')}`, reference: `PAY-${yyMM}-${String(n).padStart(4, '0')}`, reservationId: r.id, guestId: r.guestId, hotelId: r.hotelId, amount: 20000, method: 'online', status: 'failed', date: addDays(DEMO_TODAY, -i) });
  });
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
})();
