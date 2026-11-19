import type { IsoDate, Reservation, ReservationStatus, Room } from '@/types';

/** Statuses that hold a room and therefore block overlapping bookings. */
export const BLOCKING_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'checked_in'];

/** Two stays overlap when each starts before the other ends. Same-day turnover is allowed. */
export function datesOverlap(aIn: IsoDate, aOut: IsoDate, bIn: IsoDate, bOut: IsoDate): boolean {
  return aIn < bOut && bIn < aOut;
}

export function findConflicts(
  reservations: Reservation[],
  roomId: string,
  checkIn: IsoDate,
  checkOut: IsoDate,
  ignoreReservationId?: string,
): Reservation[] {
  return reservations.filter(
    (r) =>
      r.roomId === roomId &&
      r.id !== ignoreReservationId &&
      BLOCKING_STATUSES.includes(r.status) &&
      !(r.status === 'pending' && r.holdExpiresAt && Date.parse(r.holdExpiresAt) <= Date.now()) &&
      datesOverlap(r.checkIn, r.checkOut, checkIn, checkOut),
  );
}

export function hasConflict(
  reservations: Reservation[],
  roomId: string,
  checkIn: IsoDate,
  checkOut: IsoDate,
  ignoreReservationId?: string,
): boolean {
  return findConflicts(reservations, roomId, checkIn, checkOut, ignoreReservationId).length > 0;
}

/** A room can be sold for a stay if it is not out of commission and has no overlapping booking. */
export function isRoomBookable(
  room: Room,
  reservations: Reservation[],
  checkIn: IsoDate,
  checkOut: IsoDate,
  ignoreReservationId?: string,
): boolean {
  if (checkOut <= checkIn) return false;
  if (room.status === 'maintenance' || room.status === 'out_of_service') return false;
  return !hasConflict(reservations, room.id, checkIn, checkOut, ignoreReservationId);
}

export interface AvailabilityCriteria {
  hotelId: string; // 'all' for every property
  checkIn: IsoDate;
  checkOut: IsoDate;
  categoryId?: string;
  guests?: number;
  readyNow?: boolean;
  ignoreReservationId?: string;
}

export function findAvailableRooms(
  rooms: Room[],
  reservations: Reservation[],
  c: AvailabilityCriteria,
  capacityOf: (categoryId: string) => number = () => Infinity,
): Room[] {
  return rooms
    .filter((r) => c.hotelId === 'all' || r.hotelId === c.hotelId)
    .filter((r) => !c.categoryId || c.categoryId === 'any' || r.categoryId === c.categoryId)
    .filter((r) => !c.guests || capacityOf(r.categoryId) >= c.guests)
    .filter((r) => !c.readyNow || r.status === 'available' || r.status === 'inspected')
    .filter((r) => isRoomBookable(r, reservations, c.checkIn, c.checkOut, c.ignoreReservationId));
}
