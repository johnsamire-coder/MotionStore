import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from './ExportButtons';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const TX = {
  ar: { from: 'من تاريخ', to: 'إلى تاريخ', target: 'نوع التسعير', all: 'الكل', W: 'أوزان', P: 'قطع', kind: 'التصنيف', code: 'الكود', show: 'عرض', results: 'عدد النتائج',
    date: 'التاريخ', by: 'بواسطة', name: 'الاسم / البراند', segment: 'الصنف', grade: 'الدرجة', season: 'الموسم', field: 'السعر', old: 'القديم', neu: 'الجديد',
    per_kg: 'الكيلو', per_piece: 'القطعة', kinds: { BALE: 'بالة', STOCK: 'استوك', DIRECT: 'خاص' }, g: { NEW_COLLECTION: 'عالي', MIDDLE: 'وسط', CLEARANCE: 'تصفيات' }, title: 'سجل تغييرات الأسعار', empty: 'مفيش تغييرات' },
  en: { from: 'From', to: 'To', target: 'Pricing type', all: 'All', W: 'Weights', P: 'Pieces', kind: 'Source', code: 'Code', show: 'Show', results: 'Results',
    date: 'Date', by: 'By', name: 'Name / Brand', segment: 'Category', grade: 'Grade', season: 'Season', field: 'Price', old: 'Old', neu: 'New',
    per_kg: 'per KG', per_piece: 'per Piece', kinds: { BALE: 'Bale', STOCK: 'Stock', DIRECT: 'Special' }, g: { NEW_COLLECTION: 'High', MIDDLE: 'Medium', CLEARANCE: 'Low' }, title: 'Price Change Log', empty: 'No changes' }
};

export default function PriceLogV2() {
  const { lang, isRTL } = useLanguage();
  const T = TX[lang] || TX.ar;
  const [f, setF] = useState({ from: '', to: '', target: '', kind: '', code: '' });
  const [rows, setRows] = useState([]);
  const load = async (x = f) => {
    const p = new URLSearchParams({ all: '1' });
    if (x.from) p.append('date_from', x.from); if (x.to) p.append('date_to', x.to);
    if (x.target) p.append('target', x.target); if (x.kind) p.append('kind', x.kind); if (x.code) p.append('code', x.code.trim());
    const r = await axiosClient.get(`/price-change-log/?${p.toString()}`); setRows(listOf(r.data));
  };
  useEffect(() => { load(); }, []);
  const gl = (g) => T.g[g] || g || '—';
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white';
  const report = () => ({ title: T.title, filename: 'price-change-log', filtersText: [f.from, f.to, f.target && T[f.target], f.kind && T.kinds[f.kind], f.code].filter(Boolean).join(' | '), columns: [
    { key: 'date', header: T.date, width: 17 }, { key: 'by', header: T.by, width: 12 }, { key: 'target', header: T.target, width: 10 }, { key: 'kind', header: T.kind, width: 10 },
    { key: 'code', header: T.code, width: 10 }, { key: 'name', header: T.name, width: 22 }, { key: 'grade', header: T.grade, width: 12 }, { key: 'season', header: T.season, width: 10 },
    { key: 'field', header: T.field, width: 10 }, { key: 'old', header: T.old, type: 'money' }, { key: 'neu', header: T.neu, type: 'money' }
  ], rows: rows.map((r) => ({ date: dt(r.created_at), by: r.changed_by_name || '—', target: r.target === 'WEIGHT' ? T.W : T.P, kind: T.kinds[r.kind] || '—', code: r.code || '—', name: r.name || r.key || '—', grade: gl(r.grade), season: r.season || '—', field: T[r.field] || r.field, old: Number(r.old_price || 0), neu: Number(r.new_price || 0) })) });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input + ' w-full'} /></label>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input + ' w-full'} /></label>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.target}<select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option><option value="WEIGHT">{T.W}</option><option value="PIECE">{T.P}</option></select></label>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.kind}<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={input + ' w-full'}><option value="">{T.all}</option>{Object.keys(T.kinds).map((k) => <option key={k} value={k}>{T.kinds[k]}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.code}<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={input + ' w-full'} /></label>
        <button type="button" onClick={() => load()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-500">{T.results}: {rows.length}</div>
        <ExportButtons getReport={report} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-100 text-slate-700">
            <th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.by}</th><th className="p-2 text-start">{T.target}</th><th className="p-2 text-start">{T.kind}</th>
            <th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.name}</th><th className="p-2 text-start">{T.grade}</th><th className="p-2 text-start">{T.season}</th>
            <th className="p-2 text-start">{T.field}</th><th className="p-2 text-center">{T.old}</th><th className="p-2 text-center">{T.neu}</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={11} className="p-4 text-center text-slate-500">{T.empty}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-2 font-mono whitespace-nowrap">{dt(r.created_at)}</td><td className="p-2">{r.changed_by_name || '—'}</td>
                <td className="p-2">{r.target === 'WEIGHT' ? T.W : T.P}</td><td className="p-2">{T.kinds[r.kind] || '—'}</td>
                <td className="p-2 font-mono">{r.code || '—'}</td><td className="p-2 font-bold">{r.name || r.key || '—'}</td>
                <td className="p-2">{gl(r.grade)}</td><td className="p-2">{r.season || '—'}</td><td className="p-2">{T[r.field] || r.field}</td>
                <td className="p-2 text-center text-slate-500">{r.old_price ?? '—'}</td><td className="p-2 text-center font-bold text-emerald-800">{r.new_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}