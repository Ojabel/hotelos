import { useHotelStore } from '@/store/useHotelStore';
import { DEMO_TODAY } from '@/utils/demoClock';
import type { Guest, GuestNote, Result } from '@/types';
import { delay } from './delay';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';
import { useAppStore } from '@/store/useAppStore';

/** MOCK SERVICE — backend integration point for guest records. */
export interface GuestInput { fullName: string; email: string; phone: string; nationality: string }

export async function createGuest(input: GuestInput): Promise<Result<Guest>> {
  if (backendMode) {
    const hotelId = useAppStore.getState().hotelId;
    if (hotelId === 'all') return { ok: false, error: 'Select one property before adding a guest.' };
    return backendOperations.createGuest(hotelId, input);
  }
  await delay(200);
  if (!input.fullName.trim()) return { ok: false, error: 'Enter the guest’s full name.' };
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: 'Enter a valid email address.' };
  if (input.phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Enter a valid phone number.' };
  const { guests, addGuest, log } = useHotelStore.getState();
  if (guests.some((g) => g.email.toLowerCase() === input.email.trim().toLowerCase())) {
    return { ok: false, error: 'A guest with this email already exists. Choose them from the list instead.' };
  }
  const guest: Guest = {
    id: `g-${String(guests.length + 1).padStart(3, '0')}`,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    nationality: input.nationality.trim() || 'Not specified',
    vip: false,
    idType: 'National ID',
    idNumber: '—',
    preferences: [],
    createdAt: DEMO_TODAY,
  };
  addGuest(guest);
  log(`Guest profile created for ${guest.fullName}`, 'system');
  return { ok: true, value: guest };
}

export interface GuestUpdate extends GuestInput { idType: Guest['idType']; idNumber: string; preferences: string[]; vip: boolean }

export async function updateGuest(id: string, input: GuestUpdate): Promise<Result<Guest>> {
  if (backendMode) {
    const guest = useHotelStore.getState().guests.find((item) => item.id === id);
    if (!guest) return { ok: false, error: 'Guest not found.' };
    return backendOperations.updateGuest(useAppStore.getState().hotelId, id, {
      fullName: input.fullName, email: input.email, phone: input.phone, nationality: input.nationality,
    });
  }
  await delay(300);
  if (!input.fullName.trim()) return { ok: false, error: 'Enter the guest’s full name.' };
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: 'Enter a valid email address.' };
  if (input.phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Enter a valid phone number.' };
  const { guests, setGuests, log } = useHotelStore.getState();
  const existing = guests.find((g) => g.id === id);
  if (!existing) return { ok: false, error: 'Guest not found.' };
  if (guests.some((g) => g.id !== id && g.email.toLowerCase() === input.email.trim().toLowerCase())) return { ok: false, error: 'Another guest already uses this email.' };
  const updated: Guest = { ...existing, ...input, fullName: input.fullName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), nationality: input.nationality.trim() || 'Not specified' };
  setGuests((gs) => gs.map((g) => (g.id === id ? updated : g)));
  log(`Guest profile updated for ${updated.fullName}`, 'system');
  return { ok: true, value: updated };
}

export async function addGuestNote(input: { guestId: string; kind: GuestNote['kind']; text: string; author: string }): Promise<Result<GuestNote>> {
  await delay(200);
  if (!input.text.trim()) return { ok: false, error: 'Write something first.' };
  const { guestNotes, setGuestNotes } = useHotelStore.getState();
  const note: GuestNote = { id: `gn-${String(guestNotes.length + 1).padStart(3, '0')}-${guestNotes.length}`, guestId: input.guestId, date: DEMO_TODAY, author: input.author, kind: input.kind, text: input.text.trim(), resolved: input.kind === 'complaint' ? false : undefined };
  setGuestNotes((ns) => [note, ...ns]);
  return { ok: true, value: note };
}

export function toggleComplaintResolved(noteId: string) {
  useHotelStore.getState().setGuestNotes((ns) => ns.map((n) => (n.id === noteId ? { ...n, resolved: !n.resolved } : n)));
}
