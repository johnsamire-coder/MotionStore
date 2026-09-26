// TREASURY_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Vault, ArrowLeftRight, X } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const TYPES = { POS_DRAWER: { ar: 'درج كاشير', en: 'Cash drawer' }, MAIN_SAFE: { ar: 'خزينة رئيسية', en: 'Main safe' }, BANK: { ar: 'بنك / إلكتروني', en: 'Bank / e-wallet' } };
const DOCS = { SaleInvoice: 'مبيعات', SalesReturn: 'مرتجع', Expense: 'مصروف', ExpenseCancel: 'إلغاء مصروف', DeferredSale: 'عربون مؤجلة', CustomerPayment: 'تحصيل عميل', SupplierPayment: 'دفع لمورد',
  ShiftOpeningAdjust: 'تظبيط افتتاح', ShiftOpening: 'افتتاح (قديم)', OwnerDrawing: 'ترحيل لصاحب المحل', ShiftShortage: 'عجز على كاشير', ShiftSurplus: 'زيادة خزينة', CustodySettle: 'تسديد عهدة', ManualDeposit: 'إيداع يدوي', ManualWithdrawal: 'سحب يدوي' };
const TX = {
  ar: { title: 'الخزينة', sub: 'أرصدة كل الخزن، والتحويل، والإيداع والسحب، وكشف كل خزنة، وعهد الكاشيرية', tTr: 'الخزن', tCu: 'عهد الكاشيرية', total: 'إجمالي كل الخزن', transfer: 'تحويل', adjust: 'إيداع / سحب',
    from: 'من', to: 'إلى', amount: 'المبلغ', notes: 'ملاحظات', reason: 'السبب', deposit: 'إيداع', withdraw: 'سحب', mgr: 'باسورد المدير', confirm: 'تأكيد', cancel: 'إلغاء', stmt: 'كشف', dFrom: 'من تاريخ', dTo: 'إلى تاريخ', show: 'عرض',
    opening: 'رصيد أول المدة', date: 'التاريخ', kind: 'الحركة', desc: 'البيان', bal: 'الرصيد', none: 'مفيش حركات', cashier: 'الكاشير', shift: 'الوردية', open: 'مفتوحة', settled: 'اتسددت', settle: 'تسديد', into: 'تدخل خزنة',
    noCu: 'مفيش عهد', done: 'تم ✅', failed: 'حصلت مشكلة: ', cur: 'ج.م', pick: 'دوس على خزنة عشان تشوف كشفها' },
  en: { title: 'Treasury', sub: 'All balances, transfers, deposits/withdrawals, statements and cashier custodies', tTr: 'Treasuries', tCu: 'Cashier custodies', total: 'Total of all treasuries', transfer: 'Transfer', adjust: 'Deposit / Withdraw',
    from: 'From', to: 'To', amount: 'Amount', notes: 'Notes', reason: 'Reason', deposit: 'Deposit', withdraw: 'Withdraw', mgr: 'Manager password', confirm: 'Confirm', cancel: 'Cancel', stmt: 'Statement', dFrom: 'From', dTo: 'To', show: 'Show',
    opening: 'Opening balance', date: 'Date', kind: 'Movement', desc: 'Description', bal: 'Balance', none: 'No movements', cashier: 'Cashier', shift: 'Shift', open: 'Open', settled: 'Settled', settle: 'Settle', into: 'Into treasury',
    noCu: 'No custodies', done: 'Done ✅', failed: 'Something went wrong: ', cur: 'EGP', pick: 'Click a treasury to see its statement' }
};

