import { useState } from 'react';
import { AddChargeDialog } from '@/components/billing/AddChargeDialog';
import { FolioDrawer } from '@/components/billing/FolioDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LATE_CHECK_OUT_RATE, postLateCheckOut } from '@/services/mockFrontDeskService';
import { toast } from '@/store/useAppStore';
import type { Reservation } from '@/types';
import { formatCurrency } from '@/utils/format';
import { CheckInDialog } from './CheckInDialog';
import { CheckOutDialog } from './CheckOutDialog';
import { TransferDialog } from './TransferDialog';

/** One place that owns every front-desk dialog so any screen can trigger them. */
export function useFrontDeskDialogs() {
  const [checkIn, setCheckIn] = useState<Reservation | null>(null);
  const [checkOut, setCheckOut] = useState<Reservation | null>(null);
  const [transfer, setTransfer] = useState<Reservation | null>(null);
  const [charge, setCharge] = useState<string | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [late, setLate] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmLate = async () => {
    if (!late) return;
    setBusy(true);
    const r = await postLateCheckOut(late.id);
    setBusy(false);
    if (r.ok) toast.success('Late check-out arranged', 'Fee added to the folio'); else toast.error('Could not arrange late check-out', r.error);
    setLate(null);
  };

  const dialogs = (
    <>
      <CheckInDialog reservation={checkIn} onClose={() => setCheckIn(null)} />
      <CheckOutDialog reservation={checkOut} onClose={() => setCheckOut(null)} />
      <TransferDialog reservation={transfer} onClose={() => setTransfer(null)} />
      <AddChargeDialog reservationId={charge} onClose={() => setCharge(null)} />
      <FolioDrawer reservationId={folio} onClose={() => setFolio(null)} />
      <ConfirmDialog open={Boolean(late)} title="Arrange late check-out?" confirmLabel="Add late check-out" loading={busy} onConfirm={confirmLate} onClose={() => setLate(null)}>
        The guest may stay until 18:00. A fee of {late ? formatCurrency(Math.round(late.nightlyRate * LATE_CHECK_OUT_RATE)) : ''} (half the nightly rate) is added to the folio.
      </ConfirmDialog>
    </>
  );
  return { dialogs, openCheckIn: setCheckIn, openCheckOut: setCheckOut, openTransfer: setTransfer, openCharge: (r: Reservation) => setCharge(r.id), openFolio: (r: Reservation) => setFolio(r.id), openLate: setLate };
}
