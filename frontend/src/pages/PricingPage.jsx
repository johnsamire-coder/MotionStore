import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Tag,
  TrendingUp,
  Percent,
  History,
  Sparkles,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Gift,
  DollarSign,
  Scale,
  Package,
  Layers,
  Sliders,
  AlertCircle
} from 'lucide-react';

export default function PricingPage() {
  const { t, isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState('PRICES'); // 'PRICES' | 'OFFERS' | 'HISTORY'
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Grade Prices per KG
  const [gradePrices, setGradePrices] = useState(() => {
    const saved = localStorage.getItem('motion_grade_prices');
    return saved ? JSON.parse(saved) : {
      NEW_COLLECTION: '250.00',
      MIDDLE: '120.00',
      CLEARANCE: '50.00'
    };
  });

  // Default Piece Prices per Product Category
  const [piecePrices, setPiecePrices] = useState(() => {
    const saved = localStorage.getItem('motion_piece_prices');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'بنطلون رجالي/حريمي', defaultPrice: '150.00' },
      { id: 2, name: 'قميص / بلوزة', defaultPrice: '100.00' },
      { id: 3, name: 'جاكيت ومعاطف', defaultPrice: '350.00' },
      { id: 4, name: 'فستان حريمي', defaultPrice: '180.00' },
      { id: 5, name: 'ملابس أطفال', defaultPrice: '80.00' }
    ];
  });

  // Offers Engine State
  const [offers, setOffers] = useState(() => {
    const saved = localStorage.getItem('motion_active_offers');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'عرض شحنات البالات الكبيرة', type: 'BUY_X_GET_Y', minKg: '20', freeKg: '1', active: true },
      { id: 2, name: 'خصم العودة للمدارس', type: 'PERCENTAGE', percent: '10', minTotal: '500', active: false },
      { id: 3, name: 'خصم الشراء المباشر', type: 'FIXED_AMOUNT', discountEgp: '50', minTotal: '600', active: true }
    ];
  });

  // Price Change History Log
  const [priceHistory, setPriceHistory] = useState(() => {
    const saved = localStorage.getItem('motion_price_history');
    return saved ? JSON.parse(saved) : [
      { id: 1, date: '2026-09-24 10:00 ص', item: '✨ كريمة (سعر الكيلو)', oldPrice: '220.00 ج.م', newPrice: '250.00 ج.م', user: 'admin' },
      { id: 2, date: '2026-09-23 04:30 م', item: '📦 وسط (سعر الكيلو)', oldPrice: '100.00 ج.م', newPrice: '120.00 ج.م', user: 'admin' },
      { id: 3, date: '2026-09-22 09:15 ص', item: '🏷️ تصفيات (سعر الكيلو)', oldPrice: '40.00 ج.م', newPrice: '50.00 ج.م', user: 'admin' }
    ];
  });

  // New Offer Form States
  const [newOfferName, setNewOfferName] = useState('');
  const [newOfferType, setNewOfferType] = useState('BUY_X_GET_Y');
  const [newMinKg, setNewMinKg] = useState('20');
  const [newFreeKg, setNewFreeKg] = useState('1');
  const [newPercent, setNewPercent] = useState('10');
  const [newDiscountEgp, setNewDiscountEgp] = useState('50');
  const [newMinTotal, setNewMinTotal] = useState('500');

  // New Product Price Form States
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('100.00');

  // حفظ الأسعار المعتمدة وتوثيق الحركة في السجل
  const handleSaveGradePrices = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const now = new Date().toLocaleString('ar-EG');
    const newLogs = [
      { id: Date.now(), date: now, item: '✨ كريمة (سعر الكيلو)', oldPrice: '220.00 ج.م', newPrice: `${gradePrices.NEW_COLLECTION} ج.م`, user: 'admin' },
      { id: Date.now() + 1, date: now, item: '📦 وسط (سعر الكيلو)', oldPrice: '100.00 ج.م', newPrice: `${gradePrices.MIDDLE} ج.م`, user: 'admin' },
      { id: Date.now() + 2, date: now, item: '🏷️ تصفيات (سعر الكيلو)', oldPrice: '40.00 ج.م', newPrice: `${gradePrices.CLEARANCE} ج.م`, user: 'admin' },
      ...priceHistory
    ];

    localStorage.setItem('motion_grade_prices', JSON.stringify(gradePrices));
    localStorage.setItem('motion_piece_prices', JSON.stringify(piecePrices));
    localStorage.setItem('motion_price_history', JSON.stringify(newLogs));
    setPriceHistory(newLogs);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    setSubmitting(false);
    alert('✅ تم حفظ قوائم الأسعار الجديدة وتحديث شاشات الكاشير (POS) وتوثيق التغيير في سجل الأسعار!');
  };

  // إضافة صنف بسعر قطعة أوتوماتيكي
  const handleAddPiecePrice = (e) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    const newItem = { id: Date.now(), name: newProdName.trim(), defaultPrice: parseFloat(newProdPrice).toFixed(2) };
    const updated = [...piecePrices, newItem];
    setPiecePrices(updated);
    localStorage.setItem('motion_piece_prices', JSON.stringify(updated));
    setNewProdName('');
    alert(`تم إضافة سعر القطعة للصنف [${newItem.name}] بنجاح!`);
  };

  // إضافة عرض ترويجي جديد
  const handleAddOffer = (e) => {
    e.preventDefault();
    if (!newOfferName.trim()) return;

    const newOffer = {
      id: Date.now(),
      name: newOfferName.trim(),
      type: newOfferType,
      minKg: newMinKg,
      freeKg: newFreeKg,
      percent: newPercent,
      discountEgp: newDiscountEgp,
      minTotal: newMinTotal,
      active: true
    };

    const updated = [...offers, newOffer];
    setOffers(updated);
    localStorage.setItem('motion_active_offers', JSON.stringify(updated));
    setNewOfferName('');
    alert(`تم إضافة العرض الجديد [${newOffer.name}] بنجاح وتفعيله!`);
  };

  const toggleOfferStatus = (id) => {
    const updated = offers.map(o => o.id === id ? { ...o, active: !o.active } : o);
    setOffers(updated);
    localStorage.setItem('motion_active_offers', JSON.stringify(updated));
  };

  const deleteOffer = (id) => {
    const updated = offers.filter(o => o.id !== id);
    setOffers(updated);
    localStorage.setItem('motion_active_offers', JSON.stringify(updated));
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة التسعير والعروض السعرية</h2>
        <p className="text-sm text-slate-500">تحديد أسعار الكيلو والقطع ضبط العروض الترويجية وسجل تغييرات الأسعار</p>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 gap-2 bg-white p-2 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('PRICES')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'PRICES' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Tag size={16} /> قوائم أسعار الكيلو والقطع
        </button>

        <button
          onClick={() => setActiveTab('OFFERS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'OFFERS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Gift size={16} /> العروض الترويجية والخصومات
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <History size={16} /> سجل تواريخ تغيير الأسعار
        </button>
      </div>

      {/* TAB 1: PRICES SETTINGS */}
      {activeTab === 'PRICES' && (
        <form onSubmit={handleSaveGradePrices} className="space-y-6">
          
          {/* Grade Prices per KG */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Scale size={18} className="text-emerald-600" /> أسعار البيع بـ الكيلو حسب درجة الفرز (ج.م / كجم)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-900 block">✨ سعر الكيلو — الكريمة (Super Lux)</span>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    required
                    value={gradePrices.NEW_COLLECTION}
                    onChange={(e) => setGradePrices({ ...gradePrices, NEW_COLLECTION: e.target.value })}
                    className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl font-black text-slate-900 text-sm focus:outline-none focus:border-emerald-600"
                  />
                  <span className="absolute left-3 top-3 text-slate-400 font-bold">ج.م/كجم</span>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-2">
                <span className="font-bold text-indigo-900 block">📦 سعر الكيلو — الوسط (Middle Grade)</span>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    required
                    value={gradePrices.MIDDLE}
                    onChange={(e) => setGradePrices({ ...gradePrices, MIDDLE: e.target.value })}
                    className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl font-black text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  />
                  <span className="absolute left-3 top-3 text-slate-400 font-bold">ج.م/كجم</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-2">
                <span className="font-bold text-amber-900 block">🏷️ سعر الكيلو — التصفيات (Clearance)</span>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    required
                    value={gradePrices.CLEARANCE}
                    onChange={(e) => setGradePrices({ ...gradePrices, CLEARANCE: e.target.value })}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-black text-slate-900 text-sm focus:outline-none focus:border-amber-600"
                  />
                  <span className="absolute left-3 top-3 text-slate-400 font-bold">ج.م/كجم</span>
                </div>
              </div>
            </div>
          </div>

          {/* Piece Prices per Category */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Tag size={18} className="text-indigo-600" /> أسعار البيع الثابتة بـ القطعة حسب الصنف (ج.م / قطعة)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {piecePrices.map((item) => (
                <div key={item.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center gap-3">
                  <span className="font-bold text-slate-800">{item.name}</span>
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={item.defaultPrice}
                      onChange={(e) => {
                        const updated = piecePrices.map(p => p.id === item.id ? { ...p, defaultPrice: e.target.value } : p);
                        setPiecePrices(updated);
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs text-left pl-8"
                    />
                    <span className="absolute left-2 top-2 text-slate-400 text-[10px] font-bold">ج.م</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Piece Price */}
            <div className="pt-2 flex gap-3">
              <input
                type="text"
                placeholder="اسم صنف جديد (مثال: فستان سهرة)"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              />
              <input
                type="number"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                className="w-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
              <button
                type="button"
                onClick={handleAddPiecePrice}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition cursor-pointer shrink-0"
              >
                + إضافة سعر صنف
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            <Save size={16} /> اعتماد وحفظ قوائم الأسعار وتحديث الكاشير فورا
          </button>
        </form>
      )}

      {/* TAB 2: OFFERS ENGINE */}
      {activeTab === 'OFFERS' && (
        <div className="space-y-6 text-xs">
          {/* New Offer Form */}
          <form onSubmit={handleAddOffer} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Gift size={18} className="text-indigo-600" /> + إضافة عرض ترويجي جديد
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العرض *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عرض الكيلو الهدية"
                  value={newOfferName}
                  onChange={(e) => setNewOfferName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع العرض *</label>
                <select
                  value={newOfferType}
                  onChange={(e) => setNewOfferType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold cursor-pointer"
                >
                  <option value="BUY_X_GET_Y">🎁 عرض كميات (اشتري X كجم واكسب Y كجم هدية)</option>
                  <option value="PERCENTAGE">٪ خصم نسبة مئوية (%)</option>
                  <option value="FIXED_AMOUNT">💵 خصم مبلغ ثابت (ج.م)</option>
                </select>
              </div>

              {newOfferType === 'BUY_X_GET_Y' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-bold text-slate-700 mb-1">عند شراء (كجم)</label>
                    <input type="number" value={newMinKg} onChange={(e) => setNewMinKg(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="block font-bold text-slate-700 mb-1">احصل على (كجم مجانا)</label>
                    <input type="number" value={newFreeKg} onChange={(e) => setNewFreeKg(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold" />
                  </div>
                </div>
              )}

              {newOfferType === 'PERCENTAGE' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة الخصم (%)</label>
                  <input type="number" value={newPercent} onChange={(e) => setNewPercent(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold" />
                </div>
              )}

              {newOfferType === 'FIXED_AMOUNT' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">قيمة الخصم (ج.م)</label>
                  <input type="number" value={newDiscountEgp} onChange={(e) => setNewDiscountEgp(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold" />
                </div>
              )}
            </div>

            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer">
              حفظ وتفعيل العرض
            </button>
          </form>

          {/* Active Offers List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">العروض المعرفة بالنظام</h3>
            <div className="space-y-3">
              {offers.map((offer) => (
                <div key={offer.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      {offer.name}
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${offer.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {offer.active ? 'نشط ✅' : 'متوقف ⏸️'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {offer.type === 'BUY_X_GET_Y' && `اشتري ${offer.minKg} كجم واحصل على ${offer.freeKg} كجم مجانا`}
                      {offer.type === 'PERCENTAGE' && `خصم ${offer.percent}% عند التبضع بأكثر من ${offer.minTotal} ج.م`}
                      {offer.type === 'FIXED_AMOUNT' && `خصم ${offer.discountEgp} ج.م على الفاتورة فوق ${offer.minTotal} ج.م`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleOfferStatus(offer.id)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      {offer.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOffer(offer.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRICE CHANGE HISTORY LOG */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-slate-700" /> سجل تواريخ وثوابت تغيير الأسعار (Price Change Trail)
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">سجل موثق زمني للتسعير</span>
          </div>

          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
              <tr>
                <th className="py-3.5 px-5">تاريخ ووقت التغيير</th>
                <th className="py-3.5 px-5">الصنف / الدرجة</th>
                <th className="py-3.5 px-5">السعر السابق</th>
                <th className="py-3.5 px-5">السعر الجديد</th>
                <th className="py-3.5 px-5">المسؤول عن التغيير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-medium">
              {priceHistory.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-5 font-mono text-slate-500">{log.date}</td>
                  <td className="py-3.5 px-5 font-bold text-slate-900">{log.item}</td>
                  <td className="py-3.5 px-5 text-rose-600 font-mono font-bold">{log.oldPrice}</td>
                  <td className="py-3.5 px-5 text-emerald-700 font-mono font-bold">{log.newPrice}</td>
                  <td className="py-3.5 px-5 font-bold text-slate-700">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
