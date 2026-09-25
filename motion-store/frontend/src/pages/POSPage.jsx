import React, { useState, useEffect, useRef } from 'react';
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
  Tag,
  Truck,
  User,
  AlertCircle
} from 'lucide-react';

export default function POSPage() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  // Data States
  const [terminal, setTerminal] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States (Left Table)
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [codeFilter, setCodeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickCode, setQuickCode] = useState('');

  // Cart & Invoice Calculations (Right Table)
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [previousBalance, setPreviousBalance] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Modals & Triggers
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500.00');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [lastPaidAmount, setLastPaidAmount] = useState('0');
  const [lastChangeDue, setLastChangeDue] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const barcodeInputRef = useRef(null);
  const quickCodeInputRef = useRef(null);

  useEffect(() => {
    loadPOSContext();
  }, []);

  // Keyboard shortcut listener inside POS
  useEffect(() => {
    const handlePOSShortcuts = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (cart.length > 0) openCheckout();
      } else if (e.key === 'F3') {
        e.preventDefault();
        clearCart();
      }
    };
    window.addEventListener('keydown', handlePOSShortcuts);
    return () => window.removeEventListener('keydown', handlePOSShortcuts);
  }, [cart]);

  const loadPOSContext = async () => {
    setLoading(true);
    try {
      const [termRes, stockRes, catRes, payRes, custRes] = await Promise.all([
        axiosClient.get('/pos-terminals/'),
        axiosClient.get('/stock-items/'),
        axiosClient.get('/categories/'),
        axiosClient.get('/payments/?is_active=true'),
        axiosClient.get('/customers/')
      ]);

      const termData = termRes.data.results?.[0] || termRes.data?.[0];
      setTerminal(termData);

      if (termData) {
        const shiftRes = await axiosClient.get(`/shifts/?terminal=${termData.id}&status=OPEN`);
        const openShift = shiftRes.data.results?.[0] || shiftRes.data?.[0];
        setActiveShift(openShift || null);
        if (!openShift) setShowOpenShiftModal(true);
      }

      setStockItems(stockRes.data.results || stockRes.data || []);
      setCategories(catRes.data.results || catRes.data || []);
      const payList = payRes.data.results || payRes.data || [];
      setPaymentMethods(payList);
      if (payList[0]) setSelectedPaymentMethod(payList[0]);
      setCustomers(custRes.data.results || custRes.data || []);
    } catch (err) {
      console.error('Failed to load POS context:', err);
    } finally {
      setLoading(false);
      setTimeout(() => quickCodeInputRef.current?.focus(), 100);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!terminal) return;
    try {
      const res = await axiosClient.post('/shifts/open/', {
        terminal_id: terminal.id,
        opening_cash: openingFloat,
        notes: 'Opened from POS Interface'
      });
      setActiveShift(res.data);
      setShowOpenShiftModal(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل فتح الوردية');
    }
  };


  const handleQuickCodeEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = (quickCode || '').trim();
    if (!code) return;

    const found = stockItems.find((item) => {
      const pCode = (item.product?.code || item.product_code || '').toString().trim().toLowerCase();
      const pBarcode = (item.product?.barcode || item.barcode || '').toString().trim().toLowerCase();
      const pName = (item.product_name || item.product?.name || '').toString().trim().toLowerCase();
      const q = code.toLowerCase();
      return pCode === q || pBarcode === q || pCode.includes(q) || pBarcode.includes(q) || pName === q;
    });

    if (!found) {
      alert('الكود غير موجود في المخزون: ' + code);
      setQuickCode('');
      setTimeout(() => quickCodeInputRef.current?.focus(), 50);
      return;
    }

    if (parseFloat(found.total_weight_kg || 0) <= 0) {
      alert('لا يوجد رصيد متاح لهذا الصنف');
      setQuickCode('');
      setTimeout(() => quickCodeInputRef.current?.focus(), 50);
      return;
    }

    addToCart(found);
    setQuickCode('');
    setTimeout(() => quickCodeInputRef.current?.focus(), 50);
  };

  const addToCart = (stockItem) => {
    const existingIndex = cart.findIndex(c => c.stock_item_id === stockItem.id);
    const unitPrice = parseFloat(stockItem.retail_price || stockItem.current_selling_price || 150);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].weight_kg = (parseFloat(updated[existingIndex].weight_kg) + 1).toFixed(3);
      updated[existingIndex].quantity_pieces = (updated[existingIndex].quantity_pieces || 1) + 1;
      setCart(updated);
    } else {
      setCart(prev => [
        ...prev,
        {
          stock_item_id: stockItem.id,
          product_name: stockItem.product_name || stockItem.product?.name || 'صنف بدون اسم',
          product_code: stockItem.product?.code || '—',
          grade: stockItem.grade || 'NEW_COLLECTION',
          uom_mode: 'KG',
          weight_kg: '1.000',
          quantity_pieces: 1,
          unit_price: unitPrice.toFixed(2),
          available_weight: parseFloat(stockItem.total_weight_kg || 0)
        }
      ]);
    }
  };

  const updateCartLine = (index, field, value) => {
    const updated = [...cart];
    updated[index][field] = value;
    setCart(updated);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount('0');
    setDeliveryFee('0');
    setPreviousBalance('0');
    setPaidAmount('');
    setNotes('');
  };

  // Totals
  const subtotal = cart.reduce((acc, item) => {
    const qty = parseFloat(item.weight_kg) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return acc + qty * price;
  }, 0);

  const parsedDiscount = parseFloat(discountAmount) || 0;
  const parsedDelivery = parseFloat(deliveryFee) || 0;
  const parsedPrevBal = parseFloat(previousBalance) || 0;

  const totalRequired = Math.max(0, subtotal - parsedDiscount + parsedDelivery + parsedPrevBal);
  const parsedPaid = parseFloat(paidAmount) || totalRequired;
  const changeDue = parsedPaid - totalRequired;

  const openCheckout = () => {
    if (!activeShift) {
      alert('يجب فتح الوردية أولاً لإتمام البيع!');
      setShowOpenShiftModal(true);
      return;
    }
    if (cart.length === 0) {
      alert('السلة فارغة!');
      return;
    }
    setPaidAmount(totalRequired.toFixed(2));
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        shift_id: activeShift.id,
        items: cart.map(item => ({
          stock_item_id: item.stock_item_id,
          weight_kg: item.weight_kg,
          quantity_pieces: item.quantity_pieces,
          unit_price: item.unit_price,
          discount_amount: '0.00'
        })),
        payments: [
          {
            payment_method_id: selectedPaymentMethod?.id || paymentMethods[0]?.id,
            amount: totalRequired.toFixed(2)
          }
        ],
        discount_amount: parsedDiscount.toFixed(2),
        delivery_fee: parsedDelivery.toFixed(2),
        previous_balance: parsedPrevBal.toFixed(2),
        customer_id: selectedCustomer?.id || null,
        notes: notes
      };

      const res = await axiosClient.post('/sales/checkout/', payload);
      setLastInvoice(res.data);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      clearCart();
      loadPOSContext();
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'فشل إتمام عملية البيع');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStock = stockItems.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.category_id === selectedCategory;
    const matchesCode = !codeFilter || (item.product?.code && item.product.code.includes(codeFilter));
    const matchesSearch = !searchQuery || (item.product_name && item.product_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesCode && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Shift Banner */}
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold">الوردية الحالية:</span>
            <span className="font-mono text-emerald-400 font-bold">{activeShift ? `#${activeShift.shift_code}` : 'مغلقة'}</span>
          </div>
          <div>|</div>
          <div>الكاشير: <span className="font-bold text-slate-200">{user?.username}</span></div>
          <div>|</div>
          <div>نقطة البيع: <span className="font-bold text-slate-200">{terminal?.code || 'POS-01'}</span></div>
        </div>

        {!activeShift && (
          <button
            onClick={() => setShowOpenShiftModal(true)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black cursor-pointer"
          >
            فتح وردية جديدة
          </button>
        )}
      </div>


      {/* Quick Code Entry - Direct to Invoice */}
      <div className="bg-emerald-600 p-3 rounded-xl shadow-md flex items-center gap-3 print:hidden">
        <Tag className="text-white shrink-0" size={20} />
        <div className="flex-1">
          <label className="block text-[11px] font-black text-emerald-100 mb-1">أدخل كود الصنف ثم Enter — ينزل مباشرة في الفاتورة</label>
          <input
            ref={quickCodeInputRef}
            type="text"
            value={quickCode}
            onChange={(e) => setQuickCode(e.target.value)}
            onKeyDown={handleQuickCodeEnter}
            placeholder="اكتب الكود أو الباركود هنا..."
            className="w-full bg-white border-0 rounded-lg px-4 py-3 text-base font-black text-slate-900 tracking-wider focus:ring-4 focus:ring-emerald-300 outline-none"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT SIDE: PRODUCT DIRECTORY TABLE */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col space-y-3">
          <div className="border-b pb-2">
            <h2 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Tag size={15} className="text-emerald-600" />
              دليل الأصناف المتاحة بالمخزن
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التصنيف</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold"
              >
                <option value="ALL">الكل</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الكود</label>
              <input
                type="text"
                placeholder="كود..."
                value={codeFilter}
                onChange={e => setCodeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">بحث سريع (*)</label>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="الاسم / باركود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredStock.length > 0) {
                    addToCart(filteredStock[0]);
                    setSearchQuery('');
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px] border rounded-lg">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black sticky top-0 border-b">
                <tr>
                  <th className="p-2">الكود</th>
                  <th className="p-2">الصنف</th>
                  <th className="p-2">جملة</th>
                  <th className="p-2">البيع</th>
                  <th className="p-2 text-center">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStock.map(item => {
                  const stockWeight = parseFloat(item.total_weight_kg || 0);
                  const isAvailable = stockWeight > 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => isAvailable && addToCart(item)}
                      className={`cursor-pointer transition ${
                        isAvailable ? 'hover:bg-emerald-50/50' : 'opacity-40 bg-slate-50 cursor-not-allowed'
                      }`}
                    >
                      <td className="p-2 font-mono font-bold text-slate-500">{item.product?.code || '—'}</td>
                      <td className="p-2 font-black text-slate-900">{item.product_name || item.product?.name}</td>
                      <td className="p-2 font-bold text-blue-600">{parseFloat(item.product?.wholesale_price || 0).toFixed(2)}</td>
                      <td className="p-2 font-black text-emerald-700">{parseFloat(item.retail_price || item.current_selling_price || 150).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {stockWeight.toFixed(2)} كجم
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT SIDE: CURRENT INVOICE */}
        <div className="lg:col-span-7 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h2 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <ShoppingCart size={15} className="text-emerald-600" />
                الفاتورة الحالية ({cart.length} أصناف)
              </h2>
              <button
                onClick={clearCart}
                className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} />
                تفريغ الفاتورة (F3)
              </button>
            </div>

            <div className="overflow-y-auto max-h-[300px] border rounded-lg">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 font-black text-slate-700 sticky top-0 border-b">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">الصنف</th>
                    <th className="p-2">الدرجة</th>
                    <th className="p-2">الوحدة</th>
                    <th className="p-2">الكمية/الوزن</th>
                    <th className="p-2">السعر</th>
                    <th className="p-2">الإجمالي</th>
                    <th className="p-2 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-10 text-slate-400">
                        الفاتورة فارغة — اختر صنفاً من الجدول لإضافته
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                      const lineTotal = (parseFloat(item.weight_kg) || 0) * (parseFloat(item.unit_price) || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400">{idx + 1}</td>
                          <td className="p-2 font-black text-slate-900">{item.product_name}</td>
                          <td className="p-2 text-[10px] font-bold text-slate-600">{item.grade}</td>
                          <td className="p-2">
                            <select
                              value={item.uom_mode}
                              onChange={e => updateCartLine(idx, 'uom_mode', e.target.value)}
                              className="bg-slate-50 border rounded p-1 text-[11px] font-bold"
                            >
                              <option value="KG">⚖️ كجم</option>
                              <option value="PIECE">🔢 قطعة</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.001"
                              value={item.weight_kg}
                              onChange={e => updateCartLine(idx, 'weight_kg', e.target.value)}
                              className="w-20 bg-emerald-50/50 border border-emerald-300 rounded p-1 text-xs font-black text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={e => updateCartLine(idx, 'unit_price', e.target.value)}
                              className="w-16 bg-slate-50 border rounded p-1 text-xs font-bold text-center"
                            />
                          </td>
                          <td className="p-2 font-black text-emerald-800">{lineTotal.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => removeFromCart(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">الإجمالي (ج.م)</label>
                <input
                  type="text"
                  readOnly
                  value={subtotal.toFixed(2)}
                  className="w-full bg-slate-200/70 border border-slate-300 rounded-lg p-2 text-sm font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">م.توصيل</label>
                <input
                  type="number"
                  step="0.01"
                  value={deliveryFee}
                  onChange={e => setDeliveryFee(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">خصم</label>
                <input
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={e => setDiscountAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">الرصيد السابق</label>
                <input
                  type="number"
                  step="0.01"
                  value={previousBalance}
                  onChange={e => setPreviousBalance(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
              <div className="bg-emerald-100 border border-emerald-300 p-2.5 rounded-xl flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950">اجمالي المطلوب:</span>
                <span className="text-xl font-black text-emerald-900">{totalRequired.toFixed(2)} ج.م</span>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="الملاحظة على الفاتورة..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={openCheckout}
                disabled={cart.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                <Banknote size={20} />
                <span>حفظ الفاتورة والدفع (F1)</span>
              </button>

              <button
                onClick={clearCart}
                className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-black text-sm cursor-pointer"
              >
                جديد (F3)
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-800">إتمام الدفع وطباعة الفاتورة</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                <span className="text-xs text-emerald-700 font-bold block">المبلغ الإجمالي المطلوب</span>
                <span className="text-3xl font-black text-emerald-900">{totalRequired.toFixed(2)} ج.م</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">طريقة الدفع</label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(pm => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(pm)}
                      className={`p-2.5 rounded-lg border text-xs font-black transition cursor-pointer ${
                        selectedPaymentMethod?.id === pm.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ المدفوع</label>
                <input
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-lg font-black text-slate-900"
                />
              </div>

              {changeDue > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-blue-800">المتبقي للعميل (الباقي):</span>
                  <span className="font-black text-blue-900 text-sm">{changeDue.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCheckoutSubmit}
                disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'جاري الحفظ...' : 'تأكيد وحفظ الفاتورة'}
              </button>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border text-center">
            <div className="border-b pb-3 font-mono text-xs">
              <h2 className="text-lg font-black text-slate-900">Jacky Stores - چاكي</h2>
              <p className="text-[11px] text-slate-500">Fashion - Cosmetics</p>
              <p className="text-[10px] text-slate-400 mt-1">8 أحمد الدرديري أرض الجولف - مصر الجديدة</p>
              <p className="text-[10px] text-slate-400">0224156959 - 01507092909</p>
            </div>

            <div className="text-right text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>رقم الفاتورة:</span>
                <span className="font-bold">{lastInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span>{new Date(lastInvoice.invoice_date_time).toLocaleString('ar-EG')}</span>
              </div>
              <div className="flex justify-between">
                <span>الكاشير:</span>
                <span>{lastInvoice.cashier_username || user?.username}</span>
              </div>
            </div>

            <table className="w-full text-right text-[11px] border-y py-2 font-mono">
              <thead>
                <tr className="border-b">
                  <th className="py-1">الصنف</th>
                  <th className="py-1">الكمية</th>
                  <th className="py-1">السعر</th>
                  <th className="py-1 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lastInvoice.lines?.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1 font-bold">{l.product_name}</td>
                    <td className="py-1">{l.weight_kg}</td>
                    <td className="py-1">{l.unit_price}</td>
                    <td className="py-1 text-left font-bold">{l.total_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right text-xs space-y-1 font-mono font-bold">
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span>{parseFloat(lastInvoice.subtotal || 0).toFixed(2)} ج.م</span>
              </div>
              {parseFloat(lastInvoice.delivery_fee || 0) > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>م.توصيل:</span>
                  <span>+{parseFloat(lastInvoice.delivery_fee).toFixed(2)} ج.م</span>
                </div>
              )}
              {parseFloat(lastInvoice.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>-{parseFloat(lastInvoice.discount_amount).toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black border-t pt-1">
                <span>اجمالي المطلوب:</span>
                <span>{parseFloat(lastInvoice.total_amount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1">
                <span>المدفوع:</span>
                <span>{parseFloat(lastPaidAmount || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-amber-800 font-black">
                <span>الباقي للعميل:</span>
                <span>{parseFloat(lastChangeDue || 0).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] text-slate-500 font-bold mb-3">نتشرف بخدمتكم دائماً ✨</p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة الفيشة (F2)</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
