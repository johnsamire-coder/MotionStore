// INVENTORY_V2
import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import ExportButtons from '../components/ExportButtons';
import { Search, Plus, ArrowLeftRight, X as XIcon, Trash2 } from 'lucide-react';

const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));
const num = (v) => parseFloat(v || 0) || 0;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kgf = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const GRADE = {
  ar: { NEW_COLLECTION: 'عالي', MIDDLE: 'وسط', CLEARANCE: 'تصفيات', WASTE: 'هالك' },
  en: { NEW_COLLECTION: 'High', MIDDLE: 'Medium', CLEARANCE: 'Low', WASTE: 'Waste' }
};
const TXN = {
  ar: { SORT_IN: 'دخل من الفرز', SALE: 'بيع', RETURN_IN: 'مرتجع مبيعات', TRANSFER_OUT: 'نقل صادر', TRANSFER_IN: 'نقل وارد', ADJUSTMENT_PLUS: 'تسوية بالزيادة', ADJUSTMENT_MINUS: 'تسوية بالنقص', WRITE_DOWN: 'تخفيض قيمة' },
  en: { SORT_IN: 'Sorting In', SALE: 'Sale', RETURN_IN: 'Sales Return', TRANSFER_OUT: 'Transfer Out', TRANSFER_IN: 'Transfer In', ADJUSTMENT_PLUS: 'Adjustment +', ADJUSTMENT_MINUS: 'Adjustment -', WRITE_DOWN: 'Write Down' }
};
const TXT = {
  ar: {
    title: 'المخزون', subtitle: 'أرصدة المخازن والمحلات، ونقل البضاعة بينهم، وسجل كل الحركات',
    transfer: 'نقل بضاعة', addLoc: 'إضافة مكان', vStock: 'الأرصدة', vLedger: 'سجل الحركات', vTransfers: 'أذون النقل',
    warehouses: 'المخازن', shops: 'المحلات', allWh: 'كل المخازن', allShops: 'كل المحلات', kg: 'كجم', cur: 'ج.م',
    kTotal: 'إجمالي الوزن', kCost: 'القيمة بالتكلفة', kSale: 'القيمة بسعر البيع', kLow: 'أصناف قربت تخلص (أقل من 10 كجم)',
    search: 'ابحث بالصنف أو الدرجة أو المكان...', results: 'عدد النتائج', product: 'الصنف', grade: 'الدرجة', loc: 'المكان',
    weight: 'الوزن', pcs: 'القطع', cost: 'تكلفة الكيلو', price: 'سعر البيع', value: 'القيمة', moves: 'الحركة',
    noStock: 'مفيش بضاعة هنا.', from: 'من تاريخ', to: 'إلى تاريخ', allLocs: 'كل الأماكن', type: 'نوع الحركة', allTypes: 'كل الأنواع',
    dir: 'الاتجاه', dirAll: 'الكل', dirIn: 'داخل', dirOut: 'خارج', allGrades: 'كل الدرجات', show: 'عرض', reset: 'مسح الفلاتر',
    date: 'التاريخ', change: 'التغيير', pcsChange: 'القطع', balance: 'الرصيد بعدها', doc: 'المستند',
    totalIn: 'إجمالي الداخل', totalOut: 'إجمالي الخارج', net: 'الصافي', noMoves: 'مفيش حركات بالفلاتر دي.',
    code: 'رقم الإذن', fromLoc: 'من', toLoc: 'إلى', items: 'الأصناف', totalKg: 'إجمالي الوزن', totalCost: 'قيمة التكلفة', by: 'بواسطة', noTransfers: 'مفيش أذون نقل.',
    tTitle: 'إذن نقل بضاعة', tFrom: 'من (المكان اللي طالعة منه)', tTo: 'إلى (المكان اللي رايحة له)', choose: 'اختار...',
    tItem: 'الصنف', tKg: 'الوزن (كجم)', avail: 'المتاح', addLine: '+ إضافة للإذن', tLines: 'أصناف الإذن', notes: 'ملاحظات',
    confirm: 'تأكيد النقل', cancel: 'إلغاء', saving: 'جاري الحفظ...', close: 'إغلاق',
    locTitle: 'إضافة مكان جديد', locName: 'الاسم', locKind: 'النوع', kindWh: 'مخزن', kindShop: 'محل', save: 'حفظ',
    errPick: 'اختار الصنف واكتب الوزن', errMore: 'الوزن أكبر من المتاح', errSame: 'اختار مكانين مختلفين', errLines: 'ضيف صنف واحد على الأقل',
    doneTransfer: 'تم النقل بنجاح - إذن رقم', doneLoc: 'تم إضافة المكان', doneShop: 'ونقطة البيع الخاصة بيه', failed: 'حصلت مشكلة: ',
    rStock: 'تقرير أرصدة المخزون', rLedger: 'سجل حركات المخزون', rTransfers: 'تقرير أذون النقل', period: 'الفترة'
  },
  en: {
    title: 'Inventory', subtitle: 'Warehouse & shop balances, transfers between them, and full movement history',
    transfer: 'Transfer Goods', addLoc: 'Add Location', vStock: 'Balances', vLedger: 'Movements Log', vTransfers: 'Transfers',
    warehouses: 'Warehouses', shops: 'Shops', allWh: 'All Warehouses', allShops: 'All Shops', kg: 'KG', cur: 'EGP',
    kTotal: 'Total Weight', kCost: 'Value at Cost', kSale: 'Value at Sale Price', kLow: 'Low Stock Items (< 10 KG)',
    search: 'Search by item, grade or location...', results: 'Results', product: 'Item', grade: 'Grade', loc: 'Location',
    weight: 'Weight', pcs: 'Pieces', cost: 'Cost/KG', price: 'Sale Price', value: 'Value', moves: 'History',
    noStock: 'No stock here.', from: 'From date', to: 'To date', allLocs: 'All locations', type: 'Movement type', allTypes: 'All types',
    dir: 'Direction', dirAll: 'All', dirIn: 'In', dirOut: 'Out', allGrades: 'All grades', show: 'Show', reset: 'Clear filters',
    date: 'Date', change: 'Change', pcsChange: 'Pieces', balance: 'Balance after', doc: 'Document',
    totalIn: 'Total In', totalOut: 'Total Out', net: 'Net', noMoves: 'No movements for these filters.',
    code: 'Transfer #', fromLoc: 'From', toLoc: 'To', items: 'Items', totalKg: 'Total Weight', totalCost: 'Cost Value', by: 'By', noTransfers: 'No transfers.',
    tTitle: 'Goods Transfer', tFrom: 'From (source)', tTo: 'To (destination)', choose: 'Choose...',
    tItem: 'Item', tKg: 'Weight (KG)', avail: 'Available', addLine: '+ Add to transfer', tLines: 'Transfer items', notes: 'Notes',
    confirm: 'Confirm Transfer', cancel: 'Cancel', saving: 'Saving...', close: 'Close',
    locTitle: 'Add New Location', locName: 'Name', locKind: 'Type', kindWh: 'Warehouse', kindShop: 'Shop', save: 'Save',
    errPick: 'Choose an item and enter weight', errMore: 'Weight is more than available', errSame: 'Choose two different locations', errLines: 'Add at least one item',
    doneTransfer: 'Transfer completed - #', doneLoc: 'Location added', doneShop: 'with its POS terminal', failed: 'Something went wrong: ',
    rStock: 'Inventory Balances Report', rLedger: 'Inventory Movements Log', rTransfers: 'Transfers Report', period: 'Period'
  }
};

