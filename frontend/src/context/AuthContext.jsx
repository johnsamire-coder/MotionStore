import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // 1. ظ‚ط±ط§ط،ط© ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط³طھط®ط¯ظ… ظپظˆط±ط§ظ‹ ط¹ظ†ط¯ ظپطھط­ ط§ظ„طµظپط­ط© ظ„ظ…ظ†ط¹ ط§ظ„ط·ط±ط¯
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

  // 2. ظ‚ط±ط§ط،ط© ط¨ظٹط§ظ†ط§طھ ط§ظ„ط´ط±ظƒط© ط§ظ„طھط§ط¨ط¹ ظ„ظ‡ط§ ط§ظ„ظ…ط³طھط®ط¯ظ…
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

  // 3. ظƒظˆط¯ ط¨ط³ظٹط· ط¬ط¯ط§ظ‹ ظ„ظ„طھط£ظƒط¯ ظ…ظ† ظˆط¬ظˆط¯ ط§ظ„ط¨ظٹط§ظ†ط§طھ ظˆطھط«ط¨ظٹطھظ‡ط§
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

  // ط¯ط§ظ„ط© طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„
  const login = async (username, password) => {
    const res = await axiosClient.post('/auth/login/', { username, password });
    const { access, refresh, user: userData } = res.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_data', JSON.stringify(userData));

    if (userData.tenant) {
      const tId = typeof userData.tenant === 'object' ? userData.tenant.id : userData.tenant;
      localStorage.setItem('tenant_id', tId);
      const tData = typeof userData.tenant === 'object' ? { ...userData.tenant, name: 'Jacky Store - چاكي' } : userData.tenant;
      setTenant(tData);
    }

    setUser(userData);
    return userData;
  };

  // ط¯ط§ظ„ط© طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬
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

