import type { IsoDate, Reservation, Room, RoomStatus } from '@/types';

/**
 * Statuses a person may set by hand. `reserved` and `occupied` are controlled by reservation
 * workflows (booking, check-in, check-out), never set manually.
 */
export const MANUAL_ROOM_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['dirty', 'maintenance', 'out_of_service'],
  reserved: [],
  occupied: [],
  dirty: ['cleaning', 'maintenance', 'out_of_service'],
  cleaning: ['inspected', 'dirty'],
  inspected: ['available', 'dirty'],
  maintenance: ['dirty', 'out_of_service'],
  out_of_service: ['dirty', 'maintenance'],
};

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return MANUAL_ROOM_TRANSITIONS[from].includes(to);
}

/** Room status after reservations change: in-house → occupied, arriving today → reserved, otherwise release holds. */
export function recomputeRoomStatus(room: Room, reservations: Reservation[], today: IsoDate): RoomStatus {
  const mine = reservations.filter((r) => r.roomId === room.id);
  if (mine.some((r) => r.status === 'checked_in')) return 'occupied';
  const arrivingToday = mine.some((r) => r.status === 'confirmed' && r.checkIn === today);
  if (arrivingToday && (room.status === 'available' || room.status === 'inspected' || room.status === 'reserved')) return 'reserved';
  if (room.status === 'reserved' && !arrivingToday) return 'available';
  return room.status;
}

export function housekeepingLabel(status: RoomStatus): string {
  switch (status) {
    case 'dirty': return 'Needs cleaning';
    case 'cleaning': return 'Cleaning in progress';
    case 'inspected': return 'Inspected';
    default: return 'Ready';
  }
}

export function maintenanceLabel(status: RoomStatus): string {
  if (status === 'maintenance') return 'Under maintenance';
  if (status === 'out_of_service') return 'Out of service';
  return 'None';
}
