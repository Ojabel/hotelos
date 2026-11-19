import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { mockHotels } from '@/data/mockHotels';
import { saveStaff } from '@/services/mockWorkforceService';
import { toast, useAppStore } from '@/store/useAppStore';
import type { Department, StaffMember } from '@/types';
import { today } from '@/utils/demoClock';
import { DEPARTMENTS } from './StaffShell';
import { FINANCIAL_ROLES } from '@/routes/nav';

export function StaffFormDialog({ member, onClose }: { member: StaffMember | 'new' | null; onClose: () => void }) {
  return member ? <Body key={member === 'new' ? 'new' : member.id} member={member === 'new' ? undefined : member} onClose={onClose} /> : null;
}

function Body({ member, onClose }: { member?: StaffMember; onClose: () => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const [f, setF] = useState({ name: member?.name ?? '', title: member?.title ?? '', department: member?.department ?? ('Housekeeping' as Department), hotelId: member?.hotelId ?? 'h-vi', phone: member?.phone ?? '', email: member?.email ?? '', monthlySalary: String(member?.monthlySalary ?? ''), hiredAt: member?.hiredAt ?? today() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveStaff({ id: member?.id, ...f, department: f.department, monthlySalary: Number(f.monthlySalary) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(member ? 'Employee updated' : 'Employee added', r.value.name);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="lg" title={member ? `Edit ${member.name}` : 'Add employee'} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="staff-form" loading={busy}>{member ? 'Save changes' : 'Add employee'}</Button></>}>
      <form id="staff-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={f.name} onChange={set('name')} />
          <Input label="Job title" value={f.title} onChange={set('title')} />
          <Select label="Department" value={f.department} onChange={set('department')} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} />
          <Select label="Property" value={f.hotelId} onChange={set('hotelId')} options={mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} />
          <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
          {canManageFinancials && <Input label="Monthly salary" type="number" min={0} value={f.monthlySalary} onChange={set('monthlySalary')} />}
          <Input label="Start date" type="date" max={today()} value={f.hiredAt} onChange={set('hiredAt')} />
        </div>
      </form>
    </Dialog>
  );
}
