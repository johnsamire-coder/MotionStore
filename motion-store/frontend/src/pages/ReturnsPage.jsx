// RETURNS_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { getCompanyInfo } from '../utils/reportExport';
import { Search, Printer, RotateCcw } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kgf = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const TERM_KEY = 'ms_pos_terminal';
const TX = {
  ar: { title: 'المرتجعات', sub: 'مرتجع من فاتورة معينة، والفلوس بترجع بعد الخصم', tNew: 'مرتجع جديد', tLog: 'سجل المرتجعات', terminal: 'نقطة البيع', shift: 'الوردية',
    noShift: 'مفيش وردية مفتوحة لنقطة البيع دي. افتح وردية من شاشة المبيعات الأول.', search: 'رقم الفاتورة أو تليفون العميل أو كوده...', find: 'بحث', noFound: 'مفيش فواتير',
    customer: 'العميل', walkin: 'عميل نقدي', date: 'التاريخ', total: 'الإجمالي', pays: 'الدفع', item: 'الصنف', sold: 'اتباع', returned: 'اترجع قبل كده', left: 'فاضل', back: 'هيرجع', refund: 'المبلغ',
    pcs: 'قطعة', kg: 'كجم', refundHow: 'ترد الفلوس إزاي', toAccount: 'خصم من حساب العميل', reason: 'سبب المرتجع', reasonPh: 'مثلاً: مقاس، عيب...', totalRefund: 'إجمالي اللي هيرجع للعميل',
    confirm: 'تأكيد المرتجع', saving: 'جاري الحفظ...', done: 'تم المرتجع', failed: 'حصلت مشكلة: ', from: 'من تاريخ', to: 'إلى تاريخ', show: 'عرض', retNo: 'رقم المرتجع', invNo: 'الفاتورة',
    method: 'طريقة الرد', cashier: 'الكاشير', none: 'مفيش مرتجعات', reprint: 'إعادة طباعة', cur: 'ج.م', rTitle: 'تقرير المرتجعات', receipt: 'إيصال مرتجع', thanks: 'شكراً لزيارتكم', discNote: 'الفاتورة كان عليها خصم، فالمبلغ بيرجع بعد الخصم' },
  en: { title: 'Sales Returns', sub: 'Return from a specific invoice, refunded after discounts', tNew: 'New return', tLog: 'Returns log', terminal: 'Terminal', shift: 'Shift',
    noShift: 'No open shift for this terminal. Open a shift from the Sales screen first.', search: 'Invoice #, customer phone or code...', find: 'Find', noFound: 'No invoices',
    customer: 'Customer', walkin: 'Walk-in', date: 'Date', total: 'Total', pays: 'Payment', item: 'Item', sold: 'Sold', returned: 'Returned before', left: 'Left', back: 'Return now', refund: 'Amount',
    pcs: 'pcs', kg: 'KG', refundHow: 'Refund method', toAccount: 'Deduct from customer account', reason: 'Reason', reasonPh: 'e.g. size, defect...', totalRefund: 'Total refund to customer',
    confirm: 'Confirm return', saving: 'Saving...', done: 'Return completed', failed: 'Something went wrong: ', from: 'From', to: 'To', show: 'Show', retNo: 'Return #', invNo: 'Invoice',
    method: 'Refund method', cashier: 'Cashier', none: 'No returns', reprint: 'Reprint', cur: 'EGP', rTitle: 'Returns Report', receipt: 'Return receipt', thanks: 'Thank you', discNote: 'The invoice had a discount, so the refund is after discount' }
};

