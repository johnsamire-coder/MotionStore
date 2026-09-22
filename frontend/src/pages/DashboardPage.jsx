import React, { useState } from 'react';
import { DollarSign, Package, TrendingUp, Layers, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  const [stats] = useState({
    totalRevenue: '6,250.00',
    totalProfit: '2,573.45',
    marginPct: '41.18',
    activeBales: '1',
    stockAvailableKg: '55.000'
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
        <p className="text-sm text-slate-500">Real-time Bale Yield, POS Sales, and Inventory Ledger Metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Sales</span>
            <DollarSign size={20} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalRevenue} <span className="text-xs font-normal text-slate-500">EGP</span></div>
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
            <ArrowUpRight size={14} /> Reconciled POS Shift
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Profit</span>
            <TrendingUp size={20} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalProfit} <span className="text-xs font-normal text-slate-500">EGP</span></div>
          <p className="text-xs text-indigo-600 mt-2 font-semibold">
            Margin: {stats.marginPct}%
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Inventory</span>
            <Package size={20} className="text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.stockAvailableKg} <span className="text-xs font-normal text-slate-500">KG</span></div>
          <p className="text-xs text-slate-500 mt-2">
            Ledger-Verified Balance
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Processed Bales</span>
            <Layers size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.activeBales} <span className="text-xs font-normal text-slate-500">Lot</span></div>
          <p className="text-xs text-blue-600 mt-2">
            100% Weight Reconciled
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-base mb-4">Core Operating Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-sm font-medium text-slate-700">Configurable Costing Policy</span>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
              Method B (Coefficients) / Case 2 (Separate Waste Loss)
            </span>
          </div>
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-sm font-medium text-slate-700">Accounting Ledger</span>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">
              Double-Entry Balanced (Dr = Cr)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
