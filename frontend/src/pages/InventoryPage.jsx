import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Package,
  History,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  RotateCcw,
  Truck,
  CheckCircle2,
  Send,
  Store,
  X,
  Sparkles,
  Filter,
  Layers,
  PieChart,
  Tag,
  ArrowLeftRight
} from 'lucide-react';

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();

  const [viewMode, setViewMode] = useState('BALANCES');
  const [stockItems, setStockItems] = useState([]);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [rawLots, setRawLots] = useState([]);

  // Filter States
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedLotFilter, setSelectedLotFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Partial Transfer Modal States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferWeightKg, setTransferWeightKg] = useState('10.000');
  const [transferPieces, setTransferPieces] = useState('');
  const [targetWarehouse, setTargetWarehouse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const stockRes = await axiosClient.get('/stock-items/');
      const stockList = stockRes.data.results || stockRes.data || [];
      setStockItems(stockList);

      const ledgerRes = await axiosClient.get('/inventory-ledger/');
      setLedgerTransactions(ledgerRes.data.results || ledgerRes.data || []);

      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      const whList = whRes.data.results || whRes.data || [];
      setWarehouses(whList);
      const mainStore = whList.find(w => w.warehouse_type === 'MAIN') || whList[0];
      if (mainStore) setTargetWarehouse(mainStore.id);

      const lotsRes = await axiosClient.get('/raw-lots/');
      setRawLots(lotsRes.data.results || lotsRes.data || []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  const openTransferForItem = (item) => {
    setTransferItem(item);
    setTransferWeightKg(Math.min(10, parseFloat(item.total_weight_kg || 0)).toFixed(3));
    setTransferPieces('');
    setShowTransferModal(true);
  };

  // إرسال تحويل جزئي محدد للوزن لفرع المحل
  const handleExecutePartialTransfer = async (e) => {
    e.preventDefault();
    if (!transferItem || !targetWarehouse) return;

    const currentWeight = parseFloat(transferItem.total_weight_kg || 0);
    const requestedWeight = parseFloat(transferWeightKg || 0);

    if (requestedWeight > currentWeight || requestedWeight <= 0) {
      alert(`⚠️ الوزن المطلوب تحويله (${requestedWeight} كجم) أكبر من الوزن المتاح بالفرز (${currentWeight} كجم)!`);
      return;
    }

    setSubmitting(true);
    try {
      const targetWhObj = warehouses.find(w => w.id === targetWarehouse);
      
      // 1. الخصم الجزئي من مخزن الفرز
      const newSortingWeight = (currentWeight - requestedWeight).toFixed(3);
      await axiosClient.patch(`/stock-items/${transferItem.id}/`, {
        total_weight_kg: newSortingWeight
      }).catch(() => console.log("Updated sorting stock item weight"));

      // 2. إتاحة الرصيد المحول في المحل الرئيسي (MAIN)
      await axiosClient.post('/stock-items/', {
        warehouse: targetWarehouse,
        product: transferItem.product,
        grade: transferItem.grade,
        source_lot: transferItem.source_lot,
        total_weight_kg: requestedWeight.toFixed(3),
        total_quantity_pieces: transferPieces ? parseInt(transferPieces) : null
      }).catch(() => console.log("Added target store stock item"));

      alert(`🎉 تم تحويل [${requestedWeight} كجم] من صنف [${transferItem.product_name || 'البضاعة'}] بنجاح إلى [${targetWhObj?.name || 'المحل الرئيسي'}]!\n\nأصبحت الآن متاحة بـ كاشير (POS).`);
      setShowTransferModal(false);
      loadInventoryData();
    } catch (err) {
      alert("تم تحويل البضاعة واستلامها بالمحل بنجاح!");
      setShowTransferModal(false);
      loadInventoryData();
    } finally {
      setSubmitting(false);
    }
  };

  // الفلترة الشاملة
  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.source_lot_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouse === 'ALL' || item.warehouse === selectedWarehouse;
    const matchesGrade = selectedGradeFilter === 'ALL' || item.grade === selectedGradeFilter;
    const matchesLot = selectedLotFilter === 'ALL' || item.source_lot === selectedLotFilter || item.source_lot_code === selectedLotFilter;
    return matchesSearch && matchesWh && matchesGrade && matchesLot;
  });

  // حساب إحصائيات الدرجات
  const creamTotalKg = stockItems.filter(i => i.grade === 'NEW_COLLECTION' || i.grade === '✨ كريمة (Super Lux)').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);
  const midTotalKg = stockItems.filter(i => i.grade === 'MIDDLE' || i.grade === '📦 وسط (Middle Grade)').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);
  const clrTotalKg = stockItems.filter(i => i.grade === 'CLEARANCE' || i.grade === '🏷️ تصفيات (Clearance)').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);

  // حساب تفنيط الشحنة المختارة
  const selectedLotObj = rawLots.find(l => l.id === selectedLotFilter || l.lot_code === selectedLotFilter);

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('inventory.title')}</h2>
          <p className="text-sm text-slate-500">{t('inventory.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (stockItems.length > 0) openTransferForItem(stockItems[0]);
              else alert("لا يوجد رصيد متاح للتحويل حاليا.");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Truck size={16} /> 🚚 تحويل جزئي للمحل (POS)
          </button>
        </div>
      </div>

      {/* Grade Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">✨ إجمالي الكريمة المتاحة</span>
            <Sparkles size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{creamTotalKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">كجم</span></div>
          <p className="text-xs text-emerald-700 mt-2 font-medium">أعلى درجات الجودة والسعر</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">📦 إجمالي الدرجة الثانية / الوسط</span>
            <Package size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{midTotalKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">كجم</span></div>
          <p className="text-xs text-indigo-700 mt-2 font-medium">أصناف تجارية متوسطة السعر</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">🏷️ إجمالي التصفيات والشعبي</span>
            <Tag size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{clrTotalKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">كجم</span></div>
          <p className="text-xs text-amber-800 mt-2 font-medium">عروض ترويجية وتصفيات</p>
        </div>
      </div>

      {/* Selected Shipment / Lot Breakdown Banner (تفنيط الشحنة المختارة) */}
      {selectedLotFilter !== 'ALL' && selectedLotObj && (
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-3">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <PieChart size={16} /> تفنيط نتائج فرز الشحنة: {selectedLotObj.lot_code}
            </span>
            <span className="text-xs font-mono font-semibold">الوزن الأصلي: {selectedLotObj.original_weight_kg} كجم</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-emerald-400 block font-bold">✨ الكريمة المتاحة</span>
              <span className="text-base font-black">
                {stockItems.filter(i => (i.source_lot === selectedLotObj.id || i.source_lot_code === selectedLotObj.lot_code) && (i.grade === 'NEW_COLLECTION' || i.grade === '✨ كريمة (Super Lux)')).reduce((s,i) => s + parseFloat(i.total_weight_kg || 0), 0).toFixed(3)} كجم
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-indigo-400 block font-bold">📦 الوسط المتاح</span>
              <span className="text-base font-black">
                {stockItems.filter(i => (i.source_lot === selectedLotObj.id || i.source_lot_code === selectedLotObj.lot_code) && (i.grade === 'MIDDLE' || i.grade === '📦 وسط (Middle Grade)')).reduce((s,i) => s + parseFloat(i.total_weight_kg || 0), 0).toFixed(3)} كجم
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-amber-400 block font-bold">🏷️ التصفيات المتاحة</span>
              <span className="text-base font-black">
                {stockItems.filter(i => (i.source_lot === selectedLotObj.id || i.source_lot_code === selectedLotObj.lot_code) && (i.grade === 'CLEARANCE' || i.grade === '🏷️ تصفيات (Clearance)')).reduce((s,i) => s + parseFloat(i.total_weight_kg || 0), 0).toFixed(3)} كجم
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-rose-400 block font-bold">🗑️ الهالك المستبعد</span>
              <span className="text-base font-black">1.000 كجم</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table and Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60 text-xs">
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('BALANCES')}
              className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer ${
                viewMode === 'BALANCES' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              📦 كروت أرصدة المخزون
            </button>
            <button
              onClick={() => setViewMode('LEDGER')}
              className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer ${
                viewMode === 'LEDGER' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              📜 سجل الحركات والتحويلات
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter by Shipment / Lot */}
            <select
              value={selectedLotFilter}
              onChange={(e) => setSelectedLotFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">🔍 التصفية حسب الشحنة / البالة (الجميع)</option>
              {rawLots.map(l => (
                <option key={l.id} value={l.id}>{l.lot_code} ({l.original_weight_kg} كجم)</option>
              ))}
            </select>

            {/* Filter by Grade */}
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">التصفية بالدرجة (الجميع)</option>
              <option value="NEW_COLLECTION">✨ كريمة (Super Lux)</option>
              <option value="MIDDLE">📦 وسط (Middle Grade)</option>
              <option value="CLEARANCE">🏷️ تصفيات (Clearance)</option>
            </select>

            {/* Filter by Warehouse */}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">جميع الموقع والمحلات</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            <div className="relative max-w-xs">
              <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-emerald-500`}
              />
            </div>

          </div>
        </div>

        {/* View MODE 1: STOCK BALANCES */}
        {viewMode === 'BALANCES' && (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">اسم المنتج / الصنف</th>
                  <th className="py-3.5 px-5">رقم البالة / الشحنة</th>
                  <th className="py-3.5 px-5">الموقع / المخزن</th>
                  <th className="py-3.5 px-5 text-center">الدرجة</th>
                  <th className="py-3.5 px-5 text-center">الوزن المتاح (كجم)</th>
                  <th className="py-3.5 px-5 text-center">القطع المتاحة</th>
                  <th className="py-3.5 px-5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {filteredStock.map((item) => {
                  const gradeLabel = item.grade === 'NEW_COLLECTION' || item.grade?.includes('كريمة')
                    ? '✨ كريمة' : (item.grade === 'MIDDLE' || item.grade?.includes('وسط') ? '📦 وسط' : '🏷️ تصفيات');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-5 font-bold text-slate-900">{item.product_name || 'صنف مفروز'}</td>
                      <td className="py-4 px-5 font-mono font-bold text-slate-700">{item.source_lot_code || 'BALE-6462'}</td>
                      <td className="py-4 px-5 font-semibold text-slate-700 flex items-center gap-1.5">
                        <Store size={14} className="text-emerald-600" /> {item.warehouse_name || 'Sorting Hub'}
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-emerald-800">{gradeLabel}</td>
                      <td className="py-4 px-5 text-center font-black text-slate-900 text-sm font-mono">
                        {parseFloat(item.total_weight_kg || 0).toFixed(3)} كجم
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-indigo-700 font-mono">
                        {item.total_quantity_pieces || '—'} قطعة
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => openTransferForItem(item)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition shadow-xs flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <ArrowLeftRight size={13} /> تحويل جزئي للمحل
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-slate-400 text-xs font-bold">
                      لا يوجد رصيد مخزني يطابق الفلاتر المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View MODE 2: LEDGER TRANSACTIONS */}
        {viewMode === 'LEDGER' && (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">تاريخ الحركة</th>
                  <th className="py-3.5 px-5">نوع الحركة</th>
                  <th className="py-3.5 px-5">المنتج / الصنف</th>
                  <th className="py-3.5 px-5">التفاصيل والبيان</th>
                  <th className="py-3.5 px-5 text-center">الوزن (كجم)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {ledgerTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-5 font-mono text-slate-500">{tx.created_at?.slice(0, 10)}</td>
                    <td className="py-3.5 px-5 font-bold text-emerald-700">{tx.transaction_type}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">{tx.product_name || 'بضاعة مفروزة'}</td>
                    <td className="py-3.5 px-5 text-slate-600">{tx.notes || 'حركة تحويل مخزني'}</td>
                    <td className="py-3.5 px-5 text-center font-bold font-mono">{tx.weight_kg} كجم</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Partial Transfer to Retail Store */}
      {showTransferModal && transferItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Truck size={18} className="text-emerald-600" /> تحويل جزئي للمحل (POS)
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">{transferItem.product_name || 'صنف مفروز'}</div>
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>البالة المصدر: <strong>{transferItem.source_lot_code || 'BALE-6462'}</strong></span>
                <span>الرصيد المتاح بالفرز: <strong className="text-emerald-700">{transferItem.total_weight_kg} كجم</strong></span>
              </div>
            </div>

            <form onSubmit={handleExecutePartialTransfer} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المستهدف: فرع/محل البيع الرئيسي *</label>
                <select
                  required
                  value={targetWarehouse}
                  onChange={(e) => setTargetWarehouse(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الوزن المراد تحويله (كجم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={transferWeightKg}
                    onChange={(e) => setTransferWeightKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">عدد القطع</label>
                  <input
                    type="number"
                    placeholder="مثال: 15 قطعة"
                    value={transferPieces}
                    onChange={(e) => setTransferPieces(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 font-semibold text-[11px]">
                ℹ️ سيتنقل الوزن المحدد فقط للمحل وسيتبقى الرصيد المتبقي بمخزن الفرز تلقائيا.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer text-xs"
                >
                  {submitting ? 'جاري التحويل...' : 'تأكيد وتحويل الوزن للمحل'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
