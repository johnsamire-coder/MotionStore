import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import PricingV2 from '../components/PricingV2';
import PriceLogV2 from '../components/PriceLogV2';
import OffersV2 from '../components/OffersV2';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Tag, Save, Search, CheckCircle2, History, Scale, Package, Plus, Download, Printer, FileSpreadsheet, User, Gift, ToggleLeft, ToggleRight } from 'lucide-react';

export default function ProductCodingPage() {
  const { t, isRTL } = useLanguage();
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('PRICING'); // CODING | PRICING | HISTORY | OFFERS

  // Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Tab 1: Coding Form State
  const [codingForm, setCodingForm] = useState({
    name: '', code: '', barcode: '', category: '', unit_of_measure: 'PIECE', min_stock_level: '0.000', package_type: ''
  });

  // Tab 2: General Weight Prices State (Right Column)
  const [generalWeightPrices, setGeneralWeightPrices] = useState({
    NEW_COLLECTION: { current: '', saved: '', old: '0.00' },
    MIDDLE: { current: '', saved: '', old: '0.00' },
    CLEARANCE: { current: '', saved: '', old: '0.00' }
  });

  // Tab 2: Piece Pricing State (Left Column)
  const [selectedPieceProduct, setSelectedPieceProduct] = useState(null);
  const [pieceCategory, setPieceCategory] = useState('حريمي');
  const [pieceGrade, setPieceGrade] = useState('NEW_COLLECTION');
  const [piecePriceInput, setPiecePriceInput] = useState({ current: '', saved: '', old: '0.00' });

  // Tab 3: History Filter Dates
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Tab 4: Offers / Discount Rules Form
  const [offerForm, setOfferForm] = useState({
    name: '',
    discount_type: 'GRADE_PERCENTAGE',
    value: '10.00',
    target_grade: 'CLEARANCE',
    min_weight_kg: '5.000',
    start_date: new Date().toISOString().split('T')[0],
    end_date: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })()
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, hRes, itemsRes, dRes] = await Promise.all([
        axiosClient.get('/products/'),
        axiosClient.get('/categories/'),
        axiosClient.get('/price-history/'),
        axiosClient.get('/price-list-items/'),
        axiosClient.get('/discount-rules/')
      ]);

      const pList = pRes.data.results || pRes.data || [];
      const cList = cRes.data.results || cRes.data || [];
      const hList = hRes.data.results || hRes.data || [];
      const itemsList = itemsRes.data.results || itemsRes.data || [];
      const dList = dRes.data.results || dRes.data || [];

      setProducts(pList);
      setCategories(cList);
      setPriceHistory(hList);
      setDiscountRules(dList);

      if (cList.length > 0 && !codingForm.category) {
        setCodingForm(prev => ({ ...prev, category: cList[0].id }));
      }
      if (pList.length > 0 && !selectedPieceProduct) {
        setSelectedPieceProduct(pList[0]);
      }

      // Populate General Weight Prices
      const newWeights = {
        NEW_COLLECTION: { current: '', saved: '', old: '0.00' },
        MIDDLE: { current: '', saved: '', old: '0.00' },
        CLEARANCE: { current: '', saved: '', old: '0.00' }
      };

      itemsList.forEach(item => {
        if (!item.product && item.grade && newWeights[item.grade]) {
          if (parseFloat(item.price_per_kg) > 0) {
            newWeights[item.grade] = {
              current: item.price_per_kg,
              saved: item.price_per_kg,
              old: item.price_per_kg
            };
          }
        }
      });
      setGeneralWeightPrices(newWeights);

    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Add Category Function
  const handleAddCategory = async () => {
    const catName = prompt('أدخل اسم التصنيف الجديد (مثال: حريمي / أطفالي / رجالي):');
    if (catName && catName.trim()) {
      try {
        const res = await axiosClient.post('/categories/', { name: catName.trim() });
        setCategories([...categories, res.data]);
        setCodingForm(prev => ({ ...prev, category: res.data.id }));
        alert('تم إضافة التصنيف بنجاح ✅');
      } catch (err) {
        alert('حدث خطأ أثناء إضافة التصنيف');
      }
    }
  };

  // Save Coding (Tab 1)
  const handleSaveCoding = async (e) => {
    e.preventDefault();
    if (!codingForm.name.trim() || !codingForm.category) {
      alert('يرجى إدخال اسم الصنف والتصنيف الرئيسي');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/products/', codingForm);
      setSuccessMsg('تم تكويد وتخزين الصنف بنجاح ✅');
      setCodingForm({
        name: '', code: '', barcode: '', category: categories[0]?.id || '',
        unit_of_measure: 'PIECE', min_stock_level: '0.000', package_type: ''
      });
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل حفظ الصنف، يرجى مراجعة البيانات');
    } finally {
      setSaving(false);
    }
  };

  // Save Individual General Weight Price
  const handleSaveGeneralWeight = async (grade) => {
    const val = generalWeightPrices[grade].current;
    if (!val || parseFloat(val) <= 0) return alert('أدخل سعراً صحيحاً');

    setSaving(true);
    try {
      const res = await axiosClient.post('/price-list-items/', {
        product: null,
        grade: grade,
        price_per_kg: val,
        price_per_piece: '0.00'
      });

      const oldP = res.data.old_price || generalWeightPrices[grade].saved || '0.00';
      setGeneralWeightPrices(prev => ({
        ...prev,
        [grade]: { current: val, saved: val, old: oldP }
      }));
      setSuccessMsg(`تم تحديث سعر كيلو (${grade === 'NEW_COLLECTION' ? 'الكريمة' : grade === 'MIDDLE' ? 'الوسط' : 'التصفيات'}) بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAllData();
    } catch (err) {
      alert('فشل حفظ سعر الوزن');
    } finally {
      setSaving(false);
    }
  };

  // Load Piece Price for Selected Product & Grade
  const handleLoadPiecePrice = async (product, grade) => {
    if (!product) return;
    try {
      const res = await axiosClient.get(`/price-list-items/?product=${product.id}`);
      const items = res.data.results || res.data || [];
      const item = items.find(i => i.grade === grade && parseFloat(i.price_per_piece) > 0);
      const priceVal = item ? item.price_per_piece : '';
      setPiecePriceInput({ current: priceVal, saved: priceVal, old: priceVal || '0.00' });
    } catch (err) {
      console.error(err);
    }
  };

  // Save Individual Piece Price
  const handleSavePiecePrice = async () => {
    if (!selectedPieceProduct) return alert('اختار الصنف الأول');
    const val = piecePriceInput.current;
    if (!val || parseFloat(val) <= 0) return alert('أدخل سعر قطعة صحيح');

    setSaving(true);
    try {
      const res = await axiosClient.post('/price-list-items/', {
        product: selectedPieceProduct.id,
        grade: pieceGrade,
        price_per_kg: '0.00',
        price_per_piece: val
      });

      const oldP = res.data.old_price || piecePriceInput.saved || '0.00';
      setPiecePriceInput({ current: val, saved: val, old: oldP });
      setSuccessMsg(`تم تحديث سعر قطعة (${selectedPieceProduct.name} - ${pieceCategory}) بنجاح ✅`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAllData();
    } catch (err) {
      alert('فشل حفظ سعر القطعة');
    } finally {
      setSaving(false);
    }
  };

  // Save Offer / Discount Rule (Tab 4)
  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (!offerForm.name.trim() || !offerForm.value) {
      return alert('أكمل بيانات العرض');
    }

    setSaving(true);
    try {
      await axiosClient.post('/discount-rules/', {
        name: offerForm.name,
        discount_type: offerForm.discount_type,
        value: offerForm.value,
        target_grade: offerForm.discount_type === 'GRADE_PERCENTAGE' ? offerForm.target_grade : null,
        min_weight_kg: offerForm.discount_type === 'WEIGHT_TIER' ? offerForm.min_weight_kg : '0.000',
        start_date: offerForm.start_date,
        end_date: offerForm.end_date,
        is_active: true
      });

      setSuccessMsg('تمت إضافة العرض وتفعيله في شاشة الـ POS بنجاح 🎁✅');
      setOfferForm(prev => ({ ...prev, name: '', value: '10.00' }));
      fetchAllData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل إضافة العرض');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Discount Active Status
  const handleToggleOffer = async (rule) => {
    try {
      await axiosClient.patch(`/discount-rules/${rule.id}/`, {
        is_active: !rule.is_active
      });
      fetchAllData();
    } catch (err) {
      alert('فشل تعديل حالة العرض');
    }
  };

  // Filter History Log
  const filteredHistory = priceHistory.filter(h => {
    const date = h.created_at ? h.created_at.split('T')[0] : '';
    return date >= startDate && date <= endDate;
  });

  // Export Excel CSV
  const exportExcel = () => {
    const headers = ['التاريخ والوقت', 'اسم الصنف', 'النوع / الدرجة', 'طريقة التسعير', 'السعر القديم', 'السعر الجديد', 'المستخدم المسئول'];
    const rows = filteredHistory.map(h => [
      new Date(h.created_at).toLocaleString('ar-EG'),
      `"${h.product_name || 'عام (وزن)'}"`,
      `"${h.grade_display || h.grade || ''}"`,
      h.pricing_type === 'KG' ? 'بالوزن كجم' : 'بالقطعة',
      h.old_price,
      h.new_price,
      `"${h.changed_by_username || 'المدير العام'}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_سجل_الأسعار_${startDate}_إلى_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0 font-sans">
      
      {/* Print PDF Official Header */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-center px-4">
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900">{tenant?.name || 'شركة Motion Store للتجارة'}</h1>
            <p className="text-xs text-slate-600 font-bold">نظام تشغيل وإدارة تجارة البالات والملابس المستعملة</p>
          </div>
          <div className="text-left text-xs font-mono text-slate-500">
            <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
            <p>الفترة: من {startDate} إلى {endDate}</p>
          </div>
        </div>
        <h2 className="text-lg font-black text-slate-800 mt-4 bg-slate-100 py-1">تقرير سجل تغيرات وتحديثات الأسعار الرسمية</h2>
      </div>

      {/* Screen Header & 4 Main Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-600" />
            {isRTL ? 'التسعير' : 'Pricing'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{isRTL ? 'تسعير الأوزان والقطع، وسجل تغييرات الأسعار، والعروض' : 'Weight & piece pricing, price change log, and offers'}</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('PRICING')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'PRICING' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isRTL ? 'التسعير' : 'Pricing'}
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isRTL ? 'سجل التغيرات' : 'Change Log'}
          </button>
          <button
            onClick={() => setActiveTab('OFFERS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'OFFERS' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-700 hover:text-purple-900 bg-purple-50'
            }`}
          >
            <Gift size={14} />
            <span>{isRTL ? 'العروض' : 'Offers'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm print:hidden">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      {/* ==================== TAB 1: CODING ==================== */}
      {activeTab === 'PRICING' && <PricingV2 />}

      {activeTab === 'HISTORY' && <PriceLogV2 />}

      {activeTab === 'OFFERS' && <OffersV2 />}

    </div>
  );
}
