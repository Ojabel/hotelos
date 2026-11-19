import { useMemo, useState, type FormEvent } from 'react';
import { CalendarOff, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { clockIn, clockOut, decideLeave, markAbsent, requestLeave } from '@/services/mockWorkforceService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { AttendanceRecord, LeaveRequest, LeaveType, StaffMember, Tone } from '@/types';
import { today } from '@/utils/demoClock';
import { formatDate } from '@/utils/format';
import { ANNUAL_LEAVE_DAYS, annualLeaveUsed, approvedLeaveOn, inclusiveDays, LEAVE_LABEL, SHIFTS } from '@/utils/workforce';
import { StaffShell } from './StaffShell';

const A_TONE: Record<AttendanceRecord['status'], Tone> = { present: 'success', late: 'warning', absent: 'danger', leave: 'info' };
const A_LABEL: Record<AttendanceRecord['status'], string> = { present: 'Present', late: 'Late', absent: 'Absent', leave: 'On leave' };
const L_TONE: Record<LeaveRequest['status'], Tone> = { pending: 'warning', approved: 'success', rejected: 'danger' };

interface Row { staff: StaffMember; shift?: keyof typeof SHIFTS; rec?: AttendanceRecord; onLeave: boolean }

export default function Attendance() {
  const [tab, setTab] = useState('attendance');
  return (
    <StaffShell title="Attendance and leave" description="Clock-ins, absences and leave requests">
      <Tabs label="Attendance sections" value={tab} onChange={setTab} tabs={[{ id: 'attendance', label: 'Attendance' }, { id: 'leave', label: 'Leave requests' }]} />
      <div className="mt-5" role="tabpanel">{tab === 'attendance' ? <AttendanceTab /> : <LeaveTab />}</div>
    </StaffShell>
  );
}

function AttendanceTab() {
  const t = today();
  const hotelId = useAppStore((s) => s.hotelId);
  const staff = useHotelStore((s) => s.staff);
  const roster = useHotelStore((s) => s.roster);
  const attendance = useHotelStore((s) => s.attendance);
  const leave = useHotelStore((s) => s.leave);
  const [date, setDate] = useState(t);
  const [time, setTime] = useState('09:30');
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const people = staff.filter((p) => p.status !== 'inactive' && (hotelId === 'all' || p.hotelId === hotelId));
    return people.map((p) => ({ staff: p, shift: roster.find((r) => r.staffId === p.id && r.date === date)?.shift, rec: attendance.find((a) => a.staffId === p.id && a.date === date), onLeave: Boolean(approvedLeaveOn(p.id, date, leave)) }))
      .filter((r) => r.shift || r.rec || r.onLeave);
  }, [staff, roster, attendance, leave, date, hotelId]);

  const count = (s: AttendanceRecord['status']) => rows.filter((r) => r.rec?.status === s || (s === 'leave' && !r.rec && r.onLeave)).length;
  const run = async (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) => {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (r.ok) toast.success(msg); else toast.error('Not recorded', r.error);
  };

  const actions = (r: Row) => {
    if (date !== t) return null;
    return (
      <div className="flex justify-end gap-1.5">
        {r.shift && !r.rec && <><Button size="sm" loading={busy === r.staff.id} onClick={() => run(r.staff.id, () => clockIn(r.staff.id, time), `${r.staff.name} clocked in`)}>Clock in</Button><Button size="sm" variant="ghost" onClick={() => run(r.staff.id, () => markAbsent(r.staff.id), 'Marked absent')}>Absent</Button></>}
        {r.rec?.clockIn && !r.rec.clockOut && <Button size="sm" variant="secondary" loading={busy === r.staff.id} onClick={() => run(r.staff.id, () => clockOut(r.staff.id, time), `${r.staff.name} clocked out`)}>Clock out</Button>}
      </div>
    );
  };

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Employee', sortValue: (r) => r.staff.name, render: (r) => <div><p className="font-medium">{r.staff.name}</p><p className="text-meta text-slate">{r.staff.title}</p></div> },
    { key: 'shift', header: 'Shift', render: (r) => (r.shift ? `${SHIFTS[r.shift].label} ${SHIFTS[r.shift].start}–${SHIFTS[r.shift].end}` : '—') },
    { key: 'status', header: 'Status', render: (r) => (r.rec ? <Badge tone={A_TONE[r.rec.status]}>{A_LABEL[r.rec.status]}</Badge> : r.onLeave ? <Badge tone="info">On leave</Badge> : <span className="text-slate">{date > t ? 'Scheduled' : date === t ? 'Not clocked in' : 'No record'}</span>) },
    { key: 'in', header: 'In', render: (r) => r.rec?.clockIn ?? '—' },
    { key: 'out', header: 'Out', render: (r) => r.rec?.clockOut ?? '—' },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Rostered" value={String(rows.filter((r) => r.shift).length)} />
        <StatCard label="Present" value={String(count('present'))} />
        <StatCard label="Late" value={String(count('late'))} />
        <StatCard label="Absent" value={String(count('absent'))} />
        <StatCard label="On leave" value={String(count('leave'))} />
      </section>
      <Card className="mt-4 sm:mt-6">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="w-44"><Input label="Date" type="date" value={date} max={t} onChange={(e) => setDate(e.target.value || t)} /></div>
          {date === t && <div className="w-36"><Input label="Time to record" type="time" value={time} onChange={(e) => setTime(e.target.value)} hint="Simulated clock" /></div>}
        </div>
        <DataTable caption={`Attendance for ${date}`} rows={rows} columns={cols} rowKey={(r) => r.staff.id} pageSize={12} initialSort={{ key: 'name', dir: 'asc' }} empty={<EmptyState icon={CalendarOff} title="Nobody is rostered this day" />}
          mobileCard={(r) => (<div className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{r.staff.name}</p>{r.rec ? <Badge tone={A_TONE[r.rec.status]}>{A_LABEL[r.rec.status]}</Badge> : <span className="text-meta text-slate">{r.onLeave ? 'On leave' : 'Not clocked in'}</span>}</div><p className="text-meta text-slate">{r.shift ? SHIFTS[r.shift].label : '—'} · in {r.rec?.clockIn ?? '—'} · out {r.rec?.clockOut ?? '—'}</p>{actions(r)}</div>)} />
      </Card>
    </>
  );
}