export default function InventoryPage() {
  const { lang, isRTL } = useLanguage();
  const T = TXT[lang] || TXT.ar;
  const G = GRADE[lang] || GRADE.ar;
  const X = TXN[lang] || TXN.ar;

  const [view, setView] = useState('stock');
  const [locTab, setLocTab] = useState('wh');
  const [locId, setLocId] = useState('');
  const [q, setQ] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const emptyLF = { from: '', to: '', wh: '', type: '', dir: '', grade: '', q: '' };
  const [lf, setLf] = useState(emptyLF);
  const [ledger, setLedger] = useState([]);
  const [tfFilter, setTfFilter] = useState({ from: '', to: '', wh: '' });
  const [transfers, setTransfers] = useState([]);

  const [showT, setShowT] = useState(false);
  const [tf, setTf] = useState({ src: '', dst: '', pick: '', kg: '', lines: [], notes: '' });
  const [showLoc, setShowLoc] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', kind: 'STORE' });
  const [saving, setSaving] = useState(false);

  const whById = {};
  warehouses.forEach((w) => { whById[w.id] = w; });
  const isShop = (id) => whById[id]?.warehouse_type === 'STORE';
  const activeWh = warehouses.filter((w) => w.is_active !== false);
  const tabLocs = activeWh.filter((w) => (locTab === 'shop' ? w.warehouse_type === 'STORE' : w.warehouse_type !== 'STORE'));

  const loadBase = async () => {
    setLoading(true);
    try {
      const [wRes, sRes] = await Promise.all([axiosClient.get('/warehouses/'), axiosClient.get('/stock-items/?all=1')]);
      setWarehouses(listOf(wRes.data));
      setStock(listOf(sRes.data));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const loadLedger = async (f = lf) => {
    const p = new URLSearchParams({ all: '1' });
    if (f.from) p.append('date_from', f.from);
    if (f.to) p.append('date_to', f.to);
    if (f.wh) p.append('warehouse', f.wh);
    if (f.type) p.append('transaction_type', f.type);
    if (f.dir) p.append('direction', f.dir);
    if (f.grade) p.append('grade', f.grade);
    try { const r = await axiosClient.get(`/inventory-ledger/?${p.toString()}`); setLedger(listOf(r.data)); } catch (e) { console.error(e); }
  };
  const loadTransfers = async (f = tfFilter) => {
    const p = new URLSearchParams({ all: '1' });
    if (f.from) p.append('date_from', f.from);
    if (f.to) p.append('date_to', f.to);
    if (f.wh) p.append('warehouse', f.wh);
    try { const r = await axiosClient.get(`/transfers/?${p.toString()}`); setTransfers(listOf(r.data)); } catch (e) { console.error(e); }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (view === 'ledger') loadLedger(); if (view === 'transfers') loadTransfers(); }, [view]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  // ---------- balances ----------
  const inTab = stock.filter((s) => num(s.total_weight_kg) > 0 && (locTab === 'shop') === isShop(s.warehouse));
  const term = q.trim().toLowerCase();
  const rows = inTab.filter((s) => (!locId || s.warehouse === locId) && (!term || [s.product_name, G[s.grade], s.warehouse_name].join(' ').toLowerCase().includes(term)));
  const sumKg = (list) => list.reduce((a, s) => a + num(s.total_weight_kg), 0);
  const sumVal = (list) => list.reduce((a, s) => a + num(s.current_total_value), 0);
  const sumSale = (list) => list.reduce((a, s) => a + num(s.total_weight_kg) * num(s.retail_price), 0);

  const GRADES3 = ['NEW_COLLECTION', 'MIDDLE', 'CLEARANCE'];
  const KIND_NAME = isRTL
    ? { BALE: 'إجمالي البالات', STOCK: 'إجمالي الاستوك', DIRECT: 'إجمالي الأصناف الخاصة', OLD: 'بضاعة بدون تصنيف' }
    : { BALE: 'Total Bales', STOCK: 'Total Stock', DIRECT: 'Total Special Items', OLD: 'Unclassified Goods' };
  const summarize = (list) => {
    const g = {};
    GRADES3.forEach((k) => { g[k] = { kg: 0, pcs: 0 }; });
    let kg = 0; let pcs = 0;
    list.forEach((s) => {
      const w = num(s.total_weight_kg); const p = num(s.total_quantity_pieces);
      kg += w; pcs += p;
      if (g[s.grade]) { g[s.grade].kg += w; g[s.grade].pcs += p; }
    });
    return { kg, pcs, g };
  };
  const kindOf = (s) => (s.line_info && s.line_info.kind) || 'OLD';
  const kindGroups = ['BALE', 'STOCK', 'DIRECT', 'OLD']
    .map((k) => ({ key: k, title: KIND_NAME[k], ...summarize(rows.filter((s) => kindOf(s) === k)) }))
    .filter((x) => x.kg > 0);
  const baleTypes = Array.from(new Set(rows.filter((s) => kindOf(s) === 'BALE').map((s) => s.line_info.bale_type).filter(Boolean)));
  const typeGroups = baleTypes.map((tn) => ({
    key: 'type-' + tn,
    title: (isRTL ? 'بالات ' : 'Bales: ') + tn,
    ...summarize(rows.filter((s) => kindOf(s) === 'BALE' && s.line_info.bale_type === tn))
  }));

  const stockReport = () => ({
    title: T.rStock + ' - ' + (locId ? whById[locId]?.name : (locTab === 'shop' ? T.allShops : T.allWh)),
    filename: 'inventory-balances', filtersText: q,
    columns: [
      { key: 'product', header: T.product, width: 28 }, { key: 'grade', header: T.grade, width: 12 }, { key: 'loc', header: T.loc, width: 20 },
      { key: 'kg', header: T.weight + ' (' + T.kg + ')', type: 'number' }, { key: 'pcs', header: T.pcs, type: 'number' },
    ],
    rows: rows.map((s) => ({ product: s.product_name, grade: G[s.grade] || s.grade, loc: s.warehouse_name, kg: num(s.total_weight_kg), pcs: num(s.total_quantity_pieces), cost: num(s.avg_cost_per_kg), price: num(s.retail_price), value: num(s.current_total_value) })),
    totals: { kg: sumKg(rows), pcs: rows.reduce((a, s) => a + num(s.total_quantity_pieces), 0) }
  });

  // ---------- ledger ----------
  const lterm = lf.q.trim().toLowerCase();
  const lrows = ledger.filter((r) => !lterm || [r.product_name, r.warehouse_name, r.source_document_id, r.notes, X[r.transaction_type]].join(' ').toLowerCase().includes(lterm));
  const tIn = lrows.reduce((a, r) => a + Math.max(0, num(r.weight_change_kg)), 0);
  const tOut = lrows.reduce((a, r) => a + Math.min(0, num(r.weight_change_kg)), 0);
  const periodText = () => [lf.from && (T.from + ': ' + lf.from), lf.to && (T.to + ': ' + lf.to), lf.wh && whById[lf.wh]?.name, lf.type && X[lf.type], lf.dir && (lf.dir === 'in' ? T.dirIn : T.dirOut), lf.grade && G[lf.grade], lf.q].filter(Boolean).join(' | ');
  const ledgerReport = () => ({
    title: T.rLedger, filename: 'inventory-movements', filtersText: periodText(),
    columns: [
      { key: 'date', header: T.date, width: 17 }, { key: 'loc', header: T.loc, width: 18 }, { key: 'product', header: T.product, width: 26 },
      { key: 'grade', header: T.grade, width: 10 }, { key: 'type', header: T.type, width: 15 }, { key: 'kg', header: T.change + ' (' + T.kg + ')', type: 'number' },
      { key: 'pcs', header: T.pcsChange, type: 'number' }, { key: 'bal', header: T.balance, type: 'number' }, { key: 'doc', header: T.doc, width: 22 }
    ],
    rows: lrows.map((r) => ({ date: dt(r.created_at), loc: r.warehouse_name, product: r.product_name, grade: G[r.grade] || r.grade, type: X[r.transaction_type] || r.transaction_type, kg: num(r.weight_change_kg), pcs: num(r.quantity_change_pieces), bal: num(r.running_weight_balance), doc: r.source_document_id })),
    totals: { kg: tIn + tOut }
  });

  // ---------- transfers ----------
  const transfersReport = () => ({
    title: T.rTransfers, filename: 'transfers', filtersText: [tfFilter.from, tfFilter.to, tfFilter.wh && whById[tfFilter.wh]?.name].filter(Boolean).join(' | '),
    columns: [
      { key: 'code', header: T.code, width: 18 }, { key: 'date', header: T.date, width: 12 }, { key: 'from', header: T.fromLoc, width: 18 }, { key: 'to', header: T.toLoc, width: 18 },
      { key: 'items', header: T.items, width: 40 }, { key: 'kg', header: T.totalKg, type: 'number' }, { key: 'cost', header: T.totalCost, type: 'money' }, { key: 'by', header: T.by, width: 12 }
    ],
    rows: transfers.map((x) => ({ code: x.transfer_code, date: x.transfer_date, from: x.source_name, to: x.destination_name, items: (x.lines || []).map((l) => `${l.product_name} (${G[l.grade] || l.grade}) ${kgf(l.weight_kg)}`).join(' | '), kg: num(x.total_weight_kg), cost: num(x.total_cost_value), by: x.requested_by_name || '' })),
    totals: { kg: transfers.reduce((a, x) => a + num(x.total_weight_kg), 0), cost: transfers.reduce((a, x) => a + num(x.total_cost_value), 0) }
  });

  // ---------- transfer modal ----------
  const srcItems = stock.filter((s) => s.warehouse === tf.src && num(s.total_weight_kg) > 0);
  const inLines = (id) => tf.lines.filter((l) => l.stock_item_id === id).reduce((a, l) => a + l.kg, 0);
  const pickItem = srcItems.find((s) => s.id === tf.pick);
  const pickAvail = pickItem ? num(pickItem.total_weight_kg) - inLines(pickItem.id) : 0;
  const openTransfer = () => { setTf({ src: activeWh.find((w) => w.warehouse_type !== 'STORE')?.id || '', dst: '', pick: '', kg: '', lines: [], notes: '' }); setShowT(true); };
  const addTLine = () => {
    const kg = num(tf.kg);
    if (!pickItem || kg <= 0) { alert(T.errPick); return; }
    if (kg > pickAvail + 0.0001) { alert(T.errMore + ` (${kgf(pickAvail)} ${T.kg})`); return; }
    setTf({ ...tf, pick: '', kg: '', lines: [...tf.lines, { stock_item_id: pickItem.id, kg, label: `${pickItem.product_name} - ${G[pickItem.grade] || pickItem.grade}` }] });
  };
  const submitTransfer = async () => {
    if (!tf.src || !tf.dst || tf.src === tf.dst) { alert(T.errSame); return; }
    if (!tf.lines.length) { alert(T.errLines); return; }
    setSaving(true);
    try {
      const r = await axiosClient.post('/transfers/', { source_warehouse_id: tf.src, destination_warehouse_id: tf.dst, notes: tf.notes, items: tf.lines.map((l) => ({ stock_item_id: l.stock_item_id, weight_kg: l.kg.toFixed(3) })) });
      setShowT(false);
      flash(`${T.doneTransfer} ${r.data.transfer_code}`);
      loadBase(); if (view === 'ledger') loadLedger(); if (view === 'transfers') loadTransfers();
    } catch (e) { alert(T.failed + (e.response?.data?.detail || e.message)); } finally { setSaving(false); }
  };
  const submitLoc = async () => {
    if (!locForm.name.trim()) return;
    setSaving(true);
    try {
      const r = await axiosClient.post('/warehouses/add_location/', { name: locForm.name.trim(), kind: locForm.kind });
      setShowLoc(false); setLocForm({ name: '', kind: 'STORE' });
      flash(r.data.terminal ? `${T.doneLoc} ${T.doneShop} (${r.data.terminal})` : T.doneLoc);
      setLocTab(locForm.kind === 'STORE' ? 'shop' : 'wh');
      loadBase();
    } catch (e) { alert(T.failed + (e.response?.data?.detail || e.message)); } finally { setSaving(false); }
  };

  const Tab = ({ active, onClick, children }) => (
    <button type="button" onClick={onClick} className={`h-10 px-5 rounded-lg text-sm font-bold border transition cursor-pointer ${active ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'}`}>{children}</button>
  );
  const inputCls = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500';
  const searchBox = (value, onChange, ph) => (
    <div className="relative flex-1 min-w-[220px]">
      <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 12 } : { left: 12 }} />
      <input type="text" value={value} onChange={onChange} placeholder={ph} className={inputCls + ' w-full'} style={isRTL ? { paddingRight: 36 } : { paddingLeft: 36 }} />
    </div>
  );

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">...</div>;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800">{T.title}</h1>
          <p className="text-xs text-slate-500 mt-1">{T.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowLoc(true)} className="h-10 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Plus size={14} /> {T.addLoc}</button>
          <button type="button" onClick={openTransfer} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"><ArrowLeftRight size={14} /> {T.transfer}</button>
        </div>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold">{msg}</div>}

      <div className="flex flex-wrap gap-2">
        <Tab active={view === 'stock'} onClick={() => setView('stock')}>{T.vStock}</Tab>
        <Tab active={view === 'ledger'} onClick={() => setView('ledger')}>{T.vLedger}</Tab>
        <Tab active={view === 'transfers'} onClick={() => setView('transfers')}>{T.vTransfers}</Tab>
      </div>

      {view === 'stock' && (
        <>
          <div className="flex gap-2">
            <Tab active={locTab === 'wh'} onClick={() => { setLocTab('wh'); setLocId(''); }}>{T.warehouses}</Tab>
            <Tab active={locTab === 'shop'} onClick={() => { setLocTab('shop'); setLocId(''); }}>{T.shops}</Tab>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ id: '', name: locTab === 'shop' ? T.allShops : T.allWh, list: inTab }, ...tabLocs.map((w) => ({ id: w.id, name: w.name, list: inTab.filter((s) => s.warehouse === w.id) }))].map((c) => (
              <button key={c.id || 'all'} type="button" onClick={() => setLocId(c.id)} className={`text-start p-3 rounded-xl border cursor-pointer transition ${locId === c.id ? 'border-emerald-600 bg-emerald-50 border-2' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                <div className="text-sm font-bold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-600 mt-1">{kgf(sumKg(c.list))} {T.kg}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.kTotal}</div><div className="text-xl font-black mt-1">{kgf(sumKg(rows))} <span className="text-xs text-slate-500">{T.kg}</span></div></div>
            <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500 font-bold">{T.kLow}</div><div className="text-xl font-black mt-1 text-amber-700">{rows.filter((s) => num(s.total_weight_kg) < 10).length}</div></div>
          </div>
          {kindGroups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {[...kindGroups.map((g) => ({ ...g, main: true })), ...typeGroups].map((grp, i) => (
                <div key={grp.key + '-' + i} className={`bg-white p-4 rounded-xl border ${grp.main ? 'border-emerald-300' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-black ${grp.main ? 'text-emerald-900' : 'text-slate-900'}`}>{grp.title}</div>
                    <div className="text-xs font-bold text-slate-600 whitespace-nowrap">{kgf(grp.kg)} {T.kg} · {kgf(grp.pcs)} {T.pcs}</div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {GRADES3.map((gk) => (
                      <div key={gk} className="flex items-center justify-between text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold">{G[gk]}</span>
                        <span className="text-slate-700">{kgf(grp.g[gk].kg)} {T.kg} · {kgf(grp.g[gk].pcs)} {T.pcs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {searchBox(q, (e) => setQ(e.target.value), T.search)}
              <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{T.results}: {rows.length}</div>
              <ExportButtons getReport={stockReport} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 text-start">{T.product}</th><th className="p-2 text-start">{T.grade}</th><th className="p-2 text-start">{T.loc}</th>
                  <th className="p-2 text-center">{T.weight}</th><th className="p-2 text-center">{T.pcs}</th>
                  <th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">{T.noStock}</td></tr>}
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{s.product_name}</td>
                      <td className="p-2"><span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold">{G[s.grade] || s.grade}</span></td>
                      <td className="p-2">{s.warehouse_name}</td>
                      <td className="p-2 text-center font-bold">{kgf(s.total_weight_kg)} {T.kg}</td>
                      <td className="p-2 text-center">{s.total_quantity_pieces}</td>
                      <td className="p-2"><button type="button" onClick={() => { const f = { ...emptyLF, wh: s.warehouse, q: s.product_name }; setLf(f); setView('ledger'); }} className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer hover:bg-slate-100">{T.moves}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'ledger' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={lf.from} onChange={(e) => setLf({ ...lf, from: e.target.value })} className={inputCls + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={lf.to} onChange={(e) => setLf({ ...lf, to: e.target.value })} className={inputCls + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.loc}<select value={lf.wh} onChange={(e) => setLf({ ...lf, wh: e.target.value })} className={inputCls + ' w-full'}><option value="">{T.allLocs}</option>{activeWh.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.type}<select value={lf.type} onChange={(e) => setLf({ ...lf, type: e.target.value })} className={inputCls + ' w-full'}><option value="">{T.allTypes}</option>{Object.keys(X).map((k) => <option key={k} value={k}>{X[k]}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.dir}<select value={lf.dir} onChange={(e) => setLf({ ...lf, dir: e.target.value })} className={inputCls + ' w-full'}><option value="">{T.dirAll}</option><option value="in">{T.dirIn}</option><option value="out">{T.dirOut}</option></select></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.grade}<select value={lf.grade} onChange={(e) => setLf({ ...lf, grade: e.target.value })} className={inputCls + ' w-full'}><option value="">{T.allGrades}</option>{Object.keys(G).map((k) => <option key={k} value={k}>{G[k]}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {searchBox(lf.q, (e) => setLf({ ...lf, q: e.target.value }), T.search)}
            <button type="button" onClick={() => loadLedger()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
            <button type="button" onClick={() => { setLf(emptyLF); loadLedger(emptyLF); }} className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-xs font-bold cursor-pointer">{T.reset}</button>
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{T.results}: {lrows.length}</div>
            <ExportButtons getReport={ledgerReport} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-800">{T.totalIn}: +{kgf(tIn)} {T.kg}</div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm font-bold text-rose-800">{T.totalOut}: {kgf(tOut)} {T.kg}</div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800">{T.net}: {kgf(tIn + tOut)} {T.kg}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-100 text-slate-700">
                <th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.loc}</th><th className="p-2 text-start">{T.product}</th><th className="p-2 text-start">{T.grade}</th>
                <th className="p-2 text-start">{T.type}</th><th className="p-2 text-center">{T.change}</th><th className="p-2 text-center">{T.pcsChange}</th><th className="p-2 text-center">{T.balance}</th><th className="p-2 text-start">{T.doc}</th>
              </tr></thead>
              <tbody>
                {lrows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-slate-500">{T.noMoves}</td></tr>}
                {lrows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 font-mono whitespace-nowrap">{dt(r.created_at)}</td>
                    <td className="p-2">{r.warehouse_name}</td>
                    <td className="p-2 font-bold">{r.product_name}</td>
                    <td className="p-2">{G[r.grade] || r.grade}</td>
                    <td className="p-2">{X[r.transaction_type] || r.transaction_type}</td>
                    <td className={`p-2 text-center font-bold ${num(r.weight_change_kg) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{num(r.weight_change_kg) > 0 ? '+' : ''}{kgf(r.weight_change_kg)}</td>
                    <td className="p-2 text-center">{r.quantity_change_pieces}</td>
                    <td className="p-2 text-center">{kgf(r.running_weight_balance)}</td>
                    <td className="p-2 font-mono">{r.source_document_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'transfers' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.from}<input type="date" value={tfFilter.from} onChange={(e) => setTfFilter({ ...tfFilter, from: e.target.value })} className={inputCls + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.to}<input type="date" value={tfFilter.to} onChange={(e) => setTfFilter({ ...tfFilter, to: e.target.value })} className={inputCls + ' w-full'} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.loc}<select value={tfFilter.wh} onChange={(e) => setTfFilter({ ...tfFilter, wh: e.target.value })} className={inputCls + ' w-full'}><option value="">{T.allLocs}</option>{activeWh.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <button type="button" onClick={() => loadTransfers()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.show}</button>
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{T.results}: {transfers.length}</div>
            <ExportButtons getReport={transfersReport} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-100 text-slate-700">
                <th className="p-2 text-start">{T.code}</th><th className="p-2 text-start">{T.date}</th><th className="p-2 text-start">{T.fromLoc}</th><th className="p-2 text-start">{T.toLoc}</th>
                <th className="p-2 text-start">{T.items}</th><th className="p-2 text-center">{T.totalKg}</th><th className="p-2 text-center">{T.totalCost}</th><th className="p-2 text-start">{T.by}</th>
              </tr></thead>
              <tbody>
                {transfers.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-500">{T.noTransfers}</td></tr>}
                {transfers.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100">
                    <td className="p-2 font-mono font-bold">{x.transfer_code}</td>
                    <td className="p-2">{x.transfer_date}</td>
                    <td className="p-2">{x.source_name}</td>
                    <td className="p-2">{x.destination_name}</td>
                    <td className="p-2">{(x.lines || []).map((l) => `${l.product_name} (${G[l.grade] || l.grade}) ${kgf(l.weight_kg)} ${T.kg}`).join(' | ')}</td>
                    <td className="p-2 text-center font-bold">{kgf(x.total_weight_kg)}</td>
                    <td className="p-2 text-center">{money(x.total_cost_value)}</td>
                    <td className="p-2">{x.requested_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showT && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">{T.tTitle}</div>
              <button type="button" onClick={() => setShowT(false)} aria-label={T.close} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><XIcon size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.tFrom}
                <select value={tf.src} onChange={(e) => setTf({ ...tf, src: e.target.value, pick: '', lines: [] })} className={inputCls + ' w-full'}>
                  <option value="">{T.choose}</option>{activeWh.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.tTo}
                <select value={tf.dst} onChange={(e) => setTf({ ...tf, dst: e.target.value })} className={inputCls + ' w-full'}>
                  <option value="">{T.choose}</option>{activeWh.filter((w) => w.id !== tf.src).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50 border border-slate-200 rounded-xl p-3">
              <label className="text-xs font-bold text-slate-600 space-y-1 block md:col-span-2">{T.tItem}
                <select value={tf.pick} onChange={(e) => setTf({ ...tf, pick: e.target.value })} className={inputCls + ' w-full'}>
                  <option value="">{T.choose}</option>
                  {srcItems.map((s) => <option key={s.id} value={s.id}>{s.product_name} - {G[s.grade] || s.grade} ({kgf(num(s.total_weight_kg) - inLines(s.id))} {T.kg})</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.tKg}
                <input type="number" min="0" step="0.001" value={tf.kg} onChange={(e) => setTf({ ...tf, kg: e.target.value })} className={inputCls + ' w-full'} />
              </label>
              <div className="text-xs text-slate-600 md:col-span-2">{pickItem ? `${T.avail}: ${kgf(pickAvail)} ${T.kg}` : ''}</div>
              <button type="button" onClick={addTLine} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">{T.addLine}</button>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">{T.tLines}</div>
              {tf.lines.length === 0 && <div className="text-xs text-slate-500">—</div>}
              {tf.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-bold">{l.label}</span>
                  <span className="flex items-center gap-3"><span>{kgf(l.kg)} {T.kg}</span>
                    <button type="button" onClick={() => setTf({ ...tf, lines: tf.lines.filter((_, j) => j !== i) })} className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"><Trash2 size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.notes}
              <input value={tf.notes} onChange={(e) => setTf({ ...tf, notes: e.target.value })} className={inputCls + ' w-full'} />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowT(false)} className="h-10 px-5 rounded-lg border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={saving} onClick={submitTransfer} className="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold cursor-pointer">{saving ? T.saving : T.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {showLoc && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">{T.locTitle}</div>
              <button type="button" onClick={() => setShowLoc(false)} aria-label={T.close} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"><XIcon size={18} /></button>
            </div>
            <label className="text-xs font-bold text-slate-600 space-y-1 block">{T.locName}
              <input autoFocus value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} className={inputCls + ' w-full'} />
            </label>
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-600">{T.locKind}</div>
              <div className="flex gap-2">
                <Tab active={locForm.kind === 'STORE'} onClick={() => setLocForm({ ...locForm, kind: 'STORE' })}>{T.kindShop}</Tab>
                <Tab active={locForm.kind === 'MAIN'} onClick={() => setLocForm({ ...locForm, kind: 'MAIN' })}>{T.kindWh}</Tab>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowLoc(false)} className="h-10 px-5 rounded-lg border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
              <button type="button" disabled={saving || !locForm.name.trim()} onClick={submitLoc} className="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold cursor-pointer">{saving ? T.saving : T.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}