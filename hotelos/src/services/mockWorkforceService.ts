import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import { computePayslip, isPayable } from '@/utils/payroll';
import { ANNUAL_LEAVE_DAYS, annualLeaveUsed, inclusiveDays, isLate, rangesOverlap, rosterViolation } from '@/utils/workforce';
import type { AttendanceRecord, LeaveRequest, LeaveType, Result, ShiftType, StaffMember } from '@/types';
import { delay } from './delay';

/** MOCK SERVICE — backend integration point for staff, rosters, attendance, leave and payroll. */
const nextId = (ids: string[], prefix: string, w = 3) => `${prefix}${String(Math.max(0, ...ids.map((i) => Number(i.replace(prefix, '')) || 0)) + 1).padStart(w, '0')}`;

// ---------- staff ----------
export type StaffInput = Omit<StaffMember, 'id' | 'status'> & { id?: string };

export async function saveStaff(input: StaffInput): Promise<Result<StaffMember>> {
  await delay(250);
  const s = useHotelStore.getState();
  if (!input.name.trim()) return { ok: false, error: 'Enter the employee’s name.' };
  if (!input.title.trim()) return { ok: false, error: 'Enter a job title.' };
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: 'Enter a valid email address.' };
  if (input.phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Enter a valid phone number.' };
  if (!(input.monthlySalary > 0)) return { ok: false, error: 'Monthly salary must be above zero.' };
  if (input.hiredAt > today()) return { ok: false, error: 'Start date cannot be in the future.' };
  if (s.staff.some((p) => p.id !== input.id && p.email.toLowerCase() === input.email.trim().toLowerCase())) return { ok: false, error: 'Another employee already uses this email.' };
  const existing = input.id ? s.staff.find((p) => p.id === input.id) : undefined;
  const member: StaffMember = { ...input, id: input.id ?? nextId(s.staff.map((p) => p.id), 'st-'), name: input.name.trim(), title: input.title.trim(), email: input.email.trim().toLowerCase(), status: existing?.status ?? 'active' };
  s.setStaff((ps) => (existing ? ps.map((p) => (p.id === member.id ? member : p)) : [...ps, member]));
  s.log(existing ? `${member.name}'s record updated` : `${member.name} joined as ${member.title}`, 'system');
  return { ok: true, value: member };
}

export async function setStaffActive(id: string, active: boolean): Promise<Result<StaffMember>> {
  await delay(250);
  const s = useHotelStore.getState();
  const p = s.staff.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Employee not found.' };
  if (!active && s.housekeepingTasks.some((t) => t.assigneeId === id && t.status !== 'inspected')) return { ok: false, error: `${p.name} has open housekeeping tasks. Reassign them first.` };
  if (!active && s.maintenanceRequests.some((m) => m.assigneeId === id && m.status !== 'resolved')) return { ok: false, error: `${p.name} has open maintenance work. Reassign it first.` };
  const updated: StaffMember = { ...p, status: active ? 'active' : 'inactive' };
  s.setStaff((ps) => ps.map((x) => (x.id === id ? updated : x)));
  if (!active) s.setRoster((rs) => rs.filter((r) => !(r.staffId === id && r.date >= today())));
  s.log(`${p.name} ${active ? 'reactivated' : 'deactivated'}`, 'system');
  return { ok: true, value: updated };
}

// ---------- roster ----------
export async function setShift(staffId: string, date: string, shift: ShiftType | 'off'): Promise<Result<true>> {
  await delay(120);
  const s = useHotelStore.getState();
  const p = s.staff.find((x) => x.id === staffId);
  if (!p) return { ok: false, error: 'Employee not found.' };
  if (shift === 'off') {
    if (date < today()) return { ok: false, error: 'Past shifts cannot be changed.' };
    s.setRoster((rs) => rs.filter((r) => !(r.staffId === staffId && r.date === date)));
    return { ok: true, value: true };
  }
  const v = rosterViolation(p, date, shift, s.roster, s.leave, today());
  if (v) return { ok: false, error: v };
  s.setRoster((rs) => [...rs.filter((r) => !(r.staffId === staffId && r.date === date)), { id: `${staffId}:${date}`, staffId, date, shift }]);
  return { ok: true, value: true };
}

