import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useHotelStore } from '@/store/useHotelStore';
import { computeFolio } from '@/utils/folio';
import { hotelName } from '@/data/mockHotels';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { AddChargeForm } from './AddChargeDialog';
import { InvoiceDialog } from './Documents';
import { FolioTable } from './FolioTable';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from '@/services/backendOperations';

/** Live guest folio with the actions that make sense for the booking's current status. */
export function FolioDrawer({ reservationId, onClose }: { reservationId: string | null; onClose: () => void }) {
  const res = useHotelStore((s) => s.reservations.find((r) => r.id === reservationId));
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === res?.guestId));
  const charges = useHotelStore((s) => s.charges);
  const payments = useHotelStore((s) => s.payments);
  const refunds = useHotelStore((s) => s.refunds);
  const [child, setChild] = useState<null | 'pay' | 'invoice'>(null);
  const [adding, setAdding] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  const folio = res ? computeFolio(res, charges, payments, refunds) : null;
  const open = Boolean(res) && child === null;
  const canPay = res && ['pending', 'confirmed', 'checked_in'].includes(res.status) && folio && folio.balance > 0;

  const close = () => { setAdding(false); setChild(null); onClose(); };
  const issue = async () => {
    if (!res) return;
    setIssuing(true); setInvoiceError('');
    const result = await backendOperations.issueFinancialInvoice(res.id);
    setIssuing(false);
    if (!result.ok) return setInvoiceError(result.error);
    setChild('invoice');
  };

  return (
    <>
      <Dialog open={open} onClose={close} variant="drawer" title={guest ? `${guest.fullName} — folio` : 'Folio'} description={res ? `${res.reference} · ${hotelName(res.hotelId)}` : undefined}
        footer={res && <><Button variant="secondary" onClick={backendMode ? issue : () => setChild('invoice')} loading={issuing}>Invoice</Button>{canPay && <Button onClick={() => setChild('pay')}>Record payment</Button>}</>}>
        {res && folio && (
          <div className="space-y-5">
            <ReservationStatusBadge status={res.status} />
            <FolioTable folio={folio} />
            {invoiceError && <p role="alert" className="text-meta text-danger">{invoiceError}</p>}
            {res.status === 'checked_in' && (
              <div className="border-t border-line pt-4">
                {adding ? <AddChargeForm reservationId={res.id} onDone={() => setAdding(false)} /> : <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add charge</Button>}
              </div>
            )}
          </div>
        )}
      </Dialog>
      <RecordPaymentDialog open={child === 'pay'} reservationId={reservationId ?? undefined} onClose={() => setChild(null)} />
      <InvoiceDialog reservation={child === 'invoice' ? res ?? null : null} onClose={() => setChild(null)} />
    </>
  );
}
