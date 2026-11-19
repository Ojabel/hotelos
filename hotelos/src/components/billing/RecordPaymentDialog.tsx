import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { recordPayment } from '@/services/mockPaymentService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { Payment, PaymentMethod } from '@/types';
import { computeFolio } from '@/utils/folio';
import { formatCurrency } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { backendMode } from '@/services/api/backendMode';

type Outcome = 'success' | 'pending' | 'failed';

/** Records a simulated payment. If no reservationId is given the user picks a booking with a balance. */
export function RecordPaymentDialog({ open, reservationId, onClose, onRecorded }: { open: boolean; reservationId?: string; onClose: () => void; onRecorded?: (p: Payment) => void }) {
  const { reservations, guests, charges, payments, refunds } = useHotelStore();
  const [resId, setResId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [outcome, setOutcome] = useState<Outcome>('success');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => reservations
    .filter((r) => ['pending', 'confirmed', 'checked_in'].includes(r.status))
    .map((r) => ({ r, f: computeFolio(r, charges, payments, refunds) }))
    .filter((x) => x.f.balance > 0), [reservations, charges, payments, refunds]);

  useEffect(() => {
    if (!open) return;
    setError(''); setOutcome('success'); setMethod('cash');
    const initial = reservationId ?? candidates.find((c) => c.r.status === 'checked_in')?.r.id ?? candidates[0]?.r.id ?? '';
    setResId(initial);
  }, [open, reservationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = reservations.find((r) => r.id === resId);
  const folio = selected ? computeFolio(selected, charges, payments, refunds) : null;
  useEffect(() => { if (folio) setAmount(String(Math.max(0, folio.balance))); }, [resId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guestName = (id: string) => guests.find((g) => g.id === id)?.fullName ?? id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return setError('Choose a booking.');
    setBusy(true);
    const r = await recordPayment({ reservationId: selected.id, amount: Number(amount), method, outcome });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.value.status === 'failed') toast.error('Payment failed (simulated)', 'No money was collected.');
    else if (r.value.status === 'pending') toast.info('Transfer recorded as pending', 'Confirm it once the funds arrive.');
    else toast.success('Payment recorded', formatCurrency(r.value.amount));
    onRecorded?.(r.value);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Record payment" description={backendMode ? 'Record a manual payment. No payment gateway is connected.' : 'Simulated — no real transaction is processed.'}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="pay-form" loading={busy} disabled={!selected}>Record payment</Button></>}>
      <form id="pay-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {reservationId ? (
          <p className="text-body"><span className="font-medium">{selected?.reference}</span> · {selected && guestName(selected.guestId)}</p>
        ) : candidates.length === 0 ? (
          <p className="text-body text-slate">No bookings have an outstanding balance.</p>
        ) : (
          <Select label="Booking" value={resId} onChange={(e) => setResId(e.target.value)} options={candidates.slice(0, 80).map(({ r, f }) => ({ value: r.id, label: `${r.reference} · ${guestName(r.guestId)} · ${formatCurrency(f.balance)} due` }))} />
        )}
        {folio && <p className="rounded bg-ivory px-3 py-2 text-body">Outstanding balance <span className="font-semibold tnum">{formatCurrency(Math.max(0, folio.balance))}</span></p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} hint="Less than the balance records a partial payment" />
          <Select label="Method" value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod); setOutcome('success'); }} options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
        </div>
        {!backendMode && (method === 'bank_transfer' || method === 'online' || method === 'pos') && (
          <Select label="Simulated result" value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)} options={[
            { value: 'success', label: 'Successful' },
            ...(method === 'bank_transfer' ? [{ value: 'pending', label: 'Pending confirmation' }] : []),
            { value: 'failed', label: 'Failed' },
          ]} />
        )}
      </form>
    </Dialog>
  );
}
