import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BedDouble, LayoutGrid, Pencil, Plus, RefreshCw, Rows3, Search, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { RoomStatusBadge } from '@/components/ui/StatusBadge';
import { hotelShortName } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { useScopedData } from '@/hooks/useScopedData';
import { deleteRoom } from '@/services/mockRoomService';
import { toast, useAppStore } from '@/store/useAppStore';
import type { Room, RoomStatus } from '@/types';
import { formatCurrency } from '@/utils/format';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { housekeepingLabel, maintenanceLabel } from '@/utils/roomRules';
import { ROOM_STATUS_META } from '@/utils/status';
import { cn } from '@/utils/cn';
import { RoomFormDialog } from './RoomFormDialog';
import { RoomStatusDialog } from './RoomStatusDialog';
import { backendMode, useRoomCategories } from '@/services/api/backendMode';

const STATUS_BORDER: Record<RoomStatus, string> = {
  available: 'border-l-success', reserved: 'border-l-info', occupied: 'border-l-champagne', dirty: 'border-l-warning',
  cleaning: 'border-l-info', inspected: 'border-l-success', maintenance: 'border-l-danger', out_of_service: 'border-l-slate',
};

export default function RoomsPage() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const navigate = useNavigate();
  const { hotelId, rooms } = useScopedData();
  const categories = useRoomCategories();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [floor, setFloor] = useState('all');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | undefined>();
  const [statusRoom, setStatusRoom] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const filtered = useMemo(() => rooms.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (category !== 'all' && r.categoryId !== category) return false;
    if (floor !== 'all' && r.floor !== Number(floor)) return false;
    if (q.trim() && !r.number.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [rooms, q, status, category, floor]);

  const clear = () => { setQ(''); setStatus('all'); setCategory('all'); setFloor('all'); };
  const openEdit = (r: Room) => { setEditing(r); setFormOpen(true); };
  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const res = await deleteRoom(deleting.id);
    setBusy(false);
    if (res.ok) toast.success(`Room ${deleting.number} deleted`); else toast.error('Could not delete room', res.error);
    setDeleting(null);
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const actions = (r: Room) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" aria-label={`Change status of room ${r.number}`} onClick={stop(() => setStatusRoom(r))}><RefreshCw className="h-4 w-4" aria-hidden /></Button>
      <Button variant="ghost" size="sm" aria-label={`Edit room ${r.number}`} onClick={stop(() => openEdit(r))}><Pencil className="h-4 w-4" aria-hidden /></Button>
      {!backendMode && <Button variant="ghost" size="sm" aria-label={`Delete room ${r.number}`} onClick={stop(() => setDeleting(r))}><Trash2 className="h-4 w-4 text-danger" aria-hidden /></Button>}
    </div>
  );

  const columns: Column<Room>[] = [
    { key: 'number', header: 'Room', sortValue: (r) => r.number, render: (r) => <span className="font-medium">{r.number}{hotelId === 'all' && <span className="ml-2 text-meta font-normal text-slate">{hotelShortName(r.hotelId)}</span>}</span> },
    { key: 'category', header: 'Category', sortValue: (r) => categoryById(r.categoryId).name, render: (r) => categoryById(r.categoryId).name },
    { key: 'floor', header: 'Floor', sortValue: (r) => r.floor, render: (r) => r.floor },
    { key: 'cap', header: 'Sleeps', sortValue: (r) => categoryById(r.categoryId).capacity, render: (r) => categoryById(r.categoryId).capacity },
    { key: 'beds', header: 'Beds', render: (r) => categoryById(r.categoryId).bedConfiguration },
    ...(canViewFinancials ? [{ key: 'price', header: 'Base price', align: 'right' as const, sortValue: (r: Room) => categoryById(r.categoryId).basePrice, render: (r: Room) => formatCurrency(categoryById(r.categoryId).basePrice) }] : []),
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <RoomStatusBadge status={r.status} /> },
    { key: 'hk', header: 'Housekeeping', render: (r) => <span className="text-slate">{housekeepingLabel(r.status)}</span> },
    { key: 'mt', header: 'Maintenance', render: (r) => <span className="text-slate">{maintenanceLabel(r.status)}</span> },
    { key: 'actions', header: '', align: 'right', render: actions },
  ];

  return (
    <>
      <PageHeader title="Rooms" description={`${filtered.length} of ${rooms.length} rooms`}
        actions={<>
          <SegmentedControl label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table', icon: <Rows3 className="h-3.5 w-3.5" aria-hidden /> }, { value: 'grid', label: 'Grid', icon: <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> }]} />
          <Link to="/rooms/floor-plan"><Button variant="secondary">Floor plan</Button></Link>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />Add room</Button>
        </>}
      />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <label htmlFor="room-q" className="block text-meta font-medium">Search</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
              <input id="room-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Room number" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div>
          </div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...(Object.keys(ROOM_STATUS_META) as RoomStatus[]).map((s) => ({ value: s, label: ROOM_STATUS_META[s].label }))]} />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
          <Select label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} options={[{ value: 'all', label: 'All floors' }, ...floors.map((f) => ({ value: String(f), label: `Floor ${f}` }))]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={BedDouble} title="No rooms match these filters" description="Try a different status, category or floor." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
        ) : view === 'table' ? (
          <DataTable caption="Rooms" rows={filtered} columns={columns} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'number', dir: 'asc' }} onRowClick={(r) => navigate(`/rooms/${r.id}`)}
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-3 p-4">
                <Link to={`/rooms/${r.id}`} className="min-w-0 flex-1"><p className="font-medium">Room {r.number} <span className="font-normal text-slate">· Floor {r.floor}</span></p><p className="text-meta text-slate">{categoryById(r.categoryId).name}{canViewFinancials && ` · ${formatCurrency(categoryById(r.categoryId).basePrice)}`}</p><div className="mt-1.5"><RoomStatusBadge status={r.status} /></div></Link>
                {actions(r)}
              </div>
            )} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => {
              const c = categoryById(r.categoryId);
              return (
                <div key={r.id} className={cn('rounded-lg border border-line border-l-4 bg-white p-4', STATUS_BORDER[r.status])}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/rooms/${r.id}`} className="font-heading text-section font-semibold hover:underline">{r.number}</Link>
                    <RoomStatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-body">{c.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-meta text-slate"><Users className="h-3.5 w-3.5" aria-hidden />Sleeps {c.capacity} · Floor {r.floor}{hotelId === 'all' && ` · ${hotelShortName(r.hotelId)}`}</p>
                  <p className="mt-0.5 text-meta text-slate">{c.bedConfiguration}</p>
                  <div className="mt-3 flex items-center justify-between">{canViewFinancials && <p className="font-medium tnum">{formatCurrency(c.basePrice)}<span className="text-meta font-normal text-slate"> / night</span></p>}{actions(r)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <RoomFormDialog open={formOpen} room={editing} onClose={() => setFormOpen(false)} />
      <RoomStatusDialog room={statusRoom} onClose={() => setStatusRoom(null)} />
      <ConfirmDialog open={Boolean(deleting)} title={`Delete room ${deleting?.number}?`} confirmLabel="Delete room" danger loading={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
        This removes the room from inventory. Rooms with active or upcoming reservations cannot be deleted.
      </ConfirmDialog>
    </>
  );
}
