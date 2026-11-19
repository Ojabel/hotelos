import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { hotelName, mockHotels } from '@/data/mockHotels';
import { categoryById } from '@/data/roomCatalog';
import { useHotelStore } from '@/store/useHotelStore';
import type { Payment, Reservation } from '@/types';
import { nightsBetween, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { CHARGE_LABELS, computeFolio, invoiceNumber, receiptNumber, type Folio } from '@/utils/folio';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from '@/utils/status';
import { backendMode, useBackendHotels } from '@/services/api/backendMode';
import { hotelOperationsApi, type FinancialInvoiceRecord } from '@/services/api/hotelOperations';
import { useEffect, useState } from 'react';

function Letterhead({ hotelId, title, number, date }: { hotelId: string; title: string; number: string; date: string }) {
  const backendHotels = useBackendHotels();
  const hotel = backendMode ? backendHotels.find((h) => h.id === hotelId) ?? { name: 'HotelOS Property', address: '', phone: '', email: '' } : mockHotels.find((h) => h.id === hotelId)!;
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-forest pb-4">
      <div>
        <p className="font-heading text-xl font-semibold">{hotel.name}</p>
        <p className="text-meta text-slate">{hotel.address}</p>
        <p className="text-meta text-slate">{hotel.phone} · {hotel.email}</p>
      </div>
      <div className="text-right">
        <p className="font-heading text-xl font-semibold uppercase tracking-wide text-forest">{title}</p>
        <p className="text-meta tnum">{number}</p>
        <p className="text-meta text-slate">{formatDate(date, false)}</p>
      </div>
    </header>
  );
}

export function InvoiceDocument({ reservation, folio, issued, number }: { reservation: Reservation; folio: Folio; issued: string; number?: string }) {
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === reservation.guestId));
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === reservation.roomId));
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const extras = folio.lines.filter((l) => l.kind === 'charge' && l.category !== 'room');
  const payments = folio.lines.filter((l) => l.kind === 'payment');
  const refunds = folio.lines.filter((l) => l.kind === 'refund');
  const status = PAYMENT_STATUS_META[folio.status].label;
  return (
    <article className="print-area space-y-5 rounded border border-line bg-white p-6 text-body">
      <Letterhead hotelId={reservation.hotelId} title="Invoice" number={number ?? invoiceNumber(reservation, issued)} date={issued} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-meta uppercase tracking-wide text-slate">Billed to</p><p className="font-medium">{guest?.fullName}</p><p className="text-slate">{guest?.email}</p><p className="text-slate">{guest?.phone}</p></div>
        <div><p className="text-meta uppercase tracking-wide text-slate">Stay</p><p className="font-medium">{reservation.reference}</p><p className="text-slate">Room {room?.number} · {categoryById(reservation.categoryId).name}</p><p className="text-slate">{formatDate(reservation.checkIn, false)} → {formatDate(reservation.checkOut, false)} ({nights} nights)</p></div>
      </div>
      <table className="w-full text-left">
        <thead className="border-b border-line text-meta uppercase tracking-wide text-slate"><tr><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
        <tbody className="divide-y divide-line">
          <tr><td className="py-2">Room charges — {nights} night{nights === 1 ? '' : 's'} × {formatCurrency(reservation.nightlyRate)}</td><td className="py-2 text-right tnum">{formatCurrency(folio.roomTotal)}</td></tr>
          {extras.map((l) => <tr key={l.id}><td className="py-2">{l.description} <span className="text-meta text-slate">({CHARGE_LABELS[l.category!]}, {formatDate(l.date, false)})</span></td><td className="py-2 text-right tnum">{formatCurrency(l.debit)}</td></tr>)}
        </tbody>
        <tfoot className="border-t-2 border-forest">
          <tr><td className="py-2 font-medium">Total charges</td><td className="py-2 text-right font-medium tnum">{formatCurrency(folio.total)}</td></tr>
          {payments.map((l) => <tr key={l.id} className="text-slate"><td className="py-1">{l.description} · {formatDate(l.date, false)}</td><td className="py-1 text-right tnum">−{formatCurrency(l.credit)}</td></tr>)}
          {refunds.map((l) => <tr key={l.id} className="text-slate"><td className="py-1">{l.description}</td><td className="py-1 text-right tnum">+{formatCurrency(l.debit)}</td></tr>)}
          <tr className="border-t border-line"><td className="py-2 font-semibold">Balance due</td><td className="py-2 text-right font-semibold tnum">{formatCurrency(Math.max(0, folio.balance))}</td></tr>
        </tfoot>
      </table>
      <p className="text-meta text-slate">Payment status: <span className="font-medium text-forest">{status}</span>. Thank you for staying with us.{!backendMode && ' Demonstration document — no real transaction.'}</p>
    </article>
  );
}

