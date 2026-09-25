import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { Truck, Plus, Save, Users, FileText, CheckCircle2, X, Package, ShoppingBag, Trash2 } from 'lucide-react';

export default function PurchasingPage() {
  const { t, isRTL } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showInvModal, setShowInvModal] = useState(false);
  const [showSupModal, setShowSupModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Invoice Mode
  const [invMode, setInvMode] = useState('BALE'); // BALE | STOCK

  // Forms
  const [supForm, setSupForm] = useState({ name: '', phone: '', company: '' });
  
  const [invForm, setInvForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    freight: '0.00',
    // Bale specific
    bale_content: '',
    bale_weight_type: '50',
    bale_custom_weight: '',
    bale_price: '',
    // Stock specific
    stock_items: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, supRes, whRes, prodRes] = await Promise.all([
        axiosClient.get('/purchases/'),
        axiosClient.get('/suppliers/'),
        axiosClient.get('/warehouses/'),
        axiosClient.get('/products/')
      ]);
      setInvoices(invRes.data.results || invRes.data || []);
      const sList = supRes.data.results || supRes.data || [];
      const wList = whRes.data.results || whRes.data || [];
      setSuppliers(sList);
      setWarehouses(wList);
      setProducts(prodRes.data.results || prodRes.data || []);
      
      if (sList.length > 0 && !invForm.supplier_id) invForm.supplier_id = sList[0].id;
      if (wList.length > 0 && !invForm.warehouse_id) invForm.warehouse_id = wList[0].id;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supForm.name.trim()) return;
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

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Build Payload dynamically based on mode
      const payload = {
        supplier_id: invForm.supplier_id,
        warehouse_id: invForm.warehouse_id,
        freight_cost: parseFloat(invForm.freight || 0),
        items: []
      };

      if (invMode === 'BALE') {
        const w = invForm.bale_weight_type === 'CUSTOM' ? parseFloat(invForm.bale_custom_weight || 0) : parseFloat(invForm.bale_weight_type);
        payload.items.push({
          product_id: null, // Raw Bale doesn't strictly tie to a finished product catalog item initially
          description: invForm.bale_content,
          quantity: 1,
          weight_kg: w,
          unit_price: parseFloat(invForm.bale_price || 0)
        });
      } else {
        payload.items = invForm.stock_items.map(item => ({
          product_id: item.product_id,
          quantity: parseFloat(item.qty || 1),
          weight_kg: parseFloat(item.qty || 1), // simplified
          unit_price: parseFloat(item.price || 0)
        }));
      }

      await axiosClient.post('/purchases/', payload);
      setSuccessMsg(t('purchasing.invoiceSuccess'));
      setShowInvModal(false);
      setInvForm({ ...invForm, bale_content: '', bale_price: '', bale_custom_weight: '', stock_items: [] });
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

  const totalProcurement = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

  return (
    <div className="space-y-6 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Truck className="text-emerald-600" size={22} />
            {t('purchasing.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('purchasing.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSupModal(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
            <Users size={14}/> {t('purchasing.newSupplier')}
          </button>
          <button onClick={() => setShowInvModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow">
            <Plus size={14}/> {t('purchasing.newInvoice')}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="text-emerald-600" size={18} /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs text-slate-500 font-bold">{t('purchasing.totalProcurement')}</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{totalProcurement.toFixed(2)} {t('common.currency')}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs text-slate-500 font-bold">{t('purchasing.registeredSuppliers')}</span>
          <div className="text-2xl font-black text-blue-900 mt-1">{suppliers.length}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-right text-xs">
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
                <td className="p-3 text-rose-600">{parseFloat(inv.freight_cost || 0).toFixed(2)}</td>
                <td className="p-3 font-black text-emerald-700 text-sm">{parseFloat(inv.total_amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: NEW INVOICE */}
      {showInvModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveInvoice} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800">
              <span className="flex items-center gap-1.5"><FileText size={18}/> {t('purchasing.modalInvTitle')}</span>
              <button type="button" onClick={() => setShowInvModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full">
              <button type="button" onClick={() => setInvMode('BALE')} className={`flex-1 py-2 rounded-lg text-xs font-black transition flex justify-center items-center gap-1 ${invMode === 'BALE' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                <Package size={14}/> {t('purchasing.baleMode')}
              </button>
              <button type="button" onClick={() => setInvMode('STOCK')} className={`flex-1 py-2 rounded-lg text-xs font-black transition flex justify-center items-center gap-1 ${invMode === 'STOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                <ShoppingBag size={14}/> {t('purchasing.stockMode')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.selectSupplier')}</label>
                <select value={invForm.supplier_id} onChange={e => setInvForm({...invForm, supplier_id: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" required>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.selectWarehouse')}</label>
                <select value={invForm.warehouse_id} onChange={e => setInvForm({...invForm, warehouse_id: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold" required>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type})</option>)}
                </select>
              </div>
            </div>

            {/* BALE MODE UI */}
            {invMode === 'BALE' && (
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.baleContent')}</label>
                  <input type="text" value={invForm.bale_content} onChange={e => setInvForm({...invForm, bale_content: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.baleWeight')}</label>
                    <div className="flex gap-2">
                      <select value={invForm.bale_weight_type} onChange={e => setInvForm({...invForm, bale_weight_type: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold">
                        <option value="40">{t('purchasing.w40')}</option>
                        <option value="45">{t('purchasing.w45')}</option>
                        <option value="50">{t('purchasing.w50')}</option>
                        <option value="80">{t('purchasing.w80')}</option>
                        <option value="100">{t('purchasing.w100')}</option>
                        <option value="CUSTOM">{t('purchasing.customWeight')}</option>
                      </select>
                      {invForm.bale_weight_type === 'CUSTOM' && (
                        <input type="number" step="0.5" placeholder="KG" value={invForm.bale_custom_weight} onChange={e => setInvForm({...invForm, bale_custom_weight: e.target.value})} className="w-24 bg-white border rounded-lg p-2.5 text-xs font-bold text-center" required />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.balePrice')}</label>
                    <input type="number" step="0.01" value={invForm.bale_price} onChange={e => setInvForm({...invForm, bale_price: e.target.value})} className="w-full bg-white border border-emerald-300 rounded-lg p-2.5 text-sm font-black text-emerald-900" required />
                  </div>
                </div>
              </div>
            )}

            {/* STOCK MODE UI */}
            {invMode === 'STOCK' && (
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">قائمة أصناف الاستوك</span>
                  <button type="button" onClick={addStockItem} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded shadow">+ {t('purchasing.addProduct')}</button>
                </div>
                {invForm.stock_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                    <select value={item.product_id} onChange={e => updateStockItem(idx, 'product_id', e.target.value)} className="flex-1 bg-transparent border-0 outline-none text-xs font-bold">
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" placeholder={t('purchasing.qty')} value={item.qty} onChange={e => updateStockItem(idx, 'qty', e.target.value)} className="w-16 border rounded p-1 text-xs text-center" />
                    <input type="number" step="0.01" placeholder={t('purchasing.unitPrice')} value={item.price} onChange={e => updateStockItem(idx, 'price', e.target.value)} className="w-20 border rounded p-1 text-xs text-center font-bold text-blue-800" />
                    <button type="button" onClick={() => removeStockItem(idx)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow transition">
              {saving ? t('purchasing.saving') : t('purchasing.saveInvoice')}
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
              <button type="button" onClick={() => setShowSupModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierName')}</label>
                <input type="text" value={supForm.name} onChange={e => setSupForm({...supForm, name: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs font-bold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierPhone')}</label>
                <input type="text" value={supForm.phone} onChange={e => setSupForm({...supForm, phone: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('purchasing.supplierCompany')}</label>
                <input type="text" value={supForm.company} onChange={e => setSupForm({...supForm, company: e.target.value})} className="w-full bg-slate-50 border rounded-lg p-2.5 text-xs" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-black text-sm transition">
              {saving ? t('purchasing.saving') : t('purchasing.saveSupplier')}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
