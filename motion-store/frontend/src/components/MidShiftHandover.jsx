import React, { useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function MidShiftHandover({ shift, trs }) {
  const [dest, setDest] = useState('OWNER');
  const [tr, setTr] = useState('');
  const [amt, setAmt] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  if (!shift) return null;
  const go = async () => {
    setMsg('');
    const a = parseFloat(String(amt).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || 0;
    if (a <= 0) { setMsg('اكتب المبلغ'); return; }
    if (dest === 'TREASURY' && !tr) { setMsg('اختار الخزنة'); return; }
    const pw = window.prompt('ترحيل ' + a + ' ج.م ' + (dest === 'OWNER' ? 'لصاحب المحل' : 'للخزنة') + ' من غير قفل الوردية\nاكتب باسورد المدير:');
    if (!pw) return;
    try {
      await axiosClient.post(`/shifts/${shift.id}/handover_now/`, { destination: dest, treasury_id: tr || null, amount: a, notes, manager_password: pw });
      alert('تم الترحيل، والوردية لسه مفتوحة'); window.location.reload();
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || e.message)); }
  };
  return (
    <div className="mb-3 p-3 rounded-xl border border-amber-300 bg-amber-50 space-y-2" dir="rtl">
      <div className="font-bold text-sm">💸 ترحيل دلوقتي (من غير قفل الوردية)</div>
      <div className="flex flex-wrap gap-2">
        <select value={dest} onChange={(e) => setDest(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="OWNER">لصاحب المحل</option>
          <option value="TREASURY">لخزنة</option>
        </select>
        {dest === 'TREASURY' && (
          <select value={tr} onChange={(e) => setTr(e.target.value)} className="h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">اختار الخزنة</option>
            {(trs || []).filter((x) => x.treasury_type !== 'POS_DRAWER').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="المبلغ" inputMode="decimal" className="h-9 w-28 px-2 border border-slate-300 rounded-lg text-sm" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" className="h-9 flex-1 min-w-[120px] px-2 border border-slate-300 rounded-lg text-sm" />
        <button type="button" onClick={go} className="h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-bold cursor-pointer">ترحيل</button>
      </div>
      {msg && <div className="text-xs font-bold text-rose-700">{msg}</div>}
    </div>
  );
}
