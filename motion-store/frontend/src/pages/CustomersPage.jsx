import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Search, Users } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const TX = {
  ar: { title: 'العملاء', sub: 'كل العملاء بأكوادهم وتاريخ مشترياتهم وحساباتهم', count: 'عدد العملاء', sales: 'إجمالي مشترياتهم', debts: 'إجمالي اللي عليهم', search: 'ابحث بالاسم أو التليفون أو الكود...',
    code: 'الكود', name: 'الاسم', phone: 'التليفون', invoices: 'الفواتير', total: 'إجمالي المشتريات', last: 'آخر شراء', top: 'أكتر حاجة بيشتريها', debt: 'عليه', none: 'مفيش عملاء',
    history: 'سجل المشتريات', collections: 'التحصيلات', collect: 'تحصيل', amount: 'المبلغ', method: 'طريقة الدفع', done: 'اتحصّل ✅', failed: 'حصلت مشكلة: ', credit: 'ليه عندنا', cur: 'ج.م', rTitle: 'تقرير العملاء' },
  en: { title: 'Customers', sub: 'All customers with codes, purchase history and accounts', count: 'Customers', sales: 'Total purchases', debts: 'Total owed', search: 'Search by name, phone or code...',
    code: 'Code', name: 'Name', phone: 'Phone', invoices: 'Invoices', total: 'Total purchases', last: 'Last purchase', top: 'Buys most', debt: 'Owes', none: 'No customers',
    history: 'Purchase history', collections: 'Collections', collect: 'Collect', amount: 'Amount', method: 'Payment method', done: 'Collected ✅', failed: 'Something went wrong: ', credit: 'In credit', cur: 'EGP', rTitle: 'Customers Report' }
};

