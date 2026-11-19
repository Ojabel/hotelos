import { describe, expect, it } from 'vitest';
import { mockGuests } from '@/data/mockGuests';
import { mockHotels } from '@/data/mockHotels';
import { mockReservations } from '@/data/mockReservations';
import { mockRooms, ROOM_CATEGORIES } from '@/data/mockRooms';
import { addDays, DEMO_TODAY, nightsBetween } from './demoClock';
import { BLOCKING_STATUSES, datesOverlap, findAvailableRooms, hasConflict, isRoomBookable } from './reservationRules';
import { computeKpis, dailySeries } from './metrics';
import { canTransition, recomputeRoomStatus } from './roomRules';

describe('demo clock', () => {
  it('does arithmetic across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(nightsBetween('2026-11-08', '2026-11-13')).toBe(5);
  });
});

describe('reservation conflicts', () => {
  it('detects overlapping stays', () => {
    expect(datesOverlap('2026-11-10', '2026-11-13', '2026-11-12', '2026-11-15')).toBe(true);
  });
  it('allows same-day turnover', () => {
    expect(datesOverlap('2026-11-10', '2026-11-13', '2026-11-13', '2026-11-15')).toBe(false);
  });
  it('ignores cancelled and no-show reservations', () => {
    // res-017 (room 205) is cancelled and res-018 (room 206) is a no-show
    expect(hasConflict(mockReservations, 'rm-205', addDays(DEMO_TODAY, -5), addDays(DEMO_TODAY, -3))).toBe(false);
    expect(hasConflict(mockReservations, 'rm-206', addDays(DEMO_TODAY, -3), addDays(DEMO_TODAY, -1))).toBe(false);
  });
  it('releases an expired pending public hold while retaining active pending reservations', () => {
    const hold = { ...mockReservations[0], id: 'res-expired-test', roomId: 'rm-999', status: 'pending' as const, holdExpiresAt: '2026-11-08T12:00:00.000Z' };
    expect(hasConflict([hold], hold.roomId, hold.checkIn, hold.checkOut)).toBe(false);
    const activeHoldExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(hasConflict([{ ...hold, holdExpiresAt: activeHoldExpiry }], hold.roomId, hold.checkIn, hold.checkOut)).toBe(true);
  });
  it('blocks a new booking over an in-house guest and excludes the booking being edited', () => {
    expect(hasConflict(mockReservations, 'rm-101', DEMO_TODAY, addDays(DEMO_TODAY, 1))).toBe(true);
    expect(hasConflict(mockReservations, 'rm-101', DEMO_TODAY, addDays(DEMO_TODAY, 1), 'res-001')).toBe(false);
  });
  it('rejects zero-night stays and rooms out of commission', () => {
    const room101 = mockRooms.find((r) => r.id === 'rm-101')!;
    expect(isRoomBookable(room101, mockReservations, addDays(DEMO_TODAY, 20), addDays(DEMO_TODAY, 20))).toBe(false);
    const broken = mockRooms.find((r) => r.status === 'maintenance')!;
    expect(isRoomBookable(broken, mockReservations, addDays(DEMO_TODAY, 30), addDays(DEMO_TODAY, 32))).toBe(false);
  });
});

