// EXPENSES_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Search, DollarSign, X, Plus } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const TX = {
  ar: { title: 'المصروفات', sub: 'إذن صرف بموافقة المدير، والفلوس بتطلع من الخزنة فعلاً', form: 'إذن صرف جديد', date: 'التاريخ', cat: 'البند', addCat: '+ بند', newCat: 'اسم البند الجديد:', amount: 'المبلغ',
    treasury: 'الخزنة', bal: 'رصيدها', paidTo: 'اتصرف لمين', desc: 'الوصف', save: 'حفظ (محتاج باسورد المدير)', mgrTitle: 'موافقة المدير', mgrPwd: 'باسورد المدير', confirm: 'تأكيد', cancel: 'إلغاء',
    total: 'إجمالي المصروفات', count: 'عدد الأذونات', topCats: 'أكبر البنود', from: 'من تاريخ', to: 'إلى تاريخ', all: 'الكل', status: 'الحالة', active: 'ساري', cancelled: 'ملغي', search: 'ابحث بالرقم أو الجهة أو الوصف...', show: 'عرض',
    no: 'الرقم', by: 'طلبه', approved: 'وافق', shift: 'الوردية', none: 'مفيش مصروفات', doCancel: 'إلغاء المصروف', reason: 'سبب الإلغاء', cancelTitle: 'إلغاء مصروف', saved: 'اتسجل ✅', cancelledMsg: 'اتلغى ✅', failed: 'حصلت مشكلة: ', cur: 'ج.م', rTitle: 'تقرير المصروفات' },
  en: { title: 'Expenses', sub: 'Manager-approved payment vouchers that really leave the treasury', form: 'New payment voucher', date: 'Date', cat: 'Category', addCat: '+ Category', newCat: 'New category name:', amount: 'Amount',
    treasury: 'Treasury', bal: 'balance', paidTo: 'Paid to', desc: 'Description', save: 'Save (needs manager password)', mgrTitle: 'Manager approval', mgrPwd: 'Manager password', confirm: 'Confirm', cancel: 'Cancel',
    total: 'Total expenses', count: 'Vouchers', topCats: 'Top categories', from: 'From', to: 'To', all: 'All', status: 'Status', active: 'Active', cancelled: 'Cancelled', search: 'Search by number, payee or description...', show: 'Show',
    no: 'Number', by: 'Requested by', approved: 'Approved by', shift: 'Shift', none: 'No expenses', doCancel: 'Cancel expense', reason: 'Cancel reason', cancelTitle: 'Cancel expense', saved: 'Saved ✅', cancelledMsg: 'Cancelled ✅', failed: 'Something went wrong: ', cur: 'EGP', rTitle: 'Expenses Report' }
};
const emptyForm = () => ({ expense_date: today(), category_id: '', treasury_id: '', amount: '', paid_to: '', description: '' });

