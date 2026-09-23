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
  RotateCcw
} from 'lucide-react';

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();

  const [viewMode, setViewMode] = useState('BALANCES');
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
      const stockRes = await axiosClient.get('/stock-items/');
      setStockItems(stockRes.data.results || stockRes.data || []);

      const ledgerRes = await axiosClient.get('/inventory-ledger/');
      setLedgerTransactions(ledgerRes.data.results || ledgerRes.data || []);

      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      setWarehouses(whRes.data.results || whRes.data || []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouse === 'ALL' || item.warehouse === selectedWarehouse;
    const matchesGrade = selectedGrade === 'ALL' || item.grade === selectedGrade;
    return matchesSearch && matchesWh && matchesGrade;
  });

  const filteredLedger = ledgerTransactions.filter(txn => {
    const matchesSearch = txn.source_document_id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          txn.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouse === 'ALL' || txn.warehouse === selectedWarehouse;
    const matchesGrade = selectedGrade === 'ALL' || txn.grade === selectedGrade;
    return matchesSearch && matchesWh && matchesGrade;
  });

  const getGradeLabel = (gradeKey) => {
    if (gradeKey === 'NEW_COLLECTION') return t('inventory.gradeNew');
    if (gradeKey === 'MIDDLE') return t('inventory.gradeMid');
    if (gradeKey === 'CLEARANCE') return t('inventory.gradeClr');
    return gradeKey;
  };

  const getTransactionBadge = (type) => {
    switch (type) {
      case 'SORT_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit"><ArrowDownRight size={12}/> {t('inventory.txnSortIn')}</span>;
      case 'SALE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-fit"><ArrowUpRight size={12}/> {t('inventory.txnSale')}</span>;
      case 'RETURN_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1 w-fit"><RotateCcw size={12}/> {t('inventory.txnReturnIn')}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 w-fit">{type}</span>;
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('inventory.title')}</h2>
          <p className="text-sm text-slate-500">{t('inventory.subtitle')}</p>
        </div>

        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 self-start">
          <button
            onClick={() => setViewMode('BALANCES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'BALANCES' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes size={15} /> {t('inventory.stockBalances')}
          </button>
          <button
            onClick={() => setViewMode('LEDGER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'LEDGER' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} /> {t('inventory.auditLedger')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('inventory.totalStock')}</span>
          <div className="text-2xl font-black text-slate-900">{totalWeight.toFixed(3)} <span className="text-xs font-normal text-slate-500">{t('common.kg')}</span></div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium">
            <Package size={13} className="text-emerald-600" /> {t('inventory.acrossWhSub')} ({totalPieces} {t('common.pcs')})
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('inventory.totalValuation')}</span>
          <div className="text-2xl font-black text-emerald-600">{totalValuation.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span></div>
          <p className="text-xs text-emerald-700 mt-2 font-bold">{t('inventory.costBasisSub')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('inventory.gradeNew')}</span>
          <div className="text-2xl font-black text-indigo-600">{newCollectionWeight.toFixed(3)} <span className="text-xs font-normal text-slate-500">{t('common.kg')}</span></div>
          <p className="text-xs text-indigo-700 mt-2 font-semibold">{t('inventory.avgCostSub')} ~176.47 {t('common.currency')}/{t('common.kg')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('inventory.midAndClear')}</span>
          <div className="text-2xl font-black text-amber-600">{(middleGradeWeight + clearanceWeight).toFixed(3)} <span className="text-xs font-normal text-slate-500">{t('common.kg')}</span></div>
          <p className="text-xs text-slate-500 mt-2 font-medium">{t('inventory.midLabel')}: {middleGradeWeight.toFixed(1)}k | {t('inventory.clearLabel')}: {clearanceWeight.toFixed(1)}k</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-3 text-slate-400`} />
            <input
              type="text"
              placeholder={viewMode === 'BALANCES' ? t('inventory.searchPlaceholderBalances') : t('inventory.searchPlaceholderLedger')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500`}
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">{t('inventory.allWarehouses')}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">{t('inventory.allGrades')}</option>
            <option value="NEW_COLLECTION">{t('inventory.gradeNew')}</option>
            <option value="MIDDLE">{t('inventory.gradeMid')}</option>
            <option value="CLEARANCE">{t('inventory.gradeClr')}</option>
          </select>
        </div>

        <button 
          onClick={loadInventoryData}
          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
          title={t('common.refresh')}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* VIEW 1: STOCK BALANCES */}
      {viewMode === 'BALANCES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">{t('inventory.colProduct')}</th>
                  <th className="py-3.5 px-5">{t('inventory.colWarehouse')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colWeight')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colPieces')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colCost')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colTotal')}</th>
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
                        {getGradeLabel(item.grade)}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">{item.warehouse_name}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-slate-900 text-sm`}>
                      {parseFloat(item.total_weight_kg).toFixed(3)} <span className="text-[10px] font-normal text-slate-500">{t('common.kg')}</span>
                    </td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-semibold text-slate-700`}>{item.total_quantity_pieces} {t('common.pcs')}</td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-mono font-semibold text-slate-600`}>
                      {parseFloat(item.avg_cost_per_kg).toFixed(2)} {t('common.currency')}
                    </td>
                    <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-emerald-700 text-sm`}>
                      {parseFloat(item.current_total_value).toFixed(2)} {t('common.currency')}
                    </td>
                  </tr>
                ))}

                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-slate-400 text-xs font-bold">
                      {t('inventory.noStockFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: LEDGER JOURNAL STREAM */}
      {viewMode === 'LEDGER' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">{t('inventory.colDate')}</th>
                  <th className="py-3.5 px-5">{t('inventory.colProduct')}</th>
                  <th className="py-3.5 px-5">{t('inventory.colWarehouse')}</th>
                  <th className="py-3.5 px-5">{t('inventory.colDoc')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colChange')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colCost')}</th>
                  <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('inventory.colRunning')}</th>
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
                        <div className="text-[10px] text-slate-500">{getGradeLabel(txn.grade)}</div>
                      </td>
                      <td className="py-3.5 px-5 font-sans text-slate-600">{txn.warehouse_name || 'Warehouse'}</td>
                      <td className="py-3.5 px-5 font-sans">
                        <span className="font-bold text-slate-700">{txn.source_document_id}</span>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{txn.notes}</div>
                      </td>
                      <td className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-xs ${wtChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {wtChange >= 0 ? `+${wtChange.toFixed(3)}` : wtChange.toFixed(3)} {t('common.kg')}
                      </td>
                      <td className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'} font-semibold text-slate-600`}>
                        {parseFloat(txn.unit_cost).toFixed(2)} {t('common.currency')}
                      </td>
                      <td className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-slate-900`}>
                        {parseFloat(txn.running_weight_balance).toFixed(3)} {t('common.kg')}
                      </td>
                    </tr>
                  );
                })}

                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-slate-400 text-xs font-sans">
                      {t('inventory.noLedgerFound')}
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
