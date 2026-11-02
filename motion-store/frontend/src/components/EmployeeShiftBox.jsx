import React from 'react';

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// EMPLOYEE_GOODS: goods taken on employees' accounts: no money in the drawer, taken back by payroll
export default function EmployeeShiftBox({ sum }) {
  if (!sum || !Number(sum.employee_count)) return null;
  return (
    <div className="bg-white p-4 rounded-xl border-2 border-violet-300 space-y-2 text-xs" dir="rtl">
      <div className="text-sm font-black text-violet-800">🧑‍💼 بضاعة على حساب الموظفين (مش فلوس - بتتخصم من المرتب)</div>
      <div className="flex justify-between"><span>عدد الفواتير</span><b>{sum.employee_count}</b></div>
      <div className="flex justify-between"><span>الإجمالي</span><b>{money(sum.employee_total)}</b></div>
      {Number(sum.employee_returns_total) > 0 && <div className="flex justify-between"><span>مرتجعات</span><b className="text-rose-700">{money(sum.employee_returns_total)}</b></div>}
      {(sum.employee_orders || []).map((o) => <div key={o.number} className="flex justify-between text-slate-600"><span className="font-mono">{o.number} - {o.name}</span><span>{money(o.total)}</span></div>)}
    </div>
  );
}
