import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Detail } from '@/components/ui/Detail';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PaymentStatusBadge, RoomStatusBadge } from '@/components/ui/StatusBadge';
import { categoryById } from '@/data/roomCatalog';
import { checkIn, EARLY_CHECK_IN_RATE } from '@/services/mockFrontDeskService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { PaymentMethod, Reservation } from '@/types';
import { nightsBetween, today } from '@/utils/demoClock';
import { computeFolio } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { findAvailableRooms } from '@/utils/reservationRules';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { FINANCIAL_ROLES } from '@/routes/nav';

const STEPS = ['Reservation', 'Guest', 'Room', 'Payment', 'Confirm'];

function Body({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const { rooms, reservations, guests, charges, payments, refunds } = useHotelStore();
  const guest = guests.find((g) => g.id === reservation.guestId)!;
  const [step, setStep] = useState(0);
  const [idChecked, setIdChecked] = useState(false);
  const [roomId, setRoomId] = useState(reservation.roomId);
  const [early, setEarly] = useState(false);
  const [payAmount, setPayAmount] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const current = rooms.find((r) => r.id === reservation.roomId)!;
  const options = useMemo(() => {
    const ready = findAvailableRooms(rooms, reservations, { hotelId: reservation.hotelId, checkIn: today(), checkOut: reservation.checkOut, readyNow: true, ignoreReservationId: reservation.id });
    const own = current.status === 'reserved' ? [current] : [];
    return [...own, ...ready.filter((r) => r.id !== current.id)];
  }, [rooms, reservations, reservation, current]);
  const chosen = rooms.find((r) => r.id === roomId)!;
  const folio = computeFolio(reservation, charges, payments, refunds);
  const earlyFee = Math.round(reservation.nightlyRate * EARLY_CHECK_IN_RATE);
  const pay = Number(payAmount) || 0;
  const roomReady = options.some((r) => r.id === roomId);

  const next = () => {
    setError('');
    if (step === 1 && !idChecked) return setError('Confirm that the guest’s ID has been checked.');
    if (step === 2 && !roomReady) return setError('Choose a room that is ready for the guest.');
    if (step === 3 && (pay < 0 || pay > folio.balance + (early ? earlyFee : 0))) return setError('Payment cannot exceed the outstanding balance.');
    setStep((s) => !canManageFinancials && s === 2 ? 4 : s + 1);
  };

  const confirm = async () => {
    setBusy(true);
    const r = await checkIn({ reservationId: reservation.id, roomId, earlyCheckIn: canManageFinancials && early, payment: canManageFinancials && pay > 0 ? { amount: pay, method } : undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${guest.fullName} checked in`, `Room ${chosen.number} is now occupied`);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="lg" title="Check in guest" description={`${guest.fullName} · ${reservation.reference}`}
      footer={<>
        <Button variant="secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={busy}>{step === 0 ? 'Cancel' : 'Back'}</Button>
        {step < 4 ? <Button onClick={next}>Continue</Button> : <Button onClick={confirm} loading={busy}>Confirm check-in</Button>}
      </>}>
      <ol className="mb-4 flex gap-1.5 overflow-x-auto text-meta" aria-label="Check-in steps">
        {(canManageFinancials ? STEPS : STEPS.filter((s) => s !== 'Payment')).map((s, i) => <li key={s} aria-current={(canManageFinancials ? i : i > 2 ? i + 1 : i) === step ? 'step' : undefined} className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${(canManageFinancials ? i : i > 2 ? i + 1 : i) === step ? 'bg-forest text-ivory' : (canManageFinancials ? i : i > 2 ? i + 1 : i) < step ? 'bg-success/10 text-success' : 'bg-ivory text-slate'}`}>{i + 1}. {s}</li>)}
      </ol>
      {error && <div role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}

      {step === 0 && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="Arrival">{formatDate(reservation.checkIn)}</Detail>
          <Detail label="Departure">{formatDate(reservation.checkOut)}</Detail>
          <Detail label="Nights">{nightsBetween(reservation.checkIn, reservation.checkOut)}</Detail>
          <Detail label="Booked room">{current.number} · {categoryById(current.categoryId).name}</Detail>
          <Detail label="Guests">{reservation.adults + reservation.children}</Detail>
          <Detail label="Status">{reservation.status === 'pending' ? 'Pending' : 'Confirmed'}</Detail>
          {reservation.notes && <div className="col-span-full rounded bg-ivory px-3 py-2 text-body text-slate">{reservation.notes}</div>}
        </dl>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Name">{guest.fullName}{guest.vip && ' · VIP'}</Detail>
            <Detail label="Nationality">{guest.nationality}</Detail>
            <Detail label="Email">{guest.email}</Detail>
            <Detail label="Phone">{guest.phone}</Detail>
            <Detail label="ID">{guest.idType} {guest.idNumber}</Detail>
            <Detail label="Preferences">{guest.preferences.join(', ') || '—'}</Detail>
          </dl>
          <label className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />I have checked the guest’s ID and registered their details</label>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-body">Booked room {current.number} <RoomStatusBadge status={current.status} /></div>
          {!options.some((r) => r.id === current.id) && <p className="rounded bg-warning/10 px-3 py-2 text-body text-warning">Room {current.number} is not ready. Assign another room to check in now.</p>}
          {options.length === 0 ? <p className="text-body text-slate">No rooms are ready at this property.</p> : (
            <Select label="Assigned room" value={roomId} onChange={(e) => setRoomId(e.target.value)} options={[...(options.some((r) => r.id === roomId) ? [] : [{ value: roomId, label: `${chosen.number} (not ready)` }]), ...options.map((r) => ({ value: r.id, label: `${r.number} — ${categoryById(r.categoryId).name}${r.id === current.id ? ' (booked)' : ''}` }))]} />
          )}
        </div>
      )}
      {canManageFinancials && step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded bg-ivory px-3 py-2 text-body"><span>Outstanding balance</span><span className="flex items-center gap-2 font-semibold tnum">{formatCurrency(Math.max(0, folio.balance))}<PaymentStatusBadge status={folio.status} /></span></div>
          <label className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={early} onChange={(e) => setEarly(e.target.checked)} />Early check-in (adds {formatCurrency(earlyFee)} to the folio)</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Collect payment now (optional)" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
          </div>
        </div>
      )}
      {step === 4 && (
        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Guest">{guest.fullName}</Detail>
          <Detail label="Room">{chosen.number} · {categoryById(chosen.categoryId).name}</Detail>
          <Detail label="Stay">{formatDate(reservation.checkIn, false)} → {formatDate(reservation.checkOut, false)}</Detail>
          {canManageFinancials && <Detail label="Early check-in">{early ? `Yes (${formatCurrency(earlyFee)})` : 'No'}</Detail>}
          {canManageFinancials && <Detail label="Payment now">{pay > 0 ? `${formatCurrency(pay)} · ${PAYMENT_METHOD_LABEL[method]}` : 'None'}</Detail>}
          <div className="col-span-2 rounded bg-ivory px-3 py-2 text-body text-slate">Confirming marks room {chosen.number} as occupied and adds the guest to the in-house list.</div>
        </dl>
      )}
    </Dialog>
  );
}

export function CheckInDialog({ reservation, onClose }: { reservation: Reservation | null; onClose: () => void }) {
  return reservation ? <Body key={reservation.id} reservation={reservation} onClose={onClose} /> : null;
}
