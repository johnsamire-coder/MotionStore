import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
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
  AlertCircle,
  CheckCircle2,
  X,
  Scale,
  Sparkles,
  Tag
} from 'lucide-react';

export default function POSPage() {
  const { user, tenant } = useAuth();
  
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
  const [errorMessage, setErrorMessage] = useState('');

  // Initial Load
  useEffect(() => {
    loadPOSContext();
  }, []);

  const loadPOSContext = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Get Terminal for active branch
      const termRes = await axiosClient.get('/pos-terminals/');
      const termData = termRes.data.results?.[0] || termRes.data?.[0];
      setTerminal(termData);

      if (termData) {
        // 2. Check for active open shift on this terminal
        const shiftRes = await axiosClient.get(`/shifts/?terminal=${termData.id}&status=OPEN`);
        const openShift = shiftRes.data.results?.[0] || shiftRes.data?.[0];
        setActiveShift(openShift || null);
        if (!openShift) {
          setShowOpenShiftModal(true);
        }
      }

      // 3. Load Available Finished Stock Items (with positive weight)
      const stockRes = await axiosClient.get('/stock-items/');
      const availableStock = (stockRes.data.results || stockRes.data || []).filter(item => parseFloat(item.total_weight_kg) > 0);
      setStockItems(availableStock);

      // 4. Load Active Payment Methods
      const payRes = await axiosClient.get('/payments/?is_active=true');
      setPaymentMethods(payRes.data.results || payRes.data || []);
      if (payRes.data.results?.[0]) {
        setSelectedPaymentMethod(payRes.data.results[0]);
      }

    } catch (err) {
      console.error("Failed to load POS context:", err);
      setErrorMessage("Could not connect to POS engine. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // Open Shift Action
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

  // Cart Operations
  const addToCart = (stockItem) => {
    const existingIndex = cart.findIndex(i => i.stockItem.id === stockItem.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      // Increment weight by 1 KG by default
      const currentWt = parseFloat(updated[existingIndex].weight_kg);
      const newWt = (currentWt + 1.0).toFixed(3);
      if (newWt <= parseFloat(stockItem.total_weight_kg)) {
        updated[existingIndex].weight_kg = newWt;
        updated[existingIndex].pieces += 1;
        setCart(updated);
      }
    } else {
      // Default price fallback: 300 for New, 150 for Middle, 50 for Clearance
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

  // Subtotal & Totals
  const subtotal = cart.reduce((acc, item) => {
    const wt = parseFloat(item.weight_kg) || 0;
    const pr = parseFloat(item.unit_price) || 0;
    return acc + (wt * pr);
  }, 0);

  const discountVal = parseFloat(discountAmount) || 0;
  const netTotal = Math.max(0, subtotal - discountVal);

  // Checkout API Call
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
      
      // Refresh available stock
      loadPOSContext();
    } catch (err) {
      alert(err.response?.data?.detail || "Checkout failed. Check stock availability.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Stock Items
  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'ALL' || item.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Left: Product Catalog & Grade Tabs (60% width) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Top Shift Status & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-700">
              Terminal: {terminal?.code || 'POS-01'} | Shift: #{activeShift?.shift_code || 'None'}
            </span>
          </div>
          
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search garments / categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Grade Selection Tabs */}
        <div className="flex px-4 pt-3 border-b border-slate-100 gap-2 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'NEW_COLLECTION', label: '✨ New Collection (300 EGP)' },
            { id: 'MIDDLE', label: '📦 Middle Grade (150 EGP)' },
            { id: 'CLEARANCE', label: '🏷️ Clearance (50 EGP)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedGrade(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                selectedGrade === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredStock.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="uppercase tracking-wider font-mono">{item.grade?.replace('_', ' ')}</span>
                  <span className="text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {item.total_weight_kg} KG in stock
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition">
                  {item.product_name}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  {item.grade === 'NEW_COLLECTION' ? '300.00' : item.grade === 'MIDDLE' ? '150.00' : '50.00'} <span className="text-[10px] font-normal text-slate-500">EGP/KG</span>
                </span>
                <button className="w-7 h-7 rounded-lg bg-white group-hover:bg-emerald-600 text-slate-600 group-hover:text-white flex items-center justify-center border border-slate-200 group-hover:border-emerald-600 transition shadow-xs">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}

          {filteredStock.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs">
              No active stock available matching criteria. Process and sort bales first.
            </div>
          )}
        </div>
      </div>

      {/* Right: POS Live Cart & Total Checkout (40% width) */}
      <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">Current Cart</span>
          </div>
          {cart.length > 0 && (
            <button 
              onClick={clearCart} 
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {cart.map((item, index) => {
            const lineTotal = (parseFloat(item.weight_kg || 0) * parseFloat(item.unit_price || 0)).toFixed(2);
            return (
              <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 truncate max-w-[180px]">
                    {item.stockItem.product_name}
                  </span>
                  <button onClick={() => removeFromCart(index)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  {/* Weight Input */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <Scale size={13} className="text-emerald-600" />
                    <input
                      type="number"
                      step="0.05"
                      value={item.weight_kg}
                      onChange={(e) => updateCartItemWeight(index, e.target.value)}
                      className="w-14 text-center font-bold text-slate-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">KG</span>
                  </div>

                  {/* Piece Counter */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
                    <button onClick={() => updateCartItemPieces(index, -1)} className="p-0.5 hover:bg-slate-100 rounded">
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center font-semibold text-slate-800 text-[11px]">{item.pieces} pc</span>
                    <button onClick={() => updateCartItemPieces(index, 1)} className="p-0.5 hover:bg-slate-100 rounded">
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="font-extrabold text-slate-900">
                    {lineTotal} <span className="text-[9px] text-slate-500">EGP</span>
                  </div>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <ShoppingCart size={32} className="text-slate-300 stroke-1" />
              <span>Cart is empty. Select items from the left.</span>
            </div>
          )}
        </div>

        {/* Cart Summary & Checkout */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>Subtotal:</span>
            <span className="font-bold text-slate-900">{subtotal.toFixed(2)} EGP</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1"><Tag size={12} /> Discount:</span>
            <input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-20 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg font-semibold text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="font-extrabold text-sm text-slate-900">NET TOTAL:</span>
            <span className="font-black text-xl text-emerald-600">{netTotal.toFixed(2)} <span className="text-xs font-normal">EGP</span></span>
          </div>

          <button
            onClick={() => setShowCheckoutModal(true)}
            disabled={cart.length === 0 || !activeShift}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Banknote size={18} /> Pay & Complete Sale
          </button>
        </div>
      </div>

      {/* MODAL: Checkout & Payment Selection */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Select Payment Method</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="text-center py-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium">Total Amount Due</p>
              <h2 className="text-3xl font-black text-emerald-700 mt-1">{netTotal.toFixed(2)} EGP</h2>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Options</label>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPaymentMethod(pm)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
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
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {submitting ? 'Recording Transaction...' : 'Confirm Receipt & Print'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Open Shift Requirement */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Clock size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">Open Shift Required</h3>
              <p className="text-xs text-slate-500 mt-1">Terminal #{terminal?.code} has no active shift. Enter opening float cash to begin selling.</p>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Opening Cash Float (EGP)</label>
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
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20"
              >
                Open Register Shift
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Thermal Receipt Preview */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <CheckCircle2 size={18} /> Sale Completed Successfully
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            {/* Simulated 80mm ESC/POS Thermal Paper Preview */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
{`========================================
      MOTION STORE - THRIFT & BALES     
        Branch: ${lastInvoice.branch_name || 'Alexandria'}
   Terminal: ${terminal?.code} | Cashier: ${user?.username}
   Invoice #: ${lastInvoice.invoice_number}
----------------------------------------
Item / Grade       Wt(KG)  Price   Total
----------------------------------------
${lastInvoice.lines?.map(l => `${l.product_name?.substring(0, 10)} (${l.grade?.substring(0, 4)})  ${parseFloat(l.weight_kg).toFixed(2)}    ${parseFloat(l.unit_price).toFixed(0)}    ${parseFloat(l.total_price).toFixed(2)}`).join('\n')}
----------------------------------------
SUBTOTAL:                      ${parseFloat(lastInvoice.subtotal).toFixed(2)} EGP
NET TOTAL:                     ${parseFloat(lastInvoice.total_amount).toFixed(2)} EGP
========================================
Paid via Cash:                 ${parseFloat(lastInvoice.total_amount).toFixed(2)} EGP
----------------------------------------
    Thank you for shopping with us!    
========================================`}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Receipt (ESC/POS)
              </button>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
