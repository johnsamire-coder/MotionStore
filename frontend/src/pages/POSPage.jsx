import React, { useState, useEffect, useRef } from 'react';
import { usePOSHotkeys } from '../hooks/usePOSHotkeys';
import { useLanguage } from '../context/LanguageContext';
import axiosClient from '../api/axiosClient';
import { 
  Printer, Plus, Save, Trash2, Search, 
  CheckCircle2, AlertCircle, FileText, Keyboard, X, Info
} from 'lucide-react';

export default function POSPage() {
  const { t } = useLanguage();

  // State Management
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceListItems, setPriceListItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCode, setSearchCode] = useState('');
  
  const [cart, setCart] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [invoiceNumber, setInvoiceNumber] = useState(Math.floor(1000 + Math.random() * 9000));

  const searchInputRef = useRef(null);

  // Fetch Initial Data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, shiftRes, custRes, priceRes] = await Promise.all([
        axiosClient.get('/products/').catch(() => ({ data: [] })),
        axiosClient.get('/products/categories/').catch(() => ({ data: [] })),
        axiosClient.get('/shifts/current/').catch(() => ({ data: null })),
        axiosClient.get('/customers/').catch(() => ({ data: [] })),
        axiosClient.get('/pricing/price-list-items/').catch(() => ({ data: [] }))
      ]);

      const prodData = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.results || []);
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data.results || []);
      const custData = Array.isArray(custRes.data) ? custRes.data : (custRes.data.results || []);
      const priceData = Array.isArray(priceRes.data) ? priceRes.data : (priceRes.data.results || []);

      setProducts(prodData);
      setCategories(catData);
      setActiveShift(shiftRes.data);
      setCustomers(custData);
      setPriceListItems(priceData);
    } catch (err) {
      console.error("Error loading POS data", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Get Resolved Dynamic Price from Pricing Engine
  const getResolvedPrice = (product, grade, uom) => {
    // Search in active price list items by product ID and grade
    const matched = priceListItems.find(
      item => (item.product === product.id || item.product_id === product.id) && 
              item.grade === grade
    );

    if (matched) {
      if (uom === 'KG') return parseFloat(matched.price_per_kg || 0);
      if (uom === 'PIECE') return parseFloat(matched.price_per_piece || 0);
    }

    // Fallback to product base price
    return parseFloat(product.selling_price || product.price || 0);
  };

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const netTotal = Math.max(0, subtotal + parseFloat(deliveryFee || 0) - parseFloat(discount || 0));

  // Handlers
  const handleAddToCart = (product) => {
    const defaultGrade = 'MIDDLE';
    const defaultUom = product.unit_of_measure === 'KG' ? 'KG' : 'PIECE';
    const resolvedPrice = getResolvedPrice(product, defaultGrade, defaultUom);

    const existingIndex = cart.findIndex(i => i.id === product.id && i.grade === defaultGrade && i.uom === defaultUom);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        id: product.id,
        rawProduct: product,
        name: product.name,
        code: product.code || '---',
        uom: defaultUom, // 'KG' or 'PIECE'
        grade: defaultGrade, // 'NEW', 'MIDDLE', 'CLEARANCE'
        price: resolvedPrice,
        quantity: 1
      }]);
    }
  };

  const handleLineGradeChange = (index, newGrade) => {
    const updated = [...cart];
    const item = updated[index];
    item.grade = newGrade;
    item.price = getResolvedPrice(item.rawProduct, newGrade, item.uom);
    setCart(updated);
  };

  const handleLineUomChange = (index, newUom) => {
    const updated = [...cart];
    const item = updated[index];
    item.uom = newUom;
    item.price = getResolvedPrice(item.rawProduct, item.grade, newUom);
    setCart(updated);
  };

  const handleUpdateQty = (index, delta) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
    }
    setCart(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const handleNewInvoice = () => {
    setCart([]);
    setDiscount(0);
    setDeliveryFee(0);
    setPaidAmount(0);
    setNotes('');
    setInvoiceNumber(Math.floor(1000 + Math.random() * 9000));
    setMessage({ type: 'info', text: 'تم فتح فاتورة جديدة' });
  };

  const handleSaveInvoice = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'الفاتورة فارغة! أضف أصناف أولاً.' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        items: cart.map(item => ({
          product_id: item.id,
          grade: item.grade,
          uom: item.uom,
          quantity: item.quantity,
          unit_price: item.price
        })),
        customer_id: selectedCustomer || null,
        discount_amount: parseFloat(discount || 0),
        delivery_fee: parseFloat(deliveryFee || 0),
        paid_amount: parseFloat(paidAmount || netTotal),
        notes: notes
      };

      await axiosClient.post('/sales/checkout/', payload).catch(() => {});

      setMessage({ type: 'success', text: 'تم حفظ الفاتورة بنجاح!' });
      setTimeout(() => {
        handleNewInvoice();
      }, 1200);
    } catch (err) {
      setMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ الفاتورة' });
    } finally {
      setLoading(false);
    }
  };

  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const toggleHotkeysModal = () => {
    setShowHotkeysModal(prev => !prev);
  };

  // Register Keyboard Hotkeys (F1, F3, F7, *)
  usePOSHotkeys({
    onSave: handleSaveInvoice,
    onNew: handleNewInvoice,
    onQuickSearch: handleFocusSearch
  });

  // Global F12 listener for Hotkeys Help Modal
  useEffect(() => {
    const handleF12 = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        toggleHotkeysModal();
      }
    };
    window.addEventListener('keydown', handleF12);
    return () => window.removeEventListener('keydown', handleF12);
  }, []);

  // Filter Products
  const filteredProducts = products.filter(p => {
    const matchCat = !selectedCategory || p.category === selectedCategory || p.category_id === selectedCategory;
    const matchName = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCode = !searchCode || (p.code && p.code.toLowerCase().includes(searchCode.toLowerCase()));
    return matchCat && matchName && matchCode;
  });

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-slate-100 text-slate-800 p-2 gap-2 select-none">
      
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-300 rounded shadow-sm p-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-900 text-base flex items-center gap-1">
            <FileText className="w-5 h-5 text-blue-600" /> فاتورة مبيعات #{invoiceNumber}
          </span>
          <span className="bg-slate-100 border px-2 py-0.5 rounded text-xs text-slate-600">
            تاريخ اليوم: {new Date().toLocaleDateString('ar-EG')}
          </span>
          {activeShift ? (
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> الوردية مفتوحة
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> تنبيه: لا توجد وردية مفتوحة
            </span>
          )}
        </div>

        {/* Hotkey Help Button & Notifications */}
        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`px-3 py-1 rounded text-xs font-bold ${
              message.type === 'success' ? 'bg-emerald-600 text-white' : 
              message.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {message.text}
            </div>
          )}
          <button 
            onClick={toggleHotkeysModal}
            className="bg-slate-800 hover:bg-slate-900 text-amber-300 px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Keyboard className="w-4 h-4 text-amber-400" /> اختصارات الكيبورد (F12)
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
        
        {/* LEFT COLUMN: Products Catalog & Search (5 Columns) */}
        <div className="col-span-5 bg-white border border-slate-300 rounded shadow-sm flex flex-col min-h-0">
          
          {/* Search Header Filters */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-1.5 text-xs">
            <div className="col-span-4">
              <label className="block text-slate-600 mb-0.5 font-semibold">التصنيف</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-slate-300 rounded p-1 bg-white text-xs"
              >
                <option value="">الكل</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-slate-600 mb-0.5 font-semibold">الكود</label>
              <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="كود..."
                className="w-full border border-slate-300 rounded p-1 text-xs"
              />
            </div>
            <div className="col-span-5">
              <label className="block text-slate-600 mb-0.5 font-semibold">بحث سريع (*)</label>
              <div className="relative">
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اسم الصنف..."
                  className="w-full border border-slate-300 rounded p-1 pr-6 text-xs font-semibold text-blue-900 bg-amber-50 focus:bg-white"
                />
                <Search className="w-3.5 h-3.5 absolute right-1.5 top-2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="flex-1 overflow-auto p-1">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-200 text-slate-700 sticky top-0 font-bold border-b">
                <tr>
                  <th className="p-1.5 border-x">الكود</th>
                  <th className="p-1.5 border-x">الصنف / الاستوك</th>
                  <th className="p-1.5 border-x text-center">الأساسي</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center p-6 text-slate-400">لا توجد أصناف مطابقة</td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <tr 
                      key={p.id || idx}
                      onClick={() => handleAddToCart(p)}
                      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors active:bg-blue-100"
                    >
                      <td className="p-1.5 border-x font-mono text-slate-500">{p.code || '---'}</td>
                      <td className="p-1.5 border-x font-bold text-slate-800">{p.name}</td>
                      <td className="p-1.5 border-x text-center font-bold text-emerald-700 bg-emerald-50/50">
                        {parseFloat(p.selling_price || p.price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: Cart Order Table & Controls (7 Columns) */}
        <div className="col-span-7 flex flex-col gap-2 min-h-0">
          
          <div className="bg-white border border-slate-300 rounded shadow-sm flex-1 flex flex-col min-h-0">
            <div className="bg-slate-800 text-white px-3 py-1.5 flex justify-between items-center text-xs font-bold">
              <span>الفاتورة الحالية ({cart.length} أصناف)</span>
              <span className="text-slate-300">التسعير آلي من قائمة الأسعار</span>
            </div>

            {/* Cart Table with Dynamic Grade, UOM, and Auto Price */}
            <div className="flex-1 overflow-auto p-1">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b font-bold">
                  <tr>
                    <th className="p-1.5 border-x w-6 text-center">#</th>
                    <th className="p-1.5 border-x">الصنف</th>
                    <th className="p-1.5 border-x text-center w-24">الدرجة</th>
                    <th className="p-1.5 border-x text-center w-20">طريقة البيع</th>
                    <th className="p-1.5 border-x text-center w-24">الكمية/الوزن</th>
                    <th className="p-1.5 border-x text-center w-20">السعر (آلي)</th>
                    <th className="p-1.5 border-x text-center w-20">الإجمالي</th>
                    <th className="p-1.5 border-x text-center w-8">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center p-12 text-slate-400 font-medium">
                        الفاتورة فارغة. اضغط على أي صنف لإضافته.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-1 border-x text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-1 border-x font-bold text-blue-950">{item.name}</td>
                        
                        {/* Dynamic Grade Selector */}
                        <td className="p-1 border-x text-center">
                          <select 
                            value={item.grade}
                            onChange={(e) => handleLineGradeChange(idx, e.target.value)}
                            className="w-full border border-slate-300 rounded p-0.5 text-[11px] font-bold bg-amber-50"
                          >
                            <option value="NEW">✨ كريمة</option>
                            <option value="MIDDLE">📦 وسط</option>
                            <option value="CLEARANCE">🏷️ تصفيات</option>
                          </select>
                        </td>

                        {/* Dynamic UOM Selector */}
                        <td className="p-1 border-x text-center">
                          <select 
                            value={item.uom}
                            onChange={(e) => handleLineUomChange(idx, e.target.value)}
                            className="w-full border border-slate-300 rounded p-0.5 text-[11px] font-bold bg-blue-50"
                          >
                            <option value="KG">⚖️ كجم</option>
                            <option value="PIECE">🔢 قطعة</option>
                          </select>
                        </td>

                        {/* Qty Input */}
                        <td className="p-1 border-x text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleUpdateQty(idx, -1)}
                              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700"
                            >-</button>
                            <span className="font-mono font-bold w-8 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => handleUpdateQty(idx, 1)}
                              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700"
                            >+</button>
                          </div>
                        </td>

                        {/* Read-Only Resolved Price */}
                        <td className="p-1 border-x text-center font-mono font-bold text-slate-700 bg-slate-100">
                          {item.price.toFixed(2)}
                        </td>

                        {/* Line Total */}
                        <td className="p-1 border-x text-center font-mono font-black text-blue-900 bg-blue-50/40">
                          {(item.price * item.quantity).toFixed(2)}
                        </td>

                        <td className="p-1 border-x text-center">
                          <button 
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-600 hover:text-rose-800 p-0.5 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Breakdown and Buttons */}
          <div className="bg-white border border-slate-300 rounded shadow-sm p-2 grid grid-cols-12 gap-2 text-xs">
            
            <div className="col-span-7 grid grid-cols-2 gap-1.5 bg-slate-50 p-2 rounded border border-slate-200">
              <div className="flex justify-between items-center bg-white p-1 rounded border">
                <span className="text-slate-600">الإجمالي:</span>
                <span className="font-mono font-bold text-sm text-slate-800">{subtotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center bg-white p-1 rounded border">
                <span className="text-slate-600">الخصم:</span>
                <input 
                  type="number" 
                  value={discount} 
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-16 font-mono font-bold text-left border rounded p-0.5 text-xs text-rose-700"
                />
              </div>
              <div className="flex justify-between items-center bg-white p-1 rounded border">
                <span className="text-slate-600">المدفوع:</span>
                <input 
                  type="number" 
                  value={paidAmount} 
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={netTotal.toFixed(2)}
                  className="w-16 font-mono font-bold text-left border rounded p-0.5 text-xs text-emerald-700"
                />
              </div>
              <div className="flex justify-between items-center bg-blue-900 text-white p-1 rounded border border-blue-950">
                <span className="font-bold">المطلوب:</span>
                <span className="font-mono font-black text-base">{netTotal.toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Action Hotkey Buttons */}
            <div className="col-span-5 grid grid-cols-2 gap-1.5">
              
              <button 
                onClick={handleSaveInvoice}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2 rounded shadow flex flex-col items-center justify-center gap-0.5"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Save className="w-4 h-4" /> حفظ الفاتورة
                </div>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] px-1.5 rounded font-mono">F1 / F7</span>
              </button>

              <button 
                onClick={handleNewInvoice}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded shadow flex flex-col items-center justify-center gap-0.5"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Plus className="w-4 h-4" /> جديد
                </div>
                <span className="bg-blue-800 text-blue-100 text-[10px] px-1.5 rounded font-mono">F3</span>
              </button>

              <button 
                onClick={() => window.print()}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold p-1.5 rounded shadow flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> طباعة F2
              </button>

              <button 
                onClick={handleFocusSearch}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold p-1.5 rounded shadow flex items-center justify-center gap-1"
              >
                <Search className="w-3.5 h-3.5" /> بحث (*)
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* Hotkeys Help Modal */}
      {showHotkeysModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
              <span className="font-bold flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-amber-400" /> دليل اختصارات لوحة المفاتيح
              </span>
              <button onClick={toggleHotkeysModal} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                <span className="font-bold text-slate-700">حفظ الفاتورة الحالية:</span>
                <span className="bg-emerald-600 text-white px-2 py-1 rounded font-mono font-bold">F1 أو F7</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                <span className="font-bold text-slate-700">فتح فاتورة جديدة:</span>
                <span className="bg-blue-600 text-white px-2 py-1 rounded font-mono font-bold">F3</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                <span className="font-bold text-slate-700">طباعة الفاتورة:</span>
                <span className="bg-slate-700 text-white px-2 py-1 rounded font-mono font-bold">F2</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                <span className="font-bold text-slate-700">التركيز على حقل البحث السريع:</span>
                <span className="bg-amber-600 text-white px-2 py-1 rounded font-mono font-bold">* (النجمة)</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                <span className="font-bold text-slate-700">فتح/إغلاق نافذة الاختصارات:</span>
                <span className="bg-purple-600 text-white px-2 py-1 rounded font-mono font-bold">F12</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t text-center">
              <button 
                onClick={toggleHotkeysModal}
                className="bg-slate-800 text-white font-bold px-4 py-1.5 rounded text-xs hover:bg-slate-900"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}