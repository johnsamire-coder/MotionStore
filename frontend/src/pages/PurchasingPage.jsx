import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { 
  Truck, 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  PackagePlus, 
  Building2, 
  DollarSign, 
  Scale, 
  X, 
  Calendar,
  Layers,
  Clock
} from 'lucide-react';

export default function PurchasingPage() {
  // Data States
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Invoice Form States
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState('0.00');
  
  // Line Item States
  const [itemDescription, setItemDescription] = useState('Grade A European Apparel Bale');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [weightKg, setWeightKg] = useState('100.000');
  const [estimatedPieces, setEstimatedPieces] = useState('');
  const [totalCost, setTotalCost] = useState('10000.00');

  // New Supplier Form States
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCode, setNewSupplierCode] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierTax, setNewSupplierTax] = useState('');

  useEffect(() => {
    loadPurchasingData();
  }, []);

  const loadPurchasingData = async () => {
    setLoading(true);
    try {
      // 1. Load Purchase Invoices
      const invRes = await axiosClient.get('/purchases/');
      setInvoices(invRes.data.results || invRes.data || []);

      // 2. Load Suppliers
      const supRes = await axiosClient.get('/suppliers/?is_active=true');
      const supList = supRes.data.results || supRes.data || [];
      setSuppliers(supList);
      if (supList.length > 0) setSelectedSupplier(supList[0].id);

      // 3. Load Warehouses
      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      const whList = whRes.data.results || whRes.data || [];
      setWarehouses(whList);
      const sortingWh = whList.find(w => w.warehouse_type === 'SORTING') || whList[0];
      if (sortingWh) setSelectedWarehouse(sortingWh.id);

      // 4. Load Categories
      const catRes = await axiosClient.get('/categories/?is_active=true');
      const catList = catRes.data.results || catRes.data || [];
      setCategories(catList);
      if (catList.length > 0) setSelectedCategory(catList[0].id);

      // Set random invoice code preview
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
      setInvoiceNumber(`PINV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (err) {
      console.error("Failed to load purchasing data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Create Purchase Invoice & Bale Line
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedWarehouse) {
      alert("Please select supplier and warehouse.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create Purchase Invoice
      const invRes = await axiosClient.post('/purchases/', {
        supplier: selectedSupplier,
        warehouse: selectedWarehouse,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        status: 'CONFIRMED',
        additional_costs: parseFloat(additionalCosts || 0).toFixed(2),
        notes: `Raw bale procurement - ${itemDescription}`
      });

      const invoiceId = invRes.data.id;
      const parsedWeight = parseFloat(weightKg || 0);
      const parsedCost = parseFloat(totalCost || 0);
      const unitCost = parsedWeight > 0 ? (parsedCost / parsedWeight).toFixed(2) : '0.00';

      // 2. Create Bale Line Item
      await axiosClient.post('/purchase-line-items/', {
        invoice: invoiceId,
        item_type: 'RAW_BALE',
        description: itemDescription,
        category: selectedCategory || null,
        weight_kg: parsedWeight.toFixed(3),
        quantity_pieces: estimatedPieces ? parseInt(estimatedPieces) : null,
        unit_cost: unitCost,
        total_cost: parsedCost.toFixed(2)
      });

      // 3. Automatically Create Raw Lot for Sorting Hub
      const lotCode = `BALE-${invoiceNumber.replace('PINV-', '')}`;
      await axiosClient.post('/raw-lots/', {
        lot_code: lotCode,
        purchase_invoice: invoiceId,
        supplier: selectedSupplier,
        warehouse: selectedWarehouse,
        category: selectedCategory || null,
        original_weight_kg: parsedWeight.toFixed(3),
        original_quantity_pieces: estimatedPieces ? parseInt(estimatedPieces) : null,
        purchase_cost: parsedCost.toFixed(2),
        status: 'RECEIVED',
        received_date: invoiceDate,
        notes: `Procured bale ready for sorting`
      });

      alert(`Purchase Invoice & Raw Bale Lot #${lotCode} created and ready in Sorting Hub!`);
      setShowNewInvoiceModal(false);
      loadPurchasingData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create purchase invoice. Check unique invoice number.");
    } finally {
      setSubmitting(false);
    }
  };

  // Create Quick Supplier
  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierName) return;
    setSubmitting(true);
    try {
      const res = await axiosClient.post('/suppliers/', {
        name: newSupplierName,
        code: newSupplierCode || `SUP-${Date.now().toString().slice(-4)}`,
        phone: newSupplierPhone || null,
        tax_number: newSupplierTax || null
      });
      setSuppliers([...suppliers, res.data]);
      setSelectedSupplier(res.data.id);
      setShowNewSupplierModal(false);
      setNewSupplierName('');
      setNewSupplierCode('');
      setNewSupplierPhone('');
      setNewSupplierTax('');
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalPurchasesCost = invoices.reduce((acc, i) => acc + parseFloat(i.total_cost || 0), 0);
  const totalInvoicesCount = invoices.length;

  // Filtered List
  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading Purchasing & Bale Invoices...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Purchasing & Raw Bale Procurement</h2>
          <p className="text-sm text-slate-500">Raw Bale Intake, Precision Weight Invoicing, Freight Absorption, and Supplier Registry</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewSupplierModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Building2 size={16} className="text-slate-500" /> New Supplier
          </button>
          <button
            onClick={() => setShowNewInvoiceModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus size={16} /> New Bale Purchase
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Procurement Cost</span>
          <div className="text-2xl font-black text-slate-900">{totalPurchasesCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">EGP</span></div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium">
            <DollarSign size={13} className="text-emerald-600" /> Across {totalInvoicesCount} purchase invoices
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Registered Suppliers</span>
          <div className="text-2xl font-black text-indigo-600">{suppliers.length} <span className="text-xs font-normal text-slate-500">Vendors</span></div>
          <p className="text-xs text-indigo-700 mt-2 font-medium">
            Active Verified Exporters
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Receiving Warehouses</span>
          <div className="text-2xl font-black text-amber-600">{warehouses.length} <span className="text-xs font-normal text-slate-500">Hubs</span></div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Sorting & Storage Areas
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost Absorption Engine</span>
          <div className="text-2xl font-black text-emerald-600">Active <span className="text-xs font-normal text-slate-500">100%</span></div>
          <p className="text-xs text-emerald-700 mt-2 font-medium">
            Additional Freight Allocated
          </p>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Purchase Invoices Registry</span>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice # or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">Invoice # & Date</th>
                <th className="py-3.5 px-5">Supplier</th>
                <th className="py-3.5 px-5">Receiving Hub</th>
                <th className="py-3.5 px-5 text-right">Freight Costs</th>
                <th className="py-3.5 px-5 text-right">Total Purchase Cost</th>
                <th className="py-3.5 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900 text-sm">{inv.invoice_number}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={12} /> {inv.invoice_date}
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-semibold text-slate-800">{inv.supplier_name || 'Global Vendor'}</div>
                  </td>
                  <td className="py-4 px-5 text-slate-600">{inv.warehouse_name || 'Sorting Center'}</td>
                  <td className="py-4 px-5 text-right font-mono text-slate-500">
                    +{parseFloat(inv.additional_costs || 0).toFixed(2)} EGP
                  </td>
                  <td className="py-4 px-5 text-right font-bold text-slate-900 text-sm">
                    {parseFloat(inv.total_cost || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-500">EGP</span>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 text-xs">
                    No purchase invoices found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: New Purchase Invoice */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PackagePlus size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">New Raw Bale Purchase Invoice</h3>
              </div>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              {/* Invoice & Supplier Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Supplier / Vendor</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code || 'Vendor'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Receiving Warehouse Hub</label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Bale Line Item Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Raw Bale Physical & Cost Specification
                </span>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Item / Bale Description</label>
                  <input
                    type="text"
                    required
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Total Weight (KG)</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Est. Pieces (Optional)</label>
                    <input
                      type="number"
                      value={estimatedPieces}
                      onChange={(e) => setEstimatedPieces(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. 100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Base Cost (EGP)</label>
                    <input
                      type="number"
                      step="10"
                      required
                      value={totalCost}
                      onChange={(e) => setTotalCost(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Freight & Customs Additional Cost (EGP)</label>
                  <input
                    type="number"
                    step="10"
                    value={additionalCosts}
                    onChange={(e) => setAdditionalCosts(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-500">Net Invoice Cost:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {(parseFloat(totalCost || 0) + parseFloat(additionalCosts || 0)).toFixed(2)} EGP
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Creating Invoice & Raw Lot...' : 'Confirm Purchase & Generate Raw Bale Lot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Quick Supplier */}
      {showNewSupplierModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 size={18} className="text-emerald-600" /> Add New Supplier
              </h3>
              <button onClick={() => setShowNewSupplierModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Vintage Italian Exporters"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Code / Prefix</label>
                  <input
                    type="text"
                    value={newSupplierCode}
                    onChange={(e) => setNewSupplierCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. SUP-IT"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="+20..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tax / Registration #</label>
                <input
                  type="text"
                  value={newSupplierTax}
                  onChange={(e) => setNewSupplierTax(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  placeholder="TAX-XXXXXX"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition mt-2 shadow-md shadow-emerald-600/20"
              >
                Save Supplier
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
