import { useMemo, useState } from 'react';
import { FolderOpen, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { PaymentStatusBadge, ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { FolioDrawer } from '@/components/billing/FolioDrawer';
import { useFolioRows, type FolioRow } from '@/hooks/useFolioRows';
import { useScopedData } from '@/hooks/useScopedData';
import { formatCurrency, formatDate } from '@/utils/format';
import { PAYMENT_STATUS_META } from '@/utils/status';
import type { PaymentStatus } from '@/types';

export default function Folios() {
  const rows = useFolioRows();
  const { guestById, roomById } = useScopedData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [stay, setStay] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter(({ r, folio }) => {
    if (status !== 'all' && folio.status !== status) return false;
    if (stay !== 'all' && r.status !== stay) return false;
    const term = q.trim().toLowerCase();
    return !term || `${r.reference} ${guestById.get(r.guestId)?.fullName ?? ''} ${roomById.get(r.roomId)?.number ?? ''}`.toLowerCase().includes(term);
  }), [rows, q, status, stay, guestById, roomById]);
  const clear = () => { setQ(''); setStatus('all'); setStay('all'); };

  const cols: Column<FolioRow>[] = [
    { key: 'ref', header: 'Booking', sortValue: (x) => x.r.reference, render: (x) => <span className="font-medium">{x.r.reference}</span> },
    { key: 'guest', header: 'Guest', sortValue: (x) => guestById.get(x.r.guestId)?.fullName ?? '', render: (x) => guestById.get(x.r.guestId)?.fullName },
    { key: 'room', header: 'Room', render: (x) => roomById.get(x.r.roomId)?.number },
    { key: 'stay', header: 'Stay', sortValue: (x) => x.r.checkIn, render: (x) => `${formatDate(x.r.checkIn, false)} → ${formatDate(x.r.checkOut, false)}` },
    { key: 'total', header: 'Charges', align: 'right', sortValue: (x) => x.folio.total, render: (x) => formatCurrency(x.folio.total) },
    { key: 'paid', header: 'Paid', align: 'right', render: (x) => formatCurrency(x.folio.netPaid) },
    { key: 'bal', header: 'Balance', align: 'right', sortValue: (x) => x.folio.balance, render: (x) => formatCurrency(Math.max(0, x.folio.balance)) },
    { key: 'status', header: 'Payment', render: (x) => <PaymentStatusBadge status={x.folio.status} /> },
  ];

  return (
    <>
      <PageHeader title="Guest folios" description={`${filtered.length} of ${rows.length} folios`} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5"><label htmlFor="f-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, booking or room" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Payment status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All' }, ...(Object.keys(PAYMENT_STATUS_META) as PaymentStatus[]).filter((s) => s !== 'failed').map((s) => ({ value: s, label: PAYMENT_STATUS_META[s].label }))]} />
          <Select label="Stay" value={stay} onChange={(e) => setStay(e.target.value)} options={[{ value: 'all', label: 'All stays' }, { value: 'checked_in', label: 'In-house' }, { value: 'checked_out', label: 'Checked out' }]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Guest folios" rows={filtered} columns={cols} rowKey={(x) => x.r.id} pageSize={10} initialSort={{ key: 'bal', dir: 'desc' }} onRowClick={(x) => setOpen(x.r.id)}
          empty={<EmptyState icon={FolderOpen} title="No folios match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(x) => (
            <button type="button" onClick={() => setOpen(x.r.id)} className="block w-full p-4 text-left">
              <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{guestById.get(x.r.guestId)?.fullName}</p><p className="text-meta text-slate">{x.r.reference} · Room {roomById.get(x.r.roomId)?.number}</p></div><ReservationStatusBadge status={x.r.status} /></div>
              <p className="mt-2 flex items-center justify-between text-body tnum"><span>Balance {formatCurrency(Math.max(0, x.folio.balance))}</span><PaymentStatusBadge status={x.folio.status} /></p>
            </button>
          )} />
      </Card>
      <FolioDrawer reservationId={open} onClose={() => setOpen(null)} />
    </>
  );
}
