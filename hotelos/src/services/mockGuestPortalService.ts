import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addDays, today } from '@/utils/demoClock';

export type GuestRequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export interface GuestServiceRequest {
  id: string; guestId: string; reservationId?: string; hotelId?: string; category: string;
  description: string; urgency: 'standard' | 'soon' | 'urgent'; status: GuestRequestStatus; createdAt: string;
}
interface CheckoutDraft { hotelId: string; categoryId: string; roomId: string; checkIn: string; checkOut: string; adults: number; children: number; guestId?: string }
interface GuestPortalState {
  selectedGuestId: string | null; requests: GuestServiceRequest[]; checkout: CheckoutDraft | null;
  selectGuest: (id: string | null) => void; setCheckout: (draft: CheckoutDraft | null) => void;
  addRequest: (request: Omit<GuestServiceRequest, 'id' | 'createdAt' | 'status'>) => GuestServiceRequest;
  updateRequest: (id: string, status: GuestRequestStatus) => void;
}

export const useGuestPortalStore = create<GuestPortalState>()(persist((set) => ({
  selectedGuestId: null,
  checkout: null,
  requests: [
    { id: 'gr-001', guestId: 'g-001', reservationId: 'res-001', hotelId: 'h-vi', category: 'Extra towels', description: 'Please leave two extra bath towels in the room.', urgency: 'standard', status: 'completed', createdAt: addDays(today(), -1) },
    { id: 'gr-002', guestId: 'g-001', reservationId: 'res-001', hotelId: 'h-vi', category: 'Concierge', description: 'Restaurant recommendations near the hotel.', urgency: 'standard', status: 'in_progress', createdAt: today() },
    { id: 'gr-003', guestId: 'g-002', reservationId: 'res-002', hotelId: 'h-vi', category: 'Housekeeping', description: 'A fresh set of linen, please.', urgency: 'standard', status: 'pending', createdAt: today() },
  ],
  selectGuest: (id) => set({ selectedGuestId: id }),
  setCheckout: (checkout) => set({ checkout }),
  addRequest: (request) => {
    const record: GuestServiceRequest = { ...request, id: `gr-${Date.now().toString(36)}`, createdAt: today(), status: 'pending' };
    set((s) => ({ requests: [record, ...s.requests] }));
    return record;
  },
  updateRequest: (id, status) => set((s) => ({ requests: s.requests.map((r) => r.id === id ? { ...r, status } : r) })),
}), { name: 'hotelos-guest-demo', storage: createJSONStorage(() => localStorage) }));

export function demoGuestSession() { return useGuestPortalStore.getState().selectedGuestId; }
export function selectedGuestRequests() {
  const id = demoGuestSession();
  return id ? getGuestRequests(id) : [];
}
function getGuestRequests(guestId: string) {
  return useGuestPortalStore.getState().requests.filter((request) => request.guestId === guestId);
}
