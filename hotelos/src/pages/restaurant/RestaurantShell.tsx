import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/utils/cn';

const TABS = [
  { to: '/restaurant', label: 'Overview', end: true }, { to: '/restaurant/menu', label: 'Menu' }, { to: '/restaurant/tables', label: 'Tables' },
  { to: '/restaurant/orders', label: 'Orders' }, { to: '/room-service', label: 'Room service' },
];

export function RestaurantShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <nav aria-label="Restaurant sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-body font-medium', isActive ? 'border-champagne text-forest' : 'border-transparent text-slate hover:text-forest')}>{t.label}</NavLink>)}
      </nav>
      {children}
    </>
  );
}
