import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { addCharge } from '@/services/mockPaymentService';
import { toast } from '@/store/useAppStore';
import type { ChargeCategory } from '@/types';
import { CHARGE_LABELS } from '@/utils/folio';
import { backendMode } from '@/services/api/backendMode';

export function AddChargeForm({ reservationId, onDone }: { reservationId: string; onDone?: () => void }) {
  const [category, setCategory] = useState<ChargeCategory>('restaurant');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await addCharge({ reservationId, category, description, amount: Number(amount) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError(''); setDescription(''); setAmount('');
    toast.success('Charge added to folio');
    onDone?.();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as ChargeCategory)} options={(['restaurant', 'laundry', 'room_service', 'other'] as ChargeCategory[]).map((c) => ({ value: c, label: CHARGE_LABELS[c] }))} />
        <Input label="Amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} hint={backendMode ? 'Amount is recorded to the nearest kobo.' : undefined} />
      </div>
      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Minibar" />
      <Button type="submit" variant="secondary" loading={busy}>Add charge</Button>
    </form>
  );
}

export function AddChargeDialog({ reservationId, onClose }: { reservationId: string | null; onClose: () => void }) {
  const [key, setKey] = useState(0);
  useEffect(() => { if (reservationId) setKey((k) => k + 1); }, [reservationId]);
  return (
    <Dialog open={Boolean(reservationId)} onClose={onClose} size="sm" title="Add charge to folio">
      {reservationId && <AddChargeForm key={key} reservationId={reservationId} onDone={onClose} />}
    </Dialog>
  );
}
