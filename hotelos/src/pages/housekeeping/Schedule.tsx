import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriorityBadge, TaskStatusBadge } from '@/components/ui/StatusBadge';
import { useScopedData } from '@/hooks/useScopedData';
import { createTask, priorityForRoom } from '@/services/mockHousekeepingService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { addDays, today } from '@/utils/demoClock';
import { formatDate } from '@/utils/format';
import { HousekeepingShell } from './HousekeepingShell';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';

export default function Schedule() {
  const t = today();
  const { rooms, reservations, roomById, guestById } = useScopedData();
  const staff = useHotelStore((s) => s.staff);
  const tasks = useHotelStore((s) => s.housekeepingTasks);
  const [busy, setBusy] = useState<string | null>(null);

  const roomIds = new Set(rooms.map((r) => r.id));
  const team = staff.filter((p) => p.department === 'Housekeeping' && (rooms.length === 0 || rooms.some((r) => r.hotelId === p.hotelId)));
  const mine = (id: string) => tasks.filter((x) => x.assigneeId === id && roomIds.has(x.roomId) && (x.status !== 'inspected' || x.date === t));
  const unassigned = tasks.filter((x) => !x.assigneeId && x.status !== 'inspected' && roomIds.has(x.roomId));

  // departures today and tomorrow whose room has no cleaning task yet
  const expected = reservations.filter((r) => (r.checkOut === t || r.checkOut === addDays(t, 1)) && (r.status === 'checked_in' || r.status === 'confirmed') && !tasks.some((x) => x.roomId === r.roomId && x.status !== 'inspected'));

  const create = async (roomId: string) => {
    setBusy(roomId);
    const r = await createTask({ roomId, type: 'turnover', priority: priorityForRoom(roomId), notes: 'Scheduled from expected departure.' });
    setBusy(null);
    if (r.ok) toast.success('Task scheduled'); else toast.error('Could not schedule', r.error);
  };

  return (
    <HousekeepingShell title="Cleaning schedule" description={`Workload for ${formatDate(t)}`}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.map((p) => {
          const list = mine(p.id);
          const openCount = list.filter((x) => x.status !== 'inspected').length;
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-4"><div><p className="text-card font-semibold">{p.name}</p><p className="text-meta text-slate">{p.title}</p></div><span className={`text-meta font-medium ${p.status === 'on_leave' ? 'text-warning' : 'text-slate'}`}>{p.status === 'on_leave' ? 'On leave' : `${openCount} open`}</span></div>
              {list.length === 0 ? <p className="px-5 py-5 text-body text-slate">No tasks today.</p> : (
                <ul className="divide-y divide-line">{list.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 px-5 py-2.5"><span className="text-body font-medium">Room {roomById.get(x.roomId)?.number}</span><span className="flex items-center gap-1.5"><PriorityBadge priority={x.priority} /><TaskStatusBadge status={x.status} /></span></li>)}</ul>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Unassigned tasks" action={<Link to="/housekeeping" className="text-meta font-medium text-info hover:underline">Assign</Link>} />
          {unassigned.length === 0 ? <p className="px-5 py-6 text-body text-slate">Everything has an owner.</p> : (
            <ul className="divide-y divide-line">{unassigned.map((x) => <li key={x.id} className="flex items-center justify-between px-5 py-3"><span className="text-body font-medium">Room {roomById.get(x.roomId)?.number}</span><PriorityBadge priority={x.priority} /></li>)}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Expected turnovers" action={<span className="text-meta text-slate">Today and tomorrow</span>} />
          {expected.length === 0 ? <EmptyState icon={ClipboardList} title="Nothing to schedule" description="Every expected departure already has a task." /> : (
            <ul className="divide-y divide-line">{expected.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-body font-medium">Room {roomById.get(r.roomId)?.number}</p><p className="text-meta text-slate">{guestById.get(r.guestId)?.fullName} · leaves {r.checkOut === t ? 'today' : 'tomorrow'}</p></div><Button size="sm" variant="secondary" onClick={() => create(r.roomId)} loading={busy === r.roomId}>Schedule</Button></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </HousekeepingShell>
  );
}
