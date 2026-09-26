import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { X, Trash2, Users, Save } from 'lucide-react';

const BALE_GRADES = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة'];
const STOCK_GRADES = ['ستوك بيور', 'ستوك ديفوه'];
const OPTION_TYPES = ['BALE_TYPE', 'SEGMENT', 'BRAND', 'SPECIAL_ITEM'];
const GRADE_EN = {
  'سوبر كريم': 'Super Cream', 'كريم': 'Cream', 'كريم في واحد': 'Cream in One',
  'نمرة 1': 'No. 1', 'نمرة 2': 'No. 2', 'سحبة': 'Sahba',
  'ستوك بيور': 'Pure Stock', 'ستوك ديفوه': 'Defect Stock'
};

const TXT = {
  ar: {
    title: 'فاتورة شراء جديدة', subtitle: 'كل السطور بتروح الفرز بعد الحفظ', close: 'إغلاق',
    suppliersCard: 'كارت الموردين', supplierUnit: 'مورد', showNames: 'عرض الأسماء', hideNames: 'إخفاء الأسماء', noSuppliers: 'مفيش موردين لسه',
    tab1: '1 · بالة / استوك', tab2: '2 · الشراء المباشر', purchaseType: 'نوع الشراء',
    bale: 'بالة', stock: 'استوك', direct: 'شراء مباشر', itemHeader: 'البند', specialItems: 'أصناف خاصة',
    supplier: 'اسم المورد', supplierOptional: 'اسم المورد (اختياري)', newSupplier: '+ مورد جديد',
    baleType: 'نوع البالة', addType: 'إضافة نوع', newTypePh: 'اكتب النوع الجديد',
    grade: 'الدرجة', stockType: 'نوع الاستوك', brand: 'البراند', addBrand: 'إضافة براند', newBrandPh: 'اكتب اسم البراند',
    itemName: 'اسم البند / الصنف', addItem: 'إضافة بند جديد', newItemPh: 'اكتب اسم البند',
    desc: 'الوصف', descPh: 'وصف البند', brandOptional: 'البراند (اختياري)', brandOptionalPh: 'اسم البراند لو فيه',
    weight: 'الوزن (كجم)', price: 'سعر الكيلو (ج.م)', lineTotal: 'الإجمالي (الوزن × السعر)',
    segment: 'الصنف', addSegment: 'إضافة صنف', newSegmentPh: 'اكتب الصنف الجديد',
    addLine: '+ إضافة السطر للفاتورة', lines: 'سطور الفاتورة',
    colKind: 'النوع', colDetails: 'التفاصيل', colWeight: 'الوزن', colPrice: 'سعر الكيلو', colTotal: 'الإجمالي', colFreight: 'نصيب الشحن', colLanded: 'الكيلو بعد الشحن',
    noLines: 'لسه مفيش سطور — املى البيانات فوق ودوس "إضافة السطر للفاتورة".',
    kg: 'كجم', cur: 'ج.م', warehouse: 'المخزن المستلم', freight: 'مصاريف النقل (ج.م)',
    itemsLabel: 'الأصناف', freightLabel: 'النقل', invoiceTotal: 'إجمالي الفاتورة',
    cancel: 'إلغاء', save: 'حفظ فاتورة الشراء', saving: 'جاري الحفظ...', saveOpt: 'حفظ', deleteLine: 'حذف السطر',
    errLoadOpts: 'تعذر تحميل اختيارات المشتريات', errSaveOpt: 'تعذر حفظ الاختيار الجديد', errWeightPrice: 'اكتب الوزن وسعر الكيلو',
    errBale: 'اختار نوع البالة والصنف', errBrand: 'اختار البراند', errItem: 'اختار اسم البند أو ضيف بند جديد',
    errNoLines: 'ضيف سطر واحد على الأقل', errWarehouse: 'اختار المخزن المستلم', errSupplier: 'اختار المورد (مطلوب للبالة والاستوك)',
    errSave: 'فشل حفظ فاتورة الشراء: '
  },
  en: {
    title: 'New Purchase Invoice', subtitle: 'All lines go to Sorting after saving', close: 'Close',
    suppliersCard: 'Suppliers Card', supplierUnit: 'suppliers', showNames: 'Show names', hideNames: 'Hide names', noSuppliers: 'No suppliers yet',
    tab1: '1 · Bale / Stock', tab2: '2 · Direct Purchase', purchaseType: 'Purchase Type',
    bale: 'Bale', stock: 'Stock', direct: 'Direct Purchase', itemHeader: 'Item Group', specialItems: 'Special Items',
    supplier: 'Supplier', supplierOptional: 'Supplier (optional)', newSupplier: '+ New Supplier',
    baleType: 'Bale Type', addType: 'Add Type', newTypePh: 'Type the new type',
    grade: 'Grade', stockType: 'Stock Type', brand: 'Brand', addBrand: 'Add Brand', newBrandPh: 'Type the brand name',
    itemName: 'Item Name', addItem: 'Add New Item', newItemPh: 'Type the item name',
    desc: 'Description', descPh: 'Item description', brandOptional: 'Brand (optional)', brandOptionalPh: 'Brand name if any',
    weight: 'Weight (KG)', price: 'Price per KG (EGP)', lineTotal: 'Total (Weight × Price)',
    segment: 'Category', addSegment: 'Add Category', newSegmentPh: 'Type the new category',
    addLine: '+ Add Line to Invoice', lines: 'Invoice Lines',
    colKind: 'Type', colDetails: 'Details', colWeight: 'Weight', colPrice: 'Price/KG', colTotal: 'Total', colFreight: 'Freight Share', colLanded: 'Cost/KG after Freight',
    noLines: 'No lines yet — fill in the data above and press "Add Line to Invoice".',
    kg: 'KG', cur: 'EGP', warehouse: 'Receiving Warehouse', freight: 'Freight Cost (EGP)',
    itemsLabel: 'Items', freightLabel: 'Freight', invoiceTotal: 'Invoice Total',
    cancel: 'Cancel', save: 'Save Purchase Invoice', saving: 'Saving...', saveOpt: 'Save', deleteLine: 'Delete line',
    errLoadOpts: 'Could not load purchase options', errSaveOpt: 'Could not save the new option', errWeightPrice: 'Enter weight and price per KG',
    errBale: 'Choose bale type and category', errBrand: 'Choose the brand', errItem: 'Choose an item or add a new one',
    errNoLines: 'Add at least one line', errWarehouse: 'Choose the receiving warehouse', errSupplier: 'Choose the supplier (required for bale and stock)',
    errSave: 'Failed to save purchase invoice: '
  }
};

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const listOf = (d) => (Array.isArray(d) ? d : (d?.results || []));

