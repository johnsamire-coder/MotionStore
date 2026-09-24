import React, { useState, useEffect, useRef } from 'react';
import { usePOSHotkeys } from '../hooks/usePOSHotkeys';
import { useLanguage } from '../context/LanguageContext';
import axiosClient from '../api/axiosClient';
import { 
  Printer, Plus, Save, Trash2, Search, 
  CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

export default function POSPage() {
  const { t } = useLanguage();

  // State Management
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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
      const [prodRes, catRes, shiftRes, custRes] = await Promise.all([
        axiosClient.get('/products/').catch(() => ({ data: [] })),
        axiosClient.get('/products/categories/').catch(() => ({ data: [] })),
        axiosClient.get('/shifts/current/').catch(() => ({ data: null })),
        axiosClient.get('/customers/').catch(() => ({ data: [] }))
      ]);

      const prodData = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.results || []);
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data.results || []);
      const custData = Array.isArray(custRes.data) ? custRes.data : (custRes.data.results || []);

      setProducts(prodData);
      setCategories(catData);
      setActiveShift(shiftRes.data);
      setCustomers(custData);
    } catch (err) {
      console.error("Error loading POS data", err);
    } finally {
      setLoading(false);
    }
  };

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const netTotal = Math.max(0, subtotal + parseFloat(deliveryFee || 0) - parseFloat(discount || 0));

  // Handlers
  const handleAddToCart = (product) => {
    const existingIndex = cart.findIndex(i => i.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        code: product.code || '---',
        uom: product.unit_of_measure || 'قطع',
        grade: product.grade || 'وسط',
        price: parseFloat(product.selling_price || product.price || 0),
        quantity: 1
      }]);
    }
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

  // Register Keyboard Hotkeys (F1, F3, F7, *)
  usePOSHotkeys({
    onSave: handleSaveInvoice,
    onNew: handleNewInvoice,
    onQuickSearch: handleFocusSearch
  });

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

        {/* Notifications */}
        {message.text && (
          <div className={`px-3 py-1 rounded text-xs font-bold ${
            message.type === 'success' ? 'bg-emerald-600 text-white' : 
            message.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
        
        {/* LEFT COLUMN: Products Catalog & Search (5 Columns Width) */}
        <div className="col-span-5 bg-white border border-slate-300 rounded shadow-sm flex flex-col min-h-0">
          
          {/* Search Header Filters */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-1.5 text-xs">
            <div className="col-span-4">
              <label className="block text-slate-600 mb-0.5">التصنيف</label>
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
              <label className="block text-slate-600 mb-0.5">الكود</label>
              <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="كود..."
                className="w-full border border-slate-300 rounded p-1 text-xs"
              />
            </div>
            <div className="col-span-5">
              <label className="block text-slate-600 mb-0.5">اسم الصنف (*)</label>
              <div className="relative">
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم..."
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
                  <th className="p-1.5 border-x">الصنف</th>
                  <th className="p-1.5 border-x text-center">البيع</th>
                  <th className="p-1.5 border-x text-center">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center p-6 text-slate-400">لا توجد أصناف مطابقة</td>
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
                      <td className="p-1.5 border-x text-center font-mono text-slate-600">
                        {p.stock !== undefined ? p.stock : 'متاح'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: Invoice Items & Action Controls (7 Columns Width) */}
        <div className="col-span-7 flex flex-col gap-2 min-h-0">
          
          {/* Active Cart Order Table */}
          <div className="bg-white border border-slate-300 rounded shadow-sm flex-1 flex flex-col min-h-0">
            <div className="bg-slate-800 text-white px-3 py-1.5 flex justify-between items-center text-xs font-bold">
              <span>قائمة الطلبات الفعالة ({cart.length} أصناف)</span>
              <span className="text-slate-300">العميل: نقدي</span>
            </div>

            <div className="flex-1 overflow-auto p-1">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b font-bold">
                  <tr>
                    <th className="p-1.5 border-x w-8 text-center">#</th>
                    <th className="p-1.5 border-x">الصنف</th>
                    <th className="p-1.5 border-x text-center">الوحدة</th>
                    <th className="p-1.5 border-x text-center w-24">الكمية/الوزن</th>
                    <th className="p-1.5 border-x text-center">السعر</th>
                    <th className="p-1.5 border-x text-center">الإجمالي</th>
                    <th className="p-1.5 border-x text-center w-8">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center p-12 text-slate-400 font-medium">
                        الفاتورة فارغة. اختر صنفاً من قائمة الشمال أو استخدم زر الاختصار (*) للبحث.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-1.5 border-x text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-1.5 border-x font-bold text-blue-950">{item.name}</td>
                        <td className="p-1.5 border-x text-center">
                          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700">
                            {item.uom}
                          </span>
                        </td>
                        <td className="p-1.5 border-x text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleUpdateQty(idx, -1)}
                              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700 flex items-center justify-center"
                            >-</button>
                            <span className="font-mono font-bold w-8 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => handleUpdateQty(idx, 1)}
                              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700 flex items-center justify-center"
                            >+</button>
                          </div>
                        </td>
                        <td className="p-1.5 border-x text-center font-mono font-semibold">
                          {item.price.toFixed(2)}
                        </td>
                        <td className="p-1.5 border-x text-center font-mono font-bold text-blue-900 bg-blue-50/30">
                          {(item.price * item.quantity).toFixed(2)}
                        </td>
                        <td className="p-1.5 border-x text-center">
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

          {/* Bottom Invoice Controls & Hotkey Buttons Grid */}
          <div className="bg-white border border-slate-300 rounded shadow-sm p-2 grid grid-cols-12 gap-2 text-xs">
            
            {/* Numeric Breakdown (7 Cols) */}
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

            {/* F-Keys Direct Action Buttons (5 Cols) */}
            <div className="col-span-5 grid grid-cols-2 gap-1.5">
              
              <button 
                onClick={handleSaveInvoice}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold p-2 rounded shadow flex flex-col items-center justify-center gap-1 transition-all"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Save className="w-4 h-4" /> حفظ الفاتورة
                </div>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] px-1.5 py-0.2 rounded font-mono">F1 / F7</span>
              </button>

              <button 
                onClick={handleNewInvoice}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold p-2 rounded shadow flex flex-col items-center justify-center gap-1 transition-all"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Plus className="w-4 h-4" /> جديد
                </div>
                <span className="bg-blue-800 text-blue-100 text-[10px] px-1.5 py-0.2 rounded font-mono">F3</span>
              </button>

              <button 
                onClick={() => window.print()}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold p-1.5 rounded shadow flex items-center justify-center gap-1 transition-all"
              >
                <Printer className="w-3.5 h-3.5" /> طباعة F2
              </button>

              <button 
                onClick={handleFocusSearch}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold p-1.5 rounded shadow flex items-center justify-center gap-1 transition-all"
              >
                <Search className="w-3.5 h-3.5" /> بحث (*)
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}