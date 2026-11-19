import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { hotelShortName } from '@/data/mockHotels';
import { setStaffActive } from '@/services/mockWorkforceService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { StaffMember } from '@/types';
import { addDays, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { ANNUAL_LEAVE_DAYS, annualLeaveUsed, SHIFTS, weekStart } from '@/utils/workforce';
import { StaffFormDialog } from './StaffFormDialog';
import { DEPARTMENTS, StaffShell } from './StaffShell';
import { FINANCIAL_ROLES } from '@/routes/nav';

const TONE = { active: 'success', on_leave: 'warning', inactive: 'neutral' } as const;
const LABEL = { active: 'Active', on_leave: 'On leave', inactive: 'Inactive' } as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StaffDirectory() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const all = useHotelStore((s) => s.staff);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const staff = useMemo(() => all.filter((p) => hotelId === 'all' || p.hotelId === hotelId), [all, hotelId]);
  const rows = useMemo(() => staff.filter((p) => (dept === 'all' || p.department === dept) && (status === 'all' || p.status === status) && (!q.trim() || `${p.name} ${p.title} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()))), [staff, q, dept, status]);
  const active = staff.filter((p) => p.status !== 'inactive');
  const clear = () => { setQ(''); setDept('all'); setStatus('all'); };

  const cols: Column<StaffMember>[] = [
    { key: 'name', header: 'Employee', sortValue: (p) => p.name, render: (p) => <div className="flex items-center gap-3"><span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-meta font-semibold text-champagne">{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><div><p className="font-medium">{p.name}</p><p className="text-meta text-slate">{p.title}</p></div></div> },
    { key: 'dept', header: 'Department', sortValue: (p) => p.department, render: (p) => p.department },
    { key: 'hotel', header: 'Property', render: (p) => hotelShortName(p.hotelId) },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge> },
    { key: 'phone', header: 'Phone', render: (p) => p.phone },
    { key: 'hired', header: 'Joined', sortValue: (p) => p.hiredAt, render: (p) => formatDate(p.hiredAt, false) },
    { key: 'a', header: '', align: 'right', render: (p) => <Button variant="ghost" size="sm" aria-label={`Edit ${p.name}`} onClick={(e) => { e.stopPropagation(); setEditing(p); }}><Pencil className="h-4 w-4" aria-hidden /></Button> },
  ];

  return (
    <StaffShell title="Staff" description={`${active.length} employees${staff.length !== active.length ? ` · ${staff.length - active.length} inactive` : ''}`} actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden />Add employee</Button>}>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Active headcount" value={String(staff.filter((p) => p.status === 'active').length)} />
        <StatCard label="On leave" value={String(staff.filter((p) => p.status === 'on_leave').length)} />
        <StatCard label="Departments" value={String(new Set(active.map((p) => p.department)).size)} />
        {canViewFinancials && <StatCard label="Monthly salary bill" value={formatCurrency(active.reduce((s, p) => s + p.monthlySalary, 0))} hint="Before allowances and deductions" />}
      </section>
      <Card className="mt-4 sm:mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5"><label htmlFor="st-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="st-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, title or email" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: 'all', label: 'All departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'on_leave', label: 'On leave' }, { value: 'inactive', label: 'Inactive' }]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Employees" rows={rows} columns={cols} rowKey={(p) => p.id} pageSize={10} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(p) => setOpenId(p.id)} empty={<EmptyState icon={Users} title="No employees match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(p) => (<button type="button" onClick={() => setOpenId(p.id)} className="block w-full p-4 text-left"><div className="flex items-center justify-between gap-2"><p className="font-medium">{p.name}</p><Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge></div><p className="text-meta text-slate">{p.title} · {p.department} · {hotelShortName(p.hotelId)}</p></button>)} />
      </Card>
      <StaffFormDialog member={editing} onClose={() => setEditing(null)} />
      <EmployeeDrawer id={openId} onClose={() => setOpenId(null)} onEdit={(p) => { setOpenId(null); setEditing(p); }} />
    </StaffShell>
  );
}

function EmployeeDrawer({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (p: StaffMember) => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const p = useHotelStore((s) => s.staff.find((x) => x.id === id));
  const roster = useHotelStore((s) => s.roster);
  const attendance = useHotelStore((s) => s.attendance);
  const leave = useHotelStore((s) => s.leave);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!p) return null;

  const t = today();
  const ws = weekStart(t);
  const week = DAYS.map((label, i) => { const date = addDays(ws, i); return { label, date, shift: roster.find((r) => r.staffId === p.id && r.date === date)?.shift }; });
  const recent = attendance.filter((a) => a.staffId === p.id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const used = annualLeaveUsed(p.id, t.slice(0, 4), leave);
  const years = Math.floor((new Date(t).getTime() - new Date(p.hiredAt).getTime()) / (365.25 * 86_400_000));

  const toggle = async () => {
    setBusy(true);
    const r = await setStaffActive(p.id, p.status === 'inactive');
    setBusy(false);
    setConfirm(false);
    if (r.ok) toast.success(p.status === 'inactive' ? 'Employee reactivated' : 'Employee deactivated', p.name); else toast.error('Could not update employee', r.error);
  };

  return (
    <>
      <Dialog open={!confirm} onClose={onClose} variant="drawer" title={p.name} description={`${p.title} · ${p.department}`}
        footer={<><Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button><Button variant={p.status === 'inactive' ? 'primary' : 'danger'} onClick={() => setConfirm(true)}>{p.status === 'inactive' ? 'Reactivate' : 'Deactivate'}</Button></>}>
        <div className="space-y-5">
          <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
          <dl className="grid grid-cols-2 gap-4"><Detail label="Email">{p.email}</Detail><Detail label="Phone">{p.phone}</Detail><Detail label="Property">{hotelShortName(p.hotelId)}</Detail><Detail label="Joined">{formatDate(p.hiredAt, false)} · {years} yr{years === 1 ? '' : 's'}</Detail>{canViewFinancials && <Detail label="Monthly salary"><span className="tnum">{formatCurrency(p.monthlySalary)}</span></Detail>}<Detail label="Annual leave">{used} of {ANNUAL_LEAVE_DAYS} days used</Detail></dl>
          <div><p className="mb-2 text-meta font-medium uppercase tracking-wide text-slate">This week</p>
            <ul className="grid grid-cols-7 gap-1 text-center">{week.map((d) => <li key={d.date} className={`rounded border px-1 py-1.5 ${d.date === t ? 'border-champagne bg-champagne/10' : 'border-line'}`}><span className="block text-[11px] text-slate">{d.label}</span><span className="block text-meta font-medium">{d.shift ? SHIFTS[d.shift].label.slice(0, 3) : 'Off'}</span></li>)}</ul></div>
          <div><p className="mb-2 text-meta font-medium uppercase tracking-wide text-slate">Recent attendance</p>
            {recent.length === 0 ? <p className="text-body text-slate">No records yet.</p> : <ul className="divide-y divide-line rounded border border-line">{recent.map((a) => <li key={a.id} className="flex justify-between px-3 py-2 text-body"><span>{formatDate(a.date, false)}</span><span className="capitalize text-slate">{a.status}{a.clockIn ? ` · ${a.clockIn}` : ''}</span></li>)}</ul>}</div>
        </div>
      </Dialog>
      <ConfirmDialog open={confirm} title={p.status === 'inactive' ? `Reactivate ${p.name}?` : `Deactivate ${p.name}?`} confirmLabel={p.status === 'inactive' ? 'Reactivate' : 'Deactivate'} danger={p.status !== 'inactive'} loading={busy} onConfirm={toggle} onClose={() => setConfirm(false)}>{p.status === 'inactive' ? 'They return to the active list and can be rostered again.' : 'Future shifts are removed and they drop off payroll. Open tasks must be reassigned first.'}</ConfirmDialog>
    </>
  );
}
