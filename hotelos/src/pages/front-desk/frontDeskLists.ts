import type { Reservation } from '@/types';
import { today } from '@/utils/demoClock';

export const arrivalsOf = (rs: Reservation[]) => rs.filter((r) => r.checkIn === today() && ['pending', 'confirmed', 'checked_in'].includes(r.status));
/** Departing today, or overdue and still in-house. */
export const departuresOf = (rs: Reservation[]) => rs.filter((r) => r.checkOut <= today() && (r.status === 'checked_in' || (r.status === 'checked_out' && r.checkOut === today())));
export const inHouseOf = (rs: Reservation[]) => rs.filter((r) => r.status === 'checked_in');
