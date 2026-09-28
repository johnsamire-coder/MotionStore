// PURCHASE_FORM_V3
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { X, Trash2, Plus, Save } from 'lucide-react';

const GRADES = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة'];
const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND = { BALE: 'بالة', STOCK: 'استوك', DIRECT: 'شراء مباشر' };

const lineName = (l) => {
  if (l.purchase_kind === 'BALE') return `بالة - ${l.segment} - ${l.season} - ${l.grade} - ${l.item_name}`;
  if (l.purchase_kind === 'STOCK') return `استوك - ${l.segment} - ${l.season} - ${l.stock_type === 'ONE_BRAND' ? l.brand : `ميكس${l.brands.length ? ` (${l.brands.join('، ')})` : ''}`}`;
  return ['شراء مباشر', l.segment, l.season, l.direct_category, l.brand || (l.brands.length ? `ميكس (${l.brands.join('، ')})` : ''), l.grade].filter(Boolean).join(' - ');
};

const fromSaved = (l) => { const x = { purchase_kind: l.purchase_kind, segment: l.segment || "", season: l.season || "", grade: l.grade || "", item_name: l.item_name || "", ton_type: l.ton_type || "", ton_group: l.ton_group || "", stock_type: l.stock_type || "", brand: l.brand || "", brands: l.brands || [], direct_category: l.direct_category || "", quantity: l.quantity_pieces || 0, weight_kg: num(l.weight_kg), unit_price: num(l.unit_cost), total: num(l.total_cost), key: String(l.id || Math.random()) }; x.description = lineName(x); return x; };
export default function PurchaseInvoiceForm({ suppliers = [], warehouses = [], onClose, onSaved, editInvoice = null, managerPassword = "" }) {
  const { isRTL } = useLanguage();
  const [localSup, setLocalSup] = useState([]);
  const allSup = [...suppliers, ...localSup].filter((s, i, a) => s.is_active !== false && a.findIndex((x) => x.id === s.id) === i);
  const [supplierId, setSupplierId] = useState(editInvoice ? String(editInvoice.supplier || "") : "");
  const [warehouseId, setWarehouseId] = useState(editInvoice ? String(editInvoice.warehouse || "") : "");
  const [freight, setFreight] = useState(editInvoice ? String(editInvoice.additional_costs || "0") : "0");
  const [newSup, setNewSup] = useState(null);
  const [kind, setKind] = useState('BALE');
  const [opts, setOpts] = useState({ ITEM: [], BRAND: [], CATEGORY: [] });
  const [adding, setAdding] = useState(null);
  const [addText, setAddText] = useState('');
  const [f, setF] = useState({ ton_type: 'NORMAL', segment: 'حريمي', season: 'صيفي', grade: GRADES[0], item_name: '', bales: '', stock_type: 'ONE_BRAND', brand: '', brands: [], direct_category: '', dBrandMode: 'NONE', dGrade: '', weight: '', price: '' });
  const [tonGroup, setTonGroup] = useState(`T${Date.now()}`);
  const [lines, setLines] = useState(editInvoice ? (editInvoice.items || editInvoice.line_items || []).map(fromSaved) : []);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!warehouseId && warehouses.length) { const s = warehouses.find((w) => w.warehouse_type === 'SORTING'); setWarehouseId((s || warehouses[0]).id); } }, [warehouses]);
  const loadOpts = async () => {
    try {
      const res = await Promise.all(['ITEM', 'BRAND', 'CATEGORY'].map((t) => axiosClient.get(`/purchase-options/?option_type=${t}&page_size=500`)));
      setOpts({ ITEM: listOf(res[0].data).map((o) => o.name), BRAND: listOf(res[1].data).map((o) => o.name), CATEGORY: listOf(res[2].data).map((o) => o.name) });
    } catch (e) { setErr('مش قادر أجيب اللستات: ' + e.message); }
  };
  useEffect(() => { loadOpts(); }, []);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const saveOption = async () => {
    const name = addText.trim(); if (!name) return;
    try { await axiosClient.post('/purchase-options/', { option_type: adding, name }); await loadOpts(); if (adding === 'ITEM') set('item_name', name); if (adding === 'CATEGORY') set('direct_category', name); if (adding === 'BRAND') set('brand', name); setAdding(null); setAddText(''); }
    catch (e) { setErr('مش قادر أضيف: ' + (e.response?.data?.detail || e.message)); }
  };
  const saveSupplier = async () => {
    if (!newSup.name.trim()) return;
    try { const r = await axiosClient.post('/suppliers/', { name: newSup.name.trim(), phone: newSup.phone || '' }); setLocalSup((p) => [...p, r.data]); setSupplierId(r.data.id); setNewSup(null); }
    catch (e) { setErr('مش قادر أضيف المورد: ' + (e.response?.data?.detail || JSON.stringify(e.response?.data || e.message).slice(0, 150))); }
  };
  const addLine = () => {
    setErr('');
    const w = num(f.weight); const p = num(f.price);
    if (w <= 0 || p <= 0) { setErr('اكتب الوزن وسعر الكيلو (أكبر من صفر)'); return; }
    let l = { purchase_kind: kind, segment: f.segment, season: f.season, weight_kg: w, unit_price: p, brands: [], brand: '', grade: '', item_name: '', direct_category: '', stock_type: '', ton_type: '', ton_group: '', quantity: 0 };
    if (kind === 'BALE') {
      if (!f.item_name) { setErr('اختار صنف البالة'); return; }
      const g = f.ton_type === 'ASSORTED' ? tonGroup : `T${Date.now()}`;
      l = { ...l, grade: f.grade, item_name: f.item_name, ton_type: f.ton_type, ton_group: g, quantity: parseInt(f.bales || '0', 10) || 0 };
    } else if (kind === 'STOCK') {
      if (f.stock_type === 'ONE_BRAND' && !f.brand) { setErr('اختار البراند'); return; }
      l = { ...l, stock_type: f.stock_type, brand: f.stock_type === 'ONE_BRAND' ? f.brand : '', brands: f.stock_type === 'MIX_BRAND' ? f.brands : [] };
    } else {
      if (!f.direct_category) { setErr('اختار التصنيف'); return; }
      if (f.dBrandMode === 'ONE' && !f.brand) { setErr('اختار البراند أو خليه "بدون براند"'); return; }
      l = { ...l, direct_category: f.direct_category, grade: f.dGrade, stock_type: f.dBrandMode === 'NONE' ? '' : (f.dBrandMode === 'ONE' ? 'ONE_BRAND' : 'MIX_BRAND'), brand: f.dBrandMode === 'ONE' ? f.brand : '', brands: f.dBrandMode === 'MIX' ? f.brands : [] };
    }
    l.total = w * p; l.key = `${Date.now()}-${Math.random()}`; l.description = lineName(l);
    setLines((prev) => [...prev, l]); set('weight', ''); set('price', ''); set('bales', '');
  };
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const handleSave = async () => {
    setErr('');
    if (!lines.length) { setErr('الفاتورة فاضية - ضيف سطر واحد على الأقل'); return; }
    if (!supplierId) { setErr('اختار المورد'); return; }
    if (!warehouseId) { setErr('اختار المخزن'); return; }
    setSaving(true);
    try {
      await axiosClient.post(editInvoice ? "/purchases/" + editInvoice.id + "/replace/" : "/purchases/", {
        supplier_id: supplierId, warehouse_id: warehouseId, freight_cost: num(freight).toFixed(2), manager_password: managerPassword || undefined,
        items: lines.map((l) => ({ product_id: null, category_id: null, quantity: l.quantity, purchase_kind: l.purchase_kind, segment: l.segment, season: l.season, grade: l.grade || null,
          item_name: l.item_name || null, ton_type: l.ton_type || '', ton_group: l.ton_group || '', stock_type: l.stock_type || null, brand: l.brand || null, brands: l.brands, direct_category: l.direct_category || '',
          description: l.description, weight_kg: l.weight_kg.toFixed(3), unit_price: l.unit_price.toFixed(2) })),
      });
      if (onSaved) onSaved();
    } catch (e) { setErr(e.response?.data?.detail || ('حصلت مشكلة: ' + e.message)); } finally { setSaving(false); }
  };

  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full';
  const Chips = ({ list, value, onPick }) => <div className="flex flex-wrap gap-1.5">{list.map((x) => <button key={x} type="button" onClick={() => onPick(x)} className={`h-9 px-3 rounded-lg border text-xs font-bold cursor-pointer ${value === x ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'}`}>{x}</button>)}</div>;
  const Pick = ({ type, value, onPick, label }) => (
    <div className="space-y-1">
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div className="flex gap-2"><select value={value} onChange={(e) => onPick(e.target.value)} className={input}><option value="">— اختار —</option>{opts[type].map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <button type="button" onClick={() => { setAdding(type); setAddText(''); }} className="h-10 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold whitespace-nowrap cursor-pointer">+ إضافة</button></div>
      {adding === type && <div className="flex gap-2"><input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveOption(); }} placeholder="اكتب الاسم الجديد" className={input} /><button type="button" onClick={saveOption} className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">حفظ</button><button type="button" onClick={() => setAdding(null)} className="h-10 px-3 rounded-lg border border-slate-300 text-xs cursor-pointer">إلغاء</button></div>}
    </div>
  );
  const MultiBrands = () => (
    <div className="space-y-1"><div className="text-xs font-bold text-slate-600">البراندات اللي جواه (اختياري - ممكن ولا واحد)</div>
      <div className="flex flex-wrap gap-1.5">{opts.BRAND.map((b) => { const on = f.brands.includes(b); return <button key={b} type="button" onClick={() => set('brands', on ? f.brands.filter((x) => x !== b) : [...f.brands, b])} className={`h-8 px-3 rounded-lg border text-xs font-bold cursor-pointer ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{b}</button>; })}
        <button type="button" onClick={() => { setAdding('BRAND'); setAddText(''); }} className="h-8 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer">+ براند</button></div>
      {adding === 'BRAND' && <div className="flex gap-2"><input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="اسم البراند" className={input} /><button type="button" onClick={saveOption} className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">حفظ</button></div>}
    </div>
  );
  const tonCount = lines.filter((l) => l.ton_group === tonGroup).length;
  return (
    <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl max-w-5xl w-full p-5 space-y-4 max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between"><div className="text-lg font-black">{editInvoice ? "تعديل فاتورة " + editInvoice.invoice_number : "فاتورة شراء جديدة"}</div><button type="button" onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={18} /></button></div>
        {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1"><div className="font-bold text-slate-600">المورد *</div>
            <div className="flex gap-2"><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}><option value="">— اختار المورد —</option>{allSup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <button type="button" onClick={() => setNewSup({ name: '', phone: '' })} className="h-10 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 font-bold whitespace-nowrap cursor-pointer">+ مورد جديد</button></div>
            {newSup && <div className="flex gap-2"><input autoFocus value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} placeholder="اسم المورد" className={input} /><input value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} placeholder="التليفون" className={input} /><button type="button" onClick={saveSupplier} className="h-10 px-3 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">حفظ</button></div>}
          </div>
          <label className="font-bold text-slate-600 space-y-1 block">المخزن *<select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={input}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="font-bold text-slate-600 space-y-1 block">مصاريف النقل (ج.م)<input type="number" min="0" value={freight} onChange={(e) => setFreight(e.target.value)} className={input} /></label>
        </div>
        <div className="flex gap-2">{Object.keys(KIND).map((k) => <button key={k} type="button" onClick={() => { setKind(k); setErr(''); if (k === 'DIRECT' && !['صيفي', 'شتوي', 'ميكس', 'بدون'].includes(f.season)) set('season', 'صيفي'); if (k !== 'DIRECT' && !['صيفي', 'شتوي'].includes(f.season)) set('season', 'صيفي'); }} className={`flex-1 h-11 rounded-xl border text-sm font-black cursor-pointer ${kind === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{KIND[k]}</button>)}</div>
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          {kind === 'BALE' && (
            <div className="flex flex-wrap items-center gap-3"><span className="font-bold text-slate-600">نوع الطن:</span><Chips list={['طن عادي', 'طن تشكيل']} value={f.ton_type === 'NORMAL' ? 'طن عادي' : 'طن تشكيل'} onPick={(x) => set('ton_type', x === 'طن عادي' ? 'NORMAL' : 'ASSORTED')} />
              {f.ton_type === 'ASSORTED' && <span className="text-slate-500">الطن الحالي فيه {tonCount} سطر <button type="button" onClick={() => setTonGroup(`T${Date.now()}`)} className="h-8 px-3 ms-2 rounded-lg border border-slate-300 font-bold cursor-pointer">طن تشكيل جديد</button></span>}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><div className="font-bold text-slate-600">حريمي ولا رجالي</div><Chips list={['حريمي', 'رجالي']} value={f.segment} onPick={(x) => set('segment', x)} /></div>
            <div className="space-y-1"><div className="font-bold text-slate-600">الموسم</div><Chips list={kind === 'DIRECT' ? ['صيفي', 'شتوي', 'ميكس', 'بدون'] : ['صيفي', 'شتوي']} value={f.season} onPick={(x) => set('season', x)} /></div>
          </div>
          {kind === 'BALE' && (<>
            <div className="space-y-1"><div className="font-bold text-slate-600">درجة البالة</div><Chips list={GRADES} value={f.grade} onPick={(x) => set('grade', x)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Pick type="ITEM" value={f.item_name} onPick={(x) => set('item_name', x)} label="صنف البالة (بلوزة، بنطلون، أطفالي محيّر...)" />
              <label className="font-bold text-slate-600 space-y-1 block">عدد البالات<input type="number" min="0" value={f.bales} onChange={(e) => set('bales', e.target.value)} className={input} /></label></div>
          </>)}
          {kind === 'STOCK' && (<>
            <div className="space-y-1"><div className="font-bold text-slate-600">نوع البراند</div><Chips list={['وان براند', 'ميكس براند']} value={f.stock_type === 'ONE_BRAND' ? 'وان براند' : 'ميكس براند'} onPick={(x) => set('stock_type', x === 'وان براند' ? 'ONE_BRAND' : 'MIX_BRAND')} /></div>
            {f.stock_type === 'ONE_BRAND' ? <Pick type="BRAND" value={f.brand} onPick={(x) => set('brand', x)} label="البراند" /> : <MultiBrands />}
          </>)}
          {kind === 'DIRECT' && (<>
            <Pick type="CATEGORY" value={f.direct_category} onPick={(x) => set('direct_category', x)} label="التصنيف (أحذية، شنط...)" />
            <div className="space-y-1"><div className="font-bold text-slate-600">البراند (اختياري)</div><Chips list={['بدون براند', 'وان براند', 'ميكس براند']} value={f.dBrandMode === 'NONE' ? 'بدون براند' : f.dBrandMode === 'ONE' ? 'وان براند' : 'ميكس براند'} onPick={(x) => set('dBrandMode', x === 'بدون براند' ? 'NONE' : x === 'وان براند' ? 'ONE' : 'MIX')} /></div>
            {f.dBrandMode === 'ONE' && <Pick type="BRAND" value={f.brand} onPick={(x) => set('brand', x)} label="البراند" />}
            {f.dBrandMode === 'MIX' && <MultiBrands />}
            <div className="space-y-1"><div className="font-bold text-slate-600">الدرجة (اختياري)</div><Chips list={['بدون درجة', ...GRADES]} value={f.dGrade || 'بدون درجة'} onPick={(x) => set('dGrade', x === 'بدون درجة' ? '' : x)} /></div>
          </>)}
          <div className="grid grid-cols-3 gap-3 items-end">
            <label className="font-bold text-slate-600 space-y-1 block">الوزن (كجم) *<input type="number" min="0" step="0.001" value={f.weight} onChange={(e) => set('weight', e.target.value)} className={input} /></label>
            <label className="font-bold text-slate-600 space-y-1 block">سعر الكيلو *<input type="number" min="0" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLine(); }} className={input} /></label>
            <div className="space-y-1"><div className="font-bold text-slate-600">الإجمالي: {money(num(f.weight) * num(f.price))}</div><button type="button" onClick={addLine} className="w-full h-10 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus size={14} /> ضيف السطر</button></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">#</th><th className="p-2 text-start">السطر</th><th className="p-2 text-center">بالات</th><th className="p-2 text-center">الوزن</th><th className="p-2 text-center">سعر الكيلو</th><th className="p-2 text-center">الإجمالي</th><th className="p-2"></th></tr></thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">لسه مفيش سطور</td></tr>}
              {lines.map((l, i) => (
                <tr key={l.key} className="border-b border-slate-100">
                  <td className="p-2">{i + 1}</td><td className="p-2 font-bold">{l.description}{l.ton_type === 'ASSORTED' ? <span className="text-[10px] text-violet-700"> (طن تشكيل {l.ton_group.slice(-4)})</span> : null}</td>
                  <td className="p-2 text-center">{l.purchase_kind === 'BALE' ? l.quantity : '—'}</td><td className="p-2 text-center">{l.weight_kg}</td><td className="p-2 text-center">{money(l.unit_price)}</td><td className="p-2 text-center font-bold">{money(l.total)}</td>
                  <td className="p-2"><button type="button" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl p-3">
          <div className="text-sm font-bold">البضاعة: {money(subtotal)} + النقل: {money(num(freight))} = <span className="text-lg font-black text-emerald-800">{money(subtotal + num(freight))} ج.م</span></div>
          <button type="button" disabled={saving} onClick={handleSave} className="h-11 px-6 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white font-black flex items-center gap-2 cursor-pointer"><Save size={16} /> {editInvoice ? "حفظ التعديلات" : "حفظ الفاتورة"}</button>
        </div>
      </div>
    </div>
  );
}