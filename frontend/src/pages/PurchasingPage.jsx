import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Truck,
  Plus,
  Search,
  FileText,
  PackagePlus,
  Building2,
  DollarSign,
  X,
  Calendar,
  Sparkles,
  Printer,
  Share2,
  Ban,
  ShieldCheck,
  Eye,
  FileSpreadsheet,
  Download
} from 'lucide-react';

export default function PurchasingPage() {
  const { t, isRTL } = useLanguage();

  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState(null);
  const [selectedInvoiceForCancel, setSelectedInvoiceForCancel] = useState(null);
  const [managerPassword, setManagerPassword] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New Invoice Form States
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState('0.00');

  // Line Item States
  const balePresets = [
    'بالة ملابس أوروبية شتوي',
    'بالة ملابس أوروبية صيفي',
    'بالة ملابس أطفال شتوي',
    'بالة ملابس أطفال صيفي',
    'بالة أحذية أوروبية فاخرة',
    'بالة مفروشات وبياضات',
    'بالة ملابس حريمي سوبر لوكس',
    'بالة ملابس رجالي تصفيات',
    'بالة جاكيت ومعاطف ثقيلة',
    'بالة رياضية متنوعة'
  ];

  const [itemDescription, setItemDescription] = useState(balePresets[0]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [weightKg, setWeightKg] = useState('100.000');
  const [estimatedPieces, setEstimatedPieces] = useState('');
  const [totalCost, setTotalCost] = useState('10000.00');

  // New Supplier Form States
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierTax, setNewSupplierTax] = useState('');

  useEffect(() => {
    loadPurchasingData();
  }, []);

  const generateInvoiceNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `PINV-${dateStr}-${randomNum}`;
  };

  const loadPurchasingData = async () => {
    setLoading(true);

    try {
      const invRes = await axiosClient.get('/purchases/');
      setInvoices(invRes.data.results || invRes.data || []);
    } catch (e) { console.error("Error loading purchases", e); }

    try {
      const supRes = await axiosClient.get('/suppliers/?is_active=true');
      const supList = supRes.data.results || supRes.data || [];
      setSuppliers(supList);
      if (supList.length > 0 && !selectedSupplier) setSelectedSupplier(supList[0].id);
    } catch (e) { console.error("Error loading suppliers", e); }

    try {
      const whRes = await axiosClient.get('/warehouses/?is_active=true');
      const whList = whRes.data.results || whRes.data || [];
      setWarehouses(whList);
      const sortingWh = whList.find(w => w.warehouse_type === 'SORTING') || whList[0];
      if (sortingWh) setSelectedWarehouse(sortingWh.id);
    } catch (e) { console.error("Error loading warehouses", e); }

    try {
      const catRes = await axiosClient.get('/categories/?is_active=true');
      const catList = catRes.data.results || catRes.data || [];
      setCategories(catList);
      if (catList.length > 0) setSelectedCategory(catList[0].id);
    } catch (e) { console.error("Error loading categories", e); }

    setInvoiceNumber(generateInvoiceNumber());
    setLoading(false);
  };

  const handleOpenNewInvoiceModal = () => {
    setInvoiceNumber(generateInvoiceNumber());
    if (warehouses.length > 0 && !selectedWarehouse) {
      const sortingWh = warehouses.find(w => w.warehouse_type === 'SORTING') || warehouses[0];
      if (sortingWh) setSelectedWarehouse(sortingWh.id);
    }
    if (suppliers.length > 0 && !selectedSupplier) {
      setSelectedSupplier(suppliers[0].id);
    }
    setShowNewInvoiceModal(true);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedWarehouse) {
      alert("يرجى اختيار المورد ومخزن الاستلام.");
      return;
    }
    setSubmitting(true);
    try {
      const invRes = await axiosClient.post('/purchases/', {
        supplier: selectedSupplier,
        warehouse: selectedWarehouse,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        status: 'CONFIRMED',
        additional_costs: parseFloat(additionalCosts || 0).toFixed(2),
        notes: `شراء بالة خام - ${itemDescription}`
      });

      const invoiceId = invRes.data.id;
      const parsedWeight = parseFloat(weightKg || 0);
      const parsedCost = parseFloat(totalCost || 0);
      const unitCost = parsedWeight > 0 ? (parsedCost / parsedWeight).toFixed(2) : '0.00';

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
        notes: `بالة جديدة بانتظار الفرز`
      });

      alert(`تم حفظ الفاتورة وإنشاء البالة الخام رقم #${lotCode} بنجاح!`);
      setShowNewInvoiceModal(false);
      loadPurchasingData();
    } catch (err) {
      alert(err.response?.data?.detail || "فشل حفظ فاتورة الشراء.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    setSubmitting(true);

    const uniqueSupplierCode = `SUP-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      const res = await axiosClient.post('/suppliers/', {
        name: newSupplierName.trim(),
        code: uniqueSupplierCode,
        tax_number: newSupplierTax.trim() || null
      });
      setSuppliers(prev => [...prev, res.data]);
      setSelectedSupplier(res.data.id);
      setShowNewSupplierModal(false);
      setNewSupplierName('');
      setNewSupplierTax('');
      alert(`تم حفظ المورد [${res.data.name}] بنجاح!`);
    } catch (err) {
      const errorMsg = err.response?.data?.name?.[0] || err.response?.data?.detail || "اسم المورد موجود مسبقا يرجى كتابة اسم مختلف قليلا.";
      alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvoiceWithManagerApproval = async (e) => {
    e.preventDefault();
    setCancelError('');

    if (managerPassword !== '123456') {
      setCancelError('كلمة سر المدير غير صحيحة!');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.patch(`/purchases/${selectedInvoiceForCancel.id}/`, {
        status: 'CANCELLED'
      });
      alert(`تم إلغاء الفاتورة رقم [${selectedInvoiceForCancel.invoice_number}] وعكس حركتها بنجاح بموافقة المدير!`);
      setSelectedInvoiceForCancel(null);
      setManagerPassword('');
      loadPurchasingData();
    } catch (err) {
      alert("فشل إلغاء الفاتورة. يرجى المحاولة لاحقا.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareWhatsApp = (inv) => {
    const text = `📄 *فاتورة شراء - موشن ستور*\n\n` +
      `🔢 *رقم الفاتورة:* ${inv.invoice_number}\n` +
      `👤 *المورد:* ${inv.supplier_name || 'غير محدد'}\n` +
      `🏬 *المخزن:* ${inv.warehouse_name || 'مخزن الفرز'}\n` +
      `📅 *التاريخ:* ${inv.invoice_date}\n` +
      `💰 *التكلفة الإجمالية:* ${inv.total_cost} ج.م\n` +
      `📌 *الحالة:* ${inv.status}\n\n` +
      `تم استخراجها بواسطة نظام Motion Store SaaS 🚀`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // 1️⃣ تصدير شيت إكسل فاخر ومصمم بالألوان والحدود العريضة (Excel .xls)
  const handleExportStyledExcel = () => {
    const totalCostSum = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? parseFloat(i.total_cost || 0) : 0), 0);
    const dateStr = new Date().toLocaleDateString('ar-EG');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .header-title { background-color: #065f46; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; vertical-align: middle; }
          .header-sub { background-color: #ecfdf5; color: #047857; font-size: 11pt; font-weight: bold; text-align: center; height: 30px; vertical-align: middle; }
          .th-head { background-color: #10b981; color: #ffffff; font-size: 11pt; font-weight: bold; text-align: center; border: 1px solid #059669; height: 35px; vertical-align: middle; }
          .td-cell { border: 1px solid #cbd5e1; font-size: 10pt; text-align: center; height: 28px; vertical-align: middle; }
          .td-number { border: 1px solid #cbd5e1; font-size: 10pt; font-weight: bold; text-align: right; color: #0f172a; height: 28px; vertical-align: middle; }
          .total-row { background-color: #f1f5f9; font-weight: bold; font-size: 11pt; height: 35px; vertical-align: middle; }
        </style>
      </head>
      <body dir="rtl">
        <table>
          <tr><td colspan="6" class="header-title">موشن ستور — Motion Store Enterprise SaaS</td></tr>
          <tr><td colspan="6" class="header-sub">تقرير المشتريات وفواتير الشحنات المعتمدة | تاريخ الاستخراج: ${dateStr}</td></tr>
          <tr><td colspan="6"></td></tr>
          <thead>
            <tr>
              <th class="th-head">رقم الفاتورة</th>
              <th class="th-head">تاريخ الشراء</th>
              <th class="th-head">اسم المورد</th>
              <th class="th-head">مخزن الاستلام</th>
              <th class="th-head">الإجمالي (ج.م)</th>
              <th class="th-head">حالة الفاتورة</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInvoices.map(inv => `
              <tr>
                <td class="td-number">${inv.invoice_number}</td>
                <td class="td-cell">${inv.invoice_date}</td>
                <td class="td-cell">${inv.supplier_name || 'غير محدد'}</td>
                <td class="td-cell">${inv.warehouse_name || 'مخزن الفرز'}</td>
                <td class="td-number">${parseFloat(inv.total_cost || 0).toFixed(2)}</td>
                <td class="td-cell" style="color: ${inv.status === 'CANCELLED' ? '#991b1b' : '#065f46'}; font-weight: bold;">
                  ${inv.status === 'CANCELLED' ? 'ملغاة' : 'معتمدة'}
                </td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4" style="text-align: left; font-weight: bold; padding-left: 15px;">إجمالي المشتريات المعتمدة:</td>
              <td style="color: #047857; font-weight: bold; text-align: right;">${totalCostSum.toFixed(2)} ج.م</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_المشتريات_المصمم_موشن_ستور_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2️⃣ تنزيل التقرير كملف PDF مباشر في التحميلات (Direct PDF Download)
  const handleDownloadDirectPDF = () => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    
    script.onload = () => {
      const totalCostSum = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? parseFloat(i.total_cost || 0) : 0), 0);
      const dateStr = new Date().toLocaleDateString('ar-EG');

      const element = document.createElement('div');
      element.dir = 'rtl';
      element.style.padding = '25px';
      element.style.fontFamily = 'Segoe UI, Tahoma, sans-serif';
      element.style.color = '#0f172a';
      element.style.backgroundColor = '#ffffff';

      element.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 800;">موشن ستور — Motion Store</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">تقرير فواتير الشراء والشحنات المعتمدة</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #334155; line-height: 1.5;">
            <div><b>التاريخ:</b> ${dateStr}</div>
            <div><b>الفرع:</b> فرع سموحة الرئيسي</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
            <div style="font-size: 10px; color: #64748b;">إجمالي المشتريات</div>
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${totalCostSum.toFixed(2)} ج.م</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
            <div style="font-size: 10px; color: #64748b;">عدد الفواتير النشطة</div>
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${invoices.filter(i => i.status !== 'CANCELLED').length}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
            <div style="font-size: 10px; color: #64748b;">عدد الموردين</div>
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${suppliers.length}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #10b981; color: #ffffff;">
              <th style="padding: 8px; border: 1px solid #059669; text-align: right;">رقم الفاتورة</th>
              <th style="padding: 8px; border: 1px solid #059669; text-align: right;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #059669; text-align: right;">المورد</th>
              <th style="padding: 8px; border: 1px solid #059669; text-align: right;">المخزن</th>
              <th style="padding: 8px; border: 1px solid #059669; text-align: right;">الإجمالي (ج.م)</th>
              <th style="padding: 8px; border: 1px solid #059669; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInvoices.map(inv => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${inv.invoice_number}</b></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${inv.invoice_date}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${inv.supplier_name || 'غير محدد'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${inv.warehouse_name || 'مخزن الفرز'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>${parseFloat(inv.total_cost || 0).toFixed(2)}</b></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${inv.status === 'CANCELLED' ? 'ملغاة' : 'معتمدة'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>تم استخراج هذا التقرير آليا بواسطة نظام Motion Store SaaS</span>
          <span>اعتماد الإدارة: ________________________</span>
        </div>
      `;

      const opt = {
        margin:       8,
        filename:     `تقرير_مشتريات_موشن_ستور_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      window.html2pdf().set(opt).from(element).save();
    };

    if (window.html2pdf) {
      script.onload();
    } else {
      document.body.appendChild(script);
    }
  };

  const totalPurchasesCost = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? parseFloat(i.total_cost || 0) : 0), 0);
  const totalInvoicesCount = invoices.filter(i => i.status !== 'CANCELLED').length;

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('purchasing.title')}</h2>
          <p className="text-sm text-slate-500">{t('purchasing.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStyledExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            title="تحميل شيت إكسل فاخر بالهيدر والألوان"
          >
            <FileSpreadsheet size={16} /> تحميل إكسل مصمم (.xls)
          </button>

          <button
            onClick={handleDownloadDirectPDF}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            title="تحميل تقرير PDF مباشر في التحميلات"
          >
            <Download size={16} /> تحميل تقرير PDF مباشر
          </button>

          <button
            onClick={() => setShowNewSupplierModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Building2 size={16} className="text-slate-500" /> {t('purchasing.newSupplier')}
          </button>

          <button
            onClick={handleOpenNewInvoiceModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus size={16} /> {t('purchasing.newInvoice')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('purchasing.totalProcurement')}</span>
          <div className="text-2xl font-black text-slate-900">{totalPurchasesCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">{t('common.currency')}</span></div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium">
            <DollarSign size={13} className="text-emerald-600" /> ({totalInvoicesCount}) فواتير نشطة
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t('purchasing.registeredSuppliers')}</span>
          <div className="text-2xl font-black text-indigo-600">{suppliers.length} <span className="text-xs font-normal text-slate-500">مورد</span></div>
          <p className="text-xs text-indigo-700 mt-2 font-semibold">موردين معتمدين</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">مخازن الاستلام</span>
          <div className="text-2xl font-black text-amber-600">{warehouses.length} <span className="text-xs font-normal text-slate-500">مخزن</span></div>
          <p className="text-xs text-slate-500 mt-2 font-medium">مساحات الاستلام والفرز</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">تحميل مصاريف الشحن</span>
          <div className="text-2xl font-black text-emerald-600">نشط <span className="text-xs font-normal text-slate-500">100٪</span></div>
          <p className="text-xs text-emerald-700 mt-2 font-semibold">امتصاص تكلفة النقل</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">سجل فواتير الشراء</span>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">{t('purchasing.colInvNumber')}</th>
                <th className="py-3.5 px-5">{t('purchasing.colSupplier')}</th>
                <th className="py-3.5 px-5">{t('purchasing.colHub')}</th>
                <th className={`py-3.5 px-5 ${isRTL ? 'text-left' : 'text-right'}`}>{t('purchasing.colTotalCost')}</th>
                <th className="py-3.5 px-5 text-center">{t('common.status')}</th>
                <th className="py-3.5 px-5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className={`hover:bg-slate-50/70 transition ${inv.status === 'CANCELLED' ? 'bg-rose-50/40 opacity-70' : ''}`}>
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
                  <td className={`py-4 px-5 ${isRTL ? 'text-left' : 'text-right'} font-bold text-slate-900 text-sm`}>
                    {parseFloat(inv.total_cost || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-500">{t('common.currency')}</span>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {inv.status === 'CANCELLED' ? 'ملغاة ❌' : inv.status}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedInvoiceForView(inv)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                        title="عرض ومعاينة الفاتورة"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        onClick={() => handleShareWhatsApp(inv)}
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition cursor-pointer"
                        title="مشاركة عبر واتساب"
                      >
                        <Share2 size={15} />
                      </button>

                      {inv.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setSelectedInvoiceForCancel(inv)}
                          className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition cursor-pointer"
                          title="إلغاء الفاتورة (بموافقة المدير)"
                        >
                          <Ban size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 text-xs font-bold">
                    لا توجد فواتير شراء سابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: View Invoice Details */}
      {selectedInvoiceForView && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" /> تفاصيل الفاتورة #{selectedInvoiceForView.invoice_number}
              </h3>
              <button onClick={() => setSelectedInvoiceForView(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-bold">المورد:</span>
                <span className="font-bold text-slate-900">{selectedInvoiceForView.supplier_name || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-bold">المخزن:</span>
                <span>{selectedInvoiceForView.warehouse_name || 'مخزن الفرز'}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-bold">تاريخ الشراء:</span>
                <span>{selectedInvoiceForView.invoice_date}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-bold">إجمالي التكلفة:</span>
                <span className="font-black text-slate-900 text-sm">{selectedInvoiceForView.total_cost} ج.م</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-bold">الحالة:</span>
                <span className="font-bold text-emerald-700">{selectedInvoiceForView.status}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDownloadDirectPDF}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <Download size={16} /> تنزيل الفاتورة كـ PDF
              </button>
              <button
                onClick={() => setSelectedInvoiceForView(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancel Invoice (Manager Password Required) */}
      {selectedInvoiceForCancel && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
                <ShieldCheck size={18} /> موافقة المدير - إلغاء الفاتورة
              </h3>
              <button onClick={() => setSelectedInvoiceForCancel(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold">
              ⚠️ أنت على وشك إلغاء الفاتورة رقم [{selectedInvoiceForCancel.invoice_number}]. سيقوم النظام بعمل قيد عكسي وعكس حسابات المخزون.
            </div>

            <form onSubmit={handleCancelInvoiceWithManagerApproval} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">أدخل كلمة سر المدير للموافقة *</label>
                <input
                  type="password"
                  required
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  placeholder="كلمة سر المدير (123456)"
                />
              </div>

              {cancelError && (
                <div className="text-rose-600 font-bold text-xs">{cancelError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-md cursor-pointer text-xs"
                >
                  {submitting ? 'جاري الإلغاء...' : 'تأكيد إلغاء الفاتورة'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForCancel(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Purchase Invoice */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PackagePlus size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">{t('purchasing.modalInvTitle')}</h3>
              </div>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">المورد / المصدر *</label>
                  <select
                    required
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">اختر المورد...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code || 'Vendor'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">مخزن الاستلام (الفرز) *</label>
                  <select
                    required
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">اختر المخزن...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.warehouse_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">رقم الفاتورة (تلقائي) *</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={invoiceNumber}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-emerald-800 cursor-not-allowed"
                    />
                    <Sparkles size={14} className="absolute left-3 top-2.5 text-emerald-600" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">تاريخ الشراء *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  مواصفات وتكلفة البالة الخام
                </span>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">وصف البالة / الشحنة *</label>
                  <select
                    required
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {balePresets.map((preset, idx) => (
                      <option key={idx} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">الوزن الإجمالي (كجم) *</label>
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
                    <label className="block text-slate-500 font-medium mb-1">عدد القطع التقريبي</label>
                    <input
                      type="number"
                      value={estimatedPieces}
                      onChange={(e) => setEstimatedPieces(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                      placeholder="مثال: 100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-1">تكلفة الشراء (ج.م) *</label>
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
                  <label className="block text-slate-500 font-medium mb-1">مصاريف الشحن والجمارك الإضافية (ج.م)</label>
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
                <span className="text-slate-500">إجمالي صافي التكلفة:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {(parseFloat(totalCost || 0) + parseFloat(additionalCosts || 0)).toFixed(2)} {t('common.currency')}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer text-xs"
              >
                {submitting ? t('common.loading') : 'حفظ الفاتورة وإنشاء البالة الخام بساحة الفرز'}
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
                <Building2 size={18} className="text-emerald-600" /> إضافة مورد جديد
              </h3>
              <button onClick={() => setShowNewSupplierModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">اسم المورد / الشحنة *</label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  placeholder="مثال: الشركة الأوروبية لتصدير البالات"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">الرقم الضريبي / التجاري (اختياري)</label>
                <input
                  type="text"
                  value={newSupplierTax}
                  onChange={(e) => setNewSupplierTax(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  placeholder="مثال: TAX-998877"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-semibold">
                ℹ️ يتولد كود المورد تلقائيا بالترتيب لمنع التكرار.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer text-xs"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ المورد'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewSupplierModal(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