export default function TreasuryPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [tab, setTab] = useState('TR');
  const [trs, setTrs] = useState([]);
  const [sel, setSel] = useState(null);
  const [st, setSt] = useState(null);
  const [sf, setSf] = useState({ from: monthStart(), to: today() });
  const [modal, setModal] = useState(null);
  const [mf, setMf] = useState({});
  const [cus, setCus] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const load = async () => { try { const r = await axiosClient.get('/treasuries/'); setTrs(listOf(r.data)); } catch (e) { setErr(T.failed + e.message); } };
  const loadSt = async (t = sel, x = sf) => { if (!t) return; try { const r = await axiosClient.get(`/treasuries/${t.id}/statement/?date_from=${x.from}&date_to=${x.to}`); setSt(r.data); } catch (e) { setErr(T.failed + e.message); } };
  const loadCu = async () => { try { const r = await axiosClient.get('/treasuries/custodies/'); setCus(r.data || []); } catch (e) { setErr(T.failed + e.message); } };
  useEffect(() => { load(); loadCu(); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const submit = async () => {
    setErr('');
    try {
      if (modal.kind === 'transfer') await axiosClient.post('/treasuries/transfer/', { from_id: mf.from, to_id: mf.to, amount: mf.amount, notes: mf.notes, manager_password: mf.pwd });
      if (modal.kind === 'adjust') await axiosClient.post('/treasuries/adjust/', { treasury_id: mf.tid, kind: mf.type, amount: mf.amount, reason: mf.reason, manager_password: mf.pwd });
      if (modal.kind === 'settle') await axiosClient.post('/treasuries/settle_custody/', { custody_id: modal.cu.id, treasury_id: mf.tid, amount: mf.amount });
      setModal(null); flash(T.done); await load(); loadCu(); if (sel) loadSt();
    } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); }
  };
  const openModal = (kind, extra = {}) => { setErr(''); const a = trs[0] ? trs[0].id : ''; const b = trs[1] ? trs[1].id : ''; setMf({ from: a, to: b, tid: a, type: 'DEPOSIT', amount: extra.amount || '', notes: '', reason: '', pwd: '' }); setModal({ kind, ...extra }); };
  const report = () => ({ title: `${T.stmt} - ${st.treasury}`, filename: 'treasury-statement', filtersText: `${sf.from} → ${sf.to}`, columns: [
    { key: 'date', header: T.date, width: 16 }, { key: 'kind', header: T.kind, width: 16 }, { key: 'desc', header: T.desc, width: 40 }, { key: 'amount', header: T.amount, type: 'money' }, { key: 'bal', header: T.bal, type: 'money' }
  ], rows: st.rows.map((r) => ({ date: dt(r.date), kind: DOCS[r.doc] || r.doc || r.type, desc: r.desc, amount: num(r.amount), bal: num(r.balance) })) });
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const groups = ['POS_DRAWER', 'MAIN_SAFE', 'BANK'];
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Vault size={20} className="text-emerald-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
        <div className="flex gap-2">
          {['TR', 'CU'].map((k) => <button key={k} type="button" onClick={() => setTab(k)} className={`h-10 px-4 rounded-lg border text-xs font-bold cursor-pointer ${tab === k ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300'}`}>{k === 'TR' ? T.tTr : `${T.tCu} (${cus.filter((c) => c.status === 'OPEN').length})`}</button>)}
        </div>
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
      {err && !modal && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
      {tab === 'TR' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-sm font-bold text-emerald-900">{T.total}: <span className="text-xl">{money(trs.reduce((a, t) => a + num(t.current_balance), 0))}</span> {T.cur}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openModal('transfer')} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><ArrowLeftRight size={14} /> 🔒 {T.transfer}</button>
              <button type="button" onClick={() => openModal('adjust')} className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">🔒 {T.adjust}</button>
            </div>
          </div>
          {groups.map((g) => trs.filter((t) => t.treasury_type === g).length > 0 && (
            <div key={g} className="space-y-2">
              <div className="text-xs font-bold text-slate-500">{TYPES[g][lang] || TYPES[g].ar}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {trs.filter((t) => t.treasury_type === g).map((t) => (
                  <button key={t.id} type="button" onClick={() => { setSel(t); loadSt(t); }} className={`text-start p-3 rounded-xl border cursor-pointer ${sel && sel.id === t.id ? 'border-emerald-600 border-2 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                    <div className="text-sm font-bold">{t.name}</div><div className="text-lg font-black mt-1">{money(t.current_balance)} <span className="text-xs text-slate-500">{T.cur}</span></div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            {!sel ? <div className="text-xs text-slate-500">{T.pick}</div> : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="text-sm font-bold flex-1">{T.stmt}: {sel.name}</div>
                  <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.dFrom}<input type="date" value={sf.from} onChange={(e) => setSf({ ...sf, from: e.target.value })} className={input} /></label>
                  <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.dTo}<input type="date" value={sf.to} onChange={(e) => setSf({ ...sf, to: e.target.value })} className={input} /></label>
                  <button type="button" onClick={() => loadSt()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
                  {st && <ExportButtons getReport={report} />}
                </div>
                {st && (
                  <div className="overflow-x-auto">
                    <div className="text-xs font-bold mb-2">{T.opening}: {money(st.opening)}</div>
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.kind}</th><th className="p-2 text-start">{T.desc}</th><th className="p-2 text-center">{T.amount}</th><th className="p-2 text-center">{T.bal}</th></tr></thead>
                      <tbody>
                        {st.rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
                        {st.rows.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100"><td className="p-2 whitespace-nowrap">{dt(r.date)}</td><td className="p-2 font-bold">{DOCS[r.doc] || r.doc || r.type}</td><td className="p-2">{r.desc}</td>
                            <td className={`p-2 text-center font-bold ${num(r.amount) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(r.amount)}</td><td className="p-2 text-center font-bold">{money(r.balance)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
      {tab === 'CU' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.cashier}</th><th className="p-2 text-start">{T.shift}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.notes}</th><th className="p-2 text-center">{T.amount}</th><th className="p-2"></th></tr></thead>
            <tbody>
              {cus.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">{T.noCu}</td></tr>}
              {cus.map((c) => (
                <tr key={c.id} className={`border-b border-slate-100 ${c.status !== 'OPEN' ? 'text-slate-400' : ''}`}>
                  <td className="p-2 font-bold">{c.cashier}</td><td className="p-2 font-mono">{c.shift || '—'}</td><td className="p-2">{dt(c.date)}</td><td className="p-2">{c.notes}</td>
                  <td className={`p-2 text-center font-bold ${c.status === 'OPEN' ? 'text-rose-700' : ''}`}>{money(c.amount)}</td>
                  <td className="p-2">{c.status === 'OPEN' ? <button type="button" onClick={() => openModal('settle', { cu: c, amount: c.amount })} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">{T.settle}</button> : <span>{T.settled} {dt(c.settled_at)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{modal.kind === 'transfer' ? `🔒 ${T.transfer}` : modal.kind === 'adjust' ? `🔒 ${T.adjust}` : `${T.settle}: ${modal.cu.cashier}`}</div><button type="button" onClick={() => setModal(null)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            {modal.kind === 'transfer' && (<>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<select value={mf.from} onChange={(e) => setMf({ ...mf, from: e.target.value })} className={input + ' w-full'}>{trs.map((t) => <option key={t.id} value={t.id}>{t.name} — {money(t.current_balance)}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<select value={mf.to} onChange={(e) => setMf({ ...mf, to: e.target.value })} className={input + ' w-full'}>{trs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            </>)}
            {modal.kind === 'adjust' && (<>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.tTr}<select value={mf.tid} onChange={(e) => setMf({ ...mf, tid: e.target.value })} className={input + ' w-full'}>{trs.map((t) => <option key={t.id} value={t.id}>{t.name} — {money(t.current_balance)}</option>)}</select></label>
              <div className="flex gap-2">{['DEPOSIT', 'WITHDRAWAL'].map((k) => <button key={k} type="button" onClick={() => setMf({ ...mf, type: k })} className={`flex-1 h-9 rounded-lg border text-xs font-bold cursor-pointer ${mf.type === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{k === 'DEPOSIT' ? T.deposit : T.withdraw}</button>)}</div>
              <input value={mf.reason} onChange={(e) => setMf({ ...mf, reason: e.target.value })} placeholder={T.reason} className={input + ' w-full'} />
            </>)}
            {modal.kind === 'settle' && <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.into}<select value={mf.tid} onChange={(e) => setMf({ ...mf, tid: e.target.value })} className={input + ' w-full'}>{trs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
            <input type="number" min="0" step="0.01" value={mf.amount} onChange={(e) => setMf({ ...mf, amount: e.target.value })} placeholder={T.amount} className={input + ' w-full font-bold'} />
            {modal.kind === 'transfer' && <input value={mf.notes} onChange={(e) => setMf({ ...mf, notes: e.target.value })} placeholder={T.notes} className={input + ' w-full'} />}
            {modal.kind !== 'settle' && <input type="password" value={mf.pwd} onChange={(e) => setMf({ ...mf, pwd: e.target.value })} placeholder={T.mgr} className={input + ' w-full text-center'} />}
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={!(num(mf.amount) > 0) || (modal.kind !== 'settle' && !mf.pwd) || (modal.kind === 'adjust' && !mf.reason.trim())} onClick={submit} className="flex-1 h-11 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white text-sm font-bold cursor-pointer">{T.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}