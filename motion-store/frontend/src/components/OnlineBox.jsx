import React from 'react';

export default function OnlineBox({ online, setOnline, onl, setOnl }) {
  const f = (k) => (e) => setOnl({ ...onl, [k]: e.target.value });
  const box = 'h-8 px-2 border border-slate-300 rounded-lg bg-white';
  return (
    <div className={'mb-2 p-2 rounded-xl border ' + (online ? 'border-sky-400 bg-sky-50' : 'border-slate-200')} dir="rtl">
      <label className="flex items-center gap-2 font-bold text-sm cursor-pointer">
        <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> 🛒 أوردر أونلاين (فلوسه مش في الدرج)
      </label>
      {online && (
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <input value={onl.name} onChange={f('name')} placeholder="اسم العميل (اختياري)" className={box} />
          <input value={onl.phone} onChange={f('phone')} placeholder="التليفون (اختياري)" className={box} />
          <input value={onl.address} onChange={f('address')} placeholder="العنوان (اختياري)" className={box + ' col-span-2'} />
          <input value={onl.courier} onChange={f('courier')} placeholder="المندوب أو شركة الشحن (اختياري)" className={box + ' col-span-2'} />
          <div className="col-span-2 text-sky-800">الدفع: إنستاباي / محفظة / فيزا لو حوّل قبل الشحن، أو «عند الاستلام - مندوب» / «عند الاستلام - شركة شحن». النقدي مش مسموح.</div>
        </div>
      )}
    </div>
  );
}
