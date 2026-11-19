import type { AttendanceRecord, LeaveRequest, PayrollAdjustment, StaffMember } from '@/types';
import { addDays } from './demoClock';
import { inclusiveDays } from './workforce';

/**
 * ILLUSTRATIVE payroll maths for the demo UI only — flat rates, not tax advice, nothing is paid.
 * Rates are constants so a future backend can replace them.
 */
export const ALLOWANCE_RATE = 0.1;
export const PENSION_RATE = 0.08;
export const PAYE_RATE = 0.07;

export interface Payslip {
  staffId: string;
  basic: number;
  allowance: number;
  bonuses: number;
  gross: number;
  pension: number;
  paye: number;
  absenceDays: number;
  absenceDeduction: number;
  otherDeductions: number;
  net: number;
}

const monthEnd = (month: string) => { const [y, m] = month.split('-').map(Number); return addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1); };

export function isPayable(staff: StaffMember, month: string) {
  return staff.status !== 'inactive' && staff.hiredAt <= monthEnd(month);
}

export function computePayslip(staff: StaffMember, month: string, attendance: AttendanceRecord[], leave: LeaveRequest[], adjustments: PayrollAdjustment[]): Payslip {
  const start = `${month}-01`;
  const end = monthEnd(month);
  const basic = staff.monthlySalary;
  const allowance = Math.round(basic * ALLOWANCE_RATE);
  const mine = adjustments.filter((a) => a.staffId === staff.id && a.month === month);
  const bonuses = mine.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);
  const otherDeductions = mine.filter((a) => a.amount < 0).reduce((s, a) => s + -a.amount, 0);
  const gross = basic + allowance + bonuses;
  const pension = Math.round(basic * PENSION_RATE);
  const paye = Math.round((gross - pension) * PAYE_RATE);

  const absent = attendance.filter((a) => a.staffId === staff.id && a.status === 'absent' && a.date >= start && a.date <= end).length;
  const unpaid = leave.filter((l) => l.staffId === staff.id && l.type === 'unpaid' && l.status === 'approved' && l.start <= end && l.end >= start)
    .reduce((s, l) => s + inclusiveDays(l.start > start ? l.start : start, l.end < end ? l.end : end), 0);
  const absenceDays = absent + unpaid;
  const absenceDeduction = Math.round((basic / 30) * absenceDays);
  const net = gross - pension - paye - absenceDeduction - otherDeductions;
  return { staffId: staff.id, basic, allowance, bonuses, gross, pension, paye, absenceDays, absenceDeduction, otherDeductions, net };
}
