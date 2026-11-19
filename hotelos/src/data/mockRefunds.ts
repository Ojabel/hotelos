import type { Refund, RefundStatus } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { mockReservations } from './mockReservations';

const STATUSES: RefundStatus[] = ['pending', 'processed', 'approved', 'processed', 'rejected'];

/** One refund request per cancelled booking that holds a deposit; late cancellations keep a 20% fee. */
export const mockRefunds: Refund[] = mockReservations
  .filter((r) => r.status === 'cancelled' && r.deposit > 0)
  .map((r, i) => {
    const late = i % 2 === 0;
    const requested = addDays(DEMO_TODAY, -(i % 6) - 1);
    return {
      id: `rf-${String(i + 1).padStart(3, '0')}`,
      reference: `RFD-${DEMO_TODAY.slice(2, 4)}${DEMO_TODAY.slice(5, 7)}-${String(i + 1).padStart(3, '0')}`,
      reservationId: r.id,
      guestId: r.guestId,
      hotelId: r.hotelId,
      amount: late ? Math.round((r.deposit * 0.8) / 100) * 100 : r.deposit,
      reason: late ? 'Late cancellation — 20% fee retained' : 'Cancelled within free-cancellation window',
      status: i === 0 ? 'pending' : STATUSES[i % STATUSES.length],
      requestedAt: requested,
    };
  });
