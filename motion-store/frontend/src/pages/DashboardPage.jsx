import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  DollarSign,
  TrendingUp,
  Package,
  Clock,
  Vault,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Layers,
  Receipt,
  Tag
} from 'lucide-react';

export default function DashboardPage() {
  const { user, tenant } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  // Live Metrics
  const [todaySales, setTodaySales] = useState(0);
  const [todayInvoicesCount, setTodayInvoicesCount] = useState(0);
  const [todayGrossProfit, setTodayGrossProfit] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayNetProfit, setTodayNetProfit] = useState(0);

  // Health Bar & Vaults
  const [activeShift, setActiveShift] = useState(null);
  const [treasuryTotal, setTreasuryTotal] = useState(0);
  const [posDrawerBalance, setPosDrawerBalance] = useState(0);
  const [totalSellableStockKg, setTotalSellableStockKg] = useState(0);
  const [pendingBalesCount, setPendingBalesCount] = useState(0);

  // Alerts & Tables
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [shiftDiscrepancies, setShiftDiscrepancies] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topSellers, setTopSellers] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (loading) setLoading(true);
    else setRefreshing(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [sRes, stockRes, tRes, txRes, shiftRes, lotRes] = await Promise.all([
        axiosClient.get('/sales/'),
        axiosClient.get('/stock-items/'),
        axiosClient.get('/treasuries/'),
        axiosClient.get('/treasury-transactions/'),
        axiosClient.get('/shifts/'),
        axiosClient.get('/raw-lots/')
      ]);

      const salesList = sRes.data.results || sRes.data || [];
      const stockList = stockRes.data.results || stockRes.data || [];
      const treasuriesList = tRes.data.results || tRes.data || [];
      const txList = txRes.data.results || txRes.data || [];
      const shiftList = shiftRes.data.results || shiftRes.data || [];
      const lotsList = lotRes.data.results || lotRes.data || [];

      // 1. Today's Sales Metrics
      const todayInvoices = salesList.filter(s => {
        const d = s.invoice_date_time ? s.invoice_date_time.split('T')[0] : '';
        return d === todayStr;
      });

      const salesSum = todayInvoices.reduce((acc, s) => acc + parseFloat(s.total_amount || 0), 0);
      const cogsSum = todayInvoices.reduce((acc, s) => acc + parseFloat(s.total_cogs || 0), 0);
      const grossProfitSum = salesSum - cogsSum;

      setTodaySales(salesSum);
      setTodayInvoicesCount(todayInvoices.length);
      setTodayGrossProfit(grossProfitSum);

      // 2. Today's Expenses Metrics
      const todayExpList = txList.filter(tx => {
        const d = tx.created_at ? tx.created_at.split('T')[0] : '';
        return tx.transaction_type === 'WITHDRAWAL' && d === todayStr;
      });
      const expSum = todayExpList.reduce((acc, tx) => acc + Math.abs(parseFloat(tx.amount || 0)), 0);
      setTodayExpenses(expSum);

      // 3. Net Profit Today
      setTodayNetProfit(grossProfitSum - expSum);

      // 4. Shift & Vault Status
      const currentOpenShift = shiftList.find(sh => sh.status === 'OPEN');
      setActiveShift(currentOpenShift || null);

      const discrepancies = shiftList.filter(sh => sh.status === 'REVIEW' || parseFloat(sh.difference || 0) !== 0);
      setShiftDiscrepancies(discrepancies.slice(0, 5));

      const totalVaults = treasuriesList.reduce((acc, tr) => acc + parseFloat(tr.current_balance || 0), 0);
      setTreasuryTotal(totalVaults);

      const posDrawer = treasuriesList.find(tr => tr.treasury_type === 'POS_DRAWER');
      setPosDrawerBalance(posDrawer ? parseFloat(posDrawer.current_balance || 0) : 0);

      // 5. Stock Metrics & Low Stock Alerts
      const totalKg = stockList.reduce((acc, st) => acc + parseFloat(st.total_weight_kg || 0), 0);
      setTotalSellableStockKg(totalKg);

      const lowItems = stockList.filter(st => {
        const available = parseFloat(st.total_weight_kg || 0);
        const minLimit = parseFloat(st.product?.min_stock_level || 5.0);
        return available <= minLimit;
      });
      setLowStockAlerts(lowItems.slice(0, 5));

      // 6. Raw Lots Awaiting Sorting
      const pendingLots = lotsList.filter(l => l.status === 'RECEIVED' || l.status === 'UNSORTED');
      setPendingBalesCount(pendingLots.length);

      // 7. Recent Invoices
      setRecentInvoices(salesList.slice(0, 5));

      // 8. Top Sellers Today
      const productSalesMap = {};
      todayInvoices.forEach(inv => {
        (inv.lines || []).forEach(line => {
          const pName = line.product_name || 'صنف';
          if (!productSalesMap[pName]) {
            productSalesMap[pName] = { name: pName, weight: 0, amount: 0 };
          }
          productSalesMap[pName].weight += parseFloat(line.weight_kg || 0);
          productSalesMap[pName].amount += parseFloat(line.total_price || 0);
        });
      });

      const topList = Object.values(productSalesMap).sort((a, b) => b.amount - a.amount).slice(0, 5);
      setTopSellers(topList);

      setLastUpdated(new Date().toLocaleTimeString('ar-EG'));

    } catch (err) {
      console.error('Dashboard data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header & Quick Refresh */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-wide">لوحة التحكم القيادية للمدير</h1>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-0.5 rounded-full text-xs font-bold">
              ● بيانات حية مباشرة
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">نبض المنشأة ومؤشرات الأداء المالي والمخزني اليومية</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">آخر تحديث: {lastUpdated || 'الآن'}</span>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'جاري التحديث...' : 'تحديث البيانات الحية'}</span>
          </button>
        </div>
      </div>

      {/* 1. HEALTH STATUS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* SHIFT STATUS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeShift ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">الوردية النقدية الحالية</span>
              <span className="text-xs font-black text-slate-900">
                {activeShift ? `وردية #${activeShift.shift_code} (${activeShift.cashier_username || 'كاشير'})` : 'مغلقة — لا يوجد بيع نشط'}
              </span>
            </div>
          </div>
          <span className={`w-3 h-3 rounded-full ${activeShift ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
        </div>

        {/* VAULTS & CASH */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Vault size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الخزائن والسيولة</span>
              <span className="text-sm font-black text-slate-900">{treasuryTotal.toLocaleString()} ج.م</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
            درج الكاشير: {posDrawerBalance.toLocaleString()} ج.م
          </span>
        </div>

        {/* SELLABLE STOCK */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">المخزون الجاهز للبيع</span>
              <span className="text-sm font-black text-slate-900">{totalSellableStockKg.toFixed(2)} كجم</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
            مفحوص بدفتر الأستاذ
          </span>
        </div>

        {/* PENDING BALES */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">بالات بانتظار الفرز</span>
              <span className="text-sm font-black text-slate-900">{pendingBalesCount} بالة خام</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200">
            جاهزة للتوجيه
          </span>
        </div>

      </div>

      {/* 2. REAL-TIME TODAY KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* TODAY SALES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مبيعات اليوم الصافية</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {todaySales.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <ArrowUpRight size={14} /> عدد الفواتير: {todayInvoicesCount}
            </span>
            <span className="text-slate-400 font-mono">اليوم</span>
          </div>
        </div>

        {/* TODAY GROSS PROFIT */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجمل ربح اليوم (Gross Profit)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-900">
            {todayGrossProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-blue-700 font-bold">
              هامش الربح: {todaySales > 0 ? ((todayGrossProfit / todaySales) * 100).toFixed(1) : 0}%
            </span>
            <span className="text-slate-400 font-mono">بعد خصم COGS</span>
          </div>
        </div>

        {/* TODAY EXPENSES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مصروفات ونثريات اليوم</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-900">
            {todayExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-rose-700 font-bold">خصم مباشر من الخزينة</span>
            <span className="text-slate-400 font-mono">نثريات وسُلف</span>
          </div>
        </div>

        {/* TODAY NET PROFIT */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-2 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">صافي ربح اليوم الفعلي (Net)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {todayNetProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <span className="text-emerald-400 font-bold">الربح الصافي النهائي</span>
            <span className="text-slate-400 font-mono">اليوم</span>
          </div>
        </div>

      </div>

      {/* 3. SMART MANAGER ALERTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LOW STOCK ALERTS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={16} />
              تنبيهات الأصناف تحت حد الأمان
            </h3>
            <span className="text-[11px] font-bold text-slate-500">{lowStockAlerts.length} أصناف تحتاح توريد</span>
          </div>

          {lowStockAlerts.length === 0 ? (
            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              جميع الأصناف متوفرة فوق الحد الأدنى للأمان — لا يوجد نقص مخزني ✅
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockAlerts.map(st => (
                <div key={st.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-slate-900 block">{st.product_name || st.product?.name}</span>
                    <span className="text-[10px] text-slate-500">كود: {st.product?.code || '—'}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-black text-rose-600 block">{parseFloat(st.total_weight_kg || 0).toFixed(2)} كجم متبقي</span>
                    <span className="text-[10px] text-slate-400">الحد الأدنى: {st.product?.min_stock_level || 5} كجم</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SHIFT DISCREPANCIES / REVIEW */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <AlertCircle className="text-rose-500" size={16} />
              مطابقة ومراجعة ورديات الكاشيرية
            </h3>
            <span className="text-[11px] font-bold text-slate-500">سجل الفرق والنقدية</span>
          </div>

          {shiftDiscrepancies.length === 0 ? (
            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              جميع الورديات المغلقة متوازنة ومطابقة 100% بدون عجز أو زيادة ✅
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shiftDiscrepancies.map(sh => (
                <div key={sh.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-slate-900 block">وردية #{sh.shift_code} ({sh.cashier_username})</span>
                    <span className="text-[10px] text-slate-500">تاريخ: {new Date(sh.opened_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="text-left">
                    <span className={`font-black text-xs block ${parseFloat(sh.difference || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {parseFloat(sh.difference || 0) < 0 ? `عجز: ${sh.difference} ج.م` : `زيادة: +${sh.difference} ج.م`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 4. REAL-TIME ANALYTICS & TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* TOP SELLERS TODAY */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div className="border-b pb-2 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Tag size={16} className="text-emerald-600" />
              الأصناف الأكثر مبيعاً ورواجاً اليوم
            </h3>
            <span className="text-[10px] font-bold text-slate-400">حسب الإيراد</span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y">
                <tr>
                  <th className="p-2">الصنف</th>
                  <th className="p-2">الوزن المباع</th>
                  <th className="p-2 text-left">إجمالي الإيراد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {topSellers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-slate-400">لا توجد مبيعات مسجلة اليوم بعد</td>
                  </tr>
                ) : (
                  topSellers.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-black text-slate-900">{item.name}</td>
                      <td className="p-2 font-mono font-bold text-slate-700">{item.weight.toFixed(3)} كجم</td>
                      <td className="p-2 text-left font-black text-emerald-700">{item.amount.toFixed(2)} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT POS INVOICES */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div className="border-b pb-2 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Receipt size={16} className="text-blue-600" />
              أحدث الفواتير الصادرة من نقاط البيع
            </h3>
            <span className="text-[10px] font-bold text-slate-400">آخر 5 فواتير</span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y">
                <tr>
                  <th className="p-2">رقم الفاتورة</th>
                  <th className="p-2">التاريخ والوقت</th>
                  <th className="p-2">الكاشير</th>
                  <th className="p-2 text-left">المبلغ المطلوب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400">لا توجد فواتير صادر حتى الآن</td>
                  </tr>
                ) : (
                  recentInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-slate-800">{inv.invoice_number}</td>
                      <td className="p-2 font-mono text-slate-500">{new Date(inv.invoice_date_time).toLocaleTimeString('ar-EG')}</td>
                      <td className="p-2 font-bold text-slate-700">{inv.cashier_username || 'كاشير'}</td>
                      <td className="p-2 text-left font-black text-slate-900">{parseFloat(inv.total_amount).toFixed(2)} ج.م</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
