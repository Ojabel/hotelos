import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import { computeFolio, maxRefundable, netPaidFor } from '@/utils/folio';
import type { ChargeCategory, FolioCharge, Payment, PaymentMethod, Refund, Result } from '@/types';
import { delay } from './delay';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/**
 * MOCK SERVICE — backend integration point for folios, payments and refunds.
 * Nothing here talks to a payment provider; outcomes are simulated locally.
 */

const yyMM = () => today().slice(2, 4) + today().slice(5, 7);
const nextNum = (ids: string[], prefix: string) => Math.max(0, ...ids.map((i) => Number(i.replace(prefix, '')) || 0)) + 1;

/** Keep reservation.paid equal to collected payments minus processed refunds. */
export function syncPaid(reservationId: string) {
  const { payments, refunds, setReservations } = useHotelStore.getState();
  const net = netPaidFor(reservationId, payments, refunds);
  setReservations((rs) => rs.map((r) => (r.id === reservationId ? { ...r, paid: net } : r)));
}

export function folioFor(reservationId: string) {
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === reservationId);
  return res ? computeFolio(res, s.charges, s.payments, s.refunds) : null;
}

export async function addCharge(input: { reservationId: string; category: ChargeCategory; description: string; amount: number }): Promise<Result<FolioCharge>> {
  if (backendMode) return backendOperations.addFinancialCharge(input.reservationId, input);
  await delay(200);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  if (res.status !== 'checked_in') return { ok: false, error: 'Charges can only be posted to in-house guests.' };
  if (!input.description.trim()) return { ok: false, error: 'Enter a description.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  const charge: FolioCharge = { id: `chg-${String(nextNum(s.charges.map((c) => c.id), 'chg-')).padStart(3, '0')}`, reservationId: res.id, date: today(), category: input.category, description: input.description.trim(), amount: Math.round(input.amount) };
  s.setCharges((cs) => [...cs, charge]);
  const g = s.guests.find((x) => x.id === res.guestId);
  s.log(`${charge.description} posted to ${g?.fullName ?? 'guest'}'s folio`, 'payment');
  return { ok: true, value: charge };
}

export interface PaymentInput {
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  /** Simulated provider result. Bank transfers can stay pending until confirmed. */
  outcome?: 'success' | 'failed' | 'pending';
}

export async function recordPayment(input: PaymentInput): Promise<Result<Payment>> {
  if (backendMode) return backendOperations.recordFinancialPayment(input);
  await delay(400);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  if (res.status === 'cancelled' || res.status === 'no_show') return { ok: false, error: 'Payments cannot be recorded against a cancelled or no-show booking.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  const outcome = input.outcome ?? 'success';
  const folio = computeFolio(res, s.charges, s.payments, s.refunds);
  if (outcome === 'success' && input.amount > folio.balance) return { ok: false, error: 'Amount exceeds the outstanding balance.' };
  if (outcome === 'pending' && input.method !== 'bank_transfer') return { ok: false, error: 'Only bank transfers can be left pending confirmation.' };

  const n = String(nextNum(s.payments.map((p) => p.id), 'pay-')).padStart(4, '0');
  const payment: Payment = {
    id: `pay-${n}`, reference: `PAY-${yyMM()}-${n}`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId,
    amount: Math.round(input.amount), method: input.method, date: today(),
    status: outcome === 'success' ? 'paid' : outcome === 'failed' ? 'failed' : 'pending',
  };
  s.addPayment(payment);
  if (payment.status === 'paid') syncPaid(res.id);
  const g = s.guests.find((x) => x.id === res.guestId);
  s.log(payment.status === 'paid' ? `Payment ${payment.reference} recorded for ${g?.fullName}` : `Payment ${payment.reference} ${payment.status} for ${g?.fullName}`, 'payment');
  return { ok: true, value: payment };
}

export async function confirmPendingPayment(paymentId: string): Promise<Result<Payment>> {
  if (backendMode) return { ok: false, error: 'Financial payments are recorded as settled manual payments; pending bank transfers are not enabled.' };
  await delay(300);
  const s = useHotelStore.getState();
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== 'pending') return { ok: false, error: 'Only pending payments can be confirmed.' };
  const res = s.reservations.find((r) => r.id === p.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  const folio = computeFolio(res, s.charges, s.payments, s.refunds);
  if (p.amount > folio.balance) return { ok: false, error: 'This transfer now exceeds the outstanding balance.' };
  const updated = { ...p, status: 'paid' as const };
  s.setPayments((ps) => ps.map((x) => (x.id === paymentId ? updated : x)));
  syncPaid(res.id);
  s.log(`Bank transfer ${p.reference} confirmed`, 'payment');
  return { ok: true, value: updated };
}

export async function requestRefund(input: { reservationId: string; amount: number; reason: string }): Promise<Result<Refund>> {
  if (backendMode) {
    const payment = useHotelStore.getState().payments.filter((row) => row.reservationId === input.reservationId && row.status === 'paid').sort((a, b) => b.date.localeCompare(a.date))[0];
    const reservation = useHotelStore.getState().reservations.find((row) => row.id === input.reservationId);
    if (!payment || !reservation) return { ok: false, error: 'No refundable payment was found for this booking.' };
    return backendOperations.requestFinancialRefund({ paymentId: payment.id, hotelId: reservation.hotelId, amount: input.amount, reason: input.reason });
  }
  await delay(300);
  const s = useHotelStore.getState();
  const res = s.reservations.find((r) => r.id === input.reservationId);
  if (!res) return { ok: false, error: 'Reservation not found.' };
  if (!input.reason.trim()) return { ok: false, error: 'Give a reason for the refund.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  const limit = maxRefundable(res.id, s.payments, s.refunds);
  if (input.amount > limit) return { ok: false, error: `Only ${limit.toLocaleString('en-NG')} is available to refund on this booking.` };
  const n = String(nextNum(s.refunds.map((r) => r.id), 'rf-')).padStart(3, '0');
  const refund: Refund = { id: `rf-${n}`, reference: `RFD-${yyMM()}-${n}`, reservationId: res.id, guestId: res.guestId, hotelId: res.hotelId, amount: Math.round(input.amount), reason: input.reason.trim(), status: 'pending', requestedAt: today() };
  s.setRefunds((rs) => [refund, ...rs]);
  s.log(`Refund ${refund.reference} requested`, 'payment');
  return { ok: true, value: refund };
}

export async function advanceRefund(id: string, to: 'approved' | 'rejected' | 'processed'): Promise<Result<Refund>> {
  if (backendMode) {
    const refund = useHotelStore.getState().refunds.find((row) => row.id === id);
    return refund ? backendOperations.advanceFinancialRefund(refund, to) : { ok: false, error: 'Refund not found.' };
  }
  await delay(300);
  const s = useHotelStore.getState();
  const r = s.refunds.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'Refund not found.' };
  const allowed = r.status === 'pending' ? ['approved', 'rejected'] : r.status === 'approved' ? ['processed'] : [];
  if (!allowed.includes(to)) return { ok: false, error: `A ${r.status} refund cannot be ${to}.` };
  const updated = { ...r, status: to };
  s.setRefunds((rs) => rs.map((x) => (x.id === id ? updated : x)));
  if (to === 'processed') {
    // simulated payout: reconcile the booking and flag its payments as refunded once nothing remains collected
    syncPaid(r.reservationId);
    const { payments, refunds } = useHotelStore.getState();
    if (netPaidFor(r.reservationId, payments, refunds) <= 0) {
      s.setPayments((ps) => ps.map((p) => (p.reservationId === r.reservationId && p.status === 'paid' ? { ...p, status: 'refunded' } : p)));
    }
  }
  s.log(`Refund ${r.reference} ${to}`, 'payment');
  return { ok: true, value: updated };
}
