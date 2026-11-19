import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { scopeReservations, scopeRooms } from '@/utils/metrics';

/** Operational data filtered by the property selected in the account menu ('all' = every property). */
export function useScopedData() {
  const hotelId = useAppStore((s) => s.hotelId);
  const { rooms, reservations, guests, payments, activity, charges, refunds } = useHotelStore();
  return useMemo(() => {
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const guestById = new Map(guests.map((g) => [g.id, g]));
    return {
      hotelId,
      rooms: scopeRooms(hotelId, rooms),
      reservations: scopeReservations(hotelId, reservations),
      payments: hotelId === 'all' ? payments : payments.filter((p) => p.hotelId === hotelId),
      activity,
      charges,
      refunds: hotelId === 'all' ? refunds : refunds.filter((r) => r.hotelId === hotelId),
      guests,
      roomById,
      guestById,
    };
  }, [hotelId, rooms, reservations, guests, payments, activity, charges, refunds]);
}
