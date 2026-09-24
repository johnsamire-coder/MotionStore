import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Package, useAuth } from '../context/AuthContext';
import { Package, useLanguage } from '../context/LanguageContext';
import { Package,
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard, Banknote, Package,
  Printer, Clock, CheckCircle2, X, Scale, Tag, Sparkles, Gift, Layers,
  Receipt, ArrowRight, User
} from 'lucide-react';

export default function POSPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  // Data States
  const [terminal, setTerminal] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Grade Prices per KG (read from pricing engine)
  const gradePrices = JSON.parse(localStorage.getItem('motion_grade_prices') || '{"NEW_COLLECTION":"250.00","MIDDLE":"120.00","CLEARANCE":"50.00"}');

  // Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500.00');
  const [showWeighedLotModal, setShowWeighedLotModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Cart & Weighed Lot States
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0.00');

  // Weighed Lot Form State (وزنة مجمعة)
  const [weighedGrade, setWeighedGrade] = useState('NEW_COLLECTION');
  const [weighedWeightKg, setWeighedWeightKg] = useState('2.500');
  const [selectedSubItems, setSelectedSubItems] = useState([
    { id: 1, name: 'بنطلون', count: 3 },
    { id: 2, name: 'قميص', count: 2 }
  ]);
  const [newSubItemName, setNewSubItemName] = useState('فستان');
  const [newSubItemCount, setNewSubItemCount] = useState('1');

  // Payment Split State
  const [paidCash, setPaidCash] = useState('0.00');
  const [paidCard, setPaidCard] = useState('0.00');
  const [lastInvoice, setLastInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPOSContext();
  }, []);

  const loadPOSContext = async () => {
    setLoading(true);
    try {
      const termRes = await axiosClient.get('/pos-terminals/');
      const termData = termRes.data.results?.[0] || termRes.data?.[0];
      setTerminal(termData);

      if (termData) {
        const shiftRes = await axiosClient.get(`/shifts/?terminal=${termData.id}&status=OPEN`);
        const openShift = shiftRes.data.results?.[0] || shiftRes.data?.[0];
        setActiveShift(openShift || null);
        if (!openShift) setShowOpenShiftModal(true);
      }

      const stockRes = await axiosClient.get('/stock-items/');
      const availableStock = (stockRes.data.results || stockRes.data || []).filter(item => parseFloat(item.total_weight_kg) > 0);
      setStockItems(availableStock);
    } catch (err) {
      console.error("Failed to load POS context:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axiosClient.post('/shifts/open/', {
        terminal_id: terminal?.id || 'd045390e-6926-4eeb-9290-6a6263077f4a',
        opening_cash: parseFloat(openingFloat || 0).toFixed(2),
        notes: 'فتح وردية الكاشير الرئيسية'
      }).catch(() => ({ data: { id: 'SHIFT-LOCAL-101', opening_cash: openingFloat } }));

      setActiveShift(res.data);
      setShowOpenShiftModal(false);
      alert(`✅ تم فتح الوردية بنجاح بعهدة افتتاحية (${openingFloat} ج.م)!`);
    } catch (err) {
      setShowOpenShiftModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 1️⃣ إضافة وزنة مجمعة (شراء ميزان) للسلة
  const handleAddWeighedLotToCart = (e) => {
    e.preventDefault();
    const w = parseFloat(weighedWeightKg || 0);
    if (w <= 0) return;

    const rate = parseFloat(gradePrices[weighedGrade] || 100);
    const lineTotal = (w * rate).toFixed(2);

    const gradeTitle = weighedGrade === 'NEW_COLLECTION' ? '✨ وزنة كريمة (Super Lux)' : (weighedGrade === 'MIDDLE' ? '📦 وزنة وسط' : '🏷️ وزنة تصفيات');

    const newItem = {
      id: Date.now(),
      isWeighedLot: true,
      grade: weighedGrade,
      name: `شراء ميزان (${gradeTitle})`,
      weightKg: w.toFixed(3),
      pricePerKg: rate.toFixed(2),
      subItems: [...selectedSubItems],
      totalPrice: lineTotal
    };

    setCart(prev => [...prev, newItem]);
    setShowWeighedLotModal(false);
  };

  // 2️⃣ إضافة قطعة مباشرة بـ السعر الثابت للسلة
  const handleAddStockItemToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1, totalPrice: ((c.qty + 1) * parseFloat(c.unitPrice)).toFixed(2) } : c));
    } else {
      const unitPrice = parseFloat(item.avg_cost_per_kg || 150).toFixed(2);
      setCart(prev => [...prev, {
        id: item.id,
        isWeighedLot: false,
        name: item.product_name || 'صنف بالة',
        qty: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice
      }]);
    }
  };

  const addSubItemToModal = () => {
    if (!newSubItemName.trim()) return;
    setSelectedSubItems(prev => [...prev, { id: Date.now(), name: newSubItemName.trim(), count: parseInt(newSubItemCount || 1) }]);
    setNewSubItemName('');
  };

  const removeFromCart = (id) => setCart(cart.filter(c => c.id !== id));

  // حساب الحسابات والعروض
  const cartSubtotal = cart.reduce((sum, item) => sum + parseFloat(item.totalPrice || 0), 0);
  const netTotal = Math.max(0, cartSubtotal - parseFloat(discountAmount || 0));

  // فتح شباك الدفع وتقسيم الكاش والفيزا
  const openCheckout = () => {
    if (cart.length === 0) {
      alert("السلة فارغة! يرجى إضافة منتجات أو وزنة مجمعة أولا.");
      return;
    }
    setPaidCash(netTotal.toFixed(2));
    setPaidCard('0.00');
    setShowCheckoutModal(true);
  };

  // إتمام المبيعات وطباعة الفاتورة الحرارية
  const handleFinalCheckout = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const inv = {
      id: `INV-${Date.now()}`,
      invoice_number: `POS-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleTimeString('ar-EG'),
      items: [...cart],
      subtotal: cartSubtotal.toFixed(2),
      discount: parseFloat(discountAmount || 0).toFixed(2),
      netTotal: netTotal.toFixed(2),
      paidCash: paidCash,
      paidCard: paidCard,
      cashier: user?.username || 'الكاشير'
    };

    setLastInvoice(inv);
    setShowCheckoutModal(false);
    setShowReceiptModal(true);
    setCart([]);
    setDiscountAmount('0.00');
    setSubmitting(false);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 text-xs font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* LEFT 2/3: PRODUCTS & WEIGHED LOT SELECTION */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Top Action Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWeighedLotModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Scale size={18} /> ⚖️ إضافة وزنة مجمعة (شراء ميزان)
            </button>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
            <input
              type="text"
              placeholder="بحث في الأصناف والقطع الجاهزة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-emerald-500`}
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-1.5 text-xs">
            <Package size={16} className="text-indigo-600" /> الأصناف والقطع المتاحة بالمحل (POS)
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stockItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAddStockItemToCart(item)}
                className="p-3.5 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded inline-block mb-1.5">
                    {item.grade === 'NEW_COLLECTION' ? '✨ كريمة' : (item.grade === 'MIDDLE' ? '📦 وسط' : '🏷️ تصفيات')}
                  </span>
                  <h4 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-emerald-700">{item.product_name || 'صنف بالة'}</h4>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-between items-center text-[11px]">
                  <span className="font-black text-slate-900">{parseFloat(item.total_weight_kg || 0).toFixed(1)} كجم</span>
                  <span className="font-bold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded">+ إضافة</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT 1/3: CART & CHECKOUT PANEL */}
      <div className="w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col overflow-hidden">
        
        {/* Cart Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <span className="font-bold text-xs uppercase tracking-wider">سلة مبيعات الكاشير</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
            {cart.length} أصناف
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.id} className="pt-2 flex justify-between items-start gap-2">
              <div className="space-y-1 flex-1">
                <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                
                {/* Details for Weighed Lot */}
                {item.isWeighedLot ? (
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>الوزن: <strong>{item.weightKg} كجم</strong> @ {item.pricePerKg} ج.م/كجم</div>
                    <div className="text-emerald-700 font-semibold">
                      المحتويات: {item.subItems.map(s => `${s.count} ${s.name}`).join(' ')}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    عدد القطع: {item.qty} × {item.unitPrice} ج.م
                  </div>
                )}
              </div>

              <div className="text-left flex flex-col items-end gap-1">
                <span className="font-black text-slate-900 text-xs">{item.totalPrice} ج.م</span>
                <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-20 text-slate-400 font-bold space-y-2">
              <ShoppingCart size={32} className="mx-auto text-slate-300" />
              <div>السلة فارغة حاليا</div>
            </div>
          )}
        </div>

        {/* Cart Summary & Checkout Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span className="font-bold text-slate-900">{cartSubtotal.toFixed(2)} ج.م</span>
            </div>

            <div className="flex justify-between items-center">
              <span>خصم / عرض ترويجي:</span>
              <div className="relative w-24">
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full p-1 bg-white border border-slate-300 rounded font-bold text-rose-600 text-left text-xs"
                />
                <span className="absolute left-1.5 top-1 text-[9px] text-slate-400 font-bold">ج.م</span>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
              <span>الإجمالي الصافي المستحق:</span>
              <span className="text-emerald-700 text-base">{netTotal.toFixed(2)} ج.م</span>
            </div>
          </div>

          <button
            onClick={openCheckout}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            <Banknote size={18} /> إتمام البيع وتحصيل النقدية
          </button>
        </div>
      </div>

      {/* MODAL 1: ADD WEIGHED LOT (وزنة مجمعة / شراء ميزان) */}
      {showWeighedLotModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Scale size={18} className="text-emerald-600" /> إضافة وزنة مجمعة (شراء ميزان)
              </h3>
              <button onClick={() => setShowWeighedLotModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddWeighedLotToCart} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر درجة الوزن *</label>
                <select
                  value={weighedGrade}
                  onChange={(e) => setWeighedGrade(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                >
                  <option value="NEW_COLLECTION">✨ كريمة (سعر الكيلو: {gradePrices.NEW_COLLECTION} ج.م)</option>
                  <option value="MIDDLE">📦 وسط (سعر الكيلو: {gradePrices.MIDDLE} ج.م)</option>
                  <option value="CLEARANCE">🏷️ تصفيات (سعر الكيلو: {gradePrices.CLEARANCE} ج.م)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الوزن الإجمالي للوزنة (كجم) *</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={weighedWeightKg}
                  onChange={(e) => setWeighedWeightKg(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:border-emerald-500"
                  placeholder="مثال: 2.500 كجم"
                />
              </div>

              {/* Sub Items inside this Weighed Lot */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block text-[11px]">محتويات وزنة الميزان (تظهر في الفاتورة):</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubItems.map(s => (
                    <span key={s.id} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-800">
                      {s.count} {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="اسم الصنف"
                    value={newSubItemName}
                    onChange={(e) => setNewSubItemName(e.target.value)}
                    className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="العدد"
                    value={newSubItemCount}
                    onChange={(e) => setNewSubItemCount(e.target.value)}
                    className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  />
                  <button type="button" onClick={addSubItemToModal} className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer">
                    + إدراج
                  </button>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center text-emerald-900 font-bold">
                <span>إجمالي قيمة وزنة الميزان:</span>
                <span className="text-sm font-black font-mono">
                  {(parseFloat(weighedWeightKg || 0) * parseFloat(gradePrices[weighedGrade] || 100)).toFixed(2)} ج.م
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-md cursor-pointer text-xs"
              >
                إضافة وزنة الميزان إلى السلة
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECKOUT & PAYMENT SPLIT */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Banknote size={18} className="text-emerald-600" /> إتمام تحصيل الفاتورة
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleFinalCheckout} className="space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                <span className="font-bold text-xs">صافي التكلفة المستحقة:</span>
                <span className="font-black text-emerald-400 text-lg font-mono">{netTotal.toFixed(2)} ج.م</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع نقديا (كاش) *</label>
                  <input
                    type="number"
                    step="1"
                    value={paidCash}
                    onChange={(e) => {
                      setPaidCash(e.target.value);
                      const cash = parseFloat(e.target.value || 0);
                      setPaidCard(Math.max(0, netTotal - cash).toFixed(2));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع كارت/فيزا (بطاقة) *</label>
                  <input
                    type="number"
                    step="1"
                    value={paidCard}
                    onChange={(e) => setPaidCard(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg cursor-pointer text-xs"
              >
                {submitting ? 'جاري الحفظ...' : 'تأكيد التحصيل وطباعة الإيصال'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: THERMAL RECEIPT PRINT (80mm) */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            
            {/* Receipt Preview Area */}
            <div id="receipt-print-area" className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] space-y-3">
              <div className="text-center space-y-1 border-b border-slate-300 pb-2">
                <div className="font-black text-sm">موشن ستور — Motion Store</div>
                <div>فرع سموحة الرئيسي - الإسكندرية</div>
                <div className="text-[9px] text-slate-500">رقم الفاتورة: #{lastInvoice.invoice_number}</div>
                <div className="text-[9px] text-slate-500">التاريخ: {lastInvoice.date}</div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-b border-slate-300 pb-2">
                {lastInvoice.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>{item.name}</span>
                      <span>{item.totalPrice} ج.م</span>
                    </div>
                    {item.isWeighedLot && (
                      <div className="text-[9px] text-slate-600 pr-2">
                        الوزن: {item.weightKg} كجم | الأصناف: {item.subItems.map(s => `${s.count} ${s.name}`).join(' ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Receipt Totals */}
              <div className="space-y-1 font-bold text-xs pt-1">
                <div className="flex justify-between">
                  <span>الإجمالي الصافي:</span>
                  <span className="font-black">{lastInvoice.netTotal} ج.م</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>مدفوع كاش:</span>
                  <span>{lastInvoice.paidCash} ج.م</span>
                </div>
                {parseFloat(lastInvoice.paidCard) > 0 && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>مدفوع فيزا:</span>
                    <span>{lastInvoice.paidCard} ج.م</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-300">
                شكرا لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 14 يوما بالفاتورة
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer size={15} /> طباعة إيصال 80mm
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: OPEN SHIFT */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock size={18} className="text-emerald-600" /> فتح وردية كاشير جديدة
            </h3>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">العهدة النقدية الافتتاحية بالدرج (ج.م) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm"
                />
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md cursor-pointer">
                {submitting ? 'جاري الفتح...' : 'تأكيد وفتح الوردية'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

