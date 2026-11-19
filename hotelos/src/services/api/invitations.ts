import { apiClient } from './client';

export interface InvitationRecord {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
  deliveryStatus: 'NOT_SENT' | 'PENDING' | 'DELIVERED' | 'FAILED';
  deliveryError: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  invitedBy: { email: string | null };
  roles: Array<{ role: { id: string; name: string } }>;
}

export interface OrganizationRole { id: string; name: string; isSystem: boolean; hotelId: string | null }

export const invitationApi = {
  list: () => apiClient.request<InvitationRecord[]>('/api/v1/memberships/invitations'),
  roles: () => apiClient.request<OrganizationRole[]>('/api/v1/roles'),
  create: (email: string, roleIds: string[]) => apiClient.request<{ id: string; deliveryStatus: string; expiresAt: string }>('/api/v1/memberships/invitations', { method: 'POST', body: JSON.stringify({ email, roleIds }) }),
  cancel: (id: string) => apiClient.request<{ id: string; status: string }>(`/api/v1/memberships/invitations/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  resend: (id: string) => apiClient.request<{ id: string; deliveryStatus: string }>(`/api/v1/memberships/invitations/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
  outbox: () => apiClient.request<Array<{ to: string; subject: string; text: string; createdAt: string }>>('/api/v1/memberships/invitations/outbox'),
  validate: (token: string) => apiClient.request<{ status: string; email?: string; expiresAt?: string; roles?: string[] }>('/api/v1/memberships/invitations/validate', { method: 'POST', body: JSON.stringify({ token }) }),
  accept: (token: string) => apiClient.request<{ id: string; status: string }>('/api/v1/memberships/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }),
};
