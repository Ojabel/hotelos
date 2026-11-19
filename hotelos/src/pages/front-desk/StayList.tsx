import { Link } from 'react-router-dom';
import { Clock, FileText, LogIn, LogOut, Plus, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReservationStatusBadge, RoomStatusBadge } from '@/components/ui/StatusBadge';
import { useScopedData } from '@/hooks/useScopedData';
import type { Reservation } from '@/types';
import { computeFolio } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { useFrontDeskDialogs } from './useFrontDeskDialogs';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { backendMode } from '@/services/api/backendMode';

export type Actions = Omit<ReturnType<typeof useFrontDeskDialogs>, 'dialogs'>;
export type Mode = 'arrivals' | 'departures' | 'in-house';

export function StayActions({ r, mode, a }: { r: Reservation; mode: Mode; a: Actions }) {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {(r.status === 'pending' || r.status === 'confirmed') && <Button size="sm" onClick={stop(() => a.openCheckIn(r))}><LogIn className="h-3.5 w-3.5" aria-hidden />Check in</Button>}
      {r.status === 'checked_in' && <Button size="sm" onClick={stop(() => a.openCheckOut(r))}><LogOut className="h-3.5 w-3.5" aria-hidden />Check out</Button>}
      {(canViewFinancials || backendMode) && r.status === 'checked_in' && mode === 'in-house' && <>
        <Button size="sm" variant="secondary" onClick={stop(() => a.openTransfer(r))}><Repeat className="h-3.5 w-3.5" aria-hidden />Transfer</Button>
        <Button size="sm" variant="secondary" onClick={stop(() => a.openLate(r))}><Clock className="h-3.5 w-3.5" aria-hidden />Late check-out</Button>
        <Button size="sm" variant="secondary" onClick={stop(() => a.openCharge(r))}><Plus className="h-3.5 w-3.5" aria-hidden />Charge</Button>
      </>}
      {canViewFinancials && <Button size="sm" variant="ghost" onClick={stop(() => a.openFolio(r))} aria-label={`Open folio for ${r.reference}`}><FileText className="h-3.5 w-3.5" aria-hidden />Folio</Button>}
    </div>
  );
}

export function StayList({ rows, mode, a, emptyTitle }: { rows: Reservation[]; mode: Mode; a: Actions; emptyTitle: string }) {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { guestById, roomById, charges, payments, refunds } = useScopedData();
  const balance = (r: Reservation) => computeFolio(r, charges, payments, refunds).balance;

  const columns: Column<Reservation>[] = [
    { key: 'guest', header: 'Guest', sortValue: (r) => guestById.get(r.guestId)?.fullName ?? '', render: (r) => <div><Link to={`/guests/${r.guestId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{guestById.get(r.guestId)?.fullName}{guestById.get(r.guestId)?.vip && <span className="ml-1.5 text-meta text-champagne">VIP</span>}</Link><p className="text-meta text-slate">{r.reference}</p></div> },
    { key: 'room', header: 'Room', sortValue: (r) => roomById.get(r.roomId)?.number ?? '', render: (r) => <span className="flex items-center gap-2 font-medium">{roomById.get(r.roomId)?.number}{mode === 'arrivals' && r.status !== 'checked_in' && roomById.get(r.roomId) && <RoomStatusBadge status={roomById.get(r.roomId)!.status} />}</span> },
    { key: 'stay', header: mode === 'arrivals' ? 'Departs' : mode === 'departures' ? 'Arrived' : 'Stay', sortValue: (r) => (mode === 'arrivals' ? r.checkOut : r.checkIn), render: (r) => (mode === 'arrivals' ? formatDate(r.checkOut, false) : mode === 'departures' ? formatDate(r.checkIn, false) : `${formatDate(r.checkIn, false)} → ${formatDate(r.checkOut, false)}`) },
    { key: 'pax', header: 'Guests', render: (r) => r.adults + r.children },
    ...(canViewFinancials ? [{ key: 'bal', header: 'Balance', align: 'right' as const, sortValue: balance, render: (r: Reservation) => formatCurrency(Math.max(0, balance(r))) }] : []),
    { key: 'status', header: 'Status', render: (r) => <ReservationStatusBadge status={r.status} /> },
    { key: 'actions', header: '', align: 'right', render: (r) => <StayActions r={r} mode={mode} a={a} /> },
  ];

  return (
    <DataTable caption={emptyTitle} rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'room', dir: 'asc' }}
      empty={<EmptyState icon={LogIn} title={emptyTitle} />}
      mobileCard={(r) => (
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{guestById.get(r.guestId)?.fullName}</p><p className="text-meta text-slate">Room {roomById.get(r.roomId)?.number} · {r.reference}</p></div><ReservationStatusBadge status={r.status} /></div>
          <p className="text-meta text-slate tnum">{formatDate(r.checkIn, false)} → {formatDate(r.checkOut, false)}{canViewFinancials && ` · Balance ${formatCurrency(Math.max(0, balance(r)))}`}</p>
          <StayActions r={r} mode={mode} a={a} />
        </div>
      )} />
  );
}
