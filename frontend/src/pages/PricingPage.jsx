import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  PlusCircle, Save, Tag, RefreshCw, CheckCircle2, AlertCircle, Layers, DollarSign, Plus, Clock, Calendar, History, Box
} from 'lucide-react';

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState('coding'); // 'coding' or 'pricing'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Tab 1: Product Coding Form State
  const [prodName, setProdName] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodUom, setProdUom] = useState('PIECE');

  // Tab 2: Historical Pricing Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [prices, setPrices] = useState({
    NEW_KG: '300', NEW_PC: '150',
    MIDDLE_KG: '150', MIDDLE_PC: '75',
    CLEARANCE_KG: '50', CLEARANCE_PC: '25'
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, priceRes] = await Promise.all([
        axiosClient.get('/products/').catch(() => ({ data: [] })),
        axiosClient.get('/products/categories/').catch(() => ({ data: [] })),
        axiosClient.get('/pricing/price-list-items/').catch(() => ({ data: [] }))
      ]);

      const prodData = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.results || []);
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data.results || []);
      const priceData = Array.isArray(priceRes.data) ? priceRes.data : (priceRes.data.results || []);

      setProducts(prodData);
      setCategories(catData);
      setPriceHistory(priceData);

      if (catData.length > 0 && !prodCat) setProdCat(catData[0].id);
      if (prodData.length > 0 && !selectedProductId) setSelectedProductId(prodData[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Action 1: Save Product Coding ONLY
  const handleSaveProductOnly = async (e) => {
    e.preventDefault();
    if (!prodName.trim()) {
      setMessage({ type: 'error', text: 'يرجى كتابة اسم الصنف / الاستوك' });
      return;
    }

    try {
      setLoading(true);
      const prodPayload = {
        name: prodName.trim(),
        code: prodCode.trim() || `COD-${Math.floor(1000 + Math.random()*9000)}`,
        category: (prodCat && prodCat !== "") ? prodCat : null,
        unit_of_measure: prodUom,
        is_active: true
      };

      const res = await axiosClient.post('/products/', prodPayload);
      const createdProd = res.data;

      setMessage({ type: 'success', text: `تم تكويد الصنف (${createdProd.name}) بنجاح! يمكنك الآن الانتقال لتبويب التسعير.` });
      setProdName('');
      setProdCode('');
      fetchInitialData();
    } catch (err) {
      console.error("Prod Error:", err);
      console.error("Prod Save Error:", err.response?.data || err);
      let errMsg = 'حدث خطأ أثناء تكويد الصنف، تأكد من الكود والبيانات.';
      if (err.response?.data?.code) errMsg = 'كود الصنف مستخدم مسبقاً، اختر كوداً آخر.';
      if (err.response?.data?.name) errMsg = 'يرجى كتابة اسم صنف صحيح.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  // Action 2: Save Price Entry with Date & Time Timestamp
  const handleSavePriceWithDate = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setMessage({ type: 'error', text: 'اختر الصنف المراد تسعيره أولاً' });
      return;
    }

    const targetProd = products.find(p => p.id === selectedProductId);

    try {
      setLoading(true);
      const nowStamp = new Date().toLocaleString('ar-EG');

      const priceListItems = [
        { grade: 'NEW', price_per_kg: parseFloat(prices.NEW_KG || 0), price_per_piece: parseFloat(prices.NEW_PC || 0) },
        { grade: 'MIDDLE', price_per_kg: parseFloat(prices.MIDDLE_KG || 0), price_per_piece: parseFloat(prices.MIDDLE_PC || 0) },
        { grade: 'CLEARANCE', price_per_kg: parseFloat(prices.CLEARANCE_KG || 0), price_per_piece: parseFloat(prices.CLEARANCE_PC || 0) },
      ];

      for (const item of priceListItems) {
        await axiosClient.post('/pricing/price-list-items/', {
          product: selectedProductId,
          grade: item.grade,
          price_per_kg: item.price_per_kg,
          price_per_piece: item.price_per_piece,
          is_active: true
        });
      }

      setMessage({ type: 'success', text: `تم تسجيل وتحديث أسعار (${targetProd?.name || 'الصنف'}) بتاريخ ووقت اللحظة (${nowStamp})!` });
      fetchInitialData();
    } catch (err) {
      console.error("Price Error:", err);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ خطة التسعير' });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (key, value) => {
    setPrices(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen space-y-4 select-none">
      
      {/* Page Header */}
      <div className="bg-white border border-slate-300 rounded shadow-sm p-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" /> إدارة التكويد والتسعير التاريخي للمنتجات
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            فصل تام بين تكويد أصناف المحل وبين تحديث الأسعار مع الاحتفاظ بسجل وتاريخ التغييرات.
          </p>
        </div>

        {message.text && (
          <div className={`px-4 py-2 rounded text-xs font-bold shadow ${
            message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-300 bg-white rounded-t shadow-sm px-2 pt-2 gap-2">
        <button 
          onClick={() => setActiveTab('coding')}
          className={`px-4 py-2 text-xs font-bold rounded-t flex items-center gap-2 border-t border-x transition-all ${
            activeTab === 'coding' 
              ? 'bg-blue-900 text-white border-blue-950' 
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Box className="w-4 h-4" /> 1. تكويد صنف جديد (مرة واحدة)
        </button>

        <button 
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 text-xs font-bold rounded-t flex items-center gap-2 border-t border-x transition-all ${
            activeTab === 'pricing' 
              ? 'bg-emerald-800 text-white border-emerald-950' 
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <History className="w-4 h-4" /> 2. تحديث وتسجيل الأسعار والتاريخ
        </button>
      </div>

      {/* TAB 1: PRODUCT CODING ONLY */}
      {activeTab === 'coding' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7 bg-white border border-slate-300 rounded shadow-sm p-4 space-y-4">
            <h2 className="text-sm font-bold text-blue-950 border-b pb-2 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" /> تكويد صنف / استوك جديد
            </h2>

            <form onSubmit={handleSaveProductOnly} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الصنف / الاستوك *</label>
                  <input 
                    type="text" 
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="مثال: بلوزة حريمي / استوك زارا"
                    className="w-full border border-slate-300 rounded p-2 font-semibold focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكود / الباركوود (مثال: 8776)</label>
                  <input 
                    type="text" 
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    placeholder="كود الصنف..."
                    className="w-full border border-slate-300 rounded p-2 font-mono font-bold bg-amber-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف</label>
                  <select 
                    value={prodCat}
                    onChange={(e) => setProdCat(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 bg-white font-semibold"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">وحدة البيع الافتراضية</label>
                  <select 
                    value={prodUom}
                    onChange={(e) => setProdUom(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 bg-white font-semibold"
                  >
                    <option value="PIECE">🔢 بالقطعة</option>
                    <option value="KG">⚖️ بالوزن (كجم)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold p-2.5 rounded shadow text-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> حفظ تكويد الصنف
                </button>
              </div>
            </form>
          </div>

          <div className="col-span-5 bg-white border border-slate-300 rounded shadow-sm p-4 h-[420px] flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">الأصناف المكودة في السيستم ({products.length})</h2>
            <div className="flex-1 overflow-auto mt-2">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 font-bold">
                  <tr>
                    <th className="p-2 border-x">الكود</th>
                    <th className="p-2 border-x">اسم الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 border-x font-mono font-bold text-slate-500">{p.code || '---'}</td>
                      <td className="p-2 border-x font-bold text-slate-800">{p.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORICAL PRICING WITH TIMESTAMP */}
      {activeTab === 'pricing' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7 bg-white border border-slate-300 rounded shadow-sm p-4 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" /> تحديث أسعار درجات الصنف (تاريخ اليوم واللحظة)
              </h2>
              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleString('ar-EG')}
              </span>
            </div>

            <form onSubmit={handleSavePriceWithDate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الصنف المراد تسعيره *</label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-bold bg-amber-50 text-blue-950 focus:bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (الكود: {p.code || 'بدون'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Price Grid for 3 Grades */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800 text-white font-bold">
                    <tr>
                      <th className="p-2 border-x">الدرجة</th>
                      <th className="p-2 border-x text-center bg-blue-900">سعر الكيلو (ج.م)</th>
                      <th className="p-2 border-x text-center bg-emerald-900">سعر القطعة (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-slate-50">
                    <tr>
                      <td className="p-2 font-bold text-amber-900 bg-amber-100/60">✨ كريمة (New)</td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.NEW_KG} 
                          onChange={(e) => handlePriceChange('NEW_KG', e.target.value)}
                          className="w-24 text-center font-bold text-blue-900 border rounded p-1"
                        />
                      </td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.NEW_PC} 
                          onChange={(e) => handlePriceChange('NEW_PC', e.target.value)}
                          className="w-24 text-center font-bold text-emerald-900 border rounded p-1"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-2 font-bold text-blue-900 bg-blue-100/60">📦 وسط (Middle)</td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.MIDDLE_KG} 
                          onChange={(e) => handlePriceChange('MIDDLE_KG', e.target.value)}
                          className="w-24 text-center font-bold text-blue-900 border rounded p-1"
                        />
                      </td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.MIDDLE_PC} 
                          onChange={(e) => handlePriceChange('MIDDLE_PC', e.target.value)}
                          className="w-24 text-center font-bold text-emerald-900 border rounded p-1"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-2 font-bold text-rose-900 bg-rose-100/60">🏷️ تصفيات (Clearance)</td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.CLEARANCE_KG} 
                          onChange={(e) => handlePriceChange('CLEARANCE_KG', e.target.value)}
                          className="w-24 text-center font-bold text-blue-900 border rounded p-1"
                        />
                      </td>
                      <td className="p-1 border-x text-center">
                        <input 
                          type="number" 
                          value={prices.CLEARANCE_PC} 
                          onChange={(e) => handlePriceChange('CLEARANCE_PC', e.target.value)}
                          className="w-24 text-center font-bold text-emerald-900 border rounded p-1"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold p-2.5 rounded shadow text-sm flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> تسجيل السعر وتحديث الفواتير بتاريخ اليوم
              </button>
            </form>
          </div>

          {/* Historical Log Table */}
          <div className="col-span-5 bg-white border border-slate-300 rounded shadow-sm p-4 h-[460px] flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" /> سجل تغيرات الأسعار التاريخي ({priceHistory.length})
            </h2>

            <div className="flex-1 overflow-auto mt-2 text-xs">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-100 sticky top-0 font-bold text-slate-700">
                  <tr>
                    <th className="p-1.5 border-x">التاريخ/الوقت</th>
                    <th className="p-1.5 border-x">الدرجة</th>
                    <th className="p-1.5 border-x text-center">الكيلو</th>
                    <th className="p-1.5 border-x text-center">القطعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priceHistory.slice(0, 15).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 border-x font-mono text-[10px] text-slate-500">
                        {item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : 'الآن'}
                      </td>
                      <td className="p-1.5 border-x font-bold">
                        {item.grade === 'NEW' ? '✨ كريمة' : item.grade === 'MIDDLE' ? '📦 وسط' : '🏷️ تصفيات'}
                      </td>
                      <td className="p-1.5 border-x text-center font-bold text-blue-900">
                        {parseFloat(item.price_per_kg || 0).toFixed(2)}
                      </td>
                      <td className="p-1.5 border-x text-center font-bold text-emerald-700">
                        {parseFloat(item.price_per_piece || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}