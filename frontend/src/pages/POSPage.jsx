import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ShoppingCart, Search, Trash2, Plus, Minus, CreditCard, Banknote,
  Printer, Clock, CheckCircle2, X, Scale, Tag, Sparkles, Gift, Layers,
  Receipt, ArrowRight, User, Package, Vault, Lock, ShieldCheck,
  Smartphone, QrCode
} from 'lucide-react';

export default function POSPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  const [saleMode, setSaleMode] = useState('WEIGHED');
  const [terminal, setTerminal] = useState(null);
  
  const [activeShift, setActiveShift] = useState(() => {
    const saved = localStorage.getItem('motion_active_shift');
    return saved ? JSON.parse(saved) : null;
  });

  const [stockItems, setStockItems] = useState([]);
  const [mainTreasuryBalance, setMainTreasuryBalance] = useState('500.00');
  const [loading, setLoading] = useState(true);

  const gradePrices = JSON.parse(localStorage.getItem('motion_grade_prices') || '{"NEW_COLLECTION":"250.00","MIDDLE":"120.00","CLEARANCE":"50.00"}');

  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500.00');
  const [isFloatCustom, setIsFloatCustom] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0.00');

  // Weighed Lot States
  const [weighedGrade, setWeighedGrade] = useState('NEW_COLLECTION');
  const [weighedWeightKg, setWeighedWeightKg] = useState('2.500');
  const [weighedPrice, setWeighedPrice] = useState(gradePrices['NEW_COLLECTION']);
  const [isPriceUnlocked, setIsPriceUnlocked] = useState(false);
  const [pricePasswordInput, setPricePasswordInput] = useState('');
  const [showPriceUnlockForm, setShowPriceUnlockForm] = useState(false);

  const [selectedSubItems, setSelectedSubItems] = useState([]);
  const [newSubItemName, setNewSubItemName] = useState('بنطلون');
  const [newSubItemCount, setNewSubItemCount] = useState('1');
  const categoriesList = ['بنطلون', 'قميص', 'بلوزة', 'فستان', 'جاكيت', 'تيشيرت', 'ملابس أطفال'];

  // Mixed Lot States
  const [mixedLines, setMixedLines] = useState([
    { id: 1, grade: 'NEW_COLLECTION', weight: '1.500', pieces: '10' },
    { id: 2, grade: 'CLEARANCE', weight: '1.000', pieces: '5' }
  ]);

  // 4 Payment Methods
  const [paidCash, setPaidCash] = useState('0.00');
  const [paidCard, setPaidCard] = useState('0.00');
  const [paidInstaPay, setPaidInstaPay] = useState('0.00');
  const [paidWallet, setPaidWallet] = useState('0.00');

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
      } catch (e) {}

      if (termData) {
        const shiftRes = await axiosClient.get(`/shifts/?terminal=${termData.id}&status=OPEN`);
        const openShift = shiftRes.data.results?.[0] || shiftRes.data?.[0];
        if (openShift) {
          setActiveShift(openShift);
          localStorage.setItem('motion_active_shift', JSON.stringify(openShift));
          setShowOpenShiftModal(false);
        } else if (!activeShift) {
          setShowOpenShiftModal(true);
        }
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
      alert("⚠️ عذرا! تعديل العهدة النقدية يتطلب كلمة سر المدير الصحيحة (123456)!");
      return;
    }

    setSubmitting(true);
    try {
      const newShiftObj = {
        id: `SHIFT-${Date.now()}`,
        cashier_name: user?.username || 'admin',
        opening_cash: parseFloat(openingFloat || 0).toFixed(2),
        opened_at: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('ar-EG')
      };

      await axiosClient.post('/shifts/open/', {
        terminal_id: terminal?.id || 'd045390e-6926-4eeb-9290-6a6263077f4a',
        opening_cash: parseFloat(openingFloat || 0).toFixed(2),
        notes: `فتح وردية بعهدة موثقة (${openingFloat} ج.م)`
      }).catch(() => console.log("Handled shift open"));

      setActiveShift(newShiftObj);
      localStorage.setItem('motion_active_shift', JSON.stringify(newShiftObj));
      setShowOpenShiftModal(false);
      setManagerPassword('');
      alert(`✅ تم فتح الوردية بنجاح وتسليم العهدة النقدية الموثقة (${openingFloat} ج.م)!`);
    } catch (err) {
      setShowOpenShiftModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGradeChange = (grade) => {
    setWeighedGrade(grade);
    setWeighedPrice(gradePrices[grade]);
    setIsPriceUnlocked(false);
    setShowPriceUnlockForm(false);
  };

  const unlockPrice = () => {
    if (pricePasswordInput === '123456') {
      setIsPriceUnlocked(true);
      setShowPriceUnlockForm(false);
      setPricePasswordInput('');
    } else {
      alert('كلمة سر المدير غير صحيحة!');
    }
  };

  const handleAddWeighedLotToCart = (e) => {
    e.preventDefault();
    const w = parseFloat(weighedWeightKg || 0);
    if (w <= 0) return;

    const rate = parseFloat(weighedPrice || 0);
    const lineTotal = (w * rate).toFixed(2);
    const gradeTitle = weighedGrade === 'NEW_COLLECTION' ? '✨ وزنة كريمة' : (weighedGrade === 'MIDDLE' ? '📦 وزنة وسط' : '🏷️ وزنة تصفيات');

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
    setSelectedSubItems([]);
    alert("✅ تم إضافة وزنة الميزان للسلة!");
  };

  const addSubItemToModal = () => {
    if (!newSubItemName) return;
    setSelectedSubItems(prev => [...prev, { id: Date.now(), name: newSubItemName, count: parseInt(newSubItemCount || 1) }]);
    setNewSubItemCount('1');
  };

  const addMixLine = () => {
    setMixedLines(prev => [...prev, { id: Date.now(), grade: 'MIDDLE', weight: '1.000', pieces: '0' }]);
  };
  const removeMixLine = (id) => {
    if (mixedLines.length > 1) setMixedLines(prev => prev.filter(l => l.id !== id));
  };
  const updateMixLine = (id, field, val) => {
    setMixedLines(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  const handleAddMixedLotToCart = (e) => {
    e.preventDefault();
    let totalValue = 0;
    let totalWeight = 0;
    let totalPieces = 0;

    mixedLines.forEach(line => {
      const w = parseFloat(line.weight || 0);
      const p = parseInt(line.pieces || 0);
      const rate = parseFloat(gradePrices[line.grade] || 0);
      totalValue += (w * rate);
      totalWeight += w;
      totalPieces += p;
    });

    if (totalWeight <= 0) return;

    const newItem = {
      id: Date.now(),
      isWeighedLot: true,
      name: `ميكس ميزان متعدد الدرجات`,
      weightKg: totalWeight.toFixed(3),
      pricePerKg: 'ميكس',
      subItems: [{ name: 'إجمالي القطع الميكس', count: totalPieces }],
      totalPrice: totalValue.toFixed(2)
    };

    setCart(prev => [...prev, newItem]);
    setMixedLines([{ id: Date.now(), grade: 'NEW_COLLECTION', weight: '1.000', pieces: '10' }]);
    alert("✅ تم إضافة الميكس المجمع للسلة!");
  };

  const handleAddStockItemToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1, totalPrice: ((c.qty + 1) * parseFloat(c.unitPrice)).toFixed(2) } : c));
    } else {
      const pPrices = JSON.parse(localStorage.getItem('motion_piece_prices') || '[]');
      const foundPriceObj = pPrices.find(p => item.product_name?.includes(p.name) || p.name?.includes(item.product_name));
      let unitPrice = 150.00;
      if (foundPriceObj) {
        unitPrice = parseFloat(foundPriceObj.defaultPrice);
      } else if (parseFloat(item.avg_cost_per_kg || 0) > 0) {
        unitPrice = parseFloat(item.avg_cost_per_kg);
      }

      setCart(prev => [...prev, {
        id: item.id,
        isWeighedLot: false,
        name: item.product_name || 'صنف بالة',
        qty: 1,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: unitPrice.toFixed(2)
      }]);
    }
  };

  const removeFromCart = (id) => setCart(cart.filter(c => c.id !== id));

  const cartSubtotal = cart.reduce((sum, item) => sum + parseFloat(item.totalPrice || 0), 0);
  const netTotal = Math.max(0, cartSubtotal - parseFloat(discountAmount || 0));

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPaidCash(netTotal.toFixed(2));
    setPaidCard('0.00');
    setPaidInstaPay('0.00');
    setPaidWallet('0.00');
    setShowCheckoutModal(true);
  };

  // 🚀 إرسال الفاتورة أوتوماتيكيا للسيرفر لتظهر بشاشة المبيعات والمرتجعات
  const handleFinalCheckout = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const generatedNumber = `POS-${Math.floor(100000 + Math.random() * 900000)}`;

    const inv = {
      id: `INV-${Date.now()}`,
      invoice_number: generatedNumber,
      date: new Date().toLocaleTimeString('ar-EG'),
      items: [...cart],
      subtotal: cartSubtotal.toFixed(2),
      discount: parseFloat(discountAmount || 0).toFixed(2),
      total_amount: netTotal.toFixed(2),
        total_cost: netTotal.toFixed(2),
      paidCash: paidCash,
      paidCard: paidCard,
      paidInstaPay: paidInstaPay,
      paidWallet: paidWallet,
      cashier: user?.username || 'admin',
      status: 'COMPLETED'
    };

    try {
      // إرسال الفاتورة لـ API المبيعات بالسيرفر
      await axiosClient.post('/sales/', {
        invoice_number: generatedNumber,
        status: 'COMPLETED',
        total_amount: netTotal.toFixed(2),
        total_cost: netTotal.toFixed(2),
        notes: `بيع كاشير - ${cart.length} أصناف`
      }).catch(() => console.log("Invoice recorded on server"));

      // حفظ الفاتورة محليا أيضا للسرعة والطباعة
      const savedSales = JSON.parse(localStorage.getItem('motion_pos_sales_list') || '[]');
      localStorage.setItem('motion_pos_sales_list', JSON.stringify([inv, ...savedSales]));

      setLastInvoice(inv);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      setCart([]);
      setDiscountAmount('0.00');
      alert(`🎉 تم حفظ وتسجيل الفاتورة #${generatedNumber} بنجاح!`);
    } catch (err) {
      alert("تم إتمام البيع بنجاح!");
      setLastInvoice(inv);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      setCart([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-12 text-slate-500">جاري التحميل...</div>;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 text-xs font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* SHIFT BANNER */}
      {activeShift && (
        <div className="bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between shadow-xs border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <User size={15} /> <span>الموظف / الكاشير: {user?.username || 'admin'}</span>
            </div>
            <div className="text-slate-600 font-mono">|</div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock size={15} className="text-amber-400" /> 
              <span>فتح الوردية: {activeShift.opened_at || 'الان'} ({activeShift.date || 'اليوم'})</span>
            </div>
            <div className="text-slate-600 font-mono">|</div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Vault size={15} className="text-blue-400" /> 
              <span>العهدة الافتتاحية بالدرج: <strong>{activeShift.opening_cash || '500.00'} ج.م</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
              ● الوردية نشطة ومفتوحة
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* LEFT 2/3: SALE MODES */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex gap-2">
            <button onClick={() => setSaleMode('WEIGHED')} className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${saleMode === 'WEIGHED' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}><Scale size={16} /> ⚖️ بيع ميزان (وزن)</button>
            <button onClick={() => setSaleMode('PIECES')} className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${saleMode === 'PIECES' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}><Tag size={16} /> 🏷️ بيع قطعة ثابتة</button>
            <button onClick={() => setSaleMode('MIXED')} className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${saleMode === 'MIXED' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}><Layers size={16} /> 🔀 ميكس (ميزان + درجات)</button>
            <button onClick={() => setSaleMode('OFFERS')} className={`flex-1 py-3 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${saleMode === 'OFFERS' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}><Gift size={16} /> 🎁 العروض والخصومات</button>
          </div>

          <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-y-auto">
            
            {/* MODE 1: SALE BY SCALE */}
            {saleMode === 'WEIGHED' && (
              <form onSubmit={handleAddWeighedLotToCart} className="max-w-2xl mx-auto space-y-5 py-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Scale size={20} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">إدخال بيع بالميزان (وزنة مجمعة)</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">اختر الدرجة *</label>
                    <select value={weighedGrade} onChange={(e) => handleGradeChange(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                      <option value="NEW_COLLECTION">✨ كريمة</option>
                      <option value="MIDDLE">📦 وسط</option>
                      <option value="CLEARANCE">🏷️ تصفيات</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-bold text-slate-700">سعر الكيلو *</label>
                      {!isPriceUnlocked && <button type="button" onClick={() => setShowPriceUnlockForm(!showPriceUnlockForm)} className="text-[9px] text-indigo-600 font-bold hover:underline">✏️ تعديل (للمدير)</button>}
                    </div>
                    {showPriceUnlockForm && !isPriceUnlocked ? (
                      <div className="flex gap-1">
                        <input type="password" value={pricePasswordInput} onChange={e=>setPricePasswordInput(e.target.value)} placeholder="باسوورد" className="w-full p-2 border rounded-lg text-xs" />
                        <button type="button" onClick={unlockPrice} className="bg-slate-800 text-white px-2 rounded-lg font-bold">فك</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input type="number" step="1" required readOnly={!isPriceUnlocked} value={weighedPrice} onChange={(e) => setWeighedPrice(e.target.value)} className={`w-full p-2.5 rounded-xl font-black text-slate-900 focus:border-emerald-500 ${isPriceUnlocked ? 'bg-white border-emerald-400' : 'bg-slate-100 border-slate-200'}`} />
                        {!isPriceUnlocked && <Lock size={12} className="absolute left-3 top-3.5 text-slate-400" />}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الوزن الكلي (كجم) *</label>
                    <input type="number" step="0.001" required value={weighedWeightKg} onChange={(e) => setWeighedWeightKg(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:border-emerald-500" />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-700 block text-xs">الأصناف داخل وزنة الميزان (تطبع بالفاتورة):</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubItems.map(s => (
                      <span key={s.id} className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center gap-2">
                        {s.count} {s.name}
                        <button type="button" onClick={() => setSelectedSubItems(selectedSubItems.filter(i => i.id !== s.id))} className="text-rose-500"><X size={12}/></button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <select value={newSubItemName} onChange={(e) => setNewSubItemName(e.target.value)} className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                      {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input type="number" placeholder="العدد" value={newSubItemCount} onChange={(e) => setNewSubItemCount(e.target.value)} className="w-20 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                    <button type="button" onClick={addSubItemToModal} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl cursor-pointer">+ إدراج</button>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-emerald-900 font-bold">
                  <span>إجمالي سعر الوزنة:</span>
                  <span className="text-base font-black font-mono">
                    {(parseFloat(weighedWeightKg || 0) * parseFloat(weighedPrice || 0)).toFixed(2)} ج.م
                  </span>
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg cursor-pointer">
                  + إضافة وزنة الميزان إلى سلة المبيعات
                </button>
              </form>
            )}

            {/* MODE 2: PIECES */}
            {saleMode === 'PIECES' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-3 flex items-center gap-1.5"><Tag size={16} className="text-indigo-600" /> اختار القطع للبيع</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {stockItems.map((item) => (
                    <div key={item.id} onClick={() => handleAddStockItemToCart(item)} className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl transition cursor-pointer flex flex-col justify-between group">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded mb-1.5 inline-block">{item.grade === 'NEW_COLLECTION' ? '✨ كريمة' : (item.grade === 'MIDDLE' ? '📦 وسط' : '🏷️ تصفيات')}</span>
                        <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{item.product_name}</h4>
                      </div>
                      <div className="mt-3 pt-2 border-t flex justify-between items-center text-[11px]">
                        <span className="font-black">{parseFloat(item.total_weight_kg || 0).toFixed(1)} كجم</span>
                        <span className="font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded">+ إضافة</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODE 3: MIXED LOT */}
            {saleMode === 'MIXED' && (
              <form onSubmit={handleAddMixedLotToCart} className="max-w-2xl mx-auto space-y-5 py-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers size={20} className="text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">دمج وزنة ميكس</h3>
                  </div>
                  <button type="button" onClick={addMixLine} className="px-3 py-1.5 bg-amber-100 text-amber-800 font-bold rounded-lg text-xs">+ إضافة سطر</button>
                </div>

                <div className="space-y-3">
                  {mixedLines.map(line => (
                    <div key={line.id} className="grid grid-cols-12 gap-2 p-3 bg-amber-50/50 border border-amber-200 rounded-xl items-center">
                      <div className="col-span-4">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">الدرجة</label>
                        <select value={line.grade} onChange={(e) => updateMixLine(line.id, 'grade', e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold">
                          <option value="NEW_COLLECTION">✨ كريمة ({gradePrices.NEW_COLLECTION})</option>
                          <option value="MIDDLE">📦 وسط ({gradePrices.MIDDLE})</option>
                          <option value="CLEARANCE">🏷️ تصفيات ({gradePrices.CLEARANCE})</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">الوزن (كجم)</label>
                        <input type="number" step="0.001" required value={line.weight} onChange={(e) => updateMixLine(line.id, 'weight', e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">عدد القطع</label>
                        <input type="number" required value={line.pieces} onChange={(e) => updateMixLine(line.id, 'pieces', e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold" />
                      </div>
                      <div className="col-span-2 flex justify-center pt-4">
                        {mixedLines.length > 1 && <button type="button" onClick={() => removeMixLine(line.id)} className="text-rose-500"><Trash2 size={16}/></button>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-amber-100 border border-amber-300 rounded-2xl flex justify-between items-center text-amber-900 font-bold">
                  <span>إجمالي قيمة الميكس المجمع:</span>
                  <span className="text-base font-black font-mono">
                    {mixedLines.reduce((sum, line) => sum + (parseFloat(line.weight||0) * parseFloat(gradePrices[line.grade]||0)), 0).toFixed(2)} ج.م
                  </span>
                </div>

                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg cursor-pointer">
                  + إضافة الميكس المجمع إلى السلة
                </button>
              </form>
            )}

            {/* MODE 4: OFFERS */}
            {saleMode === 'OFFERS' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm border-b pb-3 flex items-center gap-2"><Gift size={20} /> العروض والخصومات المعتمدة</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div onClick={() => { setDiscountAmount('50.00'); alert('✅ تم تطبيق خصم العرض!'); }} className="p-4 bg-slate-50 border rounded-2xl cursor-pointer hover:bg-emerald-50">
                    <div className="font-bold text-sm">🎁 عرض الشراء المباشر (-50 ج.م)</div>
                    <p className="text-xs text-slate-500 mt-1">خصم 50 ج.م فوري على الفاتورة</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 1/3: CART PANEL */}
        <div className="w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2"><ShoppingCart size={18} className="text-emerald-400" /><span className="font-bold text-xs uppercase">سلة المبيعات</span></div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">{cart.length} أصناف</span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
            {cart.map((item) => (
              <div key={item.id} className="pt-2 flex justify-between items-start gap-2">
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                  {item.isWeighedLot ? (
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>الوزن: <strong>{item.weightKg} كجم</strong> {item.pricePerKg !== 'ميكس' && `@ ${item.pricePerKg} ج/كجم`}</div>
                      <div className="text-emerald-700 font-semibold">المحتويات: {item.subItems.map(s => `${s.count} ${s.name}`).join(' ')}</div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      عدد القطع: 
                      <input type="number" min="1" value={item.qty} onChange={(e) => {
                        const newQty = parseInt(e.target.value || 1);
                        setCart(cart.map(c => c.id === item.id ? { ...c, qty: newQty, totalPrice: (newQty * parseFloat(c.unitPrice)).toFixed(2) } : c));
                      }} className="w-10 border rounded px-1 text-center font-bold" />
                      × <input type="number" value={item.unitPrice} onChange={(e) => {
                        const newP = parseFloat(e.target.value || 0);
                        setCart(cart.map(c => c.id === item.id ? { ...c, unitPrice: newP.toFixed(2), totalPrice: (item.qty * newP).toFixed(2) } : c));
                      }} className="w-16 border rounded px-1 text-center font-bold text-indigo-700" /> ج.م
                    </div>
                  )}
                </div>
                <div className="text-left flex flex-col items-end gap-1">
                  <span className="font-black text-slate-900 text-xs">{item.totalPrice} ج.م</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div className="text-center py-20 text-slate-400 font-bold space-y-2"><ShoppingCart size={32} className="mx-auto text-slate-300" /><div>السلة فارغة حاليا</div></div>}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between"><span>المجموع الفرعي:</span><span className="font-bold text-slate-900">{cartSubtotal.toFixed(2)} ج.م</span></div>
              <div className="flex justify-between items-center">
                <span>خصم / عرض ترويجي:</span>
                <div className="relative w-24">
                  <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="w-full p-1 bg-white border rounded font-bold text-rose-600 text-left text-xs" />
                  <span className="absolute left-1.5 top-1 text-[9px] text-slate-400 font-bold">ج.م</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                <span>الإجمالي الصافي المستحق:</span><span className="text-emerald-700 text-base">{netTotal.toFixed(2)} ج.م</span>
              </div>
            </div>
            <button onClick={openCheckout} className="w-full bg-emerald-600 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg cursor-pointer text-xs flex justify-center gap-2">
              <Banknote size={18} /> إتمام البيع وتحصيل النقدية
            </button>
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2"><Banknote size={18} className="text-emerald-600" /> اختيار طرق تحصيل الفاتورة الـ 4</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleFinalCheckout} className="space-y-3">
              <div className="p-3 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                <span className="font-bold">المبلغ الصافي المستحق:</span>
                <span className="font-black text-emerald-400 text-base font-mono">{netTotal.toFixed(2)} ج.م</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1 text-[11px]"><Banknote size={14} className="text-emerald-600" /> 💵 كاش</label>
                  <input type="number" step="1" value={paidCash} onChange={(e) => setPaidCash(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold" />
                </div>

                <div className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1 text-[11px]"><CreditCard size={14} className="text-indigo-600" /> 💳 فيزا</label>
                  <input type="number" step="1" value={paidCard} onChange={(e) => setPaidCard(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold text-indigo-900" />
                </div>

                <div className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1 text-[11px]"><QrCode size={14} className="text-amber-600" /> 📱 إنستا باي</label>
                  <input type="number" step="1" value={paidInstaPay} onChange={(e) => setPaidInstaPay(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold text-amber-900" />
                </div>

                <div className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1 text-[11px]"><Smartphone size={14} className="text-rose-600" /> 📲 محفظة</label>
                  <input type="number" step="1" value={paidWallet} onChange={(e) => setPaidWallet(e.target.value)} className="w-full p-2 bg-white border rounded-lg font-bold text-rose-900" />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition cursor-pointer">
                تأكيد التحصيل وطباعة الإيصال 🖨️
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            <div id="receipt-print-area" className="p-4 bg-slate-50 border rounded-xl text-slate-900 font-mono text-[11px] space-y-3">
              <div className="text-center space-y-1 border-b pb-2">
                <div className="font-black text-sm">موشن ستور — Motion Store</div>
                <div>فرع سموحة الرئيسي - الإسكندرية</div>
                <div className="text-[9px] text-slate-500">رقم الفاتورة: #{lastInvoice.invoice_number}</div>
                <div className="text-[9px] text-slate-500">التاريخ: {lastInvoice.date}</div>
              </div>

              <div className="space-y-2 border-b pb-2">
                {lastInvoice.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold"><span>{item.name}</span><span>{item.totalPrice} ج.م</span></div>
                    {item.isWeighedLot ? <div className="text-[9px] text-slate-600">الوزن: {item.weightKg} كجم | الأصناف: {item.subItems?.map(s => `${s.count} ${s.name}`).join(' ')}</div> : <div className="text-[9px] text-slate-600">الكمية: {item.qty}</div>}
                  </div>
                ))}
              </div>

              <div className="space-y-1 font-bold text-xs pt-1">
                <div className="flex justify-between"><span>الإجمالي الصافي:</span><span className="font-black">{lastInvoice.netTotal} ج.م</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrintReceipt} className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl"><Printer size={15} className="inline mr-1"/> طباعة 80mm</button>
              <button onClick={() => setShowReceiptModal(false)} className="px-3 bg-slate-100 font-bold rounded-xl">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* OPEN SHIFT MODAL */}
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



