import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { clearCompanyCache, buildReceiptParts } from '../utils/reportExport';

export default function ReceiptSettings() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { axiosClient.get('/company-info/').then((r) => setF(r.data)).catch((e) => setErr(e.message)); }, []);
  if (!f) return <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-500">{err || '...'}</div>;
  const save = async () => { setErr(''); try { const r = await axiosClient.post('/company-info/save/', f); setF(r.data); clearCompanyCache(); setMsg('اتحفظ ✅ - الإيصالات الجديدة هتطلع بالشكل ده'); setTimeout(() => setMsg(''), 4000); } catch (e) { setErr(e.response?.data?.detail || e.message); } };
  const p = buildReceiptParts(f);
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full';
  const Tog = ({ k, label }) => <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}</label>;
  return (
    <div className="bg-white p-4 rounded-xl border border-emerald-300 space-y-3 mb-4">
      <div className="text-sm font-black text-slate-800">🧾 بيانات الشركة والإيصال</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="font-bold text-slate-600 space-y-1 block">التليفون<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <label className="font-bold text-slate-600 space-y-1 block">العنوان<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={input} /></label>
          <label className="font-bold text-slate-600 space-y-1 block">الرقم الضريبي<input value={f.tax_number} onChange={(e) => setF({ ...f, tax_number: e.target.value })} className={input} /></label>
          <label className="font-bold text-slate-600 space-y-1 block">السجل التجاري<input value={f.registration_number} onChange={(e) => setF({ ...f, registration_number: e.target.value })} className={input} /></label>
          <label className="font-bold text-slate-600 space-y-1 block md:col-span-2">كلام أول الإيصال (تحت الاسم)<input value={f.header_text} onChange={(e) => setF({ ...f, header_text: e.target.value })} placeholder="مثلاً: أحسن بالة في إسكندرية" className={input} /></label>
          <label className="font-bold text-slate-600 space-y-1 block md:col-span-2">كلام آخر الإيصال<textarea rows={2} value={f.footer_text} onChange={(e) => setF({ ...f, footer_text: e.target.value })} placeholder="مثلاً: الاستبدال خلال 14 يوم بالإيصال - شكراً لزيارتكم" className="p-3 border border-slate-300 rounded-lg w-full" /></label>
          <div className="md:col-span-2 flex flex-wrap gap-4"><Tog k="show_logo" label="اللوجو" /><Tog k="show_address" label="العنوان" /><Tog k="show_phone" label="التليفون" /><Tog k="show_tax" label="الرقم الضريبي" /></div>
          <div className="md:col-span-2 flex items-center gap-2"><span className="font-bold text-slate-600">عرض الورق:</span>{['80', '58'].map((w) => <button key={w} type="button" onClick={() => setF({ ...f, width: w })} className={`h-8 px-3 rounded-lg border font-bold cursor-pointer ${f.width === w ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}>{w} مم</button>)}</div>
          {err && <div className="md:col-span-2 bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg font-bold">{err}</div>}
          {msg && <div className="md:col-span-2 bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg font-bold">{msg}</div>}
          <button type="button" onClick={save} className="md:col-span-2 h-11 rounded-xl bg-emerald-600 text-white text-sm font-black cursor-pointer">حفظ بيانات الشركة والإيصال</button>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">معاينة الإيصال</div>
          <div className="mx-auto bg-white border border-slate-300 shadow-sm p-3 text-black" style={{ width: f.width === '58' ? 200 : 270, fontFamily: 'Tahoma, Arial' }} dir="rtl">
            {f.show_logo && f.logo_raw ? <img src={f.logo_raw} alt="" style={{ width: 44, height: 44, objectFit: 'contain', margin: '0 auto', display: 'block' }} /> : null}
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{f.name}</div>
            <div dangerouslySetInnerHTML={{ __html: p.headerHtml }} />
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ fontSize: 11 }}>فاتورة INV-000123 · بلوزة × 2 ........ 160.00</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>الإجمالي: 160.00 ج.م</div>
            <div dangerouslySetInnerHTML={{ __html: p.footerHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}
