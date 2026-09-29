import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function PricingV2() {
  const [activeSubTab, setActiveTab] = useState('UNCODED'); // UNCODED | BALE_WEIGHT | STOCK_WEIGHT | CODED_LIST | PRICE_LOG
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const [pieceItems, setPieceItems] = useState([]);
  const [weightPrices, setWeightPrices] = useState([]);
  const [priceLogs, setPriceLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [codeForm, setCodeForm] = useState({ code: '', name: '', price_per_piece: '', price_per_kg: '' });
  const [baleWeightForm, setBaleWeightForm] = useState({ high: '250', mid: '180', liq: '100' });
  const [stockWeightForm, setStockWeightForm] = useState({ category_name: '', brand: '', grade: 'عالي', price_per_kg: '' });

  const [conflictData, setConflictData] = useState(null);
  const [editingCode, setEditingCode] = useState(null);
  const [selectedCodeDetails, setSelectedCodeDetails] = useState(null);
  const [editPriceForm, setEditPriceForm] = useState({ price_per_piece: '', price_per_kg: '' });

  useEffect(() => { fetchBranches(); }, []);
  useEffect(() => { fetchStoreItems(); fetchPieceItems(); fetchWeightPrices(); fetchPriceLogs(); }, [selectedBranch, searchQuery]);

  const fetchBranches = async () => {
    try {
      const res = await axiosClient.get('/warehouses/');
      setBranches(res.data.results || res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchStoreItems = async () => {
    try {
      setLoading(true);
      let url = `/store-items/?search=${encodeURIComponent(searchQuery)}`;
      if (selectedBranch && selectedBranch !== 'ALL') url += `&branch=${selectedBranch}`;
      const res = await axiosClient.get(url);
      setStoreItems(res.data.results || res.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchPieceItems = async () => {
    try {
      const res = await axiosClient.get('/piece-items/');
      setPieceItems(res.data.results || res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchWeightPrices = async () => {
    try {
      const res = await axiosClient.get('/weight-prices/');
      setWeightPrices(res.data.results || res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchPriceLogs = async () => {
    try {
      const res = await axiosClient.get('/price-change-log/');
      setPriceLog(res.data.results || res.data || []);
    } catch (e) { console.error(e); }
  };

  
  // البراندات والأصناف الحقيقية المسجلة فعلياً في البنود والفرز
  const existingBrands = Array.from(new Set([
    ...storeItems.map(s => s.brand).filter(b => b && b !== 'بدون براند'),
    ...pieceItems.map(p => p.brand).filter(b => b && b !== 'بدون براند')
  ]));

  const existingCategories = Array.from(new Set([
    ...storeItems.map(s => s.category_name).filter(Boolean),
    ...pieceItems.map(p => p.name).filter(Boolean)
  ]));

  const existingSaleNames = Array.from(new Set([
    ...pieceItems.map(p => p.name).filter(Boolean),
    ...storeItems.map(s => s.category_name).filter(Boolean)
  ]));

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedItemIds(storeItems.map(i => i.id));
    else setSelectedItemIds([]);
  };

  const handleSelectItem = (id) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreateCodeAndBind = async (e, forceTransfer = false) => {
    if (e) e.preventDefault();
    setMsg({ type: '', text: '' });

    if (!codeForm.code || !codeForm.name) {
      setMsg({ type: 'error', text: '⚠️ يجب كتابة كود الصنف واسم الصنف!' });
      return;
    }

    try {
      setSaving(true);
      let codeId = editingCode?.id;

      if (!codeId) {
        const createRes = await axiosClient.post('/piece-items/', {
          code: codeForm.code,
          name: codeForm.name,
          price_per_piece: codeForm.price_per_piece || '0.00',
          price_per_kg: codeForm.price_per_kg || '0.00'
        });
        codeId = createRes.data.id;
      }

      const bindRes = await axiosClient.post('/piece-items/bind-items/', {
        code_id: codeId,
        item_ids: selectedItemIds,
        force_transfer: forceTransfer
      });

      setMsg({ type: 'success', text: `🎉 ${bindRes.data.message}` });
      setConflictData(null);
      setCodeForm({ code: '', name: '', price_per_piece: '', price_per_kg: '' });
      setSelectedItemIds([]);
      fetchStoreItems();
      fetchPieceItems();
      fetchPriceLogs();
    } catch (err) {
      if (err.response?.status === 409) setConflictData(err.response.data);
      else setMsg({ type: 'error', text: '❌ حدث خطأ أثناء التكويد والتسعير.' });
    } finally { setSaving(false); }
  };

  const handleSaveBaleWeightPrices = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axiosClient.post('/weight-prices/', { kind: 'بالة', grade: 'عالي', price_per_kg: baleWeightForm.high });
      await axiosClient.post('/weight-prices/', { kind: 'بالة', grade: 'وسط', price_per_kg: baleWeightForm.mid });
      await axiosClient.post('/weight-prices/', { kind: 'بالة', grade: 'تصفيات', price_per_kg: baleWeightForm.liq });
      setMsg({ type: 'success', text: '🎉 تم حفظ وتحديث أسعار كيلو البالة (عالي / وسط / تصفيات) بنجاح!' });
      fetchWeightPrices();
    } catch (err) { setMsg({ type: 'error', text: '❌ فشل حفظ أوزان البالة.' }); } finally { setSaving(false); }
  };

  const handleSaveStockWeightPrice = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axiosClient.post('/weight-prices/', {
        kind: 'استوك',
        key: `${stockWeightForm.category_name} ${stockWeightForm.brand}`.trim(),
        grade: stockWeightForm.grade,
        price_per_kg: stockWeightForm.price_per_kg
      });
      setMsg({ type: 'success', text: '🎉 تم حفظ سعر كيلو الاستوك (للصنف والبراند والدرجة) بنجاح!' });
      setStockWeightForm({ category_name: '', brand: '', grade: 'عالي', price_per_kg: '' });
      fetchWeightPrices();
    } catch (err) { setMsg({ type: 'error', text: '❌ فشل حفظ أوزان الاستوك.' }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* الهيدر والمحل */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🏷️</span> التكويد والتسعير لكل محل
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            البحث في هوية البنود الـ 7، تسعير أوزان البالة والاستوك، وتكويد أصناف البيع بالقطع والكيلو
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-600">المحل / الفرع:</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-slate-50 border border-slate-300 font-bold text-slate-800 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">🏬 جميع المحلات والأنشطة</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>🏬 {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* التبويبات الأربعة الرئيسية */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('UNCODED')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'UNCODED' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📦 البنود المفروزة بالتكويد والتسعير
        </button>

        <button
          onClick={() => setActiveTab('BALE_WEIGHT')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'BALE_WEIGHT' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚖️ تسعير أوزان البالة (عالي / وسط / تصفيات)
        </button>

        <button
          onClick={() => setActiveTab('STOCK_WEIGHT')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'STOCK_WEIGHT' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🏬 تسعير أوزان الاستوك والشراء المباشر
        </button>

        <button
          onClick={() => setActiveTab('CODED_LIST')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'CODED_LIST' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🏷️ أصناف البيع والأكواد الحالية ({pieceItems.length})
        </button>

        <button
          onClick={() => setActiveTab('PRICE_LOG')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'PRICE_LOG' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📜 سجل تغير الأسعار (Price Log)
        </button>
      </div>

      {/* التنبيهات */}
      {msg.text && (
        <div className={`p-4 rounded-xl text-sm font-bold shadow-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {/* مودال كارت تفاصيل البنود المربوطة للكود */}
      {selectedCodeDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🏷️</span> تفاصيل البنود المربوطة بالكود [{selectedCodeDetails.code}] - {selectedCodeDetails.name}
              </h3>
              <button onClick={() => setSelectedCodeDetails(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {(!selectedCodeDetails.linked_items_details || selectedCodeDetails.linked_items_details.length === 0) ? (
                <p className="text-xs text-slate-400 p-4 text-center">لا توجد بنود مربوطة بهذا الكود حالياً.</p>
              ) : (
                selectedCodeDetails.linked_items_details.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                    <div><span className="text-emerald-700 font-extrabold">{idx + 1}. </span>{item.full_name}</div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">{item.quantity_pieces} قطعة</span>
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{item.weight_kg} كجم</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setSelectedCodeDetails(null)} className="px-5 py-2 bg-slate-800 text-white font-bold rounded-lg text-xs shadow-md">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* مودال التعارض والنقل */}
      {conflictData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-800">تنبيه تعارض في ربط الكود</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{conflictData.message}</p>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs font-bold text-amber-900 space-y-1">
              {conflictData.conflicts?.map((c, i) => (
                <div key={i}>• {c.item_name} (مربوط حالياً بكود: <span className="text-rose-600">{c.current_code}</span>)</div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConflictData(null)} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs">إلغاء</button>
              <button onClick={() => handleCreateCodeAndBind(null, true)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md">نعم، انقل البند للكود الجديد</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* تبويب 1: البنود والتكويد                                 */}
      {/* ======================================================== */}
      {activeSubTab === 'UNCODED' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث شامل في كل الصفات الـ 7 (مثلاً: بلوزة كريم، زارا صيفي، شراء مباشر...)"
              className="w-full text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">نتائج البنود المتاحة بالمحل ({storeItems.length})</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">المحدد: {selectedItemIds.length} بند</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input type="checkbox" onChange={handleSelectAll} checked={storeItems.length > 0 && selectedItemIds.length === storeItems.length} className="w-4 h-4 text-emerald-600 rounded" />
                    </th>
                    <th className="p-3">هوية البند الكاملة الـ 7</th>
                    <th className="p-3">العدد المتاح</th>
                    <th className="p-3">الوزن المتاح</th>
                    <th className="p-3">التكلفة الموزعة</th>
                    <th className="p-3">كود البيع الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loading ? (
                    <tr><td colSpan="6" className="p-6 text-center text-slate-400">جاري تحميل البنود...</td></tr>
                  ) : storeItems.length === 0 ? (
                    <tr><td colSpan="6" className="p-6 text-center text-slate-400">لا توجد بنود مطابقة للبحث حالياً في هذا المحل.</td></tr>
                  ) : (
                    storeItems.map((item) => (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${selectedItemIds.includes(item.id) ? 'bg-emerald-50/60' : ''}`}>
                        <td className="p-3 text-center">
                          <input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => handleSelectItem(item.id)} className="w-4 h-4 text-emerald-600 rounded" />
                        </td>
                        <td className="p-3 font-bold text-slate-900">{item.full_name}</td>
                        <td className="p-3 text-emerald-700 font-bold">{item.quantity_pieces} قطعة</td>
                        <td className="p-3">{item.weight_kg} كجم</td>
                        <td className="p-3 text-slate-500">{item.total_allocated_cost} ج</td>
                        <td className="p-3">
                          {item.coding_code ? (
                            <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-xs">{item.coding_code}</span>
                          ) : (
                            <span className="text-slate-400 italic">غير مكوّد</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🏷️</span> إنشاء كود وتكويد وتسعير للبنود المحددة ({selectedItemIds.length})
            </h3>

            <form onSubmit={(e) => handleCreateCodeAndBind(e, false)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">كود الصنف الفريد *</label>
                  <input type="text" required value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })} placeholder="مثال: 101" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم صنف البيع *</label>
                  <input type="text" required list="saleItemNamesList" value={codeForm.name} onChange={(e) => setCodeForm({ ...codeForm, name: e.target.value })} placeholder="اختر صنف سابق أو اكتب صنف جديد..." className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <datalist id="saleItemNamesList">
                    {existingSaleNames.map((n, idx) => (<option key={idx} value={n} />))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">سعر القطعة (ج)</label>
                  <input type="number" step="0.01" value={codeForm.price_per_piece} onChange={(e) => setCodeForm({ ...codeForm, price_per_piece: e.target.value })} placeholder="مثال: 350" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">سعر الكيلو (ج)</label>
                  <input type="number" step="0.01" value={codeForm.price_per_kg} onChange={(e) => setCodeForm({ ...codeForm, price_per_kg: e.target.value })} placeholder="مثال: 250" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={saving || selectedItemIds.length === 0} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow-sm flex items-center gap-2">
                  {saving ? 'جاري التكويد...' : '✨ تكويد وتسعير البنود المحددة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* تبويب 2: تسعير أوزان البالة                                */}
      {/* ======================================================== */}
      {activeSubTab === 'BALE_WEIGHT' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><span>⚖️</span> تسعير أوزان البالة الكيلو العام حسب الدرجة</h3>
            <p className="text-xs text-slate-500 mt-1">تحديد سعر الكيلو العام لكل درجة فرز في البالة (عالي / وسط / تصفيات) للبيع المباشر بالميزان</p>
          </div>

          <form onSubmit={handleSaveBaleWeightPrices} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-emerald-800 mb-2">درجة عالي (سعر الكيلو ج)</label>
                <input type="number" step="0.01" value={baleWeightForm.high} onChange={(e) => setBaleWeightForm({ ...baleWeightForm, high: e.target.value })} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-indigo-800 mb-2">درجة وسط (سعر الكيلو ج)</label>
                <input type="number" step="0.01" value={baleWeightForm.mid} onChange={(e) => setBaleWeightForm({ ...baleWeightForm, mid: e.target.value })} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-amber-800 mb-2">درجة تصفيات (سعر الكيلو ج)</label>
                <input type="number" step="0.01" value={baleWeightForm.liq} onChange={(e) => setBaleWeightForm({ ...baleWeightForm, liq: e.target.value })} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-sm">💾 حفظ وتحديث أسعار كيلو البالة</button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* تبويب 3: تسعير أوزان الاستوك والشراء المباشر              */}
      {/* ======================================================== */}
      {activeSubTab === 'STOCK_WEIGHT' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><span>🏬</span> تسعير أوزان الاستوك والشراء المباشر حسب الصنف والبراند والدرجة</h3>
              <p className="text-xs text-slate-500 mt-1">تحديد سعر الكيلو العام للاستوك والشراء المباشر حسب الصنف والبراند ودرجة الفرز</p>
            </div>

            <form onSubmit={handleSaveStockWeightPrice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف *</label>
                  <input type="text" required list="stockCategoriesList" value={stockWeightForm.category_name} onChange={(e) => setStockWeightForm({ ...stockWeightForm, category_name: e.target.value })} placeholder="اختر أو اكتب الصنف..." className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  <datalist id="stockCategoriesList">
                    {existingCategories.map((c, i) => (<option key={i} value={c} />))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">البراند / الماركة (من الحالية) *</label>
                  <input type="text" required list="stockBrandsList" value={stockWeightForm.brand} onChange={(e) => setStockWeightForm({ ...stockWeightForm, brand: e.target.value })} placeholder="اختر أو اكتب البراند..." className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  <datalist id="stockBrandsList">
                    {existingBrands.map((b, i) => (<option key={i} value={b} />))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">درجة الفرز *</label>
                  <select value={stockWeightForm.grade} onChange={(e) => setStockWeightForm({ ...stockWeightForm, grade: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="عالي">⭐ درجة عالي</option>
                    <option value="وسط">🔹 درجة وسط</option>
                    <option value="تصفيات">🏷️ درجة تصفيات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">سعر الكيلو العام (ج) *</label>
                  <input type="number" step="0.01" required value={stockWeightForm.price_per_kg} onChange={(e) => setStockWeightForm({ ...stockWeightForm, price_per_kg: e.target.value })} placeholder="مثال: 300" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-sm">💾 حفظ وتحديث سعر كيلو الاستوك</button>
              </div>
            </form>
          </div>

          {/* جدول أسعار أوزان الاستوك المحفوظة حالياً */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">قائمة أسعار كيلو الاستوك المحفوظة المعتمدة في المحل</div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">نوع الشراء</th>
                    <th className="p-3">الصنف والبراند</th>
                    <th className="p-3">درجة الفرز</th>
                    <th className="p-3">سعر الكيلو العام (ج)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {weightPrices.filter(w => w.kind === 'استوك').length === 0 ? (
                    <tr><td colSpan="4" className="p-6 text-center text-slate-400">لا توجد أسعار كيلو محفوظة للاستوك حتى الآن.</td></tr>
                  ) : (
                    weightPrices.filter(w => w.kind === 'استوك').map((wItem, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-indigo-700">استوك / شراء مباشر</td>
                        <td className="p-3 font-bold text-slate-900">{wItem.key || 'عام'}</td>
                        <td className="p-3 font-bold text-emerald-800">{wItem.grade || 'عالي'}</td>
                        <td className="p-3 font-extrabold text-emerald-700">{wItem.price_per_kg} ج</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* تبويب 4: أصناف البيع والأكواد الحالية                      */}
      {/* ======================================================== */}
      {activeSubTab === 'CODED_LIST' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">قائمة أصناف البيع والأكواد المعتمدة في الشركة</div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم صنف البيع</th>
                  <th className="p-3">العدد المتاح بالمحل (قطع)</th>
                  <th className="p-3">الوزن المتاح بالمحل (كجم)</th>
                  <th className="p-3">سعر القطعة (ج)</th>
                  <th className="p-3">سعر الكيلو (ج)</th>
                  <th className="p-3">البنود المربوطة</th>
                  <th className="p-3 text-center">إجراءات والتعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {pieceItems.map((codeItem) => (
                  <tr key={codeItem.id} className="hover:bg-slate-50">
                    <td className="p-3 font-extrabold text-indigo-700 text-sm">{codeItem.code}</td>
                    <td className="p-3 font-bold text-slate-900">{codeItem.name}</td>
                    <td className="p-3 font-bold text-emerald-700">{codeItem.total_available_pieces || 0} قطعة</td>
                    <td className="p-3 font-bold text-indigo-700">{codeItem.total_available_weight_kg || 0} كجم</td>
                    <td className="p-3 font-bold text-emerald-700">
                      {editingCode?.id === codeItem.id ? (
                        <input type="number" step="0.01" value={editPriceForm.price_per_piece} onChange={(e) => setEditPriceForm({ ...editPriceForm, price_per_piece: e.target.value })} className="w-24 border border-emerald-400 rounded px-2 py-1 font-bold outline-none" />
                      ) : ( `${codeItem.price_per_piece || 0} ج` )}
                    </td>
                    <td className="p-3 font-bold text-indigo-700">
                      {editingCode?.id === codeItem.id ? (
                        <input type="number" step="0.01" value={editPriceForm.price_per_kg} onChange={(e) => setEditPriceForm({ ...editPriceForm, price_per_kg: e.target.value })} className="w-24 border border-indigo-400 rounded px-2 py-1 font-bold outline-none" />
                      ) : ( `${codeItem.price_per_kg || 0} ج` )}
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => setSelectedCodeDetails(codeItem)} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-xs flex items-center gap-1 shadow-sm cursor-pointer">
                        👁️ {codeItem.linked_items_count || 0} بند مربوط
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      {editingCode?.id === codeItem.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => {}} className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs">حفظ</button>
                          <button onClick={() => setEditingCode(null)} className="px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded text-xs">إلغاء</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingCode(codeItem); setEditPriceForm({ price_per_piece: codeItem.price_per_piece || '', price_per_kg: codeItem.price_per_kg || '' }); }} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded border border-slate-300 text-xs">
                          ✏️ تعديل السعر
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* تبويب 5: سجل تغير الأسعار                                */}
      {/* ======================================================== */}
      {activeSubTab === 'PRICE_LOG' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">سجل كافة التغييرات على أسعار الأكواد (Price Change History)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3">نوع السعر</th>
                  <th className="p-3">السعر القديم</th>
                  <th className="p-3">السعر الجديد</th>
                  <th className="p-3">بواسطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {priceLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                    <td className="p-3 font-extrabold text-indigo-700">{log.code || '—'}</td>
                    <td className="p-3 font-bold text-slate-900">{log.name || '—'}</td>
                    <td className="p-3">{log.field === 'price_per_piece' ? 'سعر القطعة' : 'سعر الكيلو'}</td>
                    <td className="p-3 text-rose-600 font-bold">{log.old_price} ج</td>
                    <td className="p-3 text-emerald-600 font-bold">{log.new_price} ج</td>
                    <td className="p-3 text-slate-600">{log.changed_by?.username || log.changed_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
