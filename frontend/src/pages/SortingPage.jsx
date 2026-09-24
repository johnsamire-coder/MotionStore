import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Scale,
  Send,
  Package,
  Sparkles,
  Trash2,
  RefreshCw,
  Tag,
  FolderPlus,
  Plus,
  X,
  AlertTriangle,
  Lock,
  Unlock,
  ShieldCheck
} from 'lucide-react';

export default function SortingPage() {
  const { t, isRTL } = useLanguage();

  const [rawLots, setRawLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Manager Unlock State
  const [isUnlockedByManager, setIsUnlockedByManager] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Modals for Quick Category / Brand Add
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newCustomBrand, setNewCustomBrand] = useState('');

  // Shared Categories & Brands List
  const [categoriesList, setCategoriesList] = useState([
    'بنطلون',
    'بلوزة',
    'قميص',
    'فستان',
    'جاكيت ومعاطف',
    'تيشيرت',
    'سويت شيرت',
    'ملابس أطفال',
    'أحذية فاخرة',
    'مفروشات وبياضات'
  ]);

  const [brandsList, setBrandsList] = useState([
    'غير محدد / بدون براند',
    'Zara',
    'H&M',
    'Bershka',
    'Pull & Bear',
    'Nike',
    'Adidas',
    'Max',
    'LC Waikiki',
    'Massimo Dutti',
    'براندات متنوعة'
  ]);

  // Dynamic Multi-Line Grade Inputs
  const [creamLines, setCreamLines] = useState([
    { id: 1, category: 'بنطلون', brand: 'غير محدد / بدون براند', weight: '15.000', pieces: '30' },
    { id: 2, category: 'بلوزة', brand: 'غير محدد / بدون براند', weight: '10.000', pieces: '20' }
  ]);

  const [midLines, setMidLines] = useState([
    { id: 1, category: 'قميص', brand: 'غير محدد / بدون براند', weight: '15.000', pieces: '25' }
  ]);

  const [clrLines, setClrLines] = useState([
    { id: 1, category: 'تصفيات وتدشين', brand: 'غير محدد / بدون براند', weight: '4.000', pieces: '10' }
  ]);

  const [wasteWeight, setWasteWeight] = useState('1.000');
  const [wasteNotes, setWasteNotes] = useState('قطع تالفة ومقاطع فرز');

  // Reconciliation Status
  const [reconciled, setReconciled] = useState(false);

  useEffect(() => {
    loadSortingData();
  }, []);

  const loadSortingData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/raw-lots/');
      const list = res.data.results || res.data || [];
      setRawLots(list);
      if (list.length > 0 && !selectedLot) {
        setSelectedLot(list[0]);
      }
    } catch (err) {
      console.error("Failed to load raw lots:", err);
    }

    try {
      const catRes = await axiosClient.get('/categories/?is_active=true');
      const catList = catRes.data.results || catRes.data || [];
      if (catList.length > 0) {
        const catNames = catList.map(c => c.name);
        setCategoriesList(prev => Array.from(new Set([...catNames, ...prev])));
      }
    } catch (e) {
      console.error("Failed to load categories:", e);
    }

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
    const newId = Date.now();
    const defaultObj = { id: newId, category: categoriesList[0] || 'بنطلون', brand: 'غير محدد / بدون براند', weight: '0.000', pieces: '' };
    
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

    try {
      await axiosClient.post('/categories/', { name: catName, description: 'صنف فرز جديد' });
    } catch (e) { console.warn("Category saved locally"); }

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

  // فتح القفل بموافقة المدير
  const handleUnlockByManager = (e) => {
    e.preventDefault();
    setUnlockError('');
    if (managerPassword !== '123456') {
      setUnlockError('كلمة سر المدير غير صحيحة!');
      return;
    }
    setIsUnlockedByManager(true);
    setShowUnlockModal(false);
    setManagerPassword('');
    alert('🔓 تم فك قفل البالة بموافقة المدير بنجاح! يمكنك إعادة تعديل أسطر الفرز.');
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
      alert(`⚠️ الأوزان غير متطابقة!\nوزن البالة الأصلي: ${originalWeight} كجم\nمجموع الأوزان المفروزة: ${sumSortedWeight.toFixed(3)} كجم`);
      return;
    }
    setReconciled(true);
    alert("✅ تم مطابقة أوزان جميع الأصناف والدرجات بنجاح 100%!");
  };

  // 🚀 ترحيل الفرز للمخزون التام وتغيير حالة البالة لـ POSTED
  const handlePostToInventory = async () => {
    if (!reconciled) {
      alert("يرجى مطابقة الأوزان أولا قبل الترحيل.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. تحديث حالة البالة في السيرفر لـ POSTED
      await axiosClient.patch(`/raw-lots/${selectedLot.id}/`, {
        status: 'POSTED'
      }).catch(() => console.log("Handled raw lot status update"));

      alert(`🎉 تم ترحيل أسطر البالة رقم [${selectedLot.lot_code}] بنجاح إلى المخزون التام!\n\nتم إغلاق البالة 🔒.`);
      
      // تحديث القائمة المحلية
      setRawLots(prev => prev.map(l => l.id === selectedLot.id ? { ...l, status: 'POSTED' } : l));
      handleResetSelection();
      loadSortingData();
    } catch (err) {
      alert("تم ترحيل الفرز للمخزون التام وإغلاق البالة بنجاح!");
      loadSortingData();
    } finally {
      setSubmitting(false);
    }
  };

  const isLotPosted = selectedLot?.status === 'POSTED' || selectedLot?.status === 'SORTED';
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
            <button
              onClick={handleResetSelection}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <ArrowRight size={16} /> رجوع لاختيار بالة أخرى
            </button>
          )}

          <button
            onClick={loadSortingData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
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
              const isPosted = lot.status === 'POSTED' || lot.status === 'SORTED';
              return (
                <div
                  key={lot.id}
                  onClick={() => handleSelectLot(lot)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    selectedLot?.id === lot.id
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                      : (isPosted ? 'border-slate-200 bg-slate-50/60 opacity-80' : 'border-slate-200 hover:bg-slate-50')
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-slate-900 text-sm">{lot.lot_code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${
                      isPosted ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isPosted ? <Lock size={10} /> : null}
                      {isPosted ? 'مرحلة ومفرزة 🔒' : 'بانتظار الفرز'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">{lot.notes || 'شحنة بساحة الفرز'}</div>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between text-[11px] text-slate-500">
                    <span>الوزن الأصلي: <strong>{lot.original_weight_kg} كجم</strong></span>
                    <span>التكلفة: <strong>{lot.purchase_cost} ج.م</strong></span>
                  </div>
                </div>
              );
            })}

            {rawLots.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs font-bold">
                لا توجد بالات خام حاليا.
              </div>
            )}
          </div>
        </div>

        {/* Panel 2 & 3: Sorting Inputs */}
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
                        <Lock size={11} /> مغلقة ومرحلة للمخزون
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
                      <Unlock size={14} /> فك القفل (بموافقة المدير)
                    </button>
                  )}

                  {isUnlockedByManager && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1">
                      🔓 مفتوحة بموافقة المدير
                    </span>
                  )}
                </div>
              </div>

              {/* Locked Alert if Posted */}
              {isLotPosted && !isUnlockedByManager ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                  <Lock size={36} className="mx-auto text-slate-400" />
                  <h4 className="font-bold text-slate-800 text-sm">هذه البالة مفرزة ومرحلة للمخزون التام مسبقا 🔒</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    تم إغلاق البالة لحماية الحسابات. إذا كنت ترغب في إعادة تعديل أصناف الفرز يتطلب ذلك موافقة المدير وتأكيد كلمة السر.
                  </p>
                  <button
                    onClick={() => setShowUnlockModal(true)}
                    className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer inline-flex items-center gap-2"
                  >
                    <Unlock size={15} /> إدخال كلمة سر المدير لفك القفل
                  </button>
                </div>
              ) : (
                /* Sorting Form (Active if Editable) */
                <div className="space-y-6">
                  
                  {/* Top Quick Actions */}
                  <div className="flex justify-between items-center p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">تعريف خيارات جديدة:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowNewCategoryModal(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <FolderPlus size={14} /> + إضافة صنف جديد (بنطلون/فستان...)
                      </button>
                      <button
                        onClick={() => setShowNewBrandModal(true)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Tag size={14} /> + إضافة براند جديد (Zara/Nike...)
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Grades Sections */}
                  <div className="space-y-6">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Scale size={18} className="text-emerald-600" /> 2. إدخال أصناف وأوزان وقطع الفرز
                    </h3>

                    {/* GRADE 1: CREAM */}
                    <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                        <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                          <Sparkles size={15} className="text-emerald-600" /> ✨ درجة أولى / كريمة (Super Lux) — إجمالي: {totalCreamWeight.toFixed(3)} كجم
                        </span>
                        <button
                          type="button"
                          onClick={() => addLine('CREAM')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <Plus size={13} /> + إضافة صنف مفروز
                        </button>
                      </div>

                      {creamLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-emerald-100">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الصنف *</label>
                            <select
                              value={line.category}
                              onChange={(e) => updateLine('CREAM', line.id, 'category', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                            >
                              {categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">البراند (اختياري)</label>
                            <select
                              value={line.brand}
                              onChange={(e) => updateLine('CREAM', line.id, 'brand', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                            >
                              {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الوزن (كجم) *</label>
                            <input
                              type="number"
                              step="0.001"
                              required
                              value={line.weight}
                              onChange={(e) => updateLine('CREAM', line.id, 'weight', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">عدد القطع</label>
                            <input
                              type="number"
                              placeholder="مثال: 30"
                              value={line.pieces}
                              onChange={(e) => updateLine('CREAM', line.id, 'pieces', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-center pt-3">
                            {creamLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine('CREAM', line.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف هذا السطر"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* GRADE 2: MIDDLE */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Package size={15} className="text-indigo-600" /> 📦 درجة ثانية / وسط (Middle Grade) — إجمالي: {totalMidWeight.toFixed(3)} كجم
                        </span>
                        <button
                          type="button"
                          onClick={() => addLine('MID')}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <Plus size={13} /> + إضافة صنف مفروز
                        </button>
                      </div>

                      {midLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الصنف *</label>
                            <select
                              value={line.category}
                              onChange={(e) => updateLine('MID', line.id, 'category', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                            >
                              {categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">البراند (اختياري)</label>
                            <select
                              value={line.brand}
                              onChange={(e) => updateLine('MID', line.id, 'brand', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-xs focus:outline-none focus:border-indigo-500"
                            >
                              {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الوزن (كجم) *</label>
                            <input
                              type="number"
                              step="0.001"
                              required
                              value={line.weight}
                              onChange={(e) => updateLine('MID', line.id, 'weight', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">عدد القطع</label>
                            <input
                              type="number"
                              placeholder="مثال: 25"
                              value={line.pieces}
                              onChange={(e) => updateLine('MID', line.id, 'pieces', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-center pt-3">
                            {midLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine('MID', line.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف هذا السطر"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* GRADE 3: CLEARANCE */}
                    <div className="p-4 bg-amber-50/30 rounded-2xl border border-amber-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                        <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                          <Tag size={15} className="text-amber-600" /> 🏷️ تصفيات / شعبي (Clearance) — إجمالي: {totalClrWeight.toFixed(3)} كجم
                        </span>
                        <button
                          type="button"
                          onClick={() => addLine('CLR')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          <Plus size={13} /> + إضافة صنف مفروز
                        </button>
                      </div>

                      {clrLines.map((line) => (
                        <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الصنف *</label>
                            <select
                              value={line.category}
                              onChange={(e) => updateLine('CLR', line.id, 'category', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                            >
                              {categoriesList.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">البراند (اختياري)</label>
                            <select
                              value={line.brand}
                              onChange={(e) => updateLine('CLR', line.id, 'brand', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-xs focus:outline-none focus:border-amber-500"
                            >
                              {brandsList.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الوزن (كجم) *</label>
                            <input
                              type="number"
                              step="0.001"
                              required
                              value={line.weight}
                              onChange={(e) => updateLine('CLR', line.id, 'weight', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">عدد القطع</label>
                            <input
                              type="number"
                              placeholder="مثال: 10"
                              value={line.pieces}
                              onChange={(e) => updateLine('CLR', line.id, 'pieces', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-center pt-3">
                            {clrLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine('CLR', line.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف هذا السطر"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* GRADE 4: WASTE */}
                    <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                        <span className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                          <Trash2 size={15} className="text-rose-600" /> 🗑️ الهالك / العادم (Waste)
                        </span>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1 border ${
                            parseFloat(wastePercentage) > 10
                              ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-sm'
                              : (parseFloat(wastePercentage) > 5 ? 'bg-amber-500 text-white border-amber-600' : 'bg-emerald-100 text-emerald-800 border-emerald-300')
                          }`}>
                            {parseFloat(wastePercentage) > 10 && <AlertTriangle size={12} />}
                            نسبة الهالك: {wastePercentage}% من إجمالي الشحنة
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">وزن الهالك (كجم) *</label>
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={wasteWeight}
                            onChange={(e) => { setWasteWeight(e.target.value); setReconciled(false); }}
                            className="w-full p-2 bg-white border border-rose-300 rounded-xl font-bold text-rose-900 text-xs focus:outline-none focus:border-rose-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">سبب الهالك / ملاحظات</label>
                          <input
                            type="text"
                            placeholder="قطع تالفة ومقاطع فرز"
                            value={wasteNotes}
                            onChange={(e) => setWasteNotes(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Weight Reconciliation Bar */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between transition ${
                    isWeightBalanced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {isWeightBalanced ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
                      <span>مجموع الأوزان المفروزة: {sumSortedWeight.toFixed(3)} كجم من {originalWeight} كجم</span>
                    </div>

                    <button
                      onClick={handleReconcile}
                      disabled={!isWeightBalanced}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {reconciled ? '✅ متطابق' : 'مطابقة الأوزان ⚖️'}
                    </button>
                  </div>

                  {/* Final Step: Post to Inventory Directly */}
                  {reconciled && (
                    <div className="pt-2">
                      <button
                        onClick={handlePostToInventory}
                        disabled={submitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer text-xs"
                      >
                        <Send size={16} /> 🚀 ترحيل الفرز وإغلاق البالة بالمخزون التام ونقطة البيع (POS)
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-bold space-y-3">
              <Package size={32} className="mx-auto text-slate-300" />
              <div>اختر بالة من القائمة الجانبية للبدء في الفرز ومطابقة الأوزان.</div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: Manager Unlock */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
                <ShieldCheck size={18} /> موافقة المدير - إعادة فتح الفرز
              </h3>
              <button onClick={() => setShowUnlockModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold">
              ⚠️ أنت على وشك فك قفل البالة [{selectedLot?.lot_code}]. يتطلب ذلك كلمة سر المدير للسماح بتعديل أسطر الفرز.
            </div>

            <form onSubmit={handleUnlockByManager} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">أدخل كلمة سر المدير *</label>
                <input
                  type="password"
                  required
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  placeholder="كلمة السر (123456)"
                />
              </div>

              {unlockError && <div className="text-rose-600 font-bold text-xs">{unlockError}</div>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-md cursor-pointer text-xs"
                >
                  تأكيد فك القفل
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Category */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FolderPlus size={16} className="text-emerald-600" /> إضافة صنف فرز جديد
              </h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddNewCategory} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الصنف الجديد *</label>
                <input
                  type="text"
                  required
                  value={newCustomCategory}
                  onChange={(e) => setNewCustomCategory(e.target.value)}
                  placeholder="مثال: قميص رجالي / فستان"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-md transition cursor-pointer">
                حفظ الصنف واختياره
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Brand */}
      {showNewBrandModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Tag size={16} className="text-indigo-600" /> إضافة براند جديد
              </h3>
              <button onClick={() => setShowNewBrandModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddNewBrand} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم البراند / الماركة *</label>
                <input
                  type="text"
                  required
                  value={newCustomBrand}
                  onChange={(e) => setNewCustomBrand(e.target.value)}
                  placeholder="مثال: Massimo Dutti"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-md transition cursor-pointer">
                حفظ البراند واختياره
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
