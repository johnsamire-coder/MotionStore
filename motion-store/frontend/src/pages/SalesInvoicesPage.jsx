import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { getCompanyInfo } from '../utils/reportExport';
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

  const reprint = async (r) => {
    const co = await getCompanyInfo();
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const row = (a, b) => `<tr><td>${a}</td><td style="text-align:left">${b}</td></tr>`;
    const groups = []; (r.lines || []).forEach((l) => { const g = l.bundle_label || ''; let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, lines: [] }; groups.push(grp); } grp.lines.push(l); });
    const lineHtml = (l, padR) => `<tr><td style="${padR ? 'padding-right:8px' : ''}">${esc(l.display_name || l.product_name)}${l.offer_label ? ` <b>(${T.offer}: ${esc(l.offer_label)})</b>` : ''}<br><small>${lineQty(l)} × ${money(l.unit_price)}</small></td><td style="text-align:left">${money(l.total_price)}</td></tr>`;
    const body = groups.map((g) => (g.name ? `<tr><td colspan="2" style="font-weight:700">${esc(g.name)}</td></tr>` + g.lines.map((l) => lineHtml(l, true)).join('') : g.lines.map((l) => lineHtml(l, false)).join(''))).join('');
    const html = `<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(r.invoice_number)}</title><style>@page{size:80mm auto;margin:3mm} body{font-family:Tahoma,Arial,sans-serif;width:74mm;margin:0;font-size:12px} table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} .c{text-align:center} hr{border:0;border-top:1px dashed #000} .t td{font-weight:700}</style></head><body>
      <div class="c">${co.logo ? `<img src="${co.logo}" style="width:48px;height:48px;object-fit:contain">` : ''}<div style="font-weight:700;font-size:14px">${esc(co.name)}</div>
      <div>${esc(r.terminal_name || '')}</div><div>${esc(r.invoice_number)} (${T.copy})</div><div>${dt(r.invoice_date_time)}</div>
      ${r.customer_name || r.customer_phone ? `<div>${T.customer}: ${esc([r.customer_name, r.customer_code].filter(Boolean).join(' - '))}</div><div>${esc(r.customer_phone || '')}</div>` : ''}</div><hr>
      <table>${body}</table><hr><table class="t">${row(T.subtotal, money(r.subtotal))}
      ${(r.applied_offers || []).map((o) => row(`${T.offer}: ${esc(o.name || '')}`, '-' + money(o.discount))).join('')}
      ${num(r.discount_amount) ? row(T.discount, '-' + money(r.discount_amount)) : ''}${num(r.delivery_fee) ? row(T.delivery, money(r.delivery_fee)) : ''}
      ${row(T.required, money(r.total_amount) + ' ' + T.cur)}${(r.payments_info || []).map((p) => row(esc(p.method), money(p.amount))).join('')}</table><hr>
      <div class="c">${T.thanks}</div><script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };

  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <h1 className="text-xl font-black text-slate-800">{T.title}</h1>
        <p className="text-xs text-slate-500 mt-1">{T.sub}</p>
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
                        <button type="button" onClick={() => reprint(r)} className="w-full h-9 mt-2 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center gap-1 cursor-pointer"><Printer size={14} /> {T.reprint}</button>
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