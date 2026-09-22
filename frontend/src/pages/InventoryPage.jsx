import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  Package, 
  History, 
  Scale, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  DollarSign,
  Boxes,
  RotateCcw
} from 'lucide-react';

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState('BALANCES'); // 'BALANCES' or 'LEDGER'
  const [stockItems, setStockItems] = useState([]);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      // 1. Load Stock Balances
      const stockRes = await axiosClient.get('/stock-items/');
      setStockItems(stockRes.data.results || stockRes.data || []);

      // 2. Load Ledger Transactions
      const ledgerRes = await axiosClient.get('/inventory-ledger/');
      setLedgerTransactions(ledgerRes.data.results || ledgerRes.data || []);

      // 3. Load Warehouses
      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      setWarehouses(whRes.data.results || whRes.data || []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  // KPI Aggregations
  const totalWeight = stockItems.reduce((acc, i) => acc + parseFloat(i.total_weight_kg || 0), 0);
  const totalValuation = stockItems.reduce((acc, i) => acc + parseFloat(i.current_total_value || 0), 0);
  const totalPieces = stockItems.reduce((acc, i) => acc + (parseInt(i.total_quantity_pieces) || 0), 0);

  const newCollectionWeight = stockItems
    .filter(i => i.grade === 'NEW_COLLECTION')
    .reduce((acc, i) => acc + parseFloat(i.total_weight_kg || 0), 0);

  const middleGradeWeight = stockItems
    .filter(i => i.grade === 'MIDDLE')
    .reduce((acc, i) => acc + parseFloat(i.total_weight_kg || 0), 0);

  const clearanceWeight = stockItems
    .filter(i => i.grade === 'CLEARANCE')
    .reduce((acc, i) => acc + parseFloat(i.total_weight_kg || 0), 0);

  // Filtered Stock Balances
  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouse === 'ALL' || item.warehouse === selectedWarehouse;
    const matchesGrade = selectedGrade === 'ALL' || item.grade === selectedGrade;
    return matchesSearch && matchesWh && matchesGrade;
  });

  // Filtered Ledger Entries
  const filteredLedger = ledgerTransactions.filter(txn => {
    const matchesSearch = txn.source_document_id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          txn.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouse === 'ALL' || txn.warehouse === selectedWarehouse;
    const matchesGrade = selectedGrade === 'ALL' || txn.grade === selectedGrade;
    return matchesSearch && matchesWh && matchesGrade;
  });

  const getTransactionBadge = (type) => {
    switch (type) {
      case 'SORT_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit"><ArrowDownRight size={12}/> SORT IN</span>;
      case 'SALE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-fit"><ArrowUpRight size={12}/> POS SALE</span>;
      case 'RETURN_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1 w-fit"><RotateCcw size={12}/> RETURN</span>;
      case 'TRANSFER_OUT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit"><ArrowUpRight size={12}/> TRF OUT</span>;
      case 'TRANSFER_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 flex items-center gap-1 w-fit"><ArrowDownRight size={12}/> TRF IN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 w-fit">{type}</span>;
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading Finished Inventory Ledger...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Finished Inventory & Ledger</h2>
          <p className="text-sm text-slate-500">Live Multi-Warehouse Balances, Dual-Unit Tracking, and Immutable Audit Journal</p>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 self-start">
          <button
            onClick={() => setViewMode('BALANCES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === 'BALANCES' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes size={15} /> Stock Balances
          </button>
          <button
            onClick={() => setViewMode('LEDGER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === 'LEDGER' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} /> Audit Ledger Log
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Available Stock</span>
          <div className="text-2xl font-black text-slate-900">{totalWeight.toFixed(3)} <span className="text-xs font-normal text-slate-500">KG</span></div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium">
            <Package size={13} className="text-emerald-600" /> Across all locations ({totalPieces} pcs)
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Valuation</span>
          <div className="text-2xl font-black text-emerald-600">{totalValuation.toFixed(2)} <span className="text-xs font-normal text-slate-500">EGP</span></div>
          <p className="text-xs text-emerald-700 mt-2 font-medium">
            Actual Apportioned Cost Basis
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">✨ New Collection</span>
          <div className="text-2xl font-black text-indigo-600">{newCollectionWeight.toFixed(3)} <span className="text-xs font-normal text-slate-500">KG</span></div>
          <p className="text-xs text-indigo-700 mt-2 font-medium">
            Avg Cost: ~176.47 EGP/KG
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Middle & Clearance</span>
          <div className="text-2xl font-black text-amber-600">{(middleGradeWeight + clearanceWeight).toFixed(3)} <span className="text-xs font-normal text-slate-500">KG</span></div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Mid: {middleGradeWeight.toFixed(1)}k | Clear: {clearanceWeight.toFixed(1)}k
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={viewMode === 'BALANCES' ? "Search product name..." : "Search document ref or notes..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Warehouse Selector */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>

          {/* Grade Selector */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Grades</option>
            <option value="NEW_COLLECTION">New Collection</option>
            <option value="MIDDLE">Middle Grade</option>
            <option value="CLEARANCE">Clearance</option>
          </select>
        </div>

        <button 
          onClick={loadInventoryData}
          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition"
          title="Refresh Data"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* VIEW 1: STOCK BALANCES TABLE */}
      {viewMode === 'BALANCES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Product & Grade</th>
                  <th className="py-3.5 px-5">Warehouse</th>
                  <th className="py-3.5 px-5 text-right">Available Weight</th>
                  <th className="py-3.5 px-5 text-right">Piece Count</th>
                  <th className="py-3.5 px-5 text-right">Unit Cost (COGS)</th>
                  <th className="py-3.5 px-5 text-right">Total Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {filteredStock.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-sm">{item.product_name}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.grade === 'NEW_COLLECTION' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : item.grade === 'MIDDLE' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.grade?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">{item.warehouse_name}</td>
                    <td className="py-4 px-5 text-right font-bold text-slate-900 text-sm">
                      {parseFloat(item.total_weight_kg).toFixed(3)} <span className="text-[10px] font-normal text-slate-500">KG</span>
                    </td>
                    <td className="py-4 px-5 text-right font-semibold text-slate-700">{item.total_quantity_pieces} pcs</td>
                    <td className="py-4 px-5 text-right font-mono font-semibold text-slate-600">
                      {parseFloat(item.avg_cost_per_kg).toFixed(2)} EGP
                    </td>
                    <td className="py-4 px-5 text-right font-bold text-emerald-700 text-sm">
                      {parseFloat(item.current_total_value).toFixed(2)} EGP
                    </td>
                  </tr>
                ))}

                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-slate-400 text-xs">
                      No stock items found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT LEDGER JOURNAL STREAM */}
      {viewMode === 'LEDGER' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Date & Type</th>
                  <th className="py-3.5 px-5">Product & Grade</th>
                  <th className="py-3.5 px-5">Warehouse</th>
                  <th className="py-3.5 px-5">Source Document</th>
                  <th className="py-3.5 px-5 text-right">Weight Change</th>
                  <th className="py-3.5 px-5 text-right">Applied Cost</th>
                  <th className="py-3.5 px-5 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
                {filteredLedger.map((txn) => {
                  const wtChange = parseFloat(txn.weight_change_kg);
                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/70 transition font-mono">
                      <td className="py-3.5 px-5">
                        <div className="text-[11px] text-slate-500 font-sans">{txn.created_at?.substring(0, 10)}</div>
                        <div className="mt-1">{getTransactionBadge(txn.transaction_type)}</div>
                      </td>
                      <td className="py-3.5 px-5 font-sans">
                        <div className="font-bold text-slate-900 text-xs">{txn.product_name || 'Item'}</div>
                        <div className="text-[10px] text-slate-500">{txn.grade}</div>
                      </td>
                      <td className="py-3.5 px-5 font-sans text-slate-600">{txn.warehouse_name || 'Warehouse'}</td>
                      <td className="py-3.5 px-5 font-sans">
                        <span className="font-bold text-slate-700">{txn.source_document_id}</span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{txn.notes}</div>
                      </td>
                      <td className={`py-3.5 px-5 text-right font-bold text-xs ${wtChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {wtChange >= 0 ? `+${wtChange.toFixed(3)}` : wtChange.toFixed(3)} KG
                      </td>
                      <td className="py-3.5 px-5 text-right font-semibold text-slate-600">
                        {parseFloat(txn.unit_cost).toFixed(2)} EGP
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                        {parseFloat(txn.running_weight_balance).toFixed(3)} KG
                      </td>
                    </tr>
                  );
                })}

                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-slate-400 text-xs font-sans">
                      No ledger transactions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
