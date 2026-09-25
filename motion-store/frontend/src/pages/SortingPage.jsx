import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { 
  Layers, 
  Scale, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Database,
  PlusCircle,
  ClipboardList
} from 'lucide-react';

export default function SortingPage() {
  const { t, isRTL } = useLanguage();

  // Data States
  const [rawLots, setRawLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sorting Workspace States
  const [sortingOrder, setSortingOrder] = useState(null);
  const [newWeight, setNewWeight] = useState('30.000');
  const [newPieces, setNewPieces] = useState(30);
  const [midWeight, setMidWeight] = useState('50.000');
  const [midPieces, setMidPieces] = useState(50);
  const [clrWeight, setClrWeight] = useState('10.000');
  const [clrPieces, setClrPieces] = useState(10);
  
  const [wasteWeight, setWasteWeight] = useState('10.000');
  const [wastePieces, setWastePieces] = useState(10);
  const [wasteClass, setWasteClass] = useState('NORMAL');
  const [wasteReason, setWasteReason] = useState('Stained and torn apparel');

  const [adjWeight, setAdjWeight] = useState('0.000');
  const [adjReason, setAdjReason] = useState('');

  // Workflow Progress States
  const [isReconciled, setIsReconciled] = useState(false);
  const [costingRecord, setCostingRecord] = useState(null);
  const [isPosted, setIsPosted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const lotRes = await axiosClient.get('/raw-lots/');
      setRawLots((lotRes.data.results || lotRes.data || []).filter(l => l.status !== 'SORTED'));

      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      setWarehouses(whRes.data.results || whRes.data || []);

      const prodRes = await axiosClient.get('/products/?is_active=true');
      setProducts(prodRes.data.results || prodRes.data || []);
    } catch (err) {
      console.error("Failed to load sorting data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSorting = async (lot) => {
    setSelectedLot(lot);
    setSubmitting(true);
    try {
      const orderCode = `SRT-${lot.lot_code}`;
      const res = await axiosClient.post('/sorting-orders/', {
        order_code: orderCode,
        raw_lot: lot.id,
        sorting_date: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        notes: `Sorting of bale lot #${lot.lot_code}`
      });
      setSortingOrder(res.data);
      setIsReconciled(false);
      setCostingRecord(null);
      setIsPosted(false);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to start sorting workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  // Live Calculations for Reconciliation Check
  const sumOutputs = parseFloat(newWeight || 0) + parseFloat(midWeight || 0) + parseFloat(clrWeight || 0);
  const totalReconciledWeight = sumOutputs + parseFloat(wasteWeight || 0) + parseFloat(adjWeight || 0);
  const originalBaleWeight = selectedLot ? parseFloat(selectedLot.original_weight_kg) : 0;
  const discrepancy = totalReconciledWeight - originalBaleWeight;
  const isWeightsBalanced = Math.abs(discrepancy) <= 0.001;

    // Step 1: Reconcile Weights
  const handleReconcile = async () => {
    if (!isWeightsBalanced) {
      alert("الأوزان غير متطابقة. يرجى تعديل أوزان الفرز أو الهالك لتبطابق وزن البالة الأصلي.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        outputs: [
          { grade: 'NEW_COLLECTION', weight_kg: parseFloat(newWeight || 0), quantity_pieces: parseInt(newPieces || 0) },
          { grade: 'MIDDLE', weight_kg: parseFloat(midWeight || 0), quantity_pieces: parseInt(midPieces || 0) },
          { grade: 'CLEARANCE', weight_kg: parseFloat(clrWeight || 0), quantity_pieces: parseInt(clrPieces || 0) }
        ],
        wastes: [
          { weight_kg: parseFloat(wasteWeight || 0) + parseFloat(adjWeight || 0), quantity_pieces: parseInt(wastePieces || 0), waste_classification: wasteClass, notes: wasteReason || adjReason || 'هالك فرز' }
        ]
      };

      const targetUrl = '/sorting-orders/' + sortingOrder.id + '/reconcile/';
      const recRes = await axiosClient.post(targetUrl, payload);
      if (recRes.data && recRes.data.balanced) {
        setIsReconciled(true);
        alert("تم حفظ ومطابقة أوزان الفرز بنجاح ✅");
      } else {
        alert(recRes.data?.message || "فشلت المطابقة، تأكد من الأوزان.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "فشل حفظ خطوط ومطابقة الفرز.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Calculate Costing
  const handleCalculateCosting = async () => {
    setSubmitting(true);
    try {
      const res = await axiosClient.post(`/sorting-orders/${sortingOrder.id}/calculate_costing/`);
      setCostingRecord(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to calculate costing allocation.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Post to Stock Inventory Ledger
  const handlePostToInventory = async () => {
    setSubmitting(true);
    try {
      await axiosClient.post(`/sorting-orders/${sortingOrder.id}/post_inventory/`);
      setIsPosted(true);
      alert("Successfully posted sorted grades to Finished Inventory Ledger!");
      setSelectedLot(null);
      setSortingOrder(null);
      loadInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to post to inventory.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('sorting.title')}</h2>
        <p className="text-sm text-slate-500">{t('sorting.subtitle')}</p>
      </div>

      {!selectedLot ? (
        /* LIST OF RECEIVED BALES PENDING SORTING */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-sm">{t('sorting.pendingBales')}</span>
          </div>

          <div className="divide-y divide-slate-150">
            {rawLots.map((lot) => (
              <div key={lot.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{t('common.lot')}: {lot.lot_code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                      {lot.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {lot.supplier_name} | {lot.received_date} | {lot.warehouse_name}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className={isRTL ? 'text-left' : 'text-right'}>
                    <div className="font-extrabold text-slate-900 text-sm">{lot.original_weight_kg} {t('common.kg')}</div>
                    <div className="text-xs text-slate-500 font-semibold">{lot.purchase_cost} {t('common.currency')}</div>
                  </div>

                  <button
                    onClick={() => handleStartSorting(lot)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" /> {t('sorting.startSorting')}
                  </button>
                </div>
              </div>
            ))}

            {rawLots.length === 0 && (
              <div className="py-20 text-center text-slate-400 text-xs">
                {t('sorting.pendingBales')} - 0
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SORTING WORKSPACE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inputs Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{t('sorting.activeWorkspace')}</span>
                <h3 className="text-lg font-bold">{selectedLot.lot_code}</h3>
                <p className="text-xs text-slate-400">{selectedLot.supplier_name} | {selectedLot.warehouse_name}</p>
              </div>

              <div className={`border-slate-800 ${isRTL ? 'border-r pr-6 text-left' : 'border-l pl-6 text-right'} space-y-1`}>
                <div className="text-xs text-slate-400">{t('sorting.targetWeight')}</div>
                <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                  <Scale size={18} /> {selectedLot.original_weight_kg} {t('common.kg')}
                </div>
              </div>
            </div>

            {/* Weights Input Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                <PlusCircle size={16} className="text-emerald-600" /> {t('sorting.weightKg')} & {t('sorting.countPcs')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* New Collection */}
                <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">{t('sorting.newCollection')}</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.weightKg')}</label>
                    <input
                      type="number"
                      step="0.001"
                      disabled={isReconciled}
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.countPcs')}</label>
                    <input
                      type="number"
                      disabled={isReconciled}
                      value={newPieces}
                      onChange={(e) => setNewPieces(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Middle Grade */}
                <div className="p-4 bg-blue-50/20 border border-blue-100 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">{t('sorting.middle')}</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.weightKg')}</label>
                    <input
                      type="number"
                      step="0.001"
                      disabled={isReconciled}
                      value={midWeight}
                      onChange={(e) => setMidWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.countPcs')}</label>
                    <input
                      type="number"
                      disabled={isReconciled}
                      value={midPieces}
                      onChange={(e) => setMidPieces(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Clearance */}
                <div className="p-4 bg-amber-50/20 border border-amber-100 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">{t('sorting.clearance')}</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.weightKg')}</label>
                    <input
                      type="number"
                      step="0.001"
                      disabled={isReconciled}
                      value={clrWeight}
                      onChange={(e) => setClrWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.countPcs')}</label>
                    <input
                      type="number"
                      disabled={isReconciled}
                      value={clrPieces}
                      onChange={(e) => setClrPieces(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Waste Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Trash2 size={13} /> {t('sorting.waste')}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.weightKg')}</label>
                  <input
                    type="number"
                    step="0.001"
                    disabled={isReconciled}
                    value={wasteWeight}
                    onChange={(e) => setWasteWeight(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.countPcs')}</label>
                  <input
                    type="number"
                    disabled={isReconciled}
                    value={wastePieces}
                    onChange={(e) => setWastePieces(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">{t('sorting.wasteClass')}</label>
                  <select
                    disabled={isReconciled}
                    value={wasteClass}
                    onChange={(e) => setWasteClass(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="NORMAL">{t('sorting.normalWaste')}</option>
                    <option value="ABNORMAL">{t('sorting.abnormalWaste')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Notes</label>
                  <input
                    type="text"
                    disabled={isReconciled}
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Adjustments Section */}
              <div className="p-4 bg-rose-50/10 rounded-xl border border-rose-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-rose-700 font-bold mb-1 block">{t('sorting.moistureAdj')}</label>
                  <input
                    type="number"
                    step="0.001"
                    disabled={isReconciled}
                    value={adjWeight}
                    onChange={(e) => setAdjWeight(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-rose-700 font-bold mb-1 block">{t('sorting.adjReason')}</label>
                  <input
                    type="text"
                    disabled={isReconciled}
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation & Workflow Dashboard */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Scale size={16} className="text-emerald-600" /> {t('sorting.statusTitle')}
              </h3>

              <div className={`p-4 rounded-xl border text-center space-y-1.5 ${
                isWeightsBalanced
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                <div className="text-2xl font-black flex items-center justify-center gap-2">
                  {isWeightsBalanced ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-rose-600" />}
                  {isWeightsBalanced ? t('sorting.balanced') : t('sorting.unbalanced')}
                </div>
                <p className="text-xs font-medium">
                  {isWeightsBalanced 
                    ? 'Outputs + Waste + Adjustments matches target weight.' 
                    : `Discrepancy: ${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(3)} KG`
                  }
                </p>
              </div>

              <div className="space-y-2.5 text-xs font-medium">
                <div className="flex justify-between text-slate-500">
                  <span>Target:</span>
                  <span className="font-bold text-slate-900">{originalBaleWeight.toFixed(3)} {t('common.kg')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Good Outputs:</span>
                  <span className="font-bold text-slate-900">{sumOutputs.toFixed(3)} {t('common.kg')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Waste:</span>
                  <span className="font-bold text-slate-900">{parseFloat(wasteWeight || 0).toFixed(3)} {t('common.kg')}</span>
                </div>
              </div>
            </div>

            {/* Workflow Control Steps */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <button
                onClick={handleReconcile}
                disabled={isReconciled || !isWeightsBalanced || submitting}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                  isReconciled 
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed font-medium' 
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isReconciled ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'}`}>
                    1
                  </div>
                  <span className="text-xs">{t('sorting.step1')}</span>
                </div>
                {isReconciled && <CheckCircle2 size={16} className="text-emerald-600" />}
              </button>

              <button
                onClick={handleCalculateCosting}
                disabled={!isReconciled || costingRecord || submitting}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                  !isReconciled || costingRecord
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed font-medium'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${costingRecord ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'}`}>
                    2
                  </div>
                  <span className="text-xs">{t('sorting.step2')}</span>
                </div>
                {costingRecord && <CheckCircle2 size={16} className="text-emerald-600" />}
              </button>

              <button
                onClick={handlePostToInventory}
                disabled={!costingRecord || isPosted || submitting}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                  !costingRecord || isPosted
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed font-medium'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isPosted ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'}`}>
                    3
                  </div>
                  <span className="text-xs">{t('sorting.step3')}</span>
                </div>
              </button>

              <button
                onClick={() => { setSelectedLot(null); setSortingOrder(null); }}
                className="w-full text-center py-2 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>

            {costingRecord && (
              <div className="bg-emerald-950 text-emerald-300 p-5 rounded-2xl shadow-xs space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 border-b border-emerald-900 pb-2">
                  {t('sorting.costingPreview')}
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span>Method:</span>
                    <span className="font-bold text-white">{costingRecord.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waste Loss:</span>
                    <span className="font-bold text-white">{costingRecord.waste_loss} {t('common.currency')}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-900 pt-2 font-bold text-sm text-white">
                    <span>Good Cost:</span>
                    <span>{costingRecord.allocated_cost} {t('common.currency')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
