import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { useScopedData } from '@/hooks/useScopedData';
import { today } from '@/utils/demoClock';
import { formatDate } from '@/utils/format';
import { arrivalsOf, departuresOf, inHouseOf } from './frontDeskLists';
import { FrontDeskShell } from './FrontDeskShell';
import { StayActions } from './StayList';
import { useFrontDeskDialogs } from './useFrontDeskDialogs';

export default function FrontDesk() {
  const { reservations, rooms, guestById, roomById } = useScopedData();
  const { dialogs, ...a } = useFrontDeskDialogs();
  const [q, setQ] = useState('');

  const arrivals = arrivalsOf(reservations);
  const departures = departuresOf(reservations);
  const inHouse = inHouseOf(reservations);
  const ready = rooms.filter((r) => r.status === 'available' || r.status === 'inspected').length;

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return reservations.filter((r) => ['pending', 'confirmed', 'checked_in'].includes(r.status)).filter((r) => `${r.reference} ${guestById.get(r.guestId)?.fullName ?? ''} ${roomById.get(r.roomId)?.number ?? ''}`.toLowerCase().includes(term))
      .sort((x, y) => (x.checkIn < y.checkIn ? -1 : 1)).slice(0, 6);
  }, [q, reservations, guestById, roomById]);

  const List = ({ title, to, rows, mode }: { title: string; to: string; rows: typeof arrivals; mode: 'arrivals' | 'departures' | 'in-house' }) => (
    <Card>
      <CardHeader title={title} action={<Link to={to} className="text-meta font-medium text-info hover:underline">View all</Link>} />
      {rows.length === 0 ? <p className="px-5 py-6 text-body text-slate">Nothing to show.</p> : (
        <ul className="divide-y divide-line">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id} className="space-y-2 px-5 py-3">
              <div className="flex items-center justify-between gap-2"><p className="truncate text-body font-medium">{guestById.get(r.guestId)?.fullName}</p><span className="shrink-0 text-meta text-slate">Room {roomById.get(r.roomId)?.number}</span></div>
              <StayActions r={r} mode={mode} a={a} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <FrontDeskShell title="Front desk" description={formatDate(today())} actions={<Link to="/reservations/walk-in"><Button><UserPlus className="h-4 w-4" aria-hidden />Walk-in booking</Button></Link>}>
      <section aria-label="Today" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Arrivals today" value={String(arrivals.length)} hint={`${arrivals.filter((r) => r.status === 'checked_in').length} checked in`} />
        <StatCard label="Departures today" value={String(departures.length)} hint={`${departures.filter((r) => r.status === 'checked_out').length} departed`} />
        <StatCard label="In-house guests" value={String(inHouse.length)} />
        <StatCard label="Rooms ready" value={String(ready)} hint="Available or inspected" />
      </section>

      <Card className="mt-4 p-5 sm:mt-6">
        <label htmlFor="fd-lookup" className="text-card font-semibold">Guest and reservation lookup</label>
        <div className="relative mt-3 max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
          <input id="fd-lookup" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest name, reference or room number" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div>
        {q.trim().length >= 2 && (
          <ul className="mt-3 divide-y divide-line rounded border border-line" aria-live="polite">
            {results.length === 0 && <li className="px-4 py-3 text-body text-slate">No active bookings match “{q}”.</li>}
            {results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div><Link to={`/reservations/${r.id}`} className="text-body font-medium hover:underline">{guestById.get(r.guestId)?.fullName}</Link><p className="text-meta text-slate">{r.reference} · Room {roomById.get(r.roomId)?.number} · {formatDate(r.checkIn, false)} → {formatDate(r.checkOut, false)}</p></div>
                <div className="flex items-center gap-2"><ReservationStatusBadge status={r.status} />{(r.status === 'checked_in' || r.checkIn <= today()) ? <StayActions r={r} mode="arrivals" a={a} /> : null}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
        <List title="Expected arrivals" to="/front-desk/arrivals" rows={arrivals.filter((r) => r.status !== 'checked_in')} mode="arrivals" />
        <List title="Expected departures" to="/front-desk/departures" rows={departures.filter((r) => r.status === 'checked_in')} mode="departures" />
        <List title="In-house" to="/front-desk/in-house" rows={inHouse} mode="in-house" />
      </div>
      {dialogs}
    </FrontDeskShell>
  );
}
