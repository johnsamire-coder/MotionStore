import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Save, CheckCircle2, Lock, UserCheck, Eye, EyeOff } from 'lucide-react';

export default function PermissionsPage() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState('CASHIER');
  const [allowedScreens, setAllowedScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const roles = [
    { id: 'ADMIN', name: 'المدير العام (ADMIN)' },
    { id: 'MANAGER', name: 'مدير فرع (MANAGER)' },
    { id: 'CASHIER', name: 'كاشير (CASHIER)' },
    { id: 'WAREHOUSE_KEEPER', name: 'أمين مخزن (WAREHOUSE_KEEPER)' },
    { id: 'ACCOUNTANT', name: 'محاسب (ACCOUNTANT)' },
    { id: 'SORTER', name: 'مسؤول فرز (SORTER)' }
  ];

  const allScreens = [
    { path: '/', name: 'لوحة المؤشرات (الرئيسية)', category: 'عام' },
    { path: '/pos', name: 'شاشة المبيعات (F2)', category: 'المبيعات' },
    { path: '/expenses', name: 'شاشة المصروفات (F3)', category: 'المالية' },
    { path: '/coding', name: 'تكويد وتسعير الأصناف (F4)', category: 'إدارة المنتجات' },
    { path: '/returns', name: 'مرتجعات المبيعات (F10)', category: 'المبيعات' },
    { path: '/sorting', name: 'الفرز', category: 'المخازن والفرز' },
    { path: '/inventory', name: 'المخزون التام وجرد الأصناف (F8)', category: 'المخازن والفرز' },
    { path: '/purchasing', name: 'المشتريات واستلام البالات (F1)', category: 'المشتريات' },
    { path: '/shifts', name: 'الورديات وإغلاق الخزينة (F9)', category: 'المالية' },
    { path: '/treasury', name: 'الخزائن والصناديق (F7)', category: 'المالية' },
    { path: '/reports', name: 'مطبخ التقارير الشامل', category: 'التقارير' },
    { path: '/users', name: 'إدارة الموظفين والعهدة', category: 'الإدارة' },
    { path: '/permissions', name: 'إدارة الصلاحيات والمسميات', category: 'الإدارة' },
    { path: '/settings', name: 'إعدادات المنشأة والنظام', category: 'الإدارة' }
  ];

  useEffect(() => {
    loadRolePermissions(selectedRole);
  }, [selectedRole]);

  const loadRolePermissions = async (roleId) => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/role-permissions/?role=${roleId}`);
      const list = res.data.results || res.data || [];
      const rolePerm = list.find(r => r.role === roleId);
      if (rolePerm) {
        setAllowedScreens(rolePerm.allowed_screens || []);
      } else {
        // Default fallbacks
        if (roleId === 'ADMIN') setAllowedScreens(['*']);
        else if (roleId === 'CASHIER') setAllowedScreens(['/pos', '/shifts', '/returns']);
        else setAllowedScreens(['/', '/pos']);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleScreen = (path) => {
    if (allowedScreens.includes('*')) {
      // If admin was '*', convert to full list minus this path
      const allPathsExcept = allScreens.map(s => s.path).filter(p => p !== path);
      setAllowedScreens(allPathsExcept);
      return;
    }

    if (allowedScreens.includes(path)) {
      setAllowedScreens(allowedScreens.filter(p => p !== path));
    } else {
      setAllowedScreens([...allowedScreens, path]);
    }
  };

  const handleSelectAll = () => {
    setAllowedScreens(['*']);
  };

  const handleDeselectAll = () => {
    setAllowedScreens([]);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      // Check if permission object exists for this role
      const res = await axiosClient.get(`/role-permissions/?role=${selectedRole}`);
      const list = res.data.results || res.data || [];
      const rolePerm = list.find(r => r.role === selectedRole);

      if (rolePerm) {
        await axiosClient.patch(`/role-permissions/${rolePerm.id}/`, {
          allowed_screens: allowedScreens
        });
      } else {
        await axiosClient.post('/role-permissions/', {
          role: selectedRole,
          allowed_screens: allowedScreens
        });
      }

      setSuccessMsg(`تم حفظ وتطبيق صلاحيات مسمى (${roles.find(r=>r.id===selectedRole)?.name}) بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 4000);
      
      // Update local storage if editing current user's role
      if (user?.role === selectedRole) {
        localStorage.setItem('user_allowed_screens', JSON.stringify(allowedScreens));
      }
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={22} />
            شاشة إدارة الصلاحيات والمسميات الوظيفية
          </h1>
          <p className="text-xs text-slate-500 mt-1">تحديد الشاشات المتاحة لكل مسمى وظيفي وإخفاء الباقي تلقائياً من الموظفين</p>
        </div>

        <button
          onClick={handleSavePermissions}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow transition cursor-pointer disabled:opacity-50"
        >
          <Save size={16} />
          <span>{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق الصلاحيات'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ROLES SELECTOR COLUMN */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <h2 className="text-xs font-black text-slate-700 border-b pb-2 flex items-center gap-1.5">
            <UserCheck size={16} className="text-emerald-600" />
            اختر المسمى الوظيفي للموظفين:
          </h2>

          <div className="space-y-2">
            {roles.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRole(r.id)}
                className={`w-full text-right p-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-between border ${
                  selectedRole === r.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{r.name}</span>
                {selectedRole === r.id && <CheckCircle2 size={16} />}
              </button>
            ))}
          </div>
        </div>

        {/* ALLOWED SCREENS CHECKBOXES */}
        <div className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-800">
                الشاشات المسموح بها لـ [{roles.find(r => r.id === selectedRole)?.name}]
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">ضع علامة (✓) أمام الشاشات التي يحق للموظف فتحها فقط</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                تحديد الكل (كامل الصلاحيات)
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إلغاء الكل
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {allScreens.map(scr => {
              const isAllowed = allowedScreens.includes('*') || allowedScreens.includes(scr.path);
              return (
                <div
                  key={scr.path}
                  onClick={() => toggleScreen(scr.path)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isAllowed
                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-400 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isAllowed}
                      onChange={() => {}} // handled by parent div click
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-black">{scr.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{scr.path}</span>
                    </div>
                  </div>

                  {isAllowed ? (
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye size={12} /> متاح
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <EyeOff size={12} /> مخفي
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
