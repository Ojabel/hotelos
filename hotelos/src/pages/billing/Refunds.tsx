import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { RefundStatusBadge } from '@/components/ui/StatusBadge';
import { useScopedData } from '@/hooks/useScopedData';
import { advanceRefund, requestRefund } from '@/services/mockPaymentService';
import { toast } from '@/store/useAppStore';
import type { Refund, RefundStatus } from '@/types';
import { maxRefundable } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { REFUND_STATUS_META } from '@/utils/status';
import { backendMode } from '@/services/api/backendMode';
import { useAppStore } from '@/store/useAppStore';
import { backendOperations } from '@/services/backendOperations';

export default function Refunds() {
  const { refunds, payments, reservations, guestById } = useScopedData();
  const hotelId = useAppStore((s) => s.hotelId);
  useEffect(() => { if (backendMode && hotelId !== 'all') void backendOperations.refreshFinancial(hotelId); }, [hotelId]);
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refByRes = useMemo(() => new Map(reservations.map((r) => [r.id, r.reference])), [reservations]);
  const filtered = useMemo(() => refunds.filter((r) => status === 'all' || r.status === status), [refunds, status]);
  const awaiting = refunds.filter((r) => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + r.amount, 0);

  const act = async (r: Refund, to: 'approved' | 'rejected' | 'processed') => {
    setBusy(r.id + to);
    const res = await advanceRefund(r.id, to);
    setBusy(null);
    if (res.ok) toast.success(`Refund ${to === 'processed' && !backendMode ? 'processed (simulated)' : to}`, r.reference); else toast.error('Could not update refund', res.error);
  };

  const actions = (r: Refund) => (
    <div className="flex justify-end gap-1.5">
      {r.status === 'pending' && <><Button size="sm" onClick={() => act(r, 'approved')} loading={busy === r.id + 'approved'}>Approve</Button><Button size="sm" variant="secondary" onClick={() => act(r, 'rejected')} loading={busy === r.id + 'rejected'}>Reject</Button></>}
      {r.status === 'approved' && <Button size="sm" onClick={() => act(r, 'processed')} loading={busy === r.id + 'processed'}>{backendMode ? 'Record payout' : 'Process payout'}</Button>}
    </div>
  );

  const cols: Column<Refund>[] = [
    { key: 'date', header: 'Requested', sortValue: (r) => r.requestedAt, render: (r) => formatDate(r.requestedAt, false) },
    { key: 'ref', header: 'Reference', render: (r) => <span className="font-medium">{r.reference}</span> },
    { key: 'guest', header: 'Guest', render: (r) => guestById.get(r.guestId)?.fullName },
    { key: 'res', header: 'Booking', render: (r) => refByRes.get(r.reservationId) },
    { key: 'reason', header: 'Reason', render: (r) => <span className="text-slate">{r.reason}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (r) => r.amount, render: (r) => formatCurrency(r.amount) },
    { key: 'status', header: 'Status', render: (r) => <RefundStatusBadge status={r.status} /> },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  return (
    <>
      <PageHeader title="Refunds" description={`${formatCurrency(awaiting)} awaiting approval or payout · ${backendMode ? 'manual payout recording' : 'payouts are simulated'}`} actions={<Button onClick={() => setOpen(true)}>New refund request</Button>} />
      <Card>
        <div className="max-w-xs border-b border-line p-4"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...(Object.keys(REFUND_STATUS_META) as RefundStatus[]).map((s) => ({ value: s, label: REFUND_STATUS_META[s].label }))]} /></div>
        <DataTable caption="Refunds" rows={filtered} columns={cols} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} empty={<EmptyState icon={Undo2} title="No refunds" description="Refund requests appear here after cancellations or overpayments." />}
          mobileCard={(r) => (<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{guestById.get(r.guestId)?.fullName}</p><p className="text-meta text-slate">{r.reference} · {formatDate(r.requestedAt, false)}</p></div><RefundStatusBadge status={r.status} /></div><p className="text-body text-slate">{r.reason}</p><p className="font-medium tnum">{formatCurrency(r.amount)}</p>{actions(r)}</div>)} />
      </Card>
      <RefundRequestDialog open={open} onClose={() => setOpen(false)} payments={payments} />
    </>
  );
}

function RefundRequestDialog({ open, onClose, payments }: { open: boolean; onClose: () => void; payments: ReturnType<typeof useScopedData>['payments'] }) {
  const { reservations, refunds, guestById } = useScopedData();
  const candidates = useMemo(() => reservations.map((r) => ({ r, max: maxRefundable(r.id, payments, refunds) })).filter((x) => x.max > 0).slice(0, 80), [reservations, payments, refunds]);
  const [resId, setResId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setResId(candidates[0]?.r.id ?? ''); setReason(''); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = candidates.find((c) => c.r.id === resId);
  useEffect(() => { setAmount(selected ? String(selected.max) : ''); }, [resId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await requestRefund({ reservationId: resId, amount: Number(amount), reason });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Refund requested', r.value.reference);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New refund request" description={backendMode ? 'Requests need approval before the payout is recorded.' : 'Requests need approval before the simulated payout.'}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="refund-form" loading={busy} disabled={!selected}>Submit request</Button></>}>
      <form id="refund-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {candidates.length === 0 ? <p className="text-body text-slate">No bookings have refundable payments.</p> : (
          <Select label="Booking" value={resId} onChange={(e) => setResId(e.target.value)} options={candidates.map(({ r, max }) => ({ value: r.id, label: `${r.reference} · ${guestById.get(r.guestId)?.fullName} · up to ${formatCurrency(max)}` }))} />
        )}
        <Input label="Amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Dialog>
  );
}
