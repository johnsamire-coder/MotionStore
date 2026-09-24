import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

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

// معالجة الردود بهدوء وبدون مسح بيانات المستخدم إلا عند التأكد التام
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // تجديد التوكن فقط إذا كان الرفض حقيقي وليس طلباً لتسجيل الدخول نفسه
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null' && refreshToken !== '') {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken });
          const newAccessToken = res.data.access;
          localStorage.setItem('access_token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosClient(originalRequest);
        } catch (refreshErr) {
          console.warn("Session expired, please login again.");
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
