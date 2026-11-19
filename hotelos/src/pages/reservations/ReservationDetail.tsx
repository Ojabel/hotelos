import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { hotelName } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { modifyReservation, setReservationStatus } from '@/services/mockReservationService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { ReservationStatus } from '@/types';
import { nightsBetween, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { findAvailableRooms } from '@/utils/reservationRules';
import { computeFolio } from '@/utils/folio';
import { useFrontDeskDialogs } from '@/pages/front-desk/useFrontDeskDialogs';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { backendMode, useBackendHotels } from '@/services/api/backendMode';

export default function ReservationDetail() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { id } = useParams();
  const res = useHotelStore((s) => s.reservations.find((r) => r.id === id));
  const rooms = useHotelStore((s) => s.rooms);
  const reservations = useHotelStore((s) => s.reservations);
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === res?.guestId));
  const allPayments = useHotelStore((s) => s.payments);
  const payments = useMemo(() => allPayments.filter((p) => p.reservationId === id), [allPayments, id]);

  const charges = useHotelStore((s) => s.charges);
  const refunds = useHotelStore((s) => s.refunds);
  const hotels = useBackendHotels();
  const { dialogs, openCheckIn, openCheckOut, openFolio } = useFrontDeskDialogs();
  const [action, setAction] = useState<null | { status: ReservationStatus; title: string; body: string; label: string; danger?: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ checkIn: '', checkOut: '', roomId: '', adults: '1', children: '0', notes: '' });
  const [error, setError] = useState('');

  if (!res) return <Card><EmptyState icon={CalendarCheck} title="Reservation not found" action={<Link to="/reservations"><Button variant="secondary">Back to reservations</Button></Link>} /></Card>;

  const room = rooms.find((r) => r.id === res.roomId);
  const nights = nightsBetween(res.checkIn, res.checkOut);
  const inactive = res.status === 'cancelled' || res.status === 'no_show';
  const folio = computeFolio(res, charges, allPayments, refunds);
  const balance = inactive ? 0 : Math.max(0, folio.balance);
  const canCheckIn = (res.status === 'pending' || res.status === 'confirmed') && res.checkIn <= today() && res.checkOut > today();
  const canModify = res.status === 'pending' || res.status === 'confirmed';

  const openEdit = () => {
    setError('');
    setForm({ checkIn: res.checkIn, checkOut: res.checkOut, roomId: res.roomId, adults: String(res.adults), children: String(res.children), notes: res.notes ?? '' });
    setEditOpen(true);
  };
  const roomOptions = findAvailableRooms(rooms, reservations, { hotelId: res.hotelId, checkIn: form.checkIn || res.checkIn, checkOut: form.checkOut || res.checkOut, ignoreReservationId: res.id });
  if (editOpen && room && !roomOptions.some((r) => r.id === room.id) && form.roomId === room.id) roomOptions.unshift(room);

  const confirm = async () => {
    if (!action) return;
    setBusy(true);
    const r = await setReservationStatus(res.id, action.status);
    setBusy(false);
    if (r.ok) toast.success(`Reservation ${action.status === 'confirmed' ? 'confirmed' : action.status === 'cancelled' ? 'cancelled' : 'marked no-show'}`); else toast.error('Could not update reservation', r.error);
    setAction(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await modifyReservation(res.id, { checkIn: form.checkIn, checkOut: form.checkOut, roomId: form.roomId, adults: Number(form.adults), children: Number(form.children), notes: form.notes || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Reservation updated');
    setEditOpen(false);
  };

  return (
    <>
      <PageHeader title={res.reference} description={`${backendMode ? hotels.find((hotel) => hotel.id === res.hotelId)?.name ?? 'Hotel' : hotelName(res.hotelId)} · created ${formatDate(res.createdAt, false)}`}
        actions={<>
          <ReservationStatusBadge status={res.status} />
          {canCheckIn && <Button onClick={() => openCheckIn(res)}>Check in</Button>}
          {res.status === 'checked_in' && <Button onClick={() => openCheckOut(res)}>Check out</Button>}
          {canViewFinancials && (res.status === 'checked_in' || res.status === 'checked_out') && <Button variant="secondary" onClick={() => openFolio(res)}>Folio</Button>}
          {canModify && <Button variant="secondary" onClick={openEdit}><Pencil className="h-4 w-4" aria-hidden />Modify</Button>}
          {res.status === 'pending' && <Button onClick={() => setAction({ status: 'confirmed', title: 'Confirm reservation?', body: 'The booking will be confirmed and the room held for the guest.', label: 'Confirm reservation' })}>Confirm</Button>}
          {res.status === 'confirmed' && res.checkIn <= today() && <Button variant="secondary" onClick={() => setAction({ status: 'no_show', title: 'Mark as no-show?', body: 'The guest did not arrive. The room is released.', label: 'Mark no-show', danger: true })}>No-show</Button>}
          {canModify && <Button variant="danger" onClick={() => setAction({ status: 'cancelled', title: 'Cancel reservation?', body: 'The room will be released. Any deposit already paid must be refunded through Finance.', label: 'Cancel reservation', danger: true })}>Cancel</Button>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-card font-semibold">Stay</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Check-in">{formatDate(res.checkIn)}</Detail>
            <Detail label="Check-out">{formatDate(res.checkOut)}</Detail>
            <Detail label="Nights">{nights}</Detail>
            <Detail label="Room">{room ? <Link to={`/rooms/${room.id}`} className="hover:underline">{room.number}</Link> : '—'}</Detail>
            <Detail label="Category">{categoryById(res.categoryId).name}</Detail>
            <Detail label="Guests">{res.adults} adult{res.adults > 1 ? 's' : ''}{res.children > 0 && `, ${res.children} child${res.children > 1 ? 'ren' : ''}`}</Detail>
          </dl>
          {res.notes && <p className="mt-4 rounded bg-ivory px-3 py-2 text-body text-slate">{res.notes}</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-card font-semibold">Guest</h2>
          {guest && <div className="mt-4 space-y-1">
            <Link to={`/guests/${guest.id}`} className="text-body font-medium hover:underline">{guest.fullName}</Link>
            <p className="text-body text-slate">{guest.email}</p><p className="text-body text-slate">{guest.phone}</p>
          </div>}
        </Card>
        {canViewFinancials && <Card className="p-5 lg:col-span-3">
          <h2 className="text-card font-semibold">Financials</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Detail label="Nightly rate"><span className="tnum">{formatCurrency(res.nightlyRate)}</span></Detail>
            <Detail label="Total charges"><span className="tnum">{formatCurrency(folio.total)}</span></Detail>
            <Detail label="Deposit"><span className="tnum">{formatCurrency(res.deposit)}</span></Detail>
            <Detail label="Paid"><span className="tnum">{formatCurrency(folio.netPaid)}</span></Detail>
            <Detail label="Outstanding"><span className="tnum">{formatCurrency(balance)}</span></Detail>
          </dl>
          {payments.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {payments.map((p) => <li key={p.id} className="flex justify-between py-2 text-body"><span className="text-slate">{p.reference} · {formatDate(p.date, false)}</span><span className="tnum">{formatCurrency(p.amount)}</span></li>)}
            </ul>
          )}
        </Card>}
      </div>

      {dialogs}
      <ConfirmDialog open={Boolean(action)} title={action?.title ?? ''} confirmLabel={action?.label ?? ''} danger={action?.danger} loading={busy} onConfirm={confirm} onClose={() => setAction(null)}>{action?.body}</ConfirmDialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Modify reservation" description="Availability is checked against all other bookings."
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" form="mod-form" loading={busy}>Save changes</Button></>}>
        <form id="mod-form" onSubmit={save} noValidate className="space-y-4">
          {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Check-in" type="date" min={today()} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            <Input label="Check-out" type="date" min={form.checkIn} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </div>
          <Select label="Room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} options={roomOptions.map((r) => ({ value: r.id, label: `${r.number} — ${categoryById(r.categoryId).name}` }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Adults" type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
            <Input label="Children" type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </form>
      </Dialog>
    </>
  );
}
