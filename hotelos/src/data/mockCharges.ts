import type { FolioCharge } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { mockReservations } from './mockReservations';

/** Incidentals for the in-house guests only; completed stays are fully settled with no extras. */
export const mockCharges: FolioCharge[] = (() => {
  const out: FolioCharge[] = [];
  const add = (reservationId: string, offset: number, category: FolioCharge['category'], description: string, amount: number, checkIn: string) => {
    const date = addDays(checkIn, offset);
    if (date > DEMO_TODAY) return;
    out.push({ id: `chg-${String(out.length + 1).padStart(3, '0')}`, reservationId, date, category, description, amount });
  };
  mockReservations.filter((r) => r.status === 'checked_in').forEach((r, i) => {
    add(r.id, 1, 'restaurant', 'Restaurant — dinner', 14500 + i * 1500, r.checkIn);
    if (i % 2 === 0) add(r.id, 1, 'laundry', 'Laundry — 6 items', 6000, r.checkIn);
    if (i % 3 === 0) add(r.id, 2, 'room_service', 'Room service — breakfast', 9500, r.checkIn);
  });
  return out;
})();
