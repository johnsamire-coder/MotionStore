import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  PlusCircle, Save, Tag, RefreshCw, CheckCircle2, AlertCircle, Layers, DollarSign, Plus
} from 'lucide-react';

export default function PricingPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // New Category State
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Manager Form State
  const [prodName, setProdName] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodUom, setProdUom] = useState('PIECE');

  // Grade Prices
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
      const [prodRes, catRes] = await Promise.all([
        axiosClient.get('/products/').catch(() => ({ data: [] })),
        axiosClient.get('/products/categories/').catch(() => ({ data: [] }))
      ]);

      const prodData = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.results || []);
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data.results || []);

      setProducts(prodData);
      setCategories(catData);
      if (catData.length > 0) {
        setProdCat(catData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      setLoading(true);
      const res = await axiosClient.post('/products/categories/', {
        name: newCatName.trim(),
        code: `CAT-${Math.floor(100 + Math.random()*900)}`,
        is_active: true
      });

      const createdCat = res.data;
      setCategories(prev => [...prev, createdCat]);
      setProdCat(createdCat.id);
      setNewCatName('');
      setShowAddCat(false);
      setMessage({ type: 'success', text: `تم إضافة تصنيف: ${createdCat.name}` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء إضافة التصنيف' });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (key, value) => {
    setPrices(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveProductAndPricing = async (e) => {
    e.preventDefault();
    if (!prodName) {
      setMessage({ type: 'error', text: 'يرجى كتابة اسم الصنف / الاستوك' });
      return;
    }

    try {
      setLoading(true);
      // 1. Create Product
      const prodPayload = {
        name: prodName,
        code: prodCode || `COD-${Math.floor(1000 + Math.random()*9000)}`,
        category: prodCat || null,
        unit_of_measure: prodUom,
        selling_price: parseFloat(prices.MIDDLE_PC || 100),
        is_active: true
      };

      const prodRes = await axiosClient.post('/products/', prodPayload);
      const createdProd = prodRes.data;

      // 2. Setup Price List Items for all 3 Grades
      const priceListItems = [
        { grade: 'NEW', price_per_kg: parseFloat(prices.NEW_KG), price_per_piece: parseFloat(prices.NEW_PC) },
        { grade: 'MIDDLE', price_per_kg: parseFloat(prices.MIDDLE_KG), price_per_piece: parseFloat(prices.MIDDLE_PC) },
        { grade: 'CLEARANCE', price_per_kg: parseFloat(prices.CLEARANCE_KG), price_per_piece: parseFloat(prices.CLEARANCE_PC) },
      ];

      for (const item of priceListItems) {
        await axiosClient.post('/pricing/price-list-items/', {
          product: createdProd.id,
          grade: item.grade,
          price_per_kg: item.price_per_kg,
          price_per_piece: item.price_per_piece,
          is_active: true
        }).catch(() => {});
      }

      setMessage({ type: 'success', text: `تم تكويد وتسعير الصنف (${prodName}) بنجاح وإرساله للكاشير!` });
      
      // Reset Form
      setProdName('');
      setProdCode('');
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ التكويد والتسعير' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen space-y-4 select-none">
      
      {/* Header Title */}
      <div className="bg-white border border-slate-300 rounded shadow-sm p-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" /> شاشة التكويد والتسعير الموحد (للمدير والمشرفين)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            قم بتكويد الصنف وتحديد أسعار درجاته (كريمة - وسط - تصفيات) في خطوة واحدة لتظهر فوراً لدى كافة أجهزة الكاشير.
          </p>
        </div>

        {message.text && (
          <div className={`px-4 py-2 rounded text-xs font-bold ${
            message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        
        {/* Unified Setup Form (7 Cols) */}
        <div className="col-span-7 bg-white border border-slate-300 rounded shadow-sm p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" /> 1. بيانات الصنف / الاستوك الأساسية
          </h2>

          <form onSubmit={handleSaveProductAndPricing} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الصنف / الاستوك *</label>
                <input 
                  type="text" 
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="مثال: بلوزة حريمي / استوك زارا"
                  className="w-full border border-slate-300 rounded p-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكود (مثال: 8776)</label>
                <input 
                  type="text" 
                  value={prodCode}
                  onChange={(e) => setProdCode(e.target.value)}
                  placeholder="اكتب كود الصنف..."
                  className="w-full border border-slate-300 rounded p-2 text-xs font-mono font-bold bg-amber-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">التصنيف الرئيسي</label>
                  <button 
                    type="button"
                    onClick={() => setShowAddCat(!showAddCat)}
                    className="text-emerald-700 font-bold hover:underline text-[11px] flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> تصنيف جديد
                  </button>
                </div>

                {showAddCat ? (
                  <div className="flex gap-1">
                    <input 
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="اسم التصنيف الجديد..."
                      className="w-full border rounded p-1 text-xs"
                    />
                    <button 
                      type="button" 
                      onClick={handleCreateCategory}
                      className="bg-emerald-700 text-white px-2 py-1 rounded font-bold"
                    >
                      حفظ
                    </button>
                  </div>
                ) : (
                  <select 
                    value={prodCat}
                    onChange={(e) => setProdCat(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-semibold"
                  >
                    {categories.length === 0 ? (
                      <option value="">لا توجد تصنيفات - اضغط إضافة تصنيف</option>
                    ) : (
                      categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    )}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وحدة البيع الافتراضية</label>
                <select 
                  value={prodUom}
                  onChange={(e) => setProdUom(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs bg-white font-semibold"
                >
                  <option value="PIECE">🔢 بالقطعة</option>
                  <option value="KG">⚖️ بالوزن (كجم)</option>
                </select>
              </div>
            </div>

            {/* Dynamic Multi-Grade Price Grid Setup */}
            <div className="pt-2 border-t">
              <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> 2. شبكة تسعير الدرجات (كريمة / وسط / تصفيات)
              </h2>

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
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold p-2.5 rounded shadow text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Save className="w-5 h-5" /> حفظ التكويد والتسعير وإرساله للكاشير
              </button>
            </div>

          </form>
        </div>

        {/* Existing Products List (5 Cols) */}
        <div className="col-span-5 bg-white border border-slate-300 rounded shadow-sm p-4 flex flex-col h-[520px]">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 flex justify-between items-center">
            <span>الأصناف المكودة حالياً ({products.length})</span>
            <button onClick={fetchInitialData} className="text-blue-600 hover:text-blue-800">
              <RefreshCw className="w-4 h-4" />
            </button>
          </h2>

          <div className="flex-1 overflow-auto mt-2">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b">
                <tr>
                  <th className="p-2 border-x">الكود</th>
                  <th className="p-2 border-x">الصنف</th>
                  <th className="p-2 border-x text-center">الرئيسي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 border-x font-mono text-slate-500 font-bold">{p.code || '---'}</td>
                    <td className="p-2 border-x font-bold text-slate-800">{p.name}</td>
                    <td className="p-2 border-x text-center font-bold text-emerald-700">
                      {parseFloat(p.selling_price || p.price || 100).toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}