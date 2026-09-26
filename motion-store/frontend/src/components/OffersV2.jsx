import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from './ExportButtons';
import { exportCouponsPDF } from '../utils/reportExport';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
const INVOICE_TYPES = ['INVOICE', 'GIFT', 'COUPON'];
const PIECE_TYPES = ['ANYPIECE', 'ITEMPRICE'];
const BALE_GRADES = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة'];
const BALE_GRADES_EN = { 'سوبر كريم': 'Super Cream', 'كريم': 'Cream', 'كريم في واحد': 'Cream in One', 'نمرة 1': 'No. 1', 'نمرة 2': 'No. 2', 'سحبة': 'Sahba' };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => 'MS-' + Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const GROUPS = [
  { ar: 'الكمية والوزن', en: 'Quantity & Weight', types: ['QTY', 'BXGY', 'WKG', 'TIERS'] },
  { ar: 'السعر الثابت', en: 'Fixed Price', types: ['ANYPIECE', 'ITEMPRICE', 'KGDAY', 'SCALEFIX'] },
  { ar: 'المجموعات', en: 'Bundles', types: ['BAG', 'COMBO'] },
  { ar: 'موجّه', en: 'Targeted', types: ['TARGET', 'AGING'] },
  { ar: 'على الفاتورة', en: 'Invoice', types: ['INVOICE', 'GIFT', 'COUPON'] }
];
const TYPES = {
  QTY: { ar: 'خصم على الكمية', en: 'Quantity discount', params: [['minQty', 'أقل عدد قطع', 'Min pieces'], ['pct', 'نسبة الخصم %', 'Discount %']], sumAr: 'اشتري {minQty} قطع أو أكتر ← خصم {pct}%', sumEn: 'Buy {minQty}+ pieces → {pct}% off' },
  BXGY: { ar: 'اشتري وخد', en: 'Buy X get Y', params: [['buy', 'اشتري', 'Buy'], ['get', 'وخد', 'Get'], ['getPct', 'خصم على اللي بياخده % (100 = ببلاش)', 'Discount on free items % (100 = free)']], sumAr: 'اشتري {buy} وخد {get} بخصم {getPct}% (الأرخص)', sumEn: 'Buy {buy} get {get} at {getPct}% off (cheapest)' },
  WKG: { ar: 'خصم على الوزن', en: 'Weight discount', params: [['minKg', 'أقل وزن (كجم)', 'Min weight (KG)'], ['kgPrice', 'سعر الكيلو بعد الخصم', 'Price/KG after discount']], sumAr: 'لو الوزن {minKg} كجم أو أكتر ← الكيلو بـ {kgPrice}', sumEn: '{minKg}+ KG → {kgPrice}/KG' },
  TIERS: { ar: 'شرايح وزن', en: 'Weight tiers', params: [['t1', 'من 1 لـ 3 كجم: الكيلو بـ', '1-3 KG: price/KG'], ['t2', 'من 3 لـ 5 كجم: الكيلو بـ', '3-5 KG: price/KG'], ['t3', 'فوق 5 كجم: الكيلو بـ', 'Over 5 KG: price/KG']], sumAr: 'الكيلو: {t1} / {t2} / {t3} حسب الوزن', sumEn: 'Per KG: {t1} / {t2} / {t3} by weight' },
  ANYPIECE: { ar: 'أي قطعة بسعر واحد', en: 'Any piece one price', params: [['price', 'سعر العرض للقطعة', 'Offer price per piece']], sumAr: 'أي {piece_name} {segment} بـ {price} ج.م', sumEn: 'Any {piece_name} {segment} for {price}' },
  ITEMPRICE: { ar: 'قطعة معينة بسعر', en: 'Specific piece price', params: [['price', 'سعر العرض للقطعة', 'Offer price per piece']], sumAr: '{piece_name} {segment} بـ {price} ج.م (سعر عرض)', sumEn: '{piece_name} {segment} for {price} (offer price)' },
  KGDAY: { ar: 'يوم الكيلو', en: 'Kilo day', params: [['kgPrice', 'سعر الكيلو الموحد', 'Unified price/KG']], sumAr: 'البيع بالكيلو بس، والكيلو بـ {kgPrice} ج.م', sumEn: 'Sell by KG only at {kgPrice}/KG' },
  SCALEFIX: { ar: 'الميزان بسعر ثابت', en: 'Fixed scale price', params: [['kgPrice', 'سعر كيلو الميزان', 'Scale price/KG']], sumAr: 'أي ميزان: الكيلو بـ {kgPrice} ج.م', sumEn: 'Any scale: {kgPrice}/KG' },
  BAG: { ar: 'املى الكيس', en: 'Fill the bag', params: [['bag', 'مقاس الكيس', 'Bag size'], ['price', 'سعر الكيس', 'Bag price']], sumAr: 'كيس {bag} مليان باللي تختاره بـ {price} ج.م', sumEn: '{bag} bag filled for {price}' },
  COMBO: { ar: 'كومبو', en: 'Combo', params: [['codes', 'أكواد القطع (بينهم فاصلة)', 'Piece codes (comma separated)'], ['price', 'سعر الكومبو', 'Combo price']], sumAr: 'كومبو ({codes}) بـ {price} ج.م', sumEn: 'Combo ({codes}) for {price}' },
  TARGET: { ar: 'خصم موجّه', en: 'Targeted discount', params: [['pct', 'نسبة الخصم %', 'Discount %']], sumAr: 'خصم {pct}% على اللي مختار في "ينطبق على"', sumEn: '{pct}% off on the selected target' },
  AGING: { ar: 'البضاعة الراكدة', en: 'Aged stock', params: [['days', 'عدد الأيام في المحل', 'Days in shop'], ['pct', 'نسبة الخصم %', 'Discount %']], sumAr: 'البضاعة اللي عدّت {days} يوم في المحل ← خصم {pct}%', sumEn: 'Items older than {days} days → {pct}% off' },
  INVOICE: { ar: 'خصم على الفاتورة', en: 'Invoice discount', params: [['minAmount', 'أقل مبلغ للفاتورة', 'Min invoice amount'], ['pct', 'نسبة الخصم %', 'Discount %'], ['fixed', 'أو خصم ثابت (ج.م) - اختياري', 'Or fixed discount (optional)']], sumAr: 'فاتورة {minAmount} ج.م أو أكتر ← خصم {pct}%', sumEn: 'Invoice {minAmount}+ → {pct}% off' },
  GIFT: { ar: 'هدية', en: 'Gift', params: [['minAmount', 'أقل مبلغ للفاتورة', 'Min invoice amount'], ['gift', 'الهدية (كود قطعة)', 'Gift (piece code)']], sumAr: 'فاتورة {minAmount} ج.م أو أكتر ← هدية {gift}', sumEn: 'Invoice {minAmount}+ → gift {gift}' },
  COUPON: { ar: 'كوبون', en: 'Coupon', params: [['pct', 'نسبة الخصم %', 'Discount %']], sumAr: 'كوبون ← خصم {pct}%', sumEn: 'Coupon → {pct}% off' }
};
const OPTIONAL = ['fixed'];
const TX = {
  ar: { list: 'العروض المتسجلة', none: 'لسه مفيش عروض.', active: 'شغال', stopped: 'موقوف', edit: 'تعديل', newOffer: 'عرض جديد', editing: 'تعديل عرض', name: 'اسم العرض', type: 'نوع العرض', summary: 'ملخص العرض',
    piece: 'القطعة اللي عليها العرض', pCode: 'كود القطعة', pCodePh: 'فاضي = يتعمل لوحده', pName: 'اسم القطعة', source: 'تصنيفها', kinds: { BALE: 'بالة', STOCK: 'استوك', DIRECT: 'شراء مباشر' },
    target: 'ينطبق على', all: 'الكل', kind: 'التصنيف', segment: 'الصنف', brand: 'البراند', grade: 'الدرجة (داخلي)', bgrade: 'الدرجة (درجات البالة)', season: 'الموسم',
    grades: { NEW_COLLECTION: 'عالي', MIDDLE: 'وسط', CLEARANCE: 'تصفيات' }, time: 'الوقت', dFrom: 'من تاريخ', dTo: 'إلى تاريخ', tFrom: 'من الساعة', tTo: 'إلى الساعة', days: 'الأيام',
    dayNames: { SAT: 'السبت', SUN: 'الأحد', MON: 'الاتنين', TUE: 'التلات', WED: 'الأربع', THU: 'الخميس', FRI: 'الجمعة' }, shops: 'المحلات (من غير اختيار = كل المحلات)',
    settings: 'إعدادات', mode: 'طريقة التطبيق', modes: { AUTO: 'أوتوماتيك', CASHIER: 'الكاشير يختاره', COUPON: 'بكوبون' }, stack: 'يتجمّع مع عروض تانية', yes: 'أيوه', no: 'لا',
    maxDisc: 'أقصى خصم للفاتورة (ج.م)', noLimit: 'بدون حد', role: 'مين يطبّقه', roles: { ANY: 'أي كاشير', MANAGER: 'مدير بس' }, save: 'حفظ العرض', update: 'حفظ التعديل', cancel: 'إلغاء',
    coupon: 'الكوبون', cmodes: { SHARED: 'كود واحد للكل', UNIQUE: 'أكواد فريدة (كل كود مرة واحدة)' }, cCode: 'كود الكوبون', gen: 'توليد', maxUses: 'أقصى عدد استخدام', uniqueNote: 'بعد ما تحفظ العرض، هتلاقي في الكارت زرار "توليد كوبونات" و"طباعة الكوبونات".',
    genCoupons: 'توليد كوبونات', printCoupons: 'طباعة الكوبونات', howMany: 'عايز كام كوبون؟ (من 1 لـ 1000)', coupons: 'كوبونات', usedOf: 'اتستعمل', noUnused: 'مفيش كوبونات لسه ماتستعملتش للطباعة', generated: 'اتولّد',
    pieceCode: 'كود القطعة', used: 'اتستعمل', times: 'مرة', sales: 'مبيعات', disc: 'خصم', cur: 'ج.م', saved: 'اتحفظ ✅', failed: 'حصلت مشكلة: ', rTitle: 'قايمة العروض', status: 'الحالة', choose: 'اختار...', noneOpt: 'مفيش' },
  en: { list: 'Saved Offers', none: 'No offers yet.', active: 'Active', stopped: 'Stopped', edit: 'Edit', newOffer: 'New Offer', editing: 'Edit Offer', name: 'Offer name', type: 'Offer type', summary: 'Offer summary',
    piece: 'Offer piece', pCode: 'Piece code', pCodePh: 'Empty = auto', pName: 'Piece name', source: 'Source', kinds: { BALE: 'Bale', STOCK: 'Stock', DIRECT: 'Direct' },
    target: 'Applies to', all: 'All', kind: 'Source', segment: 'Category', brand: 'Brand', grade: 'Grade (internal)', bgrade: 'Grade (bale grades)', season: 'Season',
    grades: { NEW_COLLECTION: 'High', MIDDLE: 'Medium', CLEARANCE: 'Low' }, time: 'Time', dFrom: 'From date', dTo: 'To date', tFrom: 'From time', tTo: 'To time', days: 'Days',
    dayNames: { SAT: 'Sat', SUN: 'Sun', MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri' }, shops: 'Shops (none selected = all shops)',
    settings: 'Settings', mode: 'Apply mode', modes: { AUTO: 'Automatic', CASHIER: 'Cashier picks', COUPON: 'By coupon' }, stack: 'Stacks with other offers', yes: 'Yes', no: 'No',
    maxDisc: 'Max discount per invoice', noLimit: 'No limit', role: 'Who can apply', roles: { ANY: 'Any cashier', MANAGER: 'Manager only' }, save: 'Save Offer', update: 'Save Changes', cancel: 'Cancel',
    coupon: 'Coupon', cmodes: { SHARED: 'One shared code', UNIQUE: 'Unique codes (single use each)' }, cCode: 'Coupon code', gen: 'Generate', maxUses: 'Max uses', uniqueNote: 'After saving, use "Generate coupons" and "Print coupons" on the offer card.',
    genCoupons: 'Generate coupons', printCoupons: 'Print coupons', howMany: 'How many coupons? (1-1000)', coupons: 'Coupons', usedOf: 'used', noUnused: 'No unused coupons to print', generated: 'Generated',
    pieceCode: 'Piece code', used: 'Used', times: 'times', sales: 'Sales', disc: 'Discount', cur: 'EGP', saved: 'Saved ✅', failed: 'Something went wrong: ', rTitle: 'Offers List', status: 'Status', choose: 'Choose...', noneOpt: 'None' }
};
const empty = { id: null, name: '', offer_type: 'QTY', params: {}, targets: {}, date_from: '', date_to: '', time_from: '', time_to: '', days: [], shops: [], apply_mode: 'CASHIER', stackable: false, max_discount: '', required_role: 'ANY', coupon_mode: 'SHARED', coupon_max_uses: '' };

export default function OffersV2() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [offers, setOffers] = useState([]);
  const [opts, setOpts] = useState({ SEGMENT: [], BRAND: [], SEASON: [] });
  const [shops, setShops] = useState([]);
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => { const r = await axiosClient.get('/offers/?all=1'); setOffers(listOf(r.data)); };
  useEffect(() => {
    load();
    Promise.all(['SEGMENT', 'BRAND', 'SEASON'].map((t) => axiosClient.get(`/purchase-options/?option_type=${t}`))).then((res) => {
      setOpts({ SEGMENT: listOf(res[0].data).map((x) => x.name), BRAND: listOf(res[1].data).map((x) => x.name), SEASON: listOf(res[2].data).map((x) => x.name) });
    }).catch(() => {});
    axiosClient.get('/warehouses/').then((r) => setShops(listOf(r.data).filter((w) => w.warehouse_type === 'STORE' && w.is_active !== false))).catch(() => {});
  }, []);

  const typeDef = TYPES[f.offer_type];
  const isPiece = PIECE_TYPES.includes(f.offer_type);
  const isCoupon = f.offer_type === 'COUPON' || f.apply_mode === 'COUPON';
  const sumOf = (o) => { const d = TYPES[o.offer_type]; if (!d) return o.offer_type; const tpl = lang === 'ar' ? d.sumAr : d.sumEn; return tpl.replace(/\{(\w+)\}/g, (m, k) => ((o.params || {})[k] && String(o.params[k]).trim()) || (k === 'segment' ? '' : '…')).replace(/\s+/g, ' ').trim(); };
  const targetText = (o) => { const t = o.targets || {}; return [t.kind && T.kinds[t.kind], t.segment, t.brand, t.grade && T.grades[t.grade], t.season].filter(Boolean).join(' · '); };
  const P = f.params;
  const missing = typeDef.params.filter((p) => !OPTIONAL.includes(p[0]) && !String(P[p[0]] || '').trim()).length
    + (isPiece && !String(P.piece_name || '').trim() ? 1 : 0)
    + (isCoupon && f.coupon_mode === 'SHARED' && !String(P.coupon || '').trim() ? 1 : 0);
  const valid = f.name.trim() && missing === 0;
  const setParam = (k, v) => setF({ ...f, params: { ...f.params, [k]: v } });
  const setTarget = (k, v) => { const t = { ...f.targets }; if (v) t[k] = v; else delete t[k]; setF({ ...f, targets: t }); };
  const toggleIn = (key, v) => setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const err = (e) => { const d = e.response?.data; alert(T.failed + (d?.detail ? [].concat(d.detail).join(' ') : JSON.stringify(d || e.message))); };

  const save = async () => {
    setBusy(true);
    const mode = f.offer_type === 'COUPON' ? 'COUPON' : f.apply_mode;
    const body = { ...f, apply_mode: mode, coupon_mode: (f.offer_type === 'COUPON' || mode === 'COUPON') ? f.coupon_mode : '', coupon_max_uses: f.coupon_max_uses === '' ? null : Number(f.coupon_max_uses),
      date_from: f.date_from || null, date_to: f.date_to || null, time_from: f.time_from || null, time_to: f.time_to || null, max_discount: f.max_discount === '' ? null : f.max_discount,
      targets: INVOICE_TYPES.includes(f.offer_type) || isPiece ? {} : f.targets };
    delete body.id; delete body.coupons_total; delete body.coupons_used; delete body.offer_piece_code;
    try {
      if (f.id) await axiosClient.patch(`/offers/${f.id}/`, body); else await axiosClient.post('/offers/', body);
      setF(empty); await load(); setMsg(T.saved); setTimeout(() => setMsg(''), 3000);
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const toggle = async (o) => { try { await axiosClient.patch(`/offers/${o.id}/`, { is_active: !o.is_active }); await load(); } catch (e) { err(e); } };
  const startEdit = (o) => setF({ ...empty, ...o, params: o.params || {}, targets: o.targets || {}, days: o.days || [], shops: (o.shops || []).map(String), date_from: o.date_from || '', date_to: o.date_to || '', time_from: (o.time_from || '').slice(0, 5), time_to: (o.time_to || '').slice(0, 5), max_discount: o.max_discount ?? '', coupon_mode: o.coupon_mode || 'SHARED', coupon_max_uses: o.coupon_max_uses ?? '' });
  const genCoupons = async (o) => {
    const n = parseInt(prompt(T.howMany) || '0', 10); if (!n) return;
    try { const r = await axiosClient.post(`/offers/${o.id}/generate_coupons/`, { count: n }); await load(); setMsg(`${T.generated}: ${r.data.created}`); setTimeout(() => setMsg(''), 3000); } catch (e) { err(e); }
  };
  const printCoupons = async (o) => {
    try {
      const r = await axiosClient.get(`/offers/${o.id}/coupons/`);
      const codes = (r.data || []).filter((c) => c.is_active && (c.max_uses === null || c.used_count < c.max_uses)).map((c) => c.code);
      if (!codes.length) { alert(T.noUnused); return; }
      await exportCouponsPDF({ offerName: o.name, summary: sumOf(o), validTo: o.date_to || '', codes, isRTL });
    } catch (e) { err(e); }
  };

  const chip = (active, onClick, label, color = 'emerald') => (
    <button key={label} type="button" onClick={onClick} className={`h-8 px-3 rounded-lg border text-xs font-bold cursor-pointer ${active ? (color === 'violet' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white') : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'}`}>{label}</button>
  );
  const input = 'h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const sel = (value, onChange, list, labelFn, emptyLabel) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={input + ' w-full'}>
      <option value="">{emptyLabel || T.all}</option>{list.map((x) => <option key={x} value={x}>{labelFn ? labelFn(x) : x}</option>)}
    </select>
  );
  const report = () => ({ title: T.rTitle, filename: 'offers', columns: [
    { key: 'name', header: T.name, width: 22 }, { key: 'sum', header: T.summary, width: 40 }, { key: 'target', header: T.target, width: 22 }, { key: 'mode', header: T.mode, width: 14 },
    { key: 'status', header: T.status, width: 10 }, { key: 'used', header: T.used, type: 'number' }, { key: 'sales', header: T.sales, type: 'money' }, { key: 'disc', header: T.disc, type: 'money' }
  ], rows: offers.map((o) => ({ name: o.name, sum: sumOf(o), target: targetText(o) || T.all, mode: T.modes[o.apply_mode] || o.apply_mode, status: o.is_active ? T.active : T.stopped, used: Number(o.usage_count || 0), sales: Number(o.total_sales || 0), disc: Number(o.total_discount || 0) })) });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 xl:col-span-1">
        <div className="flex items-center justify-between"><div className="text-sm font-bold">{T.list}</div><ExportButtons getReport={report} /></div>
        {offers.length === 0 && <div className="text-xs text-slate-500">{T.none}</div>}
        {offers.map((o) => (
          <div key={o.id} className="border border-slate-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{o.name}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => startEdit(o)} className="h-7 px-2 rounded-md border border-slate-300 bg-white text-[11px] font-bold cursor-pointer">{T.edit}</button>
                <button type="button" onClick={() => toggle(o)} className={`h-7 px-2 rounded-full text-[11px] font-bold cursor-pointer ${o.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{o.is_active ? T.active : T.stopped}</button>
              </div>
            </div>
            <div className="text-xs text-slate-700">{sumOf(o)}</div>
            {o.offer_piece_code && <div className="text-[11px] font-bold text-violet-700">{T.pieceCode}: {o.offer_piece_code}</div>}
            {(o.offer_type === 'COUPON' || o.apply_mode === 'COUPON') && (
              <div className="text-[11px] text-violet-800 space-y-1">
                <div>{T.cmodes[o.coupon_mode || 'SHARED']}{(o.coupon_mode || 'SHARED') === 'SHARED' && o.params?.coupon ? `: ${o.params.coupon}` : ''} · {T.coupons}: {o.coupons_total} · {T.usedOf}: {o.coupons_used}</div>
                {o.coupon_mode === 'UNIQUE' && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => genCoupons(o)} className="h-7 px-2 rounded-md bg-violet-600 text-white text-[11px] font-bold cursor-pointer">{T.genCoupons}</button>
                    <button type="button" onClick={() => printCoupons(o)} className="h-7 px-2 rounded-md border border-violet-300 bg-violet-50 text-violet-800 text-[11px] font-bold cursor-pointer">{T.printCoupons}</button>
                  </div>
                )}
              </div>
            )}
            <div className="text-[11px] text-slate-500">{T.modes[o.apply_mode]}{targetText(o) ? ' · ' + targetText(o) : ''}{o.days?.length ? ' · ' + o.days.map((d) => T.dayNames[d]).join('، ') : ''}</div>
            <div className="text-[11px] text-slate-500">{T.used}: {o.usage_count} {T.times} · {T.sales}: {Number(o.total_sales).toLocaleString('en-US')} · {T.disc}: {Number(o.total_discount).toLocaleString('en-US')} {T.cur}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 xl:col-span-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">{f.id ? T.editing : T.newOffer}</div>
          {msg && <div className="text-xs font-bold text-emerald-700">{msg}</div>}
        </div>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.name}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input + ' w-full'} /></label>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-600">{T.type}</div>
          {GROUPS.map((g) => (
            <div key={g.ar} className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500">{lang === 'ar' ? g.ar : g.en}</div>
              <div className="flex flex-wrap gap-1.5">{g.types.map((t) => chip(f.offer_type === t, () => setF({ ...f, offer_type: t }), lang === 'ar' ? TYPES[t].ar : TYPES[t].en, 'violet'))}</div>
            </div>
          ))}
        </div>

        {isPiece && (
          <div className="space-y-3 border border-violet-200 rounded-lg p-3">
            <div className="text-xs font-bold text-violet-900">{T.piece}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.pCode}<input value={P.piece_code || ''} placeholder={T.pCodePh} onChange={(e) => setParam('piece_code', e.target.value)} className={input + ' w-full font-mono'} /></label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block md:col-span-2">{T.pName}<input value={P.piece_name || ''} onChange={(e) => setParam('piece_name', e.target.value)} className={input + ' w-full'} /></label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-20">{T.source}</span>{['BALE', 'STOCK', 'DIRECT'].map((k) => chip((P.source_kind || 'BALE') === k, () => setParam('source_kind', k), T.kinds[k]))}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.segment}{sel(P.segment, (v) => setParam('segment', v), opts.SEGMENT, null, T.choose)}</label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.season}{sel(P.season, (v) => setParam('season', v), opts.SEASON, null, T.choose)}</label>
              {(P.source_kind || 'BALE') === 'STOCK' && <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.brand}{sel(P.brand, (v) => setParam('brand', v), opts.BRAND, null, T.noneOpt)}</label>}
            </div>
            {(P.source_kind || 'BALE') === 'BALE' && (
              <div className="space-y-1"><div className="text-[11px] font-bold text-slate-500">{T.bgrade}</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">{BALE_GRADES.map((g) => chip((P.purchase_grade || 'سوبر كريم') === g, () => setParam('purchase_grade', g), lang === 'ar' ? g : BALE_GRADES_EN[g]))}</div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-violet-50 border border-violet-200 rounded-lg p-3">
          {typeDef.params.map((p) => (
            <label key={p[0]} className="text-[11px] font-bold text-violet-900 space-y-1 block">{lang === 'ar' ? p[1] : p[2]}
              <input value={P[p[0]] || ''} onChange={(e) => setParam(p[0], e.target.value)} className={input + ' w-full border-violet-300'} />
            </label>
          ))}
        </div>
        <div className="text-xs font-bold text-violet-800">{T.summary}: {sumOf(f)}</div>

        {!INVOICE_TYPES.includes(f.offer_type) && !isPiece && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="text-xs font-bold">{T.target}</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.kind}{sel(f.targets.kind, (v) => setTarget('kind', v), ['BALE', 'STOCK', 'DIRECT'], (x) => T.kinds[x])}</label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.segment}{sel(f.targets.segment, (v) => setTarget('segment', v), opts.SEGMENT)}</label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.brand}{sel(f.targets.brand, (v) => setTarget('brand', v), opts.BRAND)}</label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.grade}{sel(f.targets.grade, (v) => setTarget('grade', v), ['NEW_COLLECTION', 'MIDDLE', 'CLEARANCE'], (x) => T.grades[x])}</label>
              <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.season}{sel(f.targets.season, (v) => setTarget('season', v), opts.SEASON)}</label>
            </div>
          </div>
        )}

        {isCoupon && (
          <div className="space-y-2 border border-violet-200 rounded-lg p-3">
            <div className="text-xs font-bold text-violet-900">{T.coupon}</div>
            <div className="flex flex-wrap gap-1.5">{['SHARED', 'UNIQUE'].map((m) => chip(f.coupon_mode === m, () => setF({ ...f, coupon_mode: m }), T.cmodes[m], 'violet'))}</div>
            {f.coupon_mode === 'SHARED' ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.cCode}<input value={P.coupon || ''} onChange={(e) => setParam('coupon', e.target.value.toUpperCase())} className={input + ' w-44 font-mono'} /></label>
                <button type="button" onClick={() => setParam('coupon', genCode())} className="h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold cursor-pointer">{T.gen}</button>
                <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.maxUses}<input type="number" min="1" value={f.coupon_max_uses} placeholder={T.noLimit} onChange={(e) => setF({ ...f, coupon_max_uses: e.target.value })} className={input + ' w-36'} /></label>
              </div>
            ) : (<div className="text-[11px] text-violet-800">{T.uniqueNote}</div>)}
          </div>
        )}

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="text-xs font-bold">{T.time}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.dFrom}<input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className={input + ' w-full'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.dTo}<input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className={input + ' w-full'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.tFrom}<input type="time" value={f.time_from} onChange={(e) => setF({ ...f, time_from: e.target.value })} className={input + ' w-full'} /></label>
            <label className="text-[11px] font-bold text-slate-600 space-y-1 block">{T.tTo}<input type="time" value={f.time_to} onChange={(e) => setF({ ...f, time_to: e.target.value })} className={input + ' w-full'} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-20">{T.days}</span>{DAYS.map((d) => chip(f.days.includes(d), () => toggleIn('days', d), T.dayNames[d]))}</div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="text-xs font-bold">{T.settings}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-40">{T.shops}</span>{shops.map((s) => chip(f.shops.includes(String(s.id)), () => toggleIn('shops', String(s.id)), s.name))}</div>
          {f.offer_type !== 'COUPON' && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-40">{T.mode}</span>{['AUTO', 'CASHIER', 'COUPON'].map((m) => chip(f.apply_mode === m, () => setF({ ...f, apply_mode: m }), T.modes[m]))}</div>}
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-40">{T.stack}</span>{chip(!f.stackable, () => setF({ ...f, stackable: false }), T.no)}{chip(f.stackable, () => setF({ ...f, stackable: true }), T.yes)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-500 w-40">{T.role}</span>{['ANY', 'MANAGER'].map((r) => chip(f.required_role === r, () => setF({ ...f, required_role: r }), T.roles[r]))}</div>
          <label className="text-[11px] font-bold text-slate-600 flex items-center gap-2">{T.maxDisc}<input type="number" min="0" value={f.max_discount} placeholder={T.noLimit} onChange={(e) => setF({ ...f, max_discount: e.target.value })} className={input + ' w-40'} /></label>
        </div>

        <div className="flex gap-2 justify-end">
          {f.id && <button type="button" onClick={() => setF(empty)} className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>}
          <button type="button" disabled={busy || !valid} onClick={save} className="h-10 px-6 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer">{f.id ? T.update : T.save}</button>
        </div>
      </div>
    </div>
  );
}