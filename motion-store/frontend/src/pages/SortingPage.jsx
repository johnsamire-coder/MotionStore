import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function SortingPage() {
  const [rawLots, setRawLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [selectedLot, setSelectedLot] = useState(null);

  const [sortingData, setSortingData] = useState({
    HIGH: [], MID: [], LIQUIDATION: [], WASTE: []
  });

  useEffect(() => {
    fetchRawLots();
  }, []);

  const fetchRawLots = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/raw-lots/?status=PENDING');
      setRawLots(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (lot) => {
    let kind = (lot.source_kind || 'بالة').trim();
    if (kind === 'RAW_BALE' || kind === 'BALE') kind = 'بالة';
    if (kind === 'STOCK') kind = 'استوك';
    if (kind === 'DIRECT_PURCHASE') kind = 'شراء مباشر';

    const segment = (lot.segment || 'حريمي').trim();
    const season = (lot.season || 'صيفي').trim();
    const grade = (lot.purchase_grade || 'سوبر كريم').trim();
    const category = (lot.category_name && lot.category_name !== 'صنف غير محدد') ? lot.category_name.trim() : 'بلوزة';
    const brand = (lot.brand && lot.brand !== 'بدون براند') ? lot.brand.trim() : '';

    if (kind.includes('استوك')) {
      const bStr = brand ? ` - ${brand}` : ' - وان براند';
      return `استوك - ${segment} - ${season}${bStr}`;
    }
    if (kind.includes('شراء مباشر')) {
      const cStr = category ? ` - ${category}` : '';
      const bStr = brand ? ` - ${brand}` : '';
      return `شراء مباشر - ${segment} - ${season}${cStr}${bStr}`;
    }
    // بالة
    const gStr = grade ? ` - ${grade}` : ' - سوبر كريم';
    const cStr = category ? ` - ${category}` : ' - بلوزة';
    return `بالة - ${segment} - ${season}${gStr}${cStr}`;
  };

  const formatWeight = (val) => {
    if (!val) return '0';
    const num = parseFloat(val);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3);
  };

  const openSortingModal = (lot) => {
    setSelectedLot(lot);
    const kind = lot.source_kind || 'بالة';
    
    // في الاستوك والشراء المباشر ينزل الحقل فاضي ليكتب الفرّاز الصنف بحرية
    const defaultCat = (kind === 'بالة') ? (lot.category_name || 'بلوزة') : '';
    const defaultBrand = lot.brand || '';

    const defaultRow = { category_name: defaultCat, brand: defaultBrand, quantity_pieces: '', weight_kg: '' };
    setSortingData({
      HIGH: [{ ...defaultRow }],
      MID: [{ ...defaultRow }],
      LIQUIDATION: [{ ...defaultRow }],
      WASTE: [{ ...defaultRow, category_name: 'هالك' }]
    });
    setMsg({ type: '', text: '' });
  };

  const addRow = (grade) => {
    const kind = selectedLot?.source_kind || 'بالة';
    const defaultCat = (kind === 'بالة') ? (selectedLot?.category_name || 'بلوزة') : '';
    setSortingData(prev => ({
      ...prev,
      [grade]: [...prev[grade], { category_name: defaultCat, brand: selectedLot?.brand || '', quantity_pieces: '', weight_kg: '' }]
    }));
  };

  // دالة حذف الصنف/السطر
  const deleteRow = (grade, index) => {
    setSortingData(prev => {
      const currentRows = [...prev[grade]];
      if (currentRows.length > 1) {
        currentRows.splice(index, 1);
      } else {
        // لو فاضل سطر واحد يتفرغ
        currentRows[0] = { category_name: '', brand: '', quantity_pieces: '', weight_kg: '' };
      }
      return { ...prev, [grade]: currentRows };
    });
  };

  const updateRow = (grade, index, field, value) => {
    const newData = { ...sortingData };
    newData[grade][index][field] = value;
    setSortingData(newData);
  };

  const handleMatchAndTransfer = async () => {
    setMsg({ type: '', text: '' });
    setSaving(true);

    try {
      const allLines = [];
      const defaultCat = selectedLot?.category_name || 'بلوزة';

      Object.entries(sortingData).forEach(([grade, rows]) => {
        rows.forEach(row => {
          if (row.quantity_pieces || row.weight_kg) {
            allLines.push({
              grade: grade,
              category_name: row.category_name || defaultCat,
              brand: row.brand || selectedLot?.brand || 'بدون براند',
              quantity_pieces: parseInt(row.quantity_pieces) || 0,
              weight_kg: parseFloat(row.weight_kg) || 0.0
            });
          }
        });
      });

      if (allLines.length === 0) {
        setMsg({ type: 'error', text: '⚠️ لم يتم إدخال أي أوزان أو أعداد للفرز!' });
        setSaving(false);
        return;
      }

      await axiosClient.post(`/raw-lots/${selectedLot.id}/sort_and_transfer/`, {
        lines: allLines
      });

      setMsg({ type: 'success', text: '🎉 تم المطابقة والترحيل كبنود في المحل بنجاح!' });
      setTimeout(() => {
        setSelectedLot(null);
        fetchRawLots();
      }, 2000);
    } catch (err) {
      setMsg({ type: 'error', text: '❌ حدث خطأ أثناء الترحيل. تأكد من البيانات.' });
    } finally {
      setSaving(false);
    }
  };

  const renderCards = () => {
    const grades = [
      { key: 'HIGH', label: '⭐ درجة عالي', color: 'emerald' },
      { key: 'MID', label: '🔹 درجة وسط', color: 'indigo' },
      { key: 'LIQUIDATION', label: '🏷️ درجة تصفيات', color: 'amber' },
      { key: 'WASTE', label: '🗑️ هالك (خسارة)', color: 'rose' }
    ];

    const kind = selectedLot?.source_kind || 'بالة';

    return grades.map(g => (
      <div key={g.key} className={`bg-${g.color}-50 border border-${g.color}-200 p-4 rounded-xl space-y-3`}>
        <div className={`font-bold text-${g.color}-800 flex justify-between items-center`}>
          <span>{g.label}</span>
          {(kind === 'استوك' || kind === 'شراء مباشر') && g.key !== 'WASTE' && (
            <button type="button" onClick={() => addRow(g.key)} className={`text-xs bg-${g.color}-200 text-${g.color}-900 font-extrabold px-2.5 py-1 rounded-lg hover:bg-${g.color}-300 transition-colors`}>+ إضافة صنف</button>
          )}
        </div>

        {sortingData[g.key].map((row, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
            
            {/* في الاستوك والشراء المباشر: خانة اسم الصنف */}
            {(kind === 'استوك' || kind === 'شراء مباشر') && g.key !== 'WASTE' && (
              <input
                type="text"
                placeholder="اسم الصنف (مثلاً: فستان، بنطلون..)"
                value={row.category_name}
                onChange={(e) => updateRow(g.key, idx, 'category_name', e.target.value)}
                className="flex-1 min-w-[120px] text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}

            {/* في الشراء المباشر: البراند اختياري */}
            {kind === 'شراء مباشر' && g.key !== 'WASTE' && (
              <input
                type="text"
                placeholder="البراند (اختياري)"
                value={row.brand}
                onChange={(e) => updateRow(g.key, idx, 'brand', e.target.value)}
                className="w-24 text-xs font-bold px-2 py-1.5 border border-slate-300 rounded outline-none"
              />
            )}

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input type="number" placeholder="العدد" value={row.quantity_pieces} onChange={(e) => updateRow(g.key, idx, 'quantity_pieces', e.target.value)} className="w-1/2 sm:w-20 text-xs font-bold px-2 py-1.5 border border-slate-300 rounded outline-none text-center" />
              <input type="number" step="0.01" placeholder="الوزن كجم" value={row.weight_kg} onChange={(e) => updateRow(g.key, idx, 'weight_kg', e.target.value)} className="w-1/2 sm:w-24 text-xs font-bold px-2 py-1.5 border border-slate-300 rounded outline-none text-center" />
              
              {/* زرار حذف السطر */}
              {g.key !== 'WASTE' && (
                <button
                  type="button"
                  onClick={() => deleteRow(g.key, idx)}
                  title="حذف هذا السطر"
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-200"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    ));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><span>📦</span> قايمة الفرز</h2>
          <p className="text-xs text-slate-500 mt-1">المشتريات اللي دخلت المخزن ومستنية تتفرز وتترحل كبنود للمحل</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-6 text-center text-slate-400 font-bold">جاري تحميل قايمة الفرز...</div>
        ) : rawLots.length === 0 ? (
          <div className="col-span-full p-6 text-center text-slate-400 font-bold bg-white rounded border border-slate-200">مفيش مشتريات مستنية الفرز حالياً.</div>
        ) : (
          rawLots.map(lot => (
            <div key={lot.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <h3 className="font-extrabold text-slate-900 leading-relaxed text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">{getDisplayName(lot)}</h3>

              <div className="space-y-1.5 text-xs font-bold text-slate-600 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">📄 رقم البالة / الفاتورة:</span>
                  <span className="text-indigo-700 font-extrabold">{lot.lot_code || lot.invoice_number || `LOT-${lot.id.substring(0, 6)}`}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">🏬 المورد:</span>
                  <span className="text-slate-800">{lot.supplier_name || lot.supplier?.name || 'أولاد ثابت'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">📅 تاريخ الشراء:</span>
                  <span className="text-slate-700">{lot.created_at ? new Date(lot.created_at).toLocaleDateString('ar-EG') : 'اليوم'}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">⚖️ الوزن الأصلي:</span>
                  <span className="text-emerald-700 font-extrabold">{formatWeight(lot.original_weight_kg)} كجم</span>
                </div>
              </div>

              <button onClick={() => openSortingModal(lot)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-xs flex items-center justify-center gap-2 shadow-sm">
                <span>✂️</span> ابدأ الفرز والترحيل
              </button>
            </div>
          ))
        )}
      </div>

      {selectedLot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{getDisplayName(selectedLot)}</h3>
                <div className="text-xs font-bold text-indigo-700 mt-1 flex flex-wrap gap-4">
                  <span>📄 الشحنة: {selectedLot.lot_code || selectedLot.invoice_number || 'LOT'}</span>
                  <span>🏬 المورد: {selectedLot.supplier_name || selectedLot.supplier?.name || 'أولاد ثابت'}</span>
                  <span>⚖️ الوزن الكلي: {formatWeight(selectedLot.original_weight_kg)} كجم</span>
                </div>
              </div>
              <button onClick={() => setSelectedLot(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {msg.text && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-bold text-center ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {msg.text}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCards()}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setSelectedLot(null)} className="px-5 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-300">إلغاء</button>
              <button onClick={handleMatchAndTransfer} disabled={saving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow-md flex items-center gap-2">
                {saving ? 'جاري الترحيل...' : '✨ مطابقة وترحيل للمخزون'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
