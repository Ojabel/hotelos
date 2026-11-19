import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import type { MaintenanceRequest, Priority, Result } from '@/types';
import { delay } from './delay';
import { ensureTaskForRoom } from './mockHousekeepingService';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';
import { hotelOperationsApi } from './api/hotelOperations';

/** MOCK SERVICE — backend integration point for maintenance requests. */
const nextId = (ids: string[]) => `mt-${String(Math.max(0, ...ids.map((i) => Number(i.replace('mt-', '')) || 0)) + 1).padStart(3, '0')}`;

export interface RequestInput { hotelId: string; roomId?: string; location?: string; title?: string; category: string; priority: Priority; description: string; costEstimate: number; blocksRoom: boolean; idempotencyKey?: string }

export async function createRequest(input: RequestInput): Promise<Result<MaintenanceRequest>> {
  if (backendMode) return backendOperations.createMaintenanceRequest(input.hotelId, { title: input.title?.trim() || input.category, description: input.description, roomId: input.roomId, location: input.location, category: input.category, priority: input.priority.toUpperCase(), blocksRoom: input.blocksRoom }, input.idempotencyKey);
  await delay(300);
  const s = useHotelStore.getState();
  if (!input.description.trim()) return { ok: false, error: 'Describe the issue.' };
  if (!input.roomId && !input.location?.trim()) return { ok: false, error: 'Choose a room or enter a location.' };
  if (!Number.isFinite(input.costEstimate) || input.costEstimate < 0) return { ok: false, error: 'Cost estimate cannot be negative.' };
  const room = input.roomId ? s.rooms.find((r) => r.id === input.roomId) : undefined;
  if (input.roomId && !room) return { ok: false, error: 'Room not found.' };
  if (room && input.blocksRoom && (room.status === 'occupied' || room.status === 'reserved')) {
    return { ok: false, error: `Room ${room.number} is ${room.status}. Move the guest or choose a non-blocking request.` };
  }
  const req: MaintenanceRequest = { id: nextId(s.maintenanceRequests.map((m) => m.id)), hotelId: room?.hotelId ?? input.hotelId, roomId: input.roomId, location: room ? undefined : input.location?.trim(), category: input.category, priority: input.priority, status: 'open', description: input.description.trim(), costEstimate: Math.round(input.costEstimate), blocksRoom: Boolean(room) && input.blocksRoom, createdAt: today() };
  s.setMaintenance((ms) => [req, ...ms]);
  if (room && req.blocksRoom) s.setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, status: 'maintenance' } : r)));
  s.log(`Maintenance request logged for ${room ? `room ${room.number}` : req.location}`, 'room');
  return { ok: true, value: req };
}

export async function assignRequest(id: string, staffId: string, dueAt?: string): Promise<Result<MaintenanceRequest>> {
  if (backendMode) {
    const request = useHotelStore.getState().maintenanceRequests.find((item) => item.id === id);
    if (!request) return { ok: false, error: 'Request not found.' };
    const records = await hotelOperationsApi.listMaintenanceRequests(request.hotelId);
    const record = records.find((item) => item.id === id);
    if (!record?.workOrder) {
      const created = await backendOperations.createMaintenanceWorkOrder(request.hotelId, id, undefined, dueAt);
      if (!created.ok) return created;
    }
    return backendOperations.assignMaintenanceWorkOrder(request.hotelId, id, staffId, dueAt);
  }
  await delay(250);
  const s = useHotelStore.getState();
  const req = s.maintenanceRequests.find((m) => m.id === id);
  const tech = s.staff.find((p) => p.id === staffId);
  if (!req) return { ok: false, error: 'Request not found.' };
  if (req.status !== 'open' && req.status !== 'assigned') return { ok: false, error: 'Only requests that have not started can be (re)assigned.' };
  if (!tech || tech.department !== 'Maintenance') return { ok: false, error: 'Choose a maintenance technician.' };
  if (tech.status !== 'active') return { ok: false, error: `${tech.name} is not available (${tech.status.replace('_', ' ')}).` };
  const updated = { ...req, status: 'assigned' as const, assigneeId: staffId };
  s.setMaintenance((ms) => ms.map((m) => (m.id === id ? updated : m)));
  s.log(`${req.category} request assigned to ${tech.name}`, 'room');
  return { ok: true, value: updated };
}

export async function startRequest(id: string): Promise<Result<MaintenanceRequest>> {
  if (backendMode) {
    const request = useHotelStore.getState().maintenanceRequests.find((item) => item.id === id);
    return request ? backendOperations.transitionMaintenanceWorkOrder(request.hotelId, id, 'start') : { ok: false, error: 'Request not found.' };
  }
  await delay(200);
  const s = useHotelStore.getState();
  const req = s.maintenanceRequests.find((m) => m.id === id);
  if (!req || req.status !== 'assigned') return { ok: false, error: 'Assign a technician before starting work.' };
  const updated = { ...req, status: 'in_progress' as const };
  s.setMaintenance((ms) => ms.map((m) => (m.id === id ? updated : m)));
  return { ok: true, value: updated };
}

export async function resolveRequest(id: string, notes: string, finalCost?: number): Promise<Result<MaintenanceRequest>> {
  if (backendMode) {
    const request = useHotelStore.getState().maintenanceRequests.find((item) => item.id === id);
    return request ? backendOperations.transitionMaintenanceWorkOrder(request.hotelId, id, 'complete', notes) : { ok: false, error: 'Request not found.' };
  }
  await delay(300);
  const s = useHotelStore.getState();
  const req = s.maintenanceRequests.find((m) => m.id === id);
  if (!req || req.status !== 'in_progress') return { ok: false, error: 'Only work in progress can be resolved.' };
  if (!notes.trim()) return { ok: false, error: 'Add resolution notes.' };
  const updated: MaintenanceRequest = { ...req, status: 'resolved', resolutionNotes: notes.trim(), resolvedAt: today(), costEstimate: finalCost !== undefined && Number.isFinite(finalCost) && finalCost >= 0 ? Math.round(finalCost) : req.costEstimate };
  s.setMaintenance((ms) => ms.map((m) => (m.id === id ? updated : m)));
  if (req.roomId && req.blocksRoom) {
    const stillBlocked = useHotelStore.getState().maintenanceRequests.some((m) => m.roomId === req.roomId && m.blocksRoom && m.status !== 'resolved');
    const room = s.rooms.find((r) => r.id === req.roomId);
    if (!stillBlocked && room && (room.status === 'maintenance' || room.status === 'out_of_service')) {
      s.setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, status: 'dirty' } : r)));
      ensureTaskForRoom(room.id, 'Return-to-service clean after maintenance.');
      s.log(`Room ${room.number} repaired and released for cleaning`, 'room');
      return { ok: true, value: updated };
    }
  }
  s.log(`${req.category} request resolved`, 'room');
  return { ok: true, value: updated };
}
