import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Search, Truck, ArrowRight, ArrowLeft } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TX = {
  ar: { title: 'الموردين', sub: 'حسابات الموردين: الفواتير، والمدفوع، واللي عليكم', count: 'عدد الموردين', total: 'إجمالي المشتريات', paid: 'المدفوع', due: 'عليكم', search: 'ابحث بالاسم أو الكود أو التليفون...',
    code: 'الكود', name: 'الاسم', phone: 'التليفون', invoices: 'الفواتير', last: 'آخر شراء', none: 'مفيش موردين', back: 'رجوع للموردين', statement: 'كشف الحساب',
    date: 'التاريخ', type: 'الحركة', ref: 'المرجع', debit: 'فاتورة', credit: 'دفعة', balance: 'الرصيد', inv: 'فاتورة شراء', pay: 'دفعة', method: 'طريقة الدفع', by: 'بواسطة',
    payTitle: 'دفع للمورد', amount: 'المبلغ', forInv: 'لفاتورة معينة (اختياري)', noInv: 'بدون فاتورة معينة', notes: 'ملاحظات', confirm: 'تأكيد الدفع', done: 'اتدفع ✅', failed: 'حصلت مشكلة: ',
    ahead: 'ليكم عنده', cur: 'ج.م', item: 'البند', kg: 'كجم', rList: 'تقرير الموردين', rStmt: 'كشف حساب مورد' },
  en: { title: 'Suppliers', sub: 'Supplier accounts: invoices, payments and balances', count: 'Suppliers', total: 'Total purchases', paid: 'Paid', due: 'We owe', search: 'Search by name, code or phone...',
    code: 'Code', name: 'Name', phone: 'Phone', invoices: 'Invoices', last: 'Last purchase', none: 'No suppliers', back: 'Back to suppliers', statement: 'Statement',
    date: 'Date', type: 'Type', ref: 'Reference', debit: 'Invoice', credit: 'Payment', balance: 'Balance', inv: 'Purchase invoice', pay: 'Payment', method: 'Method', by: 'By',
    payTitle: 'Pay supplier', amount: 'Amount', forInv: 'For a specific invoice (optional)', noInv: 'No specific invoice', notes: 'Notes', confirm: 'Confirm payment', done: 'Paid ✅', failed: 'Something went wrong: ',
    ahead: 'In our favor', cur: 'EGP', item: 'Item', kg: 'KG', rList: 'Suppliers Report', rStmt: 'Supplier Statement' }
};

