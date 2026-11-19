import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BedDouble, Pencil, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Detail } from '@/components/ui/Detail';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReservationStatusBadge, RoomStatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { hotelName } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { useHotelStore } from '@/store/useHotelStore';
import type { Reservation } from '@/types';
import { today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { housekeepingLabel, maintenanceLabel } from '@/utils/roomRules';
import { MAINTENANCE_STATUS_META, TASK_STATUS_META } from '@/utils/status';
import { RoomFormDialog } from './RoomFormDialog';
import { RoomStatusDialog } from './RoomStatusDialog';


export default function RoomDetail() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { id } = useParams();
  const navigate = useNavigate();
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === id));
  const reservations = useHotelStore((s) => s.reservations);
  const guests = useHotelStore((s) => s.guests);
  const allMaintenance = useHotelStore((s) => s.maintenanceRequests);
  const allTasks = useHotelStore((s) => s.housekeepingTasks);
  const staff = useHotelStore((s) => s.staff);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const history = useMemo(() => reservations.filter((r) => r.roomId === id).sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)), [reservations, id]);
  const guestName = (gid: string) => guests.find((g) => g.id === gid)?.fullName ?? gid;

  if (!room) {
    return <Card><EmptyState icon={BedDouble} title="Room not found" description="It may have been deleted." action={<Link to="/rooms"><Button variant="secondary">Back to rooms</Button></Link>} /></Card>;
  }

  const cat = categoryById(room.categoryId);
  const t = today();
  const current = history.find((r) => r.status === 'checked_in');
  const next = [...history].reverse().find((r) => ['confirmed', 'pending'].includes(r.status) && r.checkIn >= t);
  const maintenance = allMaintenance.filter((m) => m.roomId === room.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const housekeeping = allTasks.filter((x) => x.roomId === room.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));

  const histCols: Column<Reservation>[] = [
    { key: 'ref', header: 'Reference', sortValue: (r) => r.reference, render: (r) => <Link to={`/reservations/${r.id}`} className="font-medium hover:underline">{r.reference}</Link> },
    { key: 'guest', header: 'Guest', render: (r) => guestName(r.guestId) },
    { key: 'in', header: 'Check-in', sortValue: (r) => r.checkIn, render: (r) => formatDate(r.checkIn, false) },
    { key: 'out', header: 'Check-out', sortValue: (r) => r.checkOut, render: (r) => formatDate(r.checkOut, false) },
    { key: 'status', header: 'Status', render: (r) => <ReservationStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title={`Room ${room.number}`} description={`${cat.name} · ${hotelName(room.hotelId)}`}
        actions={<><RoomStatusBadge status={room.status} /><Button variant="secondary" onClick={() => setStatusOpen(true)}><RefreshCw className="h-4 w-4" aria-hidden />Change status</Button><Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Edit</Button></>} />

      <Tabs label="Room sections" value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'history', label: `Reservation history (${history.length})` }, { id: 'maintenance', label: 'Maintenance' }, { id: 'housekeeping', label: 'Housekeeping' }]} />

      <div className="mt-5" role="tabpanel">
        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="text-card font-semibold">Room information</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Floor">{room.floor}</Detail>
                <Detail label="Capacity">{cat.capacity} guests</Detail>
                <Detail label="Bed configuration">{cat.bedConfiguration}</Detail>
                {canViewFinancials && <Detail label="Base price">{formatCurrency(cat.basePrice)} / night</Detail>}
                <Detail label="Housekeeping">{housekeepingLabel(room.status)}</Detail>
                <Detail label="Maintenance">{maintenanceLabel(room.status)}</Detail>
              </dl>
              <p className="mt-4 text-body text-slate">{cat.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">{cat.amenities.map((a) => <Badge key={a} tone="neutral">{a}</Badge>)}</div>
            </Card>
            <Card className="p-5">
              <h2 className="text-card font-semibold">Reservations</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-meta text-slate">Current</p>
                  {current ? <Link to={`/reservations/${current.id}`} className="text-body font-medium hover:underline">{guestName(current.guestId)}<span className="block text-meta font-normal text-slate">Until {formatDate(current.checkOut)}</span></Link> : <p className="text-body text-slate">Not occupied</p>}
                </div>
                <div>
                  <p className="text-meta text-slate">Next arrival</p>
                  {next ? <Link to={`/reservations/${next.id}`} className="text-body font-medium hover:underline">{guestName(next.guestId)}<span className="block text-meta font-normal text-slate">{formatDate(next.checkIn)}</span></Link> : <p className="text-body text-slate">None scheduled</p>}
                </div>
              </div>
            </Card>
          </div>
        )}
        {tab === 'history' && <Card><DataTable caption="Reservation history" rows={history} columns={histCols} rowKey={(r) => r.id} pageSize={8} initialSort={{ key: 'in', dir: 'desc' }} onRowClick={(r) => navigate(`/reservations/${r.id}`)} empty={<EmptyState icon={BedDouble} title="No reservations yet" />} /></Card>}
        {tab === 'maintenance' && (
          <Card>{maintenance.length === 0 ? <EmptyState icon={BedDouble} title="No maintenance records" description="This room has no logged issues." /> : (
            <ul className="divide-y divide-line">{maintenance.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div><p className="text-body font-medium">{m.category}</p><p className="text-body text-slate">{m.description}</p><p className="mt-1 text-meta text-slate">{formatDate(m.createdAt)}{canViewFinancials && ` · Estimate ${formatCurrency(m.costEstimate)}`}{m.resolutionNotes ? ` · ${m.resolutionNotes}` : ''}</p></div>
                <Badge tone={MAINTENANCE_STATUS_META[m.status].tone}>{MAINTENANCE_STATUS_META[m.status].label}</Badge>
              </li>))}
            </ul>)}
          </Card>
        )}
        {tab === 'housekeeping' && (
          <Card>{housekeeping.length === 0 ? <EmptyState icon={BedDouble} title="No housekeeping records" /> : (
            <ul className="divide-y divide-line">{housekeeping.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-body font-medium capitalize">{h.type} clean</p><p className="text-meta text-slate">{formatDate(h.date)} · {staff.find((p) => p.id === h.assigneeId)?.name ?? 'Unassigned'}</p></div><Badge tone={TASK_STATUS_META[h.status].tone}>{TASK_STATUS_META[h.status].label}</Badge></li>))}
            </ul>)}
          </Card>
        )}
      </div>

      <RoomFormDialog open={editOpen} room={room} onClose={() => setEditOpen(false)} />
      <RoomStatusDialog room={statusOpen ? room : null} onClose={() => setStatusOpen(false)} />
    </>
  );
}
