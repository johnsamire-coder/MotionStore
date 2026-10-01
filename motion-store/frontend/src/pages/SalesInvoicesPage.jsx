// RECEIPT_PATCHED
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { getCompanyInfo, saleReceiptHtml } from '../utils/reportExport';
import { Search, Printer } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kgf = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const TX = {
  ar: { title: 'فواتير المبيعات', sub: 'كل الفواتير اللي اتباعت بالتفاصيل', from: 'من تاريخ', to: 'إلى تاريخ', cashier: 'الكاشير', terminal: 'نقطة البيع', method: 'طريقة الدفع', all: 'الكل',
    search: 'رقم الفاتورة أو تليفون أو اسم أو كود العميل...', show: 'عرض', count: 'عدد الفواتير', total: 'إجمالي المبيعات', disc: 'إجمالي الخصومات', byMethod: 'حسب طريقة الدفع',
    no: 'رقم الفاتورة', date: 'التاريخ', customer: 'العميل', walkin: 'عميل نقدي', items: 'أصناف', amount: 'الإجمالي', pays: 'الدفع', none: 'مفيش فواتير بالفلاتر دي',
    item: 'الصنف', pcs: 'قطعة', kg: 'كجم', price: 'السعر', lineTotal: 'الإجمالي', subtotal: 'الأصناف', discount: 'الخصم', delivery: 'التوصيل', prev: 'رصيد سابق', required: 'المطلوب',
    offers: 'العروض', coupon: 'الكوبون', notes: 'ملاحظات', reprint: 'إعادة طباعة الإيصال', phone: 'التليفون', offer: 'عرض', cur: 'ج.م', thanks: 'شكراً لزيارتكم', copy: 'نسخة', rTitle: 'تقرير فواتير المبيعات' },
  en: { title: 'Sales Invoices', sub: 'Every sale with full details', from: 'From', to: 'To', cashier: 'Cashier', terminal: 'Terminal', method: 'Payment method', all: 'All',
    search: 'Invoice #, customer phone, name or code...', show: 'Show', count: 'Invoices', total: 'Total sales', disc: 'Total discounts', byMethod: 'By payment method',
    no: 'Invoice #', date: 'Date', customer: 'Customer', walkin: 'Walk-in', items: 'Items', amount: 'Total', pays: 'Payment', none: 'No invoices for these filters',
    item: 'Item', pcs: 'pcs', kg: 'KG', price: 'Price', lineTotal: 'Total', subtotal: 'Items', discount: 'Discount', delivery: 'Delivery', prev: 'Previous balance', required: 'Due',
    offers: 'Offers', coupon: 'Coupon', notes: 'Notes', reprint: 'Reprint receipt', phone: 'Phone', offer: 'Offer', cur: 'EGP', thanks: 'Thank you', copy: 'Copy', rTitle: 'Sales Invoices Report' }
};

