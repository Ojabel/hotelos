import { beforeEach, describe, expect, it } from 'vitest';
import { useHotelStore } from '@/store/useHotelStore';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';
import { computePayslip } from '@/utils/payroll';
import { annualLeaveUsed, isLate, weekStart, weekdayOf } from '@/utils/workforce';
import type { AttendanceRecord, LeaveRequest, StaffMember } from '@/types';
import { addAdjustment, advancePayroll, clockIn, clockOut, decideLeave, requestLeave, saveStaff, setShift, setStaffActive } from './mockWorkforceService';

const st = () => useHotelStore.getState();
const T = DEMO_TODAY;
const MONTH = T.slice(0, 7);

beforeEach(() => st().reset());

describe('date helpers', () => {
  it('finds weekdays and week starts', () => {
    expect(weekdayOf('2026-11-08')).toBe(0); // Sunday
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
  });
  it('treats a clock-in more than 15 minutes after the start as late', () => {
    expect(isLate('morning', '06:15')).toBe(false);
    expect(isLate('morning', '06:16')).toBe(true);
    expect(isLate('afternoon', '14:30')).toBe(true);
  });
});

describe('roster rules', () => {
  it('seed: nobody is rostered on approved leave or past two shifts in a day', () => {
    for (const l of st().leave.filter((x) => x.status === 'approved')) {
      expect(st().roster.some((r) => r.staffId === l.staffId && r.date >= l.start && r.date <= l.end)).toBe(false);
    }
    const keys = st().roster.map((r) => r.id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('blocks a morning shift after a night shift and a night shift before a morning shift', async () => {
    expect((await setShift('st-015', addDays(T, 1), 'morning')).ok).toBe(false); // night on Sunday
    expect((await setShift('st-004', T, 'night')).ok).toBe(false); // morning on Monday
  });

  it('caps the week at six working days', async () => {
    const saturday = addDays(T, 6); // st-003 already works Mon–Fri and Sunday that week
    const r = await setShift('st-003', saturday, 'morning');
    expect(r.ok).toBe(false);
    expect((await setShift('st-003', saturday, 'off')).ok).toBe(true);
  });

  it('rejects shifts during leave, in the past, and for inactive staff', async () => {
    expect((await setShift('st-013', addDays(T, 1), 'morning')).ok).toBe(false);
    expect((await setShift('st-004', addDays(T, -1), 'afternoon')).ok).toBe(false);
    await setStaffActive('st-017', false);
    expect((await setShift('st-017', addDays(T, 2), 'morning')).ok).toBe(false);
  });

  it('assigns and clears shifts', async () => {
    const day = addDays(T, 2);
    expect(st().roster.some((r) => r.staffId === 'st-012' && r.date === day)).toBe(true);
    expect((await setShift('st-012', day, 'afternoon')).ok).toBe(true);
    expect(st().roster.find((r) => r.staffId === 'st-012' && r.date === day)!.shift).toBe('afternoon');
    await setShift('st-012', day, 'off');
    expect(st().roster.some((r) => r.staffId === 'st-012' && r.date === day)).toBe(false);
  });
});

describe('attendance', () => {
  it('marks late arrivals, blocks duplicates and unrostered staff, and checks clock-out order', async () => {
    const late = await clockIn('st-008', '14:20'); // afternoon shift today
    expect(late.ok && late.value.status).toBe('late');
    expect((await clockIn('st-008', '14:21')).ok).toBe(false);
    expect((await clockIn('st-007', '06:00')).ok).toBe(false); // not rostered on Sunday
    expect((await clockOut('st-008', '14:00')).ok).toBe(false);
    expect((await clockOut('st-008', '22:05')).ok).toBe(true);
    expect((await clockOut('st-008', '22:10')).ok).toBe(false);
  });

  it('records on-time arrivals as present', async () => {
    const r = await clockIn('st-011', '14:05');
    expect(r.ok && r.value.status).toBe('present');
  });
});

describe('leave', () => {
  const base = { staffId: 'st-004', type: 'annual' as const, reason: 'Trip' };

  it('rejects overlaps, backwards ranges and past-dated non-sick leave', async () => {
    expect((await requestLeave({ ...base, start: addDays(T, 17), end: addDays(T, 18) })).ok).toBe(false); // overlaps pending lv-003
    expect((await requestLeave({ ...base, start: addDays(T, 30), end: addDays(T, 29) })).ok).toBe(false);
    expect((await requestLeave({ ...base, start: addDays(T, -3), end: addDays(T, -2) })).ok).toBe(false);
    expect((await requestLeave({ ...base, type: 'sick', start: addDays(T, -3), end: addDays(T, -2) })).ok).toBe(true);
  });

  it('enforces the annual allowance including pending requests', async () => {
    expect(annualLeaveUsed('st-003', '2026', st().leave)).toBe(5);
    expect((await requestLeave({ staffId: 'st-003', type: 'annual', start: addDays(T, 40), end: addDays(T, 59), reason: 'x' })).ok).toBe(false); // 5 + 20 > 21
    expect((await requestLeave({ staffId: 'st-003', type: 'annual', start: addDays(T, 40), end: addDays(T, 55), reason: 'x' })).ok).toBe(true); // exactly 21
  });

  it('approving leave clears upcoming shifts and flags staff on leave today; decisions are final', async () => {
    expect(st().roster.some((r) => r.staffId === 'st-016' && r.date === addDays(T, 1))).toBe(true);
    expect((await decideLeave('lv-004', 'approved')).ok).toBe(true); // sick today → tomorrow
    expect(st().roster.some((r) => r.staffId === 'st-016' && r.date >= T && r.date <= addDays(T, 1))).toBe(false);
    expect(st().staff.find((p) => p.id === 'st-016')!.status).toBe('on_leave');
    expect((await decideLeave('lv-004', 'rejected')).ok).toBe(false);
    const r = await decideLeave('lv-003', 'rejected');
    expect(r.ok).toBe(true);
    expect(st().roster.some((x) => x.staffId === 'st-004' && x.date === addDays(T, 16))).toBe(true); // untouched
  });
});

describe('staff records', () => {
  const base = { name: 'New Hire', title: 'Cook', department: 'Restaurant' as const, hotelId: 'h-vi', phone: '+234 801 234 5678', email: 'new.hire@hotelos.demo', monthlySalary: 200000, hiredAt: DEMO_TODAY };

  it('validates and creates staff', async () => {
    expect((await saveStaff({ ...base, email: 'bad' })).ok).toBe(false);
    expect((await saveStaff({ ...base, monthlySalary: 0 })).ok).toBe(false);
    expect((await saveStaff({ ...base, email: 'chioma.eze@hotelos.demo' })).ok).toBe(false); // duplicate
    const ok = await saveStaff(base);
    expect(ok.ok && ok.value.id).toBe('st-019');
  });

  it('will not deactivate someone with open work, and removes future shifts when it can', async () => {
    expect((await setStaffActive('st-004', false)).ok).toBe(false); // open housekeeping task
    expect((await setStaffActive('st-007', false)).ok).toBe(false); // open maintenance work
    expect((await setStaffActive('st-017', false)).ok).toBe(true);
    expect(st().roster.some((r) => r.staffId === 'st-017' && r.date >= T)).toBe(false);
  });
});

describe('payroll calculations (illustrative)', () => {
  const person = { id: 'st-x', name: 'Test', title: 't', department: 'Restaurant', hotelId: 'h-vi', phone: '', email: '', status: 'active', monthlySalary: 300000, hiredAt: '2020-01-01' } as StaffMember;
  const absent = (n: number): AttendanceRecord[] => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, staffId: 'st-x', date: `2026-11-0${i + 1}`, status: 'absent' as const }));

  it('computes allowance, pension, PAYE and net pay', () => {
    const p = computePayslip(person, '2026-11', [], [], []);
    expect(p.allowance).toBe(30000);
    expect(p.gross).toBe(330000);
    expect(p.pension).toBe(24000);
    expect(p.paye).toBe(21420);
    expect(p.net).toBe(330000 - 24000 - 21420);
  });

  it('deducts absent days at one thirtieth of basic and includes bonuses and deductions', () => {
    const adj = [{ id: 'a', month: '2026-11', staffId: 'st-x', label: 'Bonus', amount: 10000 }, { id: 'b', month: '2026-11', staffId: 'st-x', label: 'Uniform', amount: -5000 }, { id: 'c', month: '2026-10', staffId: 'st-x', label: 'Other month', amount: 99999 }];
    const p = computePayslip(person, '2026-11', absent(2), [], adj);
    expect(p.absenceDays).toBe(2);
    expect(p.absenceDeduction).toBe(20000);
    expect(p.bonuses).toBe(10000);
    expect(p.otherDeductions).toBe(5000);
    expect(p.gross).toBe(340000);
    expect(p.net).toBe(340000 - 24000 - Math.round((340000 - 24000) * 0.07) - 20000 - 5000);
  });

  it('counts approved unpaid leave inside the month as unpaid days', () => {
    const leave: LeaveRequest[] = [{ id: 'l', staffId: 'st-x', type: 'unpaid', start: '2026-10-29', end: '2026-11-02', status: 'approved', reason: '' }];
    expect(computePayslip(person, '2026-11', [], leave, []).absenceDays).toBe(2);
  });

  it('only lets a draft payroll be adjusted and moves draft → approved → paid in order', async () => {
    const prev = st().payrollRuns.find((r) => r.status === 'paid')!.month;
    expect((await addAdjustment({ month: prev, staffId: 'st-004', label: 'x', amount: 1000 })).ok).toBe(false);
    expect((await addAdjustment({ month: MONTH, staffId: 'st-004', label: 'Overtime', amount: 12000 })).ok).toBe(true);
    expect((await addAdjustment({ month: MONTH, staffId: 'st-004', label: '', amount: 5 })).ok).toBe(false);
    expect((await advancePayroll(MONTH, 'paid')).ok).toBe(false); // must approve first
    expect((await advancePayroll(MONTH, 'approved')).ok).toBe(true);
    expect((await addAdjustment({ month: MONTH, staffId: 'st-004', label: 'Late', amount: 1000 })).ok).toBe(false);
    expect((await advancePayroll(MONTH, 'paid')).ok).toBe(true);
    expect((await advancePayroll(MONTH, 'paid')).ok).toBe(false);
  });

  it('refuses approval when a deduction would make net pay non-positive', async () => {
    await addAdjustment({ month: MONTH, staffId: 'st-004', label: 'Huge deduction', amount: -900000 });
    const r = await advancePayroll(MONTH, 'approved');
    expect(r.ok).toBe(false);
  });
});
