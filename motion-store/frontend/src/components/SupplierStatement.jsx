import React, { useState, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from './ExportButtons';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtW = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

const TXT = {
  ar: {
    title: 'كشف الموردين', close: 'إغلاق', search: 'ابحث بالاسم، التليفون، الكود، العنوان...', results: 'عدد الموردين',
    name: 'المورد', phone: 'التليفون', count: 'عدد الفواتير', weight: 'إجمالي الوزن (كجم)', total: 'إجمالي المشتريات', last: 'آخر فاتورة',
    grand: 'الإجمالي', noData: 'مفيش موردين مطابقين للبحث', noInv: 'مفيش فواتير للمورد ده',
    invNo: 'رقم الفاتورة', date: 'التاريخ', details: 'التفاصيل', freight: 'النقل', invTotal: 'الإجمالي', cur: 'ج.م',
    reportTitle: 'كشف الموردين'
  },
  en: {
    title: 'Suppliers Statement', close: 'Close', search: 'Search by name, phone, code, address...', results: 'Suppliers',
    name: 'Supplier', phone: 'Phone', count: 'Invoices', weight: 'Total Weight (KG)', total: 'Total Purchases', last: 'Last Invoice',
    grand: 'Total', noData: 'No suppliers match the search', noInv: 'No invoices for this supplier',
    invNo: 'Invoice #', date: 'Date', details: 'Details', freight: 'Freight', invTotal: 'Total', cur: 'EGP',
    reportTitle: 'Suppliers Statement'
  }
};

export default function SupplierStatement({ suppliers = [], invoices = [], onClose }) {
  const { lang, isRTL } = useLanguage();
  const T = TXT[lang] || TXT.ar;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const stats = useMemo(() => suppliers.map((s) => {
    const invs = invoices
      .filter((i) => i.supplier === s.id)
      .sort((a, b) => String(b.invoice_date || '').localeCompare(String(a.invoice_date || '')));
    const total = invs.reduce((a, i) => a + parseFloat(i.total_cost || i.total_amount || 0), 0);
    const weight = invs.reduce((a, i) => a + (i.items || []).reduce((b, it) => b + parseFloat(it.weight_kg || 0), 0), 0);
    return { ...s, invs, count: invs.length, total, weight, last: invs[0]?.invoice_date || '' };
  }), [suppliers, invoices]);

  const term = q.trim().toLowerCase();
  const rows = !term ? stats : stats.filter((s) => [s.name, s.phone, s.code, s.email, s.address, s.notes].filter(Boolean).join(' ').toLowerCase().includes(term));
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

  const buildReport = () => ({
    title: T.reportTitle,
    filename: 'suppliers-statement',
    filtersText: q,
    columns: [
      { key: 'name', header: T.name, width: 28 },
      { key: 'phone', header: T.phone, width: 16 },
      { key: 'count', header: T.count, type: 'number' },
      { key: 'weight', header: T.weight, type: 'number' },
      { key: 'total', header: T.total, type: 'money' },
      { key: 'last', header: T.last, width: 14 }
    ],
    rows: rows.map((r) => ({ name: r.name, phone: r.phone || '—', count: r.count, weight: r.weight, total: r.total, last: r.last || '—' })),
    totals: { count: sum('count'), weight: sum('weight'), total: sum('total') }
  });

  return (
    <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-slate-50 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users size={18} className="text-emerald-700" /> {T.title}
          </div>
          <button type="button" onClick={onClose} aria-label={T.close} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 12 } : { left: 12 }} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={T.search}
                className="w-full h-10 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500"
                style={isRTL ? { paddingRight: 36, paddingLeft: 12 } : { paddingLeft: 36, paddingRight: 12 }}
              />
            </div>
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{T.results}: {rows.length}</div>
            <ExportButtons getReport={buildReport} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-start">{T.name}</th>
                  <th className="p-2 text-start">{T.phone}</th>
                  <th className="p-2 text-center">{T.count}</th>
                  <th className="p-2 text-center">{T.weight}</th>
                  <th className="p-2 text-center">{T.total}</th>
                  <th className="p-2 text-center">{T.last}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-slate-500 text-center">{T.noData}</td></tr>
                )}
                {rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setOpen(open === r.id ? null : r.id)} className={`border-b border-slate-100 cursor-pointer hover:bg-emerald-50 ${open === r.id ? 'bg-emerald-50' : ''}`}>
                      <td className="p-2 text-slate-500">{open === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      <td className="p-2 font-bold text-slate-900">{r.name}</td>
                      <td className="p-2">{r.phone || '—'}</td>
                      <td className="p-2 text-center">{r.count}</td>
                      <td className="p-2 text-center">{fmtW(r.weight)}</td>
                      <td className="p-2 text-center font-bold text-emerald-800">{fmt(r.total)} {T.cur}</td>
                      <td className="p-2 text-center">{r.last || '—'}</td>
                    </tr>
                    {open === r.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="p-3">
                          {r.invs.length === 0 ? (
                            <div className="text-slate-500">{T.noInv}</div>
                          ) : (
                            <table className="w-full text-xs bg-white border border-slate-200 rounded-lg">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="p-2 text-start">{T.invNo}</th>
                                  <th className="p-2 text-start">{T.date}</th>
                                  <th className="p-2 text-start">{T.details}</th>
                                  <th className="p-2 text-center">{T.freight}</th>
                                  <th className="p-2 text-center">{T.invTotal}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.invs.map((inv) => (
                                  <tr key={inv.id} className="border-t border-slate-100">
                                    <td className="p-2 font-mono">{inv.invoice_number}</td>
                                    <td className="p-2">{inv.invoice_date}</td>
                                    <td className="p-2">{(inv.items || []).map((it) => it.description).filter(Boolean).join(' | ') || '—'}</td>
                                    <td className="p-2 text-center">{fmt(inv.additional_costs)}</td>
                                    <td className="p-2 text-center font-bold">{fmt(inv.total_cost || inv.total_amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-emerald-50 font-bold">
                    <td className="p-2"></td>
                    <td className="p-2" colSpan={2}>{T.grand}</td>
                    <td className="p-2 text-center">{sum('count')}</td>
                    <td className="p-2 text-center">{fmtW(sum('weight'))}</td>
                    <td className="p-2 text-center text-emerald-800">{fmt(sum('total'))} {T.cur}</td>
                    <td className="p-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}