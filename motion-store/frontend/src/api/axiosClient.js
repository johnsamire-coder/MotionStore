import axios from 'axios';

const API_BASE_URL = '/api/v1';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// إرفاق التوكن تلقائياً مع كل طلب
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenant_id');

  if (token && token !== 'undefined' && token !== 'null' && token !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null' && tenantId !== 'None' && tenantId !== '') {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
}, (error) => Promise.reject(error));

// SESSION_FIX: renew the session once for all requests waiting on it, keep the NEW refresh key the server
// sends back (it rotates them), and when the session can't be renewed go to the login screen instead of
// leaving every screen failing with 401.
let refreshing = null;
const goLogin = () => {
  ['access_token', 'refresh_token', 'user_data'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
  if (!window.location.pathname.startsWith('/login')) window.location.href = '/login?expired=1';
};
const renew = () => {
  if (!refreshing) {
    const refreshToken = localStorage.getItem('refresh_token');
    refreshing = (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null'
      ? axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken }).then((res) => {
          localStorage.setItem('access_token', res.data.access);
          if (res.data.refresh) localStorage.setItem('refresh_token', res.data.refresh);
          return res.data.access;
        })
      : Promise.reject(new Error('no refresh token'))
    ).finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  }
  return refreshing;
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !originalRequest._retry && !String(originalRequest.url || '').includes('/auth/')) {
      originalRequest._retry = true;
      try {
        const token = await renew();
        originalRequest.headers = { ...(originalRequest.headers || {}), Authorization: `Bearer ${token}` };
        return axiosClient(originalRequest);
      } catch (refreshErr) {
        goLogin();
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
