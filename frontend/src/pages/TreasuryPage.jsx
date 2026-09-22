import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  Vault, 
  ArrowRightLeft, 
  ArrowDownRight, 
  ArrowUpRight, 
  DollarSign, 
  Building, 
  RotateCcw,
  X,
  CreditCard,
  Banknote
} from 'lucide-react';

export default function TreasuryPage() {
  const [treasuries, setTreasuries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Transfer Modal States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [fromTreasury, setFromTreasury] = useState('');
  const [toTreasury, setToTreasury] = useState('');
  const [transferAmount, setTransferAmount] = useState('5000.00');
  const [transferNotes, setTransferNotes] = useState('Shift close handover to main vault');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTreasuryData();
  }, []);

  const loadTreasuryData = async () => {
    setLoading(true);
    try {
      // 1. Load Treasuries
      const tRes = await axiosClient.get('/treasuries/?is_active=true');
      const tList = tRes.data.results || tRes.data || [];
      setTreasuries(tList);
      if (tList.length >= 2) {
        const drawer = tList.find(t => t.treasury_type === 'POS_DRAWER') || tList[0];
        const safe = tList.find(t => t.treasury_type === 'MAIN_SAFE') || tList[1];
        setFromTreasury(drawer.id);
        setToTreasury(safe.id);
      }

      // 2. Load Transactions
      const txRes = await axiosClient.get('/treasury-transactions/');
      setTransactions(txRes.data.results || txRes.data || []);
    } catch (err) {
      console.error("Failed to load treasury data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (!fromTreasury || !toTreasury || fromTreasury === toTreasury) {
      alert("Please select two different treasuries.");
      return;
    }
    setSubmitting(true);
    try {
      // Execute Paired Transfer Out and In
      await axiosClient.post('/treasury-transactions/', {
        treasury: fromTreasury,
        transaction_type: 'TRANSFER_OUT',
        amount: transferAmount,
        description: `Transfer to ${treasuries.find(t => t.id === toTreasury)?.name || 'Vault'}: ${transferNotes}`
      });

      await axiosClient.post('/treasury-transactions/', {
        treasury: toTreasury,
        transaction_type: 'TRANSFER_IN',
        amount: transferAmount,
        description: `Received from ${treasuries.find(t => t.id === fromTreasury)?.name || 'Drawer'}: ${transferNotes}`
      });

      alert("Internal Treasury Transfer Completed Successfully!");
      setShowTransferModal(false);
      loadTreasuryData();
    } catch (err) {
      alert(err.response?.data?.detail || "Transfer failed. Check fund sufficiency.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalFunds = treasuries.reduce((acc, t) => acc + parseFloat(t.current_balance || 0), 0);

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading Treasuries & Vaults...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Treasury Vaults & Liquidity Management</h2>
          <p className="text-sm text-slate-500">Multi-Drawer Cash Balancing, Safe Vault Transfers, and Financial Ledger Audit</p>
        </div>

        <button
          onClick={() => setShowTransferModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <ArrowRightLeft size={16} /> Inter-Treasury Transfer
        </button>
      </div>

      {/* Treasuries Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {treasuries.map((t) => (
          <div key={t.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  {t.treasury_type === 'MAIN_SAFE' ? <Vault size={20} className="text-emerald-600" /> : <Banknote size={20} className="text-blue-600" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.treasury_type?.replace('_', ' ')}</span>
                </div>
              </div>

              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-medium">Current Balance:</span>
              <span className="text-2xl font-black text-slate-900">
                {parseFloat(t.current_balance || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">EGP</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Treasury Ledger History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Vault size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Treasury Transactions Ledger</span>
          </div>

          <button onClick={loadTreasuryData} className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg">
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">Date & Time</th>
                <th className="py-3.5 px-5">Treasury Vault</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Description & Reference</th>
                <th className="py-3.5 px-5 text-right">Amount (EGP)</th>
                <th className="py-3.5 px-5 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium font-mono">
              {transactions.map((tx) => {
                const amt = parseFloat(tx.amount || 0);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-5 text-slate-500 font-sans">{tx.created_at?.substring(0, 16).replace('T', ' ')}</td>
                    <td className="py-3.5 px-5 font-sans font-bold text-slate-900">{tx.treasury_name || 'Treasury'}</td>
                    <td className="py-3.5 px-5 font-sans">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        amt > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-sans text-slate-600">{tx.description || 'Treasury transaction'}</td>
                    <td className={`py-3.5 px-5 text-right font-bold text-sm ${amt >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {amt >= 0 ? `+${amt.toFixed(2)}` : amt.toFixed(2)} EGP
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-slate-900 font-sans">
                      {parseFloat(tx.running_balance || 0).toFixed(2)} EGP
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 text-xs font-sans">
                    No treasury transactions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Inter-Treasury Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Internal Treasury Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Treasury (From) *</label>
                <select
                  value={fromTreasury}
                  onChange={(e) => setFromTreasury(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Balance: {parseFloat(t.current_balance || 0).toFixed(2)} EGP)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Treasury (To) *</label>
                <select
                  value={toTreasury}
                  onChange={(e) => setToTreasury(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Balance: {parseFloat(t.current_balance || 0).toFixed(2)} EGP)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Amount (EGP) *</label>
                <input
                  type="number"
                  step="10"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Reason / Notes</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Executing Transfer...' : 'Confirm & Transfer Funds'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
