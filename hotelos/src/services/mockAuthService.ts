import { useHotelStore } from '@/store/useHotelStore';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Guest access is an explicitly simulated local selection, not identity verification. */
export async function demoGuestLogin(guestId: string): Promise<void> {
  await delay(180);
  const guest = useHotelStore.getState().guests.find((entry) => entry.id === guestId);
  if (!guest) throw new Error('Choose a demonstration guest.');
}
