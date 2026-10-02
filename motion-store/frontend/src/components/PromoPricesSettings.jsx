import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function PromoPricesSettings() {
  const [val, setVal] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { axiosClient.get('/promo-prices/').then((r) => setVal((r.data.prices || []).join(', '))).catch(() => {}); }, []);
  const save = async () => {
    setMsg('');
    try { const r = await axiosClient.post('/promo-prices/', { prices: val }); setVal((r.data.prices || []).join(', ')); setMsg('✅ اتحفظت'); }
    catch (e) { setMsg('❌ ' + (e.response?.data?.detail || e.message)); }
  };
  return (
    <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 space-y-3" dir="rtl">
      <div className="text-base font-black">🏷️ أسعار العروض الجاهزة</div>
      <div className="text-xs text-slate-500">الكاشير يقدر يختار السعر ده للقطعة من غير باسورد (وأي سعر تاني محتاج المدير). اكتب الأسعار وبينهم فاصلة، مثلاً: 100, 50</div>
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="100, 50" className="h-10 px-3 border border-slate-300 rounded-lg text-sm flex-1" />
        <button type="button" onClick={save} className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">حفظ</button>
      </div>
      {msg && <div className="text-xs font-bold">{msg}</div>}
    </div>
  );
}
