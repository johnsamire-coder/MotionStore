import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import ExportButtons from '../components/ExportButtons';
import SupplierStatement from '../components/SupplierStatement';
import PurchaseInvoiceForm from '../components/PurchaseInvoiceForm';
import { useLanguage } from '../context/LanguageContext';
import { Truck, Plus, Save, Users, FileText, CheckCircle2, X, Package, ShoppingBag, Trash2, ShoppingCart, Tag, Search } from 'lucide-react';

export default function PurchasingPage() {
  const { t, isRTL } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSupStatement, setShowSupStatement] = useState(false);

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
      if (e.key === 'F3') { e.preventDefault(); setShowInvModal(true); }
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

  const totalProcurement = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_cost || inv.total_amount || 0), 0);

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

  const KIND_WORDS = { BALE: 'بالة bale', STOCK: 'استوك stock', DIRECT: 'شراء مباشر direct أصناف خاصة' };
  const searchText = search.trim().toLowerCase();
  const filteredInvoices = !searchText ? invoices : invoices.filter((inv) => {
    const parts = [inv.invoice_number, inv.supplier_name, inv.warehouse_name, inv.notes];
    (inv.items || []).forEach((it) => {
      parts.push(it.description, it.bale_type, it.grade, it.segment, it.brand, it.item_name, it.extra_description, it.stock_type, KIND_WORDS[it.purchase_kind]);
    });
    return parts.filter(Boolean).join(' ').toLowerCase().includes(searchText);
  });

  const buildPurchaseReport = () => {
    const rows = filteredInvoices.map((inv) => ({
      no: inv.invoice_number,
      date: inv.invoice_date,
      supplier: inv.supplier_name || '—',
      warehouse: inv.warehouse_name || '—',
      details: (inv.items || []).map((it) => it.description).filter(Boolean).join(' | '),
      weight: (inv.items || []).reduce((a, it) => a + parseFloat(it.weight_kg || 0), 0),
      freight: parseFloat(inv.additional_costs || 0),
      total: parseFloat(inv.total_cost || 0)
    }));
    return {
      title: isRTL ? 'تقرير فواتير المشتريات' : 'Purchase Invoices Report',
      filename: 'purchases',
      filtersText: search,
      columns: [
        { key: 'no', header: isRTL ? 'رقم الفاتورة' : 'Invoice #', width: 22 },
        { key: 'date', header: isRTL ? 'التاريخ' : 'Date', width: 13 },
        { key: 'supplier', header: isRTL ? 'المورد' : 'Supplier', width: 22 },
        { key: 'warehouse', header: isRTL ? 'المخزن' : 'Warehouse', width: 20 },
        { key: 'details', header: isRTL ? 'التفاصيل' : 'Details', width: 45 },
        { key: 'weight', header: isRTL ? 'الوزن (كجم)' : 'Weight (KG)', type: 'number' },
        { key: 'freight', header: isRTL ? 'النقل' : 'Freight', type: 'money' },
        { key: 'total', header: isRTL ? 'الإجمالي' : 'Total', type: 'money' }
      ],
      rows,
      totals: {
        weight: rows.reduce((a, r) => a + r.weight, 0),
        freight: rows.reduce((a, r) => a + r.freight, 0),
        total: rows.reduce((a, r) => a + r.total, 0)
      }
    };
  };

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
        <button type="button" onClick={() => setShowSupStatement(true)} className="text-start bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition cursor-pointer">
          <span className="text-xs text-slate-500 font-bold block">{t('purchasing.registeredSuppliers')}</span>
          <div className="text-2xl font-black text-blue-900 mt-1">{suppliers.length}</div>
          <span className="text-xs text-emerald-700 font-bold mt-1 block">{isRTL ? 'اضغط لعرض كشف الموردين' : 'Click to view suppliers statement'}</span>
        </button>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={isRTL ? { right: 12 } : { left: 12 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث باسم المورد، رقم الفاتورة، نوع البالة، الدرجة، الصنف، البراند...' : 'Search by supplier, invoice #, bale type, grade, category, brand...'}
              className="w-full h-10 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500"
              style={isRTL ? { paddingRight: 36, paddingLeft: 12 } : { paddingLeft: 36, paddingRight: 12 }}
            />
          </div>
          <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
            {isRTL ? `عدد النتائج: ${filteredInvoices.length} من ${invoices.length}` : `Results: ${filteredInvoices.length} of ${invoices.length}`}
          </div>
          <ExportButtons getReport={buildPurchaseReport} />
        </div>
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
              {filteredInvoices.map(inv => (
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

      {showSupStatement && (<SupplierStatement suppliers={suppliers} invoices={invoices} onClose={() => setShowSupStatement(false)} />)}
      {/* MODAL: NEW INVOICE (v2 - bale / stock / direct) */}
      {showInvModal && (
        <PurchaseInvoiceForm
          suppliers={suppliers}
          warehouses={warehouses}
          onClose={() => setShowInvModal(false)}
          onAddSupplier={() => setShowSupModal(true)}
          onSaved={() => { setShowInvModal(false); setSuccessMsg(isRTL ? 'تم حفظ فاتورة الشراء وإرسالها للفرز' : 'Purchase invoice saved and sent to Sorting'); fetchData(); setTimeout(() => setSuccessMsg(''), 3000); }}
        />
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
