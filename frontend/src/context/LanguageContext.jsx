import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  ar: {
    // Navigation
    brand_title: 'موشن ستور',
    brand_sub: 'نظام إدارة البالات والمخازن',
    nav_dashboard: 'لوحة المؤشرات',
    nav_pos: 'نقطة البيع (الكاشير)',
    nav_sorting: 'ساحة فرز البالات',
    nav_inventory: 'المخزون التام والحركات',
    nav_purchasing: 'المشتريات والبالات الخام',
    nav_shifts: 'الورديات وتسليم العهدة',
    nav_treasury: 'الخزائن والصناديق',
    nav_reports: 'التقارير وقائمة الدخل',
    nav_settings: 'إعدادات النظام والسياسات',
    logout: 'تسجيل الخروج',
    workspace: 'مساحة العمل التشغيلية',
    online_engine: 'المحرك متصل ويعمل',

    // Dashboard
    dash_title: 'لوحة المؤشرات التنفيذية',
    dash_sub: 'متابعة حية لمردود البالات مبيعات الكاشير ودفتر أستاذ المخزون',
    kpi_revenue: 'إجمالي المبيعات',
    kpi_profit: 'مجمل الربح',
    kpi_stock: 'المخزون المتاح',
    kpi_bales: 'البالات المفروزة',
    status_costing: 'سياسة التكلفة النشطة',
    status_accounting: 'دفتر القيود المحاسبية',

    // Settings
    settings_title: 'إعدادات النظام والسياسات التشغيلية',
    settings_sub: 'تخصيص بيانات المنشأة سياسات تسعير البالات الطابعات الحرارية والخصومات',
    tab_company: 'بيانات المنشأة والفرع',
    tab_costing: 'سياسة تكلفة البالات',
    tab_printing: 'الطابعات وفاتورة الكاشير',
    tab_security: 'الخصومات والصلاحيات',
    tab_users: 'المستخدمين والأدوار',
    save_settings: 'حفظ الإعدادات والتعديلات',
    settings_saved: 'تم حفظ وتفعيل الإعدادات بنجاح!'
  },
  en: {
    // Navigation
    brand_title: 'MOTION STORE',
    brand_sub: 'Thrift & Bale Enterprise OS',
    nav_dashboard: 'Dashboard',
    nav_pos: 'Point of Sale (POS)',
    nav_sorting: 'Bale Sorting Hub',
    nav_inventory: 'Finished Inventory',
    nav_purchasing: 'Purchasing & Bales',
    nav_shifts: 'Shifts & Registers',
    nav_treasury: 'Treasuries & Vaults',
    nav_reports: 'Executive Reports & P&L',
    nav_settings: 'System Settings & Policies',
    logout: 'Logout',
    workspace: 'Enterprise Workspace',
    online_engine: 'Online Core Engine',

    // Dashboard
    dash_title: 'Executive Dashboard',
    dash_sub: 'Real-time Bale Yield, POS Sales, and Inventory Ledger Metrics',
    kpi_revenue: 'Gross Sales',
    kpi_profit: 'Gross Profit',
    kpi_stock: 'Active Inventory',
    kpi_bales: 'Processed Bales',
    status_costing: 'Active Costing Policy',
    status_accounting: 'Accounting Ledger',

    // Settings
    settings_title: 'System Settings & Operational Policies',
    settings_sub: 'Configure Store Profile, Bale Costing Engines, Thermal Printers, and Security',
    tab_company: 'Store & Branch Profile',
    tab_costing: 'Bale Costing Policy',
    tab_printing: 'Thermal Printers & Receipts',
    tab_security: 'Discounts & Shift Rules',
    tab_users: 'Users & Roles Directory',
    save_settings: 'Save Settings',
    settings_saved: 'Settings saved successfully!'
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ar');

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, isRTL: lang === 'ar', toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
