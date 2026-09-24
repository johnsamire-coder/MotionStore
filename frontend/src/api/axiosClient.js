import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenant_id');

  if (token && token !== 'undefined' && token !== 'null') {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null' && tenantId !== 'None') {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
}, (error) => Promise.reject(error));

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default axiosClient;
