// PERMISSIONS_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, RotateCcw } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const ROLES = [{ id: 'CASHIER', n: 'كاشير' }, { id: 'MANAGER', n: 'مدير' }, { id: 'WAREHOUSE_KEEPER', n: 'أمين مخزن' }, { id: 'ACCOUNTANT', n: 'محاسب' }, { id: 'SORTER', n: 'فرّاز' }];
const SCREENS = [['/pos', 'شاشة المبيعات'], ['/invoices', 'فواتير المبيعات'], ['/returns', 'المرتجعات'], ['/customers', 'العملاء'], ['/shifts', 'الورديات'], ['/treasury', 'الخزينة'],
  ['/expenses', 'المصروفات'], ['/suppliers', 'الموردين'], ['/purchasing', 'المشتريات'], ['/sorting', 'الفرز'], ['/inventory', 'المخزون'], ['/coding', 'التسعير والعروض'],
  ['/reports', 'التقارير'], ['/users', 'الموظفين'], ['/settings', 'الإعدادات']];
const ACTIONS = {
  view_cost_profit: ['يشوف التكلفة والربح', 'تقارير الأرباح، وعمود التكلفة والربح، وقيمة المخزون بالتكلفة'],
  view_others_invoices: ['يشوف فواتير الكاشيرية التانيين', 'مش فواتيره هو بس'],
  sell_credit: ['يبيع آجل (على الحساب)', 'لو مش متعلّم، البيع الآجل يترفض'],
  make_returns: ['يعمل مرتجع', 'يرجّع بضاعة ويرد فلوس'],
  cancel_deferred: ['يلغي فاتورة مؤجلة (أمانة)', 'ويرجّع البضاعة للمحل'],
  approve: ['باسورده ينفع للموافقات', 'الخصم، وتعديل السعر، والمصروف، وفرق الوردية، والترقيم'],
  cancel_expense: ['يلغي مصروف', 'والفلوس ترجع للخزنة'],
  edit_prices: ['يعدّل الأسعار والعروض', 'التسعير، والقطع، والعروض، والكوبونات'],
  treasury_moves: ['يحوّل بين الخزن ويودع ويسحب', 'حركات الخزينة اليدوية'],
  settle_custody: ['يسدّد عهدة كاشير', 'العجز اللي على الكاشيرية'],
  export: ['يطبع ويصدّر (PDF وExcel)', 'زرار الطباعة والتصدير في كل الشاشات'],
  view_stock_prices: ['يشوف أسعار البيع', 'في المخزون والكاشير (الكاشير لازم ياخدها عشان يبيع)'],
};

export default function PermissionsPage() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [role, setRole] = useState('CASHIER');
  const [defs, setDefs] = useState(null);
  const [row, setRow] = useState(null);
  const [scr, setScr] = useState([]);
  const [act, setAct] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async (r = role, d = defs) => {
    setErr(''); setMsg('');
    try {
      const dd = d || (await axiosClient.get('/role-permissions/defaults/')).data; if (!d) setDefs(dd);
      const res = await axiosClient.get(`/role-permissions/?role=${r}`);
      const found = listOf(res.data).find((x) => x.role === r) || null;
      setRow(found);
      setScr(found ? (found.allowed_screens || []) : (dd.screens[r] || []));
      setAct(found && found.allowed_actions != null ? found.allowed_actions : (dd.actions[r] || []));
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
  };
  useEffect(() => { load(role); }, [role]);
  const flip = (list, set, k) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const toDefault = () => { if (!defs) return; setScr(defs.screens[role] || []); setAct(defs.actions[role] || []); setMsg('اترجع للافتراضي - دوس حفظ عشان يتطبق'); };
  const save = async () => {
    setBusy(true); setErr('');
    const body = { allowed_screens: ['/', ...scr.filter((x) => x !== '/')], allowed_actions: act };
    try {
      if (row) await axiosClient.patch(`/role-permissions/${row.id}/`, body); else await axiosClient.post('/role-permissions/', { role, ...body });
      if (user?.role === role) { try { localStorage.setItem('user_allowed_screens', JSON.stringify(body.allowed_screens)); } catch (e) { /* ignore */ } }
      setMsg(`اتحفظت صلاحيات ${ROLES.find((r) => r.id === role).n} ✅`); await load(role);
    } catch (e) { setErr(e.response?.data?.detail || e.message); } finally { setBusy(false); }
  };
  const Box = ({ on, onClick, title, sub }) => (
    <button type="button" onClick={onClick} className={`text-start rounded-xl border p-3 cursor-pointer transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className="flex items-center gap-2 text-sm font-bold"><span className={`h-5 w-5 rounded-md border flex items-center justify-center text-xs ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>{on ? '✓' : ''}</span>{title}</div>
      {sub ? <div className="text-[11px] text-slate-500 mt-1">{sub}</div> : null}
    </button>
  );
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200"><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-600" /> صلاحيات الأدوار</h1><p className="text-xs text-slate-500 mt-1">اختار لكل دور: يفتح أنهي شاشات، ومسموحله يعمل إيه. مدير النظام مسموحله كل حاجة دايماً.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 h-fit">
          {ROLES.map((r) => <button key={r.id} type="button" onClick={() => setRole(r.id)} className={`w-full text-start h-11 px-3 rounded-lg text-sm font-bold cursor-pointer ${role === r.id ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100'}`}>{r.n}</button>)}
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">مدير النظام: كل حاجة ✅</div>
        </div>
        <div className="lg:col-span-3 space-y-4">
          {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
          {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between"><div className="text-sm font-black">الشاشات اللي يفتحها ({ROLES.find((r) => r.id === role).n})</div><div className="text-[11px] text-slate-500">{row ? 'متعدّلة من الأدمن' : 'الافتراضي'}</div></div>
            <div className="text-[11px] text-slate-500">الصفحة الرئيسية مفتوحة للكل دايماً (كل واحد بيشوف اللي يخصه بس).</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{SCREENS.map(([k, n]) => <Box key={k} on={scr.includes(k) || scr.includes('*')} onClick={() => flip(scr, setScr, k)} title={n} />)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-sm font-black">مسموحله يعمل إيه</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(ACTIONS).map(([k, [t, s]]) => <Box key={k} on={act.includes(k) || act.includes('*')} onClick={() => flip(act, setAct, k)} title={t} sub={s} />)}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={toDefault} className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold flex items-center gap-2 cursor-pointer"><RotateCcw size={15} /> رجوع للافتراضي</button>
            <button type="button" disabled={busy} onClick={save} className="flex-1 h-11 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white text-sm font-black cursor-pointer">حفظ صلاحيات {ROLES.find((r) => r.id === role).n}</button>
          </div>
        </div>
      </div>
    </div>
  );
}