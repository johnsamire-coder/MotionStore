import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Building2,
  Sliders,
  Printer,
  ShieldCheck,
  Users,
  CheckCircle2,
  Store,
  Scale,
  Save,
  Plus,
  History,
  Boxes
} from 'lucide-react';

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('COMPANY');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Warehouses State
  const [warehouses, setWarehouses] = useState([]);
  const [newWhName, setNewWhName] = useState('');
  const [newWhType, setNewWhType] = useState('SORTING');
  const [addingWh, setAddingWh] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([
    { id: 1, user: 'admin', action: 'CREATE_PURCHASE', details: 'إنشاء فاتورة شراء رقم PINV-20260924-102', time: 'اليوم 10:15 ص' },
    { id: 2, user: 'admin', action: 'CREATE_SUPPLIER', details: 'إضافة مورد جديد: الشركة الأوروبية', time: 'اليوم 09:30 ص' },
    { id: 3, user: 'admin', action: 'OPEN_SHIFT', details: 'فتح وردية جديدة بعهدة 500.00 ج.م', time: 'أمس 08:00 م' }
  ]);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const res = await axiosClient.get('/warehouses/');
      setWarehouses(res.data.results || res.data || []);
    } catch (e) {
      console.error("Error loading warehouses", e);
    }
  };

  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    if (!newWhName.trim()) return;
    setAddingWh(true);
    try {
      const res = await axiosClient.post('/warehouses/', {
        name: newWhName.trim(),
        warehouse_type: newWhType,
        is_active: true
      });
      setWarehouses(prev => [...prev, res.data]);
      setNewWhName('');
      alert(`تم إضافة المخزن [${res.data.name}] بنجاح!`);
    } catch (err) {
      alert("فشل إضافة المخزن. يرجى التأكد من البيانات.");
    } finally {
      setAddingWh(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('settings.title')}</h2>
        <p className="text-sm text-slate-500">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 gap-2 bg-white p-2 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('COMPANY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'COMPANY' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Building2 size={16} /> بيانات المنشأة
        </button>

        <button
          onClick={() => setActiveTab('WAREHOUSES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'WAREHOUSES' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Boxes size={16} /> إدارة المخازن
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'AUDIT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <History size={16} /> سجل التدقيق (Audit Log)
        </button>
      </div>

      {/* TAB 1: COMPANY */}
      {activeTab === 'COMPANY' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-800 text-sm mb-4">بيانات الشركة والمقر الرئيسي</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">اسم الشركة / البراند</label>
              <input type="text" readOnly value="Jacky Store - چاكي للملابس والأحذية الأوروبية" className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800" />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">الفرع الرئيسي</label>
              <input type="text" readOnly value="ستور مدينة نصر" className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WAREHOUSES */}
      {activeTab === 'WAREHOUSES' && (
        <div className="space-y-6">
          <form onSubmit={handleAddWarehouse} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Plus size={16} className="text-emerald-600" /> إضافة مخزن جديد للنظام
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">اسم المخزن *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مخزن الفرز الفرعي - العجمي"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">نوع المخزن *</label>
                <select
                  value={newWhType}
                  onChange={(e) => setNewWhType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="SORTING">مخزن استلام وفرز (SORTING)</option>
                  <option value="MAIN">مخزن بيع رئيسي (MAIN)</option>
                  <option value="TRANSIT">مخزن عبور وتحويلات (TRANSIT)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={addingWh}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer text-xs"
            >
              {addingWh ? 'جاري الحفظ...' : 'حفظ المخزن الجديد'}
            </button>
          </form>

          {/* Warehouse List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">المخازن المعتمدة حاليا</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map((w) => (
                <div key={w.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{w.name}</h4>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-1 inline-block">
                      {w.warehouse_type}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">مخزن نشط ✅</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-emerald-600" /> سجل عمليات وتدقيق النظام (Audit Trail)
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">Immutable Record — لا يمكن تعديل السجل</span>
          </div>

          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
              <tr>
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">نوع العملية</th>
                <th className="py-3 px-4">تفاصيل الحركة</th>
                <th className="py-3 px-4 text-left">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-medium">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{log.user}</td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{log.action}</td>
                  <td className="py-3 px-4 text-slate-700">{log.details}</td>
                  <td className="py-3 px-4 text-left text-slate-400 text-[11px] font-mono">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

