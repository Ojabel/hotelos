import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/utils/cn';

const TABS = [{ to: '/staff', label: 'Directory', end: true }, { to: '/staff/departments', label: 'Departments' }, { to: '/staff/shifts', label: 'Shifts' }, { to: '/staff/attendance', label: 'Attendance and leave' }, { to: '/staff/payroll', label: 'Payroll' }];

export function StaffShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <nav aria-label="Staff sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-body font-medium', isActive ? 'border-champagne text-forest' : 'border-transparent text-slate hover:text-forest')}>{t.label}</NavLink>)}
      </nav>
      {children}
    </>
  );
}

export const DEPARTMENTS = ['Management', 'Front Desk', 'Housekeeping', 'Maintenance', 'Restaurant', 'Finance', 'Security'] as const;
