import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Plus, Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { categoryById } from '@/data/roomCatalog';
import { useScopedData } from '@/hooks/useScopedData';
import type { Reservation, ReservationStatus } from '@/types';
import { nightsBetween } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { RESERVATION_STATUS_META } from '@/utils/status';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';

export default function ReservationsPage() {
  const navigate = useNavigate();
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { reservations, guestById, roomById, charges } = useScopedData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rangeError = from && to && to < from ? 'End date must be on or after the start date.' : '';
  const filtered = useMemo(() => reservations.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (!rangeError && from && r.checkIn < from) return false;
    if (!rangeError && to && r.checkIn > to) return false;
    const term = q.trim().toLowerCase();
    if (term) {
      const hay = `${r.reference} ${guestById.get(r.guestId)?.fullName ?? ''} ${roomById.get(r.roomId)?.number ?? ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  }), [reservations, q, status, from, to, rangeError, guestById, roomById]);

  const clear = () => { setQ(''); setStatus('all'); setFrom(''); setTo(''); };
  const balance = (r: Reservation) => (r.status === 'cancelled' || r.status === 'no_show' || r.status === 'expired' ? 0 : Math.max(0, r.nightlyRate * nightsBetween(r.checkIn, r.checkOut) + charges.filter((c) => c.reservationId === r.id).reduce((sum, c) => sum + c.amount, 0) - r.paid));

  const columns: Column<Reservation>[] = [
    { key: 'ref', header: 'Reference', sortValue: (r) => r.reference, render: (r) => <span className="font-medium">{r.reference}</span> },
    { key: 'guest', header: 'Guest', sortValue: (r) => guestById.get(r.guestId)?.fullName ?? '', render: (r) => guestById.get(r.guestId)?.fullName },
    { key: 'in', header: 'Check-in', sortValue: (r) => r.checkIn, render: (r) => formatDate(r.checkIn, false) },
    { key: 'out', header: 'Check-out', sortValue: (r) => r.checkOut, render: (r) => formatDate(r.checkOut, false) },
    { key: 'room', header: 'Room', render: (r) => <>{roomById.get(r.roomId)?.number}<span className="ml-2 text-meta text-slate">{categoryById(r.categoryId).name}</span></> },
    { key: 'pax', header: 'Guests', render: (r) => r.adults + r.children },
    ...(canViewFinancials ? [
      { key: 'total', header: 'Total', align: 'right' as const, sortValue: (r: Reservation) => r.total, render: (r: Reservation) => formatCurrency(r.total) },
      { key: 'dep', header: 'Deposit', align: 'right' as const, render: (r: Reservation) => formatCurrency(r.deposit) },
      { key: 'bal', header: 'Balance', align: 'right' as const, sortValue: balance, render: (r: Reservation) => formatCurrency(balance(r)) },
    ] : []),
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <ReservationStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Reservations" description={`${filtered.length} of ${reservations.length} bookings`}
        actions={<>
          <Link to="/reservations/calendar"><Button variant="secondary"><CalendarDays className="h-4 w-4" aria-hidden />Calendar</Button></Link>
          <Link to="/reservations/walk-in"><Button variant="secondary"><UserPlus className="h-4 w-4" aria-hidden />Walk-in</Button></Link>
          <Link to="/reservations/new"><Button><Plus className="h-4 w-4" aria-hidden />New reservation</Button></Link>
        </>} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-start">
          <div className="space-y-1.5">
            <label htmlFor="res-q" className="block text-meta font-medium">Search</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
              <input id="res-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, guest or room" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div>
          </div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...(Object.keys(RESERVATION_STATUS_META) as ReservationStatus[]).map((s) => ({ value: s, label: RESERVATION_STATUS_META[s].label }))]} />
          <Input label="Check-in from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Check-in to" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={rangeError || undefined} />
          <Button variant="ghost" className="lg:mt-[22px]" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Reservations" rows={filtered} columns={columns} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'in', dir: 'desc' }} onRowClick={(r) => navigate(`/reservations/${r.id}`)}
          empty={<EmptyState icon={CalendarCheck} title="No reservations match" description="Adjust the search, status or date filters." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(r) => (
            <Link to={`/reservations/${r.id}`} className="block p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{guestById.get(r.guestId)?.fullName}</p><p className="text-meta text-slate">{r.reference} · Room {roomById.get(r.roomId)?.number}</p></div><ReservationStatusBadge status={r.status} /></div>
              <p className="mt-2 text-body">{formatDate(r.checkIn, false)} → {formatDate(r.checkOut, false)} <span className="text-slate">({nightsBetween(r.checkIn, r.checkOut)} nights)</span></p>
              {canViewFinancials && <p className="mt-1 text-meta text-slate tnum">Total {formatCurrency(r.total)} · Balance {formatCurrency(balance(r))}</p>}
            </Link>
          )} />
      </Card>
    </>
  );
}