export default function SuppliersPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [st, setSt] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [methods, setMethods] = useState([]);
  const [pf, setPf] = useState({ amount: '', method: '', invoice: '', notes: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const r = await axiosClient.get('/suppliers/summary/'); setRows(listOf(r.data)); } catch (e) { setErr(T.failed + e.message); } };
  useEffect(() => { load(); axiosClient.get('/payments/?is_active=true').then((r) => { const l = listOf(r.data).filter((m) => m.method_type !== 'CREDIT'); setMethods(l); if (l[0]) setPf((p) => ({ ...p, method: l[0].id })); }).catch(() => {}); }, []);
  const openSup = async (s) => { setSel(s); setSt(null); setOpenId(null); setErr(''); setMsg(''); try { const r = await axiosClient.get(`/suppliers/${s.id}/statement/`); setSt(r.data); } catch (e) { setErr(T.failed + e.message); } };
  const doPay = async () => {
    setBusy(true); setErr('');
    try {
      await axiosClient.post(`/suppliers/${sel.id}/pay/`, { amount: pf.amount, payment_method_id: pf.method, purchase_invoice_id: pf.invoice || null, notes: pf.notes });
      setMsg(T.done); setPf({ ...pf, amount: '', invoice: '', notes: '' }); await load(); const r = await axiosClient.get(`/suppliers/${sel.id}/statement/`); setSt(r.data);
    } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };
  const balText = (v) => (num(v) < 0 ? `${T.ahead} ${money(-num(v))}` : money(v));
  const term = q.trim().toLowerCase();
  const list = rows.filter((r) => !term || [r.code, r.name, r.phone].join(' ').toLowerCase().includes(term)).sort((a, b) => num(b.balance) - num(a.balance));
  const listReport = () => ({ title: T.rList, filename: 'suppliers', filtersText: q, columns: [
    { key: 'code', header: T.code, width: 12 }, { key: 'name', header: T.name, width: 24 }, { key: 'phone', header: T.phone, width: 14 }, { key: 'inv', header: T.invoices, type: 'number' },
    { key: 'total', header: T.total, type: 'money' }, { key: 'paid', header: T.paid, type: 'money' }, { key: 'due', header: T.due, type: 'money' }
  ], rows: list.map((r) => ({ code: r.code, name: r.name, phone: r.phone || '', inv: r.invoices, total: num(r.total), paid: num(r.paid), due: num(r.balance) })),
  totals: { total: list.reduce((a, r) => a + num(r.total), 0), paid: list.reduce((a, r) => a + num(r.paid), 0), due: list.reduce((a, r) => a + num(r.balance), 0) } });
  const stmtReport = () => ({ title: `${T.rStmt} - ${sel.name}`, filename: 'supplier-statement', columns: [
    { key: 'date', header: T.date, width: 12 }, { key: 'type', header: T.type, width: 14 }, { key: 'ref', header: T.ref, width: 22 }, { key: 'd', header: T.debit, type: 'money' },
    { key: 'c', header: T.credit, type: 'money' }, { key: 'bal', header: T.balance, type: 'money' }
  ], rows: (st?.entries || []).map((e) => ({ date: e.date, type: e.kind === 'INVOICE' ? T.inv : `${T.pay} (${e.method || ''})`, ref: e.ref || '', d: e.kind === 'INVOICE' ? num(e.amount) : 0, c: e.kind === 'PAYMENT' ? num(e.amount) : 0, bal: num(e.balance) })) });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const Back = isRTL ? ArrowRight : ArrowLeft;

  if (sel) {
    const invs = (st?.entries || []).filter((e) => e.kind === 'INVOICE');
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => { setSel(null); load(); }} className="h-8 px-3 mb-2 rounded-lg border border-slate-300 bg-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Back size={14} /> {T.back}</button>
            <h1 className="text-xl font-black text-slate-800">{sel.name} <span className="text-sm font-mono text-slate-500">({sel.code})</span></h1>
            <div className="text-xs text-slate-600 font-mono mt-1">{sel.phone}</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div className="text-[11px] text-slate-500 font-bold">{T.due}</div><div className="text-xl font-black text-rose-700">{st ? balText(st.balance) : '...'} <span className="text-xs">{T.cur}</span></div></div>
        </div>
        {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
        {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between"><div className="text-sm font-bold">{T.statement}</div>{st && <ExportButtons getReport={stmtReport} />}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.type}</th><th className="p-2 text-start">{T.ref}</th><th className="p-2 text-center">{T.debit}</th><th className="p-2 text-center">{T.credit}</th><th className="p-2 text-center">{T.balance}</th></tr></thead>
                <tbody>{(st?.entries || []).map((e) => (
                  <React.Fragment key={e.kind + e.id}>
                    <tr onClick={() => e.kind === 'INVOICE' && setOpenId(openId === e.id ? null : e.id)} className={`border-b border-slate-100 ${e.kind === 'INVOICE' ? 'cursor-pointer hover:bg-slate-50' : 'bg-emerald-50/40'}`}>
                      <td className="p-2 whitespace-nowrap">{e.date}</td>
                      <td className="p-2 font-bold">{e.kind === 'INVOICE' ? T.inv : `${T.pay} · ${e.method || ''}`}{e.by ? <div className="text-[10px] text-slate-500 font-normal">{T.by}: {e.by}</div> : null}</td>
                      <td className="p-2 font-mono">{e.ref || '—'}{e.notes ? <div className="text-[10px] text-slate-500 font-sans">{e.notes}</div> : null}</td>
                      <td className="p-2 text-center">{e.kind === 'INVOICE' ? money(e.amount) : ''}</td>
                      <td className="p-2 text-center text-emerald-700 font-bold">{e.kind === 'PAYMENT' ? money(e.amount) : ''}</td>
                      <td className="p-2 text-center font-bold">{balText(e.balance)}</td>
                    </tr>
                    {openId === e.id && (
                      <tr><td colSpan={6} className="p-2 bg-slate-50">{(e.lines || []).map((l, i) => <div key={i} className="flex justify-between py-0.5"><span>{l.desc || '—'}{num(l.kg) > 0 ? ` · ${Number(l.kg)} ${T.kg}` : ''}</span><span className="font-bold">{l.total ? money(l.total) : ''}</span></div>)}</td></tr>
                    )}
                  </React.Fragment>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="text-sm font-bold">{T.payTitle}</div>
            <label className="font-bold text-slate-600 space-y-1 block">{T.amount}<input type="number" min="0" step="0.01" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: e.target.value })} className={input + ' w-full'} /></label>
            <label className="font-bold text-slate-600 space-y-1 block">{T.method}<select value={pf.method} onChange={(e) => setPf({ ...pf, method: e.target.value })} className={input + ' w-full'}>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label className="font-bold text-slate-600 space-y-1 block">{T.forInv}<select value={pf.invoice} onChange={(e) => setPf({ ...pf, invoice: e.target.value })} className={input + ' w-full'}><option value="">{T.noInv}</option>{invs.map((i) => <option key={i.id} value={i.id}>{i.ref} · {money(i.amount)}</option>)}</select></label>
            <label className="font-bold text-slate-600 space-y-1 block">{T.notes}<input value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} className={input + ' w-full'} /></label>
            <button type="button" disabled={busy || !(num(pf.amount) > 0) || !pf.method} onClick={doPay} className="w-full h-10 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-bold cursor-pointer">{T.confirm}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200"><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck size={20} className="text-emerald-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.count}</div><div className="text-xl font-black mt-1">{rows.length}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.total}</div><div className="text-xl font-black mt-1">{money(rows.reduce((a, r) => a + num(r.total), 0))}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.paid}</div><div className="text-xl font-black mt-1 text-emerald-800">{money(rows.reduce((a, r) => a + num(r.paid), 0))}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.due}</div><div className="text-xl font-black mt-1 text-rose-700">{money(rows.reduce((a, r) => a + Math.max(0, num(r.balance)), 0))}</div></div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} /></div>
          <ExportButtons getReport={listReport} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.name}</th><th className="p-2 text-start">{T.phone}</th><th className="p-2 text-center">{T.invoices}</th><th className="p-2 text-center">{T.total}</th><th className="p-2 text-center">{T.paid}</th><th className="p-2 text-center">{T.due}</th><th className="p-2 text-start">{T.last}</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
              {list.map((r) => (
                <tr key={r.id} onClick={() => openSup(r)} className="border-b border-slate-100 cursor-pointer hover:bg-emerald-50">
                  <td className="p-2 font-mono font-bold">{r.code}</td><td className="p-2 font-bold">{r.name}</td><td className="p-2 font-mono">{r.phone || '—'}</td><td className="p-2 text-center">{r.invoices}</td>
                  <td className="p-2 text-center">{money(r.total)}</td><td className="p-2 text-center text-emerald-700">{money(r.paid)}</td>
                  <td className={`p-2 text-center font-bold ${num(r.balance) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{balText(r.balance)}</td><td className="p-2">{r.last || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}