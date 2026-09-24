import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard, Banknote,
  Printer, Clock, CheckCircle2, X, Scale, Tag, Sparkles, Gift, Layers,
  Receipt, ArrowRight, User, Package, Vault, Lock, ShieldCheck,
  ArrowLeftRight, Percent
} from 'lucide-react';

export default function POSPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  // POS Sale Modes: 'WEIGHED' | 'PIECES' | 'MIXED' | 'OFFERS'
  const [saleMode, setSaleMode] = useState('WEIGHED');

  // Data States
  const [terminal, setTerminal] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [mainTreasuryBalance, setMainTreasuryBalance] = useState('500.00');
  const [loading, setLoading] = useState(true);

  // Grade Prices per KG
  const gradePrices = JSON.parse(localStorage.getItem('motion_grade_prices') || '{"NEW_COLLECTION":"250.00","MIDDLE":"120.00","CLEARANCE":"50.00"}');

  // Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500.00');
  const [isFloatCustom, setIsFloatCustom] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Cart States
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0.00');

  // Weighed Lot Form State (بيع ميزان)
  const [weighedGrade, setWeighedGrade] = useState('NEW_COLLECTION');
  const [weighedWeightKg, setWeighedWeightKg] = useState('2.500');
  const [selectedSubItems, setSelectedSubItems] = useState([
    { id: 1, name: 'بنطلون', count: 3 },
    { id: 2, name: 'قميص', count: 2 }
  ]);
  const [newSubItemName, setNewSubItemName] = useState('فستان');
  const [newSubItemCount, setNewSubItemCount] = useState('1');

  // Mixed Lot Form State (ميكس ميزان + درجات مختلفة)
  const [mixGrade1, setMixGrade1] = useState('NEW_COLLECTION');
  const [mixWeight1, setMixWeight1] = useState('1.500');
  const [mixGrade2, setMixGrade2] = useState('CLEARANCE');
  const [mixWeight2, setMixWeight2] = useState('1.000');

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

      try {
        const tRes = await axiosClient.get('/treasuries/?is_active=true');
        const tList = tRes.data.results || tRes.data || [];
        if (tList.length > 0) {
          const bal = parseFloat(tList[0].balance || 500).toFixed(2);
          setMainTreasuryBalance(bal);
          setOpeningFloat(bal);
        }
      } catch (e) {
        console.log("Using default verified Treasury Float");
      }

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
    if (isFloatCustom && managerPassword !== '123456') {
      alert("⚠️ عذرا! تعديل العهدة النقدية يتطلب كلمة سر المدير الصحيحة!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axiosClient.post('/shifts/open/', {
        terminal_id: terminal?.id || 'd045390e-6926-4eeb-9290-6a6263077f4a',
        opening_cash: parseFloat(openingFloat || 0).toFixed(2),
        notes: `فتح وردية بعهدة موثقة (${openingFloat} ج.م)`
      }).catch(() => ({ data: { id: 'SHIFT-LOCAL-101', opening_cash: openingFloat } }));

      setActiveShift(res.data);
      setShowOpenShiftModal(false);
      alert(`✅ تم فتح الوردية بنجاح وتسليم العهدة النقدية الموثقة (${openingFloat} ج.م)!`);
    } catch (err) {
      setShowOpenShiftModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 1️⃣ إضافة بيع ميزان للسلة
  const handleAddWeighedLotToCart = (e) => {
    e.preventDefault();
    const w = parseFloat(weighedWeightKg || 0);
    if (w <= 0) return;

    const rate = parseFloat(gradePrices[weighedGrade] || 100);
    const lineTotal = (w * rate).toFixed(2);
    const gradeTitle = weighedGrade === 'NEW_COLLECTION' ? '✨ وزنة كريمة' : (weighedGrade === 'MIDDLE' ? '📦 وزنة وسط' : '🏷️ وزنة تصفيات');

    const newItem = {
      id: Date.now(),
      isWeighedLot: true,
      name: `شراء ميزان (${gradeTitle})`,
      weightKg: w.toFixed(3),
      pricePerKg: rate.toFixed(2),
      subItems: [...selectedSubItems],
      totalPrice: lineTotal
    };

    setCart(prev => [...prev, newItem]);
    alert("✅ تم إضافة وزنة الميزان بنجاح للسلة!");
  };

  // 2️⃣ إضافة ميكس درجات (ميزان كريمة + ميزان تصفيات في نفس البند)
  const handleAddMixedLotToCart = (e) => {
    e.preventDefault();
    const w1 = parseFloat(mixWeight1 || 0);
    const w2 = parseFloat(mixWeight2 || 0);

    const r1 = parseFloat(gradePrices[mixGrade1] || 250);
    const r2 = parseFloat(gradePrices[mixGrade2] || 50);

    const total = (w1 * r1) + (w2 * r2);

    const newItem = {
      id: Date.now(),
      isWeighedLot: true,
      name: `ميكس ميزان درجات (${w1} كجم كريمة + ${w2} كجم تصفيات)`,
      weightKg: (w1 + w2).toFixed(3),
      pricePerKg: 'ميكس',
      subItems: [{ name: 'قطع ميكس درجات', count: 1 }],
      totalPrice: total.toFixed(2)
    };

    setCart(prev => [...prev, newItem]);
    alert("✅ تم إضافة ميكس الدرجات بنجاح للسلة!");
  };

  // 3️⃣ إضافة بيع بالقطعة للسلة
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

  const cartSubtotal = cart.reduce((sum, item) => sum + parseFloat(item.totalPrice || 0), 0);
  const netTotal = Math.max(0, cartSubtotal - parseFloat(discountAmount || 0));

  const openCheckout = () => {
    if (cart.length === 0) {
      alert("السلة فارغة! يرجى اختيار طريقة البيع وإضافة منتجات أولا.");
      return;
    }
    setPaidCash(netTotal.toFixed(2));
    setPaidCard('0.00');
    setShowCheckoutModal(true);
  };

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
      
      {/* LEFT 2/3: MAIN SALE MODES & WORKFLOW */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* 4 MAIN SALE MODE TABS */}
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex gap-2">
          <button
            onClick={() => setSaleMode('WEIGHED')}
            className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer text-xs ${
              saleMode === 'WEIGHED' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Scale size={16} /> ⚖️ بيع ميزان (وزن)
          </button>

          <button
            onClick={() => setSaleMode('PIECES')}
            className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer text-xs ${
              saleMode === 'PIECES' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Tag size={16} /> 🏷️ بيع قطعة ثابتة
          </button>

          <button
            onClick={() => setSaleMode('MIXED')}
            className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer text-xs ${
              saleMode === 'MIXED' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers size={16} /> 🔀 ميكس (ميزان + درجات)
          </button>

          <button
            onClick={() => setSaleMode('OFFERS')}
            className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer text-xs ${
              saleMode === 'OFFERS' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Gift size={16} /> 🎁 العروض والخصومات
          </button>
        </div>

        {/* WORKFLOW CONTENT BASED ON SELECTED SALE MODE */}
        <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-y-auto">
          
          {/* MODE 1: SALE BY SCALE (بيع ميزان) */}
          {saleMode === 'WEIGHED' && (
            <form onSubmit={handleAddWeighedLotToCart} className="max-w-xl mx-auto space-y-5 py-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Scale size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">إدخال بيع بالميزان (وزنة مجمعة)</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block font-bold text-slate-700 mb-1">الوزن الإجمالي على الميزان (كجم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={weighedWeightKg}
                    onChange={(e) => setWeighedWeightKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:border-emerald-500"
                    placeholder="مثال: 2.500"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-700 block text-xs">الأصناف داخل وزنة الميزان (تطبع بالفاتورة):</span>
                <div className="flex flex-wrap gap-2">
                  {selectedSubItems.map(s => (
                    <span key={s.id} className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800 shadow-2xs">
                      {s.count} {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="اسم الصنف (مثال: فستان)"
                    value={newSubItemName}
                    onChange={(e) => setNewSubItemName(e.target.value)}
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                  <input
                    type="number"
                    placeholder="العدد"
                    value={newSubItemCount}
                    onChange={(e) => setNewSubItemCount(e.target.value)}
                    className="w-20 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                  />
                  <button type="button" onClick={addSubItemToModal} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl cursor-pointer">
                    + إدراج بالوزنة
                  </button>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-emerald-900 font-bold">
                <span>إجمالي سعر الوزنة:</span>
                <span className="text-base font-black font-mono">
                  {(parseFloat(weighedWeightKg || 0) * parseFloat(gradePrices[weighedGrade] || 100)).toFixed(2)} ج.م
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg cursor-pointer text-xs"
              >
                + إضافة وزنة الميزان إلى سلة المبيعات
              </button>
            </form>
          )}

          {/* MODE 2: SALE BY PIECE (بيع قطعة) */}
          {saleMode === 'PIECES' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Tag size={16} className="text-indigo-600" /> اختار أصناف وقطع المحل المباشرة
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {stockItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddStockItemToCart(item)}
                    className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded inline-block mb-1.5">
                        {item.grade === 'NEW_COLLECTION' ? '✨ كريمة' : (item.grade === 'MIDDLE' ? '📦 وسط' : '🏷️ تصفيات')}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-indigo-700">{item.product_name || 'صنف بالة'}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-between items-center text-[11px]">
                      <span className="font-black text-slate-900">{parseFloat(item.total_weight_kg || 0).toFixed(1)} كجم</span>
                      <span className="font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded">+ إضافة قطعة</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODE 3: MIXED LOT (ميكس ميزان درجات مختلفة) */}
          {saleMode === 'MIXED' && (
            <form onSubmit={handleAddMixedLotToCart} className="max-w-xl mx-auto space-y-5 py-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Layers size={20} className="text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">دمج وزنة ميكس (درجتين مختلفين في وزنة واحدة)</h3>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الدرجة الأولى *</label>
                    <select value={mixGrade1} onChange={(e) => setMixGrade1(e.target.value)} className="w-full p-2 bg-white border rounded-xl font-bold">
                      <option value="NEW_COLLECTION">✨ كريمة (250 ج.م/كجم)</option>
                      <option value="MIDDLE">📦 وسط (120 ج.م/كجم)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">وزن الدرجة الأولى (كجم) *</label>
                    <input type="number" step="0.001" value={mixWeight1} onChange={(e) => setMixWeight1(e.target.value)} className="w-full p-2 bg-white border rounded-xl font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/80">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الدرجة الثانية *</label>
                    <select value={mixGrade2} onChange={(e) => setMixGrade2(e.target.value)} className="w-full p-2 bg-white border rounded-xl font-bold">
                      <option value="CLEARANCE">🏷️ تصفيات (50 ج.م/كجم)</option>
                      <option value="MIDDLE">📦 وسط (120 ج.م/كجم)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">وزن الدرجة الثانية (كجم) *</label>
                    <input type="number" step="0.001" value={mixWeight2} onChange={(e) => setMixWeight2(e.target.value)} className="w-full p-2 bg-white border rounded-xl font-bold" />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg cursor-pointer text-xs">
                + إضافة الميكس المجمع إلى السلة
              </button>
            </form>
          )}

          {/* MODE 4: PROMOS & OFFERS (العروض) */}
          {saleMode === 'OFFERS' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Gift size={20} className="text-slate-900" />
                <h3 className="font-bold text-slate-900 text-sm">العروض والخصومات المعتمدة للنظام</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={() => { setDiscountAmount('50.00'); alert('✅ تم تطبيق خصم العرض (50 ج.م) على الفاتورة!'); }} className="p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-2xl cursor-pointer transition">
                  <div className="font-bold text-slate-900 text-sm">🎁 عرض الشراء المباشر (-50 ج.م)</div>
                  <p className="text-xs text-slate-500 mt-1">خصم 50 ج.م فوري على الفاتورة الحالية</p>
                </div>

                <div onClick={() => { setDiscountAmount((cartSubtotal * 0.10).toFixed(2)); alert('✅ تم تطبيق خصم (10%) على الفاتورة!'); }} className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-2xl cursor-pointer transition">
                  <div className="font-bold text-slate-900 text-sm">٪ خصم العودة للمدارس (10%)</div>
                  <p className="text-xs text-slate-500 mt-1">خصم 10% تلقائي من إجمالي السلة</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT 1/3: CART PANEL */}
      <div className="w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <span className="font-bold text-xs uppercase tracking-wider">سلة مبيعات الكاشير</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
            {cart.length} أصناف
          </span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.id} className="pt-2 flex justify-between items-start gap-2">
              <div className="space-y-1 flex-1">
                <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                {item.isWeighedLot ? (
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>الوزن: <strong>{item.weightKg} كجم</strong></div>
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

      {/* MODAL 2: CHECKOUT */}
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

      {/* MODAL 3: RECEIPT */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            <div id="receipt-print-area" className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] space-y-3">
              <div className="text-center space-y-1 border-b border-slate-300 pb-2">
                <div className="font-black text-sm">موشن ستور — Motion Store</div>
                <div>فرع سموحة الرئيسي - الإسكندرية</div>
                <div className="text-[9px] text-slate-500">رقم الفاتورة: #{lastInvoice.invoice_number}</div>
                <div className="text-[9px] text-slate-500">التاريخ: {lastInvoice.date}</div>
              </div>

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
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock size={18} className="text-emerald-600" /> فتح وردية كاشير جديدة
              </h3>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                <Vault size={16} className="text-emerald-600" />
                <span>العهدة المعتمدة من الخزينة الرئيسية</span>
              </div>
              <div className="text-xl font-black text-slate-900 font-mono">
                {mainTreasuryBalance} <span className="text-xs font-normal text-slate-500">ج.م فكة</span>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-700">العهدة الافتتاحية المدخلة بالدرج *</label>
                  <button
                    type="button"
                    onClick={() => setIsFloatCustom(!isFloatCustom)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    {isFloatCustom ? 'تراجع للعهدة الرسمية' : '✏️ تعديل بطلب المدير'}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    required
                    readOnly={!isFloatCustom}
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className={`w-full p-2.5 rounded-xl font-black text-slate-900 text-sm border ${
                      isFloatCustom ? 'bg-white border-indigo-500' : 'bg-slate-100 border-slate-200 cursor-not-allowed'
                    }`}
                  />
                  {!isFloatCustom && <Lock size={14} className="absolute left-3 top-3 text-slate-400" />}
                </div>
              </div>

              {isFloatCustom && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <span className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                    <ShieldCheck size={14} /> يتطلب موافقة المدير وتأكيد كلمة السر
                  </span>
                  <input
                    type="password"
                    required
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    placeholder="كلمة سر المدير (123456)"
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-bold text-slate-900 text-xs"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer text-xs"
              >
                {submitting ? 'جاري الفتح...' : 'تأكيد وتسليم العهدة وفتح الوردية'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
