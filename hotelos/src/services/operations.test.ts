import { beforeEach, describe, expect, it } from 'vitest';
import { useHotelStore } from '@/store/useHotelStore';
import { folioFor } from './mockPaymentService';
import { assignTask, completeTask, createTask, inspectTask, startTask, INSPECTION_CHECKLIST } from './mockHousekeepingService';
import { assignRequest, createRequest, resolveRequest, startRequest } from './mockMaintenanceService';
import { advanceOrder, cancelOrder, chargeOrderToRoom, createOrder, orderTotal, payOrder, setTableStatus, tableState, updateOrderLines } from './mockRestaurantService';
import { checkOut } from './mockFrontDeskService';
import { changeRoomStatus } from './mockRoomService';

const st = () => useHotelStore.getState();
const room = (id: string) => st().rooms.find((r) => r.id === id)!;
const task = (id: string) => st().housekeepingTasks.find((t) => t.id === id)!;
const order = (id: string) => st().orders.find((o) => o.id === id)!;
const allPass = INSPECTION_CHECKLIST.map(() => true);

beforeEach(() => st().reset());

describe('housekeeping workflow', () => {
  it('seed: every dirty or cleaning room has an open task', () => {
    for (const r of st().rooms.filter((x) => x.status === 'dirty' || x.status === 'cleaning')) {
      expect(st().housekeepingTasks.some((t) => t.roomId === r.id && t.status !== 'inspected')).toBe(true);
    }
  });

  it('runs a room from dirty to inspected through the task steps', async () => {
    expect(room('rm-205').status).toBe('dirty');
    expect((await startTask('hk-001')).ok).toBe(false); // not assigned yet
    expect((await assignTask('hk-001', 'st-004')).ok).toBe(true);
    expect(task('hk-001').status).toBe('assigned');
    expect((await startTask('hk-001')).ok).toBe(true);
    expect(room('rm-205').status).toBe('cleaning');
    expect((await completeTask('hk-001')).ok).toBe(true);
    expect(room('rm-205').status).toBe('cleaning'); // awaiting inspection
    const r = await inspectTask('hk-001', { inspectorId: 'st-003', checks: allPass });
    expect(r.ok && r.value.passed).toBe(true);
    expect(task('hk-001').status).toBe('inspected');
    expect(room('rm-205').status).toBe('inspected');
    expect(st().inspections[0].result).toBe('passed');
  });

  it('sends a room back to dirty when inspection fails and requires a reason', async () => {
    await assignTask('hk-001', 'st-004'); await startTask('hk-001'); await completeTask('hk-001');
    const checks = allPass.map((_, i) => i !== 1);
    expect((await inspectTask('hk-001', { inspectorId: 'st-003', checks })).ok).toBe(false);
    const r = await inspectTask('hk-001', { inspectorId: 'st-003', checks, notes: 'Bathroom not restocked' });
    expect(r.ok && r.value.passed).toBe(false);
    expect(room('rm-205').status).toBe('dirty');
    expect(task('hk-001').status).toBe('assigned');
    expect(st().inspections[0].result).toBe('failed');
  });

  it('rejects assigning staff on leave, from another department or another property', async () => {
    expect((await assignTask('hk-001', 'st-013')).ok).toBe(false); // on leave
    expect((await assignTask('hk-001', 'st-007')).ok).toBe(false); // engineer
    expect((await assignTask('hk-001', 'st-006')).ok).toBe(false); // Epe attendant
  });

  it('does not release a room for booking when housekeeping inspection passes during active maintenance', async () => {
    const request = await createRequest({ hotelId: 'h-vi', roomId: 'rm-106', category: 'Plumbing', priority: 'high', description: 'Blocked drain', costEstimate: 0, blocksRoom: true });
    expect(request.ok).toBe(true);
    const hkTask = task('hk-004');
    await assignTask(hkTask.id, 'st-004'); await startTask(hkTask.id); await completeTask(hkTask.id);
    const inspected = await inspectTask(hkTask.id, { inspectorId: 'st-003', checks: allPass });
    expect(inspected.ok && inspected.value.passed).toBe(true);
    expect(room('rm-106').status).toBe('maintenance');
  });

  it('check-out creates a turnover task and a manual dirty status never duplicates it', async () => {
    const before = st().housekeepingTasks.length;
    const f = folioFor('res-006')!;
    await checkOut({ reservationId: 'res-006', payment: { amount: f.balance, method: 'cash' } });
    expect(room('rm-203').status).toBe('dirty');
    expect(st().housekeepingTasks.length).toBe(before + 1);
    expect(st().housekeepingTasks.some((t) => t.roomId === 'rm-203' && t.status === 'pending')).toBe(true);
    await changeRoomStatus('rm-104', 'dirty'); // inspected → dirty creates its own task
    await changeRoomStatus('rm-104', 'cleaning');
    expect(st().housekeepingTasks.find((t) => t.roomId === 'rm-104' && t.status === 'in_progress')).toBeTruthy();
  });

  it('refuses a second open task for the same room', async () => {
    expect((await createTask({ roomId: 'rm-205', type: 'deep', priority: 'low' })).ok).toBe(false);
  });
});

