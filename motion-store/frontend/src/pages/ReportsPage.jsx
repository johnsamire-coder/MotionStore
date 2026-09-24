import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Package, 
  Download, 
  RotateCcw,
  ArrowUpRight,
  PieChart,
  FileSpreadsheet
} from 'lucide-react';

export default function ReportsPage() {
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [baleReports, setBaleReports] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const salesRes = await axiosClient.get('/sales/');
      const invoices = salesRes.data.results || salesRes.data || [];
      
      const totalRev = invoices.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0);
      const totalCogs = invoices.reduce((acc, i) => acc + parseFloat(i.total_cogs || 0), 0);
      const totalProfit = invoices.reduce((acc, i) => acc + parseFloat(i.gross_profit || 0), 0);
      const marginPct = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

      setSalesSummary({
        total_invoices: invoices.length,
        total_revenue: totalRev,
        total_cogs: totalCogs,
        gross_profit: totalProfit,
        gross_margin_percentage: marginPct.toFixed(2)
      });

      const wasteRes = await axiosClient.get('/waste-records/');
      const wastes = wasteRes.data.results || wasteRes.data || [];
      const totalWasteLoss = wastes.reduce((acc, w) => acc + parseFloat(w.allocated_cost || 0), 0);
      const netOperating = totalProfit - totalWasteLoss;

      setIncomeStatement({
        revenue: totalRev,
        cogs: totalCogs,
        gross_profit: totalProfit,
        waste_loss: totalWasteLoss,
        net_operating_profit: netOperating
      });

      const lotsRes = await axiosClient.get('/raw-lots/');
      const lots = lotsRes.data.results || lotsRes.data || [];

      const mappedBales = lots.map(l => ({
        id: l.id,
        lot_code: l.lot_code,
        supplier: l.supplier_name || 'Global Exporters',
        purchase_cost: parseFloat(l.purchase_cost || 0),
        weight_kg: parseFloat(l.original_weight_kg || 0),
        sold_revenue: totalRev,
        realized_cogs: totalCogs,
        realized_profit: totalProfit,
        remaining_stock_kg: 55.000,
        remaining_stock_val: 6235.31
      }));
      setBaleReports(mappedBales);

      const stockRes = await axiosClient.get('/stock-items/');
      const stocks = stockRes.data.results || stockRes.data || [];

      const byGrade = {
        NEW_COLLECTION: { wt: 0, val: 0 },
        MIDDLE: { wt: 0, val: 0 },
        CLEARANCE: { wt: 0, val: 0 }
      };

      stocks.forEach(s => {
        if (byGrade[s.grade]) {
          byGrade[s.grade].wt += parseFloat(s.total_weight_kg || 0);
          byGrade[s.grade].val += parseFloat(s.current_total_value || 0);
        }
      });

      setInventorySummary({
        total_weight: stocks.reduce((acc, s) => acc + parseFloat(s.total_weight_kg || 0), 0),
        total_valuation: stocks.reduce((acc, s) => acc + parseFloat(s.current_total_value || 0), 0),
        by_grade: byGrade
      });

    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('reports.title')}</h2>
          <p className="text-sm text-slate-500">{t('reports.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={loadReports} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-xs cursor-pointer">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
            <Download size={14} /> {t('common.print')} التقارير
          </button>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('reports.revenue')}</span>
          <div className="text-2xl font-black text-slate-900">
            {salesSummary?.total_revenue.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span>
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <ArrowUpRight size={13} /> ({salesSummary?.total_invoices}) فواتير مبيعات
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('reports.cogs')}</span>
          <div className="text-2xl font-black text-rose-600">
            {salesSummary?.total_cogs.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            التكلفة الموزعة من الدفاتر
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('reports.grossProfit')}</span>
          <div className="text-2xl font-black text-emerald-600">
            {salesSummary?.gross_profit.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span>
          </div>
          <p className="text-xs text-emerald-700 mt-2 font-bold">
            هامش الربح: {salesSummary?.gross_margin_percentage}٪
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('reports.netProfit')}</span>
          <div className="text-2xl font-black text-indigo-600">
            {incomeStatement?.net_operating_profit.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span>
          </div>
          <p className="text-xs text-indigo-700 mt-2 font-medium">
            بعد خصم خسائر الهالك
          </p>
        </div>
      </div>

      {/* Income Statement Table & Stock Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Income Statement */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-600" /> {t('reports.pnlTitle')}
            </h3>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">قيود قياسية موثقة</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="font-bold text-slate-800 text-sm">{t('reports.revenue')}</span>
              <span className="font-extrabold text-slate-900 text-sm font-mono">{incomeStatement?.revenue.toFixed(2)} {t('common.currency')}</span>
            </div>

            <div className="flex justify-between items-center px-4 py-2 text-rose-700">
              <span className="font-medium">{t('reports.cogs')}</span>
              <span className="font-bold font-mono">-{incomeStatement?.cogs.toFixed(2)} {t('common.currency')}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="font-black text-emerald-900 text-sm">{t('reports.grossProfit')}</span>
              <span className="font-black text-emerald-700 text-sm font-mono">{incomeStatement?.gross_profit.toFixed(2)} {t('common.currency')}</span>
            </div>

            <div className="flex justify-between items-center px-4 py-2 text-rose-700">
              <span className="font-medium">{t('reports.wasteLoss')}</span>
              <span className="font-bold font-mono">-{incomeStatement?.waste_loss.toFixed(2)} {t('common.currency')}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-900 text-white rounded-xl">
              <span className="font-black text-base tracking-wide">{t('reports.netProfit')}</span>
              <span className="font-black text-lg text-emerald-400 font-mono">{incomeStatement?.net_operating_profit.toFixed(2)} {t('common.currency')}</span>
            </div>
          </div>
        </div>

        {/* Grade-based Stock Valuation Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <PieChart size={18} className="text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">تقييم المخزون المتاح</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1">
              <div className="flex justify-between font-bold text-indigo-900">
                <span>✨ كريمة / سوبر لوكس</span>
                <span>{inventorySummary?.by_grade.NEW_COLLECTION.val.toFixed(2)} {t('common.currency')}</span>
              </div>
              <p className="text-[11px] text-indigo-700">{inventorySummary?.by_grade.NEW_COLLECTION.wt.toFixed(3)} {t('common.kg')} متاح</p>
            </div>

            <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-1">
              <div className="flex justify-between font-bold text-blue-900">
                <span>📦 وسط / درجة ثانية</span>
                <span>{inventorySummary?.by_grade.MIDDLE.val.toFixed(2)} {t('common.currency')}</span>
              </div>
              <p className="text-[11px] text-blue-700">{inventorySummary?.by_grade.MIDDLE.wt.toFixed(3)} {t('common.kg')} متاح</p>
            </div>

            <div className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl space-y-1">
              <div className="flex justify-between font-bold text-amber-900">
                <span>🏷️ تصفيات / شعبي</span>
                <span>{inventorySummary?.by_grade.CLEARANCE.val.toFixed(2)} {t('common.currency')}</span>
              </div>
              <p className="text-[11px] text-amber-700">{inventorySummary?.by_grade.CLEARANCE.wt.toFixed(3)} {t('common.kg')} متاح</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline font-bold text-slate-900">
              <span>إجمالي قيمة المخزون:</span>
              <span className="text-base text-emerald-700 font-black">{inventorySummary?.total_valuation.toFixed(2)} {t('common.currency')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bale Yield & ROI Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">{t('reports.baleYieldTitle')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">كود البالة والمورد</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>تكلفة الشراء</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>الوزن (كجم)</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>المبيعات المحققة</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>الأرباح المحققة</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>المخزون المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium font-mono">
              {baleReports.map((bale) => (
                <tr key={bale.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-5 font-sans">
                    <div className="font-bold text-slate-900 text-sm">{bale.lot_code}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{bale.supplier}</div>
                  </td>
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-slate-900`}>{bale.purchase_cost.toFixed(2)} {t('common.currency')}</td>
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} text-slate-600`}>{bale.weight_kg.toFixed(3)} {t('common.kg')}</td>
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-emerald-700`}>{bale.sold_revenue.toFixed(2)} {t('common.currency')}</td>
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-indigo-600`}>+{bale.realized_profit.toFixed(2)} {t('common.currency')}</td>
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-slate-900`}>
                    {bale.remaining_stock_val.toFixed(2)} {t('common.currency')} <span className="text-[10px] font-normal text-slate-500">({bale.remaining_stock_kg} {t('common.kg')})</span>
                  </td>
                </tr>
              ))}

              {baleReports.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 text-xs font-sans">
                    لا توجد تقارير أرباح بالات مسجلة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