// ---------- attendance ----------
export async function clockIn(staffId: string, time: string): Promise<Result<AttendanceRecord>> {
  await delay(150);
  const s = useHotelStore.getState();
  const p = s.staff.find((x) => x.id === staffId);
  const t = today();
  const shift = s.roster.find((r) => r.staffId === staffId && r.date === t);
  if (!p) return { ok: false, error: 'Employee not found.' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'Enter the time as HH:MM.' };
  if (!shift) return { ok: false, error: `${p.name} is not rostered today.` };
  if (s.attendance.some((a) => a.staffId === staffId && a.date === t)) return { ok: false, error: `${p.name} has already clocked in.` };
  const rec: AttendanceRecord = { id: nextId(s.attendance.map((a) => a.id), 'at-'), staffId, date: t, status: isLate(shift.shift, time) ? 'late' : 'present', clockIn: time };
  s.setAttendance((as) => [...as, rec]);
  return { ok: true, value: rec };
}

export async function clockOut(staffId: string, time: string): Promise<Result<AttendanceRecord>> {
  await delay(150);
  const s = useHotelStore.getState();
  const t = today();
  const rec = s.attendance.find((a) => a.staffId === staffId && a.date === t);
  if (!rec || !rec.clockIn) return { ok: false, error: 'Clock in first.' };
  if (rec.clockOut) return { ok: false, error: 'Already clocked out.' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'Enter the time as HH:MM.' };
  const shift = s.roster.find((r) => r.staffId === staffId && r.date === t)?.shift;
  if (shift !== 'night' && time <= rec.clockIn) return { ok: false, error: 'Clock-out must be after clock-in.' };
  const updated = { ...rec, clockOut: time };
  s.setAttendance((as) => as.map((a) => (a.id === rec.id ? updated : a)));
  return { ok: true, value: updated };
}

export async function markAbsent(staffId: string): Promise<Result<AttendanceRecord>> {
  await delay(150);
  const s = useHotelStore.getState();
  const t = today();
  if (!s.roster.some((r) => r.staffId === staffId && r.date === t)) return { ok: false, error: 'This person is not rostered today.' };
  if (s.attendance.some((a) => a.staffId === staffId && a.date === t)) return { ok: false, error: 'Attendance is already recorded for today.' };
  const rec: AttendanceRecord = { id: nextId(s.attendance.map((a) => a.id), 'at-'), staffId, date: t, status: 'absent' };
  s.setAttendance((as) => [...as, rec]);
  return { ok: true, value: rec };
}

// ---------- leave ----------
export async function requestLeave(input: { staffId: string; type: LeaveType; start: string; end: string; reason: string }): Promise<Result<LeaveRequest>> {
  await delay(250);
  const s = useHotelStore.getState();
  const p = s.staff.find((x) => x.id === input.staffId);
  if (!p) return { ok: false, error: 'Choose an employee.' };
  if (input.end < input.start) return { ok: false, error: 'The end date must be on or after the start date.' };
  if (input.type !== 'sick' && input.start < today()) return { ok: false, error: 'Only sick leave can start in the past.' };
  if (!input.reason.trim()) return { ok: false, error: 'Give a reason.' };
  if (s.leave.some((l) => l.staffId === input.staffId && l.status !== 'rejected' && rangesOverlap(l.start, l.end, input.start, input.end))) return { ok: false, error: 'This overlaps another leave request.' };
  if (input.type === 'annual') {
    const days = inclusiveDays(input.start, input.end);
    const used = annualLeaveUsed(input.staffId, input.start.slice(0, 4), s.leave, true);
    if (used + days > ANNUAL_LEAVE_DAYS) return { ok: false, error: `Only ${Math.max(0, ANNUAL_LEAVE_DAYS - used)} annual leave days remain for ${input.start.slice(0, 4)}.` };
  }
  const req: LeaveRequest = { id: nextId(s.leave.map((l) => l.id), 'lv-'), ...input, reason: input.reason.trim(), status: 'pending' };
  s.setLeave((ls) => [req, ...ls]);
  return { ok: true, value: req };
}

