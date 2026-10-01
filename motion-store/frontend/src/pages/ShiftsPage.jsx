// RECEIPT_PATCHED
// SHIFTS_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { getCompanyInfo } from '../utils/reportExport';
import { Clock, Printer, RefreshCw, Plus, Trash2 } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const TX = {
  ar: { title: 'الورديات', sub: 'فتح وقفل الوردية بالعدّ الفعلي، والترحيل، وتقرير الوردية', terminal: 'نقطة البيع', noShift: 'مفيش وردية مفتوحة', open: 'فتح وردية', drawerBal: 'رصيد الدرج دلوقتي', counted: 'اللي اتعدّ في الدرج',
    mgr: 'باسورد المدير', mgrNeeded: 'فيه فرق عن رصيد الدرج: محتاج باسورد المدير', openBtn: 'فتح الوردية', current: 'الوردية الحالية', refresh: 'تحديث', opening: 'الافتتاح', sales: 'المبيعات', invoices: 'فاتورة', byMethod: 'حسب طريقة الدفع', moves: 'حركات الدرج', expected: 'المتوقع في الدرج',
    close: 'قفل الوردية', actual: 'اللي اتعدّ فعلاً', diff: 'الفرق', short: 'عجز', over: 'زيادة', onCashier: 'على الكاشير (عهدة)', onShop: 'على المحل (مصروف - بباسورد المدير)', handovers: 'الترحيل', addH: '+ ترحيل',
    toTreasury: 'لخزنة', toOwner: 'لصاحب المحل', amount: 'المبلغ', notes: 'ملاحظات', remain: 'هيفضل في الدرج للوردية الجاية', confirmClose: 'تأكيد قفل الوردية', history: 'سجل الورديات', from: 'من', to: 'إلى', show: 'عرض',
    code: 'الوردية', cashier: 'الكاشير', openedAt: 'الفتح', closedAt: 'القفل', handed: 'اترحّل', status: 'الحالة', OPEN: 'مفتوحة', CLOSED: 'مقفولة', print: 'طباعة التقرير', report: 'تقرير وردية', cur: 'ج.م', failed: 'حصلت مشكلة: ', done: 'اتقفلت الوردية ✅' },
  en: { title: 'Shifts', sub: 'Open and close shifts with a real count, handovers and a shift report', terminal: 'Terminal', noShift: 'No open shift', open: 'Open shift', drawerBal: 'Drawer balance now', counted: 'Counted in drawer',
    mgr: 'Manager password', mgrNeeded: 'Different from the drawer balance: manager password needed', openBtn: 'Open shift', current: 'Current shift', refresh: 'Refresh', opening: 'Opening', sales: 'Sales', invoices: 'invoices', byMethod: 'By payment method', moves: 'Drawer movements', expected: 'Expected in drawer',
    close: 'Close shift', actual: 'Actually counted', diff: 'Difference', short: 'Shortage', over: 'Surplus', onCashier: 'On the cashier (custody)', onShop: 'On the shop (expense - manager password)', handovers: 'Handovers', addH: '+ Handover',
    toTreasury: 'To treasury', toOwner: 'To owner', amount: 'Amount', notes: 'Notes', remain: 'Stays in drawer for next shift', confirmClose: 'Confirm close', history: 'Shifts history', from: 'From', to: 'To', show: 'Show',
    code: 'Shift', cashier: 'Cashier', openedAt: 'Opened', closedAt: 'Closed', handed: 'Handed over', status: 'Status', OPEN: 'Open', CLOSED: 'Closed', print: 'Print report', report: 'Shift report', cur: 'EGP', failed: 'Something went wrong: ', done: 'Shift closed ✅' }
};

