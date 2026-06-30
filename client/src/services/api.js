import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      const isAuthCheckRequest = error.config?.url === '/auth/me';
      if (path !== '/' && path !== '/login' && path !== '/signup' && !isAuthCheckRequest) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
