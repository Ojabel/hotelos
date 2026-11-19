import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AddChargeForm } from '@/components/billing/AddChargeDialog';
import { FolioTable } from '@/components/billing/FolioTable';
import { InvoiceDialog, InvoiceDocument, ReceiptDialog } from '@/components/billing/Documents';
import { checkOut, projectedCheckoutReservation } from '@/services/mockFrontDeskService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { Payment, PaymentMethod, Reservation } from '@/types';
import { today } from '@/utils/demoClock';
import { computeFolio, invoiceNumber } from '@/utils/folio';
import { formatCurrency } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { checkOut as performCheckOut } from '@/services/mockFrontDeskService';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from '@/services/backendOperations';

const STEPS = ['Folio', 'Charges', 'Payment', 'Invoice', 'Complete'];

function Body({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const { guests, charges, payments, refunds, rooms } = useHotelStore();
  const live = useHotelStore((s) => s.reservations.find((r) => r.id === reservation.id)) ?? reservation;
  const guest = guests.find((g) => g.id === live.guestId)!;
  const room = rooms.find((r) => r.id === live.roomId);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('pos');
  const [amountText, setAmountText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ invoice: string; shortened: boolean } | null>(null);
  const [viewInvoice, setViewInvoice] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const projected = live.status === 'checked_in' ? projectedCheckoutReservation(live) : live;
  const shortened = live.status === 'checked_in' && projected.checkOut !== live.checkOut;
  const folio = computeFolio(projected, charges, payments, refunds);
  const due = Math.max(0, folio.balance);
  const amount = amountText === null ? due : Number(amountText) || 0;

  // invoice preview includes the payment that will be recorded on completion
  const virtual: Payment = { id: 'preview', reference: 'PAY-PREVIEW', reservationId: live.id, guestId: live.guestId, hotelId: live.hotelId, amount, method, status: 'paid', date: today() };
  const previewFolio = computeFolio(projected, charges, amount > 0 ? [...payments, virtual] : payments, refunds);

  const next = () => {
    setError('');
    if (step === 2 && amount !== due) return setError(due > 0 ? `The full balance of ${formatCurrency(due)} must be paid before check-out.` : 'No payment is due.');
    setStep((s) => s + 1);
  };

  const complete = async () => {
    setBusy(true);
    let invoiceReference = invoiceNumber(projected, today());
    if (backendMode) {
      const issued = await backendOperations.issueFinancialInvoice(live.id);
      if (!issued.ok) { setBusy(false); return setError(issued.error); }
      invoiceReference = issued.value.reference;
      if (amount > 0) {
        const payment = await backendOperations.recordFinancialPayment({ reservationId: live.id, amount, method });
        if (!payment.ok) { setBusy(false); return setError(payment.error); }
      }
      const saved = await backendOperations.changeReservationStatus(live.hotelId, live.id, 'CHECKED_OUT');
      setBusy(false);
      if (!saved.ok) return setError(saved.error);
      toast.success(`${guest.fullName} checked out`, `Room ${room?.number} marked dirty`);
      setDone({ invoice: invoiceReference, shortened });
      setStep(4);
      return;
    }
    const r = await checkOut({ reservationId: live.id, payment: amount > 0 ? { amount, method } : undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${guest.fullName} checked out`, `Room ${room?.number} marked dirty`);
    setDone({ invoice: r.value.invoiceNumber, shortened: r.value.shortened });
    setStep(4);
  };

  const lastPayment = payments.find((p) => p.reservationId === live.id && p.status === 'paid');

  return (
    <>
      <Dialog open={!viewInvoice && !receipt} onClose={onClose} size="lg" title="Check out guest" description={`${guest.fullName} · Room ${room?.number} · ${live.reference}`}
        footer={done ? <Button onClick={onClose}>Done</Button> : <>
          <Button variant="secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={busy}>{step === 0 ? 'Cancel' : 'Back'}</Button>
          {step < 3 ? <Button onClick={next}>Continue</Button> : <Button onClick={complete} loading={busy}>Complete check-out</Button>}
        </>}>
        <ol className="mb-4 flex gap-1.5 overflow-x-auto text-meta" aria-label="Check-out steps">
          {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${i === step ? 'bg-forest text-ivory' : i < step ? 'bg-success/10 text-success' : 'bg-ivory text-slate'}`}>{i + 1}. {s}</li>)}
        </ol>
        {error && <div role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {shortened && step < 4 && <p className="mb-4 rounded bg-warning/10 px-3 py-2 text-body text-warning">Early departure: the stay is shortened to end today and the folio is recalculated. Any overpayment becomes a refund request.</p>}

        {step === 0 && <FolioTable folio={folio} />}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-body text-slate">Post any last-minute charges (minibar, laundry, damages) before the bill is finalised.</p>
            <AddChargeForm reservationId={live.id} />
            <FolioTable folio={folio} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded bg-ivory px-3 py-2 text-body"><span>Outstanding balance</span><span className="font-semibold tnum">{formatCurrency(due)}</span></div>
            {due > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Final payment" type="number" min={0} value={amountText ?? String(due)} onChange={(e) => setAmountText(e.target.value)} hint={backendMode ? 'Record the settled manual payment before checkout.' : 'Simulated — no money is processed'} />
                <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
              </div>
            ) : <p className="text-body text-success">The folio is settled. No payment is needed.</p>}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-body text-slate">Invoice preview. The payment is recorded and the receipt issued when you complete check-out.</p>
            <InvoiceDocument reservation={projected} folio={previewFolio} issued={today()} number={invoiceNumber(projected, today())} />
          </div>
        )}
        {step === 4 && done && (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-6 w-6" aria-hidden /></span>
            <h3 className="mt-3 text-section font-semibold">Check-out complete</h3>
            <p className="mt-1 text-body text-slate">Invoice {done.invoice} generated. Room {room?.number} is marked dirty for housekeeping.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setViewInvoice(true)}>View invoice</Button>
              {lastPayment && <Button variant="secondary" onClick={() => setReceipt(lastPayment)}>View receipt</Button>}
            </div>
          </div>
        )}
      </Dialog>
      <InvoiceDialog reservation={viewInvoice ? live : null} onClose={() => setViewInvoice(false)} />
      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

