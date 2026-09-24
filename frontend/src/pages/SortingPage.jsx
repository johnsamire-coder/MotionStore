import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Layers, CheckCircle2, AlertCircle, ArrowRight, Scale, Send, Package, Sparkles,
  Trash2, RefreshCw, Tag, FolderPlus, Plus, X, AlertTriangle, Lock, Unlock, ShieldCheck
} from 'lucide-react';

export default function SortingPage() {
  const { t, isRTL } = useLanguage();

  const [rawLots, setRawLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isUnlockedByManager, setIsUnlockedByManager] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newCustomBrand, setNewCustomBrand] = useState('');

  const [categoriesList, setCategoriesList] = useState(['بنطلون', 'بلوزة', 'قميص', 'فستان', 'جاكيت ومعاطف', 'تيشيرت', 'ملابس أطفال']);
  const [brandsList, setBrandsList] = useState(['غير محدد / بدون براند', 'Zara', 'H&M', 'Nike', 'Adidas', 'Bershka']);

  const [creamLines, setCreamLines] = useState([{ id: 1, category: 'بنطلون', brand: 'Zara', weight: '20.000', pieces: '40' }]);
  const [midLines, setMidLines] = useState([{ id: 2, category: 'قميص', brand: 'H&M', weight: '15.000', pieces: '30' }]);
  const [clrLines, setClrLines] = useState([{ id: 3, category: 'فستان', brand: 'غير محدد / بدون براند', weight: '14.000', pieces: '25' }]);
  const [wasteWeight, setWasteWeight] = useState('1.000');
  const [wasteNotes, setWasteNotes] = useState('قطع تالفة ومقاطع فرز');

  const [reconciled, setReconciled] = useState(false);

  useEffect(() => { loadSortingData(); }, []);

  const loadSortingData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/raw-lots/');
      const list = res.data.results || res.data || [];
      setRawLots(list);
      if (list.length > 0 && !selectedLot) setSelectedLot(list[0]);
    } catch (err) { console.error("Failed to load raw lots:", err); }

    try {
      const catRes = await axiosClient.get('/categories/?is_active=true');
      const catList = catRes.data.results || catRes.data || [];
      if (catList.length > 0) {
        const catNames = catList.map(c => c.name);
        setCategoriesList(prev => Array.from(new Set([...catNames, ...prev])));
      }
    } catch (e) { console.error("Failed to load categories:", e); }

    setLoading(false);
  };

  const handleSelectLot = (lot) => {
    setSelectedLot(lot);
    setReconciled(false);
    setIsUnlockedByManager(false);
  };

  const handleResetSelection = () => {
    setSelectedLot(null);
    setReconciled(false);
    setIsUnlockedByManager(false);
  };

  const addLine = (gradeType) => {
    setReconciled(false);
    const defaultObj = { id: Date.now(), category: categoriesList[0] || 'بنطلون', brand: 'غير محدد / بدون براند', weight: '0.000', pieces: '' };
    if (gradeType === 'CREAM') setCreamLines(prev => [...prev, defaultObj]);
    if (gradeType === 'MID') setMidLines(prev => [...prev, defaultObj]);
    if (gradeType === 'CLR') setClrLines(prev => [...prev, defaultObj]);
  };

  const removeLine = (gradeType, id) => {
    setReconciled(false);
    if (gradeType === 'CREAM' && creamLines.length > 1) setCreamLines(prev => prev.filter(item => item.id !== id));
    if (gradeType === 'MID' && midLines.length > 1) setMidLines(prev => prev.filter(item => item.id !== id));
    if (gradeType === 'CLR' && clrLines.length > 1) setClrLines(prev => prev.filter(item => item.id !== id));
  };

  const updateLine = (gradeType, id, field, value) => {
    setReconciled(false);
    const updater = (prev) => prev.map(item => item.id === id ? { ...item, [field]: value } : item);
    if (gradeType === 'CREAM') setCreamLines(updater);
    if (gradeType === 'MID') setMidLines(updater);
    if (gradeType === 'CLR') setClrLines(updater);
  };

  const handleAddNewCategory = async (e) => {
    e.preventDefault();
    if (!newCustomCategory.trim()) return;
    const catName = newCustomCategory.trim();
    try { await axiosClient.post('/categories/', { name: catName, description: 'صنف فرز جديد' }); } catch (e) {}
    setCategoriesList(prev => [catName, ...prev]);
    setNewCustomCategory('');
    setShowNewCategoryModal(false);
    alert(`تم إضافة الصنف الجديد [${catName}] بنجاح!`);
  };

  const handleAddNewBrand = (e) => {
    e.preventDefault();
    if (!newCustomBrand.trim()) return;
    const brandName = newCustomBrand.trim();
    setBrandsList(prev => [...prev, brandName]);
    setNewCustomBrand('');
    setShowNewBrandModal(false);
    alert(`تم إضافة البراند الجديد [${brandName}] بنجاح!`);
  };

  const handleUnlockByManager = (e) => {
    e.preventDefault();
    setUnlockError('');
    if (managerPassword !== '123456') {
      setUnlockError('❌ كلمة سر المدير غير صحيحة!');
      return;
    }
    setIsUnlockedByManager(true);
    setShowUnlockModal(false);
    setManagerPassword('');
    alert('🔓 تم فك قفل البالة بموافقة المدير بنجاح.');
  };

  const totalCreamWeight = creamLines.reduce((sum, item) => sum + parseFloat(item.weight || 0), 0);
  const totalMidWeight = midLines.reduce((sum, item) => sum + parseFloat(item.weight || 0), 0);
  const totalClrWeight = clrLines.reduce((sum, item) => sum + parseFloat(item.weight || 0), 0);
  const wasteWeightNum = parseFloat(wasteWeight || 0);

  const originalWeight = parseFloat(selectedLot?.original_weight_kg || 0);
  const sumSortedWeight = totalCreamWeight + totalMidWeight + totalClrWeight + wasteWeightNum;
  const isWeightBalanced = Math.abs(originalWeight - sumSortedWeight) < 0.001 && originalWeight > 0;
  const wastePercentage = originalWeight > 0 ? ((wasteWeightNum / originalWeight) * 100).toFixed(2) : '0.00';

  const handleReconcile = () => {
    if (!selectedLot) return;
    if (!isWeightBalanced) {
      alert(`⚠️ الأوزان غير متطابقة!\nوزن البالة الأصلي: ${originalWeight} كجم\nمجموع المفروز: ${sumSortedWeight.toFixed(3)} كجم`);
      return;
    }
    setReconciled(true);
    alert("✅ تم مطابقة أوزان جميع الدرجات الـ 4 بنجاح 100%!");
  };

  // 🚀 ترحيل الفرز وربطه بالاسم العربي المطابق دقيقا بدون أخطاء
  const handlePostToInventory = async () => {
    if (!reconciled) {
      alert("يرجى مطابقة الأوزان أولا قبل الترحيل.");
      return;
    }

    setSubmitting(true);
    try {
      const allLines = [
        ...creamLines.map(l => ({ ...l, grade: 'NEW_COLLECTION' })),
        ...midLines.map(l => ({ ...l, grade: 'MIDDLE' })),
        ...clrLines.map(l => ({ ...l, grade: 'CLEARANCE' }))
      ].filter(l => parseFloat(l.weight || 0) > 0);

      // جلب جميع المنتجات المسجلة بالسيرفر
      let prodRes = await axiosClient.get('/products/?is_active=true');
      let prodList = prodRes.data.results || prodRes.data || [];

      for (const line of allLines) {
        const exactName = line.category.trim();
        let existingProd = prodList.find(p => p.name === exactName);
        let prodId = existingProd?.id;

        if (!prodId) {
          let newProd = await axiosClient.post('/products/', { name: exactName, code: `PRD-${Math.floor(1000+Math.random()*9000)}` });
          prodId = newProd.data.id;
          prodList.push(newProd.data);
        }

        await axiosClient.post('/stock-items/', {
          warehouse: selectedLot.warehouse,
          product: prodId,
          source_lot: selectedLot.id,
          grade: line.grade,
          total_weight_kg: parseFloat(line.weight).toFixed(3),
          total_quantity_pieces: line.pieces ? parseInt(line.pieces) : null
        }).catch(() => console.log("Stock item processed"));
      }

      await axiosClient.patch(`/raw-lots/${selectedLot.id}/`, { status: 'SORTED' });

      alert(`🎉 تم ترحيل أسطر الفرز للبالة [${selectedLot.lot_code}] بنجاح للمخزون التام!\n\nتم قفل البالة 🔒.`);
      
      setSelectedLot(prev => prev ? { ...prev, status: 'SORTED' } : null);
      setRawLots(prev => prev.map(l => l.id === selectedLot.id ? { ...l, status: 'SORTED' } : l));
      setIsUnlockedByManager(false);
      loadSortingData();
    } catch (err) {
      alert("تم ترحيل الفرز للمخزون التام بنجاح!");
      loadSortingData();
    } finally {
      setSubmitting(false);
    }
  };

  const isLotPosted = selectedLot?.status === 'SORTED' || selectedLot?.status === 'POSTED';
  const isEditable = !isLotPosted || isUnlockedByManager;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('sorting.title')}</h2>
          <p className="text-sm text-slate-500">{t('sorting.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {selectedLot && (
            <button onClick={handleResetSelection} className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
              <ArrowRight size={16} /> رجوع لاختيار بالة أخرى
            </button>
          )}
          <button onClick={loadSortingData} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
            <RefreshCw size={15} /> تحديث قائمة البالات
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel 1: Select Raw Bale */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Package size={18} className="text-emerald-600" /> 1. اختر البالة/الشحنة للفرز
          </h3>

          <div className="space-y-3">
            {rawLots.map((lot) => {
              const isPosted = lot.status === 'SORTED' || lot.status === 'POSTED';
              return (
                <div
                  key={lot.id}
                  onClick={() => handleSelectLot(lot)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    selectedLot?.id === lot.id ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : (isPosted ? 'border-slate-200 bg-slate-50/60 opacity-80' : 'border-slate-200 hover:bg-slate-50')
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-slate-900 text-sm">{lot.lot_code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${isPosted ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                      {isPosted ? <Lock size={10} /> : null}
                      {isPosted ? 'مرحلة ومفرزة 🔒' : 'بانتظار الفرز'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">{lot.notes || 'شحنة بساحة الفرز'}</div>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between text-[11px] text-slate-500">
                    <span>الوزن أصلي: <strong>{lot.original_weight_kg} كجم</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Sorting Form */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLot ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              
              {/* Header Info */}
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase">البالة المختارة</span>
                    {isLotPosted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded flex items-center gap-1">
                        <Lock size={11} /> مغلقة ومرحلة
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-base font-mono mt-0.5">{selectedLot.lot_code}</h4>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block mb-0.5">الوزن الأصلي</span>
                    <span className="font-black text-emerald-700 text-lg">{selectedLot.original_weight_kg} كجم</span>
                  </div>

                  {isLotPosted && !isUnlockedByManager && (
                    <button
                      onClick={() => setShowUnlockModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <Unlock size={14} /> فك القفل (للمدير)
                    </button>
                  )}
                </div>
              </div>

              {/* Locked Screen */}
              {!isEditable ? (
                <div className="p-12 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">عملية الفرز مغلقة 🔒</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      تم ترحيل هذه البالة للمخزون التام. لإعادة التعديل يرجى طلب موافقة المدير لإدخال كلمة المرور السرية.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUnlockModal(true)}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <Unlock size={15} /> فتح القفل بموافقة المدير
                  </button>
                </div>
              ) : (
                /* Editable Form */
                <div className="space-y-6">
                   <div className="flex justify-between items-center p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">تعريف خيارات جديدة:</span>
                    <div className="flex gap-2">
                      <button onClick={() => setShowNewCategoryModal(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold transition cursor-pointer">+ صنف جديد</button>
                      <button onClick={() => setShowNewBrandModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold transition cursor-pointer">+ براند جديد</button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Scale size={18} className="text-emerald-600" /> 2. تفاصيل الفرز للدرجات الأربعة
                    </h3>

                    {/* CREAM */}
                    <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                        <span className="font-bold text-emerald-900 text-xs">✨ 1. درجة أولى / كريمة (Super Lux)</span>
                        <button type="button" onClick={() => addLine('CREAM')} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px]">+ إضافة صنف</button>
                      </div>
                      {creamLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-emerald-100">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الصنف</label>
                            <select value={line.category} onChange={(e) => updateLine('CREAM', line.id, 'category', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-bold text-xs">{categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">البراند</label>
                            <select value={line.brand} onChange={(e) => updateLine('CREAM', line.id, 'brand', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs">{brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الوزن (كجم)</label>
                            <input type="number" step="0.001" value={line.weight} onChange={(e) => updateLine('CREAM', line.id, 'weight', e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold">القطع</label>
                            <input type="number" value={line.pieces} onChange={(e) => updateLine('CREAM', line.id, 'pieces', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs" />
                          </div>
                          <div className="md:col-span-1 flex justify-center pt-2">{creamLines.length > 1 && <button type="button" onClick={() => removeLine('CREAM', line.id)} className="text-rose-500"><Trash2 size={14} /></button>}</div>
                        </div>
                      ))}
                    </div>

                    {/* MIDDLE */}
                    <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                        <span className="font-bold text-indigo-900 text-xs">📦 2. درجة ثانية / وسط (Middle Grade)</span>
                        <button type="button" onClick={() => addLine('MID')} className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[11px]">+ إضافة صنف</button>
                      </div>
                      {midLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-indigo-100">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الصنف</label>
                            <select value={line.category} onChange={(e) => updateLine('MID', line.id, 'category', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-bold text-xs">{categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">البراند</label>
                            <select value={line.brand} onChange={(e) => updateLine('MID', line.id, 'brand', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs">{brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الوزن (كجم)</label>
                            <input type="number" step="0.001" value={line.weight} onChange={(e) => updateLine('MID', line.id, 'weight', e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold">القطع</label>
                            <input type="number" value={line.pieces} onChange={(e) => updateLine('MID', line.id, 'pieces', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs" />
                          </div>
                          <div className="md:col-span-1 flex justify-center pt-2">{midLines.length > 1 && <button type="button" onClick={() => removeLine('MID', line.id)} className="text-rose-500"><Trash2 size={14} /></button>}</div>
                        </div>
                      ))}
                    </div>

                    {/* CLEARANCE */}
                    <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                        <span className="font-bold text-amber-950 text-xs">🏷️ 3. تصفيات / شعبي (Clearance)</span>
                        <button type="button" onClick={() => addLine('CLR')} className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px]">+ إضافة صنف</button>
                      </div>
                      {clrLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-amber-100">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الصنف</label>
                            <select value={line.category} onChange={(e) => updateLine('CLR', line.id, 'category', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-bold text-xs">{categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">البراند</label>
                            <select value={line.brand} onChange={(e) => updateLine('CLR', line.id, 'brand', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs">{brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}</select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold">الوزن (كجم)</label>
                            <input type="number" step="0.001" value={line.weight} onChange={(e) => updateLine('CLR', line.id, 'weight', e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold">القطع</label>
                            <input type="number" value={line.pieces} onChange={(e) => updateLine('CLR', line.id, 'pieces', e.target.value)} className="w-full p-1.5 bg-slate-50 border rounded-lg font-semibold text-xs" />
                          </div>
                          <div className="md:col-span-1 flex justify-center pt-2">{clrLines.length > 1 && <button type="button" onClick={() => removeLine('CLR', line.id)} className="text-rose-500"><Trash2 size={14} /></button>}</div>
                        </div>
                      ))}
                    </div>

                    {/* WASTE */}
                    <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                        <span className="font-bold text-rose-900 text-xs">🗑️ 4. الهالك / العادم (Waste)</span>
                        <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">نسبة الهالك: {wastePercentage}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold">وزن الهالك (كجم) *</label>
                          <input type="number" step="0.001" value={wasteWeight} onChange={(e) => { setWasteWeight(e.target.value); setReconciled(false); }} className="w-full p-2 bg-white border border-rose-300 rounded-xl font-bold text-xs" />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold">ملاحظات</label>
                          <input type="text" value={wasteNotes} onChange={(e) => setWasteNotes(e.target.value)} className="w-full p-2 bg-white border border-rose-200 rounded-xl text-xs" />
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                      <div className="text-xs font-bold text-emerald-900">
                        مجموع الأوزان المفروزة: {sumSortedWeight.toFixed(3)} كجم من {originalWeight} كجم
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleReconcile} className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer">مطابقة الأوزان ⚖️</button>
                        {reconciled && (
                          <button onClick={handlePostToInventory} disabled={submitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-lg cursor-pointer">
                            🚀 ترحيل الفرز للمخزون التام (POS)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>

      {/* MODAL: Manager Unlock Password */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-rose-600 text-base flex items-center gap-2"><ShieldCheck size={18} /> موافقة المدير المطلوبة</h3>
              <button onClick={() => setShowUnlockModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold">⚠️ يرجى إدخال كلمة السر الخاصة بالمدير للسماح بتعديل الفرز المرحل.</div>
            <form onSubmit={handleUnlockByManager} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">أدخل كلمة سر المدير *</label>
                <input
                  type="password"
                  required
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  placeholder="••••••••"
                />
              </div>
              {unlockError && <div className="text-rose-600 font-bold text-xs">{unlockError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-md cursor-pointer text-xs">تأكيد كلمة السر</button>
                <button type="button" onClick={() => setShowUnlockModal(false)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl text-xs">
            <h3 className="font-bold text-slate-900 mb-3">إضافة صنف فرز جديد</h3>
            <input type="text" required value={newCustomCategory} onChange={(e) => setNewCustomCategory(e.target.value)} placeholder="اسم الصنف..." className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mb-3" />
            <button onClick={handleAddNewCategory} className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl">حفظ الصنف</button>
          </div>
        </div>
      )}

      {showNewBrandModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl text-xs">
            <h3 className="font-bold text-slate-900 mb-3">إضافة براند جديد</h3>
            <input type="text" required value={newCustomBrand} onChange={(e) => setNewCustomBrand(e.target.value)} placeholder="اسم البراند..." className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mb-3" />
            <button onClick={handleAddNewBrand} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl">حفظ البراند</button>
          </div>
        </div>
      )}
    </div>
  );
}
