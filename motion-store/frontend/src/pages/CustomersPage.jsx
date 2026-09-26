import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Search, Users, Plus, ArrowRight, ArrowLeft } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const TX = {
  ar: { title: 'العملاء', sub: 'كل العملاء بأكوادهم وفواتيرهم وحساباتهم', count: 'عدد العملاء', sales: 'إجمالي مشترياتهم', debts: 'إجمالي اللي عليهم', search: 'ابحث بالاسم أو التليفون أو الكود...',
    add: 'عميل جديد', name: 'الاسم', phone: 'التليفون', address: 'العنوان', notes: 'ملاحظات', limit: 'حد الدين (اختياري)', save: 'حفظ العميل', cancel: 'إلغاء',
    code: 'الكود', invoices: 'الفواتير', total: 'إجمالي المشتريات', last: 'آخر شراء', top: 'أكتر حاجة بيشتريها', debt: 'عليه', credit: 'ليه عندنا', none: 'مفيش عملاء', back: 'رجوع للعملاء',
    invNo: 'رقم الفاتورة', date: 'التاريخ', pays: 'الدفع', noInv: 'مفيش فواتير للعميل ده', item: 'الصنف', qty: 'الكمية', lineTotal: 'الإجمالي',
    collections: 'التحصيلات', collect: 'تحصيل', amount: 'المبلغ', done: 'اتحصّل ✅', saved: 'اتحفظ ✅', failed: 'حصلت مشكلة: ', cur: 'ج.م', rTitle: 'تقرير العملاء', pcs: 'قطعة', kg: 'كجم' },
  en: { title: 'Customers', sub: 'All customers with codes, invoices and accounts', count: 'Customers', sales: 'Total purchases', debts: 'Total owed', search: 'Search by name, phone or code...',
    add: 'New customer', name: 'Name', phone: 'Phone', address: 'Address', notes: 'Notes', limit: 'Credit limit (optional)', save: 'Save customer', cancel: 'Cancel',
    code: 'Code', invoices: 'Invoices', total: 'Total purchases', last: 'Last purchase', top: 'Buys most', debt: 'Owes', credit: 'In credit', none: 'No customers', back: 'Back to customers',
    invNo: 'Invoice #', date: 'Date', pays: 'Payment', noInv: 'No invoices for this customer', item: 'Item', qty: 'Qty', lineTotal: 'Total',
    collections: 'Collections', collect: 'Collect', amount: 'Amount', done: 'Collected ✅', saved: 'Saved ✅', failed: 'Something went wrong: ', cur: 'EGP', rTitle: 'Customers Report', pcs: 'pcs', kg: 'KG' }
};
const emptyForm = { name: '', phone: '', address: '', notes: '', credit_limit: '' };

