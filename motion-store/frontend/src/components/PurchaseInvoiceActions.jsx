import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';
import PurchaseInvoiceForm from './PurchaseInvoiceForm';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND = { BALE: 'بالة', STOCK: 'استوك', DIRECT: 'شراء مباشر' };
const LOT = { RECEIVED: ['مستني فرز', 'bg-amber-100 text-amber-800'], SORTING_IN_PROGRESS: ['بيتفرز', 'bg-blue-100 text-blue-800'], SORTED: ['اتفرز', 'bg-emerald-100 text-emerald-800'], CANCELLED: ['ملغي', 'bg-rose-100 text-rose-800'] };
const STATUS = { CONFIRMED: 'مؤكدة', RECEIVED: 'مستلمة', DRAFT: 'مسودة', CANCELLED: 'ملغية' };

export default function PurchaseInvoiceActions({ inv, onDone }) {
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({});
  const [sups, setSups] = useState([]);
  const [det, setDet] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [editData, setEditData] = useState(null);
  const askEdit = (e) => { e.stopPropagation(); setErr(''); setPw(''); setMode('pw'); };
  const openEditForm = async () => {
    setBusy(true); setErr('');
    try {
      await axiosClient.post('/purchases/check_manager/', { manager_password: pw });
      const [r, s, w] = await Promise.all([axiosClient.get('/purchases/' + inv.id + '/'), axiosClient.get('/suppliers/?page_size=500'), axiosClient.get('/warehouses/?page_size=500')]);
      setEditData({ inv: r.data, sups: listOf(s.data), whs: listOf(w.data) }); setMode('form');
    } catch (x) { setErr(x.response?.data?.detail || x.message); } finally { setBusy(false); }
  };
  const cancelled = inv.status === 'CANCELLED';
  const open = async (m, e) => {
    e.stopPropagation(); setErr(''); setMode(m);
    setF({ freight_cost: inv.additional_costs || '0', notes: inv.notes || '', supplier_id: inv.supplier || '', reason: '', manager_password: '' });
    if (m === 'edit') { try { const r = await axiosClient.get('/suppliers/?page_size=500'); setSups(listOf(r.data)); } catch (x) { setSups([]); } }
    if (m === 'view') {
      setDet(null);
      try {
        const [r, lots] = await Promise.all([axiosClient.get(`/purchases/${inv.id}/`), axiosClient.get('/raw-lots/?page_size=1000').catch(() => ({ data: [] }))]);
        const byLine = {}; listOf(lots.data).forEach((l) => { if (String(l.purchase_invoice) === String(inv.id)) byLine[String(l.purchase_line_item)] = l.status; });
        setDet({ ...r.data, byLine });
      } catch (x) { setErr(x.response?.data?.detail || x.message); }
    }
  };
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (mode === 'edit') await axiosClient.post(`/purchases/${inv.id}/edit/`, { freight_cost: f.freight_cost, notes: f.notes, supplier_id: f.supplier_id || null, manager_password: f.manager_password });
      else await axiosClient.post(`/purchases/${inv.id}/cancel/`, { reason: f.reason, manager_password: f.manager_password });
      setMode(null); if (onDone) onDone();
    } catch (x) { setErr(x.response?.data?.detail || x.message); } finally { setBusy(false); }
  };
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full';
  const what = (l) => {
    if (l.purchase_kind === 'BALE') return l.item_name || '—';
    if (l.purchase_kind === 'STOCK') return l.stock_type === 'ONE_BRAND' ? `وان براند: ${l.brand || ''}` : `ميكس${(l.brands || []).length ? `: ${l.brands.join('، ')}` : ' (براندات مش معروفة)'}`;
    if (l.purchase_kind === 'DIRECT') return [l.direct_category, l.brand || ((l.brands || []).length ? `ميكس: ${l.brands.join('، ')}` : '')].filter(Boolean).join(' - ');
    return l.description || '—';
  };
  const items = det ? (det.items || det.line_items || det.lines || []) : [];
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <span className="flex flex-wrap gap-1 mt-1">
        <button type="button" onClick={(e) => open('view', e)} className="h-7 px-2 rounded-md border border-slate-300 bg-white text-[11px] font-bold cursor-pointer">👁️ تفاصيل</button>
        {!cancelled && <button type="button" onClick={askEdit} className="h-7 px-2 rounded-md border border-slate-300 bg-white text-[11px] font-bold cursor-pointer">✏️ تعديل</button>}
        {!cancelled && <button type="button" onClick={(e) => open('cancel', e)} className="h-7 px-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold cursor-pointer">✖ إلغاء</button>}
        {cancelled && <span className="text-[11px] font-bold text-rose-700 self-center">ملغية</span>}
      </span>
      {mode === 'pw' && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50 text-start font-sans" dir="rtl">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="text-base font-black">🔒 تعديل فاتورة {inv.invoice_number}</div>
            <div className="text-[11px] text-slate-500">التعديل محتاج باسورد المدير. وينفع بس لو ولا بالة من الفاتورة بدأت تتفرز.</div>
            <input autoFocus type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pw) openEditForm(); }} placeholder="باسورد المدير" className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full text-center" />
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode(null)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">رجوع</button>
              <button type="button" disabled={busy || !pw} onClick={openEditForm} className="flex-1 h-11 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white text-sm font-bold cursor-pointer">افتح الفاتورة</button>
            </div>
          </div>
        </div>
      )}
      {mode === 'form' && editData && <PurchaseInvoiceForm suppliers={editData.sups} warehouses={editData.whs} editInvoice={editData.inv} managerPassword={pw} onClose={() => setMode(null)} onSaved={() => { setMode(null); if (onDone) onDone(); }} />}
      {mode === 'view' && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50 text-start font-sans" dir="rtl">
          <div className="bg-white rounded-2xl max-w-6xl w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between"><div className="text-lg font-black">تفاصيل فاتورة الشراء {inv.invoice_number}</div><button type="button" onClick={() => setMode(null)} className="h-9 px-4 rounded-lg border border-slate-300 font-bold cursor-pointer">قفل</button></div>
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            {!det && !err && <div className="text-sm text-slate-500">...</div>}
            {det && (<>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">التاريخ</div><div className="font-bold">{det.invoice_date}</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">المورد</div><div className="font-bold">{det.supplier_name || '—'}</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">المخزن</div><div className="font-bold">{det.warehouse_name || '—'}</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">الحالة</div><div className={`font-bold ${det.status === 'CANCELLED' ? 'text-rose-700' : ''}`}>{STATUS[det.status] || det.status}</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">البضاعة</div><div className="font-bold">{money(det.subtotal)}</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">النقل</div><div className="font-bold">{money(det.additional_costs)}</div></div>
                <div className="bg-emerald-50 rounded-lg p-2"><div className="text-slate-500">الإجمالي</div><div className="font-black text-emerald-800">{money(det.total_cost)} ج.م</div></div>
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-500">ملاحظات</div><div className="font-bold">{det.notes || '—'}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">#</th><th className="p-2 text-start">السطر</th><th className="p-2 text-start">النوع</th><th className="p-2 text-start">حريمي/رجالي</th><th className="p-2 text-start">الموسم</th><th className="p-2 text-start">الدرجة</th><th className="p-2 text-start">الصنف / البراند / التصنيف</th><th className="p-2 text-start">الطن</th><th className="p-2 text-center">بالات</th><th className="p-2 text-center">الوزن</th><th className="p-2 text-center">سعر الكيلو</th><th className="p-2 text-center">الإجمالي</th><th className="p-2 text-center">الفرز</th></tr></thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-slate-400">مفيش سطور</td></tr>}
                    {items.map((l, i) => { const st = LOT[det.byLine[String(l.id)]] || ['—', 'bg-slate-100 text-slate-600']; return (
                      <tr key={l.id || i} className="border-b border-slate-100">
                        <td className="p-2">{i + 1}</td><td className="p-2 font-bold">{l.description}</td><td className="p-2">{KIND[l.purchase_kind] || '—'}</td><td className="p-2">{l.segment || '—'}</td><td className="p-2">{l.season || '—'}</td><td className="p-2">{l.grade || '—'}</td>
                        <td className="p-2">{what(l)}</td><td className="p-2">{l.ton_type === 'ASSORTED' ? <span className="text-violet-700 font-bold">تشكيل {String(l.ton_group || '').slice(-4)}</span> : l.ton_type === 'NORMAL' ? 'عادي' : '—'}</td>
                        <td className="p-2 text-center">{l.purchase_kind === 'BALE' ? l.quantity_pieces : '—'}</td><td className="p-2 text-center">{Number(l.weight_kg)}</td><td className="p-2 text-center">{money(l.unit_cost)}</td><td className="p-2 text-center font-bold">{money(l.total_cost)}</td>
                        <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st[1]}`}>{st[0]}</span></td>
                      </tr>); })}
                  </tbody>
                </table>
              </div>
            </>)}
          </div>
        </div>
      )}
      {(mode === 'edit' || mode === 'cancel') && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50 text-start font-sans" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="text-base font-black">{mode === 'edit' ? 'تعديل فاتورة' : 'إلغاء فاتورة'} {inv.invoice_number}</div>
            <div className="text-[11px] text-slate-500">ينفع بس لو ولا بالة من الفاتورة بدأت تتفرز. ومحتاج باسورد المدير.</div>
            {mode === 'edit' ? (<>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">مصاريف النقل (ج.م)<input type="number" min="0" value={f.freight_cost} onChange={(e) => setF({ ...f, freight_cost: e.target.value })} className={input} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">المورد<select value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })} className={input}>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">ملاحظات<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={input} /></label>
            </>) : (
              <label className="text-xs font-bold text-slate-600 space-y-1 block">سبب الإلغاء *<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={input} /></label>
            )}
            <input type="password" autoComplete="new-password" value={f.manager_password} onChange={(e) => setF({ ...f, manager_password: e.target.value })} placeholder="باسورد المدير" className={input + ' text-center'} />
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode(null)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">رجوع</button>
              <button type="button" disabled={busy || !f.manager_password || (mode === 'cancel' && !f.reason.trim())} onClick={submit} className={`flex-1 h-11 rounded-xl text-white text-sm font-bold cursor-pointer disabled:bg-slate-400 ${mode === 'edit' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{mode === 'edit' ? 'حفظ التعديل' : 'تأكيد الإلغاء'}</button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
