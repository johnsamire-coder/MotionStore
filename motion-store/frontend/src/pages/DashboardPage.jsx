// HOME_V2
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { ShoppingCart, Clock, RotateCcw, PauseCircle, Package, Layers, Truck, Wallet, AlertTriangle, Megaphone, Target, Tag, TrendingUp, Pencil, X } from 'lucide-react';

const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const hm = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ROLE = { ADMIN: 'مدير النظام', MANAGER: 'مدير', CASHIER: 'كاشير', WAREHOUSE_KEEPER: 'أمين مخزن', ACCOUNTANT: 'محاسب', SORTER: 'فرّاز' };
const Card = ({ icon: I, color, label, value, sub, onClick }) => (
  <button type="button" onClick={onClick} className={`text-start bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ${onClick ? 'hover:border-emerald-400 hover:shadow-md cursor-pointer' : 'cursor-default'} transition`}>
    <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}><I size={18} /></span></div>
    <div className="text-2xl font-black text-slate-900 mt-2">{value}</div>{sub ? <div className="text-[11px] text-slate-500 mt-1">{sub}</div> : null}
  </button>
);
const Box = ({ title, icon: I, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
    <div className="text-sm font-black text-slate-800 flex items-center gap-2">{I ? <I size={16} className="text-emerald-600" /> : null}{title}</div>
    {children}
  </div>
);
const Bars = ({ rows, k = 'k', v = 'v' }) => {
  const m = Math.max(1, ...rows.map((r) => num(r[v])));
  return <div className="space-y-1.5">{rows.map((r) => <div key={r[k]} className="text-xs"><div className="flex justify-between"><span>{r[k]}</span><b>{money(r[v])}</b></div><div className="h-2 bg-slate-100 rounded-full"><div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.max(2, num(r[v]) / m * 100)}%` }} /></div></div>)}</div>;
};

export default function DashboardPage() {
  const { isRTL } = useLanguage();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ daily_target: '', announcement: '' });
  const [err, setErr] = useState('');
  const load = async () => { try { const r = await axiosClient.get('/home/'); setD(r.data); } catch (e) { setErr(e.response?.data?.detail || e.message); } };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const save = async () => { try { await axiosClient.post('/home/settings/', form); setEdit(false); load(); } catch (e) { setErr(e.response?.data?.detail || e.message); } };
  if (!d) return <div className="p-10 text-center text-slate-500">{err || '...'}</div>;
  const greet = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const c = d.cashier; const mg = d.manager;
  const tSales = c ? c.shop_sales : d.today_sales;
  const pct = d.daily_target > 0 ? Math.min(100, Math.round(tSales / d.daily_target * 100)) : 0;
  const maxS = mg ? Math.max(1, ...mg.series.map((x) => x.v)) : 1;
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="rounded-3xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 55%, #0f766e 100%)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl md:text-3xl font-black">{greet} يا {d.user.name} 👋</div>
            <div className="text-emerald-100 text-sm mt-1">{d.company} · {ROLE[d.user.role] || d.user.role} · {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          {d.can_edit && <button type="button" onClick={() => { setForm({ daily_target: d.daily_target || '', announcement: d.announcement || '' }); setEdit(true); }} className="h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold flex items-center gap-2 cursor-pointer"><Pencil size={15} /> التارجت والرسالة</button>}
        </div>
        {d.daily_target > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-sm font-bold"><span className="flex items-center gap-2"><Target size={16} /> تارجت النهاردة {c ? '(المحل)' : ''}</span><span>{money(tSales)} / {money(d.daily_target)} ج.م</span></div>
            <div className="h-3 bg-white/20 rounded-full mt-2"><div className="h-3 rounded-full bg-amber-300" style={{ width: `${Math.max(3, pct)}%` }} /></div>
            <div className="text-xs mt-1 text-emerald-100">{pct >= 100 ? 'عدّينا التارجت 🎉🔥' : `وصلنا ${pct}% من التارجت ${pct >= 70 ? '🔥' : '💪'}`}</div>
          </div>
        )}
      </div>
      {d.announcement && <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex gap-3 items-start"><Megaphone className="text-amber-600 shrink-0" size={22} /><div><div className="text-xs font-black text-amber-800">رسالة من الإدارة</div><div className="text-sm font-bold text-amber-900 mt-1 whitespace-pre-wrap">{d.announcement}</div></div></div>}
      {c && (
        <>
          {num(c.custody) > 0 && <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3 text-sm font-bold text-rose-800 flex items-center gap-2"><AlertTriangle size={18} /> عليك عهدة (عجز) لسه ماتسددتش: {money(c.custody)} ج.م</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card icon={Clock} color={c.shift ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} label="ورديتي" value={c.shift ? 'مفتوحة' : 'مقفولة'} sub={c.shift ? `${c.shift.terminal} · من ${hm(c.shift.since)}` : 'دوس هنا تفتح وردية'} onClick={() => nav(c.shift ? '/pos' : '/shifts')} />
            <Card icon={ShoppingCart} color="bg-blue-100 text-blue-700" label="فواتيري النهاردة" value={c.my_count} sub={`${money(c.my_total)} ج.م`} />
            <Card icon={TrendingUp} color="bg-violet-100 text-violet-700" label="متوسط فاتورتي" value={money(c.my_count ? c.my_total / c.my_count : 0)} sub="ج.م" />
            <Card icon={RotateCcw} color="bg-amber-100 text-amber-700" label="مرتجعاتي النهاردة" value={money(c.my_returns)} sub="ج.م" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ l: 'بيع جديد', i: ShoppingCart, to: '/pos', cl: 'bg-emerald-600' }, { l: 'مرتجع', i: RotateCcw, to: '/returns', cl: 'bg-rose-600' }, { l: 'المعلقة والمؤجلة', i: PauseCircle, to: '/pos', cl: 'bg-amber-600' }, { l: 'الوردية', i: Clock, to: '/shifts', cl: 'bg-slate-800' }].map((b) => (
              <button key={b.l} type="button" onClick={() => nav(b.to)} className={`${b.cl} text-white rounded-2xl h-20 flex flex-col items-center justify-center gap-1 font-black text-sm shadow-sm hover:opacity-90 cursor-pointer`}><b.i size={22} />{b.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Box title="طرق الدفع النهاردة" icon={Wallet}>{c.by_method.length ? <Bars rows={c.by_method} /> : <div className="text-xs text-slate-400">لسه مفيش بيع</div>}</Box>
            <Box title="أمانات ميعادها جه" icon={AlertTriangle}>{c.deferred.length === 0 ? <div className="text-xs text-slate-400">مفيش ✅</div> : c.deferred.map((x) => <div key={x.no} className={`text-xs rounded-lg p-2 ${x.late ? 'bg-rose-50 text-rose-800' : 'bg-slate-50'}`}><b>{x.cust}</b> · <span className="font-mono">{x.phone}</span><div>{x.no} · {money(x.total)} ج.م {x.late ? '· متأخرة ⚠️' : '· النهاردة'}</div></div>)}</Box>
            <Box title="عروض النهاردة" icon={Tag}>{c.offers.length === 0 ? <div className="text-xs text-slate-400">مفيش عروض شغالة</div> : <div className="flex flex-wrap gap-2">{c.offers.map((o) => <span key={o.name} className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 text-xs font-bold">{o.name}{o.auto ? ' (تلقائي)' : ''}</span>)}</div>}</Box>
          </div>
          <Box title="آخر فواتيري" icon={ShoppingCart}>{c.last.length === 0 ? <div className="text-xs text-slate-400">لسه مفيش</div> : c.last.map((x) => <div key={x.no} className="flex justify-between text-xs border-b border-slate-100 py-1"><span className="font-mono">{x.no}</span><span>{hm(x.at)}</span><b>{money(x.total)} ج.م</b></div>)}</Box>
        </>
      )}
      {d.stock && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card icon={Layers} color="bg-violet-100 text-violet-700" label="بالات مستنية فرز" value={d.stock.pending_count} onClick={() => nav('/sorting')} />
          <Card icon={Truck} color="bg-blue-100 text-blue-700" label="أذون نقل النهاردة" value={d.stock.transfers_today} onClick={() => nav('/inventory')} />
          <Card icon={Package} color="bg-amber-100 text-amber-700" label="أصناف قربت تخلص" value={d.stock.low.length} onClick={() => nav('/inventory')} />
          <Box title="بالات مستنية فرز" icon={Layers}>{d.stock.pending.length ? d.stock.pending.map((x, i) => <div key={i} className="text-xs flex justify-between border-b border-slate-100 py-1"><span>{x.lot}</span><b>{x.kg} كجم</b></div>) : <div className="text-xs text-slate-400">مفيش ✅</div>}</Box>
          <Box title="قربت تخلص" icon={Package}>{d.stock.low.length ? d.stock.low.map((x, i) => <div key={i} className="text-xs flex justify-between border-b border-slate-100 py-1"><span>{x.item} · {x.loc}</span><b className="text-rose-700">{x.kg} كجم</b></div>) : <div className="text-xs text-slate-400">كله تمام ✅</div>}</Box>
          {d.sorting && <Box title="آخر نتايج فرز" icon={Layers}>{d.sorting.recent.length ? d.sorting.recent.map((x, i) => <div key={i} className="text-xs border-b border-slate-100 py-1"><div className="font-bold">{x.lot}</div><div>عالي {x.h}% · وسط {x.m}% · تصفيات {x.l}% · هالك {x.w}%</div></div>) : <div className="text-xs text-slate-400">لسه مفيش</div>}</Box>}
        </div>
      )}
      {d.finance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={Wallet} color="bg-rose-100 text-rose-700" label="مصروفات النهاردة" value={money(d.finance.expenses_today)} sub="ج.م" onClick={() => nav('/expenses')} />
          <Card icon={Truck} color="bg-amber-100 text-amber-700" label="علينا للموردين" value={money(d.finance.supplier_dues)} sub="ج.م" onClick={() => nav('/suppliers')} />
          <Card icon={ShoppingCart} color="bg-blue-100 text-blue-700" label="ديون العملاء" value={money(d.finance.customer_debts)} sub="ج.م" onClick={() => nav('/customers')} />
          <Card icon={AlertTriangle} color="bg-violet-100 text-violet-700" label="ورديات فيها عجز (7 أيام)" value={d.finance.short_shifts} onClick={() => nav('/shifts')} />
        </div>
      )}
      {mg && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{mg.cards.map((x) => <Card key={x.label} icon={TrendingUp} color="bg-emerald-100 text-emerald-700" label={x.label} value={money(x.value)} sub={x.type === 'money' ? 'ج.م' : ''} />)}</div>
          <Box title="المبيعات آخر 30 يوم" icon={TrendingUp}>
            <div className="flex items-end gap-1 h-40" dir="ltr">{mg.series.map((x) => <div key={x.d} className="flex-1 flex flex-col justify-end h-full"><div className="w-full bg-emerald-500 rounded-t hover:bg-emerald-700" style={{ height: `${Math.max(1, x.v / maxS * 100)}%` }} title={`${x.d}: ${money(x.v)}`} /></div>)}</div>
            <div className="flex justify-between text-[10px] text-slate-400" dir="ltr"><span>{mg.series[0].d}</span><span>{mg.series[mg.series.length - 1].d}</span></div>
          </Box>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Box title="طرق الدفع النهاردة" icon={Wallet}>{mg.methods.length ? <Bars rows={mg.methods} v="total" /> : <div className="text-xs text-slate-400">لسه مفيش بيع</div>}</Box>
            <Box title="الأكثر مبيعاً النهاردة" icon={Tag}>{mg.top.length ? <Bars rows={mg.top} v="sales" /> : <div className="text-xs text-slate-400">لسه مفيش بيع</div>}</Box>
            <Box title="محتاج انتباهك" icon={AlertTriangle}>{mg.attention.map((x) => <button key={x.k} type="button" onClick={() => nav(x.to)} className={`w-full flex justify-between text-xs rounded-lg p-2 mb-1 cursor-pointer ${x.v ? 'bg-rose-50 text-rose-800 font-bold' : 'bg-slate-50 text-slate-500'}`}><span>{x.k}</span><b>{x.v}</b></button>)}</Box>
          </div>
        </>
      )}
      {edit && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between"><div className="text-base font-bold">التارجت ورسالة الإدارة</div><button type="button" onClick={() => setEdit(false)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">تارجت المبيعات اليومي (ج.م) - 0 يعني مفيش تارجت<input type="number" min="0" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: e.target.value })} className="h-10 px-3 border border-slate-300 rounded-lg w-full" /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">رسالة لكل الموظفين (سيبها فاضية لو مفيش)<textarea rows={3} value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} className="p-3 border border-slate-300 rounded-lg w-full" /></label>
            {err && <div className="text-xs font-bold text-rose-700">{err}</div>}
            <button type="button" onClick={save} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer">حفظ</button>
          </div>
        </div>
      )}
    </div>
  );
}