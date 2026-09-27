// USERS_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Users, Plus, Search, Pencil, X, KeyRound } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return 'لسه مادخلش'; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ROLES = [{ id: 'CASHIER', n: 'كاشير' }, { id: 'MANAGER', n: 'مدير' }, { id: 'WAREHOUSE_KEEPER', n: 'أمين مخزن' }, { id: 'ACCOUNTANT', n: 'محاسب' }, { id: 'SORTER', n: 'فرّاز' }, { id: 'ADMIN', n: 'مدير النظام' }];
const roleName = (r) => (ROLES.find((x) => x.id === r) || {}).n || r;
const empty = { username: '', first_name: '', last_name: '', phone: '', email: '', role: 'CASHIER', assigned_branches: [], pos_terminal: '', password: '', pin: '' };
const errText = (e) => { const d = e.response?.data; if (!d) return e.message; if (typeof d === 'string') return d; if (d.detail) return d.detail; return Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | '); };

export default function UsersPage() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const isAdmin = user?.role === 'ADMIN' || user?.is_superuser;
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [terms, setTerms] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editHasPin, setEditHasPin] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [u, b, t] = await Promise.all([axiosClient.get('/users/?page_size=500'), axiosClient.get('/branches/'), axiosClient.get('/pos-terminals/')]);
      setRows(listOf(u.data)); setBranches(listOf(b.data)); setTerms(listOf(t.data));
    } catch (e) { setErr(errText(e)); }
  };
  useEffect(() => { load(); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const openNew = () => { setErr(''); setEditId(null); setEditHasPin(false); setForm({ ...empty, assigned_branches: branches[0] ? [branches[0].id] : [] }); };
  const openEdit = (u) => { setErr(''); setEditId(u.id); setEditHasPin(!!u.has_pin); setForm({ username: u.username, first_name: u.first_name || '', last_name: u.last_name || '', phone: u.phone || '', email: u.email || '', role: u.role, assigned_branches: u.assigned_branches || [], pos_terminal: u.pos_terminal || '', password: '', pin: '' }); };
  const save = async () => {
    setBusy(true); setErr('');
    const body = { ...form, pos_terminal: form.pos_terminal || null };
    if (!body.password) delete body.password;
    if (!body.pin) delete body.pin;
    try {
      if (editId) await axiosClient.patch(`/users/${editId}/`, body); else await axiosClient.post('/users/', body);
      setForm(null); flash('اتحفظ ✅'); load();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const clearPin = async () => { try { await axiosClient.patch(`/users/${editId}/`, { pin: 'CLEAR' }); setEditHasPin(false); flash('الرقم السري اتمسح ✅'); load(); } catch (e) { setErr(errText(e)); } };
  const toggle = async (u) => { setErr(''); try { await axiosClient.patch(`/users/${u.id}/`, { is_active: !u.is_active }); load(); } catch (e) { setErr(errText(e)); } };
  const term = q.trim().toLowerCase();
  const list = rows.filter((u) => !term || [u.username, u.first_name, u.last_name, u.phone, roleName(u.role)].join(' ').toLowerCase().includes(term));
  const bName = (ids) => (ids || []).map((id) => (branches.find((b) => b.id === id) || {}).name).filter(Boolean).join('، ') || '—';
  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full';
  const canSave = form && form.username.trim() && (editId || form.password.trim()) && (!form.pin || /^\d{4,6}$/.test(form.pin));
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users size={20} className="text-emerald-600" /> إدارة الموظفين</h1><p className="text-xs text-slate-500 mt-1">الموظفين وأدوارهم ونقطة بيع كل كاشير والرقم السري للدخول السريع</p></div>
        <button type="button" onClick={openNew} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Plus size={14} /> موظف جديد</button>
      </div>
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
      {err && !form && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold">{err}</div>}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="relative max-w-sm"><Search size={15} className="absolute top-1/2 -translate-y-1/2 text-slate-400" style={isRTL ? { right: 10 } : { left: 10 }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو التليفون أو الدور..." className={input} style={isRTL ? { paddingRight: 32 } : { paddingLeft: 32 }} /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-100 text-slate-700"><th className="p-2 text-start">الاسم</th><th className="p-2 text-start">اسم الدخول</th><th className="p-2 text-start">التليفون</th><th className="p-2 text-start">الدور</th><th className="p-2 text-start">نقطة البيع</th><th className="p-2 text-start">الفروع</th><th className="p-2 text-start">آخر دخول</th><th className="p-2 text-center">PIN</th><th className="p-2 text-center">الحالة</th><th className="p-2"></th></tr></thead>
            <tbody>
              {list.map((u) => {
                const me = String(u.id) === String(user?.id);
                return (
                  <tr key={u.id} className={`border-b border-slate-100 ${u.is_active ? '' : 'text-slate-400'}`}>
                    <td className="p-2 font-bold">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}{me ? <span className="text-[10px] text-emerald-700"> (إنت)</span> : null}</td>
                    <td className="p-2 font-mono">{u.username}</td><td className="p-2 font-mono">{u.phone || '—'}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-900' : u.role === 'MANAGER' ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'}`}>{roleName(u.role)}</span></td>
                    <td className="p-2">{u.pos_terminal_name || (u.role === 'CASHIER' ? 'أي نقطة' : '—')}</td><td className="p-2">{bName(u.assigned_branches)}</td><td className="p-2">{dt(u.last_login)}</td>
                    <td className="p-2 text-center">{u.has_pin ? '🔢' : '—'}</td>
                    <td className="p-2 text-center"><button type="button" disabled={me} onClick={() => toggle(u)} className={`h-7 px-2 rounded-lg text-[11px] font-bold ${me ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${u.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{u.is_active ? 'شغال' : 'موقوف'}</button></td>
                    <td className="p-2"><button type="button" onClick={() => openEdit(u)} className="h-7 px-2 rounded-lg border border-slate-300 bg-white font-bold flex items-center gap-1 cursor-pointer"><Pencil size={12} /> تعديل</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {form && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between"><div className="text-base font-bold">{editId ? `تعديل: ${form.username}` : 'موظف جديد'}</div><button type="button" onClick={() => setForm(null)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><X size={16} /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="font-bold text-slate-600 space-y-1 block">الاسم الأول<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={input} /></label>
              <label className="font-bold text-slate-600 space-y-1 block">الاسم الأخير<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={input} /></label>
              <label className="font-bold text-slate-600 space-y-1 block">اسم الدخول *<input value={form.username} disabled={!!editId} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} className={input + ' font-mono'} /></label>
              <label className="font-bold text-slate-600 space-y-1 block">التليفون<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input + ' font-mono'} /></label>
              <label className="font-bold text-slate-600 space-y-1 block">الدور *<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={input}>{ROLES.filter((r) => r.id !== 'ADMIN' || isAdmin).map((r) => <option key={r.id} value={r.id}>{r.n}</option>)}</select></label>
              <label className="font-bold text-slate-600 space-y-1 block">نقطة البيع (للكاشير)<select value={form.pos_terminal} onChange={(e) => setForm({ ...form, pos_terminal: e.target.value })} className={input}><option value="">أي نقطة بيع</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
              <label className="font-bold text-slate-600 space-y-1 block">{editId ? 'باسورد جديد (سيبه فاضي لو مش هتغيّره)' : 'الباسورد *'}<input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} /></label>
              <label className="font-bold text-slate-600 space-y-1 block">الإيميل (اختياري)<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} /></label>
              <div className="md:col-span-2 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="font-bold text-slate-700 flex items-center gap-1"><KeyRound size={14} /> الرقم السري للدخول السريع (PIN) {editHasPin ? <span className="text-emerald-700">— موجود ✅</span> : null}</div>
                <div className="text-[11px] text-slate-500">من 4 لـ 6 أرقام. الموظف يكتبه في خانة الباسورد بدل الباسورد. لو غلط 5 مرات بيتقفل 5 دقايق.</div>
                <div className="flex gap-2"><input autoComplete="off" name="quick-pin" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder={editHasPin ? 'اكتب رقم جديد لو عايز تغيّره' : 'مثلاً 4321'} className={input + ' font-mono max-w-[200px]'} />
                  {editId && editHasPin && <button type="button" onClick={clearPin} className="h-10 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-bold cursor-pointer">مسح الـ PIN</button>}</div>
              </div>
              <div className="md:col-span-2 space-y-1"><div className="font-bold text-slate-600">الفروع المسموحة</div><div className="flex flex-wrap gap-2">{branches.map((b) => { const on = form.assigned_branches.includes(b.id); return <button key={b.id} type="button" onClick={() => setForm({ ...form, assigned_branches: on ? form.assigned_branches.filter((x) => x !== b.id) : [...form.assigned_branches, b.id] })} className={`h-8 px-3 rounded-lg border font-bold cursor-pointer ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'}`}>{b.name}</button>; })}</div></div>
            </div>
            {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-xs font-bold">{err}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-bold cursor-pointer">إلغاء</button>
              <button type="button" disabled={busy || !canSave} onClick={save} className="flex-1 h-11 rounded-xl bg-emerald-600 disabled:bg-slate-400 text-white text-sm font-bold cursor-pointer">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}