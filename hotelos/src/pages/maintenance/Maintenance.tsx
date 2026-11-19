import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { MaintenanceStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { backendMode, useBackendHotels } from '@/services/api/backendMode';
import { hotelShortName } from '@/data/mockHotels';
import { useScopedData } from '@/hooks/useScopedData';
import { assignRequest, createRequest, resolveRequest, startRequest } from '@/services/mockMaintenanceService';
import { backendOperations } from '@/services/backendOperations';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { MaintenanceRequest, MaintenanceStatus, Priority } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { MAINTENANCE_STATUS_META, PRIORITY_META } from '@/utils/status';
import { OperationsStaffDialog } from '../OperationsStaffDialog';

const CATEGORIES = ['Electrical', 'Plumbing', 'Air conditioning', 'Furniture and fixtures', 'Appliances', 'Structural', 'Internet and network', 'General maintenance'];

export default function Maintenance() {
  const { hotelId, rooms, roomById } = useScopedData();
  const all = useHotelStore((s) => s.maintenanceRequests);
  const staff = useHotelStore((s) => s.staff);
  const [status, setStatus] = useState('active');
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const requests = useMemo(() => all.filter((m) => hotelId === 'all' || m.hotelId === hotelId), [all, hotelId]);
  const filtered = useMemo(() => requests.filter((m) => {
    if (status === 'active' ? m.status === 'resolved' : status !== 'all' && m.status !== status) return false;
    if (priority !== 'all' && m.priority !== priority) return false;
    if (search && !`${m.title ?? ''} ${m.description} ${m.location ?? ''} ${m.roomId ? roomById.get(m.roomId)?.number ?? '' : ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return category === 'all' || m.category === category;
  }), [requests, status, priority, category, search, roomById]);

  const active = requests.filter((m) => m.status !== 'resolved');
  const name = (id?: string) => staff.find((p) => p.id === id)?.name ?? 'Unassigned';
  const where = (m: MaintenanceRequest) => (m.roomId ? `Room ${roomById.get(m.roomId)?.number ?? '?'}` : m.location);
  const selected = all.find((m) => m.id === openId) ?? null;
  const clear = () => { setStatus('active'); setPriority('all'); setCategory('all'); setSearch(''); };

  const cols: Column<MaintenanceRequest>[] = [
    { key: 'where', header: 'Location', sortValue: (m) => where(m) ?? '', render: (m) => <div><p className="font-medium">{where(m)}</p><p className="text-meta text-slate">{m.category}{m.blocksRoom && ' � room out of sale'}</p></div> },
    { key: 'desc', header: 'Issue', render: (m) => <div className="max-w-xs"><p className="font-medium">{m.title ?? m.category}</p><p className="line-clamp-2 text-slate">{m.description}</p></div> },
    { key: 'pri', header: 'Priority', sortValue: (m) => PRIORITY_META[m.priority].rank, render: (m) => <PriorityBadge priority={m.priority} /> },
    { key: 'who', header: 'Technician', sortValue: (m) => name(m.assigneeId), render: (m) => <span className={m.assigneeId ? '' : 'text-slate'}>{name(m.assigneeId)}</span> },
    { key: 'status', header: 'Status', render: (m) => <MaintenanceStatusBadge status={m.status} /> },
    { key: 'cost', header: 'Estimate', align: 'right', sortValue: (m) => m.costEstimate, render: (m) => formatCurrency(m.costEstimate) },
    { key: 'date', header: 'Logged', sortValue: (m) => m.createdAt, render: (m) => <div>{formatDate(m.createdAt, false)}{m.dueAt && <p className="text-meta text-slate">Due {formatDate(m.dueAt, false)}</p>}</div> },
  ];

  return (
    <>
      <PageHeader title="Maintenance" description="Requests, technicians and room availability" actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={hotelId === 'all'} onClick={() => setAddingStaff(true)}>Add technician</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New request</Button></div>} />
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Open requests" value={String(active.length)} hint={`${active.filter((m) => m.priority === 'urgent' || m.priority === 'high').length} high priority`} />
        <StatCard label="In progress" value={String(active.filter((m) => m.status === 'in_progress').length)} />
        <StatCard label="Rooms out of sale" value={String(rooms.filter((r) => r.status === 'maintenance' || r.status === 'out_of_service').length)} />
        <StatCard label="Overdue work orders" value={String(active.filter((m) => m.dueAt && m.dueAt < new Date().toISOString().slice(0, 10)).length)} />
      </section>

      <Card className="mt-4 sm:mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Input label="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, room or description" />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All (including history)' }, ...(Object.keys(MAINTENANCE_STATUS_META) as MaintenanceStatus[]).map((s) => ({ value: s, label: MAINTENANCE_STATUS_META[s].label }))]} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: 'all', label: 'All priorities' }, ...(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))]} />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Maintenance requests" rows={filtered} columns={cols} rowKey={(m) => m.id} pageSize={10} initialSort={{ key: 'pri', dir: 'asc' }} onRowClick={(m) => setOpenId(m.id)}
          empty={<EmptyState icon={Wrench} title="No requests match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(m) => (<button type="button" onClick={() => setOpenId(m.id)} className="block w-full p-4 text-left"><div className="flex items-start justify-between gap-2"><p className="font-medium">{where(m)} � {m.category}</p><MaintenanceStatusBadge status={m.status} /></div><p className="mt-1 text-body text-slate">{m.description}</p><div className="mt-2 flex items-center gap-2"><PriorityBadge priority={m.priority} /><span className="text-meta text-slate">{name(m.assigneeId)}</span></div></button>)} />
      </Card>

      <RequestDrawer request={selected} onClose={() => setOpenId(null)} />
      {addingStaff && <OperationsStaffDialog hotelId={hotelId} area="maintenance" onClose={() => setAddingStaff(false)} />}
      <NewRequestDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function RequestDrawer({ request, onClose }: { request: MaintenanceRequest | null; onClose: () => void }) {
  return request ? <DrawerBody key={request.id} request={request} onClose={onClose} /> : null;
}

function DrawerBody({ request, onClose }: { request: MaintenanceRequest; onClose: () => void }) {
  const staff = useHotelStore((s) => s.staff);
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === request.roomId));
  const allRequests = useHotelStore((s) => s.maintenanceRequests);
  const history = useMemo(() => allRequests.filter((m) => m.roomId && m.roomId === request.roomId && m.id !== request.id), [allRequests, request.id, request.roomId]);
  const techs = staff.filter((p) => p.department === 'Maintenance' && p.status === 'active');
  const [tech, setTech] = useState(request.assigneeId ?? techs[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState(request.dueAt ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError('');
    toast.success(msg);
  };

  return (
    <Dialog open onClose={onClose} variant="drawer" title={`${request.title ?? request.category}${room ? `  -  room ${room.number}` : request.location ? `  -  ${request.location}` : ''}`} description={`${request.id} � logged ${formatDate(request.createdAt, false)}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><MaintenanceStatusBadge status={request.status} /><PriorityBadge priority={request.priority} />{request.blocksRoom && <Badge tone="danger">Room out of sale</Badge>}</div>
        <p className="text-body">{request.description}</p>
        <dl className="grid grid-cols-2 gap-4"><Detail label="Technician">{staff.find((p) => p.id === request.assigneeId)?.name ?? 'Unassigned'}</Detail><Detail label="Estimate"><span className="tnum">{formatCurrency(request.costEstimate)}</span></Detail>{request.resolvedAt && <Detail label="Resolved">{formatDate(request.resolvedAt, false)}</Detail>}</dl>
        {request.resolutionNotes && <p className="rounded bg-success/10 px-3 py-2 text-body text-success">{request.resolutionNotes}</p>}
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}

        {request.status === 'open' && backendMode && !request.workOrderId && <div className="space-y-3 border-t border-line pt-4"><Input label="Work order due date" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /><Button loading={busy} onClick={() => run(() => backendOperations.createMaintenanceWorkOrder(request.hotelId, request.id, undefined, dueAt || undefined), 'Work order created')}>Create work order</Button></div>}
        {(request.status === 'open' || request.status === 'assigned') && (
          <div className="space-y-3 border-t border-line pt-4">
            <Select label="Technician" value={tech} onChange={(e) => setTech(e.target.value)} options={techs.map((p) => ({ value: p.id, label: `${p.name} � ${p.title}` }))} />
            {backendMode && <Input label="Work order due date" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
            <div className="flex gap-2"><Button variant="secondary" loading={busy} onClick={() => run(() => assignRequest(request.id, tech, dueAt || undefined), 'Technician assigned')}>{request.status === 'open' ? backendMode && !request.workOrderId ? 'Create and assign' : 'Assign' : 'Reassign'}</Button>{request.status === 'assigned' && <Button loading={busy} onClick={() => run(() => startRequest(request.id), 'Work started')}>Start work</Button>}</div>
          </div>
        )}
        {(request.status === 'in_progress' || request.status === 'on_hold' || request.status === 'awaiting_parts') && (
          <div className="space-y-3 border-t border-line pt-4">
            <Textarea label="Resolution notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {request.status !== 'in_progress' && <Button loading={busy} onClick={() => run(() => startRequest(request.id), 'Work resumed')}>Resume work</Button>}
              {request.status === 'in_progress' && backendMode && <><Button variant="secondary" loading={busy} onClick={() => run(() => backendOperations.transitionMaintenanceWorkOrder(request.hotelId, request.id, 'hold', notes), 'Work put on hold')}>On hold</Button><Button variant="secondary" loading={busy} onClick={() => run(() => backendOperations.transitionMaintenanceWorkOrder(request.hotelId, request.id, 'parts', notes), 'Awaiting parts')}>Awaiting parts</Button></>}
              {request.status === 'in_progress' && <Button loading={busy} onClick={() => run(() => resolveRequest(request.id, notes), 'Work completed')}>Complete work</Button>}
            </div>
          </div>
        )}
        {request.status === 'completed' && backendMode && <div className="border-t border-line pt-4"><Button loading={busy} onClick={() => run(() => backendOperations.transitionMaintenanceWorkOrder(request.hotelId, request.id, 'close'), request.blocksRoom ? 'Work order closed  -  room released for cleaning' : 'Work order closed')}>Close work order</Button></div>}
        {history.length > 0 && (
          <div className="border-t border-line pt-4"><p className="mb-2 text-meta font-medium uppercase tracking-wide text-slate">Room history</p>
            <ul className="space-y-2">{history.map((h) => <li key={h.id} className="text-body"><span className="font-medium">{h.category}</span> <span className="text-slate">� {formatDate(h.createdAt, false)} � {MAINTENANCE_STATUS_META[h.status].label}</span></li>)}</ul></div>
        )}
      </div>
    </Dialog>
  );
}

function NewRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hotelId = useAppStore((s) => s.hotelId);
  const { rooms: allRooms } = useScopedData();
  const hotels = useBackendHotels();
  const [selectedHotelId, setSelectedHotelId] = useState(hotelId === 'all' ? '' : hotelId);
  useEffect(() => {
    if (hotelId !== 'all') setSelectedHotelId(hotelId);
    else if (!selectedHotelId && hotels[0]) setSelectedHotelId(hotels[0].id);
  }, [hotelId, hotels, selectedHotelId]);
  const requestHotelId = backendMode ? (hotelId === 'all' ? selectedHotelId : hotelId) : hotelId === 'all' ? 'h-vi' : hotelId;
  const rooms = allRooms.filter((room) => !backendMode || room.hotelId === requestHotelId);
  const [target, setTarget] = useState('room');
  const [roomId, setRoomId] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Air conditioning');
  const [priority, setPriority] = useState<Priority>('normal');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('0');
  const [blocks, setBlocks] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const room = roomId || rooms[0]?.id || '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (backendMode && !requestHotelId) { setBusy(false); return setError('Choose a hotel first.'); }
    const r = await createRequest({ hotelId: requestHotelId, roomId: target === 'room' ? room : undefined, location: target === 'area' ? location : undefined, title, category, priority, description, costEstimate: Number(cost), blocksRoom: target === 'room' && blocks, idempotencyKey });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Request logged', r.value.id);
    setTitle(''); setDescription(''); setError(''); setBlocks(false); setIdempotencyKey(crypto.randomUUID());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New maintenance request" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="mt-form" loading={busy}>Log request</Button></>}>
      <form id="mt-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {backendMode && hotelId === 'all' && <Select label="Hotel" value={requestHotelId} onChange={(e) => { setSelectedHotelId(e.target.value); setRoomId(''); }} options={hotels.map((hotel) => ({ value: hotel.id, label: hotel.name }))} />}
        <Select label="Where" value={target} onChange={(e) => setTarget(e.target.value)} options={[{ value: 'room', label: 'A guest room' }, { value: 'area', label: 'A public area or equipment' }]} />
        {target === 'room' ? <Select label="Room" value={room} onChange={(e) => setRoomId(e.target.value)} options={rooms.map((r) => ({ value: r.id, label: `${r.number}  -  ${r.status.replace('_', ' ')}${hotelId === 'all' ? ` (${hotelShortName(r.hotelId)})` : ''}` }))} /> : <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pool pump house" />}
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} options={(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
          <Input label="Cost estimate" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <Input label="Request title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Air conditioner leaking" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        {target === 'room' && <label className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={blocks} onChange={(e) => setBlocks(e.target.checked)} />Take the room out of sale until resolved</label>}
      </form>
    </Dialog>
  );
}
