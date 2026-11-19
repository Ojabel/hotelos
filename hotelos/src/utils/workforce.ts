import type { IsoDate, LeaveRequest, LeaveType, ShiftAssignment, ShiftType, StaffMember } from '@/types';
import { addDays, nightsBetween } from './demoClock';

export const SHIFTS: Record<ShiftType, { label: string; start: string; end: string }> = {
  morning: { label: 'Morning', start: '06:00', end: '14:00' },
  afternoon: { label: 'Afternoon', start: '14:00', end: '22:00' },
  night: { label: 'Night', start: '22:00', end: '06:00' },
};

export const ANNUAL_LEAVE_DAYS = 21;
export const LATE_GRACE_MINUTES = 15;
export const MAX_WORKING_DAYS_PER_WEEK = 6;

export const weekdayOf = (iso: IsoDate) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** Monday of the week containing the date. */
export const weekStart = (iso: IsoDate) => addDays(iso, -((weekdayOf(iso) + 6) % 7));
export const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const isLate = (shift: ShiftType, clockIn: string) => minutes(clockIn) > minutes(SHIFTS[shift].start) + LATE_GRACE_MINUTES && shift !== 'night';

export const inclusiveDays = (start: IsoDate, end: IsoDate) => nightsBetween(start, end) + 1;
export const rangesOverlap = (aS: IsoDate, aE: IsoDate, bS: IsoDate, bE: IsoDate) => aS <= bE && bS <= aE;

export const approvedLeaveOn = (staffId: string, date: IsoDate, leave: LeaveRequest[]) => leave.find((l) => l.staffId === staffId && l.status === 'approved' && l.start <= date && date <= l.end);

export function annualLeaveUsed(staffId: string, year: string, leave: LeaveRequest[], includePending = false) {
  return leave.filter((l) => l.staffId === staffId && l.type === 'annual' && l.start.startsWith(year) && (l.status === 'approved' || (includePending && l.status === 'pending'))).reduce((s, l) => s + inclusiveDays(l.start, l.end), 0);
}

/** Why a staff member cannot be rostered on this shift, or null if they can. */
export function rosterViolation(staff: StaffMember, date: IsoDate, shift: ShiftType, roster: ShiftAssignment[], leave: LeaveRequest[], today: IsoDate): string | null {
  if (date < today) return 'Past shifts cannot be changed.';
  if (staff.status === 'inactive') return `${staff.name} is no longer employed.`;
  if (approvedLeaveOn(staff.id, date, leave)) return `${staff.name} is on approved leave on this date.`;
  const mine = roster.filter((r) => r.staffId === staff.id && r.date !== date);
  const prev = mine.find((r) => r.date === addDays(date, -1));
  const next = mine.find((r) => r.date === addDays(date, 1));
  if (shift === 'morning' && prev?.shift === 'night') return 'Not enough rest: a morning shift cannot follow a night shift.';
  if (shift === 'night' && next?.shift === 'morning') return 'Not enough rest: a night shift cannot be followed by a morning shift.';
  const ws = weekStart(date);
  const days = mine.filter((r) => r.date >= ws && r.date <= addDays(ws, 6)).length + 1;
  if (days > MAX_WORKING_DAYS_PER_WEEK) return `That would be ${days} working days this week (maximum ${MAX_WORKING_DAYS_PER_WEEK}).`;
  return null;
}

export const LEAVE_LABEL: Record<LeaveType, string> = { annual: 'Annual leave', sick: 'Sick leave', unpaid: 'Unpaid leave' };
