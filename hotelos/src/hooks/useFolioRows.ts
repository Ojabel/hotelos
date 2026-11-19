import { useMemo } from 'react';
import type { Folio } from '@/utils/folio';
import { computeFolio } from '@/utils/folio';
import type { Reservation } from '@/types';
import { useScopedData } from './useScopedData';
import { backendMode } from '@/services/api/backendMode';

export interface FolioRow { r: Reservation; folio: Folio }

/** Folios for every in-house or completed stay in the selected property scope. */
export function useFolioRows(): FolioRow[] {
  const { reservations, charges, payments, refunds } = useScopedData();
  return useMemo(() => reservations
    .filter((r) => backendMode ? charges.some((charge) => charge.reservationId === r.id) || payments.some((payment) => payment.reservationId === r.id) : r.status === 'checked_in' || r.status === 'checked_out')
    .map((r) => ({ r, folio: computeFolio(r, charges, payments, refunds) })), [reservations, charges, payments, refunds]);
}
