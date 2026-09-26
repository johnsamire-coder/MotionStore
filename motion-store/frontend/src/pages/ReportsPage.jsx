// REPORTS_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { FileSpreadsheet, Search } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const fmt = (v, type) => {
  if (v === null || v === undefined || v === '') return '—';
  if (type === 'money') return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'kg') return Number(v).toLocaleString('en-US', { maximumFractionDigits: 3 });
  if (type === 'pct') return `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
  if (type === 'number') return Number(v).toLocaleString('en-US');
  return String(v);
};
const TITLES = {
  dashboard: 'لوحة المؤشرات', sales_daily: 'المبيعات يوم بيوم', sales_by_cashier: 'حسب الكاشير', sales_by_terminal: 'حسب نقطة البيع', sales_by_method: 'حسب طريقة الدفع', sales_by_hour: 'حسب الساعة', sales_by_weekday: 'حسب أيام الأسبوع',
  sales_by_item: 'حسب الصنف', sales_by_grade: 'حسب الدرجة', sales_by_kind: 'حسب التصنيف', sales_by_segment: 'حسب النوع', sales_by_brand: 'حسب البراند', sales_by_mode: 'بالقطعة مقابل بالكيلو', top_items: 'الأكثر مبيعاً',
  discounts_approvals: 'الخصومات والموافقات', deferred_report: 'الفواتير المؤجلة', income_statement: 'قايمة الدخل (صافي الربح)', profit_by_item: 'ربح الصنف', profit_by_grade: 'ربح الدرجة', profit_by_cashier: 'ربح الكاشير',
  profit_by_shop: 'ربح المحل', bale_profit: '⭐ ربح كل بالة', monthly_compare: 'مقارنة شهرية', sorting_results: 'نتيجة الفرز', supplier_quality: 'تقييم الموردين', pending_lots: 'بالات ماتفرزتش',
  purchases_list: 'فواتير الشراء', purchases_by_supplier: 'المشتريات بالمورد', supplier_balances: 'أرصدة الموردين', supplier_aging: 'أعمار ديون الموردين', stock_value: 'المخزون بالقيمة', stock_by_location: 'المخزون بالمكان',
  slow_moving: 'البضاعة الراكدة', low_stock: 'قربت تخلص', transfers_list: 'أذون النقل', holding_goods: 'بضاعة عند العملاء', top_customers: 'أكتر العملاء', new_customers: 'العملاء الجداد', inactive_customers: 'عملاء بطلوا ييجوا',
  customer_debts: 'ديون العملاء', collections: 'التحصيلات', offers_performance: 'أداء العروض', coupons_usage: 'الكوبونات', returns_list: 'المرتجعات', returns_by_reason: 'بالسبب', returns_by_item: 'بالصنف',
  treasury_balances: 'أرصدة الخزن', cash_flow: 'التدفق النقدي', owner_drawings: '⭐ مسحوبات صاحب المحل', manual_moves: 'إيداع وسحب يدوي', shifts_list: 'الورديات', cashier_diffs: 'عجز وزيادة الكاشيرية', custodies: 'العهد',
  cashier_performance: 'أداء الكاشيرية', expenses_by_category: 'المصروفات بالبند', expenses_monthly: 'المصروفات شهرياً', expenses_cancelled: 'المصروفات الملغية', price_changes: 'تغيير الأسعار', manager_approvals: '⭐ موافقات المدير'
};

export default function ReportsPage() {
  const { isRTL } = useLanguage();
  const [cat, setCat] = useState([]);
  const [name, setName] = useState('dashboard');
  const [f, setF] = useState({ from: monthStart(), to: today(), warehouse: '', cashier: '' });
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [whs, setWhs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const run = async (n = name, x = f) => {
    setLoading(true);
    const p = new URLSearchParams({ name: n, date_from: x.from, date_to: x.to }); if (x.warehouse) p.append('warehouse', x.warehouse); if (x.cashier) p.append('cashier', x.cashier);
    try { const r = await axiosClient.get(`/reports-v2/run/?${p.toString()}`); setData(r.data); } catch (e) { setData({ title: n, columns: [{ key: 'e', label: 'غلطة' }], rows: [{ e: e.response?.data?.detail || e.message }], cards: [], totals: {} }); } finally { setLoading(false); }
  };
  useEffect(() => {
    axiosClient.get('/reports-v2/').then((r) => setCat(r.data || [])).catch(() => {});
    axiosClient.get('/warehouses/').then((r) => setWhs(listOf(r.data))).catch(() => {});
    axiosClient.get('/users/').then((r) => setUsers(listOf(r.data))).catch(() => {});
    run('dashboard');
  }, []);
  const pick = (n) => { setName(n); setQ(''); run(n); };
  const term = q.trim().toLowerCase();
  const rows = (data?.rows || []).filter((r) => !term || Object.values(r).join(' ').toLowerCase().includes(term));
  const report = () => ({ title: data.title, filename: name, filtersText: `${f.from} → ${f.to}`, columns: data.columns.map((c) => ({ key: c.key, header: c.label, type: c.type === 'money' ? 'money' : (['number', 'kg', 'pct'].includes(c.type) ? 'number' : undefined), width: 16 })), rows: rows.map((r) => ({ ...r })), totals: data.totals });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200"><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileSpreadsheet size={20} className="text-emerald-600" /> {isRTL ? 'مركز التقارير' : 'Reports Center'}</h1><p className="text-xs text-slate-500 mt-1">{isRTL ? 'كل التقارير محسوبة على كل البيانات، بفلاتر وPDF وExcel' : 'All reports computed on all data, with filters and PDF/Excel'}</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3 max-h-[80vh] overflow-y-auto">
          {cat.map((g) => (
            <div key={g.group} className="space-y-1">
              <div className="text-[11px] font-black text-slate-500">{g.group}</div>
              {g.items.map((it) => <button key={it.key} type="button" onClick={() => pick(it.key)} className={`w-full text-start px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${name === it.key ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`}>{TITLES[it.key] || it.key}</button>)}
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'من تاريخ' : 'From'}<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'إلى تاريخ' : 'To'}<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'المكان / المحل' : 'Location'}<select value={f.warehouse} onChange={(e) => setF({ ...f, warehouse: e.target.value })} className={input + ' w-full'}><option value="">{isRTL ? 'الكل' : 'All'}</option>{whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'الكاشير' : 'Cashier'}<select value={f.cashier} onChange={(e) => setF({ ...f, cashier: e.target.value })} className={input + ' w-full'}><option value="">{isRTL ? 'الكل' : 'All'}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}</select></label>
            <button type="button" onClick={() => run()} className="h-10 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{loading ? '...' : (isRTL ? 'عرض' : 'Show')}</button>
          </div>
          {data && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-base font-black">{data.title}</div>{data.period && <div className="text-[11px] text-slate-500">{data.period[0]} → {data.period[1]}</div>}</div>
                <div className="flex gap-2 items-center">
                  <div className="relative"><Search size={14} className="absolute top-1/2 -translate-y-1/2 text-slate-400" style={isRTL ? { right: 8 } : { left: 8 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isRTL ? 'بحث في النتايج...' : 'Filter rows...'} className={input + ' w-48 h-9 text-xs'} style={isRTL ? { paddingRight: 28 } : { paddingLeft: 28 }} /></div>
                  <ExportButtons getReport={report} />
                </div>
              </div>
              {data.note && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2">{data.note}</div>}
              {(data.cards || []).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{data.cards.map((c) => (
                  <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3"><div className="text-[11px] text-slate-500 font-bold">{c.label}</div><div className={`text-lg font-black mt-1 ${num(c.value) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{fmt(c.value, c.type)}</div></div>
                ))}</div>
              )}
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0"><tr className="bg-slate-100 text-slate-700">{data.columns.map((c) => <th key={c.key} className={`p-2 ${['money', 'number', 'kg', 'pct'].includes(c.type) ? 'text-center' : 'text-start'}`}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {rows.length === 0 && <tr><td colSpan={data.columns.length} className="p-4 text-center text-slate-500">{isRTL ? 'مفيش بيانات في الفترة دي' : 'No data for this period'}</td></tr>}
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">{data.columns.map((c) => <td key={c.key} className={`p-2 ${['money', 'number', 'kg', 'pct'].includes(c.type) ? 'text-center' : ''} ${c.type === 'money' && num(r[c.key]) < 0 ? 'text-rose-700 font-bold' : ''}`}>{fmt(r[c.key], c.type)}</td>)}</tr>
                    ))}
                    {Object.keys(data.totals || {}).length > 0 && (
                      <tr className="bg-emerald-50 font-black">{data.columns.map((c, i) => <td key={c.key} className={`p-2 ${['money', 'number', 'kg', 'pct'].includes(c.type) ? 'text-center' : ''}`}>{i === 0 ? (isRTL ? 'الإجمالي' : 'Total') : (data.totals[c.key] !== undefined ? fmt(data.totals[c.key], c.type) : '')}</td>)}</tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}