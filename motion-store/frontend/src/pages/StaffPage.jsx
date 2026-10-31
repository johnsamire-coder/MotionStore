// STAFF_PHASE1: attendance, rotating days off, employees, report, settings (docs/STAFF_PAYROLL_PLAN.md)
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import ExportButtons from '../components/ExportButtons';
import { Clock, CalendarDays, Users, BarChart3, Settings, Save, ChevronRight, ChevronLeft, Plus, Trash2, X } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const hm = (m) => { m = Number(m || 0); if (!m) return '—'; const h = Math.floor(m / 60); const r = m % 60; return h ? `${h}س ${r ? r + 'د' : ''}`.trim() : `${r}د`; };
const errOf = (e) => { const d = e.response?.data; if (!d) return e.message; if (d.detail) return d.detail; return Object.values(d).flat().join(' - '); };
// JS getDay(): 0=Sunday. Backend weekday(): 0=Monday.
const WD = ['الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت', 'الحد'];
const pyWeekday = (s) => (parse(s).getDay() + 6) % 7;
const weekStartOf = (s, ws) => addDays(s, -((pyWeekday(s) - ws + 7) % 7));

const STATUSES = [['', '— لسه —'], ['PRESENT', 'حاضر'], ['ABSENT', 'غياب'], ['LEAVE_PAID', 'إجازة بأجر'], ['LEAVE_UNPAID', 'إجازة من غير أجر'], ['OFF', 'إجازته'], ['HOLIDAY', 'عطلة رسمية']];
const PAY = { MONTHLY: 'شهري ثابت', WEEKLY: 'أسبوعي ثابت', DAILY: 'يومية' };
const input = 'h-9 px-2 border border-slate-300 rounded-lg text-sm bg-white';
const BTN_COLORS = { emerald: 'bg-emerald-600 hover:bg-emerald-700', slate: 'bg-slate-600 hover:bg-slate-700', sky: 'bg-sky-600 hover:bg-sky-700' };
const btn = (c = 'emerald') => `h-9 px-3 rounded-lg text-xs font-black text-white ${BTN_COLORS[c]} disabled:opacity-50 cursor-pointer inline-flex items-center gap-1`;

