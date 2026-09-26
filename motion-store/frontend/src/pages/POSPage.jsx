// POS_V2
import React, { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { getCompanyInfo } from '../utils/reportExport';
import { Search, Trash2, X, Scale, Printer, PauseCircle, Tag, Plus } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kgf = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const GRADE_WORDS = /\s*-\s*(عالي|وسط|تصفيات)\s*$/;
const custName = (s) => { const n = (s.product_name || '').replace(GRADE_WORDS, '').trim(); return n && !['عالي', 'وسط', 'تصفيات'].includes(n) ? n : 'بضاعة'; };
const TERM_KEY = 'ms_pos_terminal';
const HOLD_KEY = (id) => `ms_pos_held_${id}`;
const lineTotal = (l) => (l.mode === 'PIECE' ? num(l.qty) * num(l.price) : num(l.kg) * num(l.price));
const matches = (l, t = {}) => (!t.kind || l.kind === t.kind) && (!t.segment || l.segment === t.segment) && (!t.brand || l.brand === t.brand) && (!t.grade || l.grade === t.grade) && (!t.season || l.season === t.season);
const P = (o, k) => num((o.params || {})[k]);
function offerDiscount(o, cart, subtotal) {
  const lines = cart.filter((l) => matches(l, o.targets || {}));
  const sumLines = (arr) => arr.reduce((a, l) => a + lineTotal(l), 0);
  const cheaperKg = (arr, price) => arr.reduce((a, l) => a + Math.max(0, (num(l.price) - price) * num(l.kg)), 0);
  let d = 0;
  switch (o.offer_type) {
    case 'QTY': { const pcs = lines.filter((l) => l.mode === 'PIECE').reduce((a, l) => a + num(l.qty), 0); if (pcs >= P(o, 'minQty')) d = sumLines(lines) * P(o, 'pct') / 100; break; }
    case 'BXGY': {
      const units = []; lines.filter((l) => l.mode === 'PIECE').forEach((l) => { for (let i = 0; i < num(l.qty); i += 1) units.push(num(l.price)); });
      units.sort((a, b) => b - a); const g = P(o, 'buy') + P(o, 'get');
      if (g > 0 && P(o, 'get') > 0) { const sets = Math.floor(units.length / g); const free = units.slice(units.length - sets * P(o, 'get')); d = free.reduce((a, x) => a + x, 0) * (P(o, 'getPct') || 100) / 100; }
      break;
    }
    case 'WKG': { const w = lines.filter((l) => l.mode === 'KG'); if (w.reduce((a, l) => a + num(l.kg), 0) >= P(o, 'minKg') && P(o, 'kgPrice') > 0) d = cheaperKg(w, P(o, 'kgPrice')); break; }
    case 'TIERS': { const w = lines.filter((l) => l.mode === 'KG'); const t = w.reduce((a, l) => a + num(l.kg), 0); const tp = t > 5 ? P(o, 't3') : (t > 3 ? P(o, 't2') : P(o, 't1')); if (tp > 0) d = cheaperKg(w, tp); break; }
    case 'KGDAY': if (P(o, 'kgPrice') > 0) d = cheaperKg(cart.filter((l) => l.mode === 'KG'), P(o, 'kgPrice')); break;
    case 'SCALEFIX': if (P(o, 'kgPrice') > 0) d = cheaperKg(cart.filter((l) => l.bundle && l.mode === 'KG'), P(o, 'kgPrice')); break;
    case 'BAG': if (P(o, 'price') > 0) d = Math.max(0, subtotal - P(o, 'price')); break;
    case 'COMBO': {
      const codes = String((o.params || {}).codes || '').split(',').map((x) => x.trim()).filter(Boolean);
      const found = codes.map((cd) => cart.find((l) => l.code === cd));
      if (codes.length && found.every(Boolean)) d = Math.max(0, found.reduce((a, l) => a + num(l.price), 0) - P(o, 'price'));
      break;
    }
    case 'TARGET': d = sumLines(lines) * P(o, 'pct') / 100; break;
    case 'INVOICE': if (subtotal >= P(o, 'minAmount')) d = P(o, 'fixed') > 0 ? P(o, 'fixed') : subtotal * P(o, 'pct') / 100; break;
    case 'COUPON': d = subtotal * P(o, 'pct') / 100; break;
    default: d = 0;
  }
  if (o.max_discount && num(o.max_discount) > 0) d = Math.min(d, num(o.max_discount));
  return Math.max(0, r2(d));
}
const TX = {
  ar: { shift: 'الوردية', closed: 'مقفولة', terminal: 'نقطة البيع', change: 'تغيير', openShift: 'فتح وردية', openTitle: 'فتح وردية جديدة', openingCash: 'رصيد الافتتاح (ج.م)', open: 'فتح الوردية',
    pickTerm: 'اختار نقطة البيع بتاعة الجهاز ده', code: 'الكود', qty: 'الكمية', kg: 'الوزن (كجم)', add: 'إضافة (Enter)', scaleOpen: '+ بند ميزان', scaleClose: 'قفل الميزان', scaleOn: 'الميزان مفتوح: أي صنف هيدخل تحته',
    scale: 'ميزان', directory: 'بضاعة المحل', search: 'ابحث بالاسم أو الكود...', item: 'الصنف', grade: 'الدرجة', price: 'سعر الكيلو', avail: 'المتاح', noStock: 'مفيش بضاعة في المحل ده',
    invoice: 'الفاتورة', empty: 'الفاتورة فاضية. اكتب كود أو اختار من بضاعة المحل.', pcs: 'قطعة', perPiece: 'بالقطعة', perKg: 'بالكيلو', clear: 'تفريغ (F3)', hold: 'تعليق', held: 'المعلقة',
    custSearch: 'تليفون أو كود العميل', custName: 'اسم العميل', newCust: 'عميل جديد - هيتسجل مع الفاتورة', debt: 'عليه', offers: 'العروض', noOffers: 'مفيش عروض شغالة', coupon: 'كوبون', apply: 'تطبيق', remove: 'شيل',
    offerLine: 'عرض', discount: 'خصم يدوي', delivery: 'توصيل', prev: 'رصيد سابق', notes: 'ملاحظات', subtotal: 'الأصناف', offersDisc: 'خصم العروض', required: 'المطلوب', pay: 'الدفع (F1)',
    payTitle: 'الدفع', addPay: '+ طريقة دفع تانية', remaining: 'فاضل', cashGiven: 'المستلم', changeDue: 'الباقي للزبون', needPhone: 'الآجل محتاج تليفون العميل', confirm: 'تأكيد البيع', cancel: 'إلغاء', saving: 'جاري الحفظ...',
    receipt: 'تم البيع', print: 'طباعة الإيصال', newSale: 'فاتورة جديدة', invNo: 'رقم الفاتورة', thanks: 'شكراً لزيارتكم', customer: 'العميل',
    notFound: 'الكود ده مش موجود', needKg: 'اكتب الوزن', overKg: 'الوزن أكبر من المتاح', needShift: 'لازم تفتح وردية الأول', needItems: 'الفاتورة فاضية', badLine: 'فيه سطر ناقص وزن أو كمية', failed: 'حصلت مشكلة: ',
    noTerm: 'مفيش نقطة بيع متسجلة. اعمل محل من صفحة المخزون.', cur: 'ج.م', noHeld: 'مفيش فواتير معلقة', resume: 'رجوع' },
  en: { shift: 'Shift', closed: 'Closed', terminal: 'Terminal', change: 'Change', openShift: 'Open shift', openTitle: 'Open a new shift', openingCash: 'Opening cash', open: 'Open shift',
    pickTerm: 'Choose this device\'s terminal', code: 'Code', qty: 'Qty', kg: 'Weight (KG)', add: 'Add (Enter)', scaleOpen: '+ Scale bundle', scaleClose: 'Close scale', scaleOn: 'Scale open: items go under it',
    scale: 'Scale', directory: 'Shop stock', search: 'Search by name or code...', item: 'Item', grade: 'Grade', price: 'Price/KG', avail: 'Available', noStock: 'No stock in this shop',
    invoice: 'Invoice', empty: 'Invoice is empty. Type a code or pick from shop stock.', pcs: 'pcs', perPiece: 'per piece', perKg: 'per KG', clear: 'Clear (F3)', hold: 'Hold', held: 'Held',
    custSearch: 'Customer phone or code', custName: 'Customer name', newCust: 'New customer - saved with the invoice', debt: 'owes', offers: 'Offers', noOffers: 'No active offers', coupon: 'Coupon', apply: 'Apply', remove: 'Remove',
    offerLine: 'Offer', discount: 'Manual discount', delivery: 'Delivery', prev: 'Previous balance', notes: 'Notes', subtotal: 'Items', offersDisc: 'Offers discount', required: 'Due', pay: 'Pay (F1)',
    payTitle: 'Payment', addPay: '+ Another payment method', remaining: 'Remaining', cashGiven: 'Received', changeDue: 'Change', needPhone: 'Credit needs the customer phone', confirm: 'Confirm sale', cancel: 'Cancel', saving: 'Saving...',
    receipt: 'Sale completed', print: 'Print receipt', newSale: 'New invoice', invNo: 'Invoice #', thanks: 'Thank you', customer: 'Customer',
    notFound: 'Code not found', needKg: 'Enter the weight', overKg: 'Weight is more than available', needShift: 'Open a shift first', needItems: 'Invoice is empty', badLine: 'A line is missing weight or quantity', failed: 'Something went wrong: ',
    noTerm: 'No terminal found. Create a shop from the Inventory page.', cur: 'EGP', noHeld: 'No held invoices', resume: 'Resume' }
};
const GL = { ar: { NEW_COLLECTION: 'عالي', MIDDLE: 'وسط', CLEARANCE: 'تصفيات' }, en: { NEW_COLLECTION: 'H', MIDDLE: 'M', CLEARANCE: 'L' } };

export default function POSPage() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [terminals, setTerminals] = useState([]);
  const [terminal, setTerminal] = useState(null);
  const [shift, setShift] = useState(null);
  const [stock, setStock] = useState([]);
  const [payMethods, setPayMethods] = useState([]);
  const [activeOffers, setActiveOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('1');
  const [kg, setKg] = useState('');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [bundle, setBundle] = useState(null);
  const [bundleCount, setBundleCount] = useState(0);
  const [custQ, setCustQ] = useState('');
  const [cust, setCust] = useState(null);
  const [custNew, setCustNew] = useState(false);
  const [custNameIn, setCustNameIn] = useState('');
  const [picked, setPicked] = useState([]);
  const [couponIn, setCouponIn] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [discount, setDiscount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [prevBal, setPrevBal] = useState('');
  const [notes, setNotes] = useState('');
  const [held, setHeld] = useState([]);
  const [showHeld, setShowHeld] = useState(false);
  const [showTermPick, setShowTermPick] = useState(false);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [showPay, setShowPay] = useState(false);
  const [payRows, setPayRows] = useState([]);
  const [cashGiven, setCashGiven] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [approvedBy, setApprovedBy] = useState(null);
  const [showMgr, setShowMgr] = useState(false);
  const [mgrPwd, setMgrPwd] = useState('');
  const [mgrErr, setMgrErr] = useState('');
  const [openHeld, setOpenHeld] = useState(null);
  // DEFERRED_UI
  const [showDefNew, setShowDefNew] = useState(false);
  const [defDays, setDefDays] = useState('3');
  const [defDep, setDefDep] = useState('');
  const [defDepM, setDefDepM] = useState('');
  const [showDefList, setShowDefList] = useState(false);
  const [defList, setDefList] = useState([]);
  const [defQ, setDefQ] = useState('');
  const [defAct, setDefAct] = useState(null);
  const [defPayRows, setDefPayRows] = useState([]);
  const [defRefund, setDefRefund] = useState(true);
  const [defErr, setDefErr] = useState('');
  const [defBusy, setDefBusy] = useState(false);
  const defItems = () => cart.map((l) => (l.type === 'PIECE'
    ? { piece_item_id: l.piece_item_id, quantity_pieces: parseInt(l.qty || '1', 10) || 1, weight_kg: l.mode === 'KG' ? num(l.kg).toFixed(3) : '0', unit_price: num(l.price).toFixed(2), price_mode: l.mode, display_name: l.name, bundle_label: l.bundle || null, offer_label: l.offer || null }
    : { stock_item_id: l.stock_item_id, weight_kg: num(l.kg).toFixed(3), quantity_pieces: 0, unit_price: num(l.price).toFixed(2), price_mode: 'KG', display_name: l.name, bundle_label: l.bundle || null }));
  const openDefNew = () => {
    if (!shift) { setShowOpenShift(true); showErr(T.needShift); return; }
    if (!cart.length) { showErr(T.needItems); return; }
    if (cart.some((l) => (l.mode === 'PIECE' ? num(l.qty) < 1 : num(l.kg) <= 0))) { showErr(T.badLine); return; }
    if (cart.some((l) => num(l.price) <= 0)) { showErr(isRTL ? 'فيه صنف سعره صفر' : 'A line has a zero price'); return; }
    if (!cust && (phoneDigits.length < 6 || !custNameIn.trim())) { showErr(isRTL ? 'الفاتورة المؤجلة لازم فيها اسم العميل وتليفونه' : 'A deferred invoice needs the customer name and phone'); return; }
    const cashM = payMethods.find((m) => m.method_type === 'CASH'); setDefDepM(cashM ? cashM.id : ''); setDefDep(''); setDefDays('3'); setDefErr(''); setShowDefNew(true);
  };
  const printDeferred = async (ds) => {
    const co = await getCompanyInfo();
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const rows = (ds.lines || []).map((l) => `<tr><td>${esc(l.display_name)}<br><small>${l.price_mode === 'PIECE' ? `${l.quantity_pieces} ${T.pcs}` : `${kgf(l.weight_kg)} ${isRTL ? 'كجم' : 'KG'}`} × ${money(l.unit_price)}</small></td><td style="text-align:left">${money(l.line_total)}</td></tr>`).join('');
    const rest = num(ds.total_amount) - num(ds.deposit_amount);
    const html = `<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(ds.number)}</title><style>@page{size:80mm auto;margin:3mm} body{font-family:Tahoma,Arial,sans-serif;width:74mm;margin:0;font-size:12px} table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} .c{text-align:center} hr{border:0;border-top:1px dashed #000} .b td{font-weight:700}</style></head><body>
      <div class="c">${co.logo ? `<img src="${co.logo}" style="width:48px;height:48px;object-fit:contain">` : ''}<div style="font-weight:700;font-size:14px">${esc(co.name)}</div>
      <div style="font-weight:700;font-size:14px;margin-top:4px">${isRTL ? 'إيصال أمانة (فاتورة مؤجلة)' : 'Deferred invoice (on approval)'}</div><div>${esc(ds.number)}</div><div>${new Date(ds.created_at).toLocaleString('en-GB')}</div></div><hr>
      <div>${isRTL ? 'العميل' : 'Customer'}: ${esc(ds.customer_name)} (${esc(ds.customer_code || '')})</div><div>${isRTL ? 'التليفون' : 'Phone'}: ${esc(ds.customer_phone)}</div><div>${isRTL ? 'الكاشير' : 'Cashier'}: ${esc(ds.cashier_name || '')}</div><hr>
      <table>${rows}</table><hr><table class="b">
      <tr><td>${isRTL ? 'الإجمالي' : 'Total'}</td><td style="text-align:left">${money(ds.total_amount)}</td></tr>
      <tr><td>${isRTL ? 'العربون' : 'Deposit'}${ds.deposit_method_name ? ` (${esc(ds.deposit_method_name)})` : ''}</td><td style="text-align:left">${money(ds.deposit_amount)}</td></tr>
      <tr><td>${isRTL ? 'الباقي عند البيع' : 'Due on sale'}</td><td style="text-align:left">${money(rest)}</td></tr>
      <tr><td>${isRTL ? 'آخر ميعاد للرجوع' : 'Return by'}</td><td style="text-align:left">${esc(ds.due_date)}</td></tr></table><hr>
      <div style="margin-top:18px">${isRTL ? 'توقيع العميل' : 'Customer signature'}: ....................</div>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };
  const submitDef = async () => {
    setDefBusy(true); setDefErr('');
    const body = { shift_id: shift.id, items: defItems(), due_days: parseInt(defDays || '3', 10) || 0, deposit_amount: num(defDep).toFixed(2), deposit_method_id: num(defDep) > 0 ? defDepM : null, notes };
    if (cust) body.customer_id = cust.id; else { body.customer_phone = phoneDigits; body.customer_name = custNameIn; }
    try { const r = await axiosClient.post('/deferred-sales/', body); setShowDefNew(false); resetSale(); loadShop(terminal); await printDeferred(r.data); }
    catch (e) { setDefErr(e.response?.data?.detail || e.message); } finally { setDefBusy(false); }
  };
  const loadDef = async (qv = defQ) => {
    try { const r = await axiosClient.get(`/deferred-sales/?status=OPEN&all=1&terminal=${terminal.id}${qv.trim() ? `&q=${encodeURIComponent(qv.trim())}` : ''}`); setDefList(listOf(r.data)); } catch (e) { setDefErr(e.response?.data?.detail || e.message); }
  };
  const openDefList = () => { setDefErr(''); setDefAct(null); setShowDefList(true); loadDef(''); setDefQ(''); };
  const startConvert = (ds) => {
    if (!shift) { setDefErr(T.needShift); return; }
    const cashM = payMethods.find((m) => m.method_type === 'CASH') || payMethods[0];
    setDefPayRows([{ key: 'd0', id: cashM ? cashM.id : '', amount: Math.max(0, num(ds.total_amount) - num(ds.deposit_amount)).toFixed(2) }]); setDefErr(''); setDefAct({ ds, mode: 'convert' });
  };
  const defRemaining = defAct ? r2(Math.max(0, num(defAct.ds.total_amount) - num(defAct.ds.deposit_amount)) - defPayRows.reduce((a, x) => a + num(x.amount), 0)) : 0;
  const doConvert = async () => {
    setDefBusy(true); setDefErr('');
    try {
      const r = await axiosClient.post(`/deferred-sales/${defAct.ds.id}/convert/`, { shift_id: shift.id, payments: defPayRows.filter((x) => num(x.amount) > 0).map((x) => ({ payment_method_id: x.id, amount: num(x.amount).toFixed(2) })) });
      setDefAct(null); await loadDef(); loadShop(terminal); setDefErr(''); alert(`${isRTL ? 'اتحولت لفاتورة بيع رقم' : 'Converted to sale'} ${r.data.invoice_number}`);
    } catch (e) { setDefErr(e.response?.data?.detail || e.message); } finally { setDefBusy(false); }
  };
  const doCancel = async () => {
    setDefBusy(true); setDefErr('');
    try { await axiosClient.post(`/deferred-sales/${defAct.ds.id}/cancel/`, { refund_deposit: defRefund }); setDefAct(null); await loadDef(); loadShop(terminal); }
    catch (e) { setDefErr(e.response?.data?.detail || e.message); } finally { setDefBusy(false); }
  };
  const verifyMgr = async () => { try { const r = await axiosClient.post('/sales/verify_manager/', { password: mgrPwd }); setApprovedBy(r.data.manager); setShowMgr(false); setMgrPwd(''); setMgrErr(''); } catch (e) { setMgrErr(e.response?.data?.detail || e.message); } };
  const codeRef = useRef(null);

  const showErr = (m) => { setErr(m); setTimeout(() => setErr(''), 4500); };
  const apiErr = (e) => showErr(T.failed + (e.response?.data?.detail || e.message));

  const loadShop = async (term) => {
    if (!term) return;
    try {
      const wh = term.default_warehouse ? `&warehouse=${term.default_warehouse}` : '';
      const [shRes, stRes, pmRes, ofRes] = await Promise.all([
        axiosClient.get(`/shifts/?terminal=${term.id}&status=OPEN`),
        axiosClient.get(`/stock-items/?all=1&only_positive=1${wh}`),
        axiosClient.get('/payments/?is_active=true'),
        axiosClient.get(`/offers/active_now/?${term.default_warehouse ? `warehouse=${term.default_warehouse}` : ''}`)
      ]);
      const sh = listOf(shRes.data).find((x) => (String(x.terminal) === String(term.id) || String(x.terminal_id) === String(term.id)) && x.status === 'OPEN') || null;
      setShift(sh); if (!sh) setShowOpenShift(true);
      setStock(listOf(stRes.data));
      setPayMethods(listOf(pmRes.data));
      setActiveOffers(listOf(ofRes.data));
      try { setHeld(JSON.parse(localStorage.getItem(HOLD_KEY(term.id)) || '[]')); } catch (e) { setHeld([]); }
    } catch (e) { apiErr(e); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await axiosClient.get('/pos-terminals/');
        const list = listOf(r.data).filter((x) => x.is_active !== false);
        setTerminals(list);
        let saved = null; try { saved = localStorage.getItem(TERM_KEY); } catch (e) { saved = null; }
        const chosen = list.find((x) => x.id === saved) || (list.length === 1 ? list[0] : null);
        if (chosen) { setTerminal(chosen); await loadShop(chosen); } else if (list.length > 1) { setShowTermPick(true); }
      } catch (e) { apiErr(e); } finally { setLoading(false); }
    })();
  }, []);

  const pickTerminal = async (t) => { try { localStorage.setItem(TERM_KEY, t.id); } catch (e) { /* ignore */ } setTerminal(t); setShowTermPick(false); resetSale(); await loadShop(t); };
  const saveHeld = (list) => { setHeld(list); try { localStorage.setItem(HOLD_KEY(terminal.id), JSON.stringify(list)); } catch (e) { /* ignore */ } };

  // ---------- totals & offers ----------
  const subtotal = cart.reduce((a, l) => a + lineTotal(l), 0);
  const candidates = [
    ...activeOffers.filter((o) => o.apply_mode === 'AUTO'),
    ...activeOffers.filter((o) => o.apply_mode === 'CASHIER' && picked.includes(o.id)),
    ...(coupon ? [coupon.offer] : [])
  ].filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i)
    .map((o) => ({ o, d: offerDiscount(o, cart, subtotal), coupon: !!(coupon && coupon.offer.id === o.id) }))
    .filter((x) => x.d > 0);
  const stackers = candidates.filter((x) => x.o.stackable);
  const loners = candidates.filter((x) => !x.o.stackable);
  const bestLoner = loners.sort((a, b) => b.d - a.d)[0];
  const stackSum = stackers.reduce((a, x) => a + x.d, 0);
  const applied = bestLoner && bestLoner.d >= stackSum ? [bestLoner] : stackers;
  const offersDisc = Math.min(subtotal, r2(applied.reduce((a, x) => a + x.d, 0)));
  const required = Math.max(0, r2(subtotal - offersDisc - num(discount) + num(delivery) + num(prevBal)));
  const paySum = r2(payRows.reduce((a, r) => a + num(r.amount), 0));
  const remaining = r2(required - paySum);
  const cashRow = payRows.find((r) => payMethods.find((m) => m.id === r.id)?.method_type === 'CASH');
  const changeDue = cashRow ? r2(num(cashGiven) - num(cashRow.amount)) : 0;
  const hasCredit = payRows.some((r) => payMethods.find((m) => m.id === r.id)?.method_type === 'CREDIT' && num(r.amount) > 0);
  const phoneDigits = (custQ || '').replace(/\D/g, '');

  // ---------- adding lines ----------
  const addWeight = (s, kgVal) => {
    const w = num(kgVal);
    if (w <= 0) { showErr(T.needKg); return false; }
    const used = cart.filter((l) => l.stock_item_id === s.id).reduce((a, l) => a + num(l.kg), 0);
    if (w + used > num(s.total_weight_kg) + 0.0001) { showErr(`${T.overKg} (${kgf(num(s.total_weight_kg) - used)})`); return false; }
    const li = s.line_info || {};
    setCart((c) => [...c, { key: `${Date.now()}-${Math.random()}`, type: 'WEIGHT', stock_item_id: s.id, code: s.product_code || '', name: custName(s), mode: 'KG', qty: 0, kg: String(w), price: String(num(s.selling_price_per_kg)), bundle, kind: li.kind || 'BALE', segment: li.segment, brand: li.brand, grade: s.grade }]);
    return true;
  };
  const addPiece = (p, qtyVal, kgVal) => {
    const n = Math.max(1, parseInt(qtyVal || '1', 10) || 1);
    const inScaleByKg = !!bundle && num(p.price_per_kg) > 0;
    const perPiece = num(p.price_per_piece) > 0 && !inScaleByKg;
    if (!perPiece && num(kgVal) <= 0) { showErr(T.needKg); return false; }
    const offerName = p.offer ? (activeOffers.find((o) => o.id === p.offer)?.name || T.offerLine) : null;
    const name = [p.name, p.segment, p.source_kind === 'STOCK' && p.brand ? '- ' + p.brand : ''].filter(Boolean).join(' ');
    setCart((c) => [...c, { key: `${Date.now()}-${Math.random()}`, type: 'PIECE', piece_item_id: p.id, code: p.code, name, offer: offerName, mode: perPiece ? 'PIECE' : 'KG', qty: String(n), kg: perPiece ? '' : String(num(kgVal)), price: String(perPiece ? num(p.price_per_piece) : num(p.price_per_kg)), bundle, kind: p.source_kind, segment: p.segment, brand: p.brand, season: p.season }]);
    return true;
  };
  const onCodeEnter = async () => {
    const c = code.trim(); if (!c) return;
    try {
      const r = await axiosClient.get(`/piece-items/by_code/?code=${encodeURIComponent(c)}`);
      if (addPiece(r.data, qty, kg)) { setCode(''); setQty('1'); setKg(''); }
      return;
    } catch (e) { if (e.response?.status !== 404) { apiErr(e); return; } }
    const s = stock.find((x) => String(x.product_code || '').toLowerCase() === c.toLowerCase());
    if (!s) { showErr(T.notFound); return; }
    if (addWeight(s, kg)) { setCode(''); setQty('1'); setKg(''); }
  };
  const updLine = (key, field, val) => setCart((c) => c.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const delLine = (key) => setCart((c) => c.filter((l) => l.key !== key));
  const openScale = () => { const n = bundleCount + 1; setBundleCount(n); setBundle(`${T.scale} ${n}`); };

  // ---------- customer ----------
  const lookupCust = async () => {
    const qv = custQ.trim(); if (!qv) { setCust(null); setCustNew(false); return; }
    try { const r = await axiosClient.get(`/customers/lookup/?q=${encodeURIComponent(qv)}`); setCust(r.data); setCustNew(false); setCustNameIn(r.data.name || ''); }
    catch (e) { if (e.response?.status === 404) { setCust(null); setCustNew(true); } else apiErr(e); }
  };

  // ---------- coupon ----------
  const applyCoupon = async () => {
    const cc = couponIn.trim(); if (!cc) return;
    try {
      const r = await axiosClient.get(`/offers/validate_coupon/?code=${encodeURIComponent(cc)}${terminal?.default_warehouse ? `&warehouse=${terminal.default_warehouse}` : ''}`);
      setCoupon({ code: r.data.code, offer: r.data.offer });
    } catch (e) { apiErr(e); setCoupon(null); }
  };

  const resetSale = () => { setApprovedBy(null); setCart([]); setBundle(null); setBundleCount(0); setDiscount(''); setDelivery(''); setPrevBal(''); setNotes(''); setCustQ(''); setCust(null); setCustNew(false); setCustNameIn(''); setPicked([]); setCoupon(null); setCouponIn(''); setPayRows([]); setCashGiven(''); };

  const holdSale = () => {
    if (!cart.length) return;
    const label = (window.prompt(isRTL ? 'اكتب علامة تفتكر بيها الزبون (اختياري) - مثلاً: الأستاذة اللي لابسة أحمر' : 'A label to recognize this customer (optional)') || '').trim(); saveHeld([...held, { id: `${Date.now()}`, label, at: new Date().toLocaleTimeString('en-GB'), cart, bundleCount, custQ, custNameIn, discount, delivery, prevBal, notes, picked, couponIn }]);
    resetSale();
  };
  const resumeHeld = (h) => {
    resetSale();
    setCart(h.cart); setBundleCount(h.bundleCount || 0); setCustQ(h.custQ || ''); setCustNameIn(h.custNameIn || ''); setDiscount(h.discount || ''); setDelivery(h.delivery || ''); setPrevBal(h.prevBal || ''); setNotes(h.notes || ''); setPicked(h.picked || []); setCouponIn(h.couponIn || '');
    saveHeld(held.filter((x) => x.id !== h.id)); setShowHeld(false);
  };

  // ---------- pay ----------
  const openPay = () => {
    if (!shift) { setShowOpenShift(true); showErr(T.needShift); return; }
    if (!cart.length) { showErr(T.needItems); return; }
    if (cart.some((l) => (l.mode === 'PIECE' ? num(l.qty) < 1 : num(l.kg) <= 0))) { showErr(T.badLine); return; } if (cart.some((l) => num(l.price) <= 0)) { showErr(isRTL ? 'فيه صنف سعره صفر. حط سعره في التسعير أو اكتبه في السطر' : 'A line has a zero price. Set its price first'); return; }
    const cashM = payMethods.find((m) => m.method_type === 'CASH') || payMethods[0];
    setPayRows([{ key: 'r0', id: cashM ? cashM.id : '', amount: required.toFixed(2) }]); setCashGiven(required.toFixed(2)); setShowPay(true);
  };
  const addPayRow = () => { const used = payRows.map((r) => r.id); const m = payMethods.find((x) => !used.includes(x.id)); if (!m) return; setPayRows([...payRows, { key: `r${Date.now()}`, id: m.id, amount: Math.max(0, remaining).toFixed(2) }]); };
  const updPay = (key, field, val) => setPayRows(payRows.map((r) => (r.key === key ? { ...r, [field]: val } : r)));

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F1') { e.preventDefault(); if (!showPay && !receipt) openPay(); }
      if (e.key === 'F3') { e.preventDefault(); if (!showPay) { resetSale(); setReceipt(null); } }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const submitSale = async () => {
    if (hasCredit && !cust && phoneDigits.length < 6) { showErr(T.needPhone); return; }
    setBusy(true);
    const items = cart.map((l) => (l.type === 'PIECE'
      ? { piece_item_id: l.piece_item_id, quantity_pieces: parseInt(l.qty || '1', 10) || 1, weight_kg: l.mode === 'KG' ? num(l.kg).toFixed(3) : '0', unit_price: num(l.price).toFixed(2), price_mode: l.mode, display_name: l.name, bundle_label: l.bundle || null, offer_label: l.offer || null }
      : { stock_item_id: l.stock_item_id, weight_kg: num(l.kg).toFixed(3), quantity_pieces: 0, unit_price: num(l.price).toFixed(2), price_mode: 'KG', display_name: l.name, bundle_label: l.bundle || null }));
    const body = {
      shift_id: shift.id, items, payments: payRows.filter((r) => num(r.amount) > 0).map((r) => ({ payment_method_id: r.id, amount: num(r.amount).toFixed(2) })),
      discount_amount: r2(offersDisc + num(discount)).toFixed(2), delivery_fee: num(delivery).toFixed(2), previous_balance: num(prevBal).toFixed(2), notes: approvedBy ? `${notes} [موافقة المدير على تعديل السعر/الخصم: ${approvedBy}]`.trim() : notes,
      coupon_code: coupon ? coupon.code : '', applied_offers: applied.map((x) => ({ id: x.o.id, name: x.o.name, discount: x.d.toFixed(2), coupon: x.coupon }))
    };
    if (cust) body.customer_id = cust.id; else if (phoneDigits) { body.customer_phone = phoneDigits; body.customer_name = custNameIn; }
    try {
      const r = await axiosClient.post('/sales/checkout/', body); let rc = cust; if (!rc && phoneDigits) { try { const lr = await axiosClient.get(`/customers/lookup/?q=${phoneDigits}`); rc = lr.data; } catch (e2) { rc = null; } }
      setReceipt({ number: r.data.invoice_number, lines: cart, subtotal, offers: applied.map((x) => ({ name: x.o.name, d: x.d })), discount: num(discount), delivery: num(delivery), prev: num(prevBal), required,
        pays: payRows.filter((x) => num(x.amount) > 0).map((x) => ({ name: payMethods.find((m) => m.id === x.id)?.name || '', amount: num(x.amount) })), cashGiven: num(cashGiven), change: changeDue,
        customer: cust ? `${cust.code || ''} ${cust.name}` : '', custName: rc ? rc.name : custNameIn, custPhone: rc ? rc.phone : phoneDigits, custCode: rc ? (rc.code || '') : '', at: new Date().toLocaleString('en-GB') });
      setShowPay(false); resetSale(); loadShop(terminal);
    } catch (e) { apiErr(e); } finally { setBusy(false); }
  };

  const openShiftNow = async () => {
    try { const r = await axiosClient.post('/shifts/open/', { terminal_id: terminal.id, opening_cash: num(openingCash).toFixed(2) }); setShift(r.data); setShowOpenShift(false); }
    catch (e) { apiErr(e); }
  };

  const printReceipt = async () => {
    const co = await getCompanyInfo();
    const R = receipt; const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const groups = []; R.lines.forEach((l) => { const g = l.bundle || ''; let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, lines: [] }; groups.push(grp); } grp.lines.push(l); });
    const lineHtml = (l, pad) => `<tr><td style="${pad ? 'padding-right:8px' : ''}">${esc(l.name)}${l.offer ? ` <b>(${esc(T.offerLine)}: ${esc(l.offer)})</b>` : ''}<br><small>${l.mode === 'PIECE' ? `${esc(l.qty)} ${T.pcs}` : `${kgf(l.kg)} ${T.kg}`} × ${money(l.price)}</small></td><td style="text-align:left">${money(lineTotal(l))}</td></tr>`;
    const body = groups.map((g) => (g.name ? `<tr><td colspan="2" style="font-weight:700;padding-top:4px">${esc(g.name)} — ${money(g.lines.reduce((a, l) => a + lineTotal(l), 0))}</td></tr>` + g.lines.map((l) => lineHtml(l, true)).join('') : g.lines.map((l) => lineHtml(l, false)).join(''))).join('');
    const row = (a, b) => `<tr><td>${a}</td><td style="text-align:left">${b}</td></tr>`;
    const html = `<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(R.number)}</title><style>
      @page{size:80mm auto;margin:3mm} body{font-family:Tahoma,Arial,sans-serif;width:74mm;margin:0;font-size:12px;color:#000}
      table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} small{color:#333} .c{text-align:center} hr{border:0;border-top:1px dashed #000} .t td{font-weight:700}</style></head><body>
      <div class="c">${co.logo ? `<img src="${co.logo}" style="width:48px;height:48px;object-fit:contain">` : ''}<div style="font-weight:700;font-size:14px">${esc(co.name)}</div>
      <div>${esc(terminal?.name || '')}</div><div>${T.invNo}: ${esc(R.number)}</div><div>${new Date().toLocaleString('en-GB')}</div>${(R.custName || R.custPhone) ? `<div>${T.customer}: ${esc([R.custName, R.custCode].filter(Boolean).join(' - '))}</div>${R.custPhone ? `<div>${esc(R.custPhone)}</div>` : ''}` : ''}</div><hr>
      <table>${body}</table><hr><table class="t">
      ${row(T.subtotal, money(R.subtotal))}
      ${R.offers.map((o) => row(`${T.offerLine}: ${esc(o.name)}`, '-' + money(o.d))).join('')}
      ${R.discount ? row(T.discount, '-' + money(R.discount)) : ''}${R.delivery ? row(T.delivery, money(R.delivery)) : ''}${R.prev ? row(T.prev, money(R.prev)) : ''}
      ${row(T.required, money(R.required) + ' ' + T.cur)}
      ${R.pays.map((p) => row(esc(p.name), money(p.amount))).join('')}
      ${R.cashGiven ? row(T.cashGiven, money(R.cashGiven)) : ''}${R.change > 0 ? row(T.changeDue, money(R.change)) : ''}</table><hr>
      <div class="c">${T.thanks}</div><script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return; w.document.open(); w.document.write(html); w.document.close();
  };

  const term = q.trim().toLowerCase();
  const dir = stock.filter((s) => !term || [custName(s), s.product_name, s.product_code].join(' ').toLowerCase().includes(term));
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500';
  const grouped = []; cart.forEach((l) => { const g = l.bundle || ''; let grp = grouped.find((x) => x.name === g); if (!grp) { grp = { name: g, lines: [] }; grouped.push(grp); } grp.lines.push(l); });
  const cashierOffers = activeOffers.filter((o) => o.apply_mode === 'CASHIER');

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">...</div>;
  if (!terminals.length) return <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl text-sm font-bold" dir={isRTL ? 'rtl' : 'ltr'}>{T.noTerm}</div>;

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span><b>{T.shift}:</b> <span className="font-mono text-emerald-400">{shift ? shift.shift_code : T.closed}</span></span>
          <span><b>{T.terminal}:</b> {terminal ? `${terminal.name} (${terminal.code})` : '—'}</span>
          {terminals.length > 1 && <button type="button" onClick={() => setShowTermPick(true)} className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 font-bold cursor-pointer">{T.change}</button>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openDefList} className="h-8 px-3 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold cursor-pointer">{isRTL ? 'المؤجلة' : 'Deferred'}</button>
          <button type="button" onClick={() => setShowHeld(true)} className="h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 font-bold cursor-pointer">{T.held} ({held.length})</button>
          {!shift && terminal && <button type="button" onClick={() => setShowOpenShift(true)} className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 font-bold cursor-pointer">{T.openShift}</button>}
        </div>
      </div>

      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-lg text-sm font-bold">{err}</div>}

      <div className="bg-emerald-600 rounded-xl p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-bold text-emerald-50 space-y-1 block">{T.code}
          <input ref={codeRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCodeEnter(); } }} className={input + ' w-36 font-mono font-bold text-base block'} />
        </label>
        <label className="text-[11px] font-bold text-emerald-50 space-y-1 block">{T.qty}
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCodeEnter(); } }} className={input + ' w-20 block'} />
        </label>
        <label className="text-[11px] font-bold text-emerald-50 space-y-1 block">{T.kg}
          <input type="number" min="0" step="0.001" value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCodeEnter(); } }} className={input + ' w-24 block'} />
        </label>
        <button type="button" onClick={onCodeEnter} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.add}</button>
        {!bundle
          ? <button type="button" onClick={openScale} className="h-10 px-4 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1 cursor-pointer"><Scale size={14} /> {T.scaleOpen}</button>
          : <button type="button" onClick={() => setBundle(null)} className="h-10 px-4 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Scale size={14} /> {T.scaleClose}: {bundle}</button>}
        {bundle && <span className="text-[11px] font-bold text-amber-100">{T.scaleOn}</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 xl:col-span-2">
          <div className="text-sm font-bold">{T.directory}</div>
          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 10 } : { left: 10 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} />
          </div>
          <div className="overflow-y-auto max-h-[55vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100"><tr className="text-slate-700">
                <th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.item}</th><th className="p-2 text-center">{T.grade}</th><th className="p-2 text-center">{T.price}</th><th className="p-2 text-center">{T.avail}</th>
              </tr></thead>
              <tbody>
                {dir.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-500">{T.noStock}</td></tr>}
                {dir.map((s) => (
                  <tr key={s.id} onClick={() => addWeight(s, kg || '1')} className="border-b border-slate-100 cursor-pointer hover:bg-emerald-50">
                    <td className="p-2 font-mono">{s.product_code || '—'}</td>
                    <td className="p-2 font-bold">{custName(s)}</td>
                    <td className="p-2 text-center text-[10px] text-slate-500">{(GL[lang] || GL.ar)[s.grade] || ''}</td>
                    <td className="p-2 text-center font-bold text-emerald-800">{money(s.selling_price_per_kg)}</td>
                    <td className="p-2 text-center">{kgf(s.total_weight_kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 xl:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.custSearch}
              <input value={custQ} onChange={(e) => { setCustQ(e.target.value); setCust(null); setCustNew(false); }} onBlur={lookupCust} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupCust(); } }} className={input + ' w-full font-mono'} />
            </label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.custName}
              <input value={custNameIn} disabled={!!cust} onChange={(e) => setCustNameIn(e.target.value)} className={input + ' w-full disabled:bg-slate-100'} />
            </label>
            {cust && <div className="md:col-span-2 text-xs font-bold text-emerald-800">{cust.code} · {cust.name} · {cust.phone}{num(cust.credit_balance) > 0 ? ` · ${T.debt}: ${money(cust.credit_balance)} ${T.cur}` : ''}</div>}
            {custNew && <div className="md:col-span-2 text-xs font-bold text-amber-700">{T.newCust}</div>}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">{T.invoice} ({cart.length})</div>
            <div className="flex gap-2">
              {approvedBy ? <span className="h-8 px-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center">{isRTL ? 'مفتوح بموافقة' : 'Unlocked by'}: {approvedBy}</span> : <button type="button" onClick={() => { setMgrErr(''); setShowMgr(true); }} className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-bold cursor-pointer">🔒 {isRTL ? 'تعديل السعر (مدير)' : 'Edit price (manager)'}</button>}
              <button type="button" onClick={holdSale} disabled={!cart.length} className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"><PauseCircle size={14} /> {T.hold}</button>
              <button type="button" onClick={resetSale} className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer">{T.clear}</button>
            </div>
          </div>
          {cart.length === 0 && <div className="text-xs text-slate-500 p-3 text-center">{T.empty}</div>}
          {grouped.map((g) => (
            <div key={g.name || 'main'} className={g.name ? 'border border-amber-300 rounded-lg p-2 bg-amber-50/40' : ''}>
              {g.name && <div className="flex justify-between text-xs font-bold text-amber-900 mb-1"><span>{g.name}</span><span>{money(g.lines.reduce((a, l) => a + lineTotal(l), 0))}</span></div>}
              {g.lines.map((l) => (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-center border-b border-slate-100 py-1.5 text-xs">
                  <div className="col-span-4 font-bold">{l.name}{l.offer && <span className="text-violet-700"> ({T.offerLine}: {l.offer})</span>}<div className="text-[10px] text-slate-500 font-normal">{l.mode === 'PIECE' ? T.perPiece : T.perKg}</div></div>
                  <input type="number" min="1" disabled={l.type === 'WEIGHT'} value={l.type === 'WEIGHT' ? '' : l.qty} onChange={(e) => updLine(l.key, 'qty', e.target.value)} className={input + ' col-span-2 h-8 text-xs disabled:bg-slate-50'} placeholder={T.pcs} />
                  <input type="number" min="0" step="0.001" disabled={l.mode === 'PIECE'} value={l.mode === 'PIECE' ? '' : l.kg} onChange={(e) => updLine(l.key, 'kg', e.target.value)} className={input + ' col-span-2 h-8 text-xs disabled:bg-slate-50'} placeholder={T.kg} />
                  <input type="number" min="0" step="0.01" value={l.price} disabled={!approvedBy} onChange={(e) => updLine(l.key, 'price', e.target.value)} className={input + ' col-span-2 h-8 text-xs disabled:bg-slate-100 disabled:text-slate-700'} />
                  <div className="col-span-1 font-bold text-emerald-800 text-center">{money(lineTotal(l))}</div>
                  <button type="button" onClick={() => delLine(l.key)} aria-label="delete" className="col-span-1 h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ))}

          <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-2 space-y-2">
            <div className="text-xs font-bold text-violet-900 flex items-center gap-1"><Tag size={13} /> {T.offers}</div>
            <div className="flex flex-wrap gap-1.5">
              {cashierOffers.length === 0 && activeOffers.filter((o) => o.apply_mode === 'AUTO').length === 0 && <span className="text-[11px] text-slate-500">{T.noOffers}</span>}
              {cashierOffers.map((o) => (
                <button key={o.id} type="button" onClick={() => setPicked(picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id])} className={`h-8 px-3 rounded-full text-xs font-bold border cursor-pointer ${picked.includes(o.id) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-violet-300 text-violet-800'}`}>{o.name}</button>
              ))}
              {activeOffers.filter((o) => o.apply_mode === 'AUTO').map((o) => <span key={o.id} className="h-8 px-3 rounded-full text-xs font-bold bg-violet-100 text-violet-800 flex items-center">{o.name} (auto)</span>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={couponIn} onChange={(e) => setCouponIn(e.target.value.toUpperCase())} placeholder={T.coupon} className={input + ' w-40 font-mono h-8 text-xs'} />
              {!coupon ? <button type="button" onClick={applyCoupon} className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold cursor-pointer">{T.apply}</button>
                : <button type="button" onClick={() => { setCoupon(null); setCouponIn(''); }} className="h-8 px-3 rounded-lg border border-violet-300 bg-white text-violet-800 text-xs font-bold cursor-pointer">{T.remove}: {coupon.code}</button>}
            </div>
            {applied.map((x) => <div key={x.o.id} className="flex justify-between text-xs font-bold text-violet-800"><span>{T.offerLine}: {x.o.name}</span><span>-{money(x.d)}</span></div>)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.discount}<input type="number" min="0" value={discount} disabled={!approvedBy} onChange={(e) => setDiscount(e.target.value)} className={input + ' w-full disabled:bg-slate-100'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.delivery}<input type="number" min="0" value={delivery} onChange={(e) => setDelivery(e.target.value)} className={input + ' w-full'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.prev}<input type="number" min="0" value={prevBal} onChange={(e) => setPrevBal(e.target.value)} className={input + ' w-full'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.notes}<input value={notes} onChange={(e) => setNotes(e.target.value)} className={input + ' w-full'} /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>{T.subtotal}: {money(subtotal)}</div>
              {offersDisc > 0 && <div className="text-violet-700 font-bold">{T.offersDisc}: -{money(offersDisc)}</div>}
              <div className="text-sm font-bold text-emerald-900">{T.required}: <span className="text-2xl">{money(required)}</span> {T.cur}</div>
            </div>
            <button type="button" onClick={openDefNew} disabled={!cart.length} className="h-12 px-5 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-900 text-sm font-black cursor-pointer">{isRTL ? 'فاتورة مؤجلة' : 'Deferred'}</button>
            <button type="button" onClick={openPay} disabled={!cart.length} className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">{T.pay}</button>
          </div>
        </div>
      </div>

      {showTermPick && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="text-base font-bold">{T.pickTerm}</div>
            {terminals.map((t) => (<button key={t.id} type="button" onClick={() => pickTerminal(t)} className="w-full h-12 px-4 rounded-xl border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-sm font-bold text-start cursor-pointer">{t.name} <span className="text-xs text-slate-500 font-mono">({t.code})</span></button>))}
          </div>
        </div>
      )}

      {showMgr && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">🔒 {isRTL ? 'موافقة المدير' : 'Manager approval'}</div><button type="button" onClick={() => setShowMgr(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <div className="text-xs text-slate-600">{isRTL ? 'المدير يكتب الباسورد بتاعه عشان يفتح تعديل السعر والخصم للفاتورة دي بس' : 'The manager types their password to unlock price and discount for this invoice only'}</div>
            <input type="password" autoFocus value={mgrPwd} onChange={(e) => setMgrPwd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verifyMgr(); } }} className={input + ' w-full text-center'} placeholder={isRTL ? 'باسورد المدير' : 'Manager password'} />
            {mgrErr && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{mgrErr}</div>}
            <button type="button" onClick={verifyMgr} disabled={!mgrPwd} className="w-full h-11 rounded-xl bg-slate-900 disabled:bg-slate-400 text-white text-sm font-bold cursor-pointer">{isRTL ? 'تأكيد' : 'Confirm'}</button>
          </div>
        </div>
      )}
      {showDefNew && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{isRTL ? 'فاتورة مؤجلة (أمانة)' : 'Deferred invoice'}</div><button type="button" onClick={() => setShowDefNew(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold">{isRTL ? 'العميل' : 'Customer'}: {cust ? `${cust.name} (${cust.code || ''}) · ${cust.phone}` : `${custNameIn} · ${phoneDigits}`}</div>
            <div className="text-center text-2xl font-black text-amber-800">{money(subtotal)} <span className="text-sm">{T.cur}</span></div>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'مدة الرجوع (أيام)' : 'Return within (days)'}<input type="number" min="0" value={defDays} onChange={(e) => setDefDays(e.target.value)} className={input + ' w-full'} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'العربون (اختياري)' : 'Deposit (optional)'}<input type="number" min="0" step="0.01" value={defDep} onChange={(e) => setDefDep(e.target.value)} className={input + ' w-full'} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{isRTL ? 'طريقة دفع العربون' : 'Deposit method'}
                <select value={defDepM} onChange={(e) => setDefDepM(e.target.value)} className={input + ' w-full'}>{payMethods.filter((m) => m.method_type !== 'CREDIT').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </label>
            </div>
            {defErr && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{defErr}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDefNew(false)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={defBusy} onClick={submitDef} className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">{defBusy ? T.saving : (isRTL ? 'حفظ وطباعة إيصال الأمانة' : 'Save & print')}</button>
            </div>
          </div>
        </div>
      )}

      {showDefList && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{isRTL ? 'الفواتير المؤجلة المفتوحة' : 'Open deferred invoices'}</div><button type="button" onClick={() => setShowDefList(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <div className="flex gap-2">
              <input value={defQ} onChange={(e) => setDefQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadDef(); } }} placeholder={isRTL ? 'ابحث بالتليفون أو رقم الفاتورة أو كود العميل...' : 'Search by phone, number or customer code...'} className={input + ' flex-1'} />
              <button type="button" onClick={() => loadDef()} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"><Search size={14} /></button>
            </div>
            {defErr && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{defErr}</div>}
            {defList.length === 0 && <div className="text-xs text-slate-500 text-center p-3">{isRTL ? 'مفيش فواتير مؤجلة مفتوحة' : 'No open deferred invoices'}</div>}
            {defList.map((ds) => (
              <div key={ds.id} className={`border rounded-lg p-3 text-xs space-y-1 ${ds.is_overdue ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold">{ds.number} · {ds.customer_name} ({ds.customer_code}) · <span className="font-mono">{ds.customer_phone}</span></span>
                  <span className={ds.is_overdue ? 'font-bold text-rose-700' : 'text-slate-600'}>{isRTL ? 'آخر ميعاد' : 'Due'}: {ds.due_date}{ds.is_overdue ? (isRTL ? ' (متأخرة)' : ' (overdue)') : ''}</span>
                </div>
                <div className="text-slate-600">{new Date(ds.created_at).toLocaleString('en-GB')} · {isRTL ? 'الكاشير' : 'Cashier'}: {ds.cashier_name || '—'}</div>
                <div className="text-slate-700">{(ds.lines || []).map((l) => `${l.display_name} (${l.price_mode === 'PIECE' ? `${l.quantity_pieces} ${T.pcs}` : `${kgf(l.weight_kg)} ${isRTL ? 'كجم' : 'KG'}`})`).join(' · ')}</div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{isRTL ? 'الإجمالي' : 'Total'}: {money(ds.total_amount)} · {isRTL ? 'العربون' : 'Deposit'}: {money(ds.deposit_amount)} · {isRTL ? 'الباقي' : 'Due'}: {money(num(ds.total_amount) - num(ds.deposit_amount))}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => printDeferred(ds)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer"><Printer size={13} /></button>
                    <button type="button" onClick={() => startConvert(ds)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">{isRTL ? 'تحويل لبيع' : 'Convert to sale'}</button>
                    <button type="button" onClick={() => { setDefRefund(true); setDefErr(''); setDefAct({ ds, mode: 'cancel' }); }} className="h-8 px-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 font-bold cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </div>
                {defAct && defAct.ds.id === ds.id && defAct.mode === 'convert' && (
                  <div className="border-t border-slate-200 pt-2 space-y-2">
                    {defPayRows.map((r) => (
                      <div key={r.key} className="flex gap-2 items-center">
                        <select value={r.id} onChange={(e) => setDefPayRows(defPayRows.map((x) => (x.key === r.key ? { ...x, id: e.target.value } : x)))} className={input + ' flex-1 h-9'}>{payMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                        <input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => setDefPayRows(defPayRows.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))} className={input + ' w-28 h-9 text-center'} />
                        {defPayRows.length > 1 && <button type="button" onClick={() => setDefPayRows(defPayRows.filter((x) => x.key !== r.key))} aria-label="remove" className="h-9 w-9 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button>}
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setDefPayRows([...defPayRows, { key: `d${Date.now()}`, id: payMethods[0] ? payMethods[0].id : '', amount: Math.max(0, defRemaining).toFixed(2) }])} className="h-8 px-2 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 font-bold cursor-pointer">{T.addPay}</button>
                      <span className={`font-bold ${Math.abs(defRemaining) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>{T.remaining}: {money(defRemaining)}</span>
                    </div>
                    <button type="button" disabled={defBusy || Math.abs(defRemaining) >= 0.01} onClick={doConvert} className="w-full h-10 rounded-lg bg-emerald-600 disabled:bg-slate-400 text-white font-black cursor-pointer">{defBusy ? T.saving : (isRTL ? 'تأكيد البيع' : 'Confirm sale')}</button>
                  </div>
                )}
                {defAct && defAct.ds.id === ds.id && defAct.mode === 'cancel' && (
                  <div className="border-t border-slate-200 pt-2 space-y-2">
                    <div className="font-bold text-rose-800">{isRTL ? 'البضاعة هترجع لرصيد المحل.' : 'Goods will return to shop stock.'}</div>
                    {num(ds.deposit_amount) > 0 && (
                      <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={defRefund} onChange={(e) => setDefRefund(e.target.checked)} /> {isRTL ? `رجّع العربون للعميل (${money(ds.deposit_amount)})` : `Refund the deposit (${money(ds.deposit_amount)})`}</label>
                    )}
                    <button type="button" disabled={defBusy} onClick={doCancel} className="w-full h-10 rounded-lg bg-rose-600 disabled:bg-slate-400 text-white font-black cursor-pointer">{defBusy ? T.saving : (isRTL ? 'تأكيد الإلغاء' : 'Confirm cancel')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {showHeld && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{T.held}</div><button type="button" onClick={() => setShowHeld(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            {held.length === 0 && <div className="text-xs text-slate-500">{T.noHeld}</div>}
            {held.map((h) => (
              <div key={h.id} className="border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center justify-between gap-2 p-2">
                  <button type="button" onClick={() => setOpenHeld(openHeld === h.id ? null : h.id)} className="flex-1 text-start cursor-pointer">
                    <div className="font-bold text-slate-900">{h.label || h.custNameIn || h.custQ || (isRTL ? 'بدون اسم' : 'No name')}</div>
                    <div className="text-slate-500">{h.at} · {h.cart.length} {isRTL ? 'صنف' : 'items'} · {money(h.cart.reduce((a, l) => a + lineTotal(l), 0))} {T.cur} · {openHeld === h.id ? '▲' : '▼'}</div>
                  </button>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => resumeHeld(h)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">{T.resume}</button>
                    <button type="button" onClick={() => saveHeld(held.filter((x) => x.id !== h.id))} aria-label="delete" className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>
                {openHeld === h.id && (
                  <div className="border-t border-slate-100 p-2 space-y-1 bg-slate-50">
                    {(h.custNameIn || h.custQ) && <div className="font-bold text-slate-700">{isRTL ? 'العميل' : 'Customer'}: {h.custNameIn} {h.custQ}</div>}
                    {h.cart.map((l) => (
                      <div key={l.key} className="flex justify-between gap-2">
                        <span>{l.bundle ? `${l.bundle} · ` : ''}{l.name} — {l.mode === 'PIECE' ? `${l.qty} ${T.pcs}` : `${kgf(l.kg)} ${isRTL ? 'كجم' : 'KG'}`} × {money(l.price)}</span>
                        <span className="font-bold whitespace-nowrap">{money(lineTotal(l))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showOpenShift && terminal && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{T.openTitle}</div><button type="button" onClick={() => setShowOpenShift(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.openingCash}<input type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className={input + ' w-full text-center font-bold'} /></label>
            <button type="button" onClick={openShiftNow} className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">{T.open}</button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{T.payTitle}</div><button type="button" onClick={() => setShowPay(false)} aria-label="close" className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <div className="text-center text-3xl font-black text-emerald-800">{money(required)} <span className="text-sm">{T.cur}</span></div>{err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            {payRows.map((r) => (
              <div key={r.key} className="flex gap-2 items-center">
                <select value={r.id} onChange={(e) => updPay(r.key, 'id', e.target.value)} className={input + ' flex-1'}>{payMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => updPay(r.key, 'amount', e.target.value)} className={input + ' w-32 text-center font-bold'} />
                {payRows.length > 1 && <button type="button" onClick={() => setPayRows(payRows.filter((x) => x.key !== r.key))} aria-label="remove" className="h-10 w-10 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={14} /></button>}
              </div>
            ))}
            {payRows.length < payMethods.length && <button type="button" onClick={addPayRow} className="h-9 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"><Plus size={13} /> {T.addPay}</button>}
            <div className={`text-center text-sm font-bold ${Math.abs(remaining) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>{T.remaining}: {money(remaining)} {T.cur}</div>
            {cashRow && (
              <div className="grid grid-cols-2 gap-2 items-end">
                <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.cashGiven}<input type="number" min="0" step="0.01" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} className={input + ' w-full text-center font-bold'} /></label>
                <div className={`text-center text-sm font-bold pb-2 ${changeDue >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>{T.changeDue}: {money(changeDue)}</div>
              </div>
            )}
            {hasCredit && !cust && phoneDigits.length < 6 && <div className="text-xs font-bold text-rose-700">{T.needPhone}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowPay(false)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={busy || Math.abs(remaining) >= 0.01 || (cashRow && changeDue < 0) || (hasCredit && !cust && phoneDigits.length < 6)} onClick={submitSale} className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">{busy ? T.saving : T.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            {/* RECEIPT_V2 */}
            <div className="flex items-center justify-between">
              <div className="text-base font-bold text-emerald-700">{T.receipt} ✅</div>
              <div className="text-[11px] text-slate-500">{receipt.at}</div>
            </div>
            <div className="text-xs text-slate-600">{T.invNo}: <span className="font-mono font-bold text-slate-900">{receipt.number}</span></div>
            {(
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs space-y-0.5">
                <div className="font-bold text-slate-900">{T.customer}: {(receipt.custName || receipt.custPhone) ? (receipt.custName || '—') : (isRTL ? 'عميل نقدي' : 'Walk-in')}{receipt.custCode ? ` (${receipt.custCode})` : ''}</div>
                {receipt.custPhone && <div className="text-slate-700 font-mono">{isRTL ? 'التليفون' : 'Phone'}: {receipt.custPhone}</div>}
              </div>
            )}
            <div className="text-xs space-y-1 border-y border-slate-100 py-2">
              {receipt.lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-2">
                  <span>{l.bundle ? `${l.bundle} · ` : ''}{l.name}{l.offer ? ` (${T.offerLine}: ${l.offer})` : ''} — {l.mode === 'PIECE' ? `${l.qty} ${T.pcs}` : `${kgf(l.kg)} ${isRTL ? 'كجم' : 'KG'}`} × {money(l.price)}</span>
                  <span className="font-bold whitespace-nowrap">{money(lineTotal(l))}</span>
                </div>
              ))}
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span>{T.subtotal}</span><span>{money(receipt.subtotal)}</span></div>
              {receipt.offers.map((o) => <div key={o.name} className="flex justify-between text-violet-700 font-bold"><span>{T.offerLine}: {o.name}</span><span>-{money(o.d)}</span></div>)}
              {receipt.discount > 0 && <div className="flex justify-between"><span>{T.discount}</span><span>-{money(receipt.discount)}</span></div>}
              {receipt.delivery > 0 && <div className="flex justify-between"><span>{T.delivery}</span><span>{money(receipt.delivery)}</span></div>}
              {receipt.prev > 0 && <div className="flex justify-between"><span>{T.prev}</span><span>{money(receipt.prev)}</span></div>}
            </div>
            <div className="flex justify-between text-base font-black text-emerald-800 bg-emerald-50 rounded-lg p-2"><span>{T.required}</span><span>{money(receipt.required)} {T.cur}</span></div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-slate-700">{isRTL ? 'طريقة الدفع' : 'Payment'}</div>
              {receipt.pays.map((p) => <div key={p.name} className="flex justify-between"><span>{p.name}</span><span className="font-bold">{money(p.amount)}</span></div>)}
              {receipt.cashGiven > 0 && <div className="flex justify-between"><span>{T.cashGiven}</span><span className="font-bold">{money(receipt.cashGiven)}</span></div>}
              <div className="flex justify-between text-sm font-black"><span>{T.changeDue}</span><span>{money(Math.max(0, receipt.change))} {T.cur}</span></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={printReceipt} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-1 cursor-pointer"><Printer size={15} /> {T.print}</button>
              <button type="button" onClick={() => { setReceipt(null); setTimeout(() => codeRef.current && codeRef.current.focus(), 50); }} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">{T.newSale}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}