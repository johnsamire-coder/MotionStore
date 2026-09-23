import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read local storage immediately on refresh - Zero delay
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user_data');

    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.tenant) {
          setTenant(typeof u.tenant === 'object' ? u.tenant : { id: u.tenant });
          localStorage.setItem('tenant_id', typeof u.tenant === 'object' ? u.tenant.id : u.tenant);
        }
      } catch (e) {
        console.error("Error reading saved user session:", e);
      }
    }
    setLoading(false);
  }, []);

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