export default function CustomersPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [hist, setHist] = useState(null);
  const [methods, setMethods] = useState([]);
  const [amt, setAmt] = useState('');
  const [pm, setPm] = useState('');
  const [msg, setMsg] = useState('');
  const load = async () => { try { const r = await axiosClient.get('/customers/summary/'); setRows(listOf(r.data)); } catch (e) { console.error(e); } };
  useEffect(() => { load(); axiosClient.get('/payments/?is_active=true').then((r) => { const l = listOf(r.data).filter((m) => m.method_type !== 'CREDIT'); setMethods(l); if (l[0]) setPm(l[0].id); }).catch(() => {}); }, []);
  const open = async (c) => { if (openId === c.id) { setOpenId(null); return; } setOpenId(c.id); setHist(null); setAmt(''); setMsg(''); try { const r = await axiosClient.get(`/customers/${c.id}/history/`); setHist(r.data); } catch (e) { setMsg(T.failed + e.message); } };
  const collect = async (c) => {
    try { await axiosClient.post(`/customers/${c.id}/collect/`, { amount: amt, payment_method_id: pm }); setMsg(T.done); setAmt(''); await load(); const r = await axiosClient.get(`/customers/${c.id}/history/`); setHist(r.data); }
    catch (e) { setMsg(T.failed + (e.response?.data?.detail || e.message)); }
  };
  const term = q.trim().toLowerCase();
  const list = rows.filter((r) => !term || [r.code, r.name, r.phone].join(' ').toLowerCase().includes(term)).sort((a, b) => num(b.total) - num(a.total));
  const report = () => ({ title: T.rTitle, filename: 'customers', filtersText: q, columns: [
    { key: 'code', header: T.code, width: 10 }, { key: 'name', header: T.name, width: 20 }, { key: 'phone', header: T.phone, width: 14 }, { key: 'inv', header: T.invoices, type: 'number' },
    { key: 'total', header: T.total, type: 'money' }, { key: 'last', header: T.last, width: 16 }, { key: 'top', header: T.top, width: 26 }, { key: 'debt', header: T.debt, type: 'money' }
  ], rows: list.map((r) => ({ code: r.code || '', name: r.name, phone: r.phone, inv: r.invoices, total: num(r.total), last: dt(r.last), top: (r.top_items || []).join('، '), debt: num(r.credit_balance) })),
  totals: { total: list.reduce((a, r) => a + num(r.total), 0), debt: list.reduce((a, r) => a + Math.max(0, num(r.credit_balance)), 0) } });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200"><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users size={20} className="text-emerald-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.count}</div><div className="text-xl font-black mt-1">{rows.length}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.sales}</div><div className="text-xl font-black mt-1 text-emerald-800">{money(rows.reduce((a, r) => a + num(r.total), 0))} <span className="text-xs">{T.cur}</span></div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.debts}</div><div className="text-xl font-black mt-1 text-rose-700">{money(rows.reduce((a, r) => a + Math.max(0, num(r.credit_balance)), 0))} <span className="text-xs">{T.cur}</span></div></div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} /></div>
          <ExportButtons getReport={report} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.name}</th><th className="p-2 text-start">{T.phone}</th><th className="p-2 text-center">{T.invoices}</th><th className="p-2 text-center">{T.total}</th><th className="p-2 text-start">{T.last}</th><th className="p-2 text-start">{T.top}</th><th className="p-2 text-center">{T.debt}</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
              {list.map((r) => (
                <React.Fragment key={r.id}>
                  <tr onClick={() => open(r)} className={`border-b border-slate-100 cursor-pointer ${openId === r.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                    <td className="p-2 font-mono font-bold">{r.code || '—'}</td><td className="p-2 font-bold">{r.name}</td><td className="p-2 font-mono">{r.phone}</td><td className="p-2 text-center">{r.invoices}</td>
                    <td className="p-2 text-center font-bold text-emerald-800">{money(r.total)}</td><td className="p-2">{dt(r.last)}</td><td className="p-2">{(r.top_items || []).join('، ') || '—'}</td>
                    <td className={`p-2 text-center font-bold ${num(r.credit_balance) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{num(r.credit_balance) < 0 ? `${T.credit} ${money(-num(r.credit_balance))}` : money(r.credit_balance)}</td>
                  </tr>
                  {openId === r.id && (
                    <tr><td colSpan={8} className="p-3 bg-slate-50">
                      {!hist ? <div className="text-xs text-slate-500">...</div> : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-2 space-y-2 max-h-96 overflow-y-auto">
                            <div className="font-bold">{T.history} ({hist.invoices_count}) · {money(hist.total_spent)} {T.cur}</div>
                            {hist.invoices.map((iv) => (
                              <div key={iv.id} className="border-t border-slate-100 pt-1">
                                <div className="flex justify-between font-bold"><span className="font-mono">{iv.number} · {dt(iv.date)}</span><span>{money(iv.total)}</span></div>
                                <div className="text-slate-600">{iv.lines.map((l) => `${l.name} (${num(l.pieces) > 0 ? l.pieces + ' ق ' : ''}${num(l.kg) > 0 ? l.kg + ' كجم' : ''})`).join(' · ')}</div>
                                <div className="text-slate-500">{iv.payments.map((p) => `${p.method} ${money(p.amount)}`).join(' + ')}</div>
                              </div>
                            ))}
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-2 space-y-2">
                            <div className="font-bold">{T.debt}: <span className={num(r.credit_balance) > 0 ? 'text-rose-700' : ''}>{money(r.credit_balance)} {T.cur}</span></div>
                            {num(r.credit_balance) > 0 && (
                              <div className="space-y-2 border-t border-slate-100 pt-2">
                                <input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={T.amount} className={input + ' w-full'} />
                                <select value={pm} onChange={(e) => setPm(e.target.value)} className={input + ' w-full'}>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                                <button type="button" disabled={!(num(amt) > 0)} onClick={() => collect(r)} className="w-full h-9 rounded-lg bg-emerald-600 disabled:bg-slate-400 text-white font-bold cursor-pointer">{T.collect}</button>
                              </div>
                            )}
                            {msg && <div className="font-bold text-emerald-800">{msg}</div>}
                            <div className="font-bold border-t border-slate-100 pt-2">{T.collections}</div>
                            {(hist.collections || []).map((cl, i) => <div key={i} className="flex justify-between"><span>{dt(cl.date)} · {cl.method}</span><span className="font-bold">{money(cl.amount)}</span></div>)}
                          </div>
                        </div>
                      )}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}