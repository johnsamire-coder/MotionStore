import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { Tag, Plus, Save, Search, CheckCircle2, History, Scale, Package, DollarSign, User, Clock } from 'lucide-react';

export default function ProductCodingPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('CODING'); // CODING | PRICING | HISTORY

  // Common Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Tab 1: Coding Form State
  const [codingForm, setCodingForm] = useState({
    name: '',
    code: '',
    barcode: '',
    wholesale_code: '',
    category: '',
    unit_of_measure: 'PIECE',
    purchase_price: '0.00',
    carton_price: '0.00',
    carton_capacity: '1.000',
    min_stock_level: '0.000',
    opening_balance: '0.000',
    package_type: ''
  });

  // Tab 2: Dual Pricing State (Per Selected Product)
  const [selectedProductForPrice, setSelectedProductForPrice] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    // Weight-Based Pricing (Per KG)
    kg_new_collection: '180.00',
    kg_middle: '90.00',
    kg_clearance: '30.00',
    // Piece-Based Pricing (Per Piece)
    piece_new_collection: '150.00',
    piece_middle: '75.00',
    piece_clearance: '25.00',
    notes: 'تحديث أسعار الموسم'
  });

  const uomList = [
    { value: 'PIECE', label: 'قطعة / عدد' },
    { value: 'KG', label: 'كيلو / كجم' },
    { value: 'BOTH', label: 'قطعة + وزن' },
    { value: 'BALE', label: 'باله' },
    { value: 'DOZEN', label: 'دسته' },
    { value: 'CARTON', label: 'كرتونه' },
    { value: 'SACK', label: 'شيكارة' },
    { value: 'BARREL', label: 'برميل' },
    { value: 'BOX', label: 'علبة' },
    { value: 'JAR', label: 'برطمان' },
    { value: 'JERRYCAN', label: 'جركن' },
    { value: 'LITER', label: 'لتر' },
    { value: 'BAG', label: 'كيس' },
    { value: 'TANK', label: 'تنك' },
    { value: 'BUNDLE', label: 'هبط' },
    { value: 'SET', label: 'مجموعة' },
    { value: 'EMPTY', label: 'فوارغ' },
    { value: 'CARD', label: 'كارت' },
    { value: 'TOTE', label: 'شنطة' },
    { value: 'LIST', label: 'لسته' },
    { value: 'OTHER', label: 'غير محدد' }
  ];

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

      if (cList.length > 0) {
        setCodingForm(prev => ({ ...prev, category: cList[0].id }));
      }
      if (pList.length > 0 && !selectedProductForPrice) {
        setSelectedProductForPrice(pList[0]);
      }
    } catch (err) {
      console.error('فشل جلب البيانات:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tab 1: Save Coding
  const handleSaveCoding = async (e) => {
    if (e) e.preventDefault();
    if (!codingForm.name.trim()) {
      alert('يرجى إدخال اسم الصنف');
      return;
    }
    if (!codingForm.category) {
      alert('يرجى اختيار أو إنشاء تصنيف أولاً');
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
        wholesale_code: '',
        category: categories[0]?.id || '',
        unit_of_measure: 'PIECE',
        purchase_price: '0.00',
        carton_price: '0.00',
        carton_capacity: '1.000',
        min_stock_level: '0.000',
        opening_balance: '0.000',
        package_type: ''
      });
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل حفظ الصنف');
    } finally {
      setSaving(false);
    }
  };

  // Tab 2: Save Dual Pricing
  const handleSavePricing = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProductForPrice) {
      alert('يرجى اختيار صنف لتسعيره');
      return;
    }

    setSaving(true);
    try {
      // Get Default Price List
      const plRes = await axiosClient.get('/price-lists/');
      const defaultPL = (plRes.data.results || plRes.data || [])[0];

      if (!defaultPL) {
        alert('لم يتم العثور على قائمة أسعار افتراضية!');
        setSaving(false);
        return;
      }

      // Save KG Prices (New Collection, Middle, Clearance)
      const grades = [
        { grade: 'NEW_COLLECTION', kg_price: pricingForm.kg_new_collection, piece_price: pricingForm.piece_new_collection },
        { grade: 'MIDDLE', kg_price: pricingForm.kg_middle, piece_price: pricingForm.piece_middle },
        { grade: 'CLEARANCE', kg_price: pricingForm.kg_clearance, piece_price: pricingForm.piece_clearance }
      ];

      for (const g of grades) {
        await axiosClient.post('/price-list-items/', {
          price_list: defaultPL.id,
          product: selectedProductForPrice.id,
          grade: g.grade,
          price_per_kg: parseFloat(g.kg_price || 0),
          price_per_piece: parseFloat(g.piece_price || 0)
        });
      }

      setSuccessMsg(`تم تحديث مصفوفة أسعار "${selectedProductForPrice.name}" وتسجيل التاريخ بنجاح ✅`);
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || 'حدث خطأ أثناء حفظ الأسعار');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Header & Tabs Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-600" />
            إدارة تكويد وتسعير البالات والقطع (F4)
          </h1>
          <p className="text-xs text-slate-500 mt-1">تكويد الأصناف، تسعير القطع والأوزان، وسجل تاريخ الأسعار والمستخدمين</p>
        </div>

        {/* 3 Tabs Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('CODING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'CODING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag size={15} />
            <span>1. تكويد صنف جديد</span>
          </button>

          <button
            onClick={() => setActiveTab('PRICING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'PRICING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={15} />
            <span>2. مصفوفة تسعير (قطع/أوزان)</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} />
            <span>3. سجل تغيرات الأسعار</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      {/* ==================== TAB 1: PRODUCT CODING ==================== */}
      {activeTab === 'CODING' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveCoding} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات التكويد الأساسية</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف / الاستوك *</label>
                <input
                  type="text"
                  value={codingForm.name}
                  onChange={e => setCodingForm({ ...codingForm, name: e.target.value })}
                  placeholder="مثال: تيشرت حريمي أوفر سايز"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">كود الصنف الداخلي</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف الرئيسي</label>
                <select
                  value={codingForm.category}
                  onChange={e => setCodingForm({ ...codingForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">وحدة القياس</label>
                <select
                  value={codingForm.unit_of_measure}
                  onChange={e => setCodingForm({ ...codingForm, unit_of_measure: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                >
                  {uomList.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">نوع العبوة</label>
                <input
                  type="text"
                  placeholder="كرتونة / شيكارة"
                  value={codingForm.package_type}
                  onChange={e => setCodingForm({ ...codingForm, package_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الحد الأدنى للرصيد</label>
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ الصنف (F1)'}</span>
            </button>
          </form>

          {/* Coded Products List Table */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-sm font-black text-slate-800">الأصناف المكودة بالفهرس ({filteredProducts.length})</h2>
              <div className="relative w-64">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو الكود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-9 pl-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-2.5">الكود</th>
                    <th className="p-2.5">اسم الصنف</th>
                    <th className="p-2.5">التصنيف</th>
                    <th className="p-2.5">الوحدة</th>
                    <th className="p-2.5 text-center">الحد الأدنى</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono font-bold text-slate-600">{p.code || p.barcode || '—'}</td>
                      <td className="p-2.5 font-black text-slate-900">{p.name}</td>
                      <td className="p-2.5 text-slate-500">{p.category_name || 'عام'}</td>
                      <td className="p-2.5 font-bold text-slate-700">{p.unit_of_measure}</td>
                      <td className="p-2.5 text-center text-slate-600">{p.min_stock_level || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: DUAL PRICING MATRIX ==================== */}
      {activeTab === 'PRICING' && (
        <form onSubmit={handleSavePricing} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <DollarSign className="text-emerald-600" size={18} />
                تحديد أسعار القطع والأوزان للصنف المحدد
              </h2>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600">اختر الصنف المراد تسعيره:</label>
                <select
                  value={selectedProductForPrice?.id || ''}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    setSelectedProductForPrice(prod);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-black text-slate-900 min-w-[240px]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category_name || 'عام'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* SECTION A: WEIGHT PRICING (PER KG) */}
              <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                  <Scale className="text-emerald-700" size={18} />
                  <h3 className="text-xs font-black text-emerald-950">1. تسعير الأوزان (سعر الكيلو لكل درجة)</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">✨ سعر الكيلو (كريمة / سوبر لوكس)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.kg_new_collection}
                        onChange={e => setPricingForm({ ...pricingForm, kg_new_collection: e.target.value })}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg p-2.5 text-sm font-black text-emerald-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / كجم</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">📦 سعر الكيلو (وسط / درجة ثانية)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.kg_middle}
                        onChange={e => setPricingForm({ ...pricingForm, kg_middle: e.target.value })}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg p-2.5 text-sm font-black text-emerald-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / كجم</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">🏷️ سعر الكيلو (تصفيات / شعبي)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.kg_clearance}
                        onChange={e => setPricingForm({ ...pricingForm, kg_clearance: e.target.value })}
                        className="flex-1 bg-white border border-emerald-300 rounded-lg p-2.5 text-sm font-black text-emerald-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / كجم</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: PIECE PRICING (PER PIECE) */}
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
                  <Package className="text-blue-700" size={18} />
                  <h3 className="text-xs font-black text-blue-950">2. تسعير القطع (حسب التصنيف والنوع)</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">✨ سعر القطعة (نوع الكريمة)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.piece_new_collection}
                        onChange={e => setPricingForm({ ...pricingForm, piece_new_collection: e.target.value })}
                        className="flex-1 bg-white border border-blue-300 rounded-lg p-2.5 text-sm font-black text-blue-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / قطعة</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">📦 سعر القطعة (نوع الوسط)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.piece_middle}
                        onChange={e => setPricingForm({ ...pricingForm, piece_middle: e.target.value })}
                        className="flex-1 bg-white border border-blue-300 rounded-lg p-2.5 text-sm font-black text-blue-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / قطعة</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">🏷️ سعر القطعة (نوع التصفيات)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={pricingForm.piece_clearance}
                        onChange={e => setPricingForm({ ...pricingForm, piece_clearance: e.target.value })}
                        className="flex-1 bg-white border border-blue-300 rounded-lg p-2.5 text-sm font-black text-blue-900"
                      />
                      <span className="text-xs font-bold text-slate-500">ج.م / قطعة</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-between">
              <input
                type="text"
                placeholder="سبب التعديل أو ملاحظات التسعير..."
                value={pricingForm.notes}
                onChange={e => setPricingForm({ ...pricingForm, notes: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs w-1/2"
              />

              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                <Save size={18} />
                <span>{saving ? 'جاري الحفظ...' : 'اعتماد الأسعار وتسجيل السجل'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ==================== TAB 3: PRICE CHANGE AUDIT LOG ==================== */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <History className="text-indigo-600" size={18} />
              سجل التغييرات التاريخية للأسعار ({priceHistory.length})
            </h2>
            <span className="text-xs text-slate-500">موثق باليوم والساعة والمستخدم المسئول</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black border-y">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3">الدرجة / النوع</th>
                  <th className="p-3">نوع التسعير</th>
                  <th className="p-3">السعر القديم</th>
                  <th className="p-3">السعر الجديد</th>
                  <th className="p-3">المستخدم / الكاشير</th>
                  <th className="p-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {priceHistory.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-slate-400">لا توجد سجلات تغيير أسعار مسجلة بعد</td>
                  </tr>
                ) : (
                  priceHistory.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-500 font-mono">
                        {new Date(h.created_at).toLocaleString('ar-EG')}
                      </td>
                      <td className="p-3 font-black text-slate-900">{h.product_name}</td>
                      <td className="p-3 font-bold text-slate-700">{h.grade_display || h.grade}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.pricing_type === 'KG' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {h.pricing_type === 'KG' ? '⚖️ بالوزن كجم' : '🔢 بالقطعة'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-rose-600 line-through">{parseFloat(h.old_price).toFixed(2)} ج.م</td>
                      <td className="p-3 font-black text-emerald-700 text-sm">{parseFloat(h.new_price).toFixed(2)} ج.م</td>
                      <td className="p-3 font-bold text-slate-800 flex items-center gap-1">
                        <User size={12} className="text-slate-400" />
                        {h.changed_by_username || 'المدير العام'}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{h.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
