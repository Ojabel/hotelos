import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { RoomStatusBadge } from '@/components/ui/StatusBadge';
import { hotelName, mockHotels } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { useScopedData } from '@/hooks/useScopedData';
import type { Room, RoomStatus } from '@/types';
import { today } from '@/utils/demoClock';
import { formatCurrency } from '@/utils/format';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { ROOM_STATUS_META } from '@/utils/status';
import { cn } from '@/utils/cn';
import { RoomStatusDialog } from './RoomStatusDialog';

const TILE: Record<RoomStatus, string> = {
  available: 'border-success/50 bg-success/10', reserved: 'border-info/50 bg-info/10', occupied: 'border-champagne bg-champagne/25',
  dirty: 'border-warning/60 bg-warning/15', cleaning: 'border-info/50 bg-info/10 border-dashed', inspected: 'border-success/50 bg-success/5',
  maintenance: 'border-danger/50 bg-danger/10', out_of_service: 'border-slate/40 bg-slate/10',
};

export default function FloorPlan() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { rooms, reservations, guestById } = useScopedData();
  const [selected, setSelected] = useState<Room | null>(null);
  const [statusRoom, setStatusRoom] = useState<Room | null>(null);

  const groups = useMemo(() => mockHotels.map((h) => {
    const hr = rooms.filter((r) => r.hotelId === h.id);
    const floors = [...new Set(hr.map((r) => r.floor))].sort((a, b) => b - a);
    return { hotel: h, floors: floors.map((f) => ({ floor: f, rooms: hr.filter((r) => r.floor === f).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) })) };
  }).filter((g) => g.floors.length > 0), [rooms]);

  const current = selected ? rooms.find((r) => r.id === selected.id) ?? selected : null;
  const stay = current ? reservations.find((r) => r.roomId === current.id && r.status === 'checked_in') ?? reservations.find((r) => r.roomId === current.id && r.status === 'confirmed' && r.checkIn === today()) : undefined;

  return (
    <>
      <PageHeader title="Floor plan" description="Live room status by floor. Select a room for details." actions={<Link to="/rooms"><Button variant="secondary">Back to rooms</Button></Link>} />
      <Card className="mb-4 p-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {(Object.keys(ROOM_STATUS_META) as RoomStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-2 text-meta"><span className={cn('h-4 w-4 rounded border', TILE[s])} aria-hidden />{ROOM_STATUS_META[s].label}</li>
          ))}
        </ul>
      </Card>

      <div className="space-y-6">
        {groups.map(({ hotel, floors }) => (
          <Card key={hotel.id}>
            <div className="border-b border-line px-5 py-4"><h2 className="text-card font-semibold">{hotel.name}</h2></div>
            <div className="divide-y divide-line">
              {floors.map(({ floor, rooms: fr }) => (
                <div key={floor} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <p className="w-20 shrink-0 text-meta font-medium uppercase tracking-wide text-slate">Floor {floor}</p>
                  <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {fr.map((r) => (
                      <button key={r.id} type="button" onClick={() => setSelected(r)} aria-label={`Room ${r.number}, ${ROOM_STATUS_META[r.status].label}`}
                        className={cn('rounded border p-2 text-left transition-shadow hover:shadow-card', TILE[r.status])}>
                        <span className="block font-heading text-card font-semibold">{r.number}</span>
                        <span className="block truncate text-[11px] text-slate">{categoryById(r.categoryId).name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(current)} onClose={() => setSelected(null)} variant="drawer" title={current ? `Room ${current.number}` : ''} description={current ? hotelName(current.hotelId) : undefined}
        footer={current && <><Button variant="secondary" onClick={() => setStatusRoom(current)}>Change status</Button><Link to={`/rooms/${current.id}`}><Button className="w-full">View details</Button></Link></>}>
        {current && (
          <div className="space-y-5">
            <RoomStatusBadge status={current.status} />
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Category">{categoryById(current.categoryId).name}</Detail>
              <Detail label="Floor">{current.floor}</Detail>
              <Detail label="Sleeps">{categoryById(current.categoryId).capacity}</Detail>
              {canViewFinancials && <Detail label="Rate">{formatCurrency(categoryById(current.categoryId).basePrice)}</Detail>}
            </dl>
            {stay && (
              <div className="rounded border border-line bg-ivory/60 p-3">
                <p className="text-meta text-slate">{stay.status === 'checked_in' ? 'In-house guest' : 'Arriving today'}</p>
                <Link to={`/reservations/${stay.id}`} className="text-body font-medium hover:underline">{guestById.get(stay.guestId)?.fullName}</Link>
                <p className="text-meta text-slate">{stay.reference}</p>
              </div>
            )}
          </div>
        )}
      </Dialog>
      <RoomStatusDialog room={statusRoom} onClose={() => setStatusRoom(null)} />
    </>
  );
}
