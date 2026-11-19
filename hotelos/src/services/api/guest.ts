import { apiClient } from './client';

export interface GuestProfile { id: string; fullName: string; email: string | null; phone: string | null; preferences: string[]; hotel: { id: string; name: string; code: string } }
export interface GuestReservation { id: string; hotelId: string; reference: string; status: string; checkIn: string; checkOut: string; adults: number; children: number; room: { number: string }; category: { name: string } }
export interface GuestServiceRequest { id: string; hotelId: string; category: string; description: string; status: string; createdAt: string }

export const guestApi = {
  resolve: (fullName: string) => apiClient.request<GuestProfile>('/api/v1/guest/account/resolve', { method: 'POST', body: JSON.stringify({ fullName }) }),
  me: () => apiClient.request<GuestProfile>('/api/v1/guest/me'),
  update: (input: { fullName?: string; phone?: string; preferences?: string[] }) => apiClient.request<GuestProfile>('/api/v1/guest/me', { method: 'PATCH', body: JSON.stringify(input) }),
  reservations: () => apiClient.request<GuestReservation[]>('/api/v1/guest/reservations'),
  cancel: (id: string) => apiClient.request<{ id: string; status: string }>(`/api/v1/guest/reservations/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  requests: () => apiClient.request<GuestServiceRequest[]>('/api/v1/guest/service-requests'),
  createRequest: (input: { category: string; description: string; hotelId: string }) => apiClient.request<GuestServiceRequest>('/api/v1/guest/service-requests', { method: 'POST', body: JSON.stringify(input) }),
};
