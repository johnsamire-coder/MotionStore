import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserPlus, Users, Key, ShieldCheck, CheckCircle2, XCircle, Search, Save, UserCheck, Lock, Building2 } from 'lucide-react';

export default function UsersPage() {
  const { user, tenant } = useAuth();
  const { t } = useLanguage();

  const [usersList, setUsersList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for New User
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'CASHIER',
    assigned_branches: []
  });

  const roles = [
    { id: 'CASHIER', name: 'كاشير (CASHIER)' },
    { id: 'MANAGER', name: 'مدير فرع (MANAGER)' },
    { id: 'WAREHOUSE_KEEPER', name: 'أمين مخزن (WAREHOUSE_KEEPER)' },
    { id: 'ACCOUNTANT', name: 'محاسب (ACCOUNTANT)' },
    { id: 'SORTER', name: 'مسؤول فرز (SORTER)' },
    { id: 'ADMIN', name: 'المدير العام (ADMIN)' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        axiosClient.get('/users/'),
        axiosClient.get('/branches/')
      ]);

      const uData = uRes.data.results || uRes.data || [];
      const bData = bRes.data.results || bRes.data || [];

      setUsersList(uData);
      setBranches(bData);
      if (bData.length > 0 && form.assigned_branches.length === 0) {
        setForm(prev => ({ ...prev, assigned_branches: [bData[0].id] }));
      }
    } catch (err) {
      console.error('Failed to fetch users data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Save New User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      alert('يرجى إدخال اسم المستخدم وكلمة السر');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/users/', {
        username: form.username.trim(),
        email: form.email,
        password: form.password,
        role: form.role,
        assigned_branches: form.assigned_branches
      });

      setSuccessMsg(`تم إنشاء حساب الموظف (${form.username}) بنجاح ✅`);
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'CASHIER',
        assigned_branches: branches[0] ? [branches[0].id] : []
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'فشل إنشاء حساب الموظف');
    } finally {
      setSaving(false);
    }
  };

  // Change Password Prompt
  const handleChangePassword = async (u) => {
    const newPass = prompt(`أدخل كلمة السر الجديدة للموظف (${u.username}):`);
    if (newPass && newPass.trim()) {
      try {
        await axiosClient.post(`/users/${u.id}/change_password/`, { new_password: newPass.trim() });
        alert(`تم تغيير كلمة السر للموظف (${u.username}) بنجاح ✅`);
      } catch (err) {
        alert('فشل تغيير كلمة السر');
      }
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (u) => {
    const actionName = u.is_active ? 'تعطيل' : 'تفعيل';
    if (window.confirm(`هل أنت أعدت التأكيد على ${actionName} حساب الموظف (${u.username})؟`)) {
      try {
        await axiosClient.patch(`/users/${u.id}/`, { is_active: !u.is_active });
        fetchData();
      } catch (err) {
        alert('فشل تغيير حالة الحساب');
      }
    }
  };

  const filteredUsers = usersList.filter(u =>
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Users className="text-emerald-600" size={22} />
            شاشة إدارة الموظفين والعهدة والوصول
          </h1>
          <p className="text-xs text-slate-500 mt-1">إنشاء حسابات الموظفين، تغيير كلمات السر، وتحديد الأدوار والفروع</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-black">
            إجمالي الموظفين: {usersList.length}
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CREATE EMPLOYEE FORM */}
        <form onSubmit={handleCreateUser} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2">
            <UserPlus className="text-emerald-600" size={18} />
            إضافة حساب موظف جديد
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم المستخدم / كود الدخول *</label>
              <input
                type="text"
                placeholder="مثال: marten / cashier1"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">كلمة السر *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">المسمى الوظيفي / الدور *</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">الفرع التابع له الموظف:</label>
              <select
                value={form.assigned_branches[0] || ''}
                onChange={e => setForm({ ...form, assigned_branches: [e.target.value] })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800"
              >
                {branches.length === 0 && <option value="">الفرع الرئيسي العام</option>}
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">البريد الإلكتروني (اختياري)</label>
              <input
                type="email"
                placeholder="marten@store.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <UserPlus size={16} />
            <span>{saving ? 'جاري الإنشاء...' : 'إضافة حساب الموظف'}</span>
          </button>
        </form>

        {/* EMPLOYEES DIRECTORY TABLE */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <UserCheck className="text-emerald-600" size={18} />
              قائمة حسابات الموظفين الحالية ({filteredUsers.length})
            </h2>

            <div className="relative w-48">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-9 pl-3 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black border-y">
                <tr>
                  <th className="p-3">اسم المستخدم</th>
                  <th className="p-3">الدور / المسمى</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-black text-slate-900">{u.username}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-900' :
                        u.role === 'CASHIER' ? 'bg-emerald-100 text-emerald-900' :
                        'bg-blue-100 text-blue-900'
                      }`}>
                        {u.role_display || u.role}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {u.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => handleChangePassword(u)}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold transition cursor-pointer"
                        title="تغيير كلمة السر"
                      >
                        <Key size={12} className="inline ml-1" />
                        كلمة السر
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          u.is_active
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-900'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                        }`}
                      >
                        {u.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