function Chip({ active, onClick, children, big }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${big ? 'h-9 text-sm' : 'h-8 text-xs'} px-3 rounded-lg border font-bold transition cursor-pointer ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-400'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-bold text-slate-700">{label}</div>
      {children}
    </div>
  );
}

export default function PurchaseInvoiceForm({ suppliers = [], warehouses = [], onClose, onSaved, onAddSupplier }) {
  const { lang, isRTL } = useLanguage();
  const T = TXT[lang] || TXT.ar;
  const gl = (g) => (lang === 'ar' ? g : (GRADE_EN[g] || g));

  const [tab, setTab] = useState('PURCHASE');
  const [kind, setKind] = useState('BALE');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supOpen, setSupOpen] = useState(false);
  const [options, setOptions] = useState({ BALE_TYPE: [], SEGMENT: [], BRAND: [], SPECIAL_ITEM: [] });
  const [baleType, setBaleType] = useState('');
  const [grade, setGrade] = useState(BALE_GRADES[0]);
  const [segment, setSegment] = useState('');
  const [stockType, setStockType] = useState('ONE_BRAND');
  const [brand, setBrand] = useState('');
  const [stockGrade, setStockGrade] = useState(STOCK_GRADES[0]);
  const [itemName, setItemName] = useState('');
  const [extraDesc, setExtraDesc] = useState('');
  const [directBrand, setDirectBrand] = useState('');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState([]);
  const [adding, setAdding] = useState(null);
  const [addText, setAddText] = useState('');
  const [saving, setSaving] = useState(false);

  const activeSuppliers = suppliers.filter((s) => s.is_active !== false);

  useEffect(() => {
    if (!warehouseId && warehouses.length) {
      const sorting = warehouses.find((w) => w.warehouse_type === 'SORTING');
      setWarehouseId((sorting || warehouses[0]).id);
    }
  }, [warehouses]);

  const loadOptions = async () => {
    try {
      const res = await Promise.all(OPTION_TYPES.map((t) => axiosClient.get(`/purchase-options/?option_type=${t}`)));
      const next = {};
      OPTION_TYPES.forEach((t, i) => { next[t] = listOf(res[i].data).map((o) => o.name); });
      setOptions(next);
      setBaleType((prev) => prev || next.BALE_TYPE[0] || '');
      setSegment((prev) => prev || next.SEGMENT[0] || '');
      setBrand((prev) => prev || next.BRAND[0] || '');
    } catch (e) {
      alert(T.errLoadOpts);
    }
  };

  useEffect(() => { loadOptions(); }, []);

  const saveOption = async () => {
    const name = addText.trim();
    if (!name || !adding) return;
    try {
      const res = await axiosClient.post('/purchase-options/', { option_type: adding, name });
      const saved = res.data?.name || name;
      setOptions((prev) => ({ ...prev, [adding]: prev[adding].includes(saved) ? prev[adding] : [...prev[adding], saved] }));
      if (adding === 'BALE_TYPE') setBaleType(saved);
      if (adding === 'SEGMENT') setSegment(saved);
      if (adding === 'BRAND') setBrand(saved);
      if (adding === 'SPECIAL_ITEM') setItemName(saved);
      setAdding(null);
      setAddText('');
    } catch (e) {
      alert(T.errSaveOpt);
    }
  };

  const renderAdd = (type, label, placeholder) => (
    <>
      <button
        type="button"
        onClick={() => { setAdding(type); setAddText(''); }}
        className="h-8 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer"
      >
        + {label}
      </button>
      {adding === type && (
        <div className="w-full flex gap-2 items-center">
          <input
            autoFocus
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveOption(); } }}
            placeholder={placeholder}
            className="h-9 w-64 px-3 border border-emerald-600 rounded-lg bg-white text-sm"
          />
          <button type="button" onClick={saveOption} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">{T.saveOpt}</button>
          <button type="button" onClick={() => { setAdding(null); setAddText(''); }} className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm cursor-pointer">{T.cancel}</button>
        </div>
      )}
    </>
  );

  const w = parseFloat(weight) || 0;
  const p = parseFloat(price) || 0;
  const lineTotal = w * p;
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const freightNum = parseFloat(freight) || 0;
  const shareOf = (l) => (subtotal > 0 ? (freightNum * l.total) / subtotal : 0);
  const currentKind = tab === 'DIRECT' ? 'DIRECT' : kind;
  const kindLabel = { BALE: T.bale, STOCK: T.stock, DIRECT: T.direct };

  const describe = (l) => {
    if (l.purchase_kind === 'BALE') return `${l.bale_type} - ${gl(l.grade)} - ${l.segment}`;
    if (l.purchase_kind === 'STOCK') return `${l.stock_type === 'ONE_BRAND' ? l.brand : 'Mix Brand'} - ${gl(l.grade)}`;
    const parts = [`${T.specialItems}: ${l.item_name}`];
    if (l.extra_description) parts.push(l.extra_description);
    if (l.brand) parts.push(l.brand);
    return parts.join(' - ');
  };

  const addLine = () => {
    if (w <= 0 || p <= 0) { alert(T.errWeightPrice); return; }
    let line;
    if (currentKind === 'BALE') {
      if (!baleType || !segment) { alert(T.errBale); return; }
      line = { purchase_kind: 'BALE', bale_type: baleType, grade, segment, description: `بالة ${baleType} - ${grade} - ${segment}` };
    } else if (currentKind === 'STOCK') {
      if (stockType === 'ONE_BRAND' && !brand) { alert(T.errBrand); return; }
      const b = stockType === 'ONE_BRAND' ? brand : '';
      line = { purchase_kind: 'STOCK', stock_type: stockType, brand: b, grade: stockGrade, description: `استوك ${stockType === 'ONE_BRAND' ? b : 'Mix Brand'} - ${stockGrade}` };
    } else {
      if (!itemName) { alert(T.errItem); return; }
      const parts = [`أصناف خاصة: ${itemName}`];
      if (extraDesc) parts.push(extraDesc);
      if (directBrand) parts.push(directBrand);
      line = { purchase_kind: 'DIRECT', item_name: itemName, extra_description: extraDesc, brand: directBrand, description: parts.join(' - ') };
    }
    line.description = line.description.slice(0, 250);
    setLines((prev) => [...prev, { ...line, weight_kg: w, unit_price: p, total: lineTotal, key: `${Date.now()}-${Math.random()}` }]);
    setWeight('');
  };

  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const handleSave = async () => {
    if (!lines.length) { alert(T.errNoLines); return; }
    if (!warehouseId) { alert(T.errWarehouse); return; }
    const needsSupplier = lines.some((l) => l.purchase_kind !== 'DIRECT');
    if (needsSupplier && !supplierId) { alert(T.errSupplier); return; }
    setSaving(true);
    try {
      await axiosClient.post('/purchases/', {
        supplier_id: supplierId || null,
        warehouse_id: warehouseId,
        freight_cost: freightNum.toFixed(2),
        items: lines.map((l) => ({
          product_id: null,
          category_id: null,
          quantity: 1,
          purchase_kind: l.purchase_kind,
          bale_type: l.bale_type || null,
          grade: l.grade || null,
          segment: l.segment || null,
          stock_type: l.stock_type || null,
          brand: l.brand || null,
          item_name: l.item_name || null,
          extra_description: l.extra_description || null,
          description: l.description,
          weight_kg: l.weight_kg.toFixed(3),
          unit_price: l.unit_price.toFixed(2)
        }))
      });
      if (onSaved) onSaved();
    } catch (e) {
      alert(T.errSave + (e.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-slate-50 rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-slate-900">{T.title}</div>
            <div className="text-xs text-slate-500">{T.subtitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={T.close} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <button type="button" onClick={() => setSupOpen(!supOpen)} className="w-full flex items-center justify-between min-h-9 cursor-pointer">
              <span className="flex items-center gap-2">
                <Users size={18} className="text-emerald-700" />
                <span className="text-sm font-bold">{T.suppliersCard}</span>
                <span className="text-xs bg-emerald-50 text-emerald-800 rounded-full px-2 py-0.5 font-bold">{activeSuppliers.length} {T.supplierUnit}</span>
              </span>
              <span className="text-xs font-bold text-emerald-700">{supOpen ? T.hideNames : T.showNames}</span>
            </button>
            {supOpen && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                {activeSuppliers.length === 0 && <div className="text-xs text-slate-500">{T.noSuppliers}</div>}
                {activeSuppliers.map((s) => (
                  <div key={s.id} className="h-8 flex items-center px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium">{s.name}</div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip big active={tab === 'PURCHASE'} onClick={() => setTab('PURCHASE')}>{T.tab1}</Chip>
            <Chip big active={tab === 'DIRECT'} onClick={() => setTab('DIRECT')}>{T.tab2}</Chip>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            {tab === 'PURCHASE' && (
              <Field label={T.purchaseType}>
                <div className="flex gap-2">
                  <Chip big active={kind === 'BALE'} onClick={() => setKind('BALE')}>{T.bale}</Chip>
                  <Chip big active={kind === 'STOCK'} onClick={() => setKind('STOCK')}>{T.stock}</Chip>
                </div>
              </Field>
            )}

            {tab === 'DIRECT' && (
              <Field label={T.itemHeader}>
                <div className="inline-flex h-8 items-center px-3 rounded-lg bg-slate-900 text-white text-xs font-bold">{T.specialItems}</div>
              </Field>
            )}

            <Field label={tab === 'DIRECT' ? T.supplierOptional : T.supplier}>
              <div className="flex flex-wrap gap-2 items-center">
                {activeSuppliers.map((s) => (
                  <Chip key={s.id} active={supplierId === s.id} onClick={() => setSupplierId(supplierId === s.id ? '' : s.id)}>{s.name}</Chip>
                ))}
                {onAddSupplier && (
                  <button type="button" onClick={onAddSupplier} className="h-8 px-3 rounded-lg border border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer">{T.newSupplier}</button>
                )}
              </div>
            </Field>

            {currentKind === 'BALE' && (
              <>
                <Field label={T.baleType}>
                  <div className="flex flex-wrap gap-2 items-center">
                    {options.BALE_TYPE.map((o) => <Chip key={o} active={baleType === o} onClick={() => setBaleType(o)}>{o}</Chip>)}
                    {renderAdd('BALE_TYPE', T.addType, T.newTypePh)}
                  </div>
                </Field>
                <Field label={T.grade}>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {BALE_GRADES.map((g) => <Chip key={g} active={grade === g} onClick={() => setGrade(g)}>{gl(g)}</Chip>)}
                  </div>
                </Field>
              </>
            )}

            {currentKind === 'STOCK' && (
              <>
                <Field label={T.stockType}>
                  <div className="flex gap-2">
                    <Chip active={stockType === 'ONE_BRAND'} onClick={() => setStockType('ONE_BRAND')}>One Brand</Chip>
                    <Chip active={stockType === 'MIX_BRAND'} onClick={() => setStockType('MIX_BRAND')}>Mix Brand</Chip>
                  </div>
                </Field>
                {stockType === 'ONE_BRAND' && (
                  <Field label={T.brand}>
                    <div className="flex flex-wrap gap-2 items-center">
                      {options.BRAND.map((o) => <Chip key={o} active={brand === o} onClick={() => setBrand(o)}>{o}</Chip>)}
                      {renderAdd('BRAND', T.addBrand, T.newBrandPh)}
                    </div>
                  </Field>
                )}
                <Field label={T.grade}>
                  <div className="flex gap-2">
                    {STOCK_GRADES.map((g) => <Chip key={g} active={stockGrade === g} onClick={() => setStockGrade(g)}>{gl(g)}</Chip>)}
                  </div>
                </Field>
              </>
            )}

            {currentKind === 'DIRECT' && (
              <>
                <Field label={T.itemName}>
                  <div className="flex flex-wrap gap-2 items-center">
                    {options.SPECIAL_ITEM.map((o) => <Chip key={o} active={itemName === o} onClick={() => setItemName(o)}>{o}</Chip>)}
                    {renderAdd('SPECIAL_ITEM', T.addItem, T.newItemPh)}
                  </div>
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={T.desc}>
                    <input value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} placeholder={T.descPh} className="h-9 w-full px-3 border border-slate-300 rounded-lg bg-white text-sm" />
                  </Field>
                  <Field label={T.brandOptional}>
                    <input value={directBrand} onChange={(e) => setDirectBrand(e.target.value)} placeholder={T.brandOptionalPh} className="h-9 w-full px-3 border border-slate-300 rounded-lg bg-white text-sm" />
                  </Field>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <Field label={T.weight}>
                <input type="number" min="0" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" className="h-10 w-full px-3 border border-slate-300 rounded-lg bg-white text-base font-bold" />
              </Field>
              <Field label={T.price}>
                <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="h-10 w-full px-3 border border-slate-300 rounded-lg bg-white text-base font-bold" />
              </Field>
              <Field label={T.lineTotal}>
                <div className="h-10 flex items-center px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-base font-bold">{fmt(lineTotal)} {T.cur}</div>
              </Field>
            </div>

            {currentKind === 'BALE' && (
              <Field label={T.segment}>
                <div className="flex flex-wrap gap-2 items-center">
                  {options.SEGMENT.map((o) => <Chip key={o} active={segment === o} onClick={() => setSegment(o)}>{o}</Chip>)}
                  {renderAdd('SEGMENT', T.addSegment, T.newSegmentPh)}
                </div>
              </Field>
            )}

            <button type="button" onClick={addLine} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-800">{T.addLine}</button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="text-sm font-bold">{T.lines}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="p-2 text-start">{T.colKind}</th>
                    <th className="p-2 text-start">{T.colDetails}</th>
                    <th className="p-2 text-start">{T.colWeight}</th>
                    <th className="p-2 text-start">{T.colPrice}</th>
                    <th className="p-2 text-start">{T.colTotal}</th>
                    <th className="p-2 text-start">{T.colFreight}</th>
                    <th className="p-2 text-start">{T.colLanded}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr><td colSpan={8} className="p-3 text-slate-500">{T.noLines}</td></tr>
                  )}
                  {lines.map((l) => (
                    <tr key={l.key} className="border-b border-slate-100">
                      <td className="p-2 font-bold">{kindLabel[l.purchase_kind]}</td>
                      <td className="p-2">{describe(l)}</td>
                      <td className="p-2">{l.weight_kg.toFixed(3)} {T.kg}</td>
                      <td className="p-2">{fmt(l.unit_price)}</td>
                      <td className="p-2 font-bold text-emerald-800">{fmt(l.total)}</td>
                      <td className="p-2 text-rose-700">{fmt(shareOf(l))}</td>
                      <td className="p-2 font-bold">{fmt((l.total + shareOf(l)) / l.weight_kg)}</td>
                      <td className="p-2">
                        <button type="button" onClick={() => removeLine(l.key)} aria-label={T.deleteLine} className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-center cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Field label={T.warehouse}>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-9 w-full px-3 border border-slate-300 rounded-lg bg-white text-sm">
                {warehouses.map((wh) => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            </Field>
            <Field label={T.freight}>
              <input type="number" min="0" step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} className="h-9 w-full px-3 border border-slate-300 rounded-lg bg-white text-sm" />
            </Field>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">{T.itemsLabel}: {fmt(subtotal)} + {T.freightLabel}: {fmt(freightNum)}</div>
              <div className="text-base font-bold">{T.invoiceTotal}: <span className="text-emerald-800">{fmt(subtotal + freightNum)} {T.cur}</span></div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-slate-300 bg-white text-sm font-bold cursor-pointer">{T.cancel}</button>
            <button type="button" disabled={saving} onClick={handleSave} className="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
              <Save size={16} /> {saving ? T.saving : T.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}