export function ReceiptDocument({ payment }: { payment: Payment }) {
  const res = useHotelStore((s) => s.reservations.find((r) => r.id === payment.reservationId));
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === payment.guestId));
  const charges = useHotelStore((s) => s.charges);
  const payments = useHotelStore((s) => s.payments);
  const refunds = useHotelStore((s) => s.refunds);
  const folio = res ? computeFolio(res, charges, payments, refunds) : null;
  return (
    <article className="print-area space-y-5 rounded border border-line bg-white p-6 text-body">
      <Letterhead hotelId={payment.hotelId} title="Receipt" number={payment.receiptReference ?? receiptNumber(payment)} date={payment.date} />
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-meta uppercase tracking-wide text-slate">Received from</dt><dd className="font-medium">{guest?.fullName}</dd></div>
        <div><dt className="text-meta uppercase tracking-wide text-slate">Booking</dt><dd className="font-medium">{res?.reference}</dd></div>
        <div><dt className="text-meta uppercase tracking-wide text-slate">Method</dt><dd className="font-medium">{PAYMENT_METHOD_LABEL[payment.method]}</dd></div>
        <div><dt className="text-meta uppercase tracking-wide text-slate">Status</dt><dd className="font-medium">{PAYMENT_STATUS_META[payment.status].label}</dd></div>
      </dl>
      <div className="rounded bg-ivory p-4 text-center"><p className="text-meta uppercase tracking-wide text-slate">Amount</p><p className="font-heading text-[28px] font-semibold tnum">{formatCurrency(payment.amount, payment.currency ?? undefined)}</p></div>
      {folio && <p className="text-meta text-slate">Folio balance after this payment: <span className="font-medium text-forest tnum">{formatCurrency(Math.max(0, folio.balance))}</span> · {hotelName(payment.hotelId)}{!backendMode && '. Demonstration document — no real transaction.'}</p>}
    </article>
  );
}

export function DocumentDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print</Button></>}>
      {children}
    </Dialog>
  );
}

/** Opens the live invoice for a booking. */
export function InvoiceDialog({ reservation, invoiceId, onClose }: { reservation: Reservation | null; invoiceId?: string; onClose: () => void }) {
  const charges = useHotelStore((s) => s.charges);
  const payments = useHotelStore((s) => s.payments);
  const refunds = useHotelStore((s) => s.refunds);
  const current = useHotelStore((s) => s.reservations.find((r) => r.id === reservation?.id));
  const res = current ?? reservation;
  const reservationId = res?.id;
  const hotelId = res?.hotelId;
  const [savedInvoice, setSavedInvoice] = useState<FinancialInvoiceRecord | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!backendMode || !reservationId || !hotelId) { setSavedInvoice(null); return; }
      setError('');
      try {
        if (invoiceId) {
          const invoice = await hotelOperationsApi.getInvoice(hotelId, invoiceId);
          if (active) setSavedInvoice(invoice);
          return;
        }
        const folios = await hotelOperationsApi.listFolios(hotelId);
        const folio = folios.find((row) => row.reservationId === reservationId);
        if (!folio?.invoices[0]) { setSavedInvoice(null); return; }
        const invoice = await hotelOperationsApi.getInvoice(hotelId, folio.invoices[0].id);
        if (active) setSavedInvoice(invoice);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load invoice.'); }
    };
    void load(); return () => { active = false; };
  }, [reservationId, hotelId, invoiceId]);
  return (
    <DocumentDialog open={Boolean(res)} title="Invoice preview" onClose={onClose}>
      {error && <p role="alert" className="text-meta text-danger">{error}</p>}
      {res && backendMode && !savedInvoice && !error && <p className="text-body text-slate">No issued invoice is available yet. Issue it from the guest folio.</p>}
      {res && backendMode && savedInvoice && <div className="divide-y divide-line rounded border border-line bg-white px-4"><p className="py-3 font-medium">{savedInvoice.folio?.guest.fullName} · {savedInvoice.folio?.reservation.reference}</p>{savedInvoice.lines?.map((line) => <div key={line.id} className="flex justify-between gap-3 py-2"><span>{line.description} · {formatDate(line.serviceDate.slice(0, 10), false)}</span><span className="tnum">{formatCurrency(line.amountMinor / 100, line.currency)}</span></div>)}<div className="flex justify-between border-t-2 border-forest py-3 font-semibold"><span>Invoice total</span><span className="tnum">{formatCurrency(savedInvoice.totalMinor / 100, savedInvoice.currency)}</span></div></div>}
      {res && backendMode && savedInvoice && <p className="mb-3 text-meta text-slate">Persisted invoice {savedInvoice.reference} · {savedInvoice.status.toLowerCase()} · {savedInvoice.currency} {formatCurrency(savedInvoice.totalMinor / 100, savedInvoice.currency)}</p>}
      {res && !backendMode && <InvoiceDocument reservation={res} folio={computeFolio(res, charges, payments, refunds)} issued={res.status === 'checked_out' ? res.checkOut : today()} />}
    </DocumentDialog>
  );
}

export function ReceiptDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  return <DocumentDialog open={Boolean(payment)} title="Receipt preview" onClose={onClose}>{payment && <ReceiptDocument payment={payment} />}</DocumentDialog>;
}
