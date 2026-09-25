import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axiosClient from '../api/axiosClient';
import { User, Lock, Globe, Store } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [brand, setBrand] = useState({
    name: 'جاكي ستور',
    logo_base64: null
  });

  useEffect(() => {
    // Fetch public tenant info without auth token
    axiosClient.get('/tenants/public_info/')
      .then(res => {
        if (res.data && res.data.name) {
          setBrand({
            name: res.data.name,
            logo_base64: res.data.logo_base64
          });
        }
      })
      .catch(err => console.log('Public brand info fetch:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.85)), url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop')`
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Language Switcher Button (Top Left/Right) */}
      <button
        onClick={toggleLanguage}
        type="button"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-slate-800 border border-white/20 rounded-xl text-xs font-black transition shadow-xl cursor-pointer backdrop-blur-md"
      >
        <Globe size={16} className="text-emerald-600" />
        <span>{lang === 'ar' ? 'English (EN)' : 'العربية (AR)'}</span>
      </button>

      {/* Main Login Card - Lighter & Fresh Glassmorphic */}
      <div className="bg-slate-900/85 border border-slate-700/60 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 z-10">
        
        {/* Header / Dynamic Logo Section */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto shadow-inner overflow-hidden p-2 backdrop-blur-sm">
            {brand.logo_base64 ? (
              <img src={brand.logo_base64} alt="Company Logo" className="w-full h-full object-contain" />
            ) : (
              <Store size={36} className="text-emerald-400" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              نظام إدارة - {brand.name}
            </h1>
            <p className="text-xs text-slate-300 font-bold mt-1">أدخل بيانات الاعتماد للوصول لمساحة العمل</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">اسم المستخدم</label>
            <div className="relative">
              <User size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm font-black text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm font-black text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
              />
              <span>تذكر بياناتي على هذا الجهاز</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 rounded-xl font-black text-sm shadow-xl shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'جاري التحقق...' : 'دخول إلى مساحة العمل'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-mono">
            <span>مشغل بواسطة محرك</span>
            <span className="font-bold text-white">Motion Store</span>
            <span className="w-4 h-4 rounded bg-emerald-500/30 border border-emerald-400/50 text-[9px] font-black text-emerald-400 inline-flex items-center justify-center">M</span>
          </p>
        </div>

      </div>
    </div>
  );
}
