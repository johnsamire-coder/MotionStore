import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            م
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">موشن ستور</h2>
          <p className="text-xs text-slate-400 mt-1">نظام إدارة البالات والملابس المستعملة</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1.5">اسم المستخدم</label>
            <div className="relative">
              <User size={16} className="absolute right-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition font-bold"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition font-bold"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition duration-200 mt-6 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading ? 'جاري التحقق...' : 'دخول إلى مساحة العمل'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
          محرك معتمد للمحاسبة والمخازن والبالات
        </div>
      </div>
    </div>
  );
}
