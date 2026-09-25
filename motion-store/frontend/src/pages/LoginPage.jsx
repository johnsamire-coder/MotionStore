import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axiosClient from '../api/axiosClient';
import { User, Lock, Globe, Store } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
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
    axiosClient.get('/tenants/public_info/')
      .then(res => {
        if (res.data && res.data.name) {
          setBrand({
            name: res.data.name,
            logo_base64: res.data.logo_base64
          });
        }
      })
      .catch(err => console.log('Public brand fetch error'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const isAr = lang === 'ar';
  const displayTitle = isAr ? (t('login.title') + ' - ' + brand.name) : (brand.name + ' - ' + t('login.title'));

  return (
    <div 
      className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans bg-cover bg-center"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.85)), url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop')"
      }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <button
        onClick={toggleLanguage}
        type="button"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-white/20 rounded-xl text-xs font-black transition shadow-xl cursor-pointer"
      >
        <Globe size={16} className="text-emerald-600" />
        <span>{isAr ? 'English (EN)' : 'العربية (AR)'}</span>
      </button>

      <div className="bg-slate-900/85 border border-slate-700/60 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 z-10">
        
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto shadow-inner overflow-hidden p-2">
            {brand.logo_base64 ? (
              <img src={brand.logo_base64} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Store size={36} className="text-emerald-400" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-wide leading-tight">
              {displayTitle}
            </h1>
            <p className="text-xs text-slate-300 font-bold mt-1">{t('login.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">{t('login.username')}</label>
            <div className="relative">
              <User size={16} className={"absolute " + (isAr ? "right-3" : "left-3") + " top-3.5 text-slate-400"} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={"w-full bg-slate-950/80 border border-slate-700 rounded-xl " + (isAr ? "pr-10 pl-4" : "pl-10 pr-4") + " py-3 text-sm font-black text-white outline-none transition focus:ring-2 focus:ring-emerald-500"}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">{t('login.password')}</label>
            <div className="relative">
              <Lock size={16} className={"absolute " + (isAr ? "right-3" : "left-3") + " top-3.5 text-slate-400"} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={"w-full bg-slate-950/80 border border-slate-700 rounded-xl " + (isAr ? "pr-10 pl-4" : "pl-10 pr-4") + " py-3 text-sm font-black text-white outline-none transition focus:ring-2 focus:ring-emerald-500"}
                required
              />
            </div>
          </div>

          <div className="flex items-center text-xs text-slate-300 font-bold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600"
              />
              <span>{t('login.rememberMe')}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 rounded-xl font-black text-sm shadow-xl transition cursor-pointer disabled:opacity-50"
          >
            {loading ? t('login.verifying') : t('login.submit')}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-mono">
            <span>{t('login.poweredBy')}</span>
            <span className="font-bold text-white">Motion Store</span>
          </p>
        </div>
      </div>
    </div>
  );
}
