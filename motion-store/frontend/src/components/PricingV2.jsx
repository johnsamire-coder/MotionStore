import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from './ExportButtons';
import { Search } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GRADES = ['NEW_COLLECTION', 'MIDDLE', 'CLEARANCE'];
const BALE_GRADES = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة'];
const BALE_GRADES_EN = { 'سوبر كريم': 'Super Cream', 'كريم': 'Cream', 'كريم في واحد': 'Cream in One', 'نمرة 1': 'No. 1', 'نمرة 2': 'No. 2', 'سحبة': 'Sahba' };
const TX = {
  ar: {
    weights: 'تسعير الأوزان', pieces: 'تسعير القطع', bales: 'تسعير البالات', stock: 'تسعير الاستوك', direct: 'تسعير الأصناف الخاصة',
    g: { NEW_COLLECTION: 'عالي', MIDDLE: 'وسط', CLEARANCE: 'تصفيات' }, perKg: 'سعر الكيلو', save: 'حفظ الأسعار', saved: 'اتحفظ',
    brand: 'نوع البراند', mix: 'استوك ميكس', addBrand: '+ إضافة براند', item: 'النوع (من الأصناف اللي اشتريناها)', choose: 'اختار...',
    noItems: 'مفيش أصناف خاصة متسجلة لسه (بتتضاف من فاتورة الشراء المباشر)', showCust: 'هيظهر للزبون',
    code: 'كود القطعة', name: 'اسم القطعة', source: 'تصنيفها', kinds: { BALE: 'بالة', STOCK: 'استوك', DIRECT: 'شراء مباشر' },
    segment: 'الصنف', addSeg: '+ إضافة صنف', grade: 'الدرجة (درجات البالة)', season: 'الموسم', addSeason: '+ إضافة موسم',
    brandOpt: 'البراند (اختياري)', pPiece: 'سعر القطعة', pKg: 'سعر الكيلو', addPiece: 'حفظ القطعة', update: 'حفظ التعديل', cancelEdit: 'إلغاء التعديل',
    search: 'ابحث بالكود أو الاسم أو الصنف...', edit: 'تعديل', stop: 'إيقاف', confirmStop: 'متأكد إنك عايز توقف القطعة دي؟',
    none: 'مفيش', newName: 'اكتب الاسم الجديد:', failed: 'حصلت مشكلة: ', cur: 'ج.م', results: 'عدد النتائج',
    rWeights: 'قايمة أسعار الأوزان', rPieces: 'قايمة أسعار القطع', kind: 'التصنيف', key: 'البراند / النوع'
  },
  en: {
    weights: 'Weight Pricing', pieces: 'Piece Pricing', bales: 'Bales', stock: 'Stock', direct: 'Special Items',
    g: { NEW_COLLECTION: 'High', MIDDLE: 'Medium', CLEARANCE: 'Low' }, perKg: 'Price / KG', save: 'Save Prices', saved: 'Saved',
    brand: 'Brand', mix: 'Mix Stock', addBrand: '+ Add Brand', item: 'Type (from purchased items)', choose: 'Choose...',
    noItems: 'No special items yet (they are added from direct purchase invoices)', showCust: 'Customer sees',
    code: 'Piece Code', name: 'Piece Name', source: 'Source', kinds: { BALE: 'Bale', STOCK: 'Stock', DIRECT: 'Direct Purchase' },
    segment: 'Category', addSeg: '+ Add Category', grade: 'Grade (bale grades)', season: 'Season', addSeason: '+ Add Season',
    brandOpt: 'Brand (optional)', pPiece: 'Price / Piece', pKg: 'Price / KG', addPiece: 'Save Piece', update: 'Save Changes', cancelEdit: 'Cancel Edit',
    search: 'Search by code, name or category...', edit: 'Edit', stop: 'Disable', confirmStop: 'Disable this piece?',
    none: 'None', newName: 'Type the new name:', failed: 'Something went wrong: ', cur: 'EGP', results: 'Results',
    rWeights: 'Weight Price List', rPieces: 'Piece Price List', kind: 'Source', key: 'Brand / Type'
  }
};
const emptyPiece = { id: null, code: '', name: '', source_kind: 'BALE', segment: '', purchase_grade: 'سوبر كريم', season: '', brand: '', price_per_piece: '', price_per_kg: '' };

