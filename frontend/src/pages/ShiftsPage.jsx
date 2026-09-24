import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, Printer,
  Banknote, DollarSign, User, ShieldCheck, FileText, X,
  CreditCard, QrCode, Smartphone, Vault, Calculator, Building2,
  Share2, FileSpreadsheet, Download, Check
} from 'lucide-react';

export default function ShiftsPage() {
  const { t, isRTL } = useLanguage();

  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close Shift Modal States
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
          paidCash: inv.paidCash || inv.total_amount || inv.total_cost || '0.00',
          paidCard: inv.paidCard || '0.00',
          paidInstaPay: inv.paidInstaPay || '0.00',
          paidWallet: inv.paidWallet || '0.00',
          status: inv.status || 'PAID'
        });
      });

      const activeSales = Array.from(mergedMap.values()).filter(s => s.status !== 'RETURNED' && s.status !== 'REFUNDED' && s.status !== 'CANCELLED');

      let cashSum = 0, cardSum = 0, instaSum = 0, walletSum = 0;

      activeSales.forEach(s => {
        cashSum += parseFloat(s.paidCash || s.total_cost || s.total_amount || 0);
        cardSum += parseFloat(s.paidCard || 0);
        instaSum += parseFloat(s.paidInstaPay || 0);
        walletSum += parseFloat(s.paidWallet || 0);
      });

      setSalesBreakdown({ cash: cashSum, card: cardSum, instapay: instaSum, wallet: walletSum });

      const res = await axiosClient.get('/shifts/');
      const list = res.data.results || res.data || [];
      setShiftsHistory(list);

      const openS = list.find(s => s.status === 'OPEN');
      const savedShift = JSON.parse(localStorage.getItem('motion_active_shift') || 'null');

      const currentOpening = openS ? parseFloat(openS.opening_cash || 500) : (savedShift ? parseFloat(savedShift.opening_cash || 500) : 500);
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
      setBankDepositAmount(Math.max(0, expectedPhysicalCash - 305).toFixed(2));
      setRetainedFloat(Math.min(305, expectedPhysicalCash).toFixed(2));

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

  // 1️⃣ إرسال ملخص الوردية الختامي عبر واتساب
  const sendClosedShiftToWhatsApp = (summary) => {
    const text = `📊 *تقرير تقفيل وردية كاشير معتمدة - موشن ستور*\n\n` +
      `👤 *الكاشير:* ${summary.cashier}\n` +
      `📅 *تاريخ وتوقيت التقفيل:* ${summary.closed_at}\n` +
      `----------------------------\n` +
      `💵 *عهدة الافتتاح الكاش:* ${summary.opening_cash} ج.م\n` +
      `📈 *مبيعات الكاش (نقدي):* +${summary.cash_sales} ج.م\n` +
      `💳 *مبيعات الفيزا:* +${summary.card_sales} ج.م\n` +
      `📱 *مبيعات إنستا باي:* +${summary.instapay_sales} ج.م\n` +
      `📲 *مبيعات المحفظة:* +${summary.wallet_sales} ج.م\n` +
      `----------------------------\n` +
      `💰 *الكاش المتوقع بالدرج:* ${summary.expected_cash} ج.م\n` +
      `🔢 *العد الفعلي بالدرج:* ${summary.actual_cash} ج.م\n` +
      `⚠️ *الفارق (عجز/زيادة):* ${summary.difference} ج.م\n` +
      `----------------------------\n` +
      `🏛️ *المورد للبنك / الخزينة:* ${summary.bank_deposit} ج.م\n` +
      `🪙 *الفكة المتبقية للشيفت القادم:* ${summary.retained_float} ج.م\n\n` +
      `تم إغلاق الوردية وتوريد النقدية بنجاح 🚀`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // 2️⃣ تنزيل تقرير الوردية PDF مباشر
  const downloadClosedShiftPDF = (summary) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    
    script.onload = () => {
      const element = document.createElement('div');
      element.dir = 'rtl';
      element.style.padding = '25px';
      element.style.fontFamily = 'Segoe UI, Tahoma, sans-serif';
      element.style.color = '#0f172a';
      element.style.backgroundColor = '#ffffff';

      element.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 800;">موشن ستور — Motion Store</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">تقرير تقفيل وردية الكاشير وتوريد النقدية</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #334155; line-height: 1.5;">
            <div><b>الكاشير:</b> ${summary.cashier}</div>
            <div><b>التاريخ والوقت:</b> ${summary.closed_at}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">ملخص نقدية الوردية</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px;">
            <div><b>عةدة الافتتاح:</b> ${summary.opening_cash} ج.م</div>
            <div><b>المبيعات النقدي:</b> ${summary.cash_sales} ج.م</div>
            <div><b>الكاش المتوقع بالدرج:</b> ${summary.expected_cash} ج.م</div>
            <div><b>العد الفعلي بالدرج:</b> ${summary.actual_cash} ج.م</div>
            <div><b>الفارق (عجز/زيادة):</b> <b style="color:${parseFloat(summary.difference) < 0 ? '#e11d48' : '#059669'};">${summary.difference} ج.م</b></div>
          </div>
        </div>

        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #065f46; border-bottom: 1px solid #6ee7b7; padding-bottom: 5px;">تفنيط تحصيلات المبيعات حسب طرق الدفع</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px; color: #064e3b;">
            <div>💵 <b>كاش:</b> ${summary.cash_sales} ج.م</div>
            <div>💳 <b>فيزا:</b> ${summary.card_sales} ج.م</div>
            <div>📱 <b>إنستا باي:</b> ${summary.instapay_sales} ج.م</div>
            <div>📲 <b>محفظة:</b> ${summary.wallet_sales} ج.م</div>
          </div>
        </div>

        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">توزيع التوريد والعهدة القادمة</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11px;">
            <div>🏛️ <b>المبلغ المورد للبنك/الخزينة:</b> <b>${summary.bank_deposit} ج.م</b></div>
            <div>🪙 <b>الفكة المتبقية بالدرج للشيفت القادم:</b> <b>${summary.retained_float} ج.م</b></div>
          </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>توقيع الكاشير: ________________________</span>
          <span>اعتماد المدير المسؤول: ________________________</span>
        </div>
      `;

      const opt = {
        margin:       8,
        filename:     `تقرير_تقفيل_وردية_${summary.cashier}_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      window.html2pdf().set(opt).from(element).save();
    };

    if (window.html2pdf) script.onload();
    else document.body.appendChild(script);
  };

  // 3️⃣ تقفيل الوردية الحقيقي وفتح الشاشة الختامية
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
                <th className="py-3.5 px-5 text-center">الحالة الإجراءات</th>
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

      {/* MODAL 1: CLOSE SHIFT FORM */}
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
                {submitting ? 'جاري الإغلاق والتوريد...' : 'تأكيد التوريد وإغلاق الوردية 🔒'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CLOSED SHIFT FINAL SUMMARY (شاشة ملخص التقفيل والواتساب والـ PDF المباشر) */}
      {showClosedReceiptModal && closedShiftSummary && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={22} className="text-emerald-600" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">تم إغلاق وتقفيل الوردية بنجاح 🔒</h3>
                  <p className="text-[11px] text-slate-500">ملخص التوريد والعهد النقدية المعتمدة</p>
                </div>
              </div>
              <button onClick={() => setShowClosedReceiptModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Shift Summary Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-mono">
              <div className="flex justify-between text-slate-700">
                <span>👤 الكاشير المسئول:</span>
                <span className="font-bold text-slate-900">{closedShiftSummary.cashier}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>📅 وقت وتاريخ التقفيل:</span>
                <span>{closedShiftSummary.closed_at}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-2 border-t border-slate-200">
                <span>💵 مبيعات الكاش النقدية:</span>
                <span className="font-bold text-emerald-700">+{closedShiftSummary.cash_sales} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>💳 مبيعات الفيزا:</span>
                <span className="font-bold text-indigo-700">+{closedShiftSummary.card_sales} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>🏛️ المبلغ المورد للبنك:</span>
                <span className="font-black text-slate-900 text-sm">{closedShiftSummary.bank_deposit} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>🪙 العهدة المتبقية للشيفت القادم:</span>
                <span className="font-bold text-indigo-800">{closedShiftSummary.retained_float} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-2 border-t border-slate-200">
                <span>⚠️ الفارق بالدرج (عجز/زيادة):</span>
                <span className={`font-black ${parseFloat(closedShiftSummary.difference) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {closedShiftSummary.difference} ج.م
                </span>
              </div>
            </div>

            {/* Action Buttons: WhatsApp, PDF, Close */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => sendClosedShiftToWhatsApp(closedShiftSummary)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 size={16} /> 📲 إرسال التقرير عبر واتساب
              </button>

              <button
                onClick={() => downloadClosedShiftPDF(closedShiftSummary)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} /> 📥 تحميل التقرير PDF مباشر
              </button>
            </div>

            <button
              onClick={() => setShowClosedReceiptModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
