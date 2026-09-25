import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FileSpreadsheet, Printer, Search, Calendar, Package, TrendingUp, DollarSign, Scale, Layers, Trash2, ArrowUpRight, ArrowDownLeft, Store, RefreshCw, Image as ImageIcon } from 'lucide-react';

export default function ReportsPage() {
  const { t } = useLanguage();
  const { tenant } = useAuth();

  // Active Report Category
  const [activeReport, setActiveReport] = useState('ITEM_LEDGER'); // ITEM_LEDGER | SALES_DAILY | CASHIER_PERF | GRADE_SALES | PROFIT_LOSS | EXPENSES | WASTE

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Data States
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inventoryLedger, setInventoryLedger] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState([]);
  const [sortingOrders, setSortingOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [pRes, legRes, sRes, tRes, sortRes] = await Promise.all([
        axiosClient.get('/products/'),
        axiosClient.get('/inventory-ledger/'),
        axiosClient.get('/sales/'),
        axiosClient.get('/treasury-transactions/'),
        axiosClient.get('/sorting-orders/')
      ]);

      const pList = pRes.data.results || pRes.data || [];
      const legList = legRes.data.results || legRes.data || [];
      const sList = sRes.data.results || sRes.data || [];
      const tList = tRes.data.results || tRes.data || [];
      const sortList = sortRes.data.results || sortRes.data || [];

      setProducts(pList);
      setInventoryLedger(legList);
      setSalesInvoices(sList);
      setTreasuryTransactions(tList);
      setSortingOrders(sortList);

      if (pList.length > 0 && !selectedProduct) {
        setSelectedProduct(pList[0]);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Item Ledger for Selected Product & Date Range
  const filteredItemLedger = inventoryLedger.filter(tx => {
    const txDate = tx.created_at ? tx.created_at.split('T')[0] : '';
    const matchesProduct = selectedProduct ? (tx.product === selectedProduct.id || tx.product_name === selectedProduct.name) : true;
    const matchesDate = txDate >= startDate && txDate <= endDate;
    return matchesProduct && matchesDate;
  });

  // Ledger Summary Aggregations
  const totalInKg = filteredItemLedger.reduce((sum, tx) => sum + (parseFloat(tx.weight_change_kg) > 0 ? parseFloat(tx.weight_change_kg) : 0), 0);
  const totalOutKg = filteredItemLedger.reduce((sum, tx) => sum + (parseFloat(tx.weight_change_kg) < 0 ? Math.abs(parseFloat(tx.weight_change_kg)) : 0), 0);
  const totalInPcs = filteredItemLedger.reduce((sum, tx) => sum + (parseInt(tx.quantity_change_pieces) > 0 ? parseInt(tx.quantity_change_pieces) : 0), 0);
  const totalOutPcs = filteredItemLedger.reduce((sum, tx) => sum + (parseInt(tx.quantity_change_pieces) < 0 ? Math.abs(parseInt(tx.quantity_change_pieces)) : 0), 0);

  // Sales Reports Aggregations
  const filteredSales = salesInvoices.filter(s => {
    const sDate = s.invoice_date_time ? s.invoice_date_time.split('T')[0] : '';
    return sDate >= startDate && sDate <= endDate;
  });

  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const totalCOGS = filteredSales.reduce((sum, s) => sum + parseFloat(s.total_cogs || 0), 0);
  const totalGrossProfit = totalSalesAmount - totalCOGS;

  // Expenses Aggregations
  const filteredExpenses = treasuryTransactions.filter(t => {
    const tDate = t.created_at ? t.created_at.split('T')[0] : '';
    return t.transaction_type === 'WITHDRAWAL' && tDate >= startDate && tDate <= endDate;
  });

  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + Math.abs(parseFloat(e.amount || 0)), 0);
  const netProfit = totalGrossProfit - totalExpensesAmount;

  // Export CSV Excel
  const exportExcel = () => {
    let headers = [];
    let rows = [];

    if (activeReport === 'ITEM_LEDGER') {
      headers = ['التاريخ والوقت', 'نوع الحركة', 'التغيير كجم', 'التغيير قطعة', 'الرصيد الجاري', 'المستند / البيان'];
      rows = filteredItemLedger.map(tx => [
        new Date(tx.created_at).toLocaleString('ar-EG'),
        tx.transaction_type,
        tx.weight_change_kg,
        tx.quantity_change_pieces,
        tx.running_balance_kg,
        `"${tx.notes || tx.source_document_id || ''}"`
      ]);
    } else {
      headers = ['التاريخ والوقت', 'رقم الفاتورة / المستند', 'الكاشير / المستخدم', 'إجمالي المبلغ', 'التكلفة COGS', 'مجمل الربح'];
      rows = filteredSales.map(s => [
        new Date(s.invoice_date_time).toLocaleString('ar-EG'),
        s.invoice_number,
        s.cashier_username || 'كاشير',
        s.total_amount,
        s.total_cogs,
        s.gross_profit
      ]);
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_${activeReport}_${startDate}_إلى_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 font-sans print:m-0 print:p-0">
      
      {/* PDF Official Print Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            {tenant?.logo_base64 && (
              <img src={tenant.logo_base64} alt="Logo" className="w-16 h-16 object-contain" />
            )}
            <div className="text-right">
              <h1 className="text-2xl font-black text-slate-900">{tenant?.name || 'شركة Motion Store لتجارة البالات'}</h1>
              <p className="text-xs text-slate-600 font-bold">تقرير تفصيلي موثق من المحرك المحاسبي المالي</p>
            </div>
          </div>
          <div className="text-left text-xs font-mono text-slate-500">
            <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
            <p>الفترة المالية: من {startDate} إلى {endDate}</p>
          </div>
        </div>
        <h2 className="text-lg font-black text-slate-800 mt-4 bg-slate-100 py-1 text-center">
          {activeReport === 'ITEM_LEDGER' ? `كشف حركة صنف تفصيلي [${selectedProduct?.name || 'جميع الأصناف'}]` : 'تقرير الأداء المالي والأرباح والخسائر'}
        </h2>
      </div>

      {/* Screen Header & Top Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={22} />
            مطبخ التقارير التنفيذية الشاملة
          </h1>
          <p className="text-xs text-slate-500 mt-1">كشف حركة الأصناف، يوميات المبيعات، أداء الكاشيرية، وقائمة الأرباح والخسائر P&L</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300 text-xs font-bold">
            <span>من:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border rounded p-1" />
            <span>إلى:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border rounded p-1" />
          </div>

          <button
            type="button"
            onClick={exportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>إكسيل</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة PDF</span>
          </button>
        </div>
      </div>

      {/* Report Categories Bar */}
      <div className="flex bg-white p-2 rounded-xl border border-slate-200 shadow-sm overflow-x-auto gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setActiveReport('ITEM_LEDGER')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeReport === 'ITEM_LEDGER' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package size={15} />
          <span>⭐ 1. حركة صنف (Item Ledger)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReport('SALES_DAILY')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeReport === 'SALES_DAILY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp size={15} />
          <span>2. يومية المبيعات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReport('PROFIT_LOSS')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeReport === 'PROFIT_LOSS' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>3. قائمة الدخل (P&L)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReport('EXPENSES')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeReport === 'EXPENSES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>4. المصروفات والمنصرف</span>
        </button>
      </div>

      {/* ==================== 1. ITEM LEDGER REPORT (⭐) ==================== */}
      {activeReport === 'ITEM_LEDGER' && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3 w-full max-w-xl">
              <label className="text-xs font-black text-slate-700 whitespace-nowrap">اختر الصنف المراد عرض حركة حسابه:</label>
              <select
                value={selectedProduct?.id || ''}
                onChange={e => {
                  const p = products.find(prod => prod.id === e.target.value);
                  setSelectedProduct(p);
                }}
                className="w-full bg-slate-50 border border-emerald-300 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category_name || 'عام'})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadBaseData}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>تحديث الكشف</span>
            </button>
          </div>

          {/* Ledger Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-right">
              <span className="text-[11px] text-emerald-700 font-bold block">إجمالي الوارد (دخول مخزني)</span>
              <span className="text-xl font-black text-emerald-900">+{totalInKg.toFixed(3)} كجم</span>
              <span className="text-xs text-emerald-600 block mt-0.5">({totalInPcs} قطعة)</span>
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-right">
              <span className="text-[11px] text-rose-700 font-bold block">إجمالي المنصرف (مبيعات)</span>
              <span className="text-xl font-black text-rose-900">-{totalOutKg.toFixed(3)} كجم</span>
              <span className="text-xs text-rose-600 block mt-0.5">({totalOutPcs} قطعة)</span>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-right">
              <span className="text-[11px] text-blue-700 font-bold block">صافي الحركة في الفترة</span>
              <span className="text-xl font-black text-blue-900">{(totalInKg - totalOutKg).toFixed(3)} كجم</span>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md text-right">
              <span className="text-[11px] text-slate-400 font-bold block">الرصيد الحالي بالمخزن</span>
              <span className="text-2xl font-black text-emerald-400">
                {filteredItemLedger.length > 0 ? parseFloat(filteredItemLedger[0].running_balance_kg || 0).toFixed(3) : '0.000'} كجم
              </span>
            </div>
          </div>

          {/* Ledger Movements Table */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-800 border-b pb-3 mb-4">
              سجل دفتر أستاذ حركات الصنف: [{selectedProduct?.name || '—'}]
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3 text-center">التغيير بالوزن (كجم)</th>
                    <th className="p-3 text-center">التغيير بالقطع</th>
                    <th className="p-3 text-left">الرصيد الجاري (كجم)</th>
                    <th className="p-3">المستند / البيان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredItemLedger.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400">لا توجد حركات مخزنية مسجلة لهذا الصنف في هذه الفترة</td>
                    </tr>
                  ) : (
                    filteredItemLedger.map(tx => {
                      const isPositive = parseFloat(tx.weight_change_kg) > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono text-slate-500">{new Date(tx.created_at).toLocaleString('ar-EG')}</td>
                          <td className="p-3 font-bold">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isPositive ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>}
                              {tx.transaction_type === 'SORTING_INPUT' ? 'وارد فرز بالة' : (tx.transaction_type === 'SALE' ? 'صرف مبيعات' : tx.transaction_type)}
                            </span>
                          </td>
                          <td className={`p-3 text-center font-black ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {isPositive ? `+${parseFloat(tx.weight_change_kg).toFixed(3)}` : parseFloat(tx.weight_change_kg).toFixed(3)} كجم
                          </td>
                          <td className="p-3 text-center font-bold text-slate-700">{tx.quantity_change_pieces || 0}</td>
                          <td className="p-3 text-left font-black text-slate-900 text-sm">{parseFloat(tx.running_balance_kg || 0).toFixed(3)} كجم</td>
                          <td className="p-3 text-slate-500 text-[11px] font-mono">{tx.notes || tx.source_document_id || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. DAILY SALES REPORT ==================== */}
      {activeReport === 'SALES_DAILY' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-700 font-bold block">إجمالي الإيرادات (المبيعات)</span>
              <span className="text-2xl font-black text-emerald-900">{totalSalesAmount.toFixed(2)} ج.م</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <span className="text-xs text-blue-700 font-bold block">تكلفة البضاعة المباعة (COGS)</span>
              <span className="text-2xl font-black text-blue-900">{totalCOGS.toFixed(2)} ج.م</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <span className="text-xs text-amber-700 font-bold block">مجمل الربح (Gross Profit)</span>
              <span className="text-2xl font-black text-amber-900">{totalGrossProfit.toFixed(2)} ج.م</span>
            </div>
          </div>

          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 font-black text-slate-700 border-y">
              <tr>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">الكاشير</th>
                <th className="p-3">المبلغ الصافي</th>
                <th className="p-3">التكلفة COGS</th>
                <th className="p-3 text-emerald-800">مجمل الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {filteredSales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-500">{new Date(s.invoice_date_time).toLocaleString('ar-EG')}</td>
                  <td className="p-3 font-bold font-mono text-slate-800">{s.invoice_number}</td>
                  <td className="p-3 font-bold">{s.cashier_username || 'كاشير'}</td>
                  <td className="p-3 font-black text-slate-900">{parseFloat(s.total_amount).toFixed(2)} ج.م</td>
                  <td className="p-3 font-bold text-slate-600">{parseFloat(s.total_cogs).toFixed(2)} ج.م</td>
                  <td className="p-3 font-black text-emerald-700">{parseFloat(s.gross_profit).toFixed(2)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== 3. PROFIT & LOSS (P&L) REPORT ==================== */}
      {activeReport === 'PROFIT_LOSS' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <h3 className="text-sm font-black text-slate-800 border-b pb-3">قائمة الدخل والربحية المالية (Profit & Loss Statement)</h3>

          <div className="max-w-xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 font-bold text-sm">
            <div className="flex justify-between items-center text-slate-700 border-b pb-2">
              <span>إجمالي إيرادات المبيعات:</span>
              <span className="text-base text-slate-900 font-black">{totalSalesAmount.toFixed(2)} ج.م</span>
            </div>

            <div className="flex justify-between items-center text-rose-700 border-b pb-2">
              <span>خصم: تكلفة البضاعة المباعة (COGS):</span>
              <span className="text-base font-black">-{totalCOGS.toFixed(2)} ج.م</span>
            </div>

            <div className="flex justify-between items-center text-emerald-800 bg-emerald-100 p-3 rounded-xl">
              <span>مجمل الربح التشغيلي:</span>
              <span className="text-xl font-black">{totalGrossProfit.toFixed(2)} ج.م</span>
            </div>

            <div className="flex justify-between items-center text-rose-700 border-b pb-2 pt-2">
              <span>خصم: إجمالي المصروفات والنثريات:</span>
              <span className="text-base font-black">-{totalExpensesAmount.toFixed(2)} ج.م</span>
            </div>

            <div className="flex justify-between items-center text-white bg-slate-900 p-4 rounded-xl shadow-lg mt-4">
              <span className="text-base font-black">صافي الأرباح النهائية (Net Profit):</span>
              <span className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfit.toFixed(2)} ج.م
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. EXPENSES REPORT ==================== */}
      {activeReport === 'EXPENSES' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center bg-rose-50 p-4 rounded-xl border border-rose-200 mb-4">
            <span className="text-xs font-bold text-rose-800">إجمالي المصروفات المنصرفة في الفترة:</span>
            <span className="text-2xl font-black text-rose-900">{totalExpensesAmount.toFixed(2)} ج.م</span>
          </div>

          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 font-black text-slate-700 border-y">
              <tr>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">الخزينة المنصرف منها</th>
                <th className="p-3">الجهة / البيان</th>
                <th className="p-3 text-rose-600">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {filteredExpenses.map(e => (
                <tr key={e.id} className="hover:bg-rose-50/20">
                  <td className="p-3 font-mono text-slate-500">{new Date(e.created_at).toLocaleString('ar-EG')}</td>
                  <td className="p-3 font-bold text-slate-800">{e.treasury_name || 'الخزينة'}</td>
                  <td className="p-3 font-black text-slate-900">{e.description}</td>
                  <td className="p-3 font-black text-rose-600 text-sm">{Math.abs(parseFloat(e.amount)).toFixed(2)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
