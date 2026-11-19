import { useHotelStore } from '@/store/useHotelStore';
import { addDays, today } from '@/utils/demoClock';
import type { HousekeepingTask, InspectionRecord, Priority, Result, RoomStatus, SupplyNote } from '@/types';
import { delay } from './delay';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/**
 * MOCK SERVICE — backend integration point for housekeeping.
 * Room status follows the task: assigned (dirty) → in progress (cleaning) → completed (cleaning, awaiting
 * inspection) → inspected (room ready). A failed inspection sends the room back to dirty.
 */
export const INSPECTION_CHECKLIST = ['Bed made with fresh linen', 'Bathroom clean and restocked', 'Floors and surfaces clean', 'Amenities and minibar restocked', 'No odours; air-conditioning working', 'Lights, TV and sockets working'];

const isOpen = (t: HousekeepingTask) => t.status !== 'inspected';
const nextId = (ids: string[], prefix: string) => `${prefix}${String(Math.max(0, ...ids.map((i) => Number(i.replace(prefix, '')) || 0)) + 1).padStart(3, '0')}`;

function setRoomStatus(roomId: string, status: RoomStatus) {
  useHotelStore.getState().setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, status } : r)));
}

/** Priority from upcoming demand: arriving today → urgent, tomorrow → high. */
export function priorityForRoom(roomId: string): Priority {
  const t = today();
  const next = useHotelStore.getState().reservations.filter((r) => r.roomId === roomId && (r.status === 'confirmed' || r.status === 'pending') && r.checkIn >= t).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))[0];
  if (!next) return 'normal';
  return next.checkIn === t ? 'urgent' : next.checkIn === addDays(t, 1) ? 'high' : 'normal';
}

/** Create a turnover task for a dirty room unless one is already open. Used by check-out, transfers and manual status changes. */
export function ensureTaskForRoom(roomId: string, notes?: string): HousekeepingTask | null {
  const s = useHotelStore.getState();
  const room = s.rooms.find((r) => r.id === roomId);
  if (!room || s.housekeepingTasks.some((t) => t.roomId === roomId && isOpen(t))) return null;
  const task: HousekeepingTask = { id: nextId(s.housekeepingTasks.map((t) => t.id), 'hk-'), hotelId: room.hotelId, roomId, type: 'turnover', priority: priorityForRoom(roomId), status: 'pending', date: today(), notes };
  s.setTasks((ts) => [task, ...ts]);
  return task;
}

/** Keep tasks in step when someone changes a room's status by hand. */
export function syncTasksWithRoomStatus(roomId: string, to: RoomStatus) {
  const s = useHotelStore.getState();
  const open = s.housekeepingTasks.find((t) => t.roomId === roomId && isOpen(t));
  if (to === 'dirty') { ensureTaskForRoom(roomId); return; }
  if (!open) return;
  if (to === 'cleaning' && (open.status === 'pending' || open.status === 'assigned')) s.setTasks((ts) => ts.map((t) => (t.id === open.id ? { ...t, status: 'in_progress' } : t)));
  if (to === 'inspected') s.setTasks((ts) => ts.map((t) => (t.id === open.id ? { ...t, status: 'inspected', completedAt: t.completedAt ?? today() } : t)));
}