export function CheckOutDialog({ reservation, onClose }: { reservation: Reservation | null; onClose: () => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  if (!reservation) return null;
  return canManageFinancials
    ? <Body key={reservation.id} reservation={reservation} onClose={onClose} />
    : <OperationalCheckOut key={reservation.id} reservation={reservation} onClose={onClose} />;
}

function OperationalCheckOut({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === reservation.roomId));
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === reservation.guestId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const complete = async () => {
    setBusy(true); setError('');
    const result = await performCheckOut({ reservationId: reservation.id });
    setBusy(false);
    if (!result.ok) {
      setError(backendMode ? result.error : 'A finance-authorized role must settle or review this folio before checkout can be completed.');
      return;
    }
    toast.success(`${guest?.fullName ?? 'Guest'} checked out`, `Room ${room?.number ?? ''} marked dirty`);
    onClose();
  };
  return <Dialog open onClose={onClose} title="Check out guest" description={`${guest?.fullName ?? ''} · Room ${room?.number ?? ''} · ${reservation.reference}`} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={complete} loading={busy}>Complete check-out</Button></>}>
    <p className="text-body text-slate">{backendMode ? 'Checkout updates the reservation and room status in PostgreSQL. Payment collection and folio management are not part of the connected backend yet.' : 'The operational checkout will complete when the folio is settled. Financial details and payment controls are available to finance-authorized roles.'}</p>
    {error && <p role="alert" className="mt-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-body text-warning">{error}</p>}
  </Dialog>;
}
