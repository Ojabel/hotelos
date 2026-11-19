import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { hotelName, mockHotels } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { createGuest } from '@/services/mockGuestService';
import { checkAvailability, createReservation } from '@/services/mockReservationService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { calculateConfiguredTotal, useAdminStore } from '@/store/useAdminStore';
import type { PaymentMethod, Reservation, Room } from '@/types';
import { addDays, nightsBetween, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { backendMode, useBackendHotels, useRoomCategories } from '@/services/api/backendMode';

const STEPS = ['Stay details', 'Room', 'Guest', 'Pricing & payment', 'Confirm'];
const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' }, { value: 'pos', label: 'POS' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'online', label: 'Online payment' },
];

export function ReservationWizard({ walkIn = false }: { walkIn?: boolean }) {
  const t = today();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const globalHotel = useAppStore((s) => s.hotelId);
  const backendHotels = useBackendHotels();
  const roomCategories = useRoomCategories();
  const activeRole = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(activeRole && FINANCIAL_ROLES.includes(activeRole));
  const guests = useHotelStore((s) => s.guests);
  const configuration = useAdminStore((s) => s.settings);

  const [step, setStep] = useState(0);
  const [hotelId, setHotelId] = useState(backendMode ? globalHotel : params.get('hotel') ?? (globalHotel === 'all' ? 'h-vi' : globalHotel));
  const [checkIn, setCheckIn] = useState(walkIn ? t : params.get('in') ?? addDays(t, 1));
  const [checkOut, setCheckOut] = useState(params.get('out') ?? addDays(walkIn ? t : params.get('in') ?? addDays(t, 1), 1));
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [categoryId, setCategoryId] = useState(backendMode ? 'any' : params.get('cat') ?? 'any');

  const [available, setAvailable] = useState<Room[] | null>(null);
  const [roomId, setRoomId] = useState('');

  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [guestQuery, setGuestQuery] = useState('');
  const [guestId, setGuestId] = useState('');
  const [newGuest, setNewGuest] = useState({ fullName: '', email: '', phone: '', nationality: '' });

  const [discount, setDiscount] = useState('0');
  const [deposit, setDeposit] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Reservation | null>(null);

  const nights = checkOut > checkIn ? nightsBetween(checkIn, checkOut) : 0;
  const guestsCount = (Number(adults) || 0) + (Number(children) || 0);
  const room = available?.find((r) => r.id === roomId);
  const roomCategory = room ? categoryById(room.categoryId) : undefined;
  const baseRate = room ? configuration.roomCategories.find((c) => c.id === room.categoryId)?.basePrice ?? roomCategory?.basePrice ?? 0 : 0;
  const discountPct = Math.min(configuration.pricing.discountPercent, Math.max(0, Number(discount) || 0));
  const weekendNights = Array.from({ length: nights }, (_, index) => new Date(`${addDays(checkIn, index)}T00:00:00Z`).getUTCDay()).filter((day) => day === 5 || day === 6).length;
  const additionalGuestRate = Math.max(0, guestsCount - 2) * configuration.pricing.additionalGuest;
  const seasonRate = (baseRate + additionalGuestRate) * (1 + configuration.pricing.seasonalPercent / 100);
  const blendedRate = nights ? (seasonRate * (nights - weekendNights) + seasonRate * (1 + configuration.pricing.weekendPercent / 100) * weekendNights) / nights : seasonRate;
  const rate = backendMode ? baseRate : Math.round(blendedRate * (1 - discountPct / 100));
  const total = backendMode ? rate * nights : calculateConfiguredTotal(rate * nights, configuration);
  const depositNum = canManageFinancials ? (deposit === '' ? Math.round(total / 2 / 1000) * 1000 : Number(deposit)) : 0;
  const chosenGuest = guests.find((g) => g.id === guestId);

  // availability is re-checked whenever stay details change and the room step is shown
  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    setAvailable(null);
    setAvailabilityError('');
    checkAvailability({ hotelId, checkIn, checkOut, categoryId: categoryId === 'any' ? undefined : categoryId, guests: guestsCount, readyNow: walkIn }).then((rooms) => {
      if (cancelled) return;
      setAvailable(rooms);
      setRoomId((cur) => (rooms.some((r) => r.id === cur) ? cur : ''));
    }).catch((err: unknown) => {
      if (cancelled) return;
      setAvailable([]);
      setAvailabilityError(err instanceof Error ? err.message : 'Unable to check availability.');
    });
    return () => { cancelled = true; };
  }, [step, hotelId, checkIn, checkOut, categoryId, guestsCount, walkIn]);

  const matches = useMemo(() => {
    const term = guestQuery.trim().toLowerCase();
    return term.length < 2 ? [] : guests.filter((g) => g.fullName.toLowerCase().includes(term) || g.email.includes(term)).slice(0, 6);
  }, [guests, guestQuery]);

  const validateStep = async (): Promise<string> => {
    if (step === 0) {
      if (!checkIn || !checkOut) return 'Choose check-in and check-out dates.';
      if (checkIn < t) return 'Check-in cannot be in the past.';
      if (checkOut <= checkIn) return 'Check-out must be after check-in.';
      if (nights > 60) return 'Stays longer than 60 nights need manager approval.';
      if (!(Number(adults) >= 1)) return 'At least one adult is required.';
      if (Number(children) < 0) return 'Children cannot be negative.';
    }
    if (step === 1 && !roomId) return 'Select a room to continue.';
    if (step === 2) {
      if (guestMode === 'existing') { if (!guestId) return 'Select a guest, or create a new profile.'; }
      else {
        const res = await createGuest(newGuest);
        if (!res.ok) return res.error;
        setGuestId(res.value.id);
        setGuestMode('existing');
        setGuestQuery(res.value.fullName);
      }
    }
    if (step === 3) {
      if (canManageFinancials && (!Number.isFinite(depositNum) || depositNum < 0 || depositNum > total)) return `Deposit must be between ${formatCurrency(0)} and ${formatCurrency(total)}.`;
      if (canManageFinancials && walkIn && depositNum <= 0) return 'Walk-in guests pay a deposit at the desk. Enter an amount.';
    }
    return '';
  };

  const next = async () => {
    setBusy(true);
    const msg = await validateStep();
    setBusy(false);
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    const res = await createReservation({
      hotelId, roomId, guestId, checkIn, checkOut, adults: Number(adults), children: Number(children), nightlyRate: rate, deposit: depositNum, method,
      status: walkIn ? 'checked_in' : depositNum > 0 ? 'confirmed' : 'pending', notes: notes || undefined,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success(walkIn ? 'Walk-in guest checked in' : 'Reservation created', res.value.reference);
    setCreated(res.value);
  };

  if (created) {
    return (
      <Card className="mx-auto max-w-lg">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" aria-hidden /></span>
          <h1 className="mt-4 text-section font-semibold">{walkIn ? 'Guest checked in' : 'Reservation confirmed'}</h1>
          <p className="mt-1 text-body text-slate">Reference <span className="font-medium text-forest">{created.reference}</span></p>
          <p className="mt-2 text-body text-slate">{chosenGuest?.fullName} · Room {room?.number} · {formatDate(created.checkIn, false)} → {formatDate(created.checkOut, false)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate(`/reservations/${created.id}`)}>View reservation</Button>
            <Link to="/reservations"><Button variant="secondary">All reservations</Button></Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title={walkIn ? 'Walk-in booking' : 'New reservation'} description={walkIn ? 'Book and check in a guest at the desk. The room becomes occupied immediately.' : 'Five steps from dates to confirmation.'} />
      <ol className="mb-5 flex gap-2 overflow-x-auto" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-meta font-medium', i === step ? 'border-forest bg-forest text-ivory' : i < step ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-white text-slate')}>
            <span className="tnum">{i < step ? '✓' : i + 1}</span>{i === 3 && !canManageFinancials ? 'Review' : s}
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-6">
        {error && <div role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}

        {step === 0 && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Select label="Property" value={hotelId} onChange={(e) => setHotelId(e.target.value)} disabled={backendMode} options={backendMode ? backendHotels.map((h) => ({ value: h.id, label: h.name })) : mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
            <Select label="Room category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: 'any', label: 'Any category' }, ...roomCategories.map((c) => ({ value: c.id, label: c.name }))]} />
            <Input label="Check-in" type="date" min={t} value={checkIn} disabled={walkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1)); }} />
            <Input label="Check-out" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} hint={nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : undefined} />
            <Input label="Adults" type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} />
            <Input label="Children" type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
          </div>
        )}

        {step === 1 && availabilityError && <p role="alert" className="mb-3 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{availabilityError}</p>}
        {step === 1 && (
          available === null ? (
            <div className="space-y-3" aria-busy="true" aria-label="Checking availability"><p className="text-body text-slate">Checking availability…</p><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : available.length === 0 ? (
            <EmptyState icon={Check} title="No rooms available" description={walkIn ? 'No rooms are ready for immediate check-in. Try another category or check housekeeping.' : 'Nothing is free for these dates and party size. Change the dates or category.'} action={<Button variant="secondary" onClick={() => setStep(0)}>Change stay details</Button>} />
          ) : (
            <fieldset>
              <legend className="mb-3 text-body text-slate">{available.length} room{available.length > 1 ? 's' : ''} available for {nights} night{nights > 1 ? 's' : ''}</legend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {available.map((r) => {
                  const c = categoryById(r.categoryId);
                  return (
                    <label key={r.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-4', roomId === r.id ? 'border-forest bg-champagne/10' : 'border-line hover:bg-ivory/60')}>
                      <input type="radio" name="room" className="mt-1 accent-forest" checked={roomId === r.id} onChange={() => setRoomId(r.id)} />
                      <span><span className="block font-medium">Room {r.number} · Floor {r.floor}</span><span className="block text-meta text-slate">{c.name} · sleeps {c.capacity}</span>{canManageFinancials && <span className="mt-1 block text-body tnum">{formatCurrency(c.basePrice)} <span className="text-meta text-slate">/ night</span></span>}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )
        )}

        {step === 2 && (
          <div className="max-w-2xl space-y-4">
            <div role="group" aria-label="Guest type" className="inline-flex rounded border border-line p-0.5">
              {(['existing', 'new'] as const).map((m) => <button key={m} type="button" aria-pressed={guestMode === m} onClick={() => { setGuestMode(m); setError(''); }} className={cn('h-8 rounded-sm px-3 text-meta font-medium', guestMode === m ? 'bg-forest text-ivory' : 'text-slate')}>{m === 'existing' ? 'Existing guest' : 'New guest'}</button>)}
            </div>
            {guestMode === 'existing' ? (
              <div className="space-y-3">
                <Input label="Search guests" value={guestQuery} onChange={(e) => { setGuestQuery(e.target.value); setGuestId(''); }} placeholder="Name or email" />
                {matches.length > 0 && !guestId && (
                  <ul className="divide-y divide-line rounded border border-line">
                    {matches.map((g) => <li key={g.id}><button type="button" onClick={() => { setGuestId(g.id); setGuestQuery(g.fullName); }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ivory"><span className="text-body font-medium">{g.fullName}</span><span className="text-meta text-slate">{g.email}</span></button></li>)}
                  </ul>
                )}
                {chosenGuest && <p className="rounded bg-success/10 px-3 py-2 text-body text-success">Selected: {chosenGuest.fullName} · {chosenGuest.phone}</p>}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" value={newGuest.fullName} onChange={(e) => setNewGuest({ ...newGuest, fullName: e.target.value })} />
                <Input label="Email" type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
                <Input label="Phone" type="tel" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} />
                <Input label="Nationality" value={newGuest.nationality} onChange={(e) => setNewGuest({ ...newGuest, nationality: e.target.value })} />
              </div>
            )}
            <Textarea label="Special requests / notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        {step === 3 && room && canManageFinancials && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Input label="Discount (%)" type="number" min={0} max={configuration.pricing.discountPercent} value={discount} onChange={(e) => setDiscount(e.target.value)} hint={`Configured limit ${configuration.pricing.discountPercent}%.`} />
            <Input label={`Deposit (${formatCurrency(total)} total)`} type="number" min={0} value={deposit === '' ? String(depositNum) : deposit} onChange={(e) => setDeposit(e.target.value)} />
            <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={METHODS} />
            <dl className="rounded-lg bg-ivory p-4 text-body sm:col-span-2">
              <div className="flex justify-between"><dt className="text-slate">Rate</dt><dd className="tnum">{formatCurrency(rate)} × {nights}</dd></div>
              <div className="mt-1 flex justify-between font-medium"><dt>Total</dt><dd className="tnum">{formatCurrency(total)}</dd></div>
              <div className="mt-1 flex justify-between"><dt className="text-slate">Balance after deposit</dt><dd className="tnum">{formatCurrency(Math.max(0, total - (Number.isFinite(depositNum) ? depositNum : 0)))}</dd></div>
              <p className="mt-2 text-meta text-slate">Payment is simulated; no money is processed.</p>
            </dl>
          </div>
        )}

        {step === 4 && room && (
          <dl className="grid max-w-2xl gap-3 text-body sm:grid-cols-2">
            <div><dt className="text-meta text-slate">Property</dt><dd className="font-medium">{backendMode ? backendHotels.find((h) => h.id === hotelId)?.name : hotelName(hotelId)}</dd></div>
            <div><dt className="text-meta text-slate">Guest</dt><dd className="font-medium">{chosenGuest?.fullName}</dd></div>
            <div><dt className="text-meta text-slate">Stay</dt><dd className="font-medium">{formatDate(checkIn, false)} → {formatDate(checkOut, false)} ({nights} nights)</dd></div>
            <div><dt className="text-meta text-slate">Room</dt><dd className="font-medium">{room.number} · {categoryById(room.categoryId).name}</dd></div>
            <div><dt className="text-meta text-slate">Guests</dt><dd className="font-medium">{adults} adult(s), {children} child(ren)</dd></div>
            {canManageFinancials && <div><dt className="text-meta text-slate">Total / deposit</dt><dd className="font-medium tnum">{formatCurrency(total)} / {formatCurrency(depositNum)}</dd></div>}
            <div className="sm:col-span-2"><dt className="text-meta text-slate">Outcome</dt><dd className="font-medium">{walkIn ? 'Guest is checked in and the room becomes occupied.' : depositNum > 0 ? 'Reservation is confirmed.' : canManageFinancials ? 'Reservation stays pending until a deposit is paid.' : 'Reservation is recorded at the configured rate and remains pending for finance review.'}</dd></div>
          </dl>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <Button variant="secondary" onClick={() => { setError(''); setStep((s) => s - 1); }} disabled={step === 0 || busy}>Back</Button>
          {step < 4 ? <Button onClick={next} loading={busy} disabled={step === 1 && (available === null || available.length === 0)}>Continue</Button> : <Button onClick={submit} loading={busy}>{walkIn ? 'Check in guest' : 'Create reservation'}</Button>}
        </div>
      </Card>
    </>
  );
}
