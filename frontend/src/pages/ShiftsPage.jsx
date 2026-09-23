import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Printer, 
  User, 
  X,
  RotateCcw
} from 'lucide-react';

export default function ShiftsPage() {
  const { t, isRTL } = useLanguage();

  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close Shift Modal States
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Slip Modal
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [selectedShiftForSlip, setSelectedShiftForSlip] = useState(null);

  useEffect(() => {
    loadShiftsData();
  }, []);

  const loadShiftsData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/shifts/');
      const allShifts = res.data.results || res.data || [];
      setShifts(allShifts);

      const open = allShifts.find(s => s.status === 'OPEN');
      setActiveShift(open || null);
      if (open) {
        const exp = (parseFloat(open.opening_cash || 0) + parseFloat(open.cash_sales_total || 0)).toFixed(2);
        setActualCash(exp);
      }
    } catch (err) {
      console.error("Failed to load shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!activeShift) return;
    setSubmitting(true);
    try {
      await axiosClient.post(`/shifts/${activeShift.id}/close/`, {
        actual_cash: parseFloat(actualCash).toFixed(2),
        notes: closingNotes
      });
      alert(`Shift #${activeShift.shift_code} closed successfully.`);
      setShowCloseModal(false);
      loadShiftsData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to close shift.");
    } finally {
      setSubmitting(false);
    }
  };

  const expectedTotal = activeShift 
    ? (parseFloat(activeShift.opening_cash || 0) + parseFloat(activeShift.cash_sales_total || 0))
    : 0;
  const counted = parseFloat(actualCash) || 0;
  const discrepancy = counted - expectedTotal;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('shifts.title')}</h2>
          <p className="text-sm text-slate-500">{t('shifts.subtitle')}</p>
        </div>

        {activeShift && (
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
          >
            <Lock size={15} /> {t('shifts.closeShift')}
          </button>
        )}
      </div>

      {/* Active Shift Banner */}
      {activeShift ? (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xs border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> {t('shifts.activeBanner')}
            </span>
            <h3 className="text-lg font-bold">#{activeShift.shift_code}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <User size={12} /> {t('shifts.colCashier')}: {activeShift.cashier_username || 'Lead Cashier'}
            </p>
          </div>

          <div className={`space-y-1 ${isRTL ? 'border-r pr-6' : 'border-l pl-6'} border-slate-800`}>
            <span className="text-xs text-slate-400">{t('shifts.openingFloat')}</span>
            <div className="text-xl font-black text-white">{parseFloat(activeShift.opening_cash || 0).toFixed(2)} {t('common.currency')}</div>
            <p className="text-[10px] text-slate-500">رصيد عهدة الدرج</p>
          </div>

          <div className={`space-y-1 ${isRTL ? 'border-r pr-6' : 'border-l pl-6'} border-slate-800`}>
            <span className="text-xs text-slate-400">{t('shifts.cashSales')}</span>
            <div className="text-xl font-black text-emerald-400">+{parseFloat(activeShift.cash_sales_total || 0).toFixed(2)} {t('common.currency')}</div>
            <p className="text-[10px] text-emerald-600">مبيعات الكاشير النقدية</p>
          </div>

          <div className={`space-y-1 ${isRTL ? 'border-r pr-6' : 'border-l pl-6'} border-slate-800`}>
            <span className="text-xs text-slate-400">{t('shifts.expectedCash')}</span>
            <div className="text-xl font-black text-indigo-400">{expectedTotal.toFixed(2)} {t('common.currency')}</div>
            <p className="text-[10px] text-indigo-400">الافتتاح + المبيعات</p>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-amber-600" />
            <div>
              <h4 className="font-bold text-sm">لا توجد وردية مفتوحة حالياً</h4>
              <p className="text-xs text-amber-700">قم بفتح وردية كاشير جديدة من شاشة نقطة البيع لبدء تسجيل عمليات البيع.</p>
            </div>
          </div>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">{t('shifts.shiftRecords')}</span>
          </div>

          <button onClick={loadShiftsData} className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg cursor-pointer">
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">{t('shifts.colCode')}</th>
                <th className="py-3.5 px-5">{t('shifts.colCashier')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('shifts.openingFloat')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('shifts.cashSales')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('shifts.expectedCash')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('shifts.colActual')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('shifts.colDiff')}</th>
                <th className="py-3.5 px-5 text-center">{t('common.status')}</th>
                <th className="py-3.5 px-5 text-center">{t('common.print')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {shifts.map((s) => {
                const diff = parseFloat(s.difference || 0);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-sm">{s.shift_code}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{s.opened_at?.substring(0, 16).replace('T', ' ')}</div>
                    </td>
                    <td className="py-4 px-5 font-semibold text-slate-700">{s.cashier_username || 'Cashier'}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono`}>{parseFloat(s.opening_cash || 0).toFixed(2)} {t('common.currency')}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono text-emerald-700`}>+{parseFloat(s.cash_sales_total || 0).toFixed(2)} {t('common.currency')}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`}>{parseFloat(s.expected_cash || 0).toFixed(2)} {t('common.currency')}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`}>
                      {s.actual_cash ? `${parseFloat(s.actual_cash).toFixed(2)} ${t('common.currency')}` : '—'}
                    </td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono font-extrabold ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                      {s.actual_cash ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${t('common.currency')}` : '—'}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        s.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'CLOSED'
                          ? 'bg-slate-100 text-slate-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <button
                        onClick={() => { setSelectedShiftForSlip(s); setShowSlipModal(true); }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title={t('common.print')}
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {shifts.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-slate-400 text-xs font-bold">
                    لا توجد سجلات ورديات مسجلة بالصندوق.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Close Shift */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">{t('shifts.closeShift')} #{activeShift.shift_code}</h3>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>{t('shifts.openingFloat')}:</span>
                <span className="font-bold text-slate-900">{parseFloat(activeShift.opening_cash || 0).toFixed(2)} {t('common.currency')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>{t('shifts.cashSales')}:</span>
                <span className="font-bold text-emerald-700">+{parseFloat(activeShift.cash_sales_total || 0).toFixed(2)} {t('common.currency')}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                <span>{t('shifts.expectedCash')}:</span>
                <span>{expectedTotal.toFixed(2)} {t('common.currency')}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('shifts.colActual')} (ج.م) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className={`p-3 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 ${
                Math.abs(discrepancy) <= 0.001
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : discrepancy > 0
                  ? 'bg-blue-50 border-blue-100 text-blue-800'
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {Math.abs(discrepancy) <= 0.001 ? (
                  <> <CheckCircle2 size={16} /> {t('shifts.discrepancyExact')} </>
                ) : (
                  <> <AlertTriangle size={16} /> {discrepancy < 0 ? t('shifts.discrepancyShortage') : t('shifts.discrepancySurplus')}: {discrepancy >= 0 ? '+' : ''}{discrepancy.toFixed(2)} {t('common.currency')} </>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">سبب الفارق / ملاحظات الإغلاق</label>
                <textarea
                  rows="2"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  placeholder="ملاحظات عد الخزينة والعهدة..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer text-xs"
              >
                {submitting ? t('common.loading') : t('shifts.closeShift')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Thermal Slip Preview */}
      {showSlipModal && selectedShiftForSlip && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Printer size={16} className="text-emerald-600" /> إيصال تسليم الوردية (80mm)
              </span>
              <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="bg-slate-100 p-4 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {[
                "========================================",
                "         تقرير تسليم الوردية           ",
                "رقم الوردية: #" + selectedShiftForSlip.shift_code,
                "الكاشير:    " + (selectedShiftForSlip.cashier_username || 'الكاشير'),
                "تاريخ الفتح: " + (selectedShiftForSlip.opened_at?.substring(0, 16).replace('T', ' ') || ''),
                "----------------------------------------",
                "رصيد الافتتاح:            " + parseFloat(selectedShiftForSlip.opening_cash || 0).toFixed(2) + " ج.م",
                "مبيعات النقدية:           " + parseFloat(selectedShiftForShiftSales(selectedShiftForSlip)).toFixed(2) + " ج.م",
                "----------------------------------------",
                "النقدية المتوقعة بالدرج:  " + parseFloat(selectedShiftForSlip.expected_cash || 0).toFixed(2) + " ج.م",
                "النقدية الفعلية المعدودة: " + parseFloat(selectedShiftForSlip.actual_cash || 0).toFixed(2) + " ج.م",
                "========================================",
                "الفارق (عجز/زيادة):        " + parseFloat(selectedShiftForSlip.difference || 0).toFixed(2) + " ج.م",
                "الحالة:                   " + selectedShiftForSlip.status,
                "========================================"
              ].join(String.fromCharCode(10))}
            </div>

            <button
              onClick={() => window.print()}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <Printer size={15} /> طباعة إيصال الوردية
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function selectedShiftForShiftSales(s) {
    return s.cash_sales_total || 0;
  }
}
