import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

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
