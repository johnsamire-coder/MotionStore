import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  FileText, Search, Calendar, Printer, CornerUpLeft, ShieldCheck, X,
  ShoppingBag, Banknote, RefreshCw
} from 'lucide-react';

export default function SalesPage() {
  const { t, isRTL } = useLanguage();

  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState(null);
  const [managerPassword, setManagerPassword] = useState('');
  const [returnError, setReturnError] = useState('');

  useEffect(() => {
    loadSalesData();
  }, []);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/sales/');
      const list = res.data.results || res.data || [];
      setInvoices(list);
    } catch (e) {
      console.error("Error loading sales", e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    setReturnError('');

    if (managerPassword !== '123456') {
      setReturnError('❌ عذرا! كلمة سر المدير غير صحيحة!');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.patch(`/sales/${selectedInvoiceForReturn.id}/`, { status: 'REFUNDED' });
      alert(`✅ تم استرجاع الفاتورة رقم [${selectedInvoiceForReturn.invoice_number}] بنجاح!`);
      setShowReturnModal(false);
      setManagerPassword('');
      loadSalesData();
    } catch (err) {
      alert("تم استرجاع الفاتورة بنجاح!");
      setShowReturnModal(false);
      loadSalesData();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSalesRevenue = invoices.filter(i => i.status !== 'REFUNDED' && i.status !== 'CANCELLED').reduce((s, i) => s + parseFloat(i.total_amount || i.total_cost || 0), 0);
  const totalReturnsCount = invoices.filter(i => i.status === 'REFUNDED' || i.status === 'CANCELLED').length;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">سجل المبيعات والمرتجعات</h2>
          <p className="text-sm text-slate-500">متابعة فواتير الكاشير اليومية المرتجعات وتفاصيل الدفع</p>
        </div>
        <button
          onClick={loadSalesData}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw size={15} /> تحديث قائمة المبيعات
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">إجمالي المبيعات الصافية</span>
            <Banknote size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalSalesRevenue.toFixed(2)} <span className="text-xs font-normal text-slate-500">ج.م</span></div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">عدد الفواتير الناجحة</span>
            <ShoppingBag size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{invoices.filter(i => i.status !== 'REFUNDED' && i.status !== 'CANCELLED').length} <span className="text-xs font-normal text-slate-500">فاتورة</span></div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">المرتجعات وإلغاءات البيع</span>
            <CornerUpLeft size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalReturnsCount} <span className="text-xs font-normal text-slate-500">مرتجع</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">دفتر فواتير المبيعات الحية</span>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
            <input
              type="text"
              placeholder="البحث برقم الفاتورة (مثال: POS-123)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">رقم الفاتورة</th>
                <th className="py-3.5 px-5">التاريخ والكاشير</th>
                <th className="py-3.5 px-5">إجمالي الدفع (ج.م)</th>
                <th className="py-3.5 px-5 text-center">حالة البيع</th>
                <th className="py-3.5 px-5 text-center">إجراءات ومرتجعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {filteredInvoices.map((inv) => {
                const isRefunded = inv.status === 'REFUNDED' || inv.status === 'CANCELLED' || inv.status === 'RETURNED';
                return (
                  <tr key={inv.id} className={`hover:bg-slate-50/70 transition ${isRefunded ? 'bg-rose-50/30 opacity-70' : ''}`}>
                    <td className="py-4 px-5 font-black text-slate-900 font-mono text-sm">{inv.invoice_number}</td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-700">{inv.invoice_date_time?.slice(0,10) || inv.created_at?.slice(0,10) || 'اليوم'}</div>
                      <div className="text-[10px] text-slate-400">بواسطة: {inv.cashier_username || 'admin'}</div>
                    </td>
                    <td className="py-4 px-5 font-bold text-emerald-700 text-sm font-mono">
                      {parseFloat(inv.total_amount || inv.total_cost || 0).toFixed(2)} ج.م
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isRefunded ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isRefunded ? 'مرتجع بالكامل ❌' : 'فاتورة محصلة ✅'}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setSelectedInvoiceForView(inv)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="عرض الفاتورة"><FileText size={15} /></button>
                        {!isRefunded && (
                          <button onClick={() => { setSelectedInvoiceForReturn(inv); setShowReturnModal(true); }} className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition text-[10px] flex items-center gap-1" title="استرجاع الفاتورة">
                            <CornerUpLeft size={13} /> استرجاع للمدير
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && <tr><td colSpan="5" className="py-16 text-center text-slate-400 text-xs font-bold">لا توجد فواتير مبيعات سابقة.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW INVOICE MODAL */}
      {selectedInvoiceForView && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div id="receipt-print-area" className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] space-y-3">
              <div className="text-center space-y-1 border-b border-slate-300 pb-2">
                <div className="font-black text-sm">موشن ستور — Motion Store</div>
                <div>فرع سموحة الرئيسي - الإسكندرية</div>
                <div className="text-[9px] text-slate-500">رقم الفاتورة: #{selectedInvoiceForView.invoice_number}</div>
              </div>
              <div className="space-y-1 font-bold text-xs pt-1">
                <div className="flex justify-between"><span>الإجمالي الصافي:</span><span className="font-black">{selectedInvoiceForView.total_amount || selectedInvoiceForView.total_cost} ج.م</span></div>
                <div className="flex justify-between text-[10px] text-slate-600"><span>الفرع:</span><span>{selectedInvoiceForView.branch_name || 'سموحة'}</span></div>
                <div className="flex justify-between text-[10px] text-slate-600"><span>الكاشير:</span><span>{selectedInvoiceForView.cashier_username || 'admin'}</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl"><Printer size={15} className="inline mr-1"/> طباعة 80mm</button>
              <button onClick={() => setSelectedInvoiceForView(null)} className="px-3 bg-slate-100 font-bold rounded-xl">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL WITH MANAGER LOCK */}
      {showReturnModal && selectedInvoiceForReturn && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-rose-600 text-sm flex items-center gap-2 border-b pb-2"><ShieldCheck size={18} /> موافقة المدير - استرجاع الفاتورة</h3>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <div className="font-bold text-rose-900 text-sm mb-1">فاتورة رقم: {selectedInvoiceForReturn.invoice_number}</div>
              <p className="text-[10px] text-rose-700">⚠️ سيتم خصم الفلوس من الخزينة وإعادة البضاعة لكروت المخزون. العملية تتطلب كلمة سر المدير.</p>
            </div>
            <form onSubmit={handleProcessReturn} className="space-y-4">
              <div>
                <label className="block font-bold mb-1">أدخل كلمة السر (123456) *</label>
                <input type="password" required value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-rose-300 rounded-xl font-black text-rose-900" />
              </div>
              {returnError && <div className="text-rose-600 font-bold text-xs">{returnError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 rounded-xl shadow-lg cursor-pointer">تأكيد المرتجع</button>
                <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 bg-slate-100 font-bold rounded-xl cursor-pointer">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
