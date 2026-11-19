import type { ApiErrorBody, ApiSuccess } from './contracts';
import { localApiToken } from './backendMode';
import { firebaseIdentity } from '@/services/auth/firebase';

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  getAccessToken?: () => Promise<string | undefined>;
  fetcher?: typeof fetch;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly correlationId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetcher = (options.fetcher ?? fetch).bind(globalThis);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) throw new ApiClientError('Backend API is not configured.', 0, 'API_NOT_CONFIGURED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Correlation-Id', correlationId);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    try {
      const token = await (this.options.getAccessToken?.() ?? firebaseIdentity.getToken()) ?? localApiToken.get();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await this.fetcher(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...init,
        headers,
        credentials: init.credentials ?? 'include',
        signal: controller.signal,
      });
      const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
      if (!response.ok) {
        if (response.status === 401) localApiToken.clear();
        const error = payload as ApiErrorBody | undefined;
        const message = typeof error?.message === 'string' ? error.message
          : response.status === 401 ? 'Your backend session is missing or expired. Sign in again.'
            : response.status === 403 ? 'Your account does not have permission to perform this action.'
              : 'The request could not be completed.';
        throw new ApiClientError(message, response.status, error?.error ?? 'API_ERROR', error?.correlationId, error?.message);
      }
      if (payload && typeof payload === 'object' && 'data' in payload) return (payload as ApiSuccess<T>).data;
      return payload as T;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (controller.signal.aborted) throw new ApiClientError('The request timed out.', 0, 'REQUEST_TIMEOUT');
      throw new ApiClientError('Unable to reach the backend API.', 0, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const apiClient = new ApiClient();