export default function SalesInvoicesPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [f, setF] = useState({ from: today(), to: today(), cashier: '', terminal: '', method: '', q: '' });
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [terms, setTerms] = useState([]);
  const [methods, setMethods] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  // NUMBERING_UI
  const [numOpen, setNumOpen] = useState(false);
  const [nums, setNums] = useState([]);
  const [numPwd, setNumPwd] = useState('');
  const [numMsg, setNumMsg] = useState('');
  const openNum = async () => { setNumMsg(''); setNumPwd(''); try { const r = await axiosClient.get('/sales/numbering/'); setNums(r.data); setNumOpen(true); } catch (e) { alert(e.message); } };
  const saveNum = async (n) => { setNumMsg(''); try { const r = await axiosClient.post('/sales/numbering/', { key: n.key, prefix: n.prefix, next_value: n.next_value, padding: n.padding, manager_password: numPwd }); setNums(r.data); setNumMsg('✅'); } catch (e) { setNumMsg(e.response?.data?.detail || e.message); } };

  const load = async (x = f) => {
    setLoading(true);
    const p = new URLSearchParams({ all: '1' });
    if (x.from) p.append('date_from', x.from); if (x.to) p.append('date_to', x.to);
    if (x.cashier) p.append('cashier', x.cashier); if (x.terminal) p.append('terminal', x.terminal);
    if (x.method) p.append('payment_method', x.method); if (x.q.trim()) p.append('q', x.q.trim());
    try { const r = await axiosClient.get(`/sales/?${p.toString()}`); setRows(listOf(r.data)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    axiosClient.get('/users/').then((r) => setUsers(listOf(r.data))).catch(() => {});
    axiosClient.get('/pos-terminals/').then((r) => setTerms(listOf(r.data))).catch(() => {});
    axiosClient.get('/payments/').then((r) => setMethods(listOf(r.data))).catch(() => {});
  }, []);

  const custText = (r) => (r.customer_name || r.customer_phone ? [r.customer_name, r.customer_code ? `(${r.customer_code})` : ''].filter(Boolean).join(' ') : T.walkin);
  const paysText = (r) => (r.payments_info || []).map((p) => `${p.method} ${money(p.amount)}`).join(' + ');
  const sumTotal = rows.reduce((a, r) => a + num(r.total_amount), 0);
  const sumDisc = rows.reduce((a, r) => a + num(r.discount_amount), 0);
  const byMethod = {};
  rows.forEach((r) => (r.payments_info || []).forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + num(p.amount); }));
  const lineQty = (l) => [num(l.quantity_pieces) > 0 ? `${l.quantity_pieces} ${T.pcs}` : '', num(l.weight_kg) > 0 ? `${kgf(l.weight_kg)} ${T.kg}` : ''].filter(Boolean).join(' · ');

  const report = () => ({ title: T.rTitle, filename: 'sales-invoices', filtersText: [f.from && `${T.from}: ${f.from}`, f.to && `${T.to}: ${f.to}`, f.q].filter(Boolean).join(' | '), columns: [
    { key: 'no', header: T.no, width: 22 }, { key: 'date', header: T.date, width: 16 }, { key: 'cashier', header: T.cashier, width: 12 }, { key: 'term', header: T.terminal, width: 10 },
    { key: 'cust', header: T.customer, width: 20 }, { key: 'phone', header: T.phone, width: 14 }, { key: 'pays', header: T.pays, width: 30 }, { key: 'disc', header: T.discount, type: 'money' }, { key: 'total', header: T.amount, type: 'money' }
  ], rows: rows.map((r) => ({ no: r.invoice_number, date: dt(r.invoice_date_time), cashier: r.cashier_username || '', term: r.terminal_code || '', cust: custText(r), phone: r.customer_phone || '', pays: paysText(r), disc: num(r.discount_amount), total: num(r.total_amount) })),
  totals: { disc: sumDisc, total: sumTotal } });

  const editInvoice = async (r) => {
    const pw = window.prompt('تعديل الفاتورة ' + r.invoice_number + ': هيتعمل مرتجع كامل ليها، وبعدين تعمل الفاتورة الصح من شاشة البيع.\nاكتب باسورد المدير:');
    if (!pw) return;
    try {
      const v = await axiosClient.post('/sales/verify_manager/', { password: pw });
      if (v.data && (v.data.valid === false || v.data.ok === false || v.data.approved === false)) { alert('باسورد المدير غلط'); return; }
      const lk = await axiosClient.get('/returns/invoice_lookup/?q=' + encodeURIComponent(r.invoice_number));
      const inv = listOf(lk.data).find((x) => x.invoice_number === r.invoice_number);
      if (!inv) { alert('مش لاقي الفاتورة'); return; }
      let shiftRow = null;
      try { const s1 = await axiosClient.get('/shifts/?status=OPEN' + (r.terminal ? '&terminal=' + r.terminal : '')); shiftRow = listOf(s1.data)[0] || null; } catch (x) { shiftRow = null; }
      if (!shiftRow) { try { const s2 = await axiosClient.get('/shifts/?status=OPEN'); shiftRow = listOf(s2.data)[0] || null; } catch (x) { shiftRow = null; } }
      if (!shiftRow) { alert('لازم تكون فيه وردية مفتوحة على الكاشير الأول'); return; }
      const items = (inv.lines || []).map((l) => (l.piece_mode
        ? (num(l.quantity_pieces) - num(l.returned_pieces) > 0 ? { sale_line_id: l.id, quantity_pieces: num(l.quantity_pieces) - num(l.returned_pieces) } : null)
        : (num(l.weight_kg) - num(l.returned_weight) > 0 ? { sale_line_id: l.id, weight_kg: (num(l.weight_kg) - num(l.returned_weight)).toFixed(3) } : null))).filter(Boolean);
      if (!items.length) { alert('الفاتورة دي اترجعت بالكامل قبل كده'); return; }
      const pays = (r.payments_info || []).slice().sort((a, b) => num(b.amount) - num(a.amount));
      const mp = pays[0] ? methods.find((x) => x.name === pays[0].method) : null;
      const toCredit = !!(mp && mp.method_type === 'CREDIT');
      const cashM = methods.find((x) => x.method_type === 'CASH');
      const body = { invoice_id: inv.id, shift_id: shiftRow.id, items, reason: 'تعديل فاتورة ' + r.invoice_number, refund_to_credit: toCredit, refund_method_id: toCredit ? null : ((mp || cashM || {}).id || null) };
      const rr = await axiosClient.post('/returns/', body);
      const list = (r.lines || []).map((l) => '- ' + (l.display_name || l.product_name || '') + ' | ' + (num(l.quantity_pieces) > 0 ? l.quantity_pieces + ' قطعة ' : '') + (num(l.weight_kg) > 0 ? kgf(l.weight_kg) + ' كجم ' : '') + '| ' + money(l.unit_price)).join('\n');
      alert('تم عمل مرتجع ' + rr.data.return_number + ' للفاتورة ' + r.invoice_number + '\nاعمل الفاتورة الصح من شاشة البيع.\n\nالأصناف القديمة:\n' + list + (r.customer_phone ? '\n\nالعميل: ' + (r.customer_name || '') + ' - ' + r.customer_phone : ''));
      window.location.href = '/pos';
    } catch (e) { alert('ماتمش التعديل: ' + (e.response?.data?.detail || e.message)); }
  };

  const reprint = async (r) => {
    const co = await getCompanyInfo();
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const row = (a, b) => `<tr><td>${a}</td><td style="text-align:left">${b}</td></tr>`;
    const groups = []; (r.lines || []).forEach((l) => { const g = l.bundle_label || ''; let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, lines: [] }; groups.push(grp); } grp.lines.push(l); });
    const lineHtml = (l, padR) => `<tr><td style="${padR ? 'padding-right:8px' : ''}">${esc(l.display_name || l.product_name)}${l.offer_label ? ` <b>(${T.offer}: ${esc(l.offer_label)})</b>` : ''}<br><small>${lineQty(l)} × ${money(l.unit_price)}</small></td><td style="text-align:left">${money(l.total_price)}</td></tr>`;
    const body = groups.map((g) => (g.name ? `<tr><td colspan="2" style="font-weight:700">${esc(g.name)}</td></tr>` + g.lines.map((l) => lineHtml(l, true)).join('') : g.lines.map((l) => lineHtml(l, false)).join(''))).join('');
    const html = saleReceiptHtml(co, {
      number: r.invoice_number, copy: true, cashier: r.cashier_full_name || r.cashier_username || '', date: new Date(r.invoice_date_time).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), time: new Date(r.invoice_date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      custName: r.customer_name || '', custPhone: r.customer_phone || '',
      pays: (r.payments_info || []).map((x) => x.method).join(' + '),
      items: (r.lines || []).map((l) => ({ name: (l.display_name || l.product_name || '') + (l.offer_label ? ` (${l.offer_label})` : ''), qty: num(l.quantity_pieces) > 0 ? String(l.quantity_pieces) : `${kgf(l.weight_kg)}ك`, price: num(l.unit_price) || (num(l.total_price) / (num(l.quantity_pieces) || num(l.weight_kg) || 1)), total: num(l.total_price) })),
      pcs: (r.lines || []).reduce((a, l) => a + (num(l.quantity_pieces) || 0), 0), disc: num(r.discount_amount), delivery: num(r.delivery_fee), total: num(r.total_amount),
    });
    const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };

  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <h1 className="text-xl font-black text-slate-800">{T.title}</h1>
        <p className="text-xs text-slate-500 mt-1">{T.sub}</p>
        <button type="button" onClick={openNum} className="mt-2 h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">⚙️ {isRTL ? 'الترقيم' : 'Numbering'}</button>
        {numOpen && (
          <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-3">
              <div className="flex items-center justify-between"><div className="text-base font-bold">⚙️ {isRTL ? 'ترقيم الفواتير والمرتجعات' : 'Invoice & return numbering'}</div><button type="button" onClick={() => setNumOpen(false)} className="h-8 w-8 rounded-lg border border-slate-200 cursor-pointer">×</button></div>
              <div className="text-xs text-slate-600">{isRTL ? 'لو العميل كان عنده سيستم قديم، اكتب الرقم اللي بعد آخر فاتورة عنده، والسيستم هيكمّل عليه.' : 'If the customer had an old system, enter the number after their last invoice.'}</div>
              {nums.map((n, i) => (
                <div key={n.key} className="border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                  <div className="font-bold">{n.key === 'SALE' ? (isRTL ? 'فواتير المبيعات' : 'Sales invoices') : (isRTL ? 'المرتجعات' : 'Returns')} — {isRTL ? 'آخر رقم اتستعمل' : 'Last used'}: {n.last_used} — {isRTL ? 'الجاية' : 'Next'}: <span className="font-mono">{n.example}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="font-bold text-slate-600 space-y-1 block">{isRTL ? 'البادئة' : 'Prefix'}<input value={n.prefix} onChange={(e) => setNums(nums.map((x, j) => (j === i ? { ...x, prefix: e.target.value } : x)))} className="h-9 px-2 border border-slate-300 rounded-lg w-full font-mono" /></label>
                    <label className="font-bold text-slate-600 space-y-1 block">{isRTL ? 'الرقم الجاي' : 'Next number'}<input type="number" min="1" value={n.next_value} onChange={(e) => setNums(nums.map((x, j) => (j === i ? { ...x, next_value: e.target.value } : x)))} className="h-9 px-2 border border-slate-300 rounded-lg w-full" /></label>
                    <label className="font-bold text-slate-600 space-y-1 block">{isRTL ? 'عدد الخانات' : 'Digits'}<input type="number" min="1" max="10" value={n.padding} onChange={(e) => setNums(nums.map((x, j) => (j === i ? { ...x, padding: e.target.value } : x)))} className="h-9 px-2 border border-slate-300 rounded-lg w-full" /></label>
                  </div>
                  <button type="button" disabled={!numPwd} onClick={() => saveNum(n)} className="h-8 px-3 rounded-lg bg-slate-900 disabled:bg-slate-400 text-white font-bold cursor-pointer">{isRTL ? 'حفظ' : 'Save'}</button>
                </div>
              ))}
              <input type="password" value={numPwd} onChange={(e) => setNumPwd(e.target.value)} placeholder={isRTL ? 'باسورد المدير' : 'Manager password'} className="h-10 px-3 border border-slate-300 rounded-lg w-full text-center" />
              {numMsg && <div className={`text-xs font-bold ${numMsg === '✅' ? 'text-emerald-700' : 'text-rose-700'}`}>{numMsg}</div>}
            </div>
          </div>
        )}
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input + ' w-full'} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.cashier}<select value={f.cashier} onChange={(e) => setF({ ...f, cashier: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.terminal}<select value={f.terminal} onChange={(e) => setF({ ...f, terminal: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.method}<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} />
            <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} />
          </div>
          <button type="button" onClick={() => load()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{loading ? '...' : T.show}</button>
          <ExportButtons getReport={report} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.count}</div><div className="text-xl font-black mt-1">{rows.length}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.total}</div><div className="text-xl font-black mt-1 text-emerald-800">{money(sumTotal)} <span className="text-xs">{T.cur}</span></div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.disc}</div><div className="text-xl font-black mt-1 text-violet-800">{money(sumDisc)} <span className="text-xs">{T.cur}</span></div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.byMethod}</div>{Object.keys(byMethod).length === 0 ? <div className="text-xs text-slate-400 mt-1">—</div> : Object.keys(byMethod).map((k) => <div key={k} className="flex justify-between text-xs mt-1"><span>{k}</span><span className="font-bold">{money(byMethod[k])}</span></div>)}</div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-100 text-slate-700">
            <th className="p-2 text-start">{T.no}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.cashier}</th><th className="p-2 text-start">{T.terminal}</th>
            <th className="p-2 text-start">{T.customer}</th><th className="p-2 text-center">{T.items}</th><th className="p-2 text-start">{T.pays}</th><th className="p-2 text-center">{T.amount}</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-500">{T.none}</td></tr>}
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr onClick={() => setOpenId(openId === r.id ? null : r.id)} className={`border-b border-slate-100 cursor-pointer ${openId === r.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <td className="p-2 font-mono font-bold">{r.invoice_number}</td>
                  <td className="p-2 whitespace-nowrap">{dt(r.invoice_date_time)}</td>
                  <td className="p-2">{r.cashier_username || '—'}</td>
                  <td className="p-2">{r.terminal_code || '—'}</td>
                  <td className="p-2">{custText(r)}{r.customer_phone ? <div className="text-[10px] text-slate-500 font-mono">{r.customer_phone}</div> : null}</td>
                  <td className="p-2 text-center">{(r.lines || []).length}</td>
                  <td className="p-2">{paysText(r)}</td>
                  <td className="p-2 text-center font-bold text-emerald-800">{money(r.total_amount)}</td>
                </tr>
                {openId === r.id && (
                  <tr><td colSpan={8} className="p-3 bg-slate-50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-2">
                        <table className="w-full text-xs">
                          <thead><tr className="text-slate-600"><th className="p-1 text-start">{T.item}</th><th className="p-1 text-start">{T.items}</th><th className="p-1 text-center">{T.price}</th><th className="p-1 text-center">{T.lineTotal}</th></tr></thead>
                          <tbody>{(r.lines || []).map((l) => (
                            <tr key={l.id} className="border-t border-slate-100">
                              <td className="p-1 font-bold">{l.bundle_label ? <span className="text-amber-700">{l.bundle_label} · </span> : null}{l.display_name || l.product_name}{l.offer_label ? <span className="text-violet-700"> ({T.offer}: {l.offer_label})</span> : null}</td>
                              <td className="p-1">{lineQty(l)}</td><td className="p-1 text-center">{money(l.unit_price)}</td><td className="p-1 text-center font-bold">{money(l.total_price)}</td>
                            </tr>))}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs space-y-1">
                        <div className="font-bold">{T.customer}: {custText(r)}</div>
                        {r.customer_phone && <div className="font-mono">{T.phone}: {r.customer_phone}</div>}
                        <div className="flex justify-between border-t border-slate-100 pt-1"><span>{T.subtotal}</span><span>{money(r.subtotal)}</span></div>
                        {(r.applied_offers || []).map((o, i) => <div key={i} className="flex justify-between text-violet-700 font-bold"><span>{T.offer}: {o.name || ''}</span><span>-{money(o.discount)}</span></div>)}
                        {num(r.discount_amount) > 0 && <div className="flex justify-between"><span>{T.discount}</span><span>-{money(r.discount_amount)}</span></div>}
                        {num(r.delivery_fee) > 0 && <div className="flex justify-between"><span>{T.delivery}</span><span>{money(r.delivery_fee)}</span></div>}
                        <div className="flex justify-between font-black text-emerald-800 text-sm"><span>{T.required}</span><span>{money(r.total_amount)}</span></div>
                        {(r.payments_info || []).map((p, i) => <div key={i} className="flex justify-between"><span>{p.method}</span><span className="font-bold">{money(p.amount)}</span></div>)}
                        {r.coupon_code && <div>{T.coupon}: <span className="font-mono font-bold">{r.coupon_code}</span></div>}
                        {r.notes && <div className="text-slate-600">{T.notes}: {r.notes}</div>}
                        <button type="button" onClick={() => reprint(r)} className="w-full h-9 mt-2 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center gap-1 cursor-pointer"><Printer size={14} /> {T.reprint}</button><button type="button" onClick={() => editInvoice(r)} className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold cursor-pointer">✏️ تعديل</button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}