export default function ShiftsPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [terms, setTerms] = useState([]);
  const [termId, setTermId] = useState('');
  const [trs, setTrs] = useState([]);
  const [shift, setShift] = useState(null);
  const [sum, setSum] = useState(null);
  const [counted, setCounted] = useState('');
  const [pwd, setPwd] = useState('');
  const [actual, setActual] = useState('');
  const [mode, setMode] = useState('CASHIER');
  const [hand, setHand] = useState([]);
  const [hist, setHist] = useState([]);
  const [hf, setHf] = useState({ from: today(), to: today() });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const term = terms.find((t) => t.id === termId);
  const drawer = term ? trs.find((x) => String(x.id) === String(term.cash_drawer)) : null;

  const loadTrs = async () => { const r = await axiosClient.get('/treasuries/'); setTrs(listOf(r.data)); };
  const loadShift = async (tid = termId) => {
    if (!tid) return;
    setErr(''); await loadTrs();
    const r = await axiosClient.get(`/shifts/?terminal=${tid}&status=OPEN&all=1`);
    const sh = listOf(r.data).find((x) => String(x.terminal) === String(tid) && x.status === 'OPEN') || null;
    setShift(sh); setSum(null);
    if (sh) { const s = await axiosClient.get(`/shifts/${sh.id}/summary/`); setSum(s.data); }
  };
  const loadHist = async (x = hf) => {
    const p = new URLSearchParams({ all: '1' }); if (termId) p.append('terminal', termId); if (x.from) p.append('date_from', x.from); if (x.to) p.append('date_to', x.to);
    try { const r = await axiosClient.get(`/shifts/?${p.toString()}`); setHist(listOf(r.data)); } catch (e) { /* ignore */ }
  };
  useEffect(() => { (async () => {
    try {
      const r = await axiosClient.get('/pos-terminals/'); const l = listOf(r.data); setTerms(l);
      let saved = null; try { saved = localStorage.getItem('ms_pos_terminal'); } catch (e) { saved = null; }
      const t = l.find((x) => x.id === saved) || l[0]; if (t) setTermId(t.id);
    } catch (e) { setErr(T.failed + e.message); }
  })(); }, []);
  useEffect(() => { if (termId) { loadShift(termId); loadHist(); } }, [termId]);
  useEffect(() => { if (drawer && !shift) setCounted(String(drawer.current_balance)); }, [drawer?.id, drawer?.current_balance, shift?.id]);

  const printReport = async (s) => {
    const co = await getCompanyInfo();
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const row = (a, b) => `<tr><td>${a}</td><td style="text-align:left">${b}</td></tr>`;
    const sh = s.shift;
    const html = `<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(sh.shift_code)}</title><style>@page{size:${((typeof co !== 'undefined' && co) && co.paperMm) || 80}mm auto;margin:3mm} body{font-family:Tahoma,Arial,sans-serif;width:${((typeof co !== 'undefined' && co) && co.bodyMm) || 74}mm;margin:0;font-size:12px} table{width:100%;border-collapse:collapse} td{padding:2px 0} .c{text-align:center} hr{border:0;border-top:1px dashed #000} .b{font-weight:700}</style></head><body>
      <div class="c"><div class="b" style="font-size:14px">${esc(co.name)}</div>${((typeof co !== 'undefined' && co) && co.headerHtml) || ''}<div class="b">${T.report}</div><div>${esc(sh.shift_code)}</div><div>${esc(s.drawer)}</div></div><hr>
      <table>${row(T.openedAt, dt(sh.opened_at))}${row(T.closedAt, dt(sh.closed_at))}${row(T.opening, money(s.opening))}${row(T.sales, `${money(s.sales_total)} (${s.invoices})`)}</table><hr>
      <div class="b">${T.byMethod}</div><table>${(s.by_method || []).map((m) => row(esc(m.method), money(m.amount))).join('')}</table><hr>
      <div class="b">${T.moves}</div><table>${(s.moves || []).map((m) => row(esc(m.label), money(m.amount))).join('')}</table><hr>
      <table class="b">${row(T.expected, money(sh.expected_cash ?? s.expected))}${sh.actual_cash != null ? row(T.actual, money(sh.actual_cash)) + row(T.diff, money(sh.difference)) : ''}${num(sh.handover_total) ? row(T.handed, money(sh.handover_total)) : ''}${s.remaining_in_drawer != null ? row(T.remain, money(s.remaining_in_drawer)) : ''}</table><hr>
      <div style="margin-top:14px">${T.cashier}: ${esc(sh.cashier_username || sh.cashier || '')} ..............</div>
      ${((typeof co !== 'undefined' && co) && co.footerHtml) || ''}<script>window.onafterprint=function(){setTimeout(function(){window.close()},10000)};window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=380,height=640'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };

  const doOpen = async () => {
    setBusy(true); setErr('');
    try { await axiosClient.post('/shifts/open_v2/', { terminal_id: termId, counted_cash: counted, manager_password: pwd || undefined }); setPwd(''); await loadShift(); loadHist(); }
    catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };
  const expected = sum ? num(sum.expected) : 0;
  const diff = actual === '' ? 0 : Math.round((num(actual) - expected) * 100) / 100;
  const htotal = hand.reduce((a, h) => a + num(h.amount), 0);
  const remain = Math.round((num(actual) - htotal) * 100) / 100;
  const doClose = async () => {
    setBusy(true); setErr('');
    try {
      const r = await axiosClient.post(`/shifts/${shift.id}/close_v2/`, { actual_cash: actual, shortage_mode: diff < 0 ? mode : '', manager_password: pwd || undefined, handovers: hand.filter((h) => num(h.amount) > 0).map((h) => ({ destination: h.dest, treasury_id: h.dest === 'TREASURY' ? h.tid : null, amount: num(h.amount).toFixed(2), notes: h.notes })) });
      setMsg(T.done); setTimeout(() => setMsg(''), 4000); setActual(''); setHand([]); setPwd(''); await printReport(r.data); await loadShift(); loadHist();
    } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };
  const openHist = async (s) => { try { const r = await axiosClient.get(`/shifts/${s.id}/summary/`); await printReport(r.data); } catch (e) { setErr(T.failed + e.message); } };
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const others = trs.filter((x) => !drawer || x.id !== drawer.id);
  const needMgrOpen = drawer && counted !== '' && Math.abs(num(counted) - num(drawer.current_balance)) >= 0.01;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Clock size={20} className="text-emerald-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.terminal}<select value={termId} onChange={(e) => setTermId(e.target.value)} className={input + ' w-64 block'}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}

      {!shift && term && (
        <div className="bg-white p-4 rounded-xl border border-amber-300 space-y-3 max-w-lg">
          <div className="text-sm font-bold text-amber-800">{T.noShift} — {T.open}</div>
          <div className="text-sm">{T.drawerBal}: <b className="text-lg">{drawer ? money(drawer.current_balance) : '—'}</b> {T.cur}</div>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.counted}<input type="number" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} className={input + ' w-full font-bold'} /></label>
          {needMgrOpen && (<><div className="text-xs font-bold text-rose-700">{T.mgrNeeded}</div><input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={T.mgr} className={input + ' w-full'} /></>)}
          <button type="button" disabled={busy || (needMgrOpen && !pwd)} onClick={doOpen} className="w-full h-11 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white font-bold cursor-pointer">{T.openBtn}</button>
        </div>
      )}

      {shift && sum && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between"><div className="text-sm font-bold">{T.current}: <span className="font-mono">{shift.shift_code}</span></div><button type="button" onClick={() => loadShift()} className="h-8 px-3 rounded-lg border border-slate-300 bg-white font-bold flex items-center gap-1 cursor-pointer"><RefreshCw size={13} /> {T.refresh}</button></div>
            <div className="text-slate-600">{T.openedAt}: {dt(shift.opened_at)} · {T.cashier}: {shift.cashier_username || '—'}</div>
            <div className="flex justify-between"><span>{T.opening}</span><b>{money(sum.opening)}</b></div>
            <div className="flex justify-between"><span>{T.sales}</span><b>{money(sum.sales_total)} ({sum.invoices} {T.invoices})</b></div>
            <div className="font-bold border-t border-slate-100 pt-2">{T.byMethod}</div>
            {(sum.by_method || []).map((m) => <div key={m.method} className="flex justify-between"><span>{m.method}</span><b>{money(m.amount)}</b></div>)}
            <div className="font-bold border-t border-slate-100 pt-2">{T.moves}</div>
            {(sum.moves || []).map((m) => <div key={m.key} className="flex justify-between"><span>{m.label}</span><b className={num(m.amount) < 0 ? 'text-rose-700' : 'text-emerald-700'}>{money(m.amount)}</b></div>)}
            <div className="flex justify-between text-base font-black bg-emerald-50 rounded-lg p-2 mt-2"><span>{T.expected}</span><span>{money(sum.expected)} {T.cur}</span></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="text-sm font-bold">{T.close}</div>
            <label className="font-bold text-slate-600 space-y-1 block">{T.actual}<input type="number" min="0" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} className={input + ' w-full text-lg font-bold'} /></label>
            {actual !== '' && <div className={`text-sm font-black ${diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{T.diff}: {money(diff)} {diff < 0 ? `(${T.short})` : diff > 0 ? `(${T.over})` : '✅'}</div>}
            {diff < 0 && (
              <div className="space-y-2 border border-rose-200 rounded-lg p-2">
                <label className="flex items-center gap-2 font-bold"><input type="radio" checked={mode === 'CASHIER'} onChange={() => setMode('CASHIER')} /> {T.onCashier}</label>
                <label className="flex items-center gap-2 font-bold"><input type="radio" checked={mode === 'SHOP'} onChange={() => setMode('SHOP')} /> {T.onShop}</label>
                {mode === 'SHOP' && <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={T.mgr} className={input + ' w-full'} />}
              </div>
            )}
            <div className="flex items-center justify-between"><div className="font-bold">{T.handovers}</div><button type="button" onClick={() => setHand([...hand, { key: Date.now(), dest: 'TREASURY', tid: others[0] ? others[0].id : '', amount: '', notes: '' }])} className="h-8 px-2 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"><Plus size={12} /> {T.addH}</button></div>
            {hand.map((h) => (
              <div key={h.key} className="grid grid-cols-12 gap-1 items-center">
                <select value={h.dest} onChange={(e) => setHand(hand.map((x) => (x.key === h.key ? { ...x, dest: e.target.value } : x)))} className={input + ' col-span-3 h-9 text-xs'}><option value="TREASURY">{T.toTreasury}</option><option value="OWNER">{T.toOwner}</option></select>
                {h.dest === 'TREASURY' ? <select value={h.tid} onChange={(e) => setHand(hand.map((x) => (x.key === h.key ? { ...x, tid: e.target.value } : x)))} className={input + ' col-span-4 h-9 text-xs'}>{others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  : <input value={h.notes} onChange={(e) => setHand(hand.map((x) => (x.key === h.key ? { ...x, notes: e.target.value } : x)))} placeholder={T.notes} className={input + ' col-span-4 h-9 text-xs'} />}
                <input type="number" min="0" step="0.01" value={h.amount} onChange={(e) => setHand(hand.map((x) => (x.key === h.key ? { ...x, amount: e.target.value } : x)))} placeholder={T.amount} className={input + ' col-span-4 h-9 text-xs'} />
                <button type="button" onClick={() => setHand(hand.filter((x) => x.key !== h.key))} aria-label="remove" className="col-span-1 h-9 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={12} /></button>
              </div>
            ))}
            {actual !== '' && <div className={`flex justify-between text-sm font-black rounded-lg p-2 ${remain < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50'}`}><span>{T.remain}</span><span>{money(remain)} {T.cur}</span></div>}
            <button type="button" disabled={busy || actual === '' || remain < 0 || (diff < 0 && mode === 'SHOP' && !pwd)} onClick={doClose} className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-black cursor-pointer">{T.confirmClose}</button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="text-sm font-bold flex-1">{T.history}</div>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={hf.from} onChange={(e) => setHf({ ...hf, from: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={hf.to} onChange={(e) => setHf({ ...hf, to: e.target.value })} className={input} /></label>
          <button type="button" onClick={() => loadHist()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.cashier}</th><th className="p-2 text-start">{T.openedAt}</th><th className="p-2 text-start">{T.closedAt}</th><th className="p-2 text-center">{T.opening}</th><th className="p-2 text-center">{T.expected}</th><th className="p-2 text-center">{T.actual}</th><th className="p-2 text-center">{T.diff}</th><th className="p-2 text-center">{T.handed}</th><th className="p-2"></th></tr></thead>
            <tbody>{hist.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="p-2 font-mono font-bold">{s.shift_code}<div className="text-[10px] text-slate-500 font-sans">{T[s.status] || s.status}</div></td><td className="p-2">{s.cashier_username || '—'}</td><td className="p-2">{dt(s.opened_at)}</td><td className="p-2">{dt(s.closed_at)}</td>
                <td className="p-2 text-center">{money(s.opening_cash)}</td><td className="p-2 text-center">{s.status === 'CLOSED' ? money(s.expected_cash) : '—'}</td><td className="p-2 text-center">{s.actual_cash != null ? money(s.actual_cash) : '—'}</td>
                <td className={`p-2 text-center font-bold ${num(s.difference) < 0 ? 'text-rose-700' : num(s.difference) > 0 ? 'text-amber-700' : ''}`}>{s.status === 'CLOSED' ? money(s.difference) : '—'}</td><td className="p-2 text-center">{money(s.handover_total)}</td>
                <td className="p-2"><button type="button" onClick={() => openHist(s)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold flex items-center gap-1 cursor-pointer"><Printer size={12} /> {T.print}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}