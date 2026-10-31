import React from 'react';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ONLINE_SALES: online orders have their own closing, separate from the cash drawer
export default function OnlineShiftBox({ sum }) {
  if (!sum || (!Number(sum.online_count) && !(sum.online_returns_by_method || []).length)) return null;
  return (
    <div className="bg-white p-4 rounded-xl border-2 border-sky-300 space-y-2 text-xs" dir="rtl">
      <div className="text-sm font-black text-sky-800">🛒 تقفيل الأونلاين (منفصل - مش في الدرج)</div>
      <div className="flex justify-between"><span>عدد الأوردرات</span><b>{sum.online_count || 0}</b></div>
      <div className="flex justify-between"><span>إجمالي الأونلاين</span><b>{money(sum.online_total)}</b></div>
      {(sum.online_by_method || []).length > 0 && <div className="font-bold border-t border-sky-100 pt-2">حسب طريقة الدفع</div>}
      {(sum.online_by_method || []).map((m) => <div key={m.method} className="flex justify-between"><span>{m.method}</span><b>{money(m.amount)}</b></div>)}
      {(sum.online_returns_by_method || []).length > 0 && (<>
        <div className="font-bold border-t border-sky-100 pt-2">مرتجعات أونلاين</div>
        {sum.online_returns_by_method.map((m) => <div key={m.method} className="flex justify-between"><span>{m.method}</span><b className="text-rose-700">{money(m.amount)}</b></div>)}
      </>)}
      <div className="flex justify-between text-sm font-black bg-sky-50 rounded-lg p-2"><span>صافي الأونلاين</span><span>{money(sum.online_net_total ?? sum.online_total)} ج.م</span></div>
      {(sum.online_orders || []).length > 0 && (
        <table className="w-full mt-1">
          <thead><tr className="bg-sky-50 text-sky-900"><th className="p-1 text-start">الفاتورة</th><th className="p-1 text-start">العميل / المندوب</th><th className="p-1 text-start">الدفع</th><th className="p-1 text-end">المبلغ</th></tr></thead>
          <tbody>{sum.online_orders.map((o) => (
            <tr key={o.number} className="border-b border-slate-100"><td className="p-1 font-mono">{o.number}</td><td className="p-1">{[o.name, o.courier].filter(Boolean).join(' / ') || '—'}</td><td className="p-1">{o.methods}</td><td className="p-1 text-end font-bold">{money(o.total)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
