import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { createGuest, updateGuest } from '@/services/mockGuestService';
import { toast } from '@/store/useAppStore';
import type { Guest } from '@/types';
import { backendMode } from '@/services/api/backendMode';

const ID_TYPES: Guest['idType'][] = ['Passport', 'National ID', "Driver's licence"];

export function GuestFormDialog({ open, guest, onClose, onSaved }: { open: boolean; guest?: Guest; onClose: () => void; onSaved?: (g: Guest) => void }) {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', nationality: '', idType: 'National ID' as Guest['idType'], idNumber: '', preferences: '', vip: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setF({ fullName: guest?.fullName ?? '', email: guest?.email ?? '', phone: guest?.phone ?? '', nationality: guest?.nationality ?? '', idType: guest?.idType ?? 'National ID', idNumber: guest?.idNumber ?? '', preferences: guest?.preferences.join(', ') ?? '', vip: guest?.vip ?? false });
  }, [open, guest]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const extras = { idType: f.idType, idNumber: f.idNumber.trim() || '—', preferences: f.preferences.split(',').map((p) => p.trim()).filter(Boolean), vip: f.vip };
    let res = guest ? await updateGuest(guest.id, { fullName: f.fullName, email: f.email, phone: f.phone, nationality: f.nationality, ...extras }) : await createGuest({ fullName: f.fullName, email: f.email, phone: f.phone, nationality: f.nationality });
    if (!guest && res.ok && !backendMode) res = await updateGuest(res.value.id, { fullName: f.fullName, email: f.email, phone: f.phone, nationality: f.nationality, ...extras });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(guest ? 'Guest updated' : 'Guest added', res.value.fullName);
    onSaved?.(res.value);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={guest ? 'Edit guest' : 'Add guest'}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="guest-form" loading={busy}>{guest ? 'Save changes' : 'Add guest'}</Button></>}>
      <form id="guest-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Input label="Full name" value={f.fullName} onChange={set('fullName')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={f.email} onChange={set('email')} />
          <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
          <Input label="Nationality" value={f.nationality} onChange={set('nationality')} />
          {!backendMode && <><Select label="ID type" value={f.idType} onChange={set('idType')} options={ID_TYPES.map((t) => ({ value: t, label: t }))} />
          <Input label="ID number" value={f.idNumber} onChange={set('idNumber')} hint="Store only the last digits" /></>}
        </div>
        {!backendMode && <><Input label="Preferences" value={f.preferences} onChange={set('preferences')} hint="Comma separated, e.g. High floor, Quiet room" />
        <label className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={f.vip} onChange={(e) => setF({ ...f, vip: e.target.checked })} />VIP guest</label></>}
        {backendMode && <p className="text-meta text-slate">Local backend guest records currently store contact details and notes only.</p>}
      </form>
    </Dialog>
  );
}