export default function ReturnsPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [tab, setTab] = useState('NEW');
  const [terminal, setTerminal] = useState(null);
  const [shift, setShift] = useState(null);
  const [methods, setMethods] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [inv, setInv] = useState(null);
  const [qty, setQty] = useState({});
  const [refundBy, setRefundBy] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lf, setLf] = useState({ from: today(), to: today(), q: '' });
  const [log, setLog] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [tr, pr] = await Promise.all([axiosClient.get('/pos-terminals/'), axiosClient.get('/payments/?is_active=true')]);
        const terms = listOf(tr.data); const pms = listOf(pr.data).filter((m) => m.method_type !== 'CREDIT');
        setMethods(pms); const cashM = pms.find((m) => m.method_type === 'CASH'); if (cashM) setRefundBy(cashM.id);
        let saved = null; try { saved = localStorage.getItem(TERM_KEY); } catch (e) { saved = null; }
        const t = terms.find((x) => x.id === saved) || terms[0] || null; setTerminal(t);
        if (t) { const sr = await axiosClient.get(`/shifts/?terminal=${t.id}&status=OPEN`); setShift(listOf(sr.data).find((x) => String(x.terminal) === String(t.id) && x.status === 'OPEN') || null); }
      } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); }
    })();
    loadLog();
    loadRecent();
  }, []);

  const loadRecent = async () => { try { const r = await axiosClient.get('/returns/invoice_lookup/?q='); setFound(listOf(r.data)); } catch (e) { console.error(e); } };
  const find = async () => {
    setErr(''); setInv(null); if (!q.trim()) { loadRecent(); return; }
    try { const r = await axiosClient.get(`/returns/invoice_lookup/?q=${encodeURIComponent(q.trim())}`); setFound(listOf(r.data)); if (listOf(r.data).length === 1 && q.trim()) pick(listOf(r.data)[0]); }
    catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); }
  };
  const pick = (x) => { setInv(x); setQty({}); setReason(''); setMsg(''); const cashM = methods.find((m) => m.method_type === 'CASH'); setRefundBy(cashM ? cashM.id : ''); };
  const ratio = inv && num(inv.subtotal) > 0 ? Math.max(0, Math.min(1, (num(inv.subtotal) - num(inv.discount_amount)) / num(inv.subtotal))) : 1;
  const lineLeft = (l) => (l.piece_mode ? num(l.quantity_pieces) - num(l.returned_pieces) : Math.max(0, num(l.weight_kg) - num(l.returned_weight)));
  const lineRefund = (l) => {
    const v = num(qty[l.id]); if (v <= 0) return 0;
    const frac = l.piece_mode ? v / num(l.quantity_pieces) : v / (num(l.weight_kg) || 1);
    return Math.round(num(l.total_price) * frac * ratio * 100) / 100;
  };
  const totalRefund = inv ? (inv.lines || []).reduce((a, l) => a + lineRefund(l), 0) : 0;
  const overLimit = inv ? (inv.lines || []).some((l) => num(qty[l.id]) > lineLeft(l) + 0.0005) : false;

  const printReturn = async (r) => {
    const co = await getCompanyInfo();
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const rows = (r.lines || []).map((l) => `<tr><td>${esc(l.display_name || l.product_name)}<br><small>${num(l.quantity_pieces) > 0 ? `${l.quantity_pieces} ${T.pcs} · ` : ''}${kgf(l.weight_kg)} ${T.kg}</small></td><td style="text-align:left">${money(l.refund_total_price)}</td></tr>`).join('');
    const html = `<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(r.return_number)}</title><style>@page{size:80mm auto;margin:3mm} body{font-family:Tahoma,Arial,sans-serif;width:74mm;margin:0;font-size:12px} table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} .c{text-align:center} hr{border:0;border-top:1px dashed #000} .b td{font-weight:700}</style></head><body>
      <div class="c">${co.logo ? `<img src="${co.logo}" style="width:48px;height:48px;object-fit:contain">` : ''}<div style="font-weight:700;font-size:14px">${esc(co.name)}</div>
      <div style="font-weight:700;margin-top:4px">${T.receipt}</div><div>${esc(r.return_number)}</div><div>${T.invNo}: ${esc(r.original_invoice_number)}</div><div>${dt(r.return_date_time)}</div>
      ${r.customer_name || r.customer_phone ? `<div>${T.customer}: ${esc([r.customer_name, r.customer_code].filter(Boolean).join(' - '))}</div><div>${esc(r.customer_phone || '')}</div>` : ''}</div><hr>
      <table>${rows}</table><hr><table class="b"><tr><td>${T.totalRefund}</td><td style="text-align:left">${money(r.total_refund_amount)} ${T.cur}</td></tr>
      <tr><td>${T.method}</td><td style="text-align:left">${r.refund_to_credit ? T.toAccount : esc(r.refund_method_name || '')}</td></tr></table>${r.reason ? `<div>${T.reason}: ${esc(r.reason)}</div>` : ''}<hr>
      <div class="c">${T.thanks}</div><script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };

  const submit = async () => {
    setBusy(true); setErr('');
    const items = (inv.lines || []).filter((l) => num(qty[l.id]) > 0).map((l) => (l.piece_mode ? { sale_line_id: l.id, quantity_pieces: parseInt(qty[l.id], 10) } : { sale_line_id: l.id, weight_kg: num(qty[l.id]).toFixed(3) }));
    const body = { invoice_id: inv.id, shift_id: shift.id, items, reason, refund_to_credit: refundBy === 'ACCOUNT', refund_method_id: refundBy === 'ACCOUNT' ? null : refundBy };
    try {
      const r = await axiosClient.post('/returns/', body);
      setMsg(`${T.done}: ${r.data.return_number} — ${money(r.data.total_refund_amount)} ${T.cur}`);
      await printReturn(r.data); setInv(null); setFound([]); setQ(''); setQty({}); loadLog();
    } catch (e) { setErr(T.failed + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };

  async function loadLog(x = lf) {
    const p = new URLSearchParams({ all: '1' });
    if (x.from) p.append('date_from', x.from); if (x.to) p.append('date_to', x.to); if (x.q.trim()) p.append('q', x.q.trim());
    try { const r = await axiosClient.get(`/returns/?${p.toString()}`); setLog(listOf(r.data)); } catch (e) { console.error(e); }
  }
  const report = () => ({ title: T.rTitle, filename: 'returns', filtersText: [lf.from, lf.to, lf.q].filter(Boolean).join(' | '), columns: [
    { key: 'no', header: T.retNo, width: 22 }, { key: 'date', header: T.date, width: 16 }, { key: 'inv', header: T.invNo, width: 22 }, { key: 'cust', header: T.customer, width: 18 },
    { key: 'method', header: T.method, width: 16 }, { key: 'reason', header: T.reason, width: 18 }, { key: 'amount', header: T.refund, type: 'money' }
  ], rows: log.map((r) => ({ no: r.return_number, date: dt(r.return_date_time), inv: r.original_invoice_number, cust: [r.customer_name, r.customer_phone].filter(Boolean).join(' '), method: r.refund_to_credit ? T.toAccount : (r.refund_method_name || ''), reason: r.reason || '', amount: num(r.total_refund_amount) })),
  totals: { amount: log.reduce((a, r) => a + num(r.total_refund_amount), 0) } });

  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const chip = (active, onClick, label) => <button key={label} type="button" onClick={onClick} className={`h-9 px-3 rounded-lg border text-xs font-bold cursor-pointer ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>{label}</button>;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><RotateCcw size={20} className="text-rose-600" /> {T.title}</h1><p className="text-xs text-slate-500 mt-1">{T.sub}</p></div>
        <div className="flex gap-2">{chip(tab === 'NEW', () => setTab('NEW'), T.tNew)}{chip(tab === 'LOG', () => { setTab('LOG'); loadLog(); }, T.tLog)}</div>
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold">{msg}</div>}
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-sm font-bold">{err}</div>}

      {tab === 'NEW' && (
        <>
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs flex flex-wrap gap-4">
            <span><b>{T.terminal}:</b> {terminal ? `${terminal.name} (${terminal.code})` : '—'}</span>
            <span><b>{T.shift}:</b> <span className="font-mono text-emerald-400">{shift ? shift.shift_code : '—'}</span></span>
          </div>
          {!shift && <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-sm font-bold">{T.noShift}</div>}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') find(); }} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} />
              </div>
              <button type="button" onClick={find} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.find}</button>
            </div>
            {!inv && found.length > 0 && (
              <div className="space-y-1">{found.map((x) => (
                <button key={x.id} type="button" onClick={() => pick(x)} className="w-full text-start border border-slate-200 hover:border-emerald-500 rounded-lg p-2 text-xs cursor-pointer flex flex-wrap justify-between gap-2">
                  <span className="font-mono font-bold">{x.invoice_number}</span><span>{dt(x.invoice_date_time)}</span><span>{x.customer_name || T.walkin} {x.customer_phone || ''}</span><span className="font-bold">{money(x.total_amount)}</span>
                </button>))}
              </div>
            )}
            {!inv && q && found.length === 0 && <div className="text-xs text-slate-500">{T.noFound}</div>}
          </div>

          {inv && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2">
                <button type="button" onClick={() => setInv(null)} className="h-7 px-2 rounded-md border border-slate-300 bg-white font-bold cursor-pointer">{isRTL ? 'رجوع للقايمة' : 'Back to list'}</button><span className="font-mono font-bold">{inv.invoice_number}</span><span>{dt(inv.invoice_date_time)}</span>
                <span>{T.customer}: {inv.customer_name ? `${inv.customer_name} (${inv.customer_code || ''}) ${inv.customer_phone || ''}` : T.walkin}</span>
                <span>{T.total}: <b>{money(inv.total_amount)}</b></span><span>{T.pays}: {(inv.payments_info || []).map((p) => `${p.method} ${money(p.amount)}`).join(' + ')}</span>
              </div>
              {ratio < 1 && <div className="text-xs font-bold text-violet-700">{T.discNote} ({Math.round((1 - ratio) * 100)}%)</div>}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.item}</th><th className="p-2 text-center">{T.sold}</th><th className="p-2 text-center">{T.returned}</th><th className="p-2 text-center">{T.left}</th><th className="p-2 text-center">{T.back}</th><th className="p-2 text-center">{T.refund}</th></tr></thead>
                  <tbody>{(inv.lines || []).map((l) => {
                    const unit = l.piece_mode ? T.pcs : T.kg; const left = lineLeft(l); const over = num(qty[l.id]) > left + 0.0005;
                    return (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="p-2 font-bold">{l.bundle_label ? <span className="text-amber-700">{l.bundle_label} · </span> : null}{l.display_name || l.product_name}</td>
                        <td className="p-2 text-center">{l.piece_mode ? `${l.quantity_pieces} ${T.pcs}` : `${kgf(l.weight_kg)} ${T.kg}`}</td>
                        <td className="p-2 text-center text-slate-500">{l.piece_mode ? `${l.returned_pieces} ${T.pcs}` : `${kgf(l.returned_weight)} ${T.kg}`}</td>
                        <td className="p-2 text-center font-bold">{l.piece_mode ? left : kgf(left)} {unit}</td>
                        <td className="p-2 text-center"><input type="number" min="0" step={l.piece_mode ? '1' : '0.001'} max={left} disabled={left <= 0} value={qty[l.id] || ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} className={input + ` w-24 h-8 text-center ${over ? 'border-rose-500 bg-rose-50' : ''}`} /></td>
                        <td className="p-2 text-center font-bold text-rose-700">{money(lineRefund(l))}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-600">{T.refundHow}</div>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => chip(refundBy === m.id, () => setRefundBy(m.id), m.name))}
                  {inv.customer && chip(refundBy === 'ACCOUNT', () => setRefundBy('ACCOUNT'), T.toAccount)}
                </div>
              </div>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.reason}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T.reasonPh} className={input + ' w-full'} /></label>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <div className="text-sm font-bold text-rose-900">{T.totalRefund}: <span className="text-2xl">{money(totalRefund)}</span> {T.cur}</div>
                <button type="button" onClick={submit} disabled={busy || !shift || totalRefund <= 0 || overLimit || !refundBy} className="h-12 px-8 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">{busy ? T.saving : T.confirm}</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'LOG' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={lf.from} onChange={(e) => setLf({ ...lf, from: e.target.value })} className={input} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={lf.to} onChange={(e) => setLf({ ...lf, to: e.target.value })} className={input} /></label>
            <input value={lf.q} onChange={(e) => setLf({ ...lf, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') loadLog(); }} placeholder={T.search} className={input + ' flex-1 min-w-[200px]'} />
            <button type="button" onClick={() => loadLog()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
            <ExportButtons getReport={report} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.retNo}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.invNo}</th><th className="p-2 text-start">{T.customer}</th><th className="p-2 text-start">{T.method}</th><th className="p-2 text-start">{T.cashier}</th><th className="p-2 text-center">{T.refund}</th></tr></thead>
              <tbody>
                {log.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
                {log.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setOpenId(openId === r.id ? null : r.id)} className={`border-b border-slate-100 cursor-pointer ${openId === r.id ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-2 font-mono font-bold">{r.return_number}</td><td className="p-2 whitespace-nowrap">{dt(r.return_date_time)}</td><td className="p-2 font-mono">{r.original_invoice_number}</td>
                      <td className="p-2">{r.customer_name || T.walkin}{r.customer_phone ? <div className="text-[10px] font-mono text-slate-500">{r.customer_phone}</div> : null}</td>
                      <td className="p-2">{r.refund_to_credit ? T.toAccount : (r.refund_method_name || '—')}</td><td className="p-2">{r.cashier_username || '—'}</td>
                      <td className="p-2 text-center font-bold text-rose-700">{money(r.total_refund_amount)}</td>
                    </tr>
                    {openId === r.id && (
                      <tr><td colSpan={7} className="p-3 bg-slate-50">
                        <div className="space-y-1 text-xs">
                          {(r.lines || []).map((l) => <div key={l.id} className="flex justify-between"><span>{l.display_name || l.product_name} — {num(l.quantity_pieces) > 0 ? `${l.quantity_pieces} ${T.pcs} · ` : ''}{kgf(l.weight_kg)} {T.kg}</span><span className="font-bold">{money(l.refund_total_price)}</span></div>)}
                          {r.reason && <div className="text-slate-600">{T.reason}: {r.reason}</div>}
                          <button type="button" onClick={() => printReturn(r)} className="h-8 px-3 mt-1 rounded-lg bg-slate-900 text-white font-bold flex items-center gap-1 cursor-pointer"><Printer size={13} /> {T.reprint}</button>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}