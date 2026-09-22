import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  Layers, 
  Scale, 
  TrendingUp, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Calculator, 
  ArrowRight,
  Database,
  PlusCircle,
  ClipboardList
} from 'lucide-react';

export default function SortingPage() {
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
      // Load pending raw lots
      const lotRes = await axiosClient.get('/raw-lots/');
      setRawLots((lotRes.data.results || lotRes.data || []).filter(l => l.status !== 'SORTED'));

      // Load warehouses and products
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
      // 1. Create Sorting Order on Backend
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
      alert("Weights are unbalanced. Adjust outputs or waste to match original weight.");
      return;
    }
    setSubmitting(true);
    try {
      const defaultWh = warehouses.find(w => w.warehouse_type === 'MAIN')?.id || warehouses[0]?.id;
      const defaultProd = products[0]?.id;

      // 1. Post Output Lines
      const lines = [
        { grade: 'NEW_COLLECTION', wt: newWeight, pc: newPieces },
        { grade: 'MIDDLE', wt: midWeight, pc: midPieces },
        { grade: 'CLEARANCE', wt: clrWeight, pc: clrPieces }
      ];

      for (const line of lines) {
        await axiosClient.post('/sorting-output-lines/', {
          sorting_order: sortingOrder.id,
          grade: line.grade,
          product: defaultProd,
          weight_kg: line.wt,
          quantity_pieces: line.pc,
          warehouse: defaultWh
        });
      }

      // 2. Post Waste Line
      await axiosClient.post('/sorting-waste-lines/', {
        sorting_order: sortingOrder.id,
        weight_kg: wasteWeight,
        quantity_pieces: wastePieces,
        classification: wasteClass,
        reason: wasteReason
      });

      // 3. Trigger backend Reconcile
      const recRes = await axiosClient.post(`/sorting-orders/${sortingOrder.id}/reconcile/`);
      if (recRes.data.balanced) {
        setIsReconciled(true);
      } else {
        alert("Backend weight reconciliation failed. Check rounding.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save reconciliation lines.");
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
      // Reset
      setSelectedLot(null);
      setSortingOrder(null);
      loadInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to post to inventory.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading Sorting Hub...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bale Sorting & Weight Reconciliation</h2>
        <p className="text-sm text-slate-500">Dual-unit Physical Weight Matching, Costing Apportionment, and Finished Stock Ledger Posting</p>
      </div>

      {!selectedLot ? (
        /* LIST OF RECEIVED BALES PENDING SORTING */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-sm">Pending Raw Bales in Storage</span>
          </div>

          <div className="divide-y divide-slate-150">
            {rawLots.map((lot) => (
              <div key={lot.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Bale ID: {lot.lot_code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                      {lot.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Supplier: {lot.supplier_name} | Received Date: {lot.received_date} | Warehouse: {lot.warehouse_name}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-extrabold text-slate-900 text-sm">{lot.original_weight_kg} KG</div>
                    <div className="text-xs text-slate-500 font-semibold">{lot.purchase_cost} EGP Actual Cost</div>
                  </div>

                  <button
                    onClick={() => handleStartSorting(lot)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" /> Start Sorting
                  </button>
                </div>
              </div>
            ))}

            {rawLots.length === 0 && (
              <div className="py-20 text-center text-slate-400 text-xs">
                No pending bales in raw storage. Create and confirm purchase invoices first.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SORTING WORKSPACE (BALE ACTIVE) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inputs Panel (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bale Summary Info */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">ACTIVE WORKSPACE</span>
                <h3 className="text-lg font-bold">Sorting Lot: {selectedLot.lot_code}</h3>
                <p className="text-xs text-slate-400">Supplier: {selectedLot.supplier_name} | Warehouse: {selectedLot.warehouse_name}</p>
              </div>

              <div className="text-right border-l border-slate-800 pl-6 space-y-1">
                <div className="text-xs text-slate-400">Target Bale Weight</div>
                <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5 justify-end">
                  <Scale size={18} /> {selectedLot.original_weight_kg} KG
                </div>
              </div>
            </div>

            {/* Weights Input Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                <PlusCircle size={16} className="text-emerald-600" /> Enter Sorted Weights & Piece Counts
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* New Collection */}
                <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">✨ New Collection</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Weight (KG)</label>
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
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Count (Pieces)</label>
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
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">📦 Middle Grade</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Weight (KG)</label>
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
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Count (Pieces)</label>
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
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">🏷️ Clearance / Low</span>
                  <div>
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Weight (KG)</label>
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
                    <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Count (Pieces)</label>
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
                    <Trash2 size={13} /> Waste / Damages (هالك الفرز)
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Waste Weight (KG)</label>
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
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Waste Pieces</label>
                  <input
                    type="number"
                    disabled={isReconciled}
                    value={wastePieces}
                    onChange={(e) => setWastePieces(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Classification</label>
                  <select
                    disabled={isReconciled}
                    value={wasteClass}
                    onChange={(e) => setWasteClass(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="NORMAL">Normal / Expected</option>
                    <option value="ABNORMAL">Abnormal / Excess</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold mb-1 block">Waste Reason</label>
                  <input
                    type="text"
                    disabled={isReconciled}
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. torn, stained"
                  />
                </div>
              </div>

              {/* Adjustments Section */}
              <div className="p-4 bg-rose-50/10 rounded-xl border border-rose-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-rose-700 font-bold mb-1 block">Humidity / Moisture Adjustment Weight (KG)</label>
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
                  <label className="text-[11px] text-rose-700 font-bold mb-1 block">Mandatory Adjustment Reason</label>
                  <input
                    type="text"
                    disabled={isReconciled}
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                    placeholder="e.g. 500g moisture weight loss"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation & Workflow Dashboard (Right 1 column) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Scale size={16} className="text-emerald-600" /> Reconciliation Status
              </h3>

              {/* Dynamic Balanced Indicator */}
              <div className={`p-4 rounded-xl border text-center space-y-1.5 ${
                isWeightsBalanced
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block">WEIGHT MATCHING ENGINE</span>
                <div className="text-2xl font-black flex items-center justify-center gap-2">
                  {isWeightsBalanced ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-rose-600" />}
                  {isWeightsBalanced ? 'BALANCED' : 'UNBALANCED'}
                </div>
                <p className="text-xs font-medium">
                  {isWeightsBalanced 
                    ? 'Outputs + Waste + Adjustments matches target weight.' 
                    : `Discrepancy: ${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(3)} KG`
                  }
                </p>
              </div>

              {/* Stats Breakdown */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Target weight:</span>
                  <span className="font-bold text-slate-900">{originalBaleWeight.toFixed(3)} KG</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Good Outputs sorted:</span>
                  <span className="font-bold text-slate-900">{sumOutputs.toFixed(3)} KG</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Waste:</span>
                  <span className="font-bold text-slate-900">{parseFloat(wasteWeight || 0).toFixed(3)} KG</span>
                </div>
                <div className="flex justify-between font-medium text-slate-500">
                  <span>Moisture Adjustment:</span>
                  <span className="font-bold text-slate-900">{parseFloat(adjWeight || 0).toFixed(3)} KG</span>
                </div>
              </div>
            </div>

            {/* Workflow Control Steps (Calculated & Immutable Process) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Database size={16} className="text-emerald-600" /> Sorting Progress Steps
              </h3>

              {/* Step 1 Button */}
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
                  <span className="text-xs">Reconcile & Save Weights</span>
                </div>
                {isReconciled && <CheckCircle2 size={16} className="text-emerald-600" />}
              </button>

              {/* Step 2 Button */}
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
                  <span className="text-xs">Run Costing Allocation</span>
                </div>
                {costingRecord && <CheckCircle2 size={16} className="text-emerald-600" />}
              </button>

              {/* Step 3 Button */}
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
                  <span className="text-xs">Post Finished Stock Ledger</span>
                </div>
              </button>

              {/* Workspace Exit / Cancel */}
              <button
                onClick={() => { setSelectedLot(null); setSortingOrder(null); }}
                className="w-full text-center py-2 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Cancel Workspace
              </button>
            </div>

            {/* Live Costing Results Box */}
            {costingRecord && (
              <div className="bg-emerald-950 text-emerald-300 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 border-b border-emerald-900 pb-2">
                  Allocated Costs Preview
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span>Costing Method:</span>
                    <span className="font-bold text-white">{costingRecord.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waste Loss Cost:</span>
                    <span className="font-bold text-white">{costingRecord.waste_loss} EGP</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-900 pt-2 font-bold text-sm text-white">
                    <span>Good Stock Cost:</span>
                    <span>{costingRecord.allocated_cost} EGP</span>
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
