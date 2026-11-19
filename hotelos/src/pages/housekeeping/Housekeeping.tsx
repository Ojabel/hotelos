import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardCheck, Plus, SprayCan } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { PriorityBadge, RoomStatusBadge, TaskStatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { hotelShortName } from '@/data/mockHotels';
import { useScopedData } from '@/hooks/useScopedData';
import { addSupplyNote, completeTask, createTask, startTask } from '@/services/mockHousekeepingService';
import { backendMode } from '@/services/api/backendMode';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { HousekeepingTask, Priority, SupplyNote, TaskStatus } from '@/types';
import { formatDate } from '@/utils/format';
import { PRIORITY_META, TASK_STATUS_META } from '@/utils/status';
import { AssignDialog, InspectDialog } from './TaskDialogs';
import { HousekeepingShell } from './HousekeepingShell';
import { OperationsStaffDialog } from '../OperationsStaffDialog';

const LEVEL_TONE = { ok: 'success', low: 'warning', out: 'danger' } as const;

export default function Housekeeping() {
  const { hotelId, rooms, roomById } = useScopedData();
  const allTasks = useHotelStore((s) => s.housekeepingTasks);
  const staff = useHotelStore((s) => s.staff);
  const notes = useHotelStore((s) => s.supplyNotes);
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [assigning, setAssigning] = useState<HousekeepingTask | null>(null);
  const [inspecting, setInspecting] = useState<HousekeepingTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [noting, setNoting] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [completing, setCompleting] = useState<HousekeepingTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

  const roomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms]);
  const tasks = useMemo(() => allTasks.filter((t) => roomIds.has(t.roomId)), [allTasks, roomIds]);
  const open = tasks.filter((t) => t.status !== 'inspected');
  const staffName = (id?: string) => staff.find((p) => p.id === id)?.name ?? 'Unassigned';

  const filtered = useMemo(() => tasks.filter((t) => {
    if (status === 'open' ? t.status === 'inspected' : status !== 'all' && t.status !== status) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (assignee === 'none' ? Boolean(t.assigneeId) : assignee !== 'all' && t.assigneeId !== assignee) return false;
    return true;
  }), [tasks, status, priority, assignee]);

  const run = async (t: HousekeepingTask, fn: (id: string) => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(t.id);
    const r = await fn(t.id) as { ok: true } | { ok: false; error: string };
    setBusy(null);
    if (r.ok) toast.success(msg, `Room ${roomById.get(t.roomId)?.number}`); else toast.error('Could not update task', r.error);
  };

  const actions = (t: HousekeepingTask) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {(t.status === 'pending' || t.status === 'assigned') && <Button size="sm" variant="secondary" onClick={() => setAssigning(t)}>{t.assigneeId ? 'Reassign' : 'Assign'}</Button>}
      {t.status === 'assigned' && <Button size="sm" onClick={() => run(t, startTask, 'Cleaning started')} loading={busy === t.id}>Start</Button>}
      {t.status === 'in_progress' && <Button size="sm" onClick={() => { setCompletionNotes(''); setCompleting(t); }}>Complete</Button>}
      {t.status === 'completed' && <Button size="sm" onClick={() => setInspecting(t)}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Inspect</Button>}
    </div>
  );

  const cols: Column<HousekeepingTask>[] = [
    { key: 'room', header: 'Room', sortValue: (t) => roomById.get(t.roomId)?.number ?? '', render: (t) => <span className="flex items-center gap-2 font-medium">{roomById.get(t.roomId)?.number}{hotelId === 'all' && <span className="text-meta font-normal text-slate">{hotelShortName(t.hotelId)}</span>}</span> },
    { key: 'rs', header: 'Room status', render: (t) => roomById.get(t.roomId) && <RoomStatusBadge status={roomById.get(t.roomId)!.status} /> },
    { key: 'type', header: 'Type', render: (t) => <span className="capitalize">{t.type}</span> },
    { key: 'pri', header: 'Priority', sortValue: (t) => PRIORITY_META[t.priority].rank, render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: 'status', header: 'Task', render: (t) => <TaskStatusBadge status={t.status} /> },
    { key: 'who', header: 'Assigned to', sortValue: (t) => staffName(t.assigneeId), render: (t) => <span className={t.assigneeId ? '' : 'text-slate'}>{staffName(t.assigneeId)}</span> },
    { key: 'notes', header: 'Notes', render: (t) => <span className="text-slate">{t.notes ?? '—'}</span> },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  const clear = () => { setStatus('open'); setPriority('all'); setAssignee('all'); };

  return (
    <HousekeepingShell title="Housekeeping" description="Cleaning tasks drive room status." actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={hotelId === 'all'} onClick={() => setAddingStaff(true)}>Add staff</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New task</Button></div>}>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Rooms to clean" value={String(rooms.filter((r) => r.status === 'dirty').length)} hint={`${open.filter((t) => t.priority === 'urgent').length} urgent`} />
        <StatCard label="In progress" value={String(open.filter((t) => t.status === 'in_progress').length)} />
        <StatCard label="Awaiting inspection" value={String(open.filter((t) => t.status === 'completed').length)} />
        <StatCard label="Ready rooms" value={String(rooms.filter((r) => r.status === 'available' || r.status === 'inspected').length)} hint="Available or inspected" />
        <StatCard label="Overdue tasks" value={String(open.filter((t) => t.dueAt && t.dueAt < new Date().toISOString().slice(0, 10)).length)} />
      </section>

      <Card className="mt-4 sm:mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <Select label="Task status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'open', label: 'Open tasks' }, { value: 'all', label: 'All tasks' }, ...(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))]} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: 'all', label: 'All priorities' }, ...(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))]} />
          <Select label="Assigned to" value={assignee} onChange={(e) => setAssignee(e.target.value)} options={[{ value: 'all', label: 'Everyone' }, { value: 'none', label: 'Unassigned' }, ...staff.filter((p) => p.department === 'Housekeeping').map((p) => ({ value: p.id, label: p.name }))]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Housekeeping tasks" rows={filtered} columns={cols} rowKey={(t) => t.id} pageSize={10} initialSort={{ key: 'pri', dir: 'asc' }}
          empty={<EmptyState icon={SprayCan} title="No tasks match" description="Rooms appear here when guests check out or a room is marked dirty." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(t) => (<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium">Room {roomById.get(t.roomId)?.number}</p><div className="flex gap-1.5"><PriorityBadge priority={t.priority} /><TaskStatusBadge status={t.status} /></div></div><p className="text-meta text-slate">{staffName(t.assigneeId)}{t.notes ? ` · ${t.notes}` : ''}</p>{actions(t)}</div>)} />
      </Card>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title="Linen and supplies" action={<Button size="sm" variant="secondary" onClick={() => setNoting(true)}>Add note</Button>} />
        <ul className="divide-y divide-line">
          {notes.filter((n) => hotelId === 'all' || n.hotelId === hotelId).slice(0, 8).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3"><div><p className="text-body font-medium">{n.item}</p><p className="text-body text-slate">{n.note}</p><p className="text-meta text-slate">{hotelShortName(n.hotelId)} · {formatDate(n.date, false)}</p></div><Badge tone={LEVEL_TONE[n.level]}>{n.level === 'ok' ? 'Stocked' : n.level === 'low' ? 'Running low' : 'Out of stock'}</Badge></li>
          ))}
        </ul>
      </Card>

      <AssignDialog task={assigning} onClose={() => setAssigning(null)} />
      {addingStaff && <OperationsStaffDialog hotelId={hotelId} area="housekeeping" onClose={() => setAddingStaff(false)} />}
      <InspectDialog task={inspecting} onClose={() => setInspecting(null)} />
      <Dialog open={Boolean(completing)} onClose={() => setCompleting(null)} title={completing ? `Complete room ${roomById.get(completing.roomId)?.number}` : 'Complete task'} footer={<><Button variant="secondary" disabled={busy === completing?.id} onClick={() => setCompleting(null)}>Cancel</Button><Button loading={busy === completing?.id} onClick={async () => { if (!completing) return; setBusy(completing.id); const result = await completeTask(completing.id, completionNotes); setBusy(null); if (!result.ok) { toast.error('Could not complete task', result.error); return; } toast.success('Cleaning completed', 'Room remains unavailable pending inspection.'); setCompleting(null); }}>Complete cleaning</Button></>}>
        <Textarea label="Completion notes" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} />
      </Dialog>
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} />
      {!backendMode && <SupplyDialog open={noting} onClose={() => setNoting(false)} />}
    </HousekeepingShell>
  );
}

function NewTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rooms } = useScopedData();
  const tasks = useHotelStore((s) => s.housekeepingTasks);
  const candidates = rooms.filter((r) => (backendMode ? ['dirty', 'available', 'inspected'].includes(r.status) : r.status !== 'maintenance' && r.status !== 'out_of_service') && !tasks.some((t) => t.roomId === r.id && t.status !== 'inspected'));
  const [roomId, setRoomId] = useState('');
  const [type, setType] = useState<HousekeepingTask['type']>('turnover');
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = roomId || candidates[0]?.id || '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createTask({ roomId: chosen, type, priority, notes, instructions, dueAt: dueAt || undefined, idempotencyKey });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Task created');
    setNotes(''); setInstructions(''); setDueAt(''); setError(''); setRoomId(''); setIdempotencyKey(crypto.randomUUID());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New cleaning task" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="task-form" loading={busy} disabled={!chosen}>Create task</Button></>}>
      <form id="task-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Select label="Room" value={chosen} onChange={(e) => setRoomId(e.target.value)} options={candidates.map((r) => ({ value: r.id, label: `${r.number} — ${r.status.replace('_', ' ')}` }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as HousekeepingTask['type'])} options={[{ value: 'turnover', label: 'Turnover' }, { value: 'daily', label: 'Daily service' }, { value: 'deep', label: 'Deep clean' }]} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} options={(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        </div>
        <Input label="Due date" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <Textarea label="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Dialog>
  );
}

function SupplyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaultHotel = useAppStore((s) => s.hotelId);
  const [item, setItem] = useState('');
  const [level, setLevel] = useState<SupplyNote['level']>('low');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await addSupplyNote({ hotelId: defaultHotel === 'all' ? 'h-vi' : defaultHotel, item, level, note });
    if (!r.ok) return setError(r.error);
    toast.success('Supply note added'); setItem(''); setNote(''); setError(''); onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Linen and supply note" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="supply-form">Add note</Button></>}>
      <form id="supply-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="text-meta text-danger">{error}</div>}
        <Input label="Item" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Hand towels" />
        <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value as SupplyNote['level'])} options={[{ value: 'ok', label: 'Stocked' }, { value: 'low', label: 'Running low' }, { value: 'out', label: 'Out of stock' }]} />
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Dialog>
  );
}
