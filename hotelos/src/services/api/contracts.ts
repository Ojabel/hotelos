export interface ApiSuccess<T> {
  data: T;
  meta: { correlationId?: string; [key: string]: unknown };
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | { message?: string; details?: unknown[] };
  correlationId?: string;
  timestamp?: string;
  path?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
