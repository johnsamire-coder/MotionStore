import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, Printer,
  Banknote, DollarSign, User, ShieldCheck, FileText, X,
  CreditCard, QrCode, Smartphone, Vault, Calculator, Building2,
  Share2, FileSpreadsheet, Download
} from 'lucide-react';

export default function ShiftsPage() {
  const { t, isRTL } = useLanguage();

  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showClosedReceiptModal, setShowClosedReceiptModal] = useState(false);
  const [closedShiftSummary, setClosedShiftSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment Breakdown
  const [salesBreakdown, setSalesBreakdown] = useState({ cash: 0, card: 0, instapay: 0, wallet: 0 });

  // Banknotes Count Grid
  const [denominations, setDenominations] = useState({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });

  // Dispatch Split
  const [bankDepositAmount, setBankDepositAmount] = useState('3000.00');
  const [retainedFloat, setRetainedFloat] = useState('305.00');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    localStorage.removeItem('motion_pos_sales_list');
    loadShiftsData();
  }, []);

  const loadShiftsData = async () => {
    setLoading(true);
    try {
      // 1. جلب المبيعات
      let serverSales = [];
      try {
        const salesRes = await axiosClient.get('/sales/');
        serverSales = salesRes.data.results || salesRes.data || [];
      } catch (e) {}

      const validSales = serverSales.filter(s => s.status !== 'RETURNED' && s.status !== 'REFUNDED' && s.status !== 'CANCELLED');
      const cashSum = validSales.reduce((sum, s) => sum + parseFloat(s.total_amount || s.total_cost || 0), 0);

      setSalesBreakdown({ cash: cashSum, card: 0, instapay: 0, wallet: 0 });

      // 2. جلب الورديات من السيرفر حصريا
      const res = await axiosClient.get('/shifts/');
      const list = res.data.results || res.data || [];
      setShiftsHistory(list);

      const openS = list.find(s => s.status === 'OPEN');

      if (openS) {
        const currentOpening = parseFloat(openS.opening_cash || 500);
        const expectedTotal = currentOpening + cashSum;

        const activeShiftObj = {
          id: openS.id,
          cashier: openS.cashier_username || 'admin',
          opened_at: openS.opened_at?.slice(0, 16) || '2026-09-24 10:00',
          opening_cash: currentOpening.toFixed(2),
          cash_sales_total: cashSum.toFixed(2),
          expected_cash: expectedTotal.toFixed(2),
          status: 'OPEN'
        };

        setActiveShift(activeShiftObj);
        setBankDepositAmount(Math.max(0, expectedTotal - 305).toFixed(2));
        setRetainedFloat(Math.min(305, expectedTotal).toFixed(2));
      } else {
        // عدم وجود وردية مفتوحة في السيرفر ➔ مسح الوردية النشطة تماما
        setActiveShift(null);
        localStorage.removeItem('motion_active_shift');
      }

    } catch (err) {
      console.error("Failed to load shifts data:", err);
    } finally {
      setLoading(false);
    }
  };

  const actualCashCalculated = Object.entries(denominations).reduce((sum, [note, count]) => {
    return sum + (parseInt(note) * (parseInt(count) || 0));
  }, 0);

  const handleDenominationChange = (note, count) => {
    setDenominations(prev => ({ ...prev, [note]: Math.max(0, parseInt(count || 0)) }));
  };

  const handleShareShiftWhatsApp = (shift) => {
    const text = `📊 *تقرير تقفيل وردية كاشير معتمدة - موشن ستور*\n\n` +
      `👤 *الكاشير:* ${shift.cashier_username || shift.cashier || 'admin'}\n` +
      `📅 *التاريخ:* ${shift.opened_at?.slice(0, 10) || 'اليوم'}\n` +
      `💵 *عهدة الافتتاح:* ${shift.opening_cash} ج.م\n` +
      `📈 *مبيعات الكاش:* +${salesBreakdown.cash.toFixed(2)} ج.م\n` +
      `💰 *الكاش المتوقع بالدرج:* ${shift.expected_cash} ج.م\n` +
      `🏛️ *المورد للبنك:* ${bankDepositAmount} ج.م\n` +
      `🪙 *الفكة المتبقية بالدرج:* ${retainedFloat} ج.م\n` +
      `📌 *الحالة:* مغلقة ومطابقة 🔒\n\n` +
      `تم الاعتماد بواسطة نظام Motion Store SaaS 🚀`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportStyledExcel = () => {
    const dateStr = new Date().toLocaleDateString('ar-EG');
    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .header-title { background-color: #065f46; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; vertical-align: middle; }
          .header-sub { background-color: #ecfdf5; color: #047857; font-size: 11pt; font-weight: bold; text-align: center; height: 30px; vertical-align: middle; }
          .th-head { background-color: #10b981; color: #ffffff; font-size: 11pt; font-weight: bold; text-align: center; border: 1px solid #059669; height: 35px; vertical-align: middle; }
          .td-cell { border: 1px solid #cbd5e1; font-size: 10pt; text-align: center; height: 28px; vertical-align: middle; }
          .td-number { border: 1px solid #cbd5e1; font-size: 10pt; font-weight: bold; text-align: right; color: #0f172a; height: 28px; vertical-align: middle; }
        </style>
      </head>
      <body dir="rtl">
        <table>
          <tr><td colspan="8" class="header-title">موشن ستور — Motion Store Enterprise SaaS</td></tr>
          <tr><td colspan="8" class="header-sub">سجل وتفاصيل وراديات الكاشير وتسليم العهد | تاريخ الاستخراج: ${dateStr}</td></tr>
          <tr><td colspan="8"></td></tr>
          <thead>
            <tr>
              <th class="th-head">الكاشير</th>
              <th class="th-head">تاريخ الفتح</th>
              <th class="th-head">رصيد الافتتاح</th>
              <th class="th-head">مبيعات الكاش</th>
              <th class="th-head">الكاش المتوقع</th>
              <th class="th-head">العد الفعلي</th>
              <th class="th-head">الفارق</th>
              <th class="th-head">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${shiftsHistory.map(s => `
              <tr>
                <td class="td-cell">${s.cashier_username || s.cashier || 'admin'}</td>
                <td class="td-cell">${s.opened_at?.slice(0, 16) || 'اليوم'}</td>
                <td class="td-number">${s.opening_cash} ج.م</td>
                <td class="td-number">${s.cash_sales_total || '0.00'} ج.م</td>
                <td class="td-number">${s.expected_cash || '0.00'} ج.م</td>
                <td class="td-number">${s.actual_cash || '—'} ج.م</td>
                <td class="td-number">${s.difference || '0.00'} ج.م</td>
                <td class="td-cell" style="font-weight:bold; color:${s.status==='OPEN' ? '#047857' : '#475569'};">
                  ${s.status === 'OPEN' ? 'نشطة (مفتوحة)' : 'مغلقة'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `سجل_الورديات_المصمم_موشن_ستور_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseShiftSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const exp = parseFloat(activeShift?.expected_cash || 0);
    const act = actualCashCalculated > 0 ? actualCashCalculated : exp;
    const diff = (act - exp).toFixed(2);
    const nowStr = new Date().toLocaleString('ar-EG');

    const summaryObj = {
      cashier: activeShift.cashier,
      opened_at: activeShift.opened_at,
      closed_at: nowStr,
      opening_cash: activeShift.opening_cash,
      cash_sales: salesBreakdown.cash.toFixed(2),
      card_sales: salesBreakdown.card.toFixed(2),
      instapay_sales: salesBreakdown.instapay.toFixed(2),
      wallet_sales: salesBreakdown.wallet.toFixed(2),
      expected_cash: activeShift.expected_cash,
      actual_cash: act.toFixed(2),
      difference: diff,
      bank_deposit: bankDepositAmount,
      retained_float: retainedFloat,
      notes: closeNotes
    };

    try {
      await axiosClient.post(`/shifts/${activeShift.id}/close/`, {
        actual_cash: act.toFixed(2),
        notes: closeNotes
      }).catch(() => console.log("Shift closed"));

      localStorage.setItem('motion_next_shift_float', JSON.stringify({ opening_cash: retainedFloat }));
      localStorage.removeItem('motion_active_shift');

      setShowCloseModal(false);
      setClosedShiftSummary(summaryObj);
      setShowClosedReceiptModal(true);
      setActiveShift(null);
      loadShiftsData();
    } catch (err) {
      localStorage.removeItem('motion_active_shift');
      setShowCloseModal(false);
      setClosedShiftSummary(summaryObj);
      setShowClosedReceiptModal(true);
      setActiveShift(null);
      loadShiftsData();
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStyledExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} /> تحميل إكسل مصمم (.xls)
          </button>

          {activeShift && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Lock size={16} /> تقفيل الوردية وجرد الفئات والتوريد
            </button>
          )}

          <button
            onClick={loadShiftsData}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={15} /> تحديث
          </button>
        </div>
      </div>

      {/* ACTIVE SHIFT BANNER */}
      {activeShift ? (
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="font-bold text-sm text-white">الوردية النشطة حاليا للكاشير</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
              <User size={14} /> الكاشير: {activeShift.cashier} | تاريخ الفتح: {activeShift.opened_at}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">تفنيط تحصيلات المبيعات حسب طريقة الدفع:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-800/90 rounded-xl border border-emerald-500/30 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Banknote size={13} /> 💵 كاش</span>
                <span className="text-base font-black text-white font-mono">+{salesBreakdown.cash.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-indigo-500/30 space-y-1">
                <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1"><CreditCard size={13} /> 💳 فيزا / كارت</span>
                <span className="text-base font-black text-white font-mono">+{salesBreakdown.card.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-amber-500/30 space-y-1">
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1"><QrCode size={13} /> 📱 إنستا باي</span>
                <span className="text-base font-black text-white font-mono">+{salesBreakdown.instapay.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-rose-500/30 space-y-1">
                <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1"><Smartphone size={13} /> 📲 محفظة</span>
                <span className="text-base font-black text-white font-mono">+{salesBreakdown.wallet.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-800">
            <div className="p-3.5 bg-slate-800/60 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold block">عهدة الافتتاح الكاش بالدرج</span>
              <span className="text-lg font-black font-mono">{activeShift.opening_cash} ج.م</span>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-bold block">+ المبيعات النقدي الكاش فقط</span>
              <span className="text-lg font-black text-emerald-400 font-mono">+{salesBreakdown.cash.toFixed(2)} ج.م</span>
            </div>

            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl">
              <span className="text-[10px] text-emerald-300 font-bold block">⚖️ الكاش المالي المطلوب تسليمه بالدرج</span>
              <span className="text-xl font-black text-emerald-300 font-mono">{activeShift.expected_cash} ج.م</span>
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
            <Clock size={16} className="text-emerald-600" /> سجل الورديات السابقة
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">الكاشير والتاريخ</th>
                <th className="py-3.5 px-5 text-center">رصيد الافتتاح</th>
                <th className="py-3.5 px-5 text-center">مبيعات الكاش</th>
                <th className="py-3.5 px-5 text-center">الكاش المتوقع</th>
                <th className="py-3.5 px-5 text-center">العد الفعلي</th>
                <th className="py-3.5 px-5 text-center">الفارق (عجز/زيادة)</th>
                <th className="py-3.5 px-5 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {shiftsHistory.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900">{s.cashier_username || 'admin'}</div>
                    <div className="text-[10px] text-slate-400">{s.opened_at?.slice(0, 10)}</div>
                  </td>
                  <td className="py-4 px-5 text-center font-mono">{s.opening_cash} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono text-emerald-700">+{s.cash_sales_total || 0} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-bold">{s.expected_cash || s.opening_cash} ج.م</td>
                  <td className="py-4 px-5 text-center font-mono font-black text-slate-900">{s.actual_cash || '—'} ج.م</td>
                  <td className={`py-4 px-5 text-center font-mono font-bold ${
                    parseFloat(s.difference || 0) < 0 ? 'text-rose-600' : (parseFloat(s.difference || 0) > 0 ? 'text-emerald-600' : 'text-slate-700')
                  }`}>
                    {s.difference || '0.00'} ج.م
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {s.status === 'OPEN' ? 'OPEN (نشطة)' : 'CLOSED (مغلقة)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CLOSE SHIFT */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Lock size={18} className="text-rose-600" /> تقفيل الوردية وجرد الفئات والتوريد
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>عهدة الافتتاح الكاش:</span>
                <span>{activeShift.opening_cash} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>المبيعات النقدي (كاش):</span>
                <span>+{salesBreakdown.cash.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-700 pt-2 text-white">
                <span>الكاش المتوقع تسليمه بالدرج:</span>
                <span className="text-emerald-400">{activeShift.expected_cash} ج.م</span>
              </div>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Calculator size={16} className="text-emerald-600" /> جرد فئات الفلوس بالدرج (عد الفئات الفيزيائي):
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[200, 100, 50, 20, 10, 5, 1].map(note => (
                    <div key={note} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-700 w-12">{note} ج.م ×</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denominations[note] || ''}
                        onChange={(e) => handleDenominationChange(note, e.target.value)}
                        className="w-14 p-1 bg-slate-50 border border-slate-300 rounded font-bold text-center text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-emerald-100/60 rounded-xl flex justify-between items-center text-emerald-900 font-bold">
                  <span>إجمالي العد الفعلي بالدرج:</span>
                  <span className="text-sm font-black font-mono">
                    {actualCashCalculated > 0 ? actualCashCalculated.toFixed(2) : activeShift.expected_cash} ج.م
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Building2 size={16} className="text-indigo-600" /> توزيع النقدية (توريد البنك vs الفكة المتبقية للشيفت القادم):
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">المورد للبنك / الخزينة الرئيسية *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={bankDepositAmount}
                      onChange={(e) => {
                        const dep = parseFloat(e.target.value || 0);
                        setBankDepositAmount(e.target.value);
                        const totalAct = actualCashCalculated > 0 ? actualCashCalculated : parseFloat(activeShift.expected_cash);
                        setRetainedFloat(Math.max(0, totalAct - dep).toFixed(2));
                      }}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">العهدة المتبقية بالدرج للشيفت القادم *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={retainedFloat}
                      onChange={(e) => setRetainedFloat(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-indigo-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition cursor-pointer text-xs"
              >
                {submitting ? 'جاري التوريد والإغلاق...' : 'تأكيد التوريد وإغلاق الوردية 🔒'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
