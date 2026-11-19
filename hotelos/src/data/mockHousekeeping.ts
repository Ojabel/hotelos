import type { HousekeepingTask, InspectionRecord, SupplyNote } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { mockReservations } from './mockReservations';
import { mockRooms } from './mockRooms';

const d = (o: number) => addDays(DEMO_TODAY, o);
const pad = (n: number) => String(n).padStart(3, '0');
const room = (no: string) => mockRooms.find((r) => r.number === no)!;

/** Open work mirrors the seeded room states (dirty / cleaning); history comes from completed stays. */
const open: HousekeepingTask[] = [
  { id: 'hk-001', hotelId: 'h-vi', roomId: room('205').id, type: 'turnover', priority: 'normal', status: 'pending', date: d(0), notes: 'Flagged dirty after a cancelled hold.' },
  { id: 'hk-002', hotelId: 'h-vi', roomId: room('206').id, type: 'turnover', priority: 'normal', status: 'assigned', assigneeId: 'st-004', date: d(0) },
  { id: 'hk-003', hotelId: 'h-vi', roomId: room('303').id, type: 'turnover', priority: 'urgent', status: 'pending', date: d(0), notes: 'Guest arriving today.' },
  { id: 'hk-004', hotelId: 'h-vi', roomId: room('106').id, type: 'deep', priority: 'high', status: 'in_progress', assigneeId: 'st-005', date: d(0), notes: 'Carpet shampoo and mattress flip.' },
];

const housekeepers = { 'h-vi': ['st-003', 'st-004', 'st-005'], 'h-epe': ['st-006'] } as const;

const history: HousekeepingTask[] = mockReservations
  .filter((r) => r.status === 'checked_out' && r.checkOut >= d(-8))
  .sort((a, b) => (a.checkOut < b.checkOut ? 1 : -1))
  .slice(0, 30)
  .map((r, i) => ({
    id: `hk-${pad(10 + i)}`, hotelId: r.hotelId, roomId: r.roomId, type: 'turnover' as const, priority: 'normal' as const, status: 'inspected' as const,
    assigneeId: housekeepers[r.hotelId as 'h-vi' | 'h-epe'][i % housekeepers[r.hotelId as 'h-vi' | 'h-epe'].length], date: r.checkOut, completedAt: r.checkOut,
  }));

export const mockHousekeepingTasks: HousekeepingTask[] = [...open, ...history];

export const mockInspections: InspectionRecord[] = history.flatMap((t, i) => {
  const base = { taskId: t.id, roomId: t.roomId, hotelId: t.hotelId, inspectorId: 'st-003' };
  const passed: InspectionRecord = { id: `in-${pad(i * 2 + 2)}`, ...base, date: t.date, result: 'passed', score: 100 };
  return i % 9 === 4 ? [{ id: `in-${pad(i * 2 + 1)}`, ...base, date: t.date, result: 'failed' as const, score: 67, notes: 'Bathroom mirror streaked and minibar not restocked; re-cleaned.' }, passed] : [passed];
});

export const mockSupplyNotes: SupplyNote[] = [
  { id: 'sp-001', hotelId: 'h-vi', item: 'Bath towels', level: 'low', note: 'Below par on floors 2–3; laundry return due tomorrow.', date: d(-1) },
  { id: 'sp-002', hotelId: 'h-vi', item: 'Queen fitted sheets', level: 'ok', note: 'Full par stock.', date: d(-3) },
  { id: 'sp-003', hotelId: 'h-vi', item: 'Shower gel (30ml)', level: 'low', note: 'About two days of stock left.', date: d(0) },
  { id: 'sp-004', hotelId: 'h-epe', item: 'Pool towels', level: 'out', note: 'None on the shelf; order requested.', date: d(-2) },
  { id: 'sp-005', hotelId: 'h-epe', item: 'Glass cleaner', level: 'ok', note: 'Restocked on Monday.', date: d(-4) },
];
