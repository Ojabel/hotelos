import type { Room, RoomStatus } from '@/types';
import { DEMO_TODAY } from '@/utils/demoClock';
import { ROOM_CATEGORIES, ROOM_SPECS, roomIdFromNumber } from './roomCatalog';
import { mockReservations } from './mockReservations';

export { ROOM_CATEGORIES };

/** Housekeeping / engineering state for rooms with no in-house or arriving guest today. */
const BASE_STATUS: Record<string, RoomStatus> = {
  '104': 'inspected',
  '105': 'maintenance',
  '106': 'cleaning',
  '205': 'dirty',
  '206': 'dirty',
  '303': 'dirty',
  '305': 'out_of_service',
  B8: 'maintenance',
};

function deriveStatus(roomId: string, number: string): RoomStatus {
  const live = mockReservations.filter((r) => r.roomId === roomId);
  if (live.some((r) => r.status === 'checked_in')) return 'occupied';
  if (live.some((r) => r.status === 'confirmed' && r.checkIn === DEMO_TODAY)) return 'reserved';
  return BASE_STATUS[number] ?? 'available';
}

export const mockRooms: Room[] = ROOM_SPECS.map((spec) => {
  const id = roomIdFromNumber(spec.number);
  return { id, hotelId: spec.hotelId, number: spec.number, floor: spec.floor, categoryId: spec.categoryId, status: deriveStatus(id, spec.number) };
});
