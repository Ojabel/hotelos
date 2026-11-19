import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppNotification, Role, Session, Tone } from '@/types';

export interface Toast { id: string; tone: Tone; title: string; description?: string }

interface AppState {
  session: Session | null;
  sidebarCollapsed: boolean;
  hotelId: string;
  notifications: AppNotification[];
  toasts: Toast[];
  login: (session: Session) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  toggleSidebar: () => void;
  setHotelId: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  pushToast: (tone: Tone, title: string, description?: string) => void;
  dismissToast: (id: string) => void;
}

/** "Remember me" → localStorage; otherwise sessionStorage (cleared when the tab closes). */
const rememberAwareStorage = {
  getItem: (n: string) => localStorage.getItem(n) ?? sessionStorage.getItem(n),
  setItem: (n: string, v: string) => {
    let remember = true;
    try {
      const s = JSON.parse(v).state?.session;
      if (s) remember = s.remember !== false;
    } catch { /* keep default */ }
    (remember ? localStorage : sessionStorage).setItem(n, v);
    (remember ? sessionStorage : localStorage).removeItem(n);
  },
  removeItem: (n: string) => { localStorage.removeItem(n); sessionStorage.removeItem(n); },
};

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', title: '3 arrivals due today', body: 'Rooms 201 and 202 are reserved for check-in.', time: '08:15', read: false, tone: 'info', to: '/front-desk/arrivals' },
  { id: 'n2', title: 'Room 205 needs cleaning', body: 'Marked dirty after the last cancellation hold.', time: '07:40', read: false, tone: 'warning', to: '/housekeeping' },
  { id: 'n3', title: 'Low stock: bath towels', body: 'Stock is below the reorder level.', time: 'Yesterday', read: false, tone: 'danger', to: '/inventory' },
  { id: 'n4', title: 'Deposit received', body: 'Bank transfer recorded for HOS-2611-011.', time: 'Yesterday', read: true, tone: 'success', to: '/billing/payments' },
  { id: 'n5', title: 'Maintenance completed', body: 'Room B8 air-conditioning inspection logged.', time: 'Mon', read: true, tone: 'neutral', to: '/maintenance' },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      session: null,
      sidebarCollapsed: false,
      hotelId: 'all',
      notifications: SEED_NOTIFICATIONS,
      toasts: [],
      login: (session) => set({ session }),
      logout: () => set({ session: null }),
      setRole: (role) => set((s) => (s.session ? { session: { ...s.session, role } } : s)),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setHotelId: (hotelId) => set({ hotelId }),
      markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      pushToast: (tone, title, description) => {
        const id = Math.random().toString(36).slice(2);
        set((s) => ({ toasts: [...s.toasts, { id, tone, title, description }] }));
        setTimeout(() => get().dismissToast(id), 4500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'hotelos-app',
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: (s) => ({ session: s.session, sidebarCollapsed: s.sidebarCollapsed, hotelId: s.hotelId }),
    },
  ),
);

export const toast = {
  success: (title: string, description?: string) => useAppStore.getState().pushToast('success', title, description),
  error: (title: string, description?: string) => useAppStore.getState().pushToast('danger', title, description),
  info: (title: string, description?: string) => useAppStore.getState().pushToast('info', title, description),
};