export async function createTask(input: { roomId: string; type: HousekeepingTask['type']; priority: Priority; notes?: string; dueAt?: string; instructions?: string; idempotencyKey?: string }): Promise<Result<HousekeepingTask>> {
  if (backendMode) {
    const room = useHotelStore.getState().rooms.find((item) => item.id === input.roomId);
    if (!room) return { ok: false, error: 'Choose a room.' };
    return backendOperations.createHousekeepingTask(room.hotelId, { roomId: input.roomId, type: input.type.toUpperCase(), priority: input.priority.toUpperCase(), notes: input.notes, dueAt: input.dueAt, instructions: input.instructions }, input.idempotencyKey);
  }
  await delay(250);
  const s = useHotelStore.getState();
  const room = s.rooms.find((r) => r.id === input.roomId);
  if (!room) return { ok: false, error: 'Choose a room.' };
  if (room.status === 'maintenance' || room.status === 'out_of_service') return { ok: false, error: `Room ${room.number} is ${room.status.replace('_', ' ')}. Resolve the maintenance request first.` };
  if (s.housekeepingTasks.some((t) => t.roomId === room.id && isOpen(t))) return { ok: false, error: `Room ${room.number} already has an open cleaning task.` };
  const task: HousekeepingTask = { id: nextId(s.housekeepingTasks.map((t) => t.id), 'hk-'), hotelId: room.hotelId, roomId: room.id, type: input.type, priority: input.priority, status: 'pending', date: today(), dueAt: input.dueAt, notes: input.notes?.trim() || undefined };
  s.setTasks((ts) => [task, ...ts]);
  if (input.type === 'turnover' && room.status === 'available') setRoomStatus(room.id, 'dirty');
  s.log(`Cleaning task created for room ${room.number}`, 'room');
  return { ok: true, value: task };
}

export async function assignTask(taskId: string, staffId: string): Promise<Result<HousekeepingTask>> {
  if (backendMode) {
    const task = useHotelStore.getState().housekeepingTasks.find((item) => item.id === taskId);
    return task ? backendOperations.assignHousekeepingTask(task.hotelId, taskId, staffId) : { ok: false, error: 'Task not found.' };
  }
  await delay(250);
  const s = useHotelStore.getState();
  const task = s.housekeepingTasks.find((t) => t.id === taskId);
  const staff = s.staff.find((p) => p.id === staffId);
  if (!task) return { ok: false, error: 'Task not found.' };
  if (task.status !== 'pending' && task.status !== 'assigned') return { ok: false, error: 'Only tasks that have not started can be (re)assigned.' };
  if (!staff || staff.department !== 'Housekeeping') return { ok: false, error: 'Choose a housekeeping team member.' };
  if (staff.status !== 'active') return { ok: false, error: `${staff.name} is not available (${staff.status.replace('_', ' ')}).` };
  if (staff.hotelId !== task.hotelId) return { ok: false, error: `${staff.name} works at a different property.` };
  const updated = { ...task, status: 'assigned' as const, assigneeId: staffId };
  s.setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
  const room = s.rooms.find((r) => r.id === task.roomId);
  s.log(`Housekeeping assigned room ${room?.number} to ${staff.name}`, 'room');
  return { ok: true, value: updated };
}

export async function startTask(taskId: string): Promise<Result<HousekeepingTask>> {
  if (backendMode) {
    const task = useHotelStore.getState().housekeepingTasks.find((item) => item.id === taskId);
    return task ? backendOperations.startHousekeepingTask(task.hotelId, taskId) : { ok: false, error: 'Task not found.' };
  }
  await delay(200);
  const s = useHotelStore.getState();
  const task = s.housekeepingTasks.find((t) => t.id === taskId);
  if (!task || task.status !== 'assigned') return { ok: false, error: 'Assign the task to a team member before starting it.' };
  const updated = { ...task, status: 'in_progress' as const };
  s.setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
  const room = s.rooms.find((r) => r.id === task.roomId);
  if (room && room.status === 'dirty') setRoomStatus(room.id, 'cleaning');
  s.log(`Cleaning started in room ${room?.number}`, 'room');
  return { ok: true, value: updated };
}

export async function completeTask(taskId: string, notes?: string): Promise<Result<HousekeepingTask>> {
  if (backendMode) {
    const task = useHotelStore.getState().housekeepingTasks.find((item) => item.id === taskId);
    return task ? backendOperations.completeHousekeepingTask(task.hotelId, taskId, notes) : { ok: false, error: 'Task not found.' };
  }
  await delay(200);
  const s = useHotelStore.getState();
  const task = s.housekeepingTasks.find((t) => t.id === taskId);
  if (!task || task.status !== 'in_progress') return { ok: false, error: 'Only a task in progress can be completed.' };
  const updated = { ...task, status: 'completed' as const, completedAt: today(), notes: notes?.trim() || task.notes };
  s.setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
  const room = s.rooms.find((r) => r.id === task.roomId);
  s.log(`Room ${room?.number} cleaned — awaiting inspection`, 'room');
  return { ok: true, value: updated };
}