export default function PricingV2() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [tab, setTab] = useState('W');
  const [wsub, setWsub] = useState('BALE');
  const [opts, setOpts] = useState({ BRAND: [], SPECIAL_ITEM: [], SEGMENT: [], SEASON: [] });
  const [wp, setWp] = useState([]);
  const [brand, setBrand] = useState('');
  const [item, setItem] = useState('');
  const [form, setForm] = useState({ NEW_COLLECTION: '', MIDDLE: '', CLEARANCE: '' });
  const [pieces, setPieces] = useState([]);
  const [pf, setPf] = useState(emptyPiece);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadOpts = async () => {
    const types = ['BRAND', 'SPECIAL_ITEM', 'SEGMENT', 'SEASON'];
    const res = await Promise.all(types.map((t) => axiosClient.get(`/purchase-options/?option_type=${t}`)));
    const o = {}; types.forEach((t, i) => { o[t] = listOf(res[i].data).map((x) => x.name); });
    setOpts(o);
  };
  const loadWp = async () => { const r = await axiosClient.get('/weight-prices/?all=1'); setWp(listOf(r.data)); };
  const loadPieces = async () => { const r = await axiosClient.get('/piece-items/?all=1'); setPieces(listOf(r.data)); };
  useEffect(() => { loadOpts(); loadWp(); loadPieces(); }, []);

  const keyNow = wsub === 'BALE' ? '' : (wsub === 'STOCK' ? brand : item);
  const priceOf = (kind, key, g) => { const r = wp.find((x) => x.kind === kind && x.key === key && x.grade === g); return r ? r.price_per_kg : ''; };
  useEffect(() => {
    setForm({ NEW_COLLECTION: priceOf(wsub, keyNow, 'NEW_COLLECTION'), MIDDLE: priceOf(wsub, keyNow, 'MIDDLE'), CLEARANCE: priceOf(wsub, keyNow, 'CLEARANCE') });
  }, [wsub, brand, item, wp]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const err = (e) => alert(T.failed + (e.response?.data?.detail || e.message));

  const saveWeights = async () => {
    if (wsub !== 'BALE' && !keyNow) { alert(T.choose); return; }
    setBusy(true);
    try {
      await axiosClient.post('/weight-prices/set_prices/', { kind: wsub, key: keyNow, prices: form });
      await loadWp(); flash(T.saved + ' ✅');
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const addOption = async (type, after) => {
    const name = (prompt(T.newName) || '').trim();
    if (!name) return;
    try { await axiosClient.post('/purchase-options/', { option_type: type, name }); await loadOpts(); after && after(name); } catch (e) { err(e); }
  };
  const savePiece = async () => {
    setBusy(true);
    const body = { ...pf, purchase_grade: pf.source_kind === 'BALE' ? pf.purchase_grade : null, brand: pf.source_kind === 'STOCK' ? pf.brand : null, price_per_piece: pf.price_per_piece || '0', price_per_kg: pf.price_per_kg || '0' };
    try {
      if (pf.id) await axiosClient.patch(`/piece-items/${pf.id}/`, body);
      else await axiosClient.post('/piece-items/', body);
      setPf(emptyPiece); await loadPieces(); flash(T.saved + ' ✅');
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const stopPiece = async (p) => {
    if (!window.confirm(T.confirmStop)) return;
    try { await axiosClient.delete(`/piece-items/${p.id}/`); await loadPieces(); } catch (e) { err(e); }
  };

  const gradeName = (g) => (lang === 'ar' ? g : (BALE_GRADES_EN[g] || g));
  const custName = (p) => [p.name, p.segment, p.source_kind === 'STOCK' && p.brand ? '- ' + p.brand : ''].filter(Boolean).join(' ');
  const term = q.trim().toLowerCase();
  const prows = pieces.filter((p) => !term || [p.code, p.name, p.segment, p.season, p.brand, T.kinds[p.source_kind]].join(' ').toLowerCase().includes(term));
  const wrows = wsub === 'BALE' ? [] : Array.from(new Set(wp.filter((x) => x.kind === wsub).map((x) => x.key)));

  const numStr = (v) => String(Number(v || 0));
  const dirtyW = (wsub === 'BALE' || !!keyNow) && GRADES.some((g) => numStr(form[g]) !== numStr(priceOf(wsub, keyNow, g)));
  const origP = pf.id ? pieces.find((x) => x.id === pf.id) : null;
  const pSig = (x) => (x ? [x.code, x.name, x.source_kind, x.segment || '', x.source_kind === 'BALE' ? (x.purchase_grade || '') : '', x.season || '', x.source_kind === 'STOCK' ? (x.brand || '') : '', numStr(x.price_per_piece), numStr(x.price_per_kg)].join('|') : '');
  const dirtyP = pf.id
    ? (origP ? pSig(pf) !== pSig(origP) : true)
    : !!(pf.code.trim() && pf.name.trim() && (Number(pf.price_per_piece) > 0 || Number(pf.price_per_kg) > 0));  const chip = (active, onClick, label) => (
    <button key={label} type="button" onClick={onClick} className={`h-9 px-3 rounded-lg border text-xs font-bold cursor-pointer ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-400'}`}>{label}</button>
  );
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500';

  const weightsReport = () => {
    const rows = [];
    ['BALE', 'STOCK', 'DIRECT'].forEach((k) => {
      Array.from(new Set(wp.filter((x) => x.kind === k).map((x) => x.key))).forEach((key) => {
        rows.push({ kind: T.kinds[k], key: key === 'MIX' ? T.mix : (key || '—'), h: Number(priceOf(k, key, 'NEW_COLLECTION') || 0), m: Number(priceOf(k, key, 'MIDDLE') || 0), l: Number(priceOf(k, key, 'CLEARANCE') || 0) });
      });
    });
    return { title: T.rWeights, filename: 'weight-prices', columns: [
      { key: 'kind', header: T.kind, width: 16 }, { key: 'key', header: T.key, width: 24 },
      { key: 'h', header: T.g.NEW_COLLECTION, type: 'money' }, { key: 'm', header: T.g.MIDDLE, type: 'money' }, { key: 'l', header: T.g.CLEARANCE, type: 'money' }
    ], rows };
  };
  const piecesReport = () => ({ title: T.rPieces, filename: 'piece-prices', filtersText: q, columns: [
    { key: 'code', header: T.code, width: 12 }, { key: 'cust', header: T.showCust, width: 26 }, { key: 'kind', header: T.source, width: 14 },
    { key: 'grade', header: T.grade, width: 14 }, { key: 'season', header: T.season, width: 12 },
    { key: 'pp', header: T.pPiece, type: 'money' }, { key: 'pk', header: T.pKg, type: 'money' }
  ], rows: prows.map((p) => ({ code: p.code, cust: custName(p), kind: T.kinds[p.source_kind], grade: p.purchase_grade ? gradeName(p.purchase_grade) : '—', season: p.season || '—', pp: Number(p.price_per_piece), pk: Number(p.price_per_kg) })) });

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap gap-2">
        {chip(tab === 'W', () => setTab('W'), T.weights)}
        {chip(tab === 'P', () => setTab('P'), T.pieces)}
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}

      {tab === 'W' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {chip(wsub === 'BALE', () => setWsub('BALE'), T.bales)}
              {chip(wsub === 'STOCK', () => setWsub('STOCK'), T.stock)}
              {chip(wsub === 'DIRECT', () => setWsub('DIRECT'), T.direct)}
            </div>
            <ExportButtons getReport={weightsReport} />
          </div>

          {wsub === 'STOCK' && (
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.brand}
                <select value={brand} onChange={(e) => setBrand(e.target.value)} className={input + ' w-64 block'}>
                  <option value="">{T.choose}</option>
                  <option value="MIX">{T.mix}</option>
                  {opts.BRAND.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => addOption('BRAND', setBrand)} className="h-10 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer">{T.addBrand}</button>
            </div>
          )}
          {wsub === 'DIRECT' && (
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.item}
              <select value={item} onChange={(e) => setItem(e.target.value)} className={input + ' w-72 block'}>
                <option value="">{T.choose}</option>
                {opts.SPECIAL_ITEM.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {opts.SPECIAL_ITEM.length === 0 && <span className="block text-amber-700 font-normal mt-1">{T.noItems}</span>}
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {GRADES.map((g) => (
              <label key={g} className="text-xs font-bold text-slate-600 space-y-1 block">{T.g[g]} ({T.perKg})
                <input type="number" min="0" step="0.01" value={form[g]} onChange={(e) => setForm({ ...form, [g]: e.target.value })} className={input + ' w-full text-base font-bold'} />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-emerald-800 font-bold">{T.showCust}: {wsub === 'BALE' ? '—' : (wsub === 'STOCK' ? (brand === 'MIX' ? T.mix : (brand ? (isRTL ? 'استوك ' : 'Stock ') + brand : '—')) : (item || '—'))}</div>
            <button type="button" disabled={busy || !dirtyW} onClick={saveWeights} className="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer">{T.save}</button>
          </div>

          {wrows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">{T.key}</th>{GRADES.map((g) => <th key={g} className="p-2 text-center">{T.g[g]}</th>)}</tr></thead>
                <tbody>
                  {wrows.map((key) => (
                    <tr key={key} className="border-b border-slate-100 cursor-pointer hover:bg-emerald-50" onClick={() => (wsub === 'STOCK' ? setBrand(key) : setItem(key))}>
                      <td className="p-2 font-bold">{key === 'MIX' ? T.mix : key}</td>
                      {GRADES.map((g) => <td key={g} className="p-2 text-center">{money(priceOf(wsub, key, g))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'P' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.code}<input value={pf.code} onChange={(e) => setPf({ ...pf, code: e.target.value })} className={input + ' w-full font-mono font-bold'} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block md:col-span-2">{T.name}<input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} className={input + ' w-full'} /></label>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-600">{T.source}</div>
              <div className="flex flex-wrap gap-2">{['BALE', 'STOCK', 'DIRECT'].map((k) => chip(pf.source_kind === k, () => setPf({ ...pf, source_kind: k }), T.kinds[k]))}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex gap-2 items-end">
                <label className="text-xs font-bold text-slate-600 space-y-1 block flex-1">{T.segment}
                  <select value={pf.segment} onChange={(e) => setPf({ ...pf, segment: e.target.value })} className={input + ' w-full block'}>
                    <option value="">{T.choose}</option>{opts.SEGMENT.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => addOption('SEGMENT', (n) => setPf((p) => ({ ...p, segment: n })))} className="h-10 px-2 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer whitespace-nowrap">{T.addSeg}</button>
              </div>
              <div className="flex gap-2 items-end">
                <label className="text-xs font-bold text-slate-600 space-y-1 block flex-1">{T.season}
                  <select value={pf.season} onChange={(e) => setPf({ ...pf, season: e.target.value })} className={input + ' w-full block'}>
                    <option value="">{T.choose}</option>{opts.SEASON.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => addOption('SEASON', (n) => setPf((p) => ({ ...p, season: n })))} className="h-10 px-2 rounded-lg border border-dashed border-amber-600 bg-amber-50 text-amber-800 text-xs font-bold cursor-pointer whitespace-nowrap">{T.addSeason}</button>
              </div>
              {pf.source_kind === 'STOCK' && (
                <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.brandOpt}
                  <select value={pf.brand || ''} onChange={(e) => setPf({ ...pf, brand: e.target.value })} className={input + ' w-full block'}>
                    <option value="">{T.none}</option>{opts.BRAND.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              )}
            </div>
            {pf.source_kind === 'BALE' && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-600">{T.grade}</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">{BALE_GRADES.map((g) => chip(pf.purchase_grade === g, () => setPf({ ...pf, purchase_grade: g }), gradeName(g)))}</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.pPiece}<input type="number" min="0" step="0.01" value={pf.price_per_piece} onChange={(e) => setPf({ ...pf, price_per_piece: e.target.value })} className={input + ' w-full font-bold'} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.pKg}<input type="number" min="0" step="0.01" value={pf.price_per_kg} onChange={(e) => setPf({ ...pf, price_per_kg: e.target.value })} className={input + ' w-full font-bold'} /></label>
              <div className="text-xs text-emerald-800 font-bold pb-3">{T.showCust}: {custName(pf) || '—'}</div>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !dirtyP} onClick={savePiece} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer">{pf.id ? T.update : T.addPiece}</button>
                {pf.id && <button type="button" onClick={() => setPf(emptyPiece)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">{T.cancelEdit}</button>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 12 } : { left: 12 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search} className={input + ' w-full'} style={isRTL ? { paddingRight: 36 } : { paddingLeft: 36 }} />
              </div>
              <div className="text-xs font-bold text-slate-500">{T.results}: {prows.length}</div>
              <ExportButtons getReport={piecesReport} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.showCust}</th><th className="p-2 text-start">{T.source}</th>
                  <th className="p-2 text-start">{T.grade}</th><th className="p-2 text-start">{T.season}</th><th className="p-2 text-center">{T.pPiece}</th><th className="p-2 text-center">{T.pKg}</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {prows.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="p-2 font-mono font-bold">{p.code}</td>
                      <td className="p-2 font-bold text-emerald-800">{custName(p)}</td>
                      <td className="p-2">{T.kinds[p.source_kind]}</td>
                      <td className="p-2">{p.purchase_grade ? gradeName(p.purchase_grade) : '—'}</td>
                      <td className="p-2">{p.season || '—'}</td>
                      <td className="p-2 text-center">{money(p.price_per_piece)}</td>
                      <td className="p-2 text-center">{money(p.price_per_kg)}</td>
                      <td className="p-2 flex gap-1">
                        <button type="button" onClick={() => setPf({ ...emptyPiece, ...p, segment: p.segment || '', season: p.season || '', brand: p.brand || '', purchase_grade: p.purchase_grade || 'سوبر كريم' })} className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">{T.edit}</button>
                        <button type="button" onClick={() => stopPiece(p)} className="h-8 px-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold cursor-pointer">{T.stop}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}