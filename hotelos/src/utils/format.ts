import type { IsoDate } from '@/types';

let activeCurrency = 'NGN';
let activeDateFormat = 'dd MMM yyyy';

/** Currency is configurable (Settings → Hotel). NGN is the demo default. */
export function setCurrency(code: string) {
  activeCurrency = code;
}
export function getCurrency() {
  return activeCurrency;
}
export function setDateFormat(format: string) { activeDateFormat = format; }

export function formatCurrency(amount: number, currency: string = activeCurrency): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: IsoDate, withWeekday = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (activeDateFormat === 'yyyy-MM-dd') return `${iso}${withWeekday ? ` (${new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date)})` : ''}`;
  if (activeDateFormat === 'MM/dd/yyyy') return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}${withWeekday ? ` (${new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date)})` : ''}`;
  return new Intl.DateTimeFormat('en-GB', { weekday: withWeekday ? 'short' : undefined, day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
