import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Lock, User, AlertCircle, Globe } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === 'ar';
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('remembered_username');
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    } else {
      setUsername('admin');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || (isAr ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Invalid username or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-4 bg-cover bg-center font-sans"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1920&auto=format&fit=crop')" }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[3px]"></div>

      {/* Language Toggle Button */}
      <button
        type="button"
        onClick={toggleLanguage}
        className={`absolute top-6 ${isAr ? 'left-6' : 'right-6'} bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-xl z-50`}
      >
        <Globe size={18} />
        <span>{isAr ? 'English (EN)' : 'العربية (AR)'}</span>
      </button>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-slate-950/85 border border-slate-800/80 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            {isAr ? 'ش' : 'C'}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isAr ? 'نظام إدارة الشركة' : 'Company Workspace'}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            {isAr ? 'أدخل بيانات الاعتماد للوصول لمساحة العمل' : 'Enter your credentials to access the workspace'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block font-semibold text-slate-300 mb-2">
              {isAr ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <User size={18} className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3.5 text-slate-500`} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full bg-slate-900/80 border border-slate-700 rounded-xl ${isAr ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 text-white focus:outline-none focus:border-emerald-500 transition font-medium placeholder-slate-600`}
                placeholder={isAr ? 'أدخل اسم المستخدم' : 'Enter username'}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-2">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock size={18} className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-3.5 text-slate-500`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-slate-900/80 border border-slate-700 rounded-xl ${isAr ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 text-white focus:outline-none focus:border-emerald-500 transition font-medium placeholder-slate-600`}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2 pt-1">
            <input 
              type="checkbox" 
              id="remember" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
            />
            <label htmlFor="remember" className="text-xs text-slate-400 font-medium cursor-pointer select-none">
              {isAr ? 'تذكر بياناتي على هذا الجهاز' : 'Remember me on this device'}
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition duration-200 mt-2 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading 
              ? (isAr ? 'جاري التحقق...' : 'Authenticating...') 
              : (isAr ? 'دخول إلى مساحة العمل' : 'Sign In to Workspace')
            }
          </button>
        </form>

        {/* Footer: Powered by Motion Store */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col items-center justify-center gap-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
            {isAr ? 'مشغل بواسطة محرك' : 'Powered by'}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">M</div>
            <span className="font-extrabold text-slate-200 text-sm tracking-wide">Motion Store</span>
          </div>
        </div>

      </div>
    </div>
  );
}