export async function inspectTask(taskId: string, input: { inspectorId: string; checks: boolean[]; notes?: string }): Promise<Result<{ task: HousekeepingTask; passed: boolean }>> {
  if (backendMode) {
    const task = useHotelStore.getState().housekeepingTasks.find((item) => item.id === taskId);
    if (!task) return { ok: false, error: 'Task not found.' };
    const passedCount = input.checks.filter(Boolean).length;
    const passed = input.checks.length === INSPECTION_CHECKLIST.length && passedCount === INSPECTION_CHECKLIST.length;
    if (input.checks.length !== INSPECTION_CHECKLIST.length) return { ok: false, error: 'Complete the checklist.' };
    return backendOperations.inspectHousekeepingTask(task.hotelId, taskId, { result: passed ? 'APPROVED' : 'REJECTED', score: Math.round((passedCount / INSPECTION_CHECKLIST.length) * 100), notes: input.notes });
  }
  await delay(300);
  const s = useHotelStore.getState();
  const task = s.housekeepingTasks.find((t) => t.id === taskId);
  if (!task || task.status !== 'completed') return { ok: false, error: 'Only completed tasks can be inspected.' };
  const inspector = s.staff.find((p) => p.id === input.inspectorId);
  if (!inspector || inspector.department !== 'Housekeeping') return { ok: false, error: 'Choose an inspector from housekeeping.' };
  if (input.checks.length !== INSPECTION_CHECKLIST.length) return { ok: false, error: 'Complete the checklist.' };
  const passedCount = input.checks.filter(Boolean).length;
  const passed = passedCount === INSPECTION_CHECKLIST.length;
  if (!passed && !input.notes?.trim()) return { ok: false, error: 'Describe what failed so the room can be re-cleaned.' };

  const record: InspectionRecord = { id: nextId(s.inspections.map((i) => i.id), 'in-'), taskId, roomId: task.roomId, hotelId: task.hotelId, date: today(), inspectorId: inspector.id, result: passed ? 'passed' : 'failed', score: Math.round((passedCount / INSPECTION_CHECKLIST.length) * 100), notes: input.notes?.trim() || undefined };
  s.setInspections((is) => [record, ...is]);
  const updated: HousekeepingTask = passed ? { ...task, status: 'inspected' } : { ...task, status: 'assigned', completedAt: undefined, notes: input.notes?.trim() };
  s.setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
  const activeBlock = s.maintenanceRequests.some((request) => request.roomId === task.roomId && request.blocksRoom && request.status !== 'resolved');
  if (activeBlock) setRoomStatus(task.roomId, 'maintenance');
  else setRoomStatus(task.roomId, passed ? 'inspected' : 'dirty');
  const room = s.rooms.find((r) => r.id === task.roomId);
  s.log(passed ? activeBlock ? `Room ${room?.number} passed inspection but remains unavailable during maintenance` : `Room ${room?.number} passed inspection and is ready` : `Room ${room?.number} failed inspection — sent back for re-cleaning`, 'room');
  return { ok: true, value: { task: updated, passed } };
}

export async function addSupplyNote(input: { hotelId: string; item: string; level: SupplyNote['level']; note: string }): Promise<Result<SupplyNote>> {
  if (backendMode) return { ok: false, error: 'Supply notes are not part of the connected housekeeping workflow.' };
  await delay(200);
  if (!input.item.trim()) return { ok: false, error: 'Enter the item.' };
  const s = useHotelStore.getState();
  const note: SupplyNote = { id: nextId(s.supplyNotes.map((n) => n.id), 'sp-'), hotelId: input.hotelId, item: input.item.trim(), level: input.level, note: input.note.trim(), date: today() };
  s.setSupplyNotes((ns) => [note, ...ns]);
  return { ok: true, value: note };
}
