import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// SHIFT_CASH_IN: money that came into the drawer and is not a sale (owner, another treasury, anything else)
export default function ShiftCashIn({ shift, trs, sum, onDone }) {
  const [src, setSrc] = useState('OWNER');
  const [tr, setTr] = useState('');
  const [amt, setAmt] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  if (!shift) return null;
  const list = (sum && sum.cash_in) || [];
  const go = async () => {
    setMsg('');
    const a = parseFloat(String(amt).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || 0;
    if (a <= 0) { setMsg('اكتب المبلغ'); return; }
    if (src === 'TREASURY' && !tr) { setMsg('اختار الخزنة'); return; }
    if (src === 'OTHER' && !notes.trim()) { setMsg('اكتب الفلوس دي جاية منين'); return; }
    const pw = window.prompt(`دخول ${a} ج.م للدرج (مش بيع)\nاكتب باسورد المدير:`);
    if (!pw) return;
    try {
      await axiosClient.post(`/shifts/${shift.id}/cash_in/`, { source: src, treasury_id: tr || null, amount: a, notes, manager_password: pw });
      setAmt(''); setNotes(''); setMsg('✅ اتسجلت ودخلت الدرج');
      if (onDone) onDone();
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || e.message)); }
  };
  return (
    <div className="mb-3 p-3 rounded-xl border border-emerald-300 bg-emerald-50 space-y-2" dir="rtl">
      <div className="font-bold text-sm">💰 فلوس دخلت الدرج (مش بيع)</div>
      <div className="flex flex-wrap gap-2">
        <select value={src} onChange={(e) => setSrc(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="OWNER">من صاحب المحل</option>
          <option value="TREASURY">من خزنة تانية</option>
          <option value="OTHER">وارد تاني</option>
        </select>
        {src === 'TREASURY' && (
          <select value={tr} onChange={(e) => setTr(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">اختار الخزنة</option>
            {(trs || []).filter((x) => x.treasury_type !== 'POS_DRAWER').map((x) => <option key={x.id} value={x.id}>{x.name} ({money(x.current_balance)})</option>)}
          </select>
        )}
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="المبلغ" inputMode="decimal" className="h-9 w-28 px-2 border border-slate-300 rounded-lg text-sm" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={src === 'OTHER' ? 'جاية منين؟ (إجباري)' : 'السبب (مثلاً: علشان المرتبات)'} className="h-9 flex-1 min-w-[140px] px-2 border border-slate-300 rounded-lg text-sm" />
        <button type="button" onClick={go} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">إضافة للدرج</button>
      </div>
      {msg && <div className={`text-xs font-bold ${msg.startsWith('✅') ? 'text-emerald-700' : 'text-rose-700'}`}>{msg}</div>}
      {list.length > 0 && (
        <div className="text-xs space-y-1 border-t border-emerald-200 pt-2">
          {list.map((c, i) => <div key={i} className="flex justify-between gap-2"><span>{c.time} · {c.label}{c.notes ? <span className="text-slate-500"> — {c.notes}</span> : ''}</span><b>{money(c.amount)}</b></div>)}
          <div className="flex justify-between font-black border-t border-emerald-200 pt-1"><span>الإجمالي</span><span>{money(sum.cash_in_total)}</span></div>
        </div>
      )}
    </div>
  );
}
