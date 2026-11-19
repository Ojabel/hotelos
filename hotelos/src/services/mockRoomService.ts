import { categoryById } from '@/data/roomCatalog';
import { BLOCKING_STATUSES } from '@/utils/reservationRules';
import { canTransition } from '@/utils/roomRules';
import { useHotelStore } from '@/store/useHotelStore';
import type { Result, Room, RoomStatus } from '@/types';
import { ROOM_STATUS_META } from '@/utils/status';
import { delay } from './delay';
import { syncTasksWithRoomStatus } from './mockHousekeepingService';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/** MOCK SERVICE — backend integration point for room operations. */
export interface RoomInput { hotelId: string; number: string; floor: number; categoryId: string }

function validate(input: RoomInput, ignoreId?: string): string | null {
  const number = input.number.trim();
  if (!number) return 'Enter a room number.';
  if (!Number.isInteger(input.floor) || input.floor < 0 || input.floor > 40) return 'Floor must be a whole number between 0 and 40.';
  const dup = useHotelStore.getState().rooms.some((r) => r.id !== ignoreId && r.hotelId === input.hotelId && r.number.toLowerCase() === number.toLowerCase());
  if (dup) return `Room ${number} already exists at this property.`;
  return null;
}

export async function createRoom(input: RoomInput): Promise<Result<Room>> {
  if (backendMode) return backendOperations.createRoom(input.hotelId, { number: input.number.trim(), floor: input.floor, categoryId: input.categoryId });
  await delay();
  const error = validate(input);
  if (error) return { ok: false, error };
  const { rooms, setRooms, log } = useHotelStore.getState();
  const base = `rm-${input.number.trim().toLowerCase()}`;
  const id = rooms.some((r) => r.id === base) ? `${base}-${input.hotelId.replace('h-', '')}` : base;
  const room: Room = { id, hotelId: input.hotelId, number: input.number.trim(), floor: input.floor, categoryId: input.categoryId, status: 'available' };
  setRooms((rs) => [...rs, room]);
  log(`Room ${room.number} added (${categoryById(room.categoryId).name})`, 'room');
  return { ok: true, value: room };
}

export async function updateRoom(id: string, input: RoomInput): Promise<Result<Room>> {
  if (backendMode) return backendOperations.updateRoom(input.hotelId, id, { number: input.number.trim(), floor: input.floor, categoryId: input.categoryId });
  await delay();
  const error = validate(input, id);
  if (error) return { ok: false, error };
  const { rooms, setRooms, log } = useHotelStore.getState();
  const existing = rooms.find((r) => r.id === id);
  if (!existing) return { ok: false, error: 'Room not found.' };
  const updated: Room = { ...existing, number: input.number.trim(), floor: input.floor, categoryId: input.categoryId };
  setRooms((rs) => rs.map((r) => (r.id === id ? updated : r)));
  log(`Room ${updated.number} details updated`, 'room');
  return { ok: true, value: updated };
}

export async function changeRoomStatus(id: string, status: RoomStatus): Promise<Result<Room>> {
  if (backendMode) {
    const target = useHotelStore.getState().rooms.find((r) => r.id === id);
    if (!target) return { ok: false, error: 'Room not found.' };
    if (status === 'reserved' || status === 'occupied') return { ok: false, error: 'Reservation status changes manage reserved and occupied rooms.' };
    if (!canTransition(target.status, status)) return { ok: false, error: `A ${ROOM_STATUS_META[target.status].label.toLowerCase()} room cannot be changed to ${ROOM_STATUS_META[status].label.toLowerCase()}.` };
    return backendOperations.updateRoomStatus(target.hotelId, id, status);
  }
  await delay(200);
  const { rooms, setRooms, log } = useHotelStore.getState();
  const room = rooms.find((r) => r.id === id);
  if (!room) return { ok: false, error: 'Room not found.' };
  if (!canTransition(room.status, status)) {
    return { ok: false, error: `A ${ROOM_STATUS_META[room.status].label.toLowerCase()} room cannot be changed to ${ROOM_STATUS_META[status].label.toLowerCase()}.` };
  }
  const updated = { ...room, status };
  setRooms((rs) => rs.map((r) => (r.id === id ? updated : r)));
  syncTasksWithRoomStatus(id, status);
  log(`Room ${room.number} set to ${ROOM_STATUS_META[status].label.toLowerCase()}`, 'room');
  return { ok: true, value: updated };
}

export async function deleteRoom(id: string): Promise<Result<true>> {
  if (backendMode) return { ok: false, error: 'Room deletion is not supported by the backend API.' };
  await delay();
  const { rooms, reservations, setRooms, log } = useHotelStore.getState();
  const room = rooms.find((r) => r.id === id);
  if (!room) return { ok: false, error: 'Room not found.' };
  if (reservations.some((r) => r.roomId === id && BLOCKING_STATUSES.includes(r.status))) {
    return { ok: false, error: `Room ${room.number} has active or upcoming reservations and cannot be deleted.` };
  }
  setRooms((rs) => rs.filter((r) => r.id !== id));
  log(`Room ${room.number} removed from inventory`, 'room');
  return { ok: true, value: true };
}