export default function CustomersPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sel, setSel] = useState(null);
  const [hist, setHist] = useState(null);
  const [openInv, setOpenInv] = useState(null);
  const [methods, setMethods] = useState([]);
  const [amt, setAmt] = useState('');
  const [pm, setPm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const load = async () => { try { const r = await axiosClient.get('/customers/summary/'); setRows(listOf(r.data)); } catch (e) { setErr(T.failed + e.message); } };
  useEffect(() => { load(); axiosClient.get('/payments/?is_active=true').then((r) => { const l = listOf(r.data).filter((m) => m.method_type !== 'CREDIT'); setMethods(l); if (l[0]) setPm(l[0].id); }).catch(() => {}); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const addCustomer = async () => {
    setErr('');
    try { await axiosClient.post('/customers/', form); setForm(emptyForm); setShowAdd(false); flash(T.saved); load(); }
    catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); }
  };
  const openCustomer = async (c) => { setSel(c); setHist(null); setOpenInv(null); setAmt(''); setErr(''); try { const r = await axiosClient.get(`/customers/${c.id}/history/`); setHist(r.data); } catch (e) { setErr(T.failed + e.message); } };
  const collect = async () => {
    try { await axiosClient.post(`/customers/${sel.id}/collect/`, { amount: amt, payment_method_id: pm }); flash(T.done); setAmt(''); await load(); const r = await axiosClient.get(`/customers/${sel.id}/history/`); setHist(r.data); setSel({ ...sel, credit_balance: r.data.customer.credit_balance }); }
    catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); }
  };
  const term = q.trim().toLowerCase();
  const list = rows.filter((r) => !term || [r.code, r.name, r.phone].join(' ').toLowerCase().includes(term)).sort((a, b) => num(b.total) - num(a.total));
  const report = () => ({ title: T.rTitle, filename: 'customers', filtersText: q, columns: [
    { key: 'code', header: T.code, width: 10 }, { key: 'name', header: T.name, width: 20 }, { key: 'phone', header: T.phone, width: 14 }, { key: 'inv', header: T.invoices, type: 'number' },
    { key: 'total', header: T.total, type: 'money' }, { key: 'last', header: T.last, width: 16 }, { key: 'top', header: T.top, width: 26 }, { key: 'debt', header: T.debt, type: 'money' }
  ], rows: list.map((r) => ({ code: r.code || '', name: r.name, phone: r.phone, inv: r.invoices, total: num(r.total), last: dt(r.last), top: (r.top_items || []).join('، '), debt: num(r.credit_balance) })) });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const debtText = (v) => (num(v) < 0 ? `${T.credit} ${money(-num(v))}` : money(v));
  const Back = isRTL ? ArrowRight : ArrowLeft;

  if (sel) {
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => { setSel(null); load(); }} className="h-8 px-3 mb-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Back size={14} /> {T.back}</button>
            <h1 className="text-xl font-black text-slate-800">{sel.name} <span className="text-sm font-mono text-slate-500">({sel.code})</span></h1>
            <div className="text-xs text-slate-600 font-mono mt-1">{sel.phone}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-[11px] text-slate-500 font-bold">{T.invoices}</div><div className="text-lg font-black">{hist ? hist.invoices_count : '...'}</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-[11px] text-slate-500 font-bold">{T.total}</div><div className="text-lg font-black text-emerald-800">{hist ? money(hist.total_spent) : '...'}</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-[11px] text-slate-500 font-bold">{T.debt}</div><div className={`text-lg font-black ${num(sel.credit_balance) > 0 ? 'text-rose-700' : ''}`}>{debtText(sel.credit_balance)}</div></div>
          </div>
        </div>
        {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
        {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.invNo}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.pays}</th><th className="p-2 text-center">{T.lineTotal}</th></tr></thead>
              <tbody>
                {hist && hist.invoices.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">{T.noInv}</td></tr>}
                {hist && hist.invoices.map((iv) => (
                  <React.Fragment key={iv.id}>
                    <tr onClick={() => setOpenInv(openInv === iv.id ? null : iv.id)} className={`border-b border-slate-100 cursor-pointer ${openInv === iv.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-2 font-mono font-bold">{iv.number}</td><td className="p-2">{dt(iv.date)}</td><td className="p-2">{iv.payments.map((p) => `${p.method} ${money(p.amount)}`).join(' + ')}</td><td className="p-2 text-center font-bold">{money(iv.total)}</td>
                    </tr>
                    {openInv === iv.id && (
                      <tr><td colSpan={4} className="p-2 bg-slate-50">
                        <table className="w-full text-xs"><thead><tr className="text-slate-600"><th className="p-1 text-start">{T.item}</th><th className="p-1 text-start">{T.qty}</th><th className="p-1 text-center">{T.lineTotal}</th></tr></thead>
                          <tbody>{iv.lines.map((l, i) => (
                            <tr key={i} className="border-t border-slate-100"><td className="p-1 font-bold">{l.bundle ? <span className="text-amber-700">{l.bundle} · </span> : null}{l.name}</td><td className="p-1">{[num(l.pieces) > 0 ? `${l.pieces} ${T.pcs}` : '', num(l.kg) > 0 ? `${Number(l.kg)} ${T.kg}` : ''].filter(Boolean).join(' · ')}</td><td className="p-1 text-center font-bold">{money(l.total)}</td></tr>
                          ))}</tbody></table>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
            {num(sel.credit_balance) > 0 && (
              <div className="space-y-2">
                <div className="font-bold">{T.collect}</div>
                <input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={T.amount} className={input + ' w-full'} />
                <select value={pm} onChange={(e) => setPm(e.target.value)} className={input + ' w-full'}>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <button type="button" disabled={!(num(amt) > 0)} onClick={collect} className="w-full h-10 rounded-lg bg-emerald-600 disabled:bg-slate-400 text-white font-bold cursor-pointer">{T.collect}</button>
              </div>
            )}
            <div className="font-bold border-t border-slate-100 pt-2">{T.collections}</div>
            {hist && (hist.collections || []).length === 0 && <div className="text-slate-500">—</div>}
            {hist && (hist.collections || []).map((cl, i) => <div key={i} className="flex justify-between"><span>{dt(cl.date)} · {cl.method}</span><span className="font-bold">{money(cl.amount)}</span></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users size={20} className="text-emerald-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
        <button type="button" onClick={() => { setShowAdd(!showAdd); setErr(''); }} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Plus size={14} /> {T.add}</button>
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
      {showAdd && (
        <div className="bg-white p-4 rounded-xl border border-emerald-300 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.name}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.phone}<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input + ' w-full font-mono'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.limit}<input type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.address}<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.notes}<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input + ' w-full'} /></label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 h-10 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">{T.cancel}</button>
            <button type="button" disabled={!form.name.trim() || form.phone.replace(/\D/g, '').length < 6} onClick={addCustomer} className="flex-1 h-10 rounded-lg bg-emerald-600 disabled:bg-slate-400 text-white text-xs font-bold cursor-pointer">{T.save}</button>
          </div>
        </div>
      )}
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
                <tr key={r.id} onClick={() => openCustomer(r)} className="border-b border-slate-100 cursor-pointer hover:bg-emerald-50">
                  <td className="p-2 font-mono font-bold">{r.code || '—'}</td><td className="p-2 font-bold">{r.name}</td><td className="p-2 font-mono">{r.phone}</td><td className="p-2 text-center">{r.invoices}</td>
                  <td className="p-2 text-center font-bold text-emerald-800">{money(r.total)}</td><td className="p-2">{dt(r.last)}</td><td className="p-2">{(r.top_items || []).join('، ') || '—'}</td>
                  <td className={`p-2 text-center font-bold ${num(r.credit_balance) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{debtText(r.credit_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}