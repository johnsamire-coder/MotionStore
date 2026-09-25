import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Tag, Save, Search, CheckCircle2, History, Scale, Package, DollarSign, User, Plus, Download, Printer } from 'lucide-react';

export default function ProductCodingPage() {
  const { t } = useLanguage();
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('CODING');

  // Common Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Tab 1: Coding
  const [codingForm, setCodingForm] = useState({
    name: '', code: '', barcode: '', category: '', unit_of_measure: 'PIECE', min_stock_level: '0.000', package_type: ''
  });

  // Tab 2: Pricing State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [prices, setPrices] = useState({
    kg_NEW_COLLECTION: { value: '', saved: '' },
    kg_MIDDLE: { value: '', saved: '' },
    kg_CLEARANCE: { value: '', saved: '' },
    piece_NEW_COLLECTION: { value: '', saved: '' },
    piece_MIDDLE: { value: '', saved: '' },
    piece_CLEARANCE: { value: '', saved: '' }
  });

  // Tab 3: History Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, hRes] = await Promise.all([
        axiosClient.get('/products/'), axiosClient.get('/categories/'), axiosClient.get('/price-history/')
      ]);
      const pList = pRes.data.results || pRes.data || [];
      const cList = cRes.data.results || cRes.data || [];
      const hList = hRes.data.results || hRes.data || [];

      setProducts(pList);
      setCategories(cList);
      if (cList.length > 0 && !codingForm.category) {
        setCodingForm(prev => ({ ...prev, category: cList[0].id }));
      }
      setPriceHistory(hList);
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
        const res = await axiosClient.post('/categories/', { name: catName });
        setCategories([...categories, res.data]);
        setCodingForm(prev => ({ ...prev, category: res.data.id }));
      } catch (err) { 
        alert('حدث خطأ أثناء إضافة التصنيف'); 
      }
    }
  };

  const handleSaveCoding = async (e) => {
    e.preventDefault();
    if (!codingForm.name || !codingForm.category) return alert('أكمل البيانات الأساسية');
    
    setSaving(true);
    try {
      await axiosClient.post('/products/', codingForm);
      setSuccessMsg('تم تكويد الصنف بنجاح ✅');
      fetchAllData();
      setCodingForm({ ...codingForm, name: '', code: '', barcode: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { 
      alert('فشل الحفظ'); 
    } finally {
      setSaving(false);
    }
  };

  const loadProductPrices = async (product) => {
    setSelectedProduct(product);
    try {
      const res = await axiosClient.get(`/price-list-items/?product=${product.id}`);
      const items = res.data.results || res.data || [];
      const newPrices = {
        kg_NEW_COLLECTION: { value: '', saved: '' },
        kg_MIDDLE: { value: '', saved: '' },
        kg_CLEARANCE: { value: '', saved: '' },
        piece_NEW_COLLECTION: { value: '', saved: '' },
        piece_MIDDLE: { value: '', saved: '' },
        piece_CLEARANCE: { value: '', saved: '' }
      };

      items.forEach(item => {
        if (parseFloat(item.price_per_kg) > 0) {
          newPrices[`kg_${item.grade}`] = { value: item.price_per_kg, saved: item.price_per_kg };
        }
        if (parseFloat(item.price_per_piece) > 0) {
          newPrices[`piece_${item.grade}`] = { value: item.price_per_piece, saved: item.price_per_piece };
        }
      });
      setPrices(newPrices);
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleSaveIndividualPrice = async (type, grade) => {
    const key = `${type}_${grade}`;
    const val = prices[key].value;
    if (!val) return;

    setSaving(true);
    try {
      const payload = {
        product: selectedProduct.id,
        grade: grade,
        price_per_kg: type === 'kg' ? val : '0.00',
        price_per_piece: type === 'piece' ? val : '0.00'
      };
      await axiosClient.post('/price-list-items/', payload);
      
      setPrices(prev => ({
        ...prev,
        [key]: { ...prev[key], saved: val }
      }));
      setSuccessMsg('تم تحديث السعر الفردي بنجاح ✅');
      setTimeout(() => setSuccessMsg(''), 2000);
      fetchAllData();
    } catch (err) {
      alert('فشل تحديث السعر');
    } finally {
      setSaving(false);
    }
  };

  const filteredHistory = priceHistory.filter(h => {
    const date = h.created_at ? h.created_at.split('T')[0] : '';
    return date >= startDate && date <= endDate;
  });

  const exportExcel = () => {
    const headers = ['التاريخ', 'الصنف', 'الدرجة', 'النوع', 'السعر القديم', 'السعر الجديد', 'المستخدم'];
    const rows = filteredHistory.map(h => [
      new Date(h.created_at).toLocaleString('ar-EG'), h.product_name, h.grade_display || h.grade,
      h.pricing_type === 'KG' ? 'بالوزن' : 'بالقطعة', h.old_price, h.new_price, h.changed_by_username || 'المدير'
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `سجل_الأسعار_${startDate}_إلى_${endDate}.csv`;
    link.click();
  };

  const printPDF = () => {
    window.print();
  };

  const renderPriceRow = (title, type, grade, icon) => {
    const key = `${type}_${grade}`;
    const data = prices[key] || { value: '', saved: '' };
    const hasChanged = data.value !== '' && data.value !== data.saved;

    return (
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">{icon}</div>
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-slate-500">{title}</label>
          <input
            type="number" step="0.01" placeholder="0.00"
            value={data.value}
            onChange={e => setPrices(prev => ({ ...prev, [key]: { ...prev[key], value: e.target.value } }))}
            className="w-full font-black text-slate-900 bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none p-1"
          />
        </div>
        <button
          onClick={() => handleSaveIndividualPrice(type, grade)}
          disabled={!hasChanged || saving}
          className={`px-4 py-2 rounded-lg font-black text-xs transition shadow-sm ${
            hasChanged ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer animate-pulse' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {hasChanged ? 'حفظ السعر' : 'محفوظ'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      
      {/* Hidden Print Header (Only shows on PDF Print) */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-3xl font-black text-slate-900">{tenant?.name || 'شركة الرميس لتجارة البالات'}</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">تقرير سجل تغيرات الأسعار التاريخي</p>
        <p className="text-xs text-slate-500">الفترة من {startDate} إلى {endDate}</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-600" /> إدارة التكويد والتسعير الشاملة
          </h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('CODING')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'CODING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>1. التكويد</button>
          <button onClick={() => setActiveTab('PRICING')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'PRICING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>2. التسعير الفردي</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>3. سجل التاريخ</button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="text-emerald-600" size={18} /> {successMsg}
        </div>
      )}

      {/* TAB 1: CODING */}
      {activeTab === 'CODING' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          <form onSubmit={handleSaveCoding} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات التكويد الأساسية</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف *</label>
                <input type="text" value={codingForm.name} onChange={e => setCodingForm({ ...codingForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الكود الداخلي</label>
                <input type="text" value={codingForm.code} onChange={e => setCodingForm({ ...codingForm, code: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الباركود الدولي</label>
                <input type="text" value={codingForm.barcode} onChange={e => setCodingForm({ ...codingForm, barcode: e.target.value })} className="w-full bg-slate-50 border rounded-lg p-2 text-xs font-mono" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف الرئيسي *</label>
                <div className="flex gap-2">
                  <select value={codingForm.category} onChange={e => setCodingForm({ ...codingForm, category: e.target.value })} className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" required>
                    {categories.length === 0 && <option value="">لا توجد تصنيفات</option>}
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={handleAddCategory} className="bg-slate-800 text-white px-3 rounded-lg hover:bg-slate-700 transition cursor-pointer" title="إضافة تصنيف جديد"><Plus size={16} /></button>
                </div>
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-black text-sm transition mt-4 cursor-pointer">{saving ? 'جاري الحفظ...' : 'حفظ وتكويد الصنف'}</button>
          </form>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL PRICING */}
      {activeTab === 'PRICING' && (
        <div className="space-y-6 print:hidden">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="block text-xs font-bold text-slate-600 mb-2">اختر الصنف المراد تسعيره وتعديله:</label>
            <select
              onChange={e => loadProductPrices(products.find(p => p.id === e.target.value))}
              value={selectedProduct?.id || ''}
              className="w-full md:w-1/2 bg-slate-50 border border-emerald-300 rounded-lg p-3 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>--- اختر صنفاً ---</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code || p.barcode || 'بدون كود'})</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weight Pricing */}
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-200 space-y-4">
                <h3 className="text-sm font-black text-emerald-900 flex items-center gap-2 border-b border-emerald-200 pb-2">
                  <Scale size={18} /> تسعير الأوزان (للكيلو)
                </h3>
                <div className="space-y-3">
                  {renderPriceRow('سعر الكيلو (كريمة / سوبر لوكس)', 'kg', 'NEW_COLLECTION', '✨')}
                  {renderPriceRow('سعر الكيلو (وسط / درجة ثانية)', 'kg', 'MIDDLE', '📦')}
                  {renderPriceRow('سعر الكيلو (تصفيات / شعبي)', 'kg', 'CLEARANCE', '🏷️')}
                </div>
              </div>

              {/* Piece Pricing */}
              <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-200 space-y-4">
                <h3 className="text-sm font-black text-blue-900 flex items-center gap-2 border-b border-blue-200 pb-2">
                  <Package size={18} /> تسعير القطع (للقطعة)
                </h3>
                <div className="space-y-3">
                  {renderPriceRow('سعر القطعة (نوع كريمة)', 'piece', 'NEW_COLLECTION', '✨')}
                  {renderPriceRow('سعر القطعة (نوع وسط)', 'piece', 'MIDDLE', '👗')}
                  {renderPriceRow('سعر القطعة (نوع تصفيات)', 'piece', 'CLEARANCE', '👕')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY AUDIT LOG */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 print:hidden">
            <div className="flex items-center gap-3">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold" />
              <span className="text-slate-400 font-bold">إلى</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold" />
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="flex items-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer">
                <Download size={14} /> تصدير إكسيل CSV
              </button>
              <button onClick={printPDF} className="flex items-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer">
                <Printer size={14} /> طباعة PDF
              </button>
            </div>
          </div>

          <table className="w-full text-right text-xs mt-4">
            <thead className="bg-slate-100 text-slate-700 font-black border-y">
              <tr>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">الصنف</th>
                <th className="p-3">النوع/الدرجة</th>
                <th className="p-3">طريقة التسعير</th>
                <th className="p-3 text-rose-600">السعر القديم</th>
                <th className="p-3 text-emerald-700">السعر الجديد</th>
                <th className="p-3">المستخدم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredHistory.map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500 font-mono">{new Date(h.created_at).toLocaleString('ar-EG')}</td>
                  <td className="p-3 font-black text-slate-900">{h.product_name}</td>
                  <td className="p-3 font-bold text-slate-700">{h.grade_display || h.grade}</td>
                  <td className="p-3">{h.pricing_type === 'KG' ? '⚖️ وزن' : '🔢 قطعة'}</td>
                  <td className="p-3 font-bold text-rose-500 line-through">{parseFloat(h.old_price).toFixed(2)}</td>
                  <td className="p-3 font-black text-emerald-600">{parseFloat(h.new_price).toFixed(2)}</td>
                  <td className="p-3 text-slate-600">{h.changed_by_username || 'مدير'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