export default function ExpensesPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [cats, setCats] = useState([]);
  const [trs, setTrs] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ from: monthStart(), to: today(), category: '', treasury: '', status: '', q: '' });
  const [mgr, setMgr] = useState(null);
  const [pwd, setPwd] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const loadBase = async () => {
    try {
      const [c, t] = await Promise.all([axiosClient.get('/expense-categories/?all=1'), axiosClient.get('/treasuries/')]);
      const cl = listOf(c.data); const tl = listOf(t.data); setCats(cl); setTrs(tl);
      setForm((p) => ({ ...p, category_id: p.category_id || (cl[0] ? cl[0].id : ''), treasury_id: p.treasury_id || (tl[0] ? tl[0].id : '') }));
    } catch (e) { setErr(T.failed + e.message); }
  };
  const load = async (x = f) => {
    const p = new URLSearchParams({ all: '1' });
    if (x.from) p.append('date_from', x.from); if (x.to) p.append('date_to', x.to); if (x.category) p.append('category', x.category);
    if (x.treasury) p.append('treasury', x.treasury); if (x.status) p.append('status', x.status); if (x.q.trim()) p.append('q', x.q.trim());
    try { const r = await axiosClient.get(`/expenses/?${p.toString()}`); setRows(listOf(r.data)); } catch (e) { setErr(T.failed + e.message); }
  };
  useEffect(() => { loadBase(); load(); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const addCat = async () => { const n = (window.prompt(T.newCat) || '').trim(); if (!n) return; try { const r = await axiosClient.post('/expense-categories/', { name: n }); await loadBase(); setForm((p) => ({ ...p, category_id: r.data.id })); } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } };
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (mgr.mode === 'new') { await axiosClient.post('/expenses/', { ...form, manager_password: pwd }); setForm({ ...emptyForm(), category_id: form.category_id, treasury_id: form.treasury_id }); flash(T.saved); }
      else { await axiosClient.post(`/expenses/${mgr.row.id}/cancel/`, { manager_password: pwd, reason }); flash(T.cancelledMsg); }
      setMgr(null); setPwd(''); setReason(''); await loadBase(); await load();
    } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };
  const active = rows.filter((r) => r.status === 'ACTIVE');
  const byCat = {}; active.forEach((r) => { byCat[r.category_name] = (byCat[r.category_name] || 0) + num(r.amount); });
  const topCats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).slice(0, 4);
  const report = () => ({ title: T.rTitle, filename: 'expenses', filtersText: [f.from, f.to, f.q].filter(Boolean).join(' | '), columns: [
    { key: 'no', header: T.no, width: 18 }, { key: 'date', header: T.date, width: 12 }, { key: 'cat', header: T.cat, width: 18 }, { key: 'to', header: T.paidTo, width: 16 }, { key: 'tr', header: T.treasury, width: 16 },
    { key: 'by', header: T.by, width: 10 }, { key: 'ap', header: T.approved, width: 10 }, { key: 'st', header: T.status, width: 10 }, { key: 'amount', header: T.amount, type: 'money' }
  ], rows: rows.map((r) => ({ no: r.number, date: r.expense_date, cat: r.category_name, to: r.paid_to || '', tr: r.treasury_name, by: r.created_by_name || '', ap: r.approved_by_name || '', st: r.status === 'ACTIVE' ? T.active : `${T.cancelled}: ${r.cancel_reason || ''}`, amount: r.status === 'ACTIVE' ? num(r.amount) : 0 })),
  totals: { amount: active.reduce((a, r) => a + num(r.amount), 0) } });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const selTr = trs.find((t) => t.id === form.treasury_id);
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200"><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><DollarSign size={20} className="text-rose-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="text-sm font-bold">{T.form}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.date}<input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className={input + ' w-full'} /></label>
          <div className="flex gap-2 items-end">
            <label className="text-xs font-bold text-slate-600 space-y-1 block flex-1">{T.cat}<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={input + ' w-full'}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <button type="button" onClick={addCat} className="h-10 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer whitespace-nowrap">{T.addCat}</button>
          </div>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.amount}<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input + ' w-full font-bold'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.treasury}{selTr ? <span className="text-slate-500 font-normal"> ({T.bal}: {money(selTr.current_balance)})</span> : null}
            <select value={form.treasury_id} onChange={(e) => setForm({ ...form, treasury_id: e.target.value })} className={input + ' w-full'}>{trs.map((t) => <option key={t.id} value={t.id}>{t.name} — {money(t.current_balance)}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.paidTo}<input value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.desc}<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input + ' w-full'} /></label>
        </div>
        <div className="flex justify-end"><button type="button" disabled={!(num(form.amount) > 0) || !form.category_id || !form.treasury_id} onClick={() => { setErr(''); setPwd(''); setMgr({ mode: 'new' }); }} className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">🔒 {T.save}</button></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.total}</div><div className="text-xl font-black mt-1 text-rose-700">{money(active.reduce((a, r) => a + num(r.amount), 0))} <span className="text-xs">{T.cur}</span></div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.count}</div><div className="text-xl font-black mt-1">{active.length}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.topCats}</div>{topCats.length === 0 ? <div className="text-xs text-slate-400 mt-1">—</div> : topCats.map((k) => <div key={k} className="flex justify-between text-xs mt-1"><span>{k}</span><span className="font-bold">{money(byCat[k])}</span></div>)}</div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.cat}<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.treasury}<select value={f.treasury} onChange={(e) => setF({ ...f, treasury: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{trs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.status}<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option><option value="ACTIVE">{T.active}</option><option value="CANCELLED">{T.cancelled}</option></select></label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} /><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} /></div>
          <button type="button" onClick={() => load()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
          <ExportButtons getReport={report} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.no}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.cat}</th><th className="p-2 text-start">{T.paidTo}</th><th className="p-2 text-center">{T.amount}</th><th className="p-2 text-start">{T.treasury}</th><th className="p-2 text-start">{T.by}</th><th className="p-2 text-start">{T.approved}</th><th className="p-2 text-start">{T.shift}</th><th className="p-2"></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-slate-100 ${r.status === 'CANCELLED' ? 'bg-rose-50/50 text-slate-400' : ''}`}>
                  <td className="p-2 font-mono font-bold">{r.number}</td><td className="p-2">{r.expense_date}</td><td className="p-2 font-bold">{r.category_name}</td>
                  <td className="p-2">{r.paid_to || '—'}{r.description ? <div className="text-[10px] text-slate-500">{r.description}</div> : null}</td>
                  <td className={`p-2 text-center font-bold ${r.status === 'CANCELLED' ? 'line-through text-rose-400' : 'text-rose-700'}`}>{money(r.amount)}</td>
                  <td className="p-2">{r.treasury_name}</td><td className="p-2">{r.created_by_name || '—'}</td><td className="p-2">{r.approved_by_name || '—'}</td><td className="p-2 font-mono">{r.shift_code || '—'}</td>
                  <td className="p-2">{r.status === 'ACTIVE'
                    ? <button type="button" onClick={() => { setErr(''); setPwd(''); setReason(''); setMgr({ mode: 'cancel', row: r }); }} className="h-8 px-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-bold cursor-pointer whitespace-nowrap">{T.doCancel}</button>
                    : <span className="text-[10px] text-rose-600">{T.cancelled}: {r.cancel_reason} ({r.cancelled_by_name})</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {mgr && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">🔒 {mgr.mode === 'new' ? T.mgrTitle : `${T.cancelTitle} ${mgr.row.number}`}</div><button type="button" onClick={() => setMgr(null)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            {mgr.mode === 'new' && <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2">{cats.find((c) => c.id === form.category_id)?.name} — <b>{money(form.amount)} {T.cur}</b> — {selTr?.name}</div>}
            {mgr.mode === 'cancel' && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T.reason} className={input + ' w-full'} />}
            <input type="password" autoFocus value={pwd} onChange={(e) => setPwd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pwd) submit(); }} placeholder={T.mgrPwd} className={input + ' w-full text-center'} />
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setMgr(null)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={busy || !pwd || (mgr.mode === 'cancel' && !reason.trim())} onClick={submit} className="flex-1 h-11 rounded-xl bg-slate-900 disabled:bg-slate-400 text-white text-sm font-bold cursor-pointer">{T.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}