import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CreditCard, Landmark, MonitorSmartphone, Pencil, Plus, Power, RefreshCw, X } from 'lucide-react';

const listOf = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function OperationsSettings() {
  const { user } = useAuth();
  const { lang, isRTL } = useLanguage();
  const isArabic = lang === 'ar';
  const isAdmin = !!(user?.is_superuser || user?.role === 'ADMIN');
  const text = isArabic ? {
    title: 'طرق الدفع والخزن ونقط البيع',
    subtitle: 'إدارة طرق التحصيل، الخزن، ونقط البيع من مكان واحد',
    payment: 'طرق الدفع',
    treasury: 'الخزن',
    pos: 'نقط البيع',
    add: 'إضافة',
    edit: 'تعديل',
    active: 'شغالة',
    inactive: 'متوقفة',
    name: 'الاسم',
    type: 'النوع',
    treasuryLink: 'الخزنة المرتبطة',
    branch: 'الفرع',
    warehouse: 'المخزن',
    drawer: 'الدرج',
    balance: 'الرصيد',
    noData: 'مفيش بيانات لسه',
    adminOnly: 'التعديل متاح للأدمن فقط. باقي المستخدمين يقدروا يقرأوا البيانات.',
    save: 'حفظ',
    cancel: 'إلغاء',
    loading: 'جاري التحميل...',
    saved: 'اتحفظ ✅',
    failed: 'حصلت مشكلة: ',
    methodName: 'اسم طريقة الدفع',
    methodType: 'نوع طريقة الدفع',
    cash: 'نقدي',
    electronic: 'فيزا / محفظة إلكترونية',
    credit: 'آجل على العميل',
    linkTreasury: 'اربطها بخزنة',
    noTreasury: 'من غير خزنة',
    treasuryName: 'اسم الخزنة',
    treasuryType: 'نوع الخزنة',
    mainSafe: 'خزينة رئيسية',
    drawerType: 'درج كاشير',
    bank: 'بنك / محفظة',
    posName: 'اسم نقطة البيع / الكاشير',
    posCode: 'كود نقطة البيع',
    addPosHint: 'سيتم إنشاء درج كاشير مرتبط بها تلقائيًا',
    select: 'اختار',
    terminal: 'نقطة البيع',
    close: 'إغلاق',
    refresh: 'تحديث'
  } : {
    title: 'Payment Methods, Treasuries & POS',
    subtitle: 'Manage collection methods, treasuries and points of sale',
    payment: 'Payment methods',
    treasury: 'Treasuries',
    pos: 'Points of sale',
    add: 'Add',
    edit: 'Edit',
    active: 'Active',
    inactive: 'Inactive',
    name: 'Name',
    type: 'Type',
    treasuryLink: 'Linked treasury',
    branch: 'Branch',
    warehouse: 'Warehouse',
    drawer: 'Drawer',
    balance: 'Balance',
    noData: 'No data yet',
    adminOnly: 'Only admins can edit. Other users can read the data.',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    saved: 'Saved ✅',
    failed: 'Something went wrong: ',
    methodName: 'Payment method name',
    methodType: 'Payment method type',
    cash: 'Cash',
    electronic: 'Card / e-wallet',
    credit: 'Customer credit',
    linkTreasury: 'Link to treasury',
    noTreasury: 'No treasury',
    treasuryName: 'Treasury name',
    treasuryType: 'Treasury type',
    mainSafe: 'Main safe',
    drawerType: 'Cash drawer',
    bank: 'Bank / wallet',
    posName: 'POS / cashier name',
    posCode: 'POS code',
    addPosHint: 'A linked cash drawer will be created automatically',
    select: 'Select',
    terminal: 'Point of sale',
    close: 'Close',
    refresh: 'Refresh'
  };

  const [tab, setTab] = useState('PAYMENTS');
  const [payments, setPayments] = useState([]);
  const [treasuries, setTreasuries] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ name: '', method_type: 'CASH', treasury: '' });
  const [treasuryForm, setTreasuryForm] = useState({ name: '', treasury_type: 'MAIN_SAFE', branch: '' });
  const [posForm, setPosForm] = useState({ name: '', code: '', branch: '', default_warehouse: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [pm, tr, pos, br, wh] = await Promise.all([
        axiosClient.get('/payments/?all=1'),
        axiosClient.get('/treasuries/?all=1'),
        axiosClient.get('/pos-terminals/?all=1'),
        axiosClient.get('/branches/?all=1'),
        axiosClient.get('/warehouses/?all=1')
      ]);
      const nextBranches = listOf(br.data);
      const nextWarehouses = listOf(wh.data);
      setPayments(listOf(pm.data));
      setTreasuries(listOf(tr.data));
      setTerminals(listOf(pos.data));
      setBranches(nextBranches);
      setWarehouses(nextWarehouses);
      setTreasuryForm((old) => ({ ...old, branch: old.branch || nextBranches[0]?.id || '' }));
      setPosForm((old) => ({
        ...old,
        branch: old.branch || nextBranches[0]?.id || '',
        default_warehouse: old.default_warehouse || nextWarehouses[0]?.id || ''
      }));
    } catch (e) {
      setErr(text.failed + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (operation) => {
    setBusy(true);
    setErr('');
    try {
      await operation();
      await load();
      setMsg(text.saved);
      window.setTimeout(() => setMsg(''), 3500);
    } catch (e) {
      setErr(text.failed + (e.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  const createPayment = (e) => {
    e.preventDefault();
    if (!isAdmin || !paymentForm.name.trim()) return;
    run(async () => {
      await axiosClient.post('/payments/', {
        name: paymentForm.name.trim(),
        method_type: paymentForm.method_type,
        treasury: paymentForm.method_type === 'CREDIT' ? null : (paymentForm.treasury || null),
        is_active: true
      });
      setPaymentForm({ name: '', method_type: 'CASH', treasury: '' });
    });
  };

  const createTreasury = (e) => {
    e.preventDefault();
    if (!isAdmin || !treasuryForm.name.trim() || !treasuryForm.branch) return;
    run(async () => {
      await axiosClient.post('/treasuries/', {
        name: treasuryForm.name.trim(),
        treasury_type: treasuryForm.treasury_type,
        branch: treasuryForm.branch,
        is_active: true
      });
      setTreasuryForm((old) => ({ ...old, name: '' }));
    });
  };

  const createPOS = (e) => {
    e.preventDefault();
    if (!isAdmin || !posForm.name.trim() || !posForm.branch || !posForm.default_warehouse) return;
    run(async () => {
      await axiosClient.post('/pos-terminals/', {
        name: posForm.name.trim(),
        code: posForm.code.trim() || ('POS-' + String(terminals.length + 1).padStart(2, '0')),
        branch: posForm.branch,
        default_warehouse: posForm.default_warehouse,
        is_active: true
      });
      setPosForm((old) => ({ ...old, name: '', code: '' }));
    });
  };

  const toggle = (kind, item) => {
    if (!isAdmin) return;
    const paths = { payment: 'payments', treasury: 'treasuries', pos: 'pos-terminals' };
    run(() => axiosClient.patch('/' + paths[kind] + '/' + item.id + '/', { is_active: !item.is_active }));
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editing || !isAdmin) return;
    const { kind, data } = editing;
    const paths = { payment: 'payments', treasury: 'treasuries', pos: 'pos-terminals' };
    let payload = {};
    if (kind === 'payment') payload = {
      name: (data.name || '').trim(),
      method_type: data.method_type,
      treasury: data.method_type === 'CREDIT' ? null : (data.treasury || null),
      is_active: !!data.is_active
    };
    if (kind === 'treasury') payload = {
      name: (data.name || '').trim(),
      treasury_type: data.treasury_type,
      branch: data.branch,
      is_active: !!data.is_active
    };
    if (kind === 'pos') payload = {
      name: (data.name || '').trim(),
      code: (data.code || '').trim(),
      branch: data.branch,
      default_warehouse: data.default_warehouse,
      is_active: !!data.is_active
    };
    run(async () => {
      await axiosClient.patch('/' + paths[kind] + '/' + data.id + '/', payload);
      setEditing(null);
    });
  };

  const input = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white w-full';
  const card = 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm';
  const status = (item) => (
    <span className={'text-[11px] font-black px-2 py-1 rounded-full ' + (item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500')}>
      {item.is_active ? text.active : text.inactive}
    </span>
  );
  const branchName = (id) => branches.find((b) => String(b.id) === String(id))?.name || '—';
  const warehouseName = (id) => warehouses.find((w) => String(w.id) === String(id))?.name || '—';
  const treasuryName = (id) => treasuries.find((t) => String(t.id) === String(id))?.name || '—';

  const renderPaymentTab = () => (
    <div className="space-y-4">
      {isAdmin && <form onSubmit={createPayment} className={card + ' grid grid-cols-1 md:grid-cols-4 gap-3 items-end'}>
        <label className="text-xs font-bold text-slate-600">{text.methodName}<input className={input} value={paymentForm.name} onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })} required /></label>
        <label className="text-xs font-bold text-slate-600">{text.methodType}<select className={input} value={paymentForm.method_type} onChange={(e) => setPaymentForm({ ...paymentForm, method_type: e.target.value, treasury: e.target.value === 'CREDIT' ? '' : paymentForm.treasury })}><option value="CASH">{text.cash}</option><option value="ELECTRONIC">{text.electronic}</option><option value="CREDIT">{text.credit}</option></select></label>
        <label className="text-xs font-bold text-slate-600">{text.linkTreasury}<select className={input} disabled={paymentForm.method_type === 'CREDIT'} value={paymentForm.treasury} onChange={(e) => setPaymentForm({ ...paymentForm, treasury: e.target.value })}><option value="">{text.noTreasury}</option>{treasuries.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <button type="submit" disabled={busy} className="h-10 rounded-lg bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"><Plus size={16} />{text.add}</button>
      </form>}
      <div className={card + ' overflow-x-auto'}>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 font-black"><tr><th className="p-3 text-start">{text.name}</th><th className="p-3 text-start">{text.type}</th><th className="p-3 text-start">{text.treasuryLink}</th><th className="p-3 text-start">{text.active}</th>{isAdmin && <th className="p-3 text-start"> </th>}</tr></thead>
          <tbody className="divide-y">{payments.map((p) => <tr key={p.id}><td className="p-3 font-bold">{p.name}</td><td className="p-3">{p.method_type === 'CASH' ? text.cash : p.method_type === 'ELECTRONIC' ? text.electronic : text.credit}</td><td className="p-3">{p.treasury_name || treasuryName(p.treasury)}</td><td className="p-3">{status(p)}</td>{isAdmin && <td className="p-3 flex gap-2"><button type="button" onClick={() => setEditing({ kind: 'payment', data: { ...p } })} className="text-amber-700 font-bold cursor-pointer"><Pencil size={14} /></button><button type="button" onClick={() => toggle('payment', p)} className="text-slate-600 font-bold cursor-pointer"><Power size={14} /></button></td>}</tr>)}</tbody>
        </table>
        {!payments.length && <div className="p-5 text-center text-slate-400">{text.noData}</div>}
      </div>
    </div>
  );

  const renderTreasuryTab = () => (
    <div className="space-y-4">
      {isAdmin && <form onSubmit={createTreasury} className={card + ' grid grid-cols-1 md:grid-cols-4 gap-3 items-end'}>
        <label className="text-xs font-bold text-slate-600">{text.treasuryName}<input className={input} value={treasuryForm.name} onChange={(e) => setTreasuryForm({ ...treasuryForm, name: e.target.value })} required /></label>
        <label className="text-xs font-bold text-slate-600">{text.treasuryType}<select className={input} value={treasuryForm.treasury_type} onChange={(e) => setTreasuryForm({ ...treasuryForm, treasury_type: e.target.value })}><option value="MAIN_SAFE">{text.mainSafe}</option><option value="POS_DRAWER">{text.drawerType}</option><option value="BANK">{text.bank}</option></select></label>
        <label className="text-xs font-bold text-slate-600">{text.branch}<select className={input} value={treasuryForm.branch} onChange={(e) => setTreasuryForm({ ...treasuryForm, branch: e.target.value })} required><option value="">{text.select}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button type="submit" disabled={busy} className="h-10 rounded-lg bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"><Plus size={16} />{text.add}</button>
      </form>}
      <div className={card + ' overflow-x-auto'}>
        <table className="w-full text-xs"><thead className="bg-slate-100 font-black"><tr><th className="p-3 text-start">{text.name}</th><th className="p-3 text-start">{text.type}</th><th className="p-3 text-start">{text.branch}</th><th className="p-3 text-start">{text.balance}</th><th className="p-3 text-start">{text.active}</th>{isAdmin && <th className="p-3 text-start"> </th>}</tr></thead>
          <tbody className="divide-y">{treasuries.map((t) => <tr key={t.id}><td className="p-3 font-bold">{t.name}</td><td className="p-3">{t.treasury_type === 'MAIN_SAFE' ? text.mainSafe : t.treasury_type === 'POS_DRAWER' ? text.drawerType : text.bank}</td><td className="p-3">{t.branch_name || branchName(t.branch)}</td><td className="p-3 font-black">{Number(t.current_balance || 0).toFixed(2)} ج.م</td><td className="p-3">{status(t)}</td>{isAdmin && <td className="p-3 flex gap-2"><button type="button" onClick={() => setEditing({ kind: 'treasury', data: { ...t } })} className="text-amber-700 font-bold cursor-pointer"><Pencil size={14} /></button><button type="button" onClick={() => toggle('treasury', t)} className="text-slate-600 font-bold cursor-pointer"><Power size={14} /></button></td>}</tr>)}</tbody>
        </table>
        {!treasuries.length && <div className="p-5 text-center text-slate-400">{text.noData}</div>}
      </div>
    </div>
  );

  const renderPOSTab = () => (
    <div className="space-y-4">
      {isAdmin && <form onSubmit={createPOS} className={card + ' space-y-3'}>
        <div className="text-xs text-slate-500 font-bold">{text.addPosHint}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="text-xs font-bold text-slate-600">{text.posName}<input className={input} value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} required /></label>
          <label className="text-xs font-bold text-slate-600">{text.posCode}<input className={input} value={posForm.code} onChange={(e) => setPosForm({ ...posForm, code: e.target.value })} placeholder="POS-01" /></label>
          <label className="text-xs font-bold text-slate-600">{text.branch}<select className={input} value={posForm.branch} onChange={(e) => setPosForm({ ...posForm, branch: e.target.value })} required><option value="">{text.select}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">{text.warehouse}<select className={input} value={posForm.default_warehouse} onChange={(e) => setPosForm({ ...posForm, default_warehouse: e.target.value })} required><option value="">{text.select}</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        </div>
        <button type="submit" disabled={busy} className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"><Plus size={16} />{text.add} {text.terminal}</button>
      </form>}
      <div className={card + ' overflow-x-auto'}>
        <table className="w-full text-xs"><thead className="bg-slate-100 font-black"><tr><th className="p-3 text-start">{text.terminal}</th><th className="p-3 text-start">{text.branch}</th><th className="p-3 text-start">{text.warehouse}</th><th className="p-3 text-start">{text.drawer}</th><th className="p-3 text-start">{text.active}</th>{isAdmin && <th className="p-3 text-start"> </th>}</tr></thead>
          <tbody className="divide-y">{terminals.map((p) => <tr key={p.id}><td className="p-3"><div className="font-bold">{p.name}</div><div className="font-mono text-slate-500">{p.code}</div></td><td className="p-3">{p.branch_name || branchName(p.branch)}</td><td className="p-3">{p.warehouse_name || warehouseName(p.default_warehouse)}</td><td className="p-3">{p.cash_drawer_name || treasuryName(p.cash_drawer)}</td><td className="p-3">{status(p)}</td>{isAdmin && <td className="p-3 flex gap-2"><button type="button" onClick={() => setEditing({ kind: 'pos', data: { ...p } })} className="text-amber-700 font-bold cursor-pointer"><Pencil size={14} /></button><button type="button" onClick={() => toggle('pos', p)} className="text-slate-600 font-bold cursor-pointer"><Power size={14} /></button></td>}</tr>)}</tbody>
        </table>
        {!terminals.length && <div className="p-5 text-center text-slate-400">{text.noData}</div>}
      </div>
    </div>
  );

  return (
    <section className="space-y-4 mt-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl border border-emerald-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div><h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><Landmark className="text-emerald-600" size={19} />{text.title}</h2><p className="text-xs text-slate-500 mt-1">{text.subtitle}</p></div>
        <button type="button" onClick={load} className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw size={14} />{text.refresh}</button>
      </div>
      {!isAdmin && <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-bold">{text.adminOnly}</div>}
      {err && <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-bold">{err}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-bold">{msg}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('PAYMENTS')} className={'h-10 px-4 rounded-lg border text-xs font-black flex items-center gap-1 cursor-pointer ' + (tab === 'PAYMENTS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300')}><CreditCard size={15} />{text.payment}</button>
        <button type="button" onClick={() => setTab('TREASURIES')} className={'h-10 px-4 rounded-lg border text-xs font-black flex items-center gap-1 cursor-pointer ' + (tab === 'TREASURIES' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300')}><Landmark size={15} />{text.treasury}</button>
        <button type="button" onClick={() => setTab('POS')} className={'h-10 px-4 rounded-lg border text-xs font-black flex items-center gap-1 cursor-pointer ' + (tab === 'POS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300')}><MonitorSmartphone size={15} />{text.pos}</button>
      </div>
      {loading ? <div className="text-center text-slate-400 p-6">{text.loading}</div> : tab === 'PAYMENTS' ? renderPaymentTab() : tab === 'TREASURIES' ? renderTreasuryTab() : renderPOSTab()}
      {editing && <div className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <form onSubmit={saveEdit} className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b pb-3"><h3 className="font-black text-slate-800">{text.edit}</h3><button type="button" onClick={() => setEditing(null)} className="text-slate-400 cursor-pointer"><X size={18} /></button></div>
          <label className="text-xs font-bold text-slate-600">{text.name}<input className={input} value={editing.data.name || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} required /></label>
          {editing.kind === 'payment' && <><label className="text-xs font-bold text-slate-600">{text.methodType}<select className={input} value={editing.data.method_type} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, method_type: e.target.value, treasury: e.target.value === 'CREDIT' ? '' : editing.data.treasury } })}><option value="CASH">{text.cash}</option><option value="ELECTRONIC">{text.electronic}</option><option value="CREDIT">{text.credit}</option></select></label><label className="text-xs font-bold text-slate-600">{text.linkTreasury}<select className={input} disabled={editing.data.method_type === 'CREDIT'} value={editing.data.treasury || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, treasury: e.target.value } })}><option value="">{text.noTreasury}</option>{treasuries.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></>}
          {editing.kind === 'treasury' && <><label className="text-xs font-bold text-slate-600">{text.treasuryType}<select className={input} value={editing.data.treasury_type} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, treasury_type: e.target.value } })}><option value="MAIN_SAFE">{text.mainSafe}</option><option value="POS_DRAWER">{text.drawerType}</option><option value="BANK">{text.bank}</option></select></label><label className="text-xs font-bold text-slate-600">{text.branch}<select className={input} value={editing.data.branch || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, branch: e.target.value } })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></>}
          {editing.kind === 'pos' && <><label className="text-xs font-bold text-slate-600">{text.posCode}<input className={input} value={editing.data.code || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, code: e.target.value } })} required /></label><label className="text-xs font-bold text-slate-600">{text.branch}<select className={input} value={editing.data.branch || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, branch: e.target.value } })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="text-xs font-bold text-slate-600">{text.warehouse}<select className={input} value={editing.data.default_warehouse || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, default_warehouse: e.target.value } })}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label></>}
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!!editing.data.is_active} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, is_active: e.target.checked } })} />{text.active}</label>
          <div className="flex gap-2 pt-2"><button type="submit" disabled={busy} className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-50">{text.save}</button><button type="button" onClick={() => setEditing(null)} className="px-5 h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">{text.cancel}</button></div>
        </form>
      </div>}
    </section>
  );
}