function LeaveTab() {
  const hotelId = useAppStore((s) => s.hotelId);
  const all = useHotelStore((s) => s.leave);
  const staff = useHotelStore((s) => s.staff);
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const who = (id: string) => staff.find((p) => p.id === id);
  const rows = useMemo(() => all.filter((l) => (hotelId === 'all' || who(l.staffId)?.hotelId === hotelId) && (status === 'all' || l.status === status)), [all, hotelId, status, staff]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (l: LeaveRequest, d: 'approved' | 'rejected') => {
    setBusy(l.id + d);
    const r = await decideLeave(l.id, d);
    setBusy(null);
    if (r.ok) toast.success(`Leave ${d}`, who(l.staffId)?.name); else toast.error('Could not update request', r.error);
  };

  const actions = (l: LeaveRequest) => l.status === 'pending' ? (
    <div className="flex justify-end gap-1.5"><Button size="sm" loading={busy === l.id + 'approved'} onClick={() => decide(l, 'approved')}>Approve</Button><Button size="sm" variant="secondary" loading={busy === l.id + 'rejected'} onClick={() => decide(l, 'rejected')}>Reject</Button></div>
  ) : null;

  const cols: Column<LeaveRequest>[] = [
    { key: 'who', header: 'Employee', sortValue: (l) => who(l.staffId)?.name ?? '', render: (l) => <div><p className="font-medium">{who(l.staffId)?.name}</p><p className="text-meta text-slate">{who(l.staffId)?.department}</p></div> },
    { key: 'type', header: 'Type', render: (l) => LEAVE_LABEL[l.type] },
    { key: 'dates', header: 'Dates', sortValue: (l) => l.start, render: (l) => `${formatDate(l.start, false)} – ${formatDate(l.end, false)}` },
    { key: 'days', header: 'Days', align: 'right', render: (l) => inclusiveDays(l.start, l.end) },
    { key: 'reason', header: 'Reason', render: (l) => <span className="text-slate">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge tone={L_TONE[l.status]}>{l.status[0].toUpperCase() + l.status.slice(1)}</Badge> },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
          <div className="w-48"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All requests' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} /></div>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />Request leave</Button>
        </div>
        <DataTable caption="Leave requests" rows={rows} columns={cols} rowKey={(l) => l.id} pageSize={10} initialSort={{ key: 'dates', dir: 'desc' }} empty={<EmptyState icon={CalendarOff} title="No leave requests" />}
          mobileCard={(l) => (<div className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{who(l.staffId)?.name}</p><Badge tone={L_TONE[l.status]}>{l.status}</Badge></div><p className="text-meta text-slate">{LEAVE_LABEL[l.type]} · {formatDate(l.start, false)} – {formatDate(l.end, false)} · {l.reason}</p>{actions(l)}</div>)} />
      </Card>
      {creating && <LeaveDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function LeaveDialog({ onClose }: { onClose: () => void }) {
  const staff = useHotelStore((s) => s.staff.filter((p) => p.status !== 'inactive'));
  const leave = useHotelStore((s) => s.leave);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '');
  const [type, setType] = useState<LeaveType>('annual');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = ANNUAL_LEAVE_DAYS - annualLeaveUsed(staffId, start.slice(0, 4), leave, true);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await requestLeave({ staffId, type, start, end, reason });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Leave requested', 'Awaiting approval');
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title="Request leave" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="leave-form" loading={busy}>Submit request</Button></>}>
      <form id="leave-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Select label="Employee" value={staffId} onChange={(e) => setStaffId(e.target.value)} options={staff.map((p) => ({ value: p.id, label: `${p.name} — ${p.department}` }))} />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as LeaveType)} options={(Object.keys(LEAVE_LABEL) as LeaveType[]).map((k) => ({ value: k, label: LEAVE_LABEL[k] }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="From" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
          <Input label="To" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} hint={end >= start ? `${inclusiveDays(start, end)} day${inclusiveDays(start, end) === 1 ? '' : 's'}` : undefined} />
        </div>
        {type === 'annual' && <p className="rounded bg-ivory px-3 py-2 text-body text-slate">{Math.max(0, remaining)} annual leave days remain for {start.slice(0, 4)}.</p>}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Dialog>
  );
}
