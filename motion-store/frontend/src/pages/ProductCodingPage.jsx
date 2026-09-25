import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Tag, Save, Search, CheckCircle2, History, Scale, Package, Plus, Download, Printer } from 'lucide-react';

export default function ProductCodingPage() {
  const { t } = useLanguage();
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('CODING');

  // Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Tab 1: Coding Form
  const [codingForm, setCodingForm] = useState({
    name: '', code: '', barcode: '', category: '', unit_of_measure: 'PIECE', min_stock_level: '0.000', package_type: ''
  });

  // Tab 2: Individual Pricing State
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Pricing State for BOTH Weights and Pieces
  const [prices, setPrices] = useState({
    kg_NEW_COLLECTION: { current: '', saved: '' },
    kg_MIDDLE: { current: '', saved: '' },
    kg_CLEARANCE: { current: '', saved: '' },
    piece_NEW_COLLECTION: { current: '', saved: '' },
    piece_MIDDLE: { current: '', saved: '' },
    piece_CLEARANCE: { current: '', saved: '' }
  });

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const catName = prompt('أدخل اسم التصنيف الجديد:');
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
      setCodingForm({ ...codingForm, name: '', code: '', barcode: '' });
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل حفظ الصنف');
    } finally {
      setSaving(false);
    }
  };

  const loadProductPrices = async (product) => {
    if (!product) return;
    setSelectedProduct(product);
    try {
      const res = await axiosClient.get(`/price-list-items/?product=${product.id}`);
      const items = res.data.results || res.data || [];
      
      const newPrices = {
        kg_NEW_COLLECTION: { current: '', saved: '' },
        kg_MIDDLE: { current: '', saved: '' },
        kg_CLEARANCE: { current: '', saved: '' },
        piece_NEW_COLLECTION: { current: '', saved: '' },
        piece_MIDDLE: { current: '', saved: '' },
        piece_CLEARANCE: { current: '', saved: '' }
      };

      items.forEach(item => {
        if (item.grade) {
          if (parseFloat(item.price_per_kg) > 0) {
            newPrices[`kg_${item.grade}`] = { current: item.price_per_kg, saved: item.price_per_kg };
          }
          if (parseFloat(item.price_per_piece) > 0) {
            newPrices[`piece_${item.grade}`] = { current: item.price_per_piece, saved: item.price_per_piece };
          }
        }
      });
      setPrices(newPrices);
    } catch (err) {
      console.error(err);
    }
  };

  // Smart Individual Save Function (For both KG and Piece)
  const handleSaveSinglePrice = async (type, grade) => {
    const key = `${type}_${grade}`;
    const val = prices[key].current;
    if (!val || parseFloat(val) <= 0) {
      alert('يرجى إدخال سعر صحيح');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product: selectedProduct.id,
        grade: grade,
        price_per_kg: type === 'kg' ? val : '0.00',
        price_per_piece: type === 'piece' ? val : '0.00'
      };
      await axiosClient.post('/price-list-items/', payload);

      setPrices(prev => ({ ...prev, [key]: { current: val, saved: val } }));
      setSuccessMsg(`تم تحديث السعر بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 2000);
      fetchAllData();
    } catch (err) {
      alert('فشل حفظ السعر');
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const headers = ['التاريخ', 'اسم الصنف', 'النوع / الدرجة', 'طريقة التسعير', 'السعر القديم', 'السعر الجديد', 'المستخدم'];
    const rows = filteredHistory.map(h => [
      new Date(h.created_at).toLocaleString('ar-EG'), h.product_name, h.grade_display || h.grade,
      h.pricing_type === 'KG' ? 'بالوزن كجم' : 'بالقطعة', h.old_price, h.new_price, h.changed_by_username || 'المدير'
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `سجل_الأسعار.csv`;
    link.click();
  };

  const filteredHistory = priceHistory.filter(h => {
    const date = h.created_at ? h.created_at.split('T')[0] : '';
    return date >= startDate && date <= endDate;
  });

  const renderPriceRow = (title, type, grade, icon) => {
    const key = `${type}_${grade}`;
    const data = prices[key];
    const hasChanged = data.current !== '' && data.current !== data.saved;

    return (
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-lg">{icon}</span>
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-slate-600">{title}</label>
          <input
            type="number" step="0.01" placeholder="0.00"
            value={data.current}
            onChange={e => setPrices({ ...prices, [key]: { ...data, current: e.target.value } })}
            className="w-full font-black text-slate-900 text-sm bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none p-0.5"
          />
        </div>
        <button
          type="button"
          onClick={() => handleSaveSinglePrice(type, grade)}
          disabled={!hasChanged || saving}
          className={`px-4 py-2 rounded-lg font-black text-xs transition shadow cursor-pointer ${
            hasChanged
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {hasChanged ? 'حفظ السعر' : 'محفوظ ✓'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      
      {/* Header Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Tag className="text-emerald-600"/> إدارة التكويد والتسعير</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('CODING')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'CODING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>1. التكويد الأساسي</button>
          <button onClick={() => setActiveTab('PRICING')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'PRICING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>2. التسعير الفردي الذكي</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>3. سجل التاريخ</button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm print:hidden">
          <CheckCircle2 className="text-emerald-600" size={18} /> {successMsg}
        </div>
      )}

      {/* TAB 1: CODING */}
      {activeTab === 'CODING' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          <form onSubmit={handleSaveCoding} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات التكويد الأساسية</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف *</label>
                <input type="text" value={codingForm.name} onChange={e => setCodingForm({ ...codingForm, name: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2.5 text-sm font-bold" required />
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">الكود</label><input type="text" value={codingForm.code} onChange={e => setCodingForm({ ...codingForm, code: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-mono" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">الباركود</label><input type="text" value={codingForm.barcode} onChange={e => setCodingForm({ ...codingForm, barcode: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-mono" /></div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف *</label>
                <div className="flex gap-2">
                  <select value={codingForm.category} onChange={e => setCodingForm({ ...codingForm, category: e.target.value })} className="flex-1 bg-slate-50 border rounded-lg p-2 text-xs font-bold" required>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={handleAddCategory} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-black cursor-pointer"><Plus size={16} /></button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">وحدة القياس</label>
                <select value={codingForm.unit_of_measure} onChange={e => setCodingForm({ ...codingForm, unit_of_measure: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-bold">
                  <option value="PIECE">قطعة / عدد</option><option value="KG">كيلو / كجم</option><option value="BOTH">قطعة + وزن</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">الحد الأدنى</label><input type="number" step="0.001" value={codingForm.min_stock_level} onChange={e => setCodingForm({ ...codingForm, min_stock_level: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-bold" /></div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-sm cursor-pointer mt-2">حفظ وتكويد الصنف</button>
          </form>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL DUAL PRICING */}
      {activeTab === 'PRICING' && (
        <div className="space-y-6 print:hidden">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-xs font-black text-slate-700 mb-2">اختر الصنف (لتسعير القطع أو الأوزان الخاصة به):</label>
            <select
              value={selectedProduct?.id || ''}
              onChange={e => loadProductPrices(products.find(p => p.id === e.target.value))}
              className="w-full md:w-1/2 bg-slate-50 border border-emerald-300 rounded-xl p-3 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>--- اختر صنفاً ---</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category_name || 'عام'})</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SECTION A: WEIGHT PRICING */}
              <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                  <Scale className="text-emerald-700" size={18} />
                  <h3 className="text-sm font-black text-emerald-950">1. تسعير الأوزان (سعر الكيلو لكل درجة)</h3>
                </div>
                <div className="space-y-3">
                  {renderPriceRow('سعر الكيلو (كريمة / سوبر لوكس)', 'kg', 'NEW_COLLECTION', '✨')}
                  {renderPriceRow('سعر الكيلو (وسط / درجة ثانية)', 'kg', 'MIDDLE', '📦')}
                  {renderPriceRow('سعر الكيلو (تصفيات / شعبي)', 'kg', 'CLEARANCE', '🏷️')}
                </div>
              </div>

              {/* SECTION B: PIECE PRICING */}
              <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
                  <Package className="text-blue-700" size={18} />
                  <h3 className="text-sm font-black text-blue-950">2. تسعير القطع (سعر القطعة لكل درجة)</h3>
                </div>
                <div className="space-y-3">
                  {renderPriceRow('سعر القطعة (نوع الكريمة)', 'piece', 'NEW_COLLECTION', '✨')}
                  {renderPriceRow('سعر القطعة (نوع الوسط)', 'piece', 'MIDDLE', '👗')}
                  {renderPriceRow('سعر القطعة (نوع التصفيات)', 'piece', 'CLEARANCE', '👕')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY AUDIT LOG */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4 border-b pb-4 print:hidden">
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold" />
            </div>
            <div className="flex gap-2">
              <button onClick={exportExcel} className="flex gap-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black cursor-pointer"><Download size={14}/> إكسيل</button>
              <button onClick={() => window.print()} className="flex gap-1 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-black cursor-pointer"><Printer size={14}/> طباعة</button>
            </div>
          </div>
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-y">
              <tr>
                <th className="p-3">التاريخ</th><th className="p-3">الصنف</th><th className="p-3">الدرجة</th>
                <th className="p-3">النوع</th><th className="p-3 text-rose-600">قديم</th><th className="p-3 text-emerald-700">جديد</th><th className="p-3">المستخدم</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {filteredHistory.map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="p-3">{new Date(h.created_at).toLocaleString('ar-EG')}</td>
                  <td className="p-3 font-black text-slate-900">{h.product_name}</td>
                  <td className="p-3">{h.grade_display || h.grade}</td>
                  <td className="p-3">{h.pricing_type === 'KG' ? '⚖️ وزن' : '🔢 قطعة'}</td>
                  <td className="p-3 font-bold text-rose-500 line-through">{parseFloat(h.old_price).toFixed(2)}</td>
                  <td className="p-3 font-black text-emerald-700">{parseFloat(h.new_price).toFixed(2)}</td>
                  <td className="p-3">{h.changed_by_username || 'المدير'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
