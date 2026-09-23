import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Building2, 
  Sliders, 
  Printer, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  Store, 
  Scale, 
  Save
} from 'lucide-react';

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('COMPANY');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form States
  const [companyName, setCompanyName] = useState('موشن ستور للملابس والأحذية الأوروبية');
  const [branchName, setBranchName] = useState('فرع سموحة الرئيسي - الإسكندرية');
  const [phone, setPhone] = useState('+20 100 123 4567');
  const [currency, setCurrency] = useState('EGP');
  const [taxNumber, setTaxNumber] = useState('TR-987-654-321');
  const [address, setAddress] = useState('شارع فوزي معاذ، سموحة، الإسكندرية');

  // Costing Settings
  const [costingMethod, setCostingMethod] = useState('COEFFICIENTS');
  const [wasteTreatment, setWasteTreatment] = useState('SEPARATE');
  const [coefNew, setCoefNew] = useState('3.00');
  const [coefMid, setCoefMid] = useState('1.50');
  const [coefClr, setCoefClr] = useState('0.50');

  // Thermal Printing Settings
  const [printerWidth, setPrinterWidth] = useState('80MM');
  const [receiptHeader, setReceiptHeader] = useState('موشن ستور - بالات وملابس أوروبية فاخرة');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 14 يوماً بالفاتورة');
  const [showQR, setShowQR] = useState(true);

  // Security & Discount Limits
  const [cashierMaxDiscount, setCashierMaxDiscount] = useState('5');
  const [managerMaxDiscount, setManagerMaxDiscount] = useState('20');
  const [requireShiftApproval, setRequireShiftApproval] = useState(true);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const tabs = [
    { id: 'COMPANY', label: t('settings.tabCompany'), icon: Building2 },
    { id: 'COSTING', label: t('settings.tabCosting'), icon: Sliders },
    { id: 'PRINTING', label: t('settings.tabPrinting'), icon: Printer },
    { id: 'SECURITY', label: t('settings.tabSecurity'), icon: ShieldCheck },
    { id: 'USERS', label: t('settings.tabUsers'), icon: Users },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('settings.title')}</h2>
          <p className="text-sm text-slate-500">{t('settings.subtitle')}</p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{t('settings.savedAlert')}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Tabs */}
        <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="md:col-span-3 bg-white p-8 rounded-2xl border border-slate-200 shadow-xs">
          <form onSubmit={handleSave} className="space-y-6 text-xs">
            {/* COMPANY */}
            {activeTab === 'COMPANY' && (
              <div className="space-y-5">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Store size={18} className="text-emerald-600" /> {t('settings.tabCompany')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">اسم المتجر / الشركة *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">اسم الفرع الحالي</label>
                    <input
                      type="text"
                      required
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف للتواصل</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">العملة الأساسية للنظام</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">الرقم الضريبي / السجل التجاري</label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">العنوان التفصيلي</label>
                    <textarea
                      rows="2"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* COSTING */}
            {activeTab === 'COSTING' && (
              <div className="space-y-5">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Scale size={18} className="text-emerald-600" /> {t('settings.tabCosting')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">طريقة توزيع التكلفة الأساسية (Costing Method)</label>
                    <select
                      value={costingMethod}
                      onChange={(e) => setCostingMethod(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="COEFFICIENTS">الطريقة B: التوزيع بالمعاملات الموزونة (Weighted Coefficients)</option>
                      <option value="SALES_VALUE">الطريقة C: التوزيع بالقيمة البيعية المتوقعة (Relative Sales Value)</option>
                      <option value="EQUAL_WEIGHT">الطريقة A: التوزيع المتساوي بالوزن (Equal Weight)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">طريقة معالجة تكلفة الهالك (Waste Treatment)</label>
                    <select
                      value={wasteTreatment}
                      onChange={(e) => setWasteTreatment(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="SEPARATE">الحالة 2: إثبات الهالك كخسارة فرز منفصلة (Separate Loss)</option>
                      <option value="ABSORBED">الحالة 1: امتصاص الهالك ضمن المخرجات الصالحة (Absorbed Cost)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* PRINTING */}
            {activeTab === 'PRINTING' && (
              <div className="space-y-5">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Printer size={18} className="text-emerald-600" /> {t('settings.tabPrinting')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">مقاس رول ورق الطباعة (Paper Width)</label>
                    <select
                      value={printerWidth}
                      onChange={(e) => setPrinterWidth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="80MM">80 مم (80mm Standard POS Printer)</option>
                      <option value="58MM">58 مم (58mm Compact POS Printer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ترويسة الفاتورة (Header Text)</label>
                    <input
                      type="text"
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">تذييل الفاتورة وسياسة الاسترجاع (Footer Text)</label>
                    <textarea
                      rows="2"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY */}
            {activeTab === 'SECURITY' && (
              <div className="space-y-5">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" /> {t('settings.tabSecurity')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">الحد الأقصى لخصم الكاشير (%)</label>
                    <input
                      type="number"
                      value={cashierMaxDiscount}
                      onChange={(e) => setCashierMaxDiscount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">الحد الأقصى لخصم المدير (%)</label>
                    <input
                      type="number"
                      value={managerMaxDiscount}
                      onChange={(e) => setManagerMaxDiscount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* USERS */}
            {activeTab === 'USERS' && (
              <div className="space-y-5">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Users size={18} className="text-emerald-600" /> {t('settings.tabUsers')}
                </h3>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900">admin (مدير النظام)</div>
                      <div className="text-[10px] text-slate-400">admin@motionstore.com</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ADMIN / مسؤول كامل
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer text-xs"
              >
                <Save size={16} /> {t('settings.saveBtn')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
