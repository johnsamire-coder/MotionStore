import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { Truck, Plus, Save, Users, FileText, CheckCircle2, X, Package, ShoppingBag, Trash2, ShoppingCart, Tag } from 'lucide-react';

export default function PurchasingPage() {
  const { t, isRTL } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showInvModal, setShowInvModal] = useState(false);
  const [showSupModal, setShowSupModal] = useState(false);
  const [showQuickProdModal, setShowQuickProdModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Invoice Mode: BALE | STOCK | DIRECT
  const [invMode, setInvMode] = useState('BALE');

  // Forms
  const [supForm, setSupForm] = useState({ name: '', phone: '', company: '' });
  
  const [quickProdForm, setQuickProdForm] = useState({
    name: '', code: '', category: '', unit_of_measure: 'PIECE'
  });

  const [invForm, setInvForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    freight_cost: '0.00',
    bale_category_id: '',
    bale_content_details: '',
    bale_weight_type: '50',
    bale_custom_weight: '',
    bale_price: '',
    stock_items: [],
    direct_items: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleShortcuts = (e) => {
      if (e.key === 'F2') { e.preventDefault(); setShowSupModal(true); } 
      else if (e.key === 'F3') { e.preventDefault(); setShowInvModal(true); }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, supRes, whRes, prodRes, catRes] = await Promise.all([
        axiosClient.get('/purchases/'),
        axiosClient.get('/suppliers/'),
        axiosClient.get('/warehouses/'),
        axiosClient.get('/products/'),
        axiosClient.get('/categories/')
      ]);
      setInvoices(invRes.data.results || invRes.data || []);
      const sList = supRes.data.results || supRes.data || [];
      const wList = whRes.data.results || whRes.data || [];
      const pList = prodRes.data.results || prodRes.data || [];
      const cList = catRes.data.results || catRes.data || [];

      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(pList);
      setCategories(cList);
      
      setInvForm(prev => ({
        ...prev,
        supplier_id: prev.supplier_id || (sList[0]?.id || ''),
        warehouse_id: prev.warehouse_id || (wList[0]?.id || ''),
        bale_category_id: prev.bale_category_id || (cList[0]?.id || '')
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const catName = prompt(isRTL ? 'أدخل اسم التصنيف الجديد (مثال: حريمي صيفي):' : 'Enter new category name:');
    if (catName && catName.trim()) {
      try {
        const res = await axiosClient.post('/categories/', { name: catName.trim() });
        setCategories([...categories, res.data]);
        setInvForm(prev => ({ ...prev, bale_category_id: res.data.id }));
        alert(isRTL ? 'تمت الإضافة بنجاح ✅' : 'Added successfully ✅');
      } catch (err) {
        alert(isRTL ? 'حدث خطأ' : 'Error adding category');
      }
    }
  };

  const handleSaveSupplier = async (e) => {
    if (e) e.preventDefault();
    if (!supForm.name.trim()) return alert(t('purchasing.supplierName') + ' required');

    setSaving(true);
    try {
      await axiosClient.post('/suppliers/', supForm);
      setSuccessMsg(t('purchasing.supplierSuccess'));
      setSupForm({ name: '', phone: '', company: '' });
      setShowSupModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(t('purchasing.errorSubmit'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuickProduct = async (e) => {
    if (e) e.preventDefault();
    if (!quickProdForm.name.trim() || !quickProdForm.category) {
      return alert(t('purchasing.productName') + ' & ' + t('purchasing.category'));
    }

    setSaving(true);
    try {
      const res = await axiosClient.post('/products/', quickProdForm);
      const newProd = res.data;
      
      setSuccessMsg(t('purchasing.productSuccess'));
      setQuickProdForm({ name: '', code: '', category: categories[0]?.id || '', unit_of_measure: 'PIECE' });
      setShowQuickProdModal(false);
      
      const updatedProducts = [...products, newProd];
      setProducts(updatedProducts);

      setInvForm(prev => ({
        ...prev,
        stock_items: [...prev.stock_items, { product_id: newProd.id, qty: 1, price: 0 }]
      }));

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(t('purchasing.errorSubmit'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoice = async (e) => {
    if (e) e.preventDefault();
    if (!invForm.supplier_id || !invForm.warehouse_id) {
      return alert(t('purchasing.selectSupplier') + ' / ' + t('purchasing.selectWarehouse'));
    }

    setSaving(true);
    try {
      const freight = parseFloat(invForm.freight_cost || 0);
      const payload = {
        supplier_id: invForm.supplier_id,
        warehouse_id: invForm.warehouse_id,
        freight_cost: freight,
        items: []
      };

      if (invMode === 'BALE') {
        const w = invForm.bale_weight_type === 'CUSTOM'
          ? parseFloat(invForm.bale_custom_weight || 0)
          : parseFloat(invForm.bale_weight_type);

        const selectedCat = categories.find(c => c.id === invForm.bale_category_id);
        const catName = selectedCat ? selectedCat.name : 'بالة عامة';
        const finalDesc = catName + (invForm.bale_content_details ? (' - ' + invForm.bale_content_details) : '');

        payload.items.push({
          product_id: null,
          category_id: invForm.bale_category_id,
          description: finalDesc,
          quantity: 1,
          weight_kg: w,
          unit_price: parseFloat(invForm.bale_price || 0)
        });
      } else if (invMode === 'STOCK') {
        payload.items = invForm.stock_items.map(item => {
          const pObj = products.find(p => p.id === item.product_id);
          return {
            product_id: item.product_id,
            category_id: pObj ? pObj.category : null,
            description: pObj ? pObj.name : 'استوك',
            quantity: parseFloat(item.qty || 1),
            weight_kg: parseFloat(item.qty || 1),
            unit_price: parseFloat(item.price || 0)
          };
        });
      } else if (invMode === 'DIRECT') {
        payload.items = invForm.direct_items.map(item => ({
          product_id: null,
          category_id: null,
          description: item.description || 'شراء مباشر',
          quantity: parseFloat(item.qty || 1),
          weight_kg: 0,
          unit_price: parseFloat(item.price || 0)
        }));
      }

      await axiosClient.post('/purchases/', payload);
      setSuccessMsg(t('purchasing.invoiceSuccess'));
      setShowInvModal(false);
      setInvForm({
        ...invForm,
        bale_content_details: '',
        bale_price: '',
        bale_custom_weight: '',
        freight_cost: '0.00',
        stock_items: [],
        direct_items: []
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(t('purchasing.errorSubmit'));
    } finally {
      setSaving(false);
    }
  };

  const addStockItem = () => {
    setInvForm(prev => ({
      ...prev,
      stock_items: [...prev.stock_items, { product_id: products[0]?.id || '', qty: 1, price: 0 }]
    }));
  };

  const updateStockItem = (index, field, val) => {
    const newItems = [...invForm.stock_items];
    newItems[index][field] = val;
    setInvForm(prev => ({ ...prev, stock_items: newItems }));
  };

  const removeStockItem = (index) => {
    const newItems = [...invForm.stock_items];
    newItems.splice(index, 1);
    setInvForm(prev => ({ ...prev, stock_items: newItems }));
  };

  const addDirectItem = () => {
    setInvForm(prev => ({
      ...prev,
      direct_items: [...prev.direct_items, { description: '', qty: 1, price: 0 }]
    }));
  };

  const updateDirectItem = (index, field, val) => {
    const newItems = [...invForm.direct_items];
    newItems[index][field] = val;
    setInvForm(prev => ({ ...prev, direct_items: newItems }));
  };

  const removeDirectItem = (index) => {
    const newItems = [...invForm.direct_items];
    newItems.splice(index, 1);
    setInvForm(prev => ({ ...prev, direct_items: newItems }));
  };

  const totalProcurement = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

  const calculateInvoiceSubtotal = () => {
    if (invMode === 'BALE') {
      return parseFloat(invForm.bale_price || 0);
    } else if (invMode === 'STOCK') {
      return invForm.stock_items.reduce((sum, i) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
    } else if (invMode === 'DIRECT') {
      return invForm.direct_items.reduce((sum, i) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0)), 0);
    }
    return 0;
  };

  const currentFreight = parseFloat(invForm.freight_cost || 0);
  const currentInvoiceTotal = calculateInvoiceSubtotal() + currentFreight;

  return (
    <div className="space-y-6 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Header & Action Buttons */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Truck className="text-emerald-600" size={22} />
            {t('purchasing.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('purchasing.subtitle')}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSupModal(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={14}/>
            <span>{t('purchasing.newSupplier')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowInvModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Plus size={14}/>
            <span>{t('purchasing.newInvoice')}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="text-emerald-600" size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs text-slate-500 font-bold block">{t('purchasing.totalProcurement')}</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{totalProcurement.toFixed(2)} {t('common.currency')}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs text-slate-500 font-bold block">{t('purchasing.registeredSuppliers')}</span>
          <div className="text-2xl font-black text-blue-900 mt-1">{suppliers.length}</div>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs" dir={isRTL ? 'rtl' : 'ltr'}>
            <thead className="bg-slate-100 text-slate-700 font-black border-y">
              <tr>
                <th className="p-3">{t('purchasing.colInvNumber')}</th>
                <th className="p-3">{t('purchasing.colSupplier')}</th>
                <th className="p-3">{t('purchasing.colHub')}</th>
                <th className="p-3">{t('purchasing.colFreight')}</th>
                <th className="p-3">{t('purchasing.colTotalCost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-600">{inv.invoice_number}</td>
                  <td className="p-3 font-black text-slate-900">{inv.supplier_name || '—'}</td>
                  <td className="p-3 font-bold text-slate-700">{inv.warehouse_name || '—'}</td>
                  <td className="p-3 text-rose-600 font-bold">+{parseFloat(inv.freight_cost || inv.additional_costs || 0).toFixed(2)} {t('common.currency')}</td>
                  <td className="p-3 font-black text-emerald-700 text-sm">{parseFloat(inv.total_amount || inv.total_cost || 0).toFixed(2)} {t('common.currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NEW INVOICE WITH 3 MODES & FREIGHT & QUICK PRODUCT CODING */}
      {showInvModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveInvoice} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800">
              <span className="flex items-center gap-1.5"><FileText size={18}/> {t('purchasing.modalInvTitle')}</span>
              <button type="button" onClick={() => setShowInvModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18}/></button>
            </div>

            {/* Mode Switcher: 3 Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full gap-1">
              <button
                type="button"
                onClick={() => setInvMode('BALE')}
                className={'flex-1 py-2 rounded-lg text-xs font-black transition flex justify-center items-center gap-1 cursor-pointer ' + (invMode === 'BALE' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200')}
              >
                <Package size={14}/>
                <span>{t('purchasing.baleMode')}</span>
              </button>

              <button
                type="button"
                onClick={() => setInvMode('STOCK')}
                className={'flex-1 py-2 rounded-lg text-xs font-black transition flex justify-center items-center gap-1 cursor-pointer ' + (invMode === 'STOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200')}
              >
                <ShoppingBag size={14}/>
                <span>{t('purchasing.stockMode')}</span>
              </button>

              <button
                type="button"
                onClick={() => setInvMode('DIRECT')}
                className={'flex-1 py-2 rounded-lg text-xs font-black transition flex justify-center items-center gap-1 cursor-pointer ' + (invMode === 'DIRECT' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200')}
              >
                <ShoppingCart size={14}/>
                <span>{t('purchasing.directMode')}</span>
              </button>
            </div>

            {/* Supplier & Receiving Warehouse */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.selectSupplier')}</label>
                <select
                  value={invForm.supplier_id}
                  onChange={e => setInvForm({...invForm, supplier_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                  required
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.selectWarehouse')}</label>
                <select
                  value={invForm.warehouse_id}
                  onChange={e => setInvForm({...invForm, warehouse_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
                  required
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type})</option>)}
                </select>
              </div>
            </div>

            {/* TAB 1: RAW BALE MODE */}
            {invMode === 'BALE' && (
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{isRTL ? 'تصنيف البالة *' : 'Bale Category *'}</label>
                    <div className="flex gap-2">
                      <select
                        value={invForm.bale_category_id}
                        onChange={e => setInvForm({...invForm, bale_category_id: e.target.value})}
                        className="flex-1 bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                        required
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-lg flex items-center justify-center transition cursor-pointer"
                        title="إضافة تصنيف جديد"
                      >
                        <Plus size={16}/>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{isRTL ? 'تفاصيل الإذون / العلامة' : 'Sub-details / Brand'}</label>
                    <input
                      type="text"
                      value={invForm.bale_content_details}
                      onChange={e => setInvForm({...invForm, bale_content_details: e.target.value})}
                      placeholder="مثال: صيفي ميكس أجهزة"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.baleWeight')}</label>
                    <div className="flex gap-2">
                      <select
                        value={invForm.bale_weight_type}
                        onChange={e => setInvForm({...invForm, bale_weight_type: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                      >
                        <option value="40">{t('purchasing.w40')}</option>
                        <option value="45">{t('purchasing.w45')}</option>
                        <option value="50">{t('purchasing.w50')}</option>
                        <option value="80">{t('purchasing.w80')}</option>
                        <option value="100">{t('purchasing.w100')}</option>
                        <option value="CUSTOM">{t('purchasing.customWeight')}</option>
                      </select>
                      {invForm.bale_weight_type === 'CUSTOM' && (
                        <input
                          type="number" step="0.5" placeholder="KG"
                          value={invForm.bale_custom_weight}
                          onChange={e => setInvForm({...invForm, bale_custom_weight: e.target.value})}
                          className="w-24 bg-white border rounded-lg p-2.5 text-xs font-bold text-center"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.balePrice')}</label>
                    <input
                      type="number" step="0.01" placeholder="0.00"
                      value={invForm.bale_price}
                      onChange={e => setInvForm({...invForm, bale_price: e.target.value})}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-2.5 text-sm font-black text-emerald-900"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CODED STOCK MODE */}
            {invMode === 'STOCK' && (
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-blue-900">{isRTL ? 'أصناف الاستوك المكودة المتاحة بالمشروع' : 'Available Coded Stock Items'}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickProdModal(true)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-black shadow cursor-pointer flex items-center gap-1"
                    >
                      <Tag size={12}/>
                      <span>{t('purchasing.quickCodeProduct')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={addStockItem}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg font-black shadow cursor-pointer"
                    >
                      {t('purchasing.addProduct')}
                    </button>
                  </div>
                </div>

                {invForm.stock_items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">{isRTL ? 'اضغط إضافة لاختيار أصناف' : 'Click Add to select items'}</p>
                ) : (
                  invForm.stock_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                      <select
                        value={item.product_id}
                        onChange={e => updateStockItem(idx, 'product_id', e.target.value)}
                        className="flex-1 bg-transparent border-0 outline-none text-xs font-bold text-slate-900"
                      >
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code || 'بدون كود'})</option>)}
                      </select>
                      <input
                        type="number" placeholder={t('purchasing.qty')}
                        value={item.qty}
                        onChange={e => updateStockItem(idx, 'qty', e.target.value)}
                        className="w-16 border rounded p-1 text-xs text-center font-bold"
                      />
                      <input
                        type="number" step="0.01" placeholder={t('purchasing.unitPrice')}
                        value={item.price}
                        onChange={e => updateStockItem(idx, 'price', e.target.value)}
                        className="w-20 border rounded p-1 text-xs text-center font-bold text-blue-800"
                      />
                      <button type="button" onClick={() => removeStockItem(idx)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"><Trash2 size={14}/></button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: DIRECT FREE PURCHASE MODE */}
            {invMode === 'DIRECT' && (
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-purple-900">{isRTL ? 'بنود الشراء المباشر الحر (بدون تكويد)' : 'Direct Free Purchase (Uncoded)'}</span>
                  <button
                    type="button"
                    onClick={addDirectItem}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg font-black shadow cursor-pointer"
                  >
                    {t('purchasing.addDirectItem')}
                  </button>
                </div>

                {invForm.direct_items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">{isRTL ? 'اضغط إضافة بند حر' : 'Click Add Free Item'}</p>
                ) : (
                  invForm.direct_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                      <input
                        type="text"
                        placeholder={t('purchasing.freeTextItem')}
                        value={item.description}
                        onChange={e => updateDirectItem(idx, 'description', e.target.value)}
                        className="flex-1 bg-transparent border-0 outline-none text-xs font-bold text-slate-900"
                      />
                      <input
                        type="number" placeholder={t('purchasing.qty')}
                        value={item.qty}
                        onChange={e => updateDirectItem(idx, 'qty', e.target.value)}
                        className="w-16 border rounded p-1 text-xs text-center font-bold"
                      />
                      <input
                        type="number" step="0.01" placeholder={t('purchasing.unitPrice')}
                        value={item.price}
                        onChange={e => updateDirectItem(idx, 'price', e.target.value)}
                        className="w-20 border rounded p-1 text-xs text-center font-bold text-purple-800"
                      />
                      <button type="button" onClick={() => removeDirectItem(idx)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"><Trash2 size={14}/></button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* FREIGHT COST FIELD IN ALL 3 MODES */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-0.5">{t('purchasing.freightCost')}</label>
                <span className="text-[10px] text-slate-400">{isRTL ? 'تُحمل وتضاف لتكلفة الفاتورة الإجمالية' : 'Absorbed into total invoice cost'}</span>
              </div>
              <input
                type="number" step="0.01" placeholder="0.00"
                value={invForm.freight_cost}
                onChange={e => setInvForm({...invForm, freight_cost: e.target.value})}
                className="w-32 bg-white border border-slate-300 rounded-lg p-2 text-xs font-black text-rose-600 text-center"
              />
            </div>

            {/* TOTAL NET COST SUMMARY */}
            <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs font-black text-slate-300">{t('purchasing.netTotalCalc')}</span>
              <span className="text-xl font-black text-emerald-400">{currentInvoiceTotal.toFixed(2)} {t('common.currency')}</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow transition cursor-pointer disabled:opacity-50"
            >
              {saving ? t('purchasing.saving') : t('purchasing.saveInvoice')}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: QUICK PRODUCT CODING TO GLOBAL CATALOG */}
      {showQuickProdModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <form onSubmit={handleSaveQuickProduct} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-emerald-300">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800">
              <span className="flex items-center gap-1.5 text-emerald-700"><Tag size={18}/> {t('purchasing.modalQuickProdTitle')}</span>
              <button type="button" onClick={() => setShowQuickProdModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18}/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.productName')}</label>
                <input
                  type="text"
                  placeholder={isRTL ? "مثال: تيشرت أوفر سايز زارا" : "e.g. Zara Oversize T-Shirt"}
                  value={quickProdForm.name}
                  onChange={e => setQuickProdForm({ ...quickProdForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.productCode')}</label>
                <input
                  type="text"
                  placeholder="SKU-1001"
                  value={quickProdForm.code}
                  onChange={e => setQuickProdForm({ ...quickProdForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.category')}</label>
                <select
                  value={quickProdForm.category}
                  onChange={e => setQuickProdForm({ ...quickProdForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.uom')}</label>
                <select
                  value={quickProdForm.unit_of_measure}
                  onChange={e => setQuickProdForm({ ...quickProdForm, unit_of_measure: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                >
                  <option value="PIECE">{isRTL ? 'قطعة / عدد' : 'Piece'}</option>
                  <option value="KG">{isRTL ? 'كيلو / كجم' : 'KG'}</option>
                  <option value="BOTH">{isRTL ? 'قطعة + وزن' : 'Piece + KG'}</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow transition cursor-pointer"
            >
              {saving ? t('purchasing.saving') : t('purchasing.saveProduct')}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: NEW SUPPLIER */}
      {showSupModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveSupplier} className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800">
              <span className="flex items-center gap-1.5"><Users size={18}/> {t('purchasing.modalSupTitle')}</span>
              <button type="button" onClick={() => setShowSupModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierName')}</label><input type="text" value={supForm.name} onChange={e => setSupForm({...supForm, name: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs font-bold" required /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierPhone')}</label><input type="text" value={supForm.phone} onChange={e => setSupForm({...supForm, phone: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierCompany')}</label><input type="text" value={supForm.company} onChange={e => setSupForm({...supForm, company: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs" /></div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-black text-sm transition cursor-pointer">{saving ? t('purchasing.saving') : t('purchasing.saveSupplier')}</button>
          </form>
        </div>
      )}

    </div>
  );
}
