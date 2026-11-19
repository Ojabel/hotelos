import type { IsoDate } from '@/types';
import { backendMode } from '@/services/api/backendMode';

/** Fixed demonstration date so every screen agrees on "today". */
export const DEMO_TODAY: IsoDate = '2026-11-08';

const DAY_MS = 86_400_000;

function toUtc(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function today(): IsoDate {
  return backendMode ? new Date().toISOString().slice(0, 10) : DEMO_TODAY;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return Math.round((toUtc(checkOut) - toUtc(checkIn)) / DAY_MS);
}
