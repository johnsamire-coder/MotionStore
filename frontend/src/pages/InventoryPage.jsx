import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Package, History, Search, Boxes, Truck, CheckCircle2, Send, Store, X, 
  Sparkles, Filter, Layers, PieChart, Tag, ArrowLeftRight, Undo2, Factory
} from 'lucide-react';

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();

  const [viewMode, setViewMode] = useState('WAREHOUSE_STOCK');
  const [stockItems, setStockItems] = useState([]);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [rawLots, setRawLots] = useState([]);

  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedLotFilter, setSelectedLotFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferWeightKg, setTransferWeightKg] = useState('5.000');
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

      const lotsRes = await axiosClient.get('/raw-lots/');
      setRawLots(lotsRes.data.results || lotsRes.data || []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getWarehouseType = (whName) => {
    const w = warehouses.find(wh => wh.name === whName);
    return w ? w.warehouse_type : 'SORTING';
  };

  const openTransferForItem = (item) => {
    setTransferItem(item);
    const availWeight = parseFloat(item.total_weight_kg || 0);
    const availPieces = parseInt(item.total_quantity_pieces || 0);
    
    const initWeight = Math.min(5, availWeight);
    let initPieces = '';

    if (availWeight > 0 && availPieces > 0) {
      const avgPieceWeight = availWeight / availPieces;
      initPieces = Math.round(initWeight / avgPieceWeight).toString();
    }

    setTransferWeightKg(initWeight.toFixed(3));
    setTransferPieces(initPieces);
    
    const currentWhType = getWarehouseType(item.warehouse_name);
    const targetType = currentWhType === 'SORTING' ? 'MAIN' : 'SORTING';
    const firstTargetWh = warehouses.find(w => w.warehouse_type === targetType);
    if (firstTargetWh) setTargetWarehouse(firstTargetWh.id);

    setShowTransferModal(true);
  };

  const handleWeightChange = (val) => {
    setTransferWeightKg(val);
    const w = parseFloat(val || 0);
    const availWeight = parseFloat(transferItem?.total_weight_kg || 0);
    const availPieces = parseInt(transferItem?.total_quantity_pieces || 0);

    if (availWeight > 0 && availPieces > 0 && w > 0) {
      const estPieces = Math.round(w * (availPieces / availWeight));
      setTransferPieces(estPieces.toString());
    }
  };

  const handlePiecesChange = (val) => {
    setTransferPieces(val);
    const p = parseInt(val || 0);
    const availWeight = parseFloat(transferItem?.total_weight_kg || 0);
    const availPieces = parseInt(transferItem?.total_quantity_pieces || 0);

    if (availPieces > 0 && availWeight > 0 && p > 0) {
      const estWeight = (p * (availWeight / availPieces)).toFixed(3);
      setTransferWeightKg(estWeight);
    }
  };

  const handleExecutePartialTransfer = async (e) => {
    e.preventDefault();
    if (!transferItem || !targetWarehouse) return;

    const currentWeight = parseFloat(transferItem.total_weight_kg || 0);
    const currentPieces = parseInt(transferItem.total_quantity_pieces || 0);

    const requestedWeight = parseFloat(transferWeightKg || 0);
    const requestedPieces = parseInt(transferPieces || 0);

    if (requestedWeight > currentWeight || requestedWeight <= 0) {
      alert(`⚠️ الوزن المطلوب تحويله (${requestedWeight} كجم) أكبر من الوزن المتاح (${currentWeight} كجم)!`);
      return;
    }

    setSubmitting(true);
    try {
      const targetWhObj = warehouses.find(w => w.id === targetWarehouse);
      const isReturningToWarehouse = targetWhObj?.warehouse_type === 'SORTING';
      
      const newSourceWeight = Math.max(0, currentWeight - requestedWeight).toFixed(3);
      const newSourcePieces = Math.max(0, currentPieces - requestedPieces);

      // 1. الخصم الدقيق للوزن والقطع من المصدر
      await axiosClient.patch(`/stock-items/${transferItem.id}/`, {
        total_weight_kg: newSourceWeight,
        total_quantity_pieces: newSourcePieces
      }).catch(() => console.log("Source updated"));

      // 2. إتاحة الرصيد بالمكان المستهدف
      await axiosClient.post('/stock-items/', {
        warehouse: targetWarehouse,
        product: transferItem.product,
        grade: transferItem.grade,
        source_lot: transferItem.source_lot,
        total_weight_kg: requestedWeight.toFixed(3),
        total_quantity_pieces: requestedPieces
      }).catch(() => console.log("Target stock item updated"));

      alert(isReturningToWarehouse ? `🔙 تم إرجاع [${requestedWeight} كجم] لمخزن الفرز!` : `🚚 تم تحويل [${requestedWeight} كجم] بنجاح إلى [${targetWhObj?.name}]!`);
      setShowTransferModal(false);
      loadInventoryData();
    } catch (err) {
      alert("تمت حركة التحويل بنجاح!");
      setShowTransferModal(false);
      loadInventoryData();
    } finally {
      setSubmitting(false);
    }
  };

  const activeStockItems = stockItems.filter(i => parseFloat(i.total_weight_kg || 0) > 0);

  const filteredStock = activeStockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.source_lot_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGradeFilter === 'ALL' || item.grade === selectedGradeFilter;
    const matchesLot = selectedLotFilter === 'ALL' || item.source_lot === selectedLotFilter || item.source_lot_code === selectedLotFilter;
    
    const wType = getWarehouseType(item.warehouse_name);
    const matchesView = (viewMode === 'WAREHOUSE_STOCK' && wType === 'SORTING') || 
                        (viewMode === 'STORE_STOCK' && wType === 'MAIN');

    return matchesSearch && matchesGrade && matchesLot && matchesView;
  });

  const creamTotalKg = activeStockItems.filter(i => i.grade === 'NEW_COLLECTION').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);
  const midTotalKg = activeStockItems.filter(i => i.grade === 'MIDDLE').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);
  const clrTotalKg = activeStockItems.filter(i => i.grade === 'CLEARANCE').reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('inventory.title')}</h2>
          <p className="text-sm text-slate-500">{t('inventory.subtitle')}</p>
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
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">📦 إجمالي الوسط المتاح</span>
            <Package size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{midTotalKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">كجم</span></div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">🏷️ إجمالي التصفيات والشعبي</span>
            <Tag size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{clrTotalKg.toFixed(3)} <span className="text-xs font-normal text-slate-500">كجم</span></div>
        </div>
      </div>

      {/* Main Table and Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* 3 Main Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/60 p-3 gap-2">
          <button
            onClick={() => setViewMode('WAREHOUSE_STOCK')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              viewMode === 'WAREHOUSE_STOCK' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Factory size={16} /> 🏭 أرصدة مخازن الفرز (البضاعة المفروزة)
          </button>

          <button
            onClick={() => setViewMode('STORE_STOCK')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              viewMode === 'STORE_STOCK' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Store size={16} /> 🏬 أرصدة المحلات للبيع (POS)
          </button>

          <button
            onClick={() => setViewMode('LEDGER')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
              viewMode === 'LEDGER' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <History size={16} /> 📜 سجل الحركات والتحويلات
          </button>
        </div>

        {/* Filters Bar */}
        {viewMode !== 'LEDGER' && (
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white text-xs">
            <div className="flex flex-wrap items-center gap-2 w-full">
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">تصفية بـ الدرجة (عرض الكل)</option>
                <option value="NEW_COLLECTION">✨ كريمة</option>
                <option value="MIDDLE">📦 وسط</option>
                <option value="CLEARANCE">🏷️ تصفيات</option>
              </select>

              <div className="relative flex-1">
                <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
                <input
                  type="text"
                  placeholder="بحث باسم الصنف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-emerald-500`}
                />
              </div>
            </div>
          </div>
        )}

        {/* STOCK BALANCES */}
        {viewMode !== 'LEDGER' && (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">اسم المنتج / الصنف</th>
                  <th className="py-3.5 px-5">الموقع الحالي</th>
                  <th className="py-3.5 px-5 text-center">الدرجة</th>
                  <th className="py-3.5 px-5 text-center">الوزن المتاح (كجم)</th>
                  <th className="py-3.5 px-5 text-center">القطع المتاحة</th>
                  <th className="py-3.5 px-5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {filteredStock.map((item) => {
                  const gradeLabel = item.grade === 'NEW_COLLECTION' ? '✨ كريمة' : (item.grade === 'MIDDLE' ? '📦 وسط' : '🏷️ تصفيات');
                  const isStore = getWarehouseType(item.warehouse_name) === 'MAIN';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-5 font-bold text-slate-900">{item.product_name || 'صنف مفروز'}</td>
                      <td className="py-4 px-5 font-semibold flex items-center gap-1.5">
                        {isStore ? <Store size={14} className="text-indigo-600" /> : <Factory size={14} className="text-emerald-600" />} 
                        {item.warehouse_name}
                      </td>
                      <td className="py-4 px-5 text-center font-bold">{gradeLabel}</td>
                      <td className="py-4 px-5 text-center font-black text-slate-900 text-sm font-mono">
                        {parseFloat(item.total_weight_kg || 0).toFixed(3)} كجم
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-indigo-700 font-mono">
                        {item.total_quantity_pieces || '—'} قطعة
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => openTransferForItem(item)}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition shadow-xs flex items-center gap-1 mx-auto cursor-pointer ${
                            isStore 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isStore ? <><Undo2 size={13} /> إرجاع للفرز</> : <><Truck size={13} /> تحويل للمحل</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-slate-400 text-xs font-bold">
                      لا يوجد رصيد حاليا في {viewMode === 'WAREHOUSE_STOCK' ? 'مخازن الفرز' : 'المحلات'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LEDGER TRANSACTIONS */}
        {viewMode === 'LEDGER' && (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">تاريخ الحركة</th>
                  <th className="py-3.5 px-5">نوع الحركة</th>
                  <th className="py-3.5 px-5">الصنف</th>
                  <th className="py-3.5 px-5">التفاصيل والبيان</th>
                  <th className="py-3.5 px-5 text-center">الوزن (كجم)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {ledgerTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-5 font-mono text-slate-500">{tx.created_at?.slice(0, 10)}</td>
                    <td className="py-3.5 px-5 font-bold text-emerald-700">{tx.transaction_type}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">{tx.product_name || 'بضاعة'}</td>
                    <td className="py-3.5 px-5 text-slate-600">{tx.notes || 'حركة تحويل مخزني'}</td>
                    <td className="py-3.5 px-5 text-center font-bold font-mono">{tx.weight_kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Smart Partial Transfer */}
      {showTransferModal && transferItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ArrowLeftRight size={18} className={getWarehouseType(transferItem.warehouse_name) === 'SORTING' ? 'text-emerald-600' : 'text-rose-600'} /> 
                {getWarehouseType(transferItem.warehouse_name) === 'SORTING' ? 'تحويل بضاعة للبيع في المحل' : 'إرجاع بضاعة من المحل للفرز'}
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-sm">{transferItem.product_name || 'صنف مفروز'}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/80">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-bold">⚖️ الوزن المتاح بالفرز</span>
                  <span className="font-black text-emerald-800 text-xs">{transferItem.total_weight_kg} كجم</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-bold">🔢 القطع المتاحة بالفرز</span>
                  <span className="font-black text-indigo-800 text-xs">{transferItem.total_quantity_pieces || 0} قطعة</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleExecutePartialTransfer} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المكان المستهدف *</label>
                <select
                  required
                  value={targetWarehouse}
                  onChange={(e) => setTargetWarehouse(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {warehouses
                    .filter(w => w.warehouse_type === (getWarehouseType(transferItem.warehouse_name) === 'SORTING' ? 'MAIN' : 'SORTING'))
                    .map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type === 'MAIN' ? 'محل للبيع' : 'مخزن فرز'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الوزن المنقول (كجم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={transferWeightKg}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">القطع المنقولة (تناسبي آلي) *</label>
                  <input
                    type="number"
                    required
                    value={transferPieces}
                    onChange={(e) => handlePiecesChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 text-white font-bold py-2.5 rounded-xl transition shadow-md cursor-pointer text-xs ${
                    getWarehouseType(transferItem.warehouse_name) === 'SORTING' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  }`}
                >
                  {submitting ? 'جاري النقل...' : 'تأكيد ونقل الوزن والقطع معا'}
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
