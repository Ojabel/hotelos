import { useMemo, useState } from 'react';
import { CreditCard, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PaymentStatusBadge } from '@/components/ui/StatusBadge';
import { ReceiptDialog } from '@/components/billing/Documents';
import { RecordPaymentDialog } from '@/components/billing/RecordPaymentDialog';
import { useScopedData } from '@/hooks/useScopedData';
import { confirmPendingPayment } from '@/services/mockPaymentService';
import { toast, useAppStore } from '@/store/useAppStore';
import type { Payment, PaymentMethod, PaymentStatus } from '@/types';
import { receiptNumber } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from '@/utils/status';
import { backendMode } from '@/services/api/backendMode';
import { useEffect } from 'react';
import { backendOperations } from '@/services/backendOperations';

export default function Payments() {
  const { payments, guestById, reservations } = useScopedData();
  const hotelId = useAppStore((s) => s.hotelId);
  useEffect(() => { if (backendMode && hotelId !== 'all') void backendOperations.refreshFinancial(hotelId); }, [hotelId]);
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recording, setRecording] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refByRes = useMemo(() => new Map(reservations.map((r) => [r.id, r.reference])), [reservations]);
  const rangeError = from && to && to < from ? 'End date must be on or after the start date.' : '';
  const filtered = useMemo(() => payments.filter((p) => {
    if (method !== 'all' && p.method !== method) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (!rangeError && from && p.date < from) return false;
    if (!rangeError && to && p.date > to) return false;
    const term = q.trim().toLowerCase();
    return !term || `${p.reference} ${guestById.get(p.guestId)?.fullName ?? ''} ${refByRes.get(p.reservationId) ?? ''}`.toLowerCase().includes(term);
  }), [payments, method, status, from, to, rangeError, q, guestById, refByRes]);

  const collected = filtered.filter((p) => p.status === 'paid' || p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const clear = () => { setQ(''); setMethod('all'); setStatus('all'); setFrom(''); setTo(''); };

  const confirm = async (p: Payment) => {
    setBusy(p.id);
    const r = await confirmPendingPayment(p.id);
    setBusy(null);
    if (r.ok) toast.success('Transfer confirmed', p.reference); else toast.error('Could not confirm transfer', r.error);
  };

  const cols: Column<Payment>[] = [
    { key: 'date', header: 'Date', sortValue: (p) => p.date, render: (p) => formatDate(p.date, false) },
    { key: 'ref', header: 'Reference', sortValue: (p) => p.reference, render: (p) => <span className="font-medium">{p.reference}</span> },
    { key: 'guest', header: 'Guest', sortValue: (p) => guestById.get(p.guestId)?.fullName ?? '', render: (p) => guestById.get(p.guestId)?.fullName },
    { key: 'res', header: 'Booking', render: (p) => refByRes.get(p.reservationId) },
    { key: 'method', header: 'Method', render: (p) => PAYMENT_METHOD_LABEL[p.method] },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (p) => p.amount, render: (p) => formatCurrency(p.amount) },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
    { key: 'a', header: '', align: 'right', render: (p) => (
      <div className="flex justify-end gap-1.5">
        {p.status === 'pending' && <Button size="sm" onClick={() => confirm(p)} loading={busy === p.id}>Confirm</Button>}
        {(p.status === 'paid' || p.status === 'refunded') && <Button size="sm" variant="secondary" onClick={() => setReceipt(p)}>Receipt</Button>}
      </div>) },
  ];

  return (
    <>
      <PageHeader title="Payments" description={`${filtered.length} records · ${formatCurrency(collected)} collected in view`} actions={<Button onClick={() => setRecording(true)}>Record payment</Button>} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-start">
          <div className="space-y-1.5"><label htmlFor="p-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="p-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference or guest" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: 'all', label: 'All methods' }, ...(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))]} />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...(Object.keys(PAYMENT_STATUS_META) as PaymentStatus[]).filter((s) => s !== 'partially_paid').map((s) => ({ value: s, label: PAYMENT_STATUS_META[s].label }))]} />
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={rangeError || undefined} />
          <Button variant="ghost" className="lg:mt-[22px]" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Payments" rows={filtered} columns={cols} rowKey={(p) => p.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} empty={<EmptyState icon={CreditCard} title="No payments match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(p) => (
            <div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{guestById.get(p.guestId)?.fullName}</p><p className="text-meta text-slate">{p.reference} · {PAYMENT_METHOD_LABEL[p.method]} · {formatDate(p.date, false)}</p></div><PaymentStatusBadge status={p.status} /></div><p className="font-medium tnum">{formatCurrency(p.amount)}</p>
              <div className="flex gap-2">{p.status === 'pending' && <Button size="sm" onClick={() => confirm(p)} loading={busy === p.id}>Confirm</Button>}{(p.status === 'paid' || p.status === 'refunded') && <Button size="sm" variant="secondary" onClick={() => setReceipt(p)}>Receipt {(p.receiptReference ?? receiptNumber(p)).slice(-4)}</Button>}</div></div>
          )} />
      </Card>
      <RecordPaymentDialog open={recording} onClose={() => setRecording(false)} onRecorded={(p) => { if (p.status === 'paid') setReceipt(p); }} />
      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
