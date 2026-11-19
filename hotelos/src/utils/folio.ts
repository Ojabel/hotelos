import type { ChargeCategory, FolioCharge, IsoDate, Payment, PaymentStatus, Refund, Reservation } from '@/types';
import { addDays, nightsBetween } from './demoClock';

export const CHARGE_LABELS: Record<ChargeCategory, string> = {
  room: 'Room', restaurant: 'Restaurant', laundry: 'Laundry', room_service: 'Room service', other: 'Other services',
};

export interface FolioLine {
  id: string;
  date: IsoDate;
  kind: 'charge' | 'payment' | 'refund';
  category?: ChargeCategory;
  description: string;
  debit: number;
  credit: number;
}

export interface Folio {
  lines: FolioLine[];
  roomTotal: number;
  extrasTotal: number;
  total: number;
  paid: number;
  refunded: number;
  netPaid: number;
  balance: number;
  status: PaymentStatus;
}

/** Payments that count toward a folio: collected (paid) or later refunded. Pending and failed never count. */
export const countsAsCollected = (p: Payment) => p.status === 'paid' || p.status === 'refunded';

export function netPaidFor(reservationId: string, payments: Payment[], refunds: Refund[]): number {
  const paid = payments.filter((p) => p.reservationId === reservationId && countsAsCollected(p)).reduce((s, p) => s + p.amount, 0);
  const refunded = refunds.filter((r) => r.reservationId === reservationId && r.status === 'processed').reduce((s, r) => s + r.amount, 0);
  return paid - refunded;
}

/** Refundable = net collected minus refunds already waiting for approval or processing. */
export function maxRefundable(reservationId: string, payments: Payment[], refunds: Refund[]): number {
  const open = refunds.filter((r) => r.reservationId === reservationId && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + r.amount, 0);
  return Math.max(0, netPaidFor(reservationId, payments, refunds) - open);
}

export function computeFolio(res: Reservation, charges: FolioCharge[], payments: Payment[], refunds: Refund[]): Folio {
  const persistedRoomCharges = charges.filter((charge) => charge.reservationId === res.id && (charge.kind === 'room' || charge.category === 'room'));
  const inactive = res.status === 'cancelled' || res.status === 'no_show' || res.status === 'expired';
  const nights = Math.max(0, nightsBetween(res.checkIn, res.checkOut));
  const lines: FolioLine[] = [];

  if (!inactive && persistedRoomCharges.length === 0) {
    for (let i = 0; i < nights; i++) {
      lines.push({ id: `${res.id}-night-${i}`, date: addDays(res.checkIn, i), kind: 'charge', category: 'room', description: `Room charge — night ${i + 1}`, debit: res.nightlyRate, credit: 0 });
    }
  }
  if (!inactive) for (const charge of charges.filter((item) => item.reservationId === res.id)) {
    lines.push({ id: charge.id, date: charge.date, kind: 'charge', category: charge.category, description: charge.description, debit: charge.amount, credit: 0 });
  }
  const myPayments = payments.filter((p) => p.reservationId === res.id && countsAsCollected(p));
  for (const p of myPayments) lines.push({ id: p.id, date: p.date, kind: 'payment', description: `Payment ${p.reference}`, debit: 0, credit: p.amount });
  const myRefunds = refunds.filter((r) => r.reservationId === res.id && r.status === 'processed');
  for (const r of myRefunds) lines.push({ id: r.id, date: r.requestedAt, kind: 'refund', description: `Refund ${r.reference}`, debit: r.amount, credit: 0 });

  const order = { charge: 0, payment: 1, refund: 2 } as const;
  lines.sort((a, b) => (a.date === b.date ? order[a.kind] - order[b.kind] : a.date < b.date ? -1 : 1));

  const roomTotal = inactive ? 0 : persistedRoomCharges.length ? persistedRoomCharges.reduce((sum, charge) => sum + charge.amount, 0) : res.nightlyRate * nights;
  const extrasTotal = inactive ? 0 : charges.filter((c) => c.reservationId === res.id && c.kind !== 'room' && c.category !== 'room').reduce((s, c) => s + c.amount, 0);
  const total = roomTotal + extrasTotal;
  const paid = myPayments.reduce((s, p) => s + p.amount, 0);
  const refunded = myRefunds.reduce((s, r) => s + r.amount, 0);
  const netPaid = paid - refunded;
  const balance = total - netPaid;

  let status: PaymentStatus;
  if (total <= 0) status = refunded > 0 ? 'refunded' : netPaid > 0 ? 'paid' : 'pending';
  else if (balance <= 0) status = 'paid';
  else if (netPaid > 0) status = 'partially_paid';
  else status = 'pending';

  return { lines, roomTotal, extrasTotal, total, paid, refunded, netPaid, balance, status };
}

const yyMM = (iso: IsoDate) => iso.slice(2, 4) + iso.slice(5, 7);
const seq = (id: string) => id.replace(/\D/g, '').padStart(3, '0');
export const invoiceNumber = (res: Reservation, issued: IsoDate) => `INV-${yyMM(issued)}-${seq(res.id)}`;
export const receiptNumber = (p: Payment) => p.reference.replace('PAY-', 'RCT-');
