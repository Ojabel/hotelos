import type { Reservation, ReservationStatus } from '@/types';
import { addDays, DEMO_TODAY, nightsBetween } from '@/utils/demoClock';
import { datesOverlap } from '@/utils/reservationRules';
import { categoryById, ROOM_SPECS, roomIdFromNumber } from './roomCatalog';

/**
 * [guest index, room number, check-in offset (days from demo today), nights, status, adults, children]
 * Rooms that appear twice have strictly non-overlapping stays.
 */
type Row = [number, string, number, number, ReservationStatus, number, number];

const ROWS: Row[] = [
  [0, '101', -2, 5, 'checked_in', 2, 0],
  [1, '102', -1, 3, 'checked_in', 1, 0],
  [2, '103', -3, 4, 'checked_in', 2, 0],
  [3, '201', 0, 2, 'confirmed', 2, 0],
  [4, '202', 0, 3, 'confirmed', 1, 0],
  [5, '203', -2, 2, 'checked_in', 2, 1],
  [6, '204', -4, 4, 'checked_in', 2, 0],
  [7, '301', 1, 3, 'confirmed', 2, 0],
  [8, '302', 2, 2, 'confirmed', 2, 0],
  [9, '303', 0, 1, 'pending', 1, 0],
  [10, '304', 5, 4, 'confirmed', 2, 0],
  [11, '401', -1, 6, 'checked_in', 2, 0],
  [12, '402', 3, 2, 'pending', 2, 0],
  [13, '104', -10, 3, 'checked_out', 2, 0],
  [14, '105', -6, 2, 'checked_out', 1, 0],
  [15, '106', 4, 3, 'confirmed', 2, 2],
  [16, '205', -5, 2, 'cancelled', 2, 0],
  [17, '206', -3, 2, 'no_show', 1, 0],
  [18, '305', 7, 3, 'confirmed', 2, 0],
  [19, '306', 10, 5, 'confirmed', 2, 2],
  [20, 'B1', -2, 4, 'checked_in', 2, 0],
  [21, 'B2', 2, 3, 'confirmed', 2, 0],
  [22, '101', 4, 3, 'confirmed', 2, 0],
  [23, '102', 3, 2, 'confirmed', 1, 0],
  [24, '103', 2, 2, 'pending', 2, 0],
];

const pad = (n: number) => String(n).padStart(3, '0');
const yyMM = DEMO_TODAY.slice(2, 4) + DEMO_TODAY.slice(5, 7);

const seedReservations: Reservation[] = ROWS.map(([guestIdx, roomNo, offset, nights, status, adults, children], i) => {
  const spec = ROOM_SPECS.find((s) => s.number === roomNo)!;
  const rate = categoryById(spec.categoryId).basePrice;
  const checkIn = addDays(DEMO_TODAY, offset);
  const checkOut = addDays(checkIn, nights);
  const total = rate * nightsBetween(checkIn, checkOut);
  const deposit = status === 'pending' ? 0 : Math.round(total / 2 / 1000) * 1000;
  const paid = status === 'checked_out' ? total : deposit;
  return {
    id: `res-${pad(i + 1)}`,
    reference: `HOS-${yyMM}-${pad(i + 1)}`,
    guestId: `g-${String(guestIdx + 1).padStart(3, '0')}`,
    hotelId: spec.hotelId,
    roomId: roomIdFromNumber(roomNo),
    categoryId: spec.categoryId,
    checkIn,
    checkOut,
    adults,
    children,
    status,
    nightlyRate: rate,
    total,
    deposit,
    paid,
    createdAt: addDays(checkIn, -14),
  };
});

/**
 * Deterministic history and forward bookings so the dashboard has realistic trends.
 * Past stays are checked-out and end on or before today; future stays are confirmed/pending.
 * Never overlaps any non-cancelled stay, and skips rooms that are out of commission.
 */
const OUT_OF_COMMISSION = new Set(['105', '305', 'B8']);
const GUEST_COUNT = 40;

function generateFiller(existing: Reservation[]): Reservation[] {
  let seed = 20261108;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const out: Reservation[] = [];
  const counted = (r: Reservation) => r.status !== 'cancelled' && r.status !== 'no_show';
  const taken = (roomId: string, a: string, b: string) =>
    [...existing, ...out].some((r) => r.roomId === roomId && counted(r) && datesOverlap(r.checkIn, r.checkOut, a, b));
  let n = existing.length;

  const push = (roomNo: string, hotelId: string, categoryId: string, checkIn: string, nights: number, status: ReservationStatus) => {
    const rate = categoryById(categoryId).basePrice;
    const checkOut = addDays(checkIn, nights);
    const total = rate * nights;
    const deposit = status === 'pending' ? 0 : Math.round(total / 2 / 1000) * 1000;
    const cap = categoryById(categoryId).capacity;
    const adults = Math.min(1 + Math.floor(rand() * 2), cap);
    const createdAt = (() => {
      const d = addDays(checkIn, -(3 + Math.floor(rand() * 25)));
      return d > DEMO_TODAY ? DEMO_TODAY : d;
    })();
    n += 1;
    out.push({
      id: `res-${pad(n)}`,
      reference: `HOS-${yyMM}-${pad(n)}`,
      guestId: `g-${String(1 + Math.floor(rand() * GUEST_COUNT)).padStart(3, '0')}`,
      hotelId,
      roomId: roomIdFromNumber(roomNo),
      categoryId,
      checkIn,
      checkOut,
      adults,
      children: cap > 2 && rand() < 0.2 ? 1 : 0,
      status,
      nightlyRate: rate,
      total,
      deposit,
      paid: status === 'checked_out' ? total : deposit,
      createdAt,
    });
  };

  for (const spec of ROOM_SPECS) {
    if (OUT_OF_COMMISSION.has(spec.number)) continue;
    // history: day -30 .. today
    let day = -30;
    while (day < 0) {
      if (rand() < 0.28) { day += 1; continue; }
      const nights = 1 + Math.floor(rand() * 4);
      const ci = addDays(DEMO_TODAY, day);
      const co = addDays(ci, nights);
      if (co <= DEMO_TODAY && !taken(roomIdFromNumber(spec.number), ci, co)) push(spec.number, spec.hotelId, spec.categoryId, ci, nights, 'checked_out');
      day += nights + (rand() < 0.5 ? 0 : 1);
    }
    // forward bookings: tomorrow .. +30, thinning out
    day = 1;
    while (day <= 30) {
      if (rand() > 0.62 - day * 0.012) { day += 1; continue; }
      const nights = 1 + Math.floor(rand() * 4);
      const ci = addDays(DEMO_TODAY, day);
      const co = addDays(ci, nights);
      if (!taken(roomIdFromNumber(spec.number), ci, co)) push(spec.number, spec.hotelId, spec.categoryId, ci, nights, (() => { const x = rand(); return x < 0.12 ? 'pending' : x < 0.19 ? 'cancelled' : 'confirmed'; })());
      day += nights + (rand() < 0.5 ? 0 : 1);
    }
  }
  return out;
}

export const mockReservations: Reservation[] = [...seedReservations, ...generateFiller(seedReservations)];