describe('maintenance workflow', () => {
  it('blocks a room while a blocking request is open and releases it for cleaning when resolved', async () => {
    const created = await createRequest({ hotelId: 'h-vi', roomId: 'rm-104', category: 'Plumbing', priority: 'high', description: 'Leak under basin', costEstimate: 20000, blocksRoom: true });
    expect(created.ok).toBe(true);
    expect(room('rm-104').status).toBe('maintenance');
    if (!created.ok) return;
    const id = created.value.id;
    expect((await startRequest(id)).ok).toBe(false); // must be assigned
    expect((await assignRequest(id, 'st-008')).ok).toBe(true);
    expect((await startRequest(id)).ok).toBe(true);
    expect((await resolveRequest(id, '')).ok).toBe(false); // notes required
    expect((await resolveRequest(id, 'Seal replaced', 18000)).ok).toBe(true);
    expect(room('rm-104').status).toBe('dirty');
    expect(st().housekeepingTasks.some((t) => t.roomId === 'rm-104' && t.status === 'pending')).toBe(true);
  });

  it('keeps the room blocked while another blocking request is still open', async () => {
    const a = await createRequest({ hotelId: 'h-vi', roomId: 'rm-104', category: 'HVAC', priority: 'normal', description: 'A', costEstimate: 0, blocksRoom: true });
    // second request on an already-blocked room
    const b = await createRequest({ hotelId: 'h-vi', roomId: 'rm-104', category: 'Electrical', priority: 'normal', description: 'B', costEstimate: 0, blocksRoom: true });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    for (const r of [a.value.id]) { await assignRequest(r, 'st-007'); await startRequest(r); await resolveRequest(r, 'Fixed'); }
    expect(room('rm-104').status).toBe('maintenance');
  });

  it('will not block an occupied room', async () => {
    const r = await createRequest({ hotelId: 'h-vi', roomId: 'rm-101', category: 'HVAC', priority: 'high', description: 'x', costEstimate: 0, blocksRoom: true });
    expect(r.ok).toBe(false);
    expect(room('rm-101').status).toBe('occupied');
  });

  it('releases the seeded blocked rooms: out-of-service room goes back through cleaning', async () => {
    await startRequest('mt-002');
    expect((await resolveRequest('mt-002', 'Bathroom complete')).ok).toBe(true);
    expect(room('rm-305').status).toBe('dirty');
  });
});

describe('restaurant and room service', () => {
  const lines = [{ menuItemId: 'mn-005', qty: 2 }, { menuItemId: 'mn-013', qty: 2 }];

  it('seed: occupied tables are exactly those with open dine-in orders', () => {
    const occupied = st().tables.filter((t) => tableState(t, st().orders) === 'occupied').map((t) => t.number).sort();
    expect(occupied).toEqual(['E2', 'T1', 'T3', 'T5', 'T7']);
  });

  it('totals orders and runs the kitchen flow in order', async () => {
    const r = await createOrder({ hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t6', covers: 4, lines });
    if (!r.ok) throw new Error(r.error);
    expect(orderTotal(r.value)).toBe(9500 * 2 + 2500 * 2);
    expect((await payOrder(r.value.id, 'cash')).ok).toBe(false); // not served yet
    for (const s of ['preparing', 'ready', 'served']) { await advanceOrder(r.value.id); expect(order(r.value.id).status).toBe(s); }
    expect((await advanceOrder(r.value.id)).ok).toBe(false);
    expect((await updateOrderLines(r.value.id, lines)).ok).toBe(false); // too late to edit
  });

  it('rejects orders for unavailable items, full tables and over-capacity parties', async () => {
    expect((await createOrder({ hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t6', covers: 2, lines: [{ menuItemId: 'mn-012', qty: 1 }] })).ok).toBe(false); // unavailable
    expect((await createOrder({ hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t3', covers: 2, lines })).ok).toBe(false); // occupied
    expect((await createOrder({ hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t1', covers: 2, lines })).ok).toBe(false); // occupied
    expect((await createOrder({ hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t10', covers: 9, lines })).ok).toBe(false); // seats 4
  });

  it('settling a table order moves its table to cleaning until cleared', async () => {
    expect((await payOrder('ord-0004', 'pos')).ok).toBe(true);
    expect(order('ord-0004').payment).toBe('paid');
    const t7 = st().tables.find((t) => t.id === 'tb-vi-t7')!;
    expect(tableState(t7, st().orders)).toBe('cleaning');
    await setTableStatus('tb-vi-t7', 'free');
    expect(tableState(st().tables.find((t) => t.id === 'tb-vi-t7')!, st().orders)).toBe('free');
    expect((await setTableStatus('tb-vi-t3', 'free')).ok).toBe(false); // still has an open order
  });

  it('charges a served room-service order to the folio exactly once', async () => {
    const before = folioFor('res-006')!;
    const total = orderTotal(order('ord-0010'));
    expect((await chargeOrderToRoom('ord-0007')).ok).toBe(false); // not served yet
    const r = await chargeOrderToRoom('ord-0010');
    expect(r.ok).toBe(true);
    const after = folioFor('res-006')!;
    expect(after.extrasTotal).toBe(before.extrasTotal + total);
    expect(after.balance).toBe(before.balance + total);
    expect(order('ord-0010').payment).toBe('charged_to_room');
    expect((await chargeOrderToRoom('ord-0010')).ok).toBe(false); // no double charge
    expect((await payOrder('ord-0010', 'cash')).ok).toBe(false);
  });

  it('only accepts room-service orders for in-house guests', async () => {
    expect((await createOrder({ hotelId: 'h-vi', type: 'room_service', roomId: 'rm-201', lines })).ok).toBe(false); // reserved, not checked in
    const ok = await createOrder({ hotelId: 'h-vi', type: 'room_service', roomId: 'rm-101', lines });
    expect(ok.ok && ok.value.guestName).toBe('Adaeze Okonkwo');
  });

  it('cancels only new or preparing orders', async () => {
    expect((await cancelOrder('ord-0002')).ok).toBe(true);
    expect((await cancelOrder('ord-0003')).ok).toBe(false); // ready
    expect(tableState(st().tables.find((t) => t.id === 'tb-vi-t5')!, st().orders)).toBe('free');
  });
});
