import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Printer, 
  Clock, 
  CheckCircle2,
  X,
  Scale,
  Tag
} from 'lucide-react';

export default function POSPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  
  // Data States
  const [terminal, setTerminal] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cart & Checkout States
  const [cart, setCart] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  
  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500.00');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
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
        if (!openShift) {
          setShowOpenShiftModal(true);
        }
      }

      const stockRes = await axiosClient.get('/stock-items/');
      const availableStock = (stockRes.data.results || stockRes.data || []).filter(item => parseFloat(item.total_weight_kg) > 0);
      setStockItems(availableStock);

      const payRes = await axiosClient.get('/payments/?is_active=true');
      const payList = payRes.data.results || payRes.data || [];
      setPaymentMethods(payList);
      if (payList[0]) {
        setSelectedPaymentMethod(payList[0]);
      }
    } catch (err) {
      console.error("Failed to load POS context:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!terminal) return;
    try {
      const res = await axiosClient.post('/shifts/open/', {
        terminal_id: terminal.id,
        opening_cash: openingFloat,
        notes: "Opened from POS Interface"
      });
      setActiveShift(res.data);
      setShowOpenShiftModal(false);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to open shift.");
    }
  };

  const addToCart = (stockItem) => {
    const existingIndex = cart.findIndex(i => i.stockItem.id === stockItem.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      const currentWt = parseFloat(updated[existingIndex].weight_kg);
      const newWt = (currentWt + 1.0).toFixed(3);
      if (newWt <= parseFloat(stockItem.total_weight_kg)) {
        updated[existingIndex].weight_kg = newWt;
        updated[existingIndex].pieces += 1;
        setCart(updated);
      }
    } else {
      let pricePerKg = 150;
      if (stockItem.grade === 'NEW_COLLECTION') pricePerKg = 300;
      else if (stockItem.grade === 'CLEARANCE') pricePerKg = 50;

      setCart([...cart, {
        stockItem,
        weight_kg: '1.000',
        pieces: 1,
        unit_price: pricePerKg.toFixed(2),
        discount: 0
      }]);
    }
  };

  const updateCartItemWeight = (index, newWeight) => {
    const updated = [...cart];
    const maxAvailable = parseFloat(updated[index].stockItem.total_weight_kg);
    const parsed = parseFloat(newWeight) || 0;
    if (parsed <= maxAvailable) {
      updated[index].weight_kg = newWeight;
      setCart(updated);
    }
  };

  const updateCartItemPieces = (index, delta) => {
    const updated = [...cart];
    const newCount = updated[index].pieces + delta;
    if (newCount >= 1) {
      updated[index].pieces = newCount;
      setCart(updated);
    }
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount('0');
  };

  const subtotal = cart.reduce((acc, item) => {
    const wt = parseFloat(item.weight_kg) || 0;
    const pr = parseFloat(item.unit_price) || 0;
    return acc + (wt * pr);
  }, 0);

  const discountVal = parseFloat(discountAmount) || 0;
  const netTotal = Math.max(0, subtotal - discountVal);

  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    setSubmitting(true);
    try {
      const payload = {
        shift_id: activeShift.id,
        items: cart.map(item => ({
          stock_item_id: item.stockItem.id,
          weight_kg: item.weight_kg,
          quantity_pieces: item.pieces,
          unit_price: item.unit_price,
          discount_amount: "0.00"
        })),
        payments: [
          {
            payment_method: selectedPaymentMethod?.id || paymentMethods[0]?.id,
            amount: netTotal.toFixed(2)
          }
        ],
        discount_amount: discountVal.toFixed(2),
        notes: "POS Retail Sale"
      };

      const res = await axiosClient.post('/sales/checkout/', payload);
      setLastInvoice(res.data);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      clearCart();
      loadPOSContext();
    } catch (err) {
      alert(err.response?.data?.detail || "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'ALL' || item.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const renderReceiptLines = (invoice) => {
    if (!invoice || !invoice.lines) return '';
    return invoice.lines.map(l => {
      const name = (l.product_name || 'Item').substring(0, 10);
      const grade = (l.grade || '').substring(0, 4);
      const wt = parseFloat(l.weight_kg || 0).toFixed(2);
      const price = parseFloat(l.unit_price || 0).toFixed(0);
      const total = parseFloat(l.total_price || 0).toFixed(2);
      return `${name} (${grade})  ${wt}    ${price}    ${total}`;
    }).join('
');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Product Catalog & Grade Tabs */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">
              {t('pos.terminal')}: {terminal?.code || 'POS-01'} | {t('pos.shift')}: #{activeShift?.shift_code || '---'}
            </span>
          </div>
          
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
            <input
              type="text"
              placeholder={t('pos.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500`}
            />
          </div>
        </div>

        <div className="flex px-4 pt-3 border-b border-slate-100 gap-2 overflow-x-auto">
          {[
            { id: 'ALL', label: t('pos.allGrades') },
            { id: 'NEW_COLLECTION', label: t('pos.newCollection') },
            { id: 'MIDDLE', label: t('pos.middleGrade') },
            { id: 'CLEARANCE', label: t('pos.clearanceGrade') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedGrade(tab.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
                selectedGrade === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredStock.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="uppercase tracking-wider">{item.grade?.replace('_', ' ')}</span>
                  <span className="text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded font-bold">
                    {item.total_weight_kg} {t('common.kg')}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition">
                  {item.product_name}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  {item.grade === 'NEW_COLLECTION' ? '300.00' : item.grade === 'MIDDLE' ? '150.00' : '50.00'} <span className="text-[10px] font-normal text-slate-500">{t('pos.perKg')}</span>
                </span>
                <button className="w-7 h-7 rounded-lg bg-white group-hover:bg-emerald-600 text-slate-600 group-hover:text-white flex items-center justify-center border border-slate-200 group-hover:border-emerald-600 transition">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}

          {filteredStock.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold">
              {t('pos.noStock')}
            </div>
          )}
        </div>
      </div>

      {/* Cart & Total Checkout Panel */}
      <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">{t('pos.cartTitle')}</span>
          </div>
          {cart.length > 0 && (
            <button 
              onClick={clearCart} 
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 size={12} /> {t('pos.clearCart')}
            </button>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {cart.map((item, index) => {
            const lineTotal = (parseFloat(item.weight_kg || 0) * parseFloat(item.unit_price || 0)).toFixed(2);
            return (
              <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 truncate max-w-[180px]">
                    {item.stockItem.product_name}
                  </span>
                  <button onClick={() => removeFromCart(index)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <Scale size={13} className="text-emerald-600" />
                    <input
                      type="number"
                      step="0.05"
                      value={item.weight_kg}
                      onChange={(e) => updateCartItemWeight(index, e.target.value)}
                      className="w-14 text-center font-bold text-slate-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">{t('common.kg')}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
                    <button onClick={() => updateCartItemPieces(index, -1)} className="p-0.5 hover:bg-slate-100 rounded">
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800 text-[11px]">{item.pieces} {t('common.pcs')}</span>
                    <button onClick={() => updateCartItemPieces(index, 1)} className="p-0.5 hover:bg-slate-100 rounded">
                      <Plus size={11} />
                    </button>
                  </div>

                  <div className="font-extrabold text-slate-900">
                    {lineTotal} <span className="text-[9px] text-slate-500">{t('common.currency')}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <ShoppingCart size={32} className="text-slate-300 stroke-1" />
              <span>{t('pos.emptyCart')}</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex justify-between text-xs text-slate-600 font-semibold">
            <span>{t('pos.subtotal')}</span>
            <span className="font-bold text-slate-900">{subtotal.toFixed(2)} {t('common.currency')}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1"><Tag size={12} /> {t('pos.discount')}</span>
            <input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-20 px-2 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="font-extrabold text-sm text-slate-900">{t('pos.netTotal')}</span>
            <span className="font-black text-xl text-emerald-600">{netTotal.toFixed(2)} <span className="text-xs font-normal">{t('common.currency')}</span></span>
          </div>

          <button
            onClick={() => setShowCheckoutModal(true)}
            disabled={cart.length === 0 || !activeShift}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Banknote size={18} /> {t('pos.payButton')}
          </button>
        </div>
      </div>

      {/* MODAL: Checkout */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{t('pos.selectPayment')}</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="text-center py-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-700 font-bold">{t('pos.totalDue')}</p>
              <h2 className="text-3xl font-black text-emerald-700 mt-1">{netTotal.toFixed(2)} {t('common.currency')}</h2>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPaymentMethod(pm)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                      selectedPaymentMethod?.id === pm.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {pm.method_type === 'CASH' ? <Banknote size={18} className="text-emerald-600" /> : <CreditCard size={18} className="text-blue-600" />}
                    <span className="text-xs">{pm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('pos.submitting') : t('pos.confirmReceipt')}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Open Shift */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Clock size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">{t('pos.openShiftRequired')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('pos.openShiftDesc')}</p>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('pos.openingFloat')}</label>
                <input
                  type="number"
                  step="10"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {t('pos.openShiftBtn')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Thermal Receipt */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <CheckCircle2 size={18} /> {t('pos.receiptTitle')}
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
{`========================================
      موشن ستور - تجزئة بالات وملابس     
   الفرع: ${lastInvoice.branch_name || 'الإسكندرية'}
   المحطة: ${terminal?.code} | الكاشير: ${user?.username}
   رقم الفاتورة: ${lastInvoice.invoice_number}
----------------------------------------
الصنف / الدرجة     الوزن    السعر   الإجمالي
----------------------------------------
${renderReceiptLines(lastInvoice)}
----------------------------------------
الإجمالي الفرعي:               ${parseFloat(lastInvoice.subtotal || 0).toFixed(2)} ج.م
الصافي النهائي:                ${parseFloat(lastInvoice.total_amount || 0).toFixed(2)} ج.م
========================================
طريقة السداد:                 ${parseFloat(lastInvoice.total_amount || 0).toFixed(2)} ج.م
----------------------------------------
      شكراً لزيارتكم موشن ستور!    
========================================`}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> {t('pos.printReceipt')}
              </button>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition cursor-pointer"
              >
                {t('pos.newSale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
