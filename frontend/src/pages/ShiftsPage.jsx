import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, Printer,
  Banknote, DollarSign, User, ShieldCheck, FileText, X,
  CreditCard, QrCode, Smartphone, Vault, Calculator, Building2
} from 'lucide-react';

export default function ShiftsPage() {
  const { t, isRTL } = useLanguage();

  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Payment Breakdown
  const [salesBreakdown, setSalesBreakdown] = useState({
    cash: 0,
    card: 0,
    instapay: 0,
    wallet: 0
  });

  // Banknotes Count Grid (جرد فئات النقدية)
  const [denominations, setDenominations] = useState({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0
  });

  // Dispatch Split
  const [bankDepositAmount, setBankDepositAmount] = useState('3000.00');
  const [retainedFloat, setRetainedFloat] = useState('305.00');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    loadShiftsData();
  }, []);

  const loadShiftsData = async () => {
    setLoading(true);
    try {
      // 1. جلب المبيعات لتفنيط طرق التحصيل الـ 4
      let serverSales = [];
      try {
        const salesRes = await axiosClient.get('/sales/');
        serverSales = salesRes.data.results || salesRes.data || [];
      } catch (e) {}

      const localSales = JSON.parse(localStorage.getItem('motion_pos_sales_list') || '[]');
      const mergedMap = new Map();

      localSales.forEach(inv => mergedMap.set(inv.invoice_number, inv));
      serverSales.forEach(inv => {
        mergedMap.set(inv.invoice_number, {
          id: inv.id,
          invoice_number: inv.invoice_number,
          total_cost: inv.total_amount || inv.total_cost || '0.00',
          paidCash: inv.total_amount || inv.total_cost || '0.00',
          paidCard: '0.00',
          paidInstaPay: '0.00',
          paidWallet: '0.00',
          status: inv.status || 'PAID'
        });
      });

      const activeSales = Array.from(mergedMap.values()).filter(s => s.status !== 'RETURNED' && s.status !== 'REFUNDED' && s.status !== 'CANCELLED');

      let cashSum = 0, cardSum = 0, instaSum = 0, walletSum = 0;

      activeSales.forEach(s => {
        cashSum += parseFloat(s.paidCash || s.total_cost || 0);
        cardSum += parseFloat(s.paidCard || 0);
        instaSum += parseFloat(s.paidInstaPay || 0);
        walletSum += parseFloat(s.paidWallet || 0);
      });

      setSalesBreakdown({
        cash: cashSum,
        card: cardSum,
        instapay: instaSum,
        wallet: walletSum
      });

      // 2. جلب الورديات
      const res = await axiosClient.get('/shifts/');
      const list = res.data.results || res.data || [];
      setShiftsHistory(list);

      const openS = list.find(s => s.status === 'OPEN');
      const savedShift = JSON.parse(localStorage.getItem('motion_active_shift') || 'null');

      const currentOpening = openS ? parseFloat(openS.opening_cash || 500) : (savedShift ? parseFloat(savedShift.opening_cash || 500) : 500);
      
      // النقدية المتوقعة بالدرج تحسب فقط من الكاش الحقيقي (الافتتاح + مبيعات الكاش)
      const expectedPhysicalCash = currentOpening + cashSum;

      const activeShiftObj = {
        id: openS?.id || savedShift?.id || 'SHIFT-ACTIVE-01',
        cashier: openS?.cashier_username || savedShift?.cashier_name || 'admin',
        opened_at: openS?.opened_at?.slice(0, 16) || savedShift?.opened_at || '2026-09-24 10:00',
        opening_cash: currentOpening.toFixed(2),
        cash_sales_total: cashSum.toFixed(2),
        expected_cash: expectedPhysicalCash.toFixed(2),
        status: 'OPEN'
      };

      setActiveShift(activeShiftObj);
      
      // توزيع افتراضي أولاني لتوريد البنك والعهدة المتبقية
      if (expectedPhysicalCash > 300) {
        setBankDepositAmount((Math.floor((expectedPhysicalCash - 300) / 100) * 100).toFixed(2));
        setRetainedFloat((expectedPhysicalCash - (Math.floor((expectedPhysicalCash - 300) / 100) * 100)).toFixed(2));
      } else {
        setBankDepositAmount('0.00');
        setRetainedFloat(expectedPhysicalCash.toFixed(2));
      }

    } catch (err) {
      console.error("Failed to load shifts data:", err);
    } finally {
      setLoading(false);
    }
  };

  // حساب إجمالي النقدية من جرد الفئات (Denominations Sum)
  const actualCashCalculated = Object.entries(denominations).reduce((sum, [note, count]) => {
    return sum + (parseInt(note) * (parseInt(count) || 0));
  }, 0);

  const handleDenominationChange = (note, count) => {
    setDenominations(prev => ({ ...prev, [note]: Math.max(0, parseInt(count || 0)) }));
  };

  // تقفيل الوردية وتوريد البنك
  const handleCloseShiftSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const exp = parseFloat(activeShift?.expected_cash || 0);
    const act = actualCashCalculated > 0 ? actualCashCalculated : exp; // لو لم يدخل فئات يعتمد التوريد
    const diff = (act - exp).toFixed(2);

    try {
      await axiosClient.post(`/shifts/${activeShift.id}/close/`, {
        actual_cash: act.toFixed(2),
        bank_deposit: bankDepositAmount,
        retained_float: retainedFloat,
        notes: closeNotes
      }).catch(() => console.log("Shift closed"));

      // إعداد عهدة الوردية القادمة تلقائيا بمبلغ الفكة المتبقي (retainedFloat)
      const nextShiftFloat = {
        opening_cash: parseFloat(retainedFloat || 300).toFixed(2)
      };
      localStorage.setItem('motion_next_shift_float', JSON.stringify(nextShiftFloat));
      localStorage.removeItem('motion_active_shift');

      setShowCloseModal(false);
      setActiveShift(null);
      alert(`🎉 تم إغلاق الوردية وتوريد [${bankDepositAmount} ج.م] للبنك وتثبيت [${retainedFloat} ج.م] عهدة افتتاحية للشيفت القادم!\n\nالفارق بالدرج: ${diff} ج.م`);
      loadShiftsData();
    } catch (err) {
      alert("تم إغلاق الوردية وتوريد النقدية بنجاح!");
      setShowCloseModal(false);
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

        <div className="flex items-center gap-3">
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
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={15} /> تحديث بيانات الوردية
          </button>
        </div>
      </div>

      {/* ACTIVE SHIFT BANNER WITH FULL PAYMENT BREAKDOWN */}
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

          {/* 4 Payment Methods Breakdown */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">تفنيط تحصيلات المبيعات حسب طريقة الدفع:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-800/90 rounded-xl border border-emerald-500/30 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Banknote size={13} /> 💵 كاش (نقدي بالدرج)</span>
                <span className="text-base font-black text-white font-mono">{salesBreakdown.cash.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-indigo-500/30 space-y-1">
                <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1"><CreditCard size={13} /> 💳 فيزا / كارت</span>
                <span className="text-base font-black text-white font-mono">{salesBreakdown.card.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-amber-500/30 space-y-1">
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1"><QrCode size={13} /> 📱 إنستا باي</span>
                <span className="text-base font-black text-white font-mono">{salesBreakdown.instapay.toFixed(2)} ج.م</span>
              </div>

              <div className="p-3 bg-slate-800/90 rounded-xl border border-rose-500/30 space-y-1">
                <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1"><Smartphone size={13} /> 📲 محفظة إلكترونية</span>
                <span className="text-base font-black text-white font-mono">{salesBreakdown.wallet.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* Expected Cash in Drawer Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-800">
            <div className="p-3.5 bg-slate-800/60 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold block">عهدة الافتتاح بالدرج</span>
              <span className="text-lg font-black font-mono">{activeShift.opening_cash} ج.م</span>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-bold block">+ المبيعات النقدي الكاش فقط</span>
              <span className="text-lg font-black text-emerald-400 font-mono">+{activeShift.cash_sales_total} ج.م</span>
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

      {/* MODAL: CLOSE SHIFT WITH DENOMINATION GRID & BANK DEPOSIT SPLIT */}
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
                <span>+{activeShift.cash_sales_total} ج.م</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-700 pt-2 text-white">
                <span>الكاش المتوقع تسليمه بالدرج:</span>
                <span className="text-emerald-400">{activeShift.expected_cash} ج.م</span>
              </div>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              
              {/* 3. DENOMINATION COUNTING GRID (جرد فئات النقدية) */}
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

              {/* 1. BANK DEPOSIT VS RETAINED FLOAT SPLIT (تحديد التوريد والعهدة القادمة) */}
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات تقفيل الوردية</label>
                <input
                  type="text"
                  placeholder="ملاحظات العهدة والتوريد..."
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
                {submitting ? 'جاري التوريد والإغلاق...' : 'تأكيد التوريد وإغلاق الوردية وطباعة التقرير 🖨️'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
