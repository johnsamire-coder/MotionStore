import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { RotateCcw, Search, Save, CheckCircle2, FileText } from 'lucide-react';

export default function ReturnsPage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('استرجاع رغبة العميل');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/sales/');
      setInvoices(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const inv = invoices.find(i => i.invoice_number.toLowerCase().includes(searchInvoice.toLowerCase()));
    if (inv) {
      setSelectedInvoice(inv);
    } else {
      alert('لم يتم العثور على فاتورة بهذا الرقم');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <RotateCcw className="text-amber-600" />
            شاشة مرتجعات المبيعات (F10)
          </h1>
          <p className="text-xs text-slate-500 mt-1">استرجاع الفواتير ورد المبالغ وإعادة الأصناف للمخزون بدفتر الأستاذ</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
          <input
            type="text"
            placeholder="أدخل رقم الفاتورة للارتجاع (مثال: INV-...)"
            value={searchInvoice}
            onChange={e => setSearchInvoice(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-sm flex items-center gap-2 transition"
          >
            <Search size={16} />
            بحث
          </button>
        </form>

        {selectedInvoice && (
          <div className="mt-6 border-t pt-4 space-y-4">
            <div className="grid grid-cols-4 gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-xs">
              <div>
                <span className="text-slate-500 block">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoice_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block">التاريخ:</span>
                <span className="font-bold text-slate-900">{new Date(selectedInvoice.invoice_date_time).toLocaleString('ar-EG')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">الكاشير:</span>
                <span className="font-bold text-slate-900">{selectedInvoice.cashier_username}</span>
              </div>
              <div>
                <span className="text-slate-500 block">إجمالي الفاتورة:</span>
                <span className="font-black text-amber-900">{parseFloat(selectedInvoice.total_amount).toFixed(2)} ج.م</span>
              </div>
            </div>

            <h3 className="font-black text-xs text-slate-700">بنود الفاتورة المتاحة للارتجاع:</h3>
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 font-black">
                <tr>
                  <th className="p-2.5">الصنف</th>
                  <th className="p-2.5">الدرجة</th>
                  <th className="p-2.5">الوزن/الكمية المباعة</th>
                  <th className="p-2.5">السعر</th>
                  <th className="p-2.5 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedInvoice.lines?.map(l => (
                  <tr key={l.id}>
                    <td className="p-2.5 font-bold">{l.product_name}</td>
                    <td className="p-2.5">{l.grade}</td>
                    <td className="p-2.5 font-mono">{l.weight_kg} كجم</td>
                    <td className="p-2.5">{l.unit_price}</td>
                    <td className="p-2.5 text-left font-black">{l.total_price} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