describe('seed data integrity', () => {
  it('meets the minimum volumes in the spec', () => {
    expect(mockHotels.length).toBeGreaterThanOrEqual(2);
    expect(ROOM_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(mockRooms.length).toBeGreaterThanOrEqual(30);
    expect(mockGuests.length).toBeGreaterThanOrEqual(40);
    expect(mockReservations.length).toBeGreaterThanOrEqual(25);
  });
  it('has no overlapping blocking reservations in any room', () => {
    const active = mockReservations.filter((r) => BLOCKING_STATUSES.includes(r.status));
    for (const r of active) {
      expect(hasConflict(active, r.roomId, r.checkIn, r.checkOut, r.id)).toBe(false);
    }
  });
  it('only references rooms, guests and hotels that exist', () => {
    for (const r of mockReservations) {
      expect(mockRooms.some((room) => room.id === r.roomId && room.hotelId === r.hotelId)).toBe(true);
      expect(mockGuests.some((g) => g.id === r.guestId)).toBe(true);
    }
  });
  it('marks in-house rooms occupied', () => {
    for (const r of mockReservations.filter((x) => x.status === 'checked_in')) {
      expect(mockRooms.find((room) => room.id === r.roomId)!.status).toBe('occupied');
    }
  });
});

describe('seed data: history and forward bookings', () => {
  it('never double-books a room across any active or completed stay', () => {
    const counted = mockReservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show');
    for (const r of counted) {
      const clash = counted.filter((o) => o.id !== r.id && o.roomId === r.roomId && datesOverlap(o.checkIn, o.checkOut, r.checkIn, r.checkOut));
      expect(clash).toEqual([]);
    }
  });
  it('uses unique ids and references', () => {
    expect(new Set(mockReservations.map((r) => r.id)).size).toBe(mockReservations.length);
    expect(new Set(mockReservations.map((r) => r.reference)).size).toBe(mockReservations.length);
  });
  it('keeps paid within total', () => {
    for (const r of mockReservations) expect(r.paid).toBeLessThanOrEqual(r.total);
  });
});

describe('availability search', () => {
  it('excludes rooms with overlapping bookings and out-of-commission rooms', () => {
    const free = findAvailableRooms(mockRooms, mockReservations, { hotelId: 'h-vi', checkIn: DEMO_TODAY, checkOut: addDays(DEMO_TODAY, 1) });
    expect(free.some((r) => r.id === 'rm-101')).toBe(false); // in-house
    expect(free.some((r) => r.id === 'rm-105')).toBe(false); // maintenance
    expect(free.every((r) => r.hotelId === 'h-vi')).toBe(true);
  });
  it('limits walk-in search to rooms ready now', () => {
    const free = findAvailableRooms(mockRooms, mockReservations, { hotelId: 'all', checkIn: DEMO_TODAY, checkOut: addDays(DEMO_TODAY, 1), readyNow: true });
    expect(free.every((r) => r.status === 'available' || r.status === 'inspected')).toBe(true);
  });
});

describe('room status rules', () => {
  it('only allows housekeeping-style manual transitions', () => {
    expect(canTransition('dirty', 'cleaning')).toBe(true);
    expect(canTransition('cleaning', 'inspected')).toBe(true);
    expect(canTransition('inspected', 'available')).toBe(true);
    expect(canTransition('dirty', 'available')).toBe(false);
    expect(canTransition('occupied', 'available')).toBe(false);
    expect(canTransition('available', 'occupied')).toBe(false);
  });
  it('releases a reserved room when its arrival is gone', () => {
    const room = { ...mockRooms.find((r) => r.id === 'rm-201')!, status: 'reserved' as const };
    expect(recomputeRoomStatus(room, [], DEMO_TODAY)).toBe('available');
    expect(recomputeRoomStatus(room, mockReservations, DEMO_TODAY)).toBe('reserved');
  });
});

describe('dashboard metrics', () => {
  const kpis = computeKpis(mockRooms, mockReservations, DEMO_TODAY, addDays(DEMO_TODAY, -6), DEMO_TODAY);
  it('room status buckets add up to total rooms', () => {
    const bucketed = kpis.available + kpis.occupied + kpis.reserved + kpis.housekeeping + kpis.outOfOrder;
    expect(bucketed).toBe(kpis.totalRooms);
  });
  it('occupancy matches occupied rooms over sellable rooms', () => {
    const sellable = kpis.totalRooms - kpis.outOfOrder;
    expect(kpis.occupancyRate).toBe(Math.round((kpis.occupied / sellable) * 100));
  });
  it("today's chart point equals the occupancy KPI", () => {
    const today = dailySeries(DEMO_TODAY, DEMO_TODAY, mockRooms, mockReservations, DEMO_TODAY)[0];
    expect(today.occupancy).toBe(kpis.occupancyRate);
  });
  it('reports realistic, positive figures', () => {
    expect(kpis.occupancyRate).toBeGreaterThan(0);
    expect(kpis.occupancyRate).toBeLessThanOrEqual(100);
    expect(kpis.adr).not.toBeNull();
    expect(kpis.revenueMonth).toBeGreaterThanOrEqual(kpis.revenueToday);
  });
});