function Box({ msg, err }) {
  return (<>
    {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-sm font-bold">{msg}</div>}
    {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-lg text-sm font-bold whitespace-pre-line">{err}</div>}
  </>);
}

// ---------------------------------------------------------------- attendance of one day
function AttendanceTab({ settings }) {
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState({ rows: [], holiday: '' });
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const manualOT = settings?.overtime_mode === 'MANUAL';
  const load = async (d = date) => {
    setErr('');
    try { const r = await axiosClient.get(`/staff/attendance/?date=${d}`); setSheet(r.data); setRows(r.data.rows.map((x) => ({ ...x }))); } catch (e) { setErr(errOf(e)); }
  };
  useEffect(() => { load(date); }, [date]);
  const upd = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v, dirty: true } : r)));
  const asUsual = (i) => setRows((p) => p.map((r, j) => (j === i ? { ...r, status: 'PRESENT', check_in: r.start_time, check_out: r.end_time, dirty: true } : r)));
  const allUsual = () => setRows((p) => p.map((r) => (r.locked || r.status ? r : { ...r, status: 'PRESENT', check_in: r.start_time, check_out: r.end_time, dirty: true })));
  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await axiosClient.post('/staff/attendance/', { date, rows: rows.map((x) => ({ employee_id: x.employee_id, status: x.status, check_in: x.check_in, check_out: x.check_out, overtime_minutes: x.overtime_minutes, notes: x.notes })) });
      setSheet(r.data); setRows(r.data.rows.map((x) => ({ ...x }))); setMsg(`اتحفظ ✅ (${r.data.saved} موظف)`); setTimeout(() => setMsg(''), 3500);
    } catch (e) { setErr(errOf(e)); } finally { setBusy(false); }
  };
  const blanks = rows.filter((r) => !r.status).length;
  const dirty = rows.some((r) => r.dirty);
  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
        <button className={btn('slate')} onClick={() => setDate(addDays(date, -1))}><ChevronRight size={14} /></button>
        <input type="date" className={input} value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className={btn('slate')} disabled={date >= today()} onClick={() => setDate(addDays(date, 1))}><ChevronLeft size={14} /></button>
        <span className="text-sm font-bold text-slate-600">{WD[pyWeekday(date)]}</span>
        {sheet.holiday && <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-black">عطلة رسمية: {sheet.holiday}</span>}
        <div className="flex-1" />
        {blanks > 0 && <span className="text-xs font-bold text-rose-600">{blanks} موظف لسه ماتسجلوش</span>}
        <button className={btn('sky')} onClick={allUsual}>الكل زي ميعاده</button>
        <button className={btn()} disabled={busy || !dirty} onClick={save}><Save size={14} /> {busy ? 'جاري الحفظ...' : 'حفظ'}</button>
      </div>
      <Box msg={msg} err={err} />
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>
            {['الموظف', 'الميعاد', 'الحالة', 'الحضور', 'الانصراف', 'تأخير', 'خروج بدري', 'إضافي', 'ملاحظة', ''].map((h) => <th key={h} className="p-2 text-start font-bold">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const present = r.status === 'PRESENT';
              return (
                <tr key={r.employee_id} className={`border-t border-slate-100 ${r.locked ? 'bg-slate-50 opacity-70' : ''} ${!r.status ? 'bg-rose-50/40' : ''}`}>
                  <td className="p-2 font-bold">{r.name}<div className="text-[11px] text-slate-400 font-normal">{r.job_title}{r.is_off_day ? ' · إجازته النهارده' : ''}</div></td>
                  <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{r.start_time} ← {r.end_time}</td>
                  <td className="p-2"><select className={input} disabled={r.locked} value={r.status} onChange={(e) => upd(i, 'status', e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  <td className="p-2"><input type="time" className={input} disabled={r.locked || !present} value={r.check_in} onChange={(e) => upd(i, 'check_in', e.target.value)} /></td>
                  <td className="p-2"><input type="time" className={input} disabled={r.locked || !present} value={r.check_out} onChange={(e) => upd(i, 'check_out', e.target.value)} /></td>
                  <td className={`p-2 text-xs font-bold ${r.late_minutes ? 'text-rose-600' : 'text-slate-400'}`}>{r.dirty ? '…' : hm(r.late_minutes)}</td>
                  <td className={`p-2 text-xs font-bold ${r.early_minutes ? 'text-amber-600' : 'text-slate-400'}`}>{r.dirty ? '…' : hm(r.early_minutes)}</td>
                  <td className="p-2 text-xs font-bold text-emerald-700">{manualOT
                    ? <input type="number" min="0" className={`${input} w-20`} disabled={r.locked || !present} value={r.overtime_minutes || ''} placeholder="دقايق" onChange={(e) => upd(i, 'overtime_minutes', e.target.value)} />
                    : (r.dirty ? '…' : hm(r.overtime_minutes))}</td>
                  <td className="p-2"><input className={`${input} w-32`} disabled={r.locked} value={r.notes} onChange={(e) => upd(i, 'notes', e.target.value)} /></td>
                  <td className="p-2 whitespace-nowrap">{!r.locked && <>
                    <button className="text-xs font-bold text-sky-700 hover:underline mx-1 cursor-pointer" onClick={() => asUsual(i)}>زي ميعاده</button>
                    <button className="text-xs font-bold text-rose-700 hover:underline mx-1 cursor-pointer" onClick={() => upd(i, 'status', 'ABSENT')}>غياب</button>
                  </>}{r.locked && <span className="text-[11px] text-slate-400">مقفول (مرتب معتمد)</span>}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan="10" className="p-6 text-center text-slate-400">مفيش موظفين. ضيفهم من تبويب «الموظفين».</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">التأخير والخروج بدري والإضافي بيتحسبوا بعد الحفظ. اليوم اللي «لسه» مابيتحسبش غياب.</p>
    </div>
  );
}

// ---------------------------------------------------------------- rotating days off
function RosterTab({ settings }) {
  const ws = Number(settings?.week_start ?? 5);
  const [start, setStart] = useState(weekStartOf(today(), ws));
  const [data, setData] = useState({ days: [], rows: [], warnings: [], holidays: {} });
  const [err, setErr] = useState('');
  const load = async (s = start) => { try { const r = await axiosClient.get(`/staff/roster/?start=${s}`); setData(r.data); setErr(''); } catch (e) { setErr(errOf(e)); } };
  useEffect(() => { load(start); }, [start]);
  const toggle = async (row, day, on) => {
    if (row.fixed_off_weekday !== null && row.fixed_off_weekday !== undefined) return;
    try { await axiosClient.post('/staff/roster/', { employee_id: row.employee_id, date: day, off: on }); load(); } catch (e) { setErr(errOf(e)); }
  };
  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
        <button className={btn('slate')} onClick={() => setStart(addDays(start, -7))}><ChevronRight size={14} /> الأسبوع اللي فات</button>
        <span className="text-sm font-black">من {start} لـ {addDays(start, 6)}</span>
        <button className={btn('slate')} onClick={() => setStart(addDays(start, 7))}>الأسبوع الجاي <ChevronLeft size={14} /></button>
      </div>
      <Box err={err} />
      {data.warnings.length > 0 && <div className="bg-amber-50 border border-amber-300 text-amber-800 p-2 rounded-lg text-xs font-bold space-y-1">{data.warnings.map((w) => <div key={w}>⚠️ {w}</div>)}</div>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-2 text-start">الموظف</th>
            {data.days.map((d) => <th key={d} className={`p-2 text-center ${data.holidays[d] ? 'text-amber-700' : ''}`}>{WD[pyWeekday(d)]}<div className="font-normal">{d.slice(5)}</div>{data.holidays[d] && <div className="text-[10px]">{data.holidays[d]}</div>}</th>)}
          </tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.employee_id} className="border-t border-slate-100">
              <td className="p-2 font-bold">{r.name}<div className="text-[11px] text-slate-400 font-normal">{r.fixed_off_weekday !== null && r.fixed_off_weekday !== undefined ? `إجازة ثابتة: ${WD[r.fixed_off_weekday]}` : `${r.off_days_per_week} يوم في الأسبوع`}</div></td>
              {r.off.map((on, k) => <td key={k} className="p-2 text-center">
                <button onClick={() => toggle(r, data.days[k], !on)} className={`w-9 h-9 rounded-lg text-xs font-black cursor-pointer ${on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{on ? 'إجازة' : '—'}</button>
              </td>)}
            </tr>))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">دوس على المربع علشان تحط أو تشيل يوم الإجازة. الموظف اللي إجازته ثابتة بتتحط لوحدها.</p>
    </div>
  );
}

// ---------------------------------------------------------------- employees
const emptyEmp = () => ({ name: '', phone: '', job_title: '', hire_date: '', is_active: true, pay_type: 'MONTHLY', salary: '', start_time: '10:00', end_time: '22:00', off_days_per_week: 1, fixed_off_weekday: '', user: '', notes: '' });
function EmployeesTab({ onChange }) {
  const [list, setList] = useState([]); const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => {
    try { const r = await axiosClient.get('/staff/employees/'); setList(listOf(r.data)); } catch (e) { setErr(errOf(e)); }
    try { const u = await axiosClient.get('/users/'); setUsers(listOf(u.data)); } catch (e) { setUsers([]); }
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    setBusy(true); setErr('');
    const body = { ...form, hire_date: form.hire_date || null, user: form.user || null, fixed_off_weekday: form.fixed_off_weekday === '' ? null : Number(form.fixed_off_weekday), salary: form.salary || '0' };
    try {
      if (form.id) await axiosClient.put(`/staff/employees/${form.id}/`, body); else await axiosClient.post('/staff/employees/', body);
      setForm(null); setMsg('اتحفظ ✅'); setTimeout(() => setMsg(''), 3000); await load(); onChange && onChange();
    } catch (e) { setErr(errOf(e)); } finally { setBusy(false); }
  };
  const remove = async (e1) => {
    if (!window.confirm(`متأكد إنك عايز تشيل ${e1.name}؟ لو ليه حضور هيتوقف بس.`)) return;
    try { const r = await axiosClient.delete(`/staff/employees/${e1.id}/`); setMsg(r.data?.detail || 'اتشال ✅'); await load(); } catch (e) { setErr(errOf(e)); }
  };
  const F = (k, label, el) => <label className="text-xs font-bold text-slate-600 space-y-1 block">{label}{el}</label>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className={btn()} onClick={() => setForm(emptyEmp())}><Plus size={14} /> موظف جديد</button></div>
      <Box msg={msg} err={!form ? err : ''} />
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['الاسم', 'الوظيفة', 'التليفون', 'نوع المرتب', 'المرتب', 'الميعاد', 'الإجازة', 'الحالة', ''].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
          <tbody>{list.map((e1) => (
            <tr key={e1.id} className={`border-t border-slate-100 ${e1.is_active ? '' : 'opacity-50'}`}>
              <td className="p-2 font-bold">{e1.name}{e1.user_name && <div className="text-[11px] text-slate-400 font-normal">حساب: {e1.user_name}</div>}</td>
              <td className="p-2">{e1.job_title}</td><td className="p-2">{e1.phone}</td><td className="p-2">{PAY[e1.pay_type]}</td>
              <td className="p-2 font-bold">{Number(e1.salary).toLocaleString('en-US')}</td>
              <td className="p-2 text-xs">{String(e1.start_time).slice(0, 5)} ← {String(e1.end_time).slice(0, 5)}</td>
              <td className="p-2 text-xs">{e1.fixed_off_weekday !== null ? `ثابتة: ${WD[e1.fixed_off_weekday]}` : `${e1.off_days_per_week} يوم بالتناوب`}</td>
              <td className="p-2 text-xs font-bold">{e1.is_active ? <span className="text-emerald-700">شغال</span> : <span className="text-slate-500">موقوف</span>}</td>
              <td className="p-2 whitespace-nowrap">
                <button className="text-xs font-bold text-sky-700 hover:underline mx-1 cursor-pointer" onClick={() => setForm({ ...emptyEmp(), ...e1, start_time: String(e1.start_time).slice(0, 5), end_time: String(e1.end_time).slice(0, 5), hire_date: e1.hire_date || '', user: e1.user || '', fixed_off_weekday: e1.fixed_off_weekday ?? '' })}>تعديل</button>
                {e1.is_active && <button className="text-xs font-bold text-rose-700 hover:underline mx-1 cursor-pointer" onClick={() => remove(e1)}><Trash2 size={12} className="inline" /></button>}
              </td>
            </tr>))}
            {!list.length && <tr><td colSpan="9" className="p-6 text-center text-slate-400">لسه مفيش موظفين</td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="font-black">{form.id ? 'تعديل موظف' : 'موظف جديد'}</h3><button onClick={() => setForm(null)} className="cursor-pointer"><X size={18} /></button></div>
            <Box err={err} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {F('name', 'الاسم *', <input className={`${input} w-full`} value={form.name} onChange={set('name')} />)}
              {F('job_title', 'الوظيفة', <input className={`${input} w-full`} value={form.job_title} placeholder="كاشير، فرّاز، عامل..." onChange={set('job_title')} />)}
              {F('phone', 'التليفون', <input className={`${input} w-full`} value={form.phone} onChange={set('phone')} />)}
              {F('hire_date', 'تاريخ التعيين', <input type="date" className={`${input} w-full`} value={form.hire_date} onChange={set('hire_date')} />)}
              {F('pay_type', 'نوع المرتب', <select className={`${input} w-full`} value={form.pay_type} onChange={set('pay_type')}>{Object.entries(PAY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
              {F('salary', form.pay_type === 'MONTHLY' ? 'المرتب في الشهر' : form.pay_type === 'WEEKLY' ? 'المرتب في الأسبوع' : 'اليومية', <input type="number" min="0" className={`${input} w-full`} value={form.salary} onChange={set('salary')} />)}
              {F('start_time', 'ميعاد الحضور', <input type="time" className={`${input} w-full`} value={form.start_time} onChange={set('start_time')} />)}
              {F('end_time', 'ميعاد الانصراف', <input type="time" className={`${input} w-full`} value={form.end_time} onChange={set('end_time')} />)}
              {F('off_days_per_week', 'أيام الإجازة في الأسبوع', <input type="number" min="0" max="6" className={`${input} w-full`} value={form.off_days_per_week} onChange={set('off_days_per_week')} />)}
              {F('fixed_off_weekday', 'يوم إجازة ثابت (اختياري)', <select className={`${input} w-full`} value={form.fixed_off_weekday} onChange={set('fixed_off_weekday')}><option value="">بالتناوب (من جدول الإجازات)</option>{WD.map((n, i) => <option key={i} value={i}>{n}</option>)}</select>)}
              {F('user', 'حساب الدخول (اختياري)', <select className={`${input} w-full`} value={form.user} onChange={set('user')}><option value="">من غير حساب</option>{users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}</select>)}
              <label className="text-xs font-bold text-slate-600 flex items-center gap-2 mt-5"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> شغال</label>
            </div>
            {F('notes', 'ملاحظات', <textarea className="w-full border border-slate-300 rounded-lg p-2 text-sm" rows="2" value={form.notes} onChange={set('notes')} />)}
            <div className="flex gap-2 justify-end"><button className={btn('slate')} onClick={() => setForm(null)}>إلغاء</button><button className={btn()} disabled={busy} onClick={save}><Save size={14} /> حفظ</button></div>
          </div>
        </div>)}
    </div>
  );
}

// ---------------------------------------------------------------- report
function ReportTab() {
  const [f, setF] = useState({ from: monthStart(), to: today(), employee: '' });
  const [emps, setEmps] = useState([]); const [data, setData] = useState(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(null);
  useEffect(() => { axiosClient.get('/staff/employees/').then((r) => setEmps(listOf(r.data))).catch(() => {}); run(); }, []);
  const run = async (x = f) => {
    const p = new URLSearchParams({ from: x.from, to: x.to }); if (x.employee) p.append('employee', x.employee);
    try { const r = await axiosClient.get(`/staff/report/?${p}`); setData(r.data); setErr(''); } catch (e) { setErr(errOf(e)); }
  };
  const cols = [['name', 'الموظف'], ['present', 'حضور'], ['absent', 'غياب'], ['leave_paid', 'إجازة بأجر'], ['leave_unpaid', 'من غير أجر'], ['off', 'إجازته'], ['holiday', 'عطلة'],
    ['worked_on_holiday', 'اشتغل في عطلة'], ['worked_on_off_day', 'اشتغل في إجازته'], ['late_days', 'أيام تأخير'], ['late_minutes', 'التأخير'], ['late_beyond_grace', 'بعد السماح'],
    ['early_minutes', 'خروج بدري'], ['overtime_minutes', 'إضافي'], ['worked_minutes', 'ساعات الشغل']];
  const isMin = (k) => k.endsWith('minutes') || k === 'late_beyond_grace';
  const report = () => ({ title: 'تقرير الحضور والانصراف', filename: 'attendance', filtersText: `${f.from} → ${f.to}`,
    columns: cols.map(([k, h]) => ({ key: k, header: h, width: k === 'name' ? 22 : 10 })),
    rows: (data?.rows || []).map((r) => Object.fromEntries(cols.map(([k]) => [k, isMin(k) ? hm(r[k]) : r[k]]))) });
  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold">من<br /><input type="date" className={input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="text-xs font-bold">إلى<br /><input type="date" className={input} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="text-xs font-bold">الموظف<br /><select className={input} value={f.employee} onChange={(e) => setF({ ...f, employee: e.target.value })}><option value="">الكل</option>{emps.map((e1) => <option key={e1.id} value={e1.id}>{e1.name}</option>)}</select></label>
        <button className={btn()} onClick={() => run()}>عرض</button>
        <div className="flex-1" /><ExportButtons getReport={report} />
      </div>
      <Box err={err} />
      {data && <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{cols.map(([k, h]) => <th key={k} className="p-2 text-start whitespace-nowrap">{h}</th>)}<th className="p-2">أيام ماتسجلتش</th></tr></thead>
          <tbody>{data.rows.map((r) => (<React.Fragment key={r.employee_id}>
            <tr className="border-t border-slate-100">
              {cols.map(([k]) => <td key={k} className={`p-2 ${k === 'name' ? 'font-bold' : 'text-xs'}`}>{isMin(k) ? hm(r[k]) : r[k]}</td>)}
              <td className="p-2 text-xs">{r.missing_days.length ? <button className="font-black text-rose-600 hover:underline cursor-pointer" onClick={() => setOpen(open === r.employee_id ? null : r.employee_id)}>{r.missing_days.length} يوم</button> : <span className="text-emerald-600">✅</span>}</td>
            </tr>
            {open === r.employee_id && <tr><td colSpan={cols.length + 1} className="p-2 bg-rose-50 text-xs">{r.missing_days.join(' · ')}</td></tr>}
          </React.Fragment>))}</tbody>
        </table>
      </div>}
      <p className="text-[11px] text-slate-400">«بعد السماح» = التأخير ناقص مدة السماح ({data?.grace_minutes ?? '—'} دقيقة) في كل يوم. الأيام اللي ماتسجلتش لازم تتكمّل قبل حساب المرتب.</p>
    </div>
  );
}

// ---------------------------------------------------------------- settings + holidays
function SettingsTab({ settings, canEdit, reload }) {
  const [s, setS] = useState(settings); const [hol, setHol] = useState([]); const [nh, setNh] = useState({ date: '', name: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => setS(settings), [settings]);
  const loadHol = async () => { try { const r = await axiosClient.get('/staff/holidays/'); setHol(listOf(r.data)); } catch (e) { setErr(errOf(e)); } };
  useEffect(() => { loadHol(); }, []);
  if (!s) return null;
  const save = async () => {
    setErr('');
    try { await axiosClient.put('/staff/settings/', { settings: s }); setMsg('اتحفظت ✅'); setTimeout(() => setMsg(''), 3000); reload(); } catch (e) { setErr(errOf(e)); }
  };
  const addHol = async () => { try { await axiosClient.post('/staff/holidays/', nh); setNh({ date: '', name: '' }); loadHol(); } catch (e) { setErr(errOf(e)); } };
  const delHol = async (h) => { if (!window.confirm(`تشيل عطلة ${h.name}؟`)) return; try { await axiosClient.delete(`/staff/holidays/${h.id}/`); loadHol(); } catch (e) { setErr(errOf(e)); } };
  const sel = (k, opts) => <select disabled={!canEdit} className={`${input} w-full`} value={String(s[k])} onChange={(e) => { const v = e.target.value; setS({ ...s, [k]: v === 'true' ? true : v === 'false' ? false : v }); }}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>;
  const numIn = (k) => <input disabled={!canEdit} type="number" min="0" className={`${input} w-full`} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />;
  const row = (label, el, hint) => <label className="block text-xs font-bold text-slate-600 space-y-1">{label}{el}{hint && <span className="block text-[11px] font-normal text-slate-400">{hint}</span>}</label>;
  const tiers = s.late_tiers || [];
  return (
    <div className="space-y-3">
      {!canEdit && <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-600">الإعدادات دي صاحب الشركة بس اللي يقدر يغيّرها.</div>}
      <Box msg={msg} err={err} />
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-black text-sm">التأخير والخروج بدري</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {row('طريقة خصم التأخير', sel('late_mode', [['PER_MINUTE', 'بالدقيقة بعد السماح'], ['TIERS', 'شرايح'], ['NONE', 'من غير خصم تلقائي']]))}
          {row('مدة السماح (دقايق)', numIn('grace_minutes'))}
          {row('الخروج بدري', sel('early_leave_mode', [['SAME_AS_LATE', 'يتخصم زي التأخير'], ['NONE', 'من غير خصم']]))}
        </div>
        {s.late_mode === 'TIERS' && <div className="space-y-2">
          <div className="text-xs font-bold text-slate-600">الشرايح</div>
          {tiers.map((t, i) => <div key={i} className="flex gap-2 items-center text-xs">
            لحد <input disabled={!canEdit} type="number" className={`${input} w-24`} value={t.up_to} onChange={(e) => setS({ ...s, late_tiers: tiers.map((x, j) => (j === i ? { ...x, up_to: e.target.value } : x)) })} /> دقيقة ← يتخصم
            <input disabled={!canEdit} type="number" step="0.05" className={`${input} w-24`} value={t.day_fraction} onChange={(e) => setS({ ...s, late_tiers: tiers.map((x, j) => (j === i ? { ...x, day_fraction: e.target.value } : x)) })} /> من اليوم
            {canEdit && <button className="text-rose-600 cursor-pointer" onClick={() => setS({ ...s, late_tiers: tiers.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}
          </div>)}
          {canEdit && <button className="text-xs font-bold text-sky-700 cursor-pointer" onClick={() => setS({ ...s, late_tiers: [...tiers, { up_to: 60, day_fraction: '0.25' }] })}>+ شريحة</button>}
          <div className="text-[11px] text-slate-400">مثال: لحد 60 ← 0.25 (ربع يوم)، لحد 120 ← 0.5 (نص يوم).</div>
        </div>}
        <h3 className="font-black text-sm pt-2">الإضافي والغياب</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {row('الإضافي', sel('overtime_mode', [['OFF', 'مايتحسبش'], ['AUTO', 'تلقائي من المواعيد'], ['MANUAL', 'يدوي (بيتكتب بالدقايق)']]))}
          {row('معامل الإضافي', numIn('overtime_multiplier'), '1 = زي الساعة العادية، 1.5 = ساعة ونص')}
          {row('أقل مدة إضافي تتحسب (دقايق)', numIn('overtime_min_minutes'))}
          {row('خصم يوم الغياب', numIn('absence_multiplier'), '1 = يوم، 2 = يومين')}
          {row('أجر اليوم للشهري', sel('month_days_basis', [['THIRTY', 'المرتب ÷ 30'], ['WORKING_DAYS', 'المرتب ÷ أيام الشغل الفعلية']]))}
        </div>
        <h3 className="font-black text-sm pt-2">الأسبوع والعطلات الرسمية</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {row('بداية الأسبوع', sel('week_start', WD.map((n, i) => [i, n])))}
          {row('يوم صرف الأسبوعي', sel('weekly_pay_day', WD.map((n, i) => [i, n])))}
          {row('العطلة الرسمية', sel('holiday_paid', [[true, 'بأجر'], [false, 'من غير أجر']]))}
          {row('لو اشتغل في العطلة', sel('holiday_work_mode', [['NORMAL', 'يوم عادي'], ['OVERTIME', 'إضافي بمعامل'], ['EXTRA_DAY', 'أجر يوم زيادة × معامل']]))}
          {row('معامل الشغل في العطلة', numIn('holiday_work_multiplier'))}
        </div>
        <h3 className="font-black text-sm pt-2">البضاعة والسلف (للمراحل الجاية)</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {row('سعر البضاعة للموظف', sel('goods_price_mode', [['SALE', 'سعر البيع'], ['SALE_DISCOUNT', 'سعر البيع بخصم %'], ['COST', 'التكلفة']]))}
          {row('نسبة خصم الموظفين %', numIn('goods_discount_pct'))}
          {row('السلف', sel('advance_mode', [['INSTALLMENT', 'بالقسط اللي يتحدد'], ['ALL', 'تتخصم كلها في أول مرتب']]))}
        </div>
        {canEdit && <div className="flex justify-end"><button className={btn()} onClick={save}><Save size={14} /> حفظ الإعدادات</button></div>}
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-black text-sm">لستة العطلات الرسمية</h3>
        {canEdit && <div className="flex flex-wrap gap-2 items-end">
          <input type="date" className={input} value={nh.date} onChange={(e) => setNh({ ...nh, date: e.target.value })} />
          <input className={input} placeholder="اسم العطلة (مثلاً: عيد الفطر)" value={nh.name} onChange={(e) => setNh({ ...nh, name: e.target.value })} />
          <button className={btn()} disabled={!nh.date || !nh.name.trim()} onClick={addHol}><Plus size={14} /> إضافة</button>
        </div>}
        <div className="divide-y divide-slate-100">{hol.map((h) => <div key={h.id} className="flex justify-between py-2 text-sm"><span><b>{h.date}</b> · {h.name}</span>{canEdit && <button className="text-rose-600 cursor-pointer" onClick={() => delHol(h)}><Trash2 size={14} /></button>}</div>)}
          {!hol.length && <div className="text-xs text-slate-400 py-2">مفيش عطلات متسجلة</div>}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page
const TABS = [['att', 'الحضور', Clock], ['roster', 'جدول الإجازات', CalendarDays], ['emps', 'الموظفين', Users], ['report', 'تقرير الحضور', BarChart3], ['settings', 'الإعدادات', Settings]];
export default function StaffPage() {
  const [tab, setTab] = useState('att');
  const [cfg, setCfg] = useState(null); const [canEdit, setCanEdit] = useState(false); const [err, setErr] = useState('');
  const [rev, setRev] = useState(0);
  const loadCfg = async () => { try { const r = await axiosClient.get('/staff/settings/'); setCfg(r.data.settings); setCanEdit(r.data.can_edit); } catch (e) { setErr(errOf(e)); } };
  useEffect(() => { loadCfg(); }, []);
  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Clock size={20} className="text-emerald-600" /> الحضور والمرتبات</h1>
        <p className="text-xs text-slate-500 mt-1">صاحب الشركة بيسجل مواعيد الحضور والانصراف، والبرنامج بيحسب التأخير والخروج بدري والإضافي.</p>
        <div className="flex flex-wrap gap-1.5 mt-3">{TABS.map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 rounded-lg text-xs font-black cursor-pointer flex items-center gap-1.5 ${tab === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><I size={14} /> {l}</button>))}</div>
      </div>
      <Box err={err} />
      {cfg && tab === 'att' && <AttendanceTab key={rev} settings={cfg} />}
      {cfg && tab === 'roster' && <RosterTab key={rev} settings={cfg} />}
      {tab === 'emps' && <EmployeesTab onChange={() => setRev((x) => x + 1)} />}
      {tab === 'report' && <ReportTab />}
      {cfg && tab === 'settings' && <SettingsTab settings={cfg} canEdit={canEdit} reload={loadCfg} />}
    </div>
  );
}
