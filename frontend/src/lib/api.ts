import axios, { AxiosError } from 'axios';

/**
 * Resolve API base URL for the browser client.
 * - Relative `/api/v1` → same-origin Next.js Route Handlers (Vercel)
 * - localhost → local NestJS
 * - Absolute Railway/Zeabur/etc → ignored (stale Vercel env overrides must not win)
 */
export function resolveApiBaseUrl(raw = process.env.NEXT_PUBLIC_API_URL): string {
  const env = raw?.trim();
  if (!env) return '/api/v1';
  if (env.startsWith('/')) return env;
  if (/localhost|127\.0\.0\.1/.test(env)) return env;
  return '/api/v1';
}

/** Default for dashboard/list calls. Import of large CSV uses IMPORT_TIMEOUT_MS. */
const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
});

/** Multi-month GrabFood summary can take longer than the default 15s. */
export const IMPORT_TIMEOUT_MS = 90_000;

/**
 * Turn axios / NestJS errors into short Indonesian UI text.
 * Handles network, timeout, HTTP status, and Nest `message` string | string[].
 */
export function formatApiError(err: unknown, fallback = 'Gagal'): string {
  if (!axios.isAxiosError(err)) {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }

  const ax = err as AxiosError<{ message?: string | string[]; error?: string; statusCode?: number }>;

  if (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message || '')) {
    return 'Timeout — file terlalu besar atau server lambat. Coba lagi.';
  }

  if (!ax.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Offline — cek koneksi internet.';
    }
    return 'Tidak terhubung ke API (server mati / URL salah / CORS).';
  }

  const status = ax.response.status;
  const data = ax.response.data;
  let detail = '';

  if (data?.message != null) {
    detail = Array.isArray(data.message)
      ? data.message.filter(Boolean).join('; ')
      : String(data.message);
  } else if (typeof data?.error === 'string') {
    detail = data.error;
  }

  if (status === 404) {
    return detail
      ? `API tidak ditemukan (404): ${detail}`
      : 'API tidak ditemukan (404).';
  }
  if (status === 413) {
    return detail || 'File terlalu besar (413).';
  }
  if (status === 502 || status === 503 || status === 504) {
    return detail
      ? `Server API down (${status}): ${detail}`
      : `Server API down (${status}).`;
  }
  if (status >= 500) {
    return detail ? `Error server (${status}): ${detail}` : `Error server (${status}).`;
  }
  if (status >= 400) {
    return detail ? `${detail} (${status})` : `Permintaan ditolak (${status}).`;
  }

  return detail || `${fallback} (${status})`;
}

export default api;
// Dashboard
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  marketplace: (from: string, to: string) => api.get('/dashboard/marketplace', { params: { from, to } }),
  dailyChart: (year: number, month: number) => api.get('/dashboard/chart/daily', { params: { year, month } }),
  topProducts: (from: string, to: string) => api.get('/dashboard/top-products', { params: { from, to } }),
};

// Orders
export const ordersApi = {
  list: (params?: any) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
};

// Products
export const productsApi = {
  list: (params?: any) => api.get('/products', { params }),
  categories: () => api.get('/products/categories'),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Expenses
export const expensesApi = {
  list: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.patch(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  summary: (from: string, to: string) => api.get('/expenses/summary', { params: { from, to } }),
};

// Reports
export const reportsApi = {
  profitLoss: (from: string, to: string) => api.get('/reports/profit-loss', { params: { from, to } }),
  marketplace: (from: string, to: string) => api.get('/reports/marketplace', { params: { from, to } }),
};
