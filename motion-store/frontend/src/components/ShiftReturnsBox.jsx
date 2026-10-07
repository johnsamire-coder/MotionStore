import React from 'react';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShiftReturnsBox({ sum }) {
  const rets = (sum && sum.returns_by_method) || [];
  if (!rets.length) return null;
  return (
    <div className="mb-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm space-y-2" dir="rtl">
      <div className="font-bold">↩️ مرتجعات حسب طريقة الرد</div>
      {rets.map((m) => <div key={m.method} className="flex justify-between"><span>{m.method}</span><span className="font-bold">{money(m.amount)}</span></div>)}
      <div className="font-bold pt-1 border-t border-rose-200">✅ الصافي حسب طريقة الدفع (المبيعات − المرتجعات)</div>
      {(sum.net_by_method || []).map((m) => <div key={m.method} className="flex justify-between"><span>{m.method}</span><span className="font-bold">{money(m.amount)}</span></div>)}
    </div>
  );
}