export async function decideLeave(id: string, decision: 'approved' | 'rejected'): Promise<Result<LeaveRequest>> {
  await delay(250);
  const s = useHotelStore.getState();
  const req = s.leave.find((l) => l.id === id);
  if (!req) return { ok: false, error: 'Leave request not found.' };
  if (req.status !== 'pending') return { ok: false, error: `This request is already ${req.status}.` };
  const updated = { ...req, status: decision };
  s.setLeave((ls) => ls.map((l) => (l.id === id ? updated : l)));
  const p = s.staff.find((x) => x.id === req.staffId)!;
  if (decision === 'approved') {
    s.setRoster((rs) => rs.filter((r) => !(r.staffId === req.staffId && r.date >= req.start && r.date <= req.end && r.date >= today())));
    if (req.start <= today() && today() <= req.end) s.setStaff((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'on_leave' } : x)));
  }
  s.log(`${p.name}'s ${req.type} leave ${decision}`, 'system');
  return { ok: true, value: updated };
}

// ---------- payroll (simulated) ----------
const runOf = (month: string) => useHotelStore.getState().payrollRuns.find((r) => r.month === month);

export async function addAdjustment(input: { month: string; staffId: string; label: string; amount: number }): Promise<Result<true>> {
  await delay(150);
  const s = useHotelStore.getState();
  if (runOf(input.month)?.status !== 'draft') return { ok: false, error: 'Only a draft payroll can be adjusted.' };
  if (!input.label.trim()) return { ok: false, error: 'Describe the adjustment.' };
  if (!Number.isFinite(input.amount) || input.amount === 0) return { ok: false, error: 'Enter an amount other than zero (negative for a deduction).' };
  const p = s.staff.find((x) => x.id === input.staffId);
  if (!p || !isPayable(p, input.month)) return { ok: false, error: 'This employee is not on this month’s payroll.' };
  s.setAdjustments((as) => [...as, { id: nextId(as.map((a) => a.id), 'pa-'), month: input.month, staffId: input.staffId, label: input.label.trim(), amount: Math.round(input.amount) }]);
  return { ok: true, value: true };
}

export async function removeAdjustment(id: string): Promise<Result<true>> {
  const s = useHotelStore.getState();
  const a = s.adjustments.find((x) => x.id === id);
  if (!a) return { ok: false, error: 'Adjustment not found.' };
  if (runOf(a.month)?.status !== 'draft') return { ok: false, error: 'Only a draft payroll can be adjusted.' };
  s.setAdjustments((as) => as.filter((x) => x.id !== id));
  return { ok: true, value: true };
}

export async function advancePayroll(month: string, to: 'approved' | 'paid'): Promise<Result<true>> {
  await delay(300);
  const s = useHotelStore.getState();
  const run = runOf(month);
  if (!run) return { ok: false, error: 'No payroll run for this month.' };
  if ((run.status === 'draft' && to !== 'approved') || (run.status === 'approved' && to !== 'paid') || run.status === 'paid') return { ok: false, error: run.status === 'paid' ? 'This payroll is already paid.' : `A ${run.status} payroll can only move to ${run.status === 'draft' ? 'approved' : 'paid'}.` };
  if (to === 'approved' && s.staff.filter((p) => isPayable(p, month)).some((p) => computePayslip(p, month, s.attendance, s.leave, s.adjustments).net <= 0)) return { ok: false, error: 'An employee’s net pay is zero or negative. Review the adjustments first.' };
  s.setPayrollRuns((rs) => rs.map((r) => (r.month === month ? { ...r, status: to } : r)));
  s.log(`Payroll for ${month} ${to === 'paid' ? 'marked as paid (simulated)' : 'approved'}`, 'payment');
  return { ok: true, value: true };
}

