import { useEffect, useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { PaymentStatusBadge } from '@/components/ui/StatusBadge';
import { InvoiceDialog } from '@/components/billing/Documents';
import { useFolioRows, type FolioRow } from '@/hooks/useFolioRows';
import { useScopedData } from '@/hooks/useScopedData';
import type { Reservation } from '@/types';
import { today } from '@/utils/demoClock';
import { invoiceNumber } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { backendMode } from '@/services/api/backendMode';
import { hotelOperationsApi, type FinancialInvoiceRecord } from '@/services/api/hotelOperations';
import { useAppStore } from '@/store/useAppStore';

type InvoiceRow = FolioRow & { invoice?: FinancialInvoiceRecord };

export default function Invoices() {
  const rows = useFolioRows();
  const hotelId = useAppStore((s) => s.hotelId);
  const [savedInvoices, setSavedInvoices] = useState<FinancialInvoiceRecord[]>([]);
  const { guestById } = useScopedData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [preview, setPreview] = useState<Reservation | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string>();

  useEffect(() => {
    if (backendMode && hotelId !== 'all') void hotelOperationsApi.listInvoices(hotelId).then((invoices) => setSavedInvoices(invoices.filter((invoice) => invoice.status !== 'CANCELLED'))).catch(() => setSavedInvoices([]));
  }, [hotelId]);

  const issued = (reservation: Reservation) => (reservation.status === 'checked_out' ? reservation.checkOut : today());
  const invoiceRows = useMemo<InvoiceRow[]>(() => backendMode
    ? savedInvoices.flatMap((invoice) => { const row = rows.find((item) => item.r.id === invoice.folio?.reservationId); return row ? [{ ...row, invoice }] : []; })
    : rows.map((row) => ({ ...row, invoice: undefined })), [rows, savedInvoices]);
  const filtered = useMemo(() => invoiceRows.filter(({ r, folio, invoice }) => {
    const invoiceStatus = invoice?.status === 'PAID' ? 'paid' : invoice?.status === 'PARTIALLY_PAID' ? 'partially_paid' : invoice ? 'pending' : folio.status;
    if (status !== 'all' && invoiceStatus !== status) return false;
    const term = q.trim().toLowerCase();
    return !term || `${invoice?.reference ?? invoiceNumber(r, issued(r))} ${r.reference} ${guestById.get(r.guestId)?.fullName ?? ''}`.toLowerCase().includes(term);
  }), [invoiceRows, q, status, guestById]);

  const openInvoice = (row: InvoiceRow) => { setPreview(row.r); setPreviewInvoiceId(row.invoice?.id); };
  const cols: Column<InvoiceRow>[] = [
    { key: 'no', header: 'Invoice', sortValue: (row) => row.invoice?.reference ?? invoiceNumber(row.r, issued(row.r)), render: (row) => <span className="font-medium">{row.invoice?.reference ?? invoiceNumber(row.r, issued(row.r))}</span> },
    { key: 'guest', header: 'Guest', sortValue: (row) => guestById.get(row.r.guestId)?.fullName ?? '', render: (row) => guestById.get(row.r.guestId)?.fullName },
    { key: 'ref', header: 'Booking', render: (row) => row.r.reference },
    { key: 'date', header: 'Issued', sortValue: (row) => row.invoice?.issuedAt ?? issued(row.r), render: (row) => formatDate((row.invoice?.issuedAt ?? issued(row.r)).slice(0, 10), false) },
    { key: 'kind', header: 'Type', render: (row) => row.r.status === 'checked_out' ? 'Final' : 'Running' },
    { key: 'total', header: 'Total', align: 'right', sortValue: (row) => row.invoice ? row.invoice.totalMinor / 100 : row.folio.total, render: (row) => formatCurrency(row.invoice ? row.invoice.totalMinor / 100 : row.folio.total) },
    { key: 'bal', header: 'Balance', align: 'right', render: (row) => formatCurrency(Math.max(0, row.folio.balance)) },
    { key: 'status', header: 'Status', render: (row) => <PaymentStatusBadge status={row.invoice?.status === 'PAID' ? 'paid' : row.invoice?.status === 'PARTIALLY_PAID' ? 'partially_paid' : row.invoice ? 'pending' : row.folio.status} /> },
    { key: 'a', header: '', align: 'right', render: (row) => <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); openInvoice(row); }}>Preview</Button> },
  ];

  return (
    <>
      <PageHeader title="Invoices" description={backendMode ? 'Persisted invoice snapshots for the selected property.' : 'Final invoices are issued at check-out; in-house guests have running invoices.'} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1.5fr_1fr]">
          <div className="space-y-1.5"><label htmlFor="i-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="i-q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Invoice number, booking or guest" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'partially_paid', label: 'Partially paid' }, { value: 'pending', label: 'Pending' }]} />
        </div>
        <DataTable caption="Invoices" rows={filtered} columns={cols} rowKey={(row) => row.invoice?.id ?? row.r.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} onRowClick={openInvoice} empty={<EmptyState icon={FileText} title="No invoices match" />}
          mobileCard={(row) => <button type="button" onClick={() => openInvoice(row)} className="block w-full p-4 text-left"><div className="flex items-center justify-between gap-2"><p className="font-medium">{row.invoice?.reference ?? invoiceNumber(row.r, issued(row.r))}</p><PaymentStatusBadge status={row.invoice?.status === 'PAID' ? 'paid' : row.invoice?.status === 'PARTIALLY_PAID' ? 'partially_paid' : row.invoice ? 'pending' : row.folio.status} /></div><p className="text-meta text-slate">{guestById.get(row.r.guestId)?.fullName} · {formatCurrency(row.invoice ? row.invoice.totalMinor / 100 : row.folio.total)}</p></button>} />
      </Card>
      <InvoiceDialog reservation={preview} invoiceId={previewInvoiceId} onClose={() => { setPreview(null); setPreviewInvoiceId(undefined); }} />
    </>
  );
}
