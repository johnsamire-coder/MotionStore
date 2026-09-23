import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { DollarSign, Package, TrendingUp, Layers, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useLanguage();

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
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('dashboard.title')}</h2>
        <p className="text-sm text-slate-500">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.grossSales')}</span>
            <DollarSign size={20} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalRevenue} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span></div>
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2 font-bold">
            <ArrowUpRight size={14} /> POS Shift Verified
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.grossProfit')}</span>
            <TrendingUp size={20} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalProfit} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span></div>
          <p className="text-xs text-indigo-600 mt-2 font-bold">
            {t('dashboard.margin')}: {stats.marginPct}%
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.activeInventory')}</span>
            <Package size={20} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.stockAvailableKg} <span className="text-xs font-normal text-slate-500">{t('common.kg')}</span></div>
          <p className="text-xs text-slate-500 mt-2 font-bold">
            Ledger Balance
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.processedBales')}</span>
            <Layers size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.activeBales} <span className="text-xs font-normal text-slate-500">Lot</span></div>
          <p className="text-xs text-blue-600 mt-2 font-bold">
            100% Reconciled
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">System Status & Policies</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700">{t('dashboard.costingPolicy')}</span>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
              {t('dashboard.policyDesc')}
            </span>
          </div>
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700">{t('dashboard.accountingLedger')}</span>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">
              {t('dashboard.ledgerDesc')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
