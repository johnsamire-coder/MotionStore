import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N = (v) => Number(v || 0);

// PERFUME_SALES: the perfume counter's own closing - its sales, returns and drawer, closed apart from the cashier
export default function PerfumeShiftBox({ shift, sum, trs, onPrint, onDone }) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState('');
  const [hand, setHand] = useState('');
  const [dest, setDest] = useState('TREASURY');
  const [tr, setTr] = useState('');
  const [who, setWho] = useState('');
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!sum || (!N(sum.perfume_count) && !(sum.perfume_returns_by_method || []).length && sum.perfume_drawer_balance === undefined)) return null;
  const expected = N(sum.perfume_drawer_balance);
  const diff = actual === '' ? 0 : Math.round((N(actual) - expected) * 100) / 100;
  const others = (trs || []).filter((x) => x.treasury_type !== 'POS_DRAWER');
  const close = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await axiosClient.post(`/shifts/${shift.id}/perfume_close/`, { actual_cash: actual, handover_amount: hand || '0', destination: dest, treasury_id: dest === 'TREASURY' ? tr : null, receiver: who, manager_password: pwd });
      setOpen(false); setActual(''); setHand(''); setPwd('');
      if (onPrint) onPrint(r.data);
      if (onDone) onDone();
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || e.message)); } finally { setBusy(false); }
  };
  const input = 'h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="bg-white p-4 rounded-xl border-2 border-pink-300 space-y-2 text-xs" dir="rtl">
      <div className="flex items-center justify-between"><div className="text-sm font-black text-pink-800">🌸 تقفيل البرفانات (درج لوحده)</div>
        <button type="button" onClick={() => setOpen(!open)} className="h-8 px-3 rounded-lg bg-pink-600 text-white font-bold cursor-pointer">{open ? 'رجوع' : 'تقفيل البرفانات'}</button></div>
      <div className="flex justify-between"><span>عدد الفواتير</span><b>{sum.perfume_count || 0}</b></div>
      <div className="flex justify-between"><span>إجمالي البرفانات</span><b>{money(sum.perfume_total)}</b></div>
      {(sum.perfume_by_method || []).map((m) => <div key={m.method} className="flex justify-between text-slate-600"><span>{m.method}</span><span>{money(m.amount)}</span></div>)}
      {(sum.perfume_returns_by_method || []).length > 0 && <div className="flex justify-between"><span>مرتجعات</span><b className="text-rose-700">{money(sum.perfume_returns_total)}</b></div>}
      <div className="flex justify-between font-bold"><span>صافي البرفانات</span><span>{money(sum.perfume_net_total)}</span></div>
      {(sum.perfume_moves || []).length > 0 && <div className="border-t border-pink-100 pt-1">{sum.perfume_moves.map((m) => <div key={m.label} className="flex justify-between text-slate-600"><span>{m.label}</span><span>{money(m.amount)}</span></div>)}</div>}
      <div className="flex justify-between text-sm font-black bg-pink-50 rounded-lg p-2"><span>المتوقع في درج البرفانات</span><span>{money(expected)} ج.م</span></div>
      {open && (
        <div className="space-y-2 border-t border-pink-200 pt-2">
          <label className="font-bold block space-y-1">اللي اتعدّ في درج البرفانات<input type="number" min="0" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} className={input + ' w-full font-bold'} /></label>
          {actual !== '' && <div className={`font-black ${diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>الفرق: {money(diff)} {diff < 0 ? '(عجز)' : diff > 0 ? '(زيادة)' : '✅'}</div>}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-bold">ترحيل</span>
            <select value={dest} onChange={(e) => setDest(e.target.value)} className={input}><option value="TREASURY">لخزنة</option><option value="OWNER">لصاحب المحل</option><option value="PERSON">تسليم لشخص (مستلم)</option></select>
            {dest === 'PERSON' && <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="اسم اللي استلم" className={input + ' w-40'} />}
            {dest === 'TREASURY' && <select value={tr} onChange={(e) => setTr(e.target.value)} className={input}><option value="">اختار الخزنة</option>{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
            <input type="number" min="0" step="0.01" value={hand} onChange={(e) => setHand(e.target.value)} placeholder="المبلغ (فاضي = مفيش)" className={input + ' w-36'} />
            {actual !== '' && <button type="button" onClick={() => setHand(actual)} className="h-9 px-2 rounded-lg border border-pink-300 text-pink-800 font-bold cursor-pointer">رحّل الكل</button>}
          </div>
          {actual !== '' && <div className="font-bold">هيفضل في درج البرفانات: {money(N(actual) - N(hand))} ج.م</div>}
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="باسورد المدير" className={input + ' w-full'} />
          <button type="button" disabled={busy || actual === '' || !pwd || N(hand) > N(actual) || (N(hand) > 0 && dest === 'TREASURY' && !tr) || (N(hand) > 0 && dest === 'PERSON' && !who.trim())} onClick={close} className="w-full h-10 rounded-xl bg-pink-600 disabled:bg-slate-400 text-white font-black cursor-pointer">تأكيد تقفيل البرفانات وطباعة</button>
          {msg && <div className="font-bold text-rose-700">{msg}</div>}
        </div>
      )}
    </div>
  );
}
