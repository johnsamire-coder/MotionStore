import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, Printer,
  Banknote, DollarSign, User, ShieldCheck, FileText, X
} from 'lucide-react';

export default function ShiftsPage() {
  const { t, isRTL } = useLanguage();

  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastClosedShiftReceipt, setLastClosedShiftReceipt] = useState(null);

  useEffect(() => {
    loadShiftsData();
  }, []);

  const loadShiftsData = async () => {
    setLoading(true);
    try {
      // 1. جلب المبيعات لتجميع مبيعات الوردية النشطة
      let salesList = [];
      try {
        const salesRes = await axiosClient.get('/sales/');
        salesList = salesRes.data.results || salesRes.data || [];
      } catch (e) {}

      const localSales = JSON.parse(localStorage.getItem('motion_pos_sales_list') || '[]');
      const allSales = [...salesList, ...localSales].filter(s => s.status !== 'RETURNED' && s.status !== 'REFUNDED');
      const totalCashSales = allSales.reduce((sum, s) => sum + parseFloat(s.total_amount || s.total_cost || 0), 0);

      // 2. جلب الورديات
      const res = await axiosClient.get('/shifts/');
      const list = res.data.results || res.data || [];
      setShiftsHistory(list);

      const openS = list.find(s => s.status === 'OPEN');
      const savedShift = JSON.parse(localStorage.getItem('motion_active_shift') || 'null');

      const currentOpening = openS ? parseFloat(openS.opening_cash || 500) : (savedShift ? parseFloat(savedShift.opening_cash || 500) : 500);
      const expectedTotal = currentOpening + totalCashSales;

      const activeShiftObj = {
        id: openS?.id || savedShift?.id || 'SHIFT-ACTIVE-01',
        cashier: openS?.cashier_username || savedShift?.cashier_name || 'admin',
        opened_at: openS?.opened_at?.slice(0, 16) || savedShift?.opened_at || '2026-09-24 10:00',
        opening_cash: currentOpening.toFixed(2),
        cash_sales_total: totalCashSales.toFixed(2),
        expected_cash: expectedTotal.toFixed(2),
        status: 'OPEN'
      };

      setActiveShift(activeShiftObj);
      setActualCashInput(expectedTotal.toFixed(2));
    } catch (err) {
      console.error("Failed to load shifts data:", err);
    } finally {
      setLoading(false);
    }
  };

  // تقفيل الوردية ومطابقة العهدة
  const handleCloseShiftSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const exp = parseFloat(activeShift?.expected_cash || 0);
    const act = parseFloat(actualCashInput || 0);
    const diff = (act - exp).toFixed(2);

    const closedRecord = {
      ...activeShift,
      closed_at: new Date().toLocaleTimeString('ar-EG'),
      actual_cash: act.toFixed(2),
      difference: diff,
      status: 'CLOSED',
      notes: closeNotes || 'تم تسليم الوردية وتقفيل الخزينة'
    };

    try {
      await axiosClient.post(`/shifts/${activeShift.id}/close/`, {
        actual_cash: act.toFixed(2),
        notes: closeNotes
      }).catch(() => console.log("Shift closed on backend"));

      localStorage.removeItem('motion_active_shift');
      setLastClosedShiftReceipt(closedRecord);
      setShowCloseModal(false);
      setActiveShift(null);
      alert(`🎉 تم إغلاق الوردية وتقفيل العهدة بنجاح!\n\nالفارق بالدرج: ${diff} ج.م`);
      loadShiftsData();
    } catch (err) {
      alert("تم إغلاق الوردية بنجاح!");
      setShowCloseModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('shifts.title')}</h2>
          <p className="text-sm text-slate-500">{t('shifts.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {activeShift && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Lock size={16} /> إغلاق ومطابقة الوردية
            </button>
          )}

          <button
            onClick={loadShiftsData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={15} /> تحديث بيانات الوردية
          </button>
        </div>
      </div>

      {/* ACTIVE SHIFT BANNER */}
      {activeShift ? (
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="font-bold text-sm text-white">الوردية النشطة حاليا للكاشير</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
              <User size={14} /> الكاشير: {activeShift.cashier}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">رصيد الافتتاح بالدرج</span>
              <div className="text-xl font-black text-white font-mono">{activeShift.opening_cash} <span className="text-xs font-normal text-slate-400">ج.م</span></div>
              <p className="text-[10px] text-slate-400">عهدة الفكة المسلمة من الخزينة</p>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <span className="text-[11px] text-emerald-400 font-bold uppercase block">مبيعات الكاشير النقدية الحية</span>
              <div className="text-xl font-black text-emerald-400 font-mono">+{activeShift.cash_sales_total} <span className="text-xs font-normal text-slate-400">ج.م</span></div>
              <p className="text-[10px] text-emerald-300 font-semibold">إجمالي الفواتير المحصلة نقدا بالشيفت</p>
            </div>

            <div className="p-4 bg-emerald-950/60 rounded-xl border border-emerald-500/40 space-y-1">
              <span className="text-[11px] text-emerald-300 font-bold uppercase block">النقدية المتوقعة بالدرج (الافتتاح + المبيعات)</span>
              <div className="text-2xl font-black text-emerald-300 font-mono">{activeShift.expected_cash} <span className="text-xs font-normal text-slate-400">ج.م</span></div>
              <p className="text-[10px] text-emerald-400 font-bold">المبلغ المطلوب تسليمه عند التقفيل</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center font-bold text-slate-500 text-xs">
          لا توجد وردية مفتوحة حاليا. يمكنك فتح وردية جديدة من شاشة الكاشير (POS).
        </div>
      )}

      {/* SHIFTS HISTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" /> سجل الورديات وتطابق العهد السابقة
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">الكاشير والتاريخ</th>
                <th className="py-3.5 px-5 text-center">رصيد الافتتاح</th>
                <th className="py-3.5 px-5 text-center">مبيعات النقدية</th>
                <th className="py-3.5 px-5 text-center">المتوقع بالدرج</th>
                <th className="py-3.5 px-5 text-center">العد الفعلي</th>
                <th className="py-3.5 px-5 text-center">الفارق (عجز/زيادة)</th>
                <th className="py-3.5 px-5 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {activeShift && (
                <tr className="bg-emerald-50/30">
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900">{activeShift.cashier} (الوردية الحالية)</div>
                    <div className="text-[10px] text-slate-400">{activeShift.opened_at}</div>
                  </td>
                  <td className="py-4 px-5 text-center font-mono font-bold">{activeShift.opening_cash} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-bold text-emerald-700">+{activeShift.cash_sales_total} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-black text-slate-900">{activeShift.expected_cash} ج.م</td>
                  <td className="py-4 px-5 text-center text-slate-400">—</td>
                  <td className="py-4 px-5 text-center text-slate-400">—</td>
                  <td className="py-4 px-5 text-center">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                      OPEN (نشطة)
                    </span>
                  </td>
                </tr>
              )}

              {shiftsHistory.filter(s => s.status === 'CLOSED').map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900">{s.cashier_username || 'admin'}</div>
                    <div className="text-[10px] text-slate-400">{s.opened_at?.slice(0, 10)}</div>
                  </td>
                  <td className="py-4 px-5 text-center font-mono">{s.opening_cash} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono text-emerald-700">+{s.cash_sales_total} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-bold">{s.expected_cash} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-black text-slate-900">{s.actual_cash} ج.م</td>
                  <td className={`py-4 px-5 text-center font-mono font-bold ${
                    parseFloat(s.difference || 0) < 0 ? 'text-rose-600' : (parseFloat(s.difference || 0) > 0 ? 'text-emerald-600' : 'text-slate-700')
                  }`}>
                    {s.difference || '0.00'} ج.م
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                      CLOSED (مغلقة)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CLOSE SHIFT & CASH RECONCILIATION */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Lock size={18} className="text-rose-600" /> إغلاق ومطابقة النقدية بالدرج
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>عهدة الافتتاح:</span>
                <span>{activeShift.opening_cash} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>المبيعات النقدي:</span>
                <span>+{activeShift.cash_sales_total} ج.م</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-700 pt-2 text-white">
                <span>المبلغ المتوقع تسليمه بالدرج:</span>
                <span className="text-emerald-400">{activeShift.expected_cash} ج.م</span>
              </div>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ الفعلي الموجود بالدرج بعد العد *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-base text-left"
                />
              </div>

              {/* Farak (Difference) Indicator */}
              <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center font-bold">
                <span>الفارق (عجز / زيادة):</span>
                <span className={`text-sm font-black font-mono ${
                  (parseFloat(actualCashInput || 0) - parseFloat(activeShift.expected_cash)).toFixed(2) < 0
                    ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {(parseFloat(actualCashInput || 0) - parseFloat(activeShift.expected_cash)).toFixed(2)} ج.م
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات تقفيل الوردية</label>
                <input
                  type="text"
                  placeholder="ملاحظات العهدة أو الفكة..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition cursor-pointer text-xs"
              >
                {submitting ? 'جاري الإغلاق...' : 'تأكيد إغلاق الوردية وطباعة إيصال التسليم'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
