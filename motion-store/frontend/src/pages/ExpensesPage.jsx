import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Save, Trash2, Calendar, DollarSign, Wallet, FileText, CheckCircle2 } from 'lucide-react';

export default function ExpensesPage() {
  const { t, isRTL } = useLanguage();
  const [treasuries, setTreasuries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entity: 'مصروفات عامة',
    amount: '',
    treasury: '',
    description: '',
    notes: ''
  });

  const entities = [
    'مصروفات عامة ونثريات',
    'مصروفات مستر مدحت',
    'استلاف شادي',
    'استلاف نور',
    'استلاف مارتن',
    'دليفري ومصاريف نقل',
    'الأولاد والعمالة',
    'إيجار ومرافق وفواتير'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, txRes] = await Promise.all([
        axiosClient.get('/treasuries/'),
        axiosClient.get('/treasury-transactions/')
      ]);
      const trList = tRes.data.results || tRes.data || [];
      setTreasuries(trList);
      if (trList.length > 0) {
        setForm(prev => ({ ...prev, treasury: trList[0].id }));
      }
      const allTx = txRes.data.results || txRes.data || [];
      const expTx = allTx.filter(tx => tx.transaction_type === 'WITHDRAWAL');
      setTransactions(expTx);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!form.treasury) {
      alert('يرجى اختيار الخزينة');
      return;
    }

    setSaving(true);
    try {
      const voucherId = 'EXP-' + String(Date.now()).slice(-6);
      await axiosClient.post('/treasury-transactions/', {
        treasury: form.treasury,
        transaction_type: 'WITHDRAWAL',
        amount: parseFloat(form.amount),
        description: '[' + form.entity + '] ' + (form.description || ''),
        source_document_type: 'ExpenseVoucher',
        source_document_id: voucherId
      });

      setSuccessMsg('تم حفظ المصروف وخصمه من الخزينة بنجاح ✅');
      setForm({
        date: new Date().toISOString().split('T')[0],
        entity: 'مصروفات عامة',
        amount: '',
        treasury: treasuries[0]?.id || '',
        description: '',
        notes: ''
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل حفظ المصروف');
    } finally {
      setSaving(false);
    }
  };

  const totalExpenses = transactions.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <DollarSign className="text-rose-600" />
            شاشة المصروفات اليومية السريعة (F3)
          </h1>
          <p className="text-xs text-slate-500 mt-1">تسجيل النثريات، سُلف العمالة، الدليفري، والمصروفات المباشرة</p>
        </div>
        <div className="text-left bg-rose-50 px-4 py-2 rounded-lg border border-rose-200">
          <span className="text-xs text-rose-700 font-bold block">إجمالي المصروفات المسجلة</span>
          <span className="text-xl font-black text-rose-900">{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="text-emerald-600" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات إذن الصرف</h2>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">التاريخ</label>
            <div className="relative">
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الجهة / بند المصروف</label>
            <select
              value={form.entity}
              onChange={e => setForm({ ...form, entity: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              {entities.map(ent => (
                <option key={ent} value={ent}>{ent}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ (ج.م) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="w-full bg-rose-50/50 border border-rose-300 text-rose-900 rounded-lg p-2.5 text-lg font-black focus:ring-2 focus:ring-rose-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الخزينة المنصرف منها</label>
            <select
              value={form.treasury}
              onChange={e => setForm({ ...form, treasury: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              {treasuries.map(tr => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} (الرصيد: {parseFloat(tr.current_balance).toLocaleString()} ج.م)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الوصف / البيان</label>
            <input
              type="text"
              placeholder="وصف تفصيلي للإذن..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ المصروف (F1)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ date: new Date().toISOString().split('T')[0], entity: 'مصروفات عامة', amount: '', treasury: treasuries[0]?.id || '', description: '', notes: '' })}
              className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm cursor-pointer"
            >
              جديد (F3)
            </button>
          </div>
        </form>

        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h2 className="text-sm font-black text-slate-800 border-b pb-2 mb-4">سجل المصروفات والمنصرفات الأخيرة</h2>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black border-y">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الخزينة</th>
                  <th className="p-3">البيان / الجهة</th>
                  <th className="p-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-400">لا توجد مصروفات مسجلة بعد</td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-rose-50/30 transition">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 text-slate-600">{new Date(tx.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="p-3 font-bold text-slate-700">{tx.treasury_name || 'الخزينة'}</td>
                      <td className="p-3 font-bold text-slate-900">{tx.description || 'مصروف نقدي'}</td>
                      <td className="p-3 text-left font-black text-rose-600">{Math.abs(parseFloat(tx.amount)).toFixed(2)} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
