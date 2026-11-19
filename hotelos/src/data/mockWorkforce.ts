import type { AttendanceRecord, LeaveRequest, PayrollAdjustment, PayrollRun, ShiftAssignment, ShiftType } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { isLate, SHIFTS, weekdayOf } from '@/utils/workforce';

const d = (o: number) => addDays(DEMO_TODAY, o);
const pad = (n: number) => String(n).padStart(3, '0');

export const mockLeave: LeaveRequest[] = [
  { id: 'lv-001', staffId: 'st-013', type: 'annual', start: d(-3), end: d(10), status: 'approved', reason: 'Family event' },
  { id: 'lv-002', staffId: 'st-007', type: 'sick', start: d(-20), end: d(-18), status: 'approved', reason: 'Malaria' },
  { id: 'lv-003', staffId: 'st-004', type: 'annual', start: d(15), end: d(19), status: 'pending', reason: 'Travel home' },
  { id: 'lv-004', staffId: 'st-016', type: 'sick', start: d(0), end: d(1), status: 'pending', reason: 'Fever' },
  { id: 'lv-005', staffId: 'st-003', type: 'annual', start: d(-45), end: d(-41), status: 'approved', reason: 'Rest' },
  { id: 'lv-006', staffId: 'st-010', type: 'unpaid', start: d(-30), end: d(-26), status: 'rejected', reason: 'Personal errand (declined: peak season)' },
];

const PATTERNS: Record<string, { shift: ShiftType; days: number[] }> = {
  'st-001': { shift: 'morning', days: [1, 2, 3, 4, 5] }, 'st-002': { shift: 'morning', days: [0, 1, 2, 3, 4] },
  'st-003': { shift: 'morning', days: [0, 1, 2, 3, 4, 5] }, 'st-004': { shift: 'morning', days: [0, 1, 2, 3, 4] },
  'st-005': { shift: 'morning', days: [0, 2, 3, 4, 5] }, 'st-006': { shift: 'morning', days: [0, 1, 2, 3, 4] },
  'st-007': { shift: 'morning', days: [1, 2, 3, 4, 5] }, 'st-008': { shift: 'afternoon', days: [0, 1, 2, 3, 4] },
  'st-009': { shift: 'morning', days: [1, 2, 3, 4, 5] }, 'st-010': { shift: 'afternoon', days: [1, 2, 3, 4, 5, 6] },
  'st-011': { shift: 'afternoon', days: [0, 2, 3, 4, 5, 6] }, 'st-012': { shift: 'morning', days: [1, 2, 3, 4, 5] },
  'st-013': { shift: 'morning', days: [1, 2, 3, 4, 5] }, 'st-014': { shift: 'afternoon', days: [2, 3, 4, 5, 6] },
  'st-015': { shift: 'night', days: [0, 3, 4, 5, 6] }, 'st-016': { shift: 'afternoon', days: [1, 2, 3, 4, 5, 6] },
  'st-017': { shift: 'morning', days: [0, 3, 4, 5, 6] }, 'st-018': { shift: 'night', days: [2, 3, 4, 5, 6] },
};

const onLeave = (staffId: string, date: string) => mockLeave.some((l) => l.staffId === staffId && l.status === 'approved' && l.start <= date && date <= l.end);

export const mockRoster: ShiftAssignment[] = (() => {
  const out: ShiftAssignment[] = [];
  for (let o = -21; o <= 27; o++) {
    const date = d(o);
    for (const [staffId, p] of Object.entries(PATTERNS)) {
      if (p.days.includes(weekdayOf(date)) && !onLeave(staffId, date)) out.push({ id: `${staffId}:${date}`, staffId, date, shift: p.shift });
    }
  }
  return out;
})();

const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const mockAttendance: AttendanceRecord[] = (() => {
  const out: AttendanceRecord[] = [];
  const push = (r: Omit<AttendanceRecord, 'id'>) => out.push({ id: `at-${pad(out.length + 1)}`, ...r });
  for (const a of mockRoster) {
    if (a.date > DEMO_TODAY) continue;
    const n = Number(a.staffId.replace('st-', ''));
    const day = Number(a.date.slice(8));
    const h = (n * 7 + day * 13) % 23;
    const [sh, sm] = SHIFTS[a.shift].start.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = Number(SHIFTS[a.shift].end.slice(0, 2)) * 60;
    if (a.date === DEMO_TODAY) {
      if (a.shift !== 'morning') continue; // later shifts have not started yet
      const inTime = hhmm(start + (h === 5 ? 24 : h % 5));
      push({ staffId: a.staffId, date: a.date, status: isLate(a.shift, inTime) ? 'late' : 'present', clockIn: inTime });
      continue;
    }
    if (h === 3) { push({ staffId: a.staffId, date: a.date, status: 'absent' }); continue; }
    const inTime = hhmm(start + (h === 5 || h === 11 ? 22 : h % 5));
    push({ staffId: a.staffId, date: a.date, status: isLate(a.shift, inTime) ? 'late' : 'present', clockIn: inTime, clockOut: hhmm(end + (h % 7)) });
  }
  for (const l of mockLeave.filter((x) => x.status === 'approved')) {
    for (let day = l.start; day <= l.end && day <= DEMO_TODAY; day = addDays(day, 1)) push({ staffId: l.staffId, date: day, status: 'leave' });
  }
  return out;
})();

export const mockAdjustments: PayrollAdjustment[] = [
  { id: 'pa-001', month: DEMO_TODAY.slice(0, 7), staffId: 'st-011', label: 'Event catering bonus', amount: 30000 },
  { id: 'pa-002', month: DEMO_TODAY.slice(0, 7), staffId: 'st-004', label: 'Uniform replacement', amount: -5000 },
];

const prevMonth = (n: number) => { const [y, m] = DEMO_TODAY.slice(0, 7).split('-').map(Number); const t = y * 12 + (m - 1) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
export const mockPayrollRuns: PayrollRun[] = [
  { month: prevMonth(2), status: 'paid' }, { month: prevMonth(1), status: 'paid' }, { month: DEMO_TODAY.slice(0, 7), status: 'draft' },
];
