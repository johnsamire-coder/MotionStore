import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { User, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, tenant: authTenant } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get tenant info from localStorage or AuthContext
  const [tenantInfo, setTenantInfo] = useState(() => {
    const saved = localStorage.getItem('user_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.tenant || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (authTenant) {
      setTenantInfo(authTenant);
    }
  }, [authTenant]);

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

  const companyName = tenantInfo?.name || 'جاكي ستور';
  const logoUrl = tenantInfo?.logo_base64;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -top-40 -right-40" />
      <div className="absolute w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -left-20" />

      <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 z-10">
        
        {/* Header / Logo Section */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg overflow-hidden p-1">
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-black text-emerald-400">
                {companyName.charAt(0)}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              نظام إدارة - {companyName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">أدخل بيانات الاعتماد للوصول لمساحة العمل</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم</label>
            <div className="relative">
              <User size={16} className="absolute right-3 top-3.5 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock size={16} className="absolute right-3 top-3.5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
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
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 py-3.5 rounded-xl font-black text-sm shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'جاري التحقق...' : 'دخول إلى مساحة العمل'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-mono">
            <span>مشغل بواسطة محرك</span>
            <span className="font-bold text-white">Motion Store</span>
            <span className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black text-emerald-400 inline-flex items-center justify-center">M</span>
          </p>
        </div>

      </div>
    </div>
  );
}
