import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function PricingV2() {
  const [activeSubTab, setActiveTab] = useState('UNCODED'); // UNCODED | CODED_LIST | PRICE_LOG
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  // بيانات البنود غير المكوّدة
  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // بيانات الأكواد المكوّدة وسجل الأسعار
  const [pieceItems, setPieceItems] = useState([]);
  const [priceLogs, setPriceLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // نموذج التكويد الجديد
  const [codeForm, setCodeForm] = useState({
    code: '',
    name: '',
    price_per_piece: '',
    price_per_kg: '',
  });

  // نموذج التنبيه وتأكيد النقل عند التعارض (Conflict 409)
  const [conflictData, setConflictData] = useState(null);

  // نموذج تعديل السعر
  const [editingCode, setEditingCode] = useState(null);
  const [editPriceForm, setEditPriceForm] = useState({ price_per_piece: '', price_per_kg: '' });

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStoreItems();
    fetchPieceItems();
    fetchPriceLogs();
  }, [selectedBranch, searchQuery]);

  const fetchBranches = async () => {
    try {
      const res = await axiosClient.get('/warehouses/');
      const list = res.data.results || res.data || [];
      setBranches(list);
      if (list.length > 0 && !selectedBranch) {
        setSelectedBranch(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStoreItems = async () => {
    try {
      setLoading(true);
      let url = `/store-items/?search=${encodeURIComponent(searchQuery)}`;
      if (selectedBranch) url += `&branch=${selectedBranch}`;
      const res = await axiosClient.get(url);
      setStoreItems(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPieceItems = async () => {
    try {
      const res = await axiosClient.get('/piece-items/');
      setPieceItems(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPriceLogs = async () => {
    try {
      const res = await axiosClient.get('/price-change-log/');
      setPriceLog(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // اختيار الكل زي الإكسل
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItemIds(storeItems.map((i) => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // إنشاء وتكويد البنود المختارة
  const handleCreateCodeAndBind = async (e, forceTransfer = false) => {
    if (e) e.preventDefault();
    setMsg({ type: '', text: '' });

    if (!codeForm.code || !codeForm.name) {
      setMsg({ type: 'error', text: '⚠️ يجب كتابة كود الصنف واسم الصنف!' });
      return;
    }

    if (selectedItemIds.length === 0 && !forceTransfer) {
      setMsg({ type: 'error', text: '⚠️ اختر بنداً واحدًا على الأقل من القائمة لتكويده وتسعيره!' });
      return;
    }

    try {
      setSaving(true);
      let codeId = editingCode?.id;

      // إنشاء كود بيع جديد لو مش بنربط بكود قائم
      if (!codeId) {
        const createRes = await axiosClient.post('/piece-items/', {
          code: codeForm.code,
          name: codeForm.name,
          price_per_piece: codeForm.price_per_piece || '0.00',
          price_per_kg: codeForm.price_per_kg || '0.00',
        });
        codeId = createRes.data.id;
      }

      // ربط البنود المختارة بكود البيع
      const bindRes = await axiosClient.post('/piece-items/bind-items/', {
        code_id: codeId,
        item_ids: selectedItemIds,
        force_transfer: forceTransfer,
      });

      setMsg({ type: 'success', text: `🎉 ${bindRes.data.message}` });
      setConflictData(null);
      setCodeForm({ code: '', name: '', price_per_piece: '', price_per_kg: '' });
      setSelectedItemIds([]);
      fetchStoreItems();
      fetchPieceItems();
      fetchPriceLogs();
    } catch (err) {
      if (err.response?.status === 409) {
        // تنبيه النقل والتعارض
        setConflictData(err.response.data);
      } else {
        const errData = err.response?.data;
      let errText = 'حدث خطأ أثناء التكويد والتسعير.';
      if (errData) {
        if (typeof errData === 'string') errText = errData;
        else if (errData.code) errText = Array.isArray(errData.code) ? errData.code[0] : errData.code;
        else if (errData.detail) errText = errData.detail;
        else if (errData.non_field_errors) errText = errData.non_field_errors.join(', ');
        else errText = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
      }
        setMsg({ type: 'error', text: `❌ ${errText}` });
      }
    } finally {
      setSaving(false);
    }
  };

  // حفظ تعديل السعر لكود محدد
  const handleUpdatePrice = async (codeItem) => {
    try {
      setSaving(true);
      await axiosClient.patch(`/piece-items/${codeItem.id}/`, {
        price_per_piece: editPriceForm.price_per_piece,
        price_per_kg: editPriceForm.price_per_kg,
      });
      setMsg({ type: 'success', text: `🎉 تم تحديث سعر الكود [${codeItem.code}] وتسجيل التغير بالسجل!` });
      setEditingCode(null);
      fetchPieceItems();
      fetchPriceLogs();
    } catch (err) {
      setMsg({ type: 'error', text: '❌ فشل تعديل السعر.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* الهيدر واختيار المحل/الفرع */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🏷️</span> التكويد والتسعير لكل محل
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            البحث في هوية البنود الـ 7، التكويد كصنف بيع، وتسعير القطعة والكيلو مع سجل الأسعار
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
              <option key={b.id} value={b.id}>
                🏬 {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* التبويبات الداخلية */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('UNCODED')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'UNCODED'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📦 البنود المفروزة بالتكويد والتسعير
        </button>

        <button
          onClick={() => setActiveTab('CODED_LIST')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'CODED_LIST'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🏷️ أصناف البيع والأكواد الحالية ({pieceItems.length})
        </button>

        <button
          onClick={() => setActiveTab('PRICE_LOG')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'PRICE_LOG'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📜 سجل تغير الأسعار (Price Log)
        </button>
      </div>

      {/* تنبيهات الرسائل */}
      {msg.text && (
        <div
          className={`p-4 rounded-xl text-sm font-bold shadow-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* مودال تنبيه التعارض ونقل البند المربوط سابقاً */}
      {conflictData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-800">تنبيه تعارض في ربط الكود</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {conflictData.message}
            </p>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs font-bold text-amber-900 space-y-1">
              {conflictData.conflicts?.map((c, i) => (
                <div key={i}>
                  • {c.item_name} (مربوط حالياً بكود: <span className="text-rose-600">{c.current_code}</span>)
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConflictData(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleCreateCodeAndBind(null, true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md"
              >
                نعم، انقل البند للكود الجديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* التبويب 1: قائمة البنود والبحث الشامل الـ 7 والتكويد     */}
      {/* ======================================================== */}
      {activeSubTab === 'UNCODED' && (
        <div className="space-y-6">
          {/* بحث بخانة واحدة في كل الصفات */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث شامل في كل الصفات الـ 7 (مثلاً: بلوزة كريم، زارا صيفي، شراء مباشر...)"
              className="w-full text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* جدول البنود */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                نتائج البنود المتاحة بالمحل ({storeItems.length})
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                المحدد: {selectedItemIds.length} بند
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={
                          storeItems.length > 0 && selectedItemIds.length === storeItems.length
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                    </th>
                    <th className="p-3">هوية البند الكاملة الـ 7</th>
                    <th className="p-3">العدد المتاح</th>
                    <th className="p-3">الوزن المتاح</th>
                    <th className="p-3">التكلفة</th>
                    <th className="p-3">كود البيع الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-400">
                        جاري تحميل البنود...
                      </td>
                    </tr>
                  ) : storeItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-400">
                        لا توجد بنود مطابقة للبحث حالياً في هذا المحل.
                      </td>
                    </tr>
                  ) : (
                    storeItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          selectedItemIds.includes(item.id) ? 'bg-emerald-50/60' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-900">{item.full_name}</td>
                        <td className="p-3 text-emerald-700 font-bold">
                          {item.quantity_pieces} قطعة
                        </td>
                        <td className="p-3">{item.weight_kg} كجم</td>
                        <td className="p-3 text-slate-500">{item.total_allocated_cost} ج</td>
                        <td className="p-3">
                          {item.coding_code ? (
                            <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-xs">
                              {item.coding_code}
                            </span>
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

          {/* الجزء السفلي: نموذج إنشاء صنف البيع والتسعير للبنود المختارة */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🏷️</span> إنشاء كود وتسعير للبنود المحددة ({selectedItemIds.length})
            </h3>

            <form onSubmit={(e) => handleCreateCodeAndBind(e, false)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    كود الصنف (الفريد) *
                  </label>
                  <input
                    type="text"
                    required
                    value={codeForm.code}
                    onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })}
                    placeholder="مثال: 101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    اسم صنف البيع *
                  </label>
                  <input
                    type="text"
                    required
                    value={codeForm.name}
                    onChange={(e) => setCodeForm({ ...codeForm, name: e.target.value })}
                    placeholder="مثال: بلوزة كريم"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    سعر القطعة (ج)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={codeForm.price_per_piece}
                    onChange={(e) => setCodeForm({ ...codeForm, price_per_piece: e.target.value })}
                    placeholder="مثال: 350"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    سعر الكيلو (ج)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={codeForm.price_per_kg}
                    onChange={(e) => setCodeForm({ ...codeForm, price_per_kg: e.target.value })}
                    placeholder="مثال: 250"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving || selectedItemIds.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
                >
                  {saving ? 'جاري التكويد...' : '✨ تكويد وتسعير البنود المحددة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* التبويب 2: قائمة الأكواد الحالية وتغيير السعر             */}
      {/* ======================================================== */}
      {activeSubTab === 'CODED_LIST' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
            قائمة أصناف البيع والأكواد المعتمدة في الشركة
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم صنف البيع</th>
                  <th className="p-3">سعر القطعة (ج)</th>
                  <th className="p-3">سعر الكيلو (ج)</th>
                  <th className="p-3">عدد البنود المربوطة</th>
                  <th className="p-3 text-center">إجراءات والتعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {pieceItems.map((codeItem) => (
                  <tr key={codeItem.id} className="hover:bg-slate-50">
                    <td className="p-3 font-extrabold text-indigo-700 text-sm">{codeItem.code}</td>
                    <td className="p-3 font-bold text-slate-900">{codeItem.name}</td>
                    <td className="p-3 font-bold text-emerald-700">
                      {editingCode?.id === codeItem.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editPriceForm.price_per_piece}
                          onChange={(e) =>
                            setEditPriceForm({ ...editPriceForm, price_per_piece: e.target.value })
                          }
                          className="w-24 border border-emerald-400 rounded px-2 py-1 font-bold outline-none"
                        />
                      ) : (
                        `${codeItem.price_per_piece || 0} ج`
                      )}
                    </td>
                    <td className="p-3 font-bold text-indigo-700">
                      {editingCode?.id === codeItem.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editPriceForm.price_per_kg}
                          onChange={(e) =>
                            setEditPriceForm({ ...editPriceForm, price_per_kg: e.target.value })
                          }
                          className="w-24 border border-indigo-400 rounded px-2 py-1 font-bold outline-none"
                        />
                      ) : (
                        `${codeItem.price_per_kg || 0} ج`
                      )}
                    </td>
                    <td className="p-3 text-slate-500">
                      {codeItem.linked_items_count || 0} بند
                    </td>
                    <td className="p-3 text-center">
                      {editingCode?.id === codeItem.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdatePrice(codeItem)}
                            disabled={saving}
                            className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs"
                          >
                            حفظ
                          </button>
                          <button
                            onClick={() => setEditingCode(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded text-xs"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCode(codeItem);
                            setEditPriceForm({
                              price_per_piece: codeItem.price_per_piece || '',
                              price_per_kg: codeItem.price_per_kg || '',
                            });
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded border border-slate-300 text-xs"
                        >
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
      {/* التبويب 3: سجل تغيير الأسعار (Price Change Log)          */}
      {/* ======================================================== */}
      {activeSubTab === 'PRICE_LOG' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
            سجل كافة التغييرات على أسعار الأكواد (Price Change History)
          </div>

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
                {priceLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-400">
                      لا يوجد تغييرات مسجلة بالسجل حتى الآن.
                    </td>
                  </tr>
                ) : (
                  priceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500">
                        {new Date(log.created_at).toLocaleString('ar-EG')}
                      </td>
                      <td className="p-3 font-extrabold text-indigo-700">{log.code || '—'}</td>
                      <td className="p-3 font-bold text-slate-900">{log.name || '—'}</td>
                      <td className="p-3">
                        {log.field === 'price_per_piece' ? 'سعر القطعة' : 'سعر الكيلو'}
                      </td>
                      <td className="p-3 text-rose-600 font-bold">{log.old_price} ج</td>
                      <td className="p-3 text-emerald-600 font-bold">{log.new_price} ج</td>
                      <td className="p-3 text-slate-600">{log.changed_by}</td>
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