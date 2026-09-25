import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Tag, Save, Search, CheckCircle2, History, Scale, Package, DollarSign, User, Plus, Download, Printer, FileSpreadsheet } from 'lucide-react';

export default function ProductCodingPage() {
  const { t } = useLanguage();
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('CODING'); // CODING | PRICING | HISTORY

  // Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Tab 1: Coding Form
  const [codingForm, setCodingForm] = useState({
    name: '',
    code: '',
    barcode: '',
    category: '',
    unit_of_measure: 'PIECE',
    min_stock_level: '0.000',
    package_type: ''
  });

  // Tab 2: Individual Pricing State
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Weights state: { NEW_COLLECTION: { current: '180', saved: '180' }, ... }
  const [weightPrices, setWeightPrices] = useState({
    NEW_COLLECTION: { current: '', saved: '' },
    MIDDLE: { current: '', saved: '' },
    CLEARANCE: { current: '', saved: '' }
  });

  // Pieces state per Sub-Type / Gender
  const [pieceCategory, setPieceCategory] = useState('حريمي');
  const [pieceGrade, setPieceGrade] = useState('NEW_COLLECTION');
  const [piecePriceInput, setPiecePieceInput] = useState({ current: '', saved: '' });

  // Tab 3: History Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, hRes] = await Promise.all([
        axiosClient.get('/products/'),
        axiosClient.get('/categories/'),
        axiosClient.get('/price-history/')
      ]);
      const pList = pRes.data.results || pRes.data || [];
      const cList = cRes.data.results || cRes.data || [];
      const hList = hRes.data.results || hRes.data || [];

      setProducts(pList);
      setCategories(cList);
      setPriceHistory(hList);

      if (cList.length > 0 && !codingForm.category) {
        setCodingForm(prev => ({ ...prev, category: cList[0].id }));
      }
      if (pList.length > 0 && !selectedProduct) {
        loadProductPrices(pList[0]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Add Category
  const handleAddCategory = async () => {
    const catName = prompt('أدخل اسم التصنيف الجديد (مثال: حريمي / أطفالي / رجالي):');
    if (catName && catName.trim()) {
      try {
        const res = await axiosClient.post('/categories/', { name: catName.trim() });
        setCategories([...categories, res.data]);
        setCodingForm(prev => ({ ...prev, category: res.data.id }));
        alert('تمت إضافة التصنيف بنجاح ✅');
      } catch (err) {
        alert('حدث خطأ أثناء إضافة التصنيف');
      }
    }
  };

  // Save Coding
  const handleSaveCoding = async (e) => {
    e.preventDefault();
    if (!codingForm.name.trim() || !codingForm.category) {
      alert('يرجى إدخال اسم الصنف والتصنيف الرئيسي');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/products/', codingForm);
      setSuccessMsg('تم تكويد الصنف بنجاح ✅');
      setCodingForm({
        name: '',
        code: '',
        barcode: '',
        category: categories[0]?.id || '',
        unit_of_measure: 'PIECE',
        min_stock_level: '0.000',
        package_type: ''
      });
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل حفظ الصنف، يرجى التأكد من البيانات');
    } finally {
      setSaving(false);
    }
  };

  // Load prices for selected product
  const loadProductPrices = async (product) => {
    if (!product) return;
    setSelectedProduct(product);
    try {
      const res = await axiosClient.get(`/price-list-items/?product=${product.id}`);
      const items = res.data.results || res.data || [];
      
      const newWeightPrices = {
        NEW_COLLECTION: { current: '', saved: '' },
        MIDDLE: { current: '', saved: '' },
        CLEARANCE: { current: '', saved: '' }
      };

      let pieceVal = '';

      items.forEach(item => {
        if (item.grade && newWeightPrices[item.grade]) {
          if (parseFloat(item.price_per_kg) > 0) {
            newWeightPrices[item.grade] = {
              current: item.price_per_kg,
              saved: item.price_per_kg
            };
          }
          if (parseFloat(item.price_per_piece) > 0) {
            pieceVal = item.price_per_piece;
          }
        }
      });

      setWeightPrices(newWeightPrices);
      setPiecePieceInput({ current: pieceVal, saved: pieceVal });
    } catch (err) {
      console.error(err);
    }
  };

  // Save Individual Weight Price
  const handleSaveWeightPrice = async (grade) => {
    const val = weightPrices[grade].current;
    if (!val || parseFloat(val) <= 0) {
      alert('يرجى إدخال سعر صحيح');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/price-list-items/', {
        product: selectedProduct.id,
        grade: grade,
        price_per_kg: val,
        price_per_piece: '0.00'
      });

      // Update state to make button gray (Saved)
      setWeightPrices(prev => ({
        ...prev,
        [grade]: { current: val, saved: val }
      }));
      setSuccessMsg(`تم تحديث سعر الوزن لدرجة (${grade}) بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAllData();
    } catch (err) {
      alert('فشل حفظ السعر');
    } finally {
      setSaving(false);
    }
  };

  // Save Individual Piece Price
  const handleSavePiecePrice = async () => {
    const val = piecePriceInput.current;
    if (!val || parseFloat(val) <= 0) {
      alert('يرجى إدخال سعر قطعة صحيح');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/price-list-items/', {
        product: selectedProduct.id,
        grade: pieceGrade,
        price_per_kg: '0.00',
        price_per_piece: val
      });

      setPiecePieceInput(prev => ({ current: val, saved: val }));
      setSuccessMsg(`تم تحديث سعر القطعة (${pieceCategory} - ${pieceGrade}) بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAllData();
    } catch (err) {
      alert('فشل حفظ سعر القطعة');
    } finally {
      setSaving(false);
    }
  };

  // Export Excel CSV
  const exportExcel = () => {
    const headers = ['التاريخ والوقت', 'اسم الصنف', 'النوع / الدرجة', 'طريقة التسعير', 'السعر القديم', 'السعر الجديد', 'المستخدم المسئول'];
    const rows = filteredHistory.map(h => [
      new Date(h.created_at).toLocaleString('ar-EG'),
      `"${h.product_name || ''}"`,
      `"${h.grade_display || h.grade || ''}"`,
      h.pricing_type === 'KG' ? 'بالوزن كجم' : 'بالقطعة',
      h.old_price,
      h.new_price,
      `"${h.changed_by_username || 'المدير العام'}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_سجل_الأسعار_${startDate}_إلى_${endDate}.csv`;
    link.click();
  };

  const filteredHistory = priceHistory.filter(h => {
    const date = h.created_at ? h.created_at.split('T')[0] : '';
    return date >= startDate && date <= endDate;
  });

  return (
    <div className="space-y-6 print:m-0 print:p-0 font-sans">
      
      {/* Printable Header for PDF */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-center px-4">
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900">{tenant?.name || 'شركة Motion Store للتجارة'}</h1>
            <p className="text-xs text-slate-600 font-bold">نظام تشغيل وإدارة تجارة البالات والملابس المستعملة</p>
          </div>
          <div className="text-left text-xs font-mono text-slate-500">
            <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
            <p>الفترة: من {startDate} إلى {endDate}</p>
          </div>
        </div>
        <h2 className="text-lg font-black text-slate-800 mt-4 bg-slate-100 py-1">تقرير سجل تغيرات وتحديثات الأسعار الرسمية</h2>
      </div>

      {/* Screen Header & 3 Navigation Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-600" />
            شاشة التكويد والتسعير الشاملة (F4)
          </h1>
          <p className="text-xs text-slate-500 mt-1">تكويد الأصناف، تسعير الأوزان والقطع الفردي مع أزرار التأكيد، وسجل التغييرات</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('CODING')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'CODING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. التكويد والبيانات الأساسية
          </button>
          <button
            onClick={() => setActiveTab('PRICING')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'PRICING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. التسعير الفردي (أوزان / قطع)
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. سجل التغيرات والتقارير
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm print:hidden">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      {/* ==================== TAB 1: CODING ==================== */}
      {activeTab === 'CODING' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
          <form onSubmit={handleSaveCoding} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات التكويد الأساسية</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف / الاستوك *</label>
                <input
                  type="text"
                  value={codingForm.name}
                  onChange={e => setCodingForm({ ...codingForm, name: e.target.value })}
                  placeholder="مثال: تيشرت أوفر سايز زارا"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الكود الداخلي</label>
                <input
                  type="text"
                  value={codingForm.code}
                  onChange={e => setCodingForm({ ...codingForm, code: e.target.value })}
                  placeholder="SKU-1001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الباركود الدولي</label>
                <input
                  type="text"
                  value={codingForm.barcode}
                  onChange={e => setCodingForm({ ...codingForm, barcode: e.target.value })}
                  placeholder="EAN / Barcode"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف الرئيسي *</label>
                <div className="flex gap-2">
                  <select
                    value={codingForm.category}
                    onChange={e => setCodingForm({ ...codingForm, category: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                    required
                  >
                    {categories.length === 0 && <option value="">لا توجد تصنيفات — اضغط (+) للإضافة</option>}
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1 shadow cursor-pointer"
                    title="إضافة تصنيف جديد"
                  >
                    <Plus size={16} />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">وحدة القياس</label>
                <select
                  value={codingForm.unit_of_measure}
                  onChange={e => setCodingForm({ ...codingForm, unit_of_measure: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                >
                  <option value="PIECE">قطعة / عدد</option>
                  <option value="KG">كيلو / كجم</option>
                  <option value="BOTH">قطعة + وزن</option>
                  <option value="CARTON">كرتونة</option>
                  <option value="SACK">شيكارة</option>
                  <option value="BALE">بالة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">نوع العبوة</label>
                <input
                  type="text"
                  placeholder="كرتونة / شيكارة"
                  value={codingForm.package_type}
                  onChange={e => setCodingForm({ ...codingForm, package_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">الحد الأدنى للرصيد (للتنبيهات)</label>
                <input
                  type="number"
                  step="0.001"
                  value={codingForm.min_stock_level}
                  onChange={e => setCodingForm({ ...codingForm, min_stock_level: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Save size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ وتكويد الصنف (F1)'}</span>
            </button>
          </form>

          {/* Directory Table */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h2 className="text-sm font-black text-slate-800 border-b pb-3 mb-4">الأصناف المكودة بالفهرس ({products.length})</h2>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-2.5">الكود</th>
                    <th className="p-2.5">اسم الصنف</th>
                    <th className="p-2.5">التصنيف الرئيسي</th>
                    <th className="p-2.5">الوحدة</th>
                    <th className="p-2.5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono font-bold text-slate-600">{p.code || p.barcode || '—'}</td>
                      <td className="p-2.5 font-black text-slate-900">{p.name}</td>
                      <td className="p-2.5 text-slate-500 font-bold">{p.category_name || 'عام'}</td>
                      <td className="p-2.5 font-bold text-slate-700">{p.unit_of_measure}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => {
                            loadProductPrices(p);
                            setActiveTab('PRICING');
                          }}
                          className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black text-[11px] hover:bg-emerald-200 cursor-pointer"
                        >
                          تسعير الصنف ➔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: INDIVIDUAL DUAL PRICING ==================== */}
      {activeTab === 'PRICING' && (
        <div className="space-y-6 print:hidden">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 w-full max-w-xl">
              <label className="text-xs font-black text-slate-700 whitespace-nowrap">اختر الصنف المراد تسعيره:</label>
              <select
                value={selectedProduct?.id || ''}
                onChange={e => loadProductPrices(products.find(p => p.id === e.target.value))}
                className="w-full bg-slate-50 border border-emerald-300 rounded-xl p-2.5 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>--- اختر صنفاً من القائمة ---</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category_name || 'عام'})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* WEIGHT PRICING SECTION */}
              <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                  <Scale className="text-emerald-700" size={18} />
                  <h3 className="text-xs font-black text-emerald-950">1. تسعير الأوزان (سعر الكيلو لكل درجة)</h3>
                </div>

                <div className="space-y-3">
                  {/* NEW COLLECTION WEIGHT */}
                  {(() => {
                    const data = weightPrices.NEW_COLLECTION;
                    const hasChanged = data.current !== '' && data.current !== data.saved;
                    return (
                      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-lg">✨</span>
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-slate-600">سعر الكيلو (كريمة / سوبر لوكس)</label>
                          <input
                            type="number" step="0.01" placeholder="0.00"
                            value={data.current}
                            onChange={e => setWeightPrices({
                              ...weightPrices,
                              NEW_COLLECTION: { ...weightPrices.NEW_COLLECTION, current: e.target.value }
                            })}
                            className="w-full font-black text-emerald-900 text-sm bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none p-0.5"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveWeightPrice('NEW_COLLECTION')}
                          disabled={!hasChanged || saving}
                          className={`px-4 py-2 rounded-lg font-black text-xs transition shadow ${
                            hasChanged
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer animate-pulse'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {hasChanged ? 'حفظ السعر' : 'محفوظ ✓'}
                        </button>
                      </div>
                    );
                  })()}

                  {/* MIDDLE WEIGHT */}
                  {(() => {
                    const data = weightPrices.MIDDLE;
                    const hasChanged = data.current !== '' && data.current !== data.saved;
                    return (
                      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-lg">📦</span>
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-slate-600">سعر الكيلو (وسط / درجة ثانية)</label>
                          <input
                            type="number" step="0.01" placeholder="0.00"
                            value={data.current}
                            onChange={e => setWeightPrices({
                              ...weightPrices,
                              MIDDLE: { ...weightPrices.MIDDLE, current: e.target.value }
                            })}
                            className="w-full font-black text-emerald-900 text-sm bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none p-0.5"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveWeightPrice('MIDDLE')}
                          disabled={!hasChanged || saving}
                          className={`px-4 py-2 rounded-lg font-black text-xs transition shadow ${
                            hasChanged
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer animate-pulse'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {hasChanged ? 'حفظ السعر' : 'محفوظ ✓'}
                        </button>
                      </div>
                    );
                  })()}

                  {/* CLEARANCE WEIGHT */}
                  {(() => {
                    const data = weightPrices.CLEARANCE;
                    const hasChanged = data.current !== '' && data.current !== data.saved;
                    return (
                      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-lg">🏷️</span>
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-slate-600">سعر الكيلو (تصفيات / شعبي)</label>
                          <input
                            type="number" step="0.01" placeholder="0.00"
                            value={data.current}
                            onChange={e => setWeightPrices({
                              ...weightPrices,
                              CLEARANCE: { ...weightPrices.CLEARANCE, current: e.target.value }
                            })}
                            className="w-full font-black text-emerald-900 text-sm bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none p-0.5"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveWeightPrice('CLEARANCE')}
                          disabled={!hasChanged || saving}
                          className={`px-4 py-2 rounded-lg font-black text-xs transition shadow ${
                            hasChanged
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer animate-pulse'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {hasChanged ? 'حفظ السعر' : 'محفوظ ✓'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* PIECE PRICING SECTION (WITH GENDER / SUB-TYPE) */}
              <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
                  <Package className="text-blue-700" size={18} />
                  <h3 className="text-xs font-black text-blue-950">2. تسعير القطع (تخصيص النوع والدرجة)</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف / النوع:</label>
                      <select
                        value={pieceCategory}
                        onChange={e => setPieceCategory(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                      >
                        <option value="حريمي">👗 حريمي</option>
                        <option value="أطفالي">👶 أطفالي</option>
                        <option value="رجالي">👔 رجالي</option>
                        <option value="بناتي">👧 بناتي</option>
                        <option value="أولادي">👦 أولادي</option>
                        <option value="إكسسوارات">👜 إكسسوارات</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">الدرجة والجودة:</label>
                      <select
                        value={pieceGrade}
                        onChange={e => setPieceGrade(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                      >
                        <option value="NEW_COLLECTION">✨ كريمة / سوبر لوكس</option>
                        <option value="MIDDLE">📦 وسط / درجة ثانية</option>
                        <option value="CLEARANCE">🏷️ تصفيات / شعبي</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const data = piecePriceInput;
                    const hasChanged = data.current !== '' && data.current !== data.saved;
                    return (
                      <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
                        <label className="block text-xs font-black text-blue-900">
                          سعر القطعة لـ [{pieceCategory} - {pieceGrade === 'NEW_COLLECTION' ? 'كريمي' : (pieceGrade === 'MIDDLE' ? 'وسط' : 'تصفيات')}]:
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number" step="0.01" placeholder="0.00"
                            value={data.current}
                            onChange={e => setPiecePieceInput({ ...piecePriceInput, current: e.target.value })}
                            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-base font-black text-blue-900"
                          />
                          <button
                            type="button"
                            onClick={handleSavePiecePrice}
                            disabled={!hasChanged || saving}
                            className={`px-5 py-2.5 rounded-lg font-black text-xs transition shadow ${
                              hasChanged
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer animate-pulse'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {hasChanged ? 'حفظ سعر القطعة' : 'محفوظ ✓'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: HISTORY AUDIT LOG & REPORTS ==================== */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">من تاريخ:</label>
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold"
              />
              <label className="text-xs font-bold text-slate-600">إلى تاريخ:</label>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-black shadow transition cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير تقرير إكسيل CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black shadow transition cursor-pointer"
              >
                <Printer size={15} />
                <span>طباعة تقرير PDF رسمية</span>
              </button>
            </div>
          </div>

          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-y">
              <tr>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">اسم الصنف</th>
                <th className="p-3">النوع / الدرجة</th>
                <th className="p-3">طريقة التسعير</th>
                <th className="p-3 text-rose-600">السعر القديم</th>
                <th className="p-3 text-emerald-700">السعر الجديد</th>
                <th className="p-3">المستخدم المسئول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">لا توجد سجلات تغيير أسعار مسجلة في هذه الفترة</td>
                </tr>
              ) : (
                filteredHistory.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-slate-500">{new Date(h.created_at).toLocaleString('ar-EG')}</td>
                    <td className="p-3 font-black text-slate-900">{h.product_name}</td>
                    <td className="p-3 font-bold text-slate-700">{h.grade_display || h.grade}</td>
                    <td className="p-3 font-bold">{h.pricing_type === 'KG' ? '⚖️ بالوزن كجم' : '🔢 بالقطعة'}</td>
                    <td className="p-3 font-bold text-rose-500 line-through">{parseFloat(h.old_price).toFixed(2)} ج.م</td>
                    <td className="p-3 font-black text-emerald-700 text-sm">{parseFloat(h.new_price).toFixed(2)} ج.م</td>
                    <td className="p-3 font-bold text-slate-800">{h.changed_by_username || 'المدير العام'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
