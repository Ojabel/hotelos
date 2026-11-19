import { useSyncExternalStore } from 'react';
import type { Hotel, RoomCategory } from '@/types';
import { ROOM_CATEGORIES } from '@/data/roomCatalog';

// Backend mode is the default. Demo mode remains an explicit, isolated local opt-in.
export const backendMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_DATA_MODE !== 'demo';
export const localDevAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_DEV_AUTH === 'true';
const TOKEN_KEY = 'hotelos-local-api-token';
let backendHotels: Hotel[] = [];
let backendCategories: RoomCategory[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

export const localApiToken = {
  get: () => typeof sessionStorage === 'undefined' ? undefined : sessionStorage.getItem(TOKEN_KEY) ?? undefined,
  set: (value: string) => { sessionStorage.setItem(TOKEN_KEY, value); notify(); },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('hotelos-api-session-expired'));
    notify();
  },
};

export type BackendHotel = Pick<Hotel, 'id' | 'name'> & { code: string };
export function setBackendHotels(items: BackendHotel[]) { backendHotels = items.map((h) => ({ id: h.id, name: h.name, city: '', address: '', phone: '', email: '', currency: 'NGN', timezone: 'Africa/Lagos', stars: 0 })); notify(); }
export function useBackendHotels() { return useSyncExternalStore(subscribe, () => backendHotels, () => []); }
export function setBackendCategories(items: RoomCategory[]) {
  backendCategories = items;
  for (const item of items) if (!ROOM_CATEGORIES.some((category) => category.id === item.id)) ROOM_CATEGORIES.push(item);
  notify();
}
export function useRoomCategories() { return useSyncExternalStore(subscribe, () => backendMode ? backendCategories : ROOM_CATEGORIES, () => ROOM_CATEGORIES); }
export function findRoomCategory(id: string) { return backendCategories.find((category) => category.id === id) ?? ROOM_CATEGORIES.find((category) => category.id === id); }
