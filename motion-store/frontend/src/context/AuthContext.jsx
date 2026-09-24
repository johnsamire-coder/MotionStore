import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // 1. قراءة بيانات المستخدم فوراً عند فتح الصفحة لمنع الطرد
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user_data');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // 2. قراءة بيانات الشركة التابع لها المستخدم
  const [tenant, setTenant] = useState(() => {
    const savedUser = localStorage.getItem('user_data');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.tenant) {
          return typeof u.tenant === 'object' ? u.tenant : { id: u.tenant };
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  // 3. كود بسيط جداً للتأكد من وجود البيانات وتثبيتها
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user_data');
    
    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.tenant) {
          const tObj = typeof u.tenant === 'object' ? u.tenant : { id: u.tenant };
          setTenant(tObj);
        }
      } catch (e) {
        console.error("Error restoring session", e);
      }
    }
    setLoading(false);
  }, []);

  // دالة تسجيل الدخول
  const login = async (username, password) => {
    const res = await axiosClient.post('/auth/login/', { username, password });
    const { access, refresh, user: userData } = res.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_data', JSON.stringify(userData));

    if (userData.tenant) {
      const tId = typeof userData.tenant === 'object' ? userData.tenant.id : userData.tenant;
      localStorage.setItem('tenant_id', tId);
      setTenant(userData.tenant);
    }

    setUser(userData);
    return userData;
  };

  // دالة تسجيل الخروج
  const logout = () => {
    localStorage.clear();
    setUser(null);
    setTenant(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
