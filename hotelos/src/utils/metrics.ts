import type { FolioCharge, IsoDate, Reservation, Room, RoomStatus } from '@/types';
import { addDays, nightsBetween } from './demoClock';

const REALIZED: Reservation['status'][] = ['checked_in', 'checked_out'];
const PROJECTED: Reservation['status'][] = ['checked_in', 'confirmed', 'pending'];

const covers = (r: Reservation, date: IsoDate) => r.checkIn <= date && date < r.checkOut;
export const isOutOfOrder = (s: RoomStatus) => s === 'maintenance' || s === 'out_of_service';

export const scopeRooms = (hotelId: string, rooms: Room[]) => (hotelId === 'all' ? rooms : rooms.filter((r) => r.hotelId === hotelId));
export const scopeReservations = (hotelId: string, reservations: Reservation[]) => (hotelId === 'all' ? reservations : reservations.filter((r) => r.hotelId === hotelId));

export const sellableRooms = (rooms: Room[]) => rooms.filter((r) => !isOutOfOrder(r.status)).length;

export interface DayPoint {
  date: IsoDate;
  occupied: number;
  occupancy: number; // 0–100
  revenueActual: number;
  revenueProjected: number;
}

export function dailySeries(start: IsoDate, end: IsoDate, rooms: Room[], reservations: Reservation[], today: IsoDate): DayPoint[] {
  const sellable = Math.max(1, sellableRooms(rooms));
  const points: DayPoint[] = [];
  const days = Math.max(0, nightsBetween(start, end));
  for (let i = 0; i <= days; i++) {
    const date = addDays(start, i);
    const future = date > today;
    const statuses = future ? PROJECTED : REALIZED;
    const covering = reservations.filter((r) => statuses.includes(r.status) && covers(r, date));
    const revenue = covering.reduce((sum, r) => sum + r.nightlyRate, 0);
    // today uses physical room status so it matches the room-status KPIs
    const occupied = date === today ? rooms.filter((r) => r.status === 'occupied').length : covering.length;
    points.push({
      date,
      occupied,
      occupancy: Math.min(100, Math.round((occupied / sellable) * 100)),
      revenueActual: future ? 0 : revenue,
      revenueProjected: future ? revenue : 0,
    });
  }
  return points;
}

export function bookingsCreatedPerDay(start: IsoDate, end: IsoDate, reservations: Reservation[], today: IsoDate) {
  const last = end > today ? today : end;
  const out: Array<{ date: IsoDate; bookings: number }> = [];
  for (let i = 0; i <= Math.max(-1, nightsBetween(start, last)); i++) {
    const date = addDays(start, i);
    out.push({ date, bookings: reservations.filter((r) => r.createdAt === date).length });
  }
  return out;
}

export interface Kpis {
  totalRooms: number;
  available: number;
  occupied: number;
  reserved: number;
  housekeeping: number;
  outOfOrder: number;
  occupancyRate: number;
  arrivals: number;
  departures: number;
  revenueToday: number;
  revenueMonth: number;
  outstanding: number;
  adr: number | null;
  revpar: number | null;
}

export function computeKpis(rooms: Room[], reservations: Reservation[], today: IsoDate, rangeStart: IsoDate, rangeEnd: IsoDate, charges: FolioCharge[] = []): Kpis {
  const count = (...s: RoomStatus[]) => rooms.filter((r) => s.includes(r.status)).length;
  const sellable = sellableRooms(rooms);
  const occupied = count('occupied');

  const monthStart = today.slice(0, 8) + '01';
  const revenueMonth = dailySeries(monthStart, today, rooms, reservations, today).reduce((s, p) => s + p.revenueActual, 0);
  const revenueToday = dailySeries(today, today, rooms, reservations, today)[0].revenueActual;

  const elapsedEnd = rangeEnd > today ? today : rangeEnd;
  let adr: number | null = null;
  let revpar: number | null = null;
  if (elapsedEnd >= rangeStart) {
    const pts = dailySeries(rangeStart, elapsedEnd, rooms, reservations, today);
    const revenue = pts.reduce((s, p) => s + p.revenueActual, 0);
    const sold = reservations.reduce((sum, r) => {
      if (!REALIZED.includes(r.status)) return sum;
      return sum + pts.filter((p) => covers(r, p.date)).length;
    }, 0);
    adr = sold > 0 ? Math.round(revenue / sold) : null;
    revpar = sellable > 0 ? Math.round(revenue / (sellable * pts.length)) : null;
  }

  return {
    totalRooms: rooms.length,
    available: count('available', 'inspected'),
    occupied,
    reserved: count('reserved'),
    housekeeping: count('dirty', 'cleaning'),
    outOfOrder: count('maintenance', 'out_of_service'),
    occupancyRate: sellable > 0 ? Math.round((occupied / sellable) * 100) : 0,
    arrivals: reservations.filter((r) => r.checkIn === today && ['pending', 'confirmed', 'checked_in'].includes(r.status)).length,
    departures: reservations.filter((r) => r.checkOut === today && ['checked_in', 'checked_out'].includes(r.status)).length,
    revenueToday,
    revenueMonth,
    outstanding: reservations.filter((r) => REALIZED.includes(r.status)).reduce((s, r) => s + Math.max(0, r.nightlyRate * Math.max(0, nightsBetween(r.checkIn, r.checkOut)) + charges.filter((c) => c.reservationId === r.id).reduce((a, c) => a + c.amount, 0) - r.paid), 0),
    adr,
    revpar,
  };
}
