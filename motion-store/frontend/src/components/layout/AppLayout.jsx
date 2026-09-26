import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  ShoppingCart,
  Layers,
  Package,
  Truck,
  Clock,
  BarChart3,
  Vault,
  LogOut,
  Store,
  FileSpreadsheet,
  Settings,
  Globe,
  Tag,
  DollarSign,
  RotateCcw,
  ShieldCheck,
  Users
} from 'lucide-react';

export default function AppLayout() {
  const { user, tenant, logout } = useAuth();
  const { t, lang, isRTL, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [allowedScreens, setAllowedScreens] = useState(['*']);

  useEffect(() => {
    if (user?.role) {
      loadPermissions(user.role);
    }
  }, [user]);

  const loadPermissions = async (roleId) => {
    if (roleId === 'ADMIN') {
      setAllowedScreens(['*']);
      return;
    }
    try {
      const res = await axiosClient.get(`/role-permissions/?role=${roleId}`);
      const list = res.data.results || res.data || [];
      const rolePerm = list.find(r => r.role === roleId);
      if (rolePerm && rolePerm.allowed_screens) {
        setAllowedScreens(rolePerm.allowed_screens);
      } else {
        if (roleId === 'CASHIER') setAllowedScreens(['/pos', '/shifts', '/returns']);
        else setAllowedScreens(['/', '/pos']);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  const isAllowed = (path) => {
    if (user?.role === 'ADMIN' || allowedScreens.includes('*')) return true;
    return allowedScreens.includes(path);
  };

  // Global Alt+Number Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey) {
        if (e.key === '1' && isAllowed('/purchasing')) { e.preventDefault(); navigate('/purchasing'); }
        else if (e.key === '2' && isAllowed('/pos')) { e.preventDefault(); navigate('/pos'); }
        else if (e.key === '3' && isAllowed('/expenses')) { e.preventDefault(); navigate('/expenses'); }
        else if (e.key === '4' && isAllowed('/coding')) { e.preventDefault(); navigate('/coding'); }
        else if (e.key === '7' && isAllowed('/treasury')) { e.preventDefault(); navigate('/treasury'); }
        else if (e.key === '8' && isAllowed('/inventory')) { e.preventDefault(); navigate('/inventory'); }
        else if (e.key === '9' && isAllowed('/shifts')) { e.preventDefault(); navigate('/shifts'); }
        else if (e.key === '0' && isAllowed('/returns')) { e.preventDefault(); navigate('/returns'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, allowedScreens, user]);

  const allRibbonItems = [
    { name: 'مشتريات Alt+1', en: 'Purchases Alt+1', to: '/purchasing', icon: Truck },
    { name: 'مبيعات Alt+2', en: 'Sales Alt+2', to: '/pos', icon: ShoppingCart },
    { name: 'مصروفات Alt+3', en: 'Expenses Alt+3', to: '/expenses', icon: DollarSign },
    { name: 'تسعير Alt+4', en: 'Pricing Alt+4', to: '/coding', icon: Tag },
    { name: 'الخزينة Alt+7', en: 'Treasury Alt+7', to: '/treasury', icon: Vault },
    { name: 'المخزون Alt+8', en: 'Inventory Alt+8', to: '/inventory', icon: Package },
    { name: 'الورديات Alt+9', en: 'Shifts Alt+9', to: '/shifts', icon: Clock },
    { name: 'مرتجعات Alt+0', en: 'Returns Alt+0', to: '/returns', icon: RotateCcw },
    { name: 'التقارير', en: 'Reports', to: '/reports', icon: BarChart3 },
  ];

  const allNavigation = [
    { name: t('nav.dashboard'), to: '/', icon: BarChart3 },
    { name: 'شاشة المبيعات (Alt+2)', en: 'Sales (Alt+2)', to: '/pos', icon: ShoppingCart },
    { name: 'فواتير المبيعات', en: 'Sales Invoices', to: '/invoices', icon: FileSpreadsheet },
    { name: 'شاشة المصروفات (Alt+3)', en: 'Expenses (Alt+3)', to: '/expenses', icon: DollarSign },
    { name: 'التسعير', en: 'Pricing', to: '/coding', icon: Tag },
    { name: 'مرتجعات المبيعات (Alt+0)', en: 'Sales Returns (Alt+0)', to: '/returns', icon: RotateCcw },
    { name: t('nav.sorting'), to: '/sorting', icon: Layers },
    { name: t('nav.inventory'), to: '/inventory', icon: Package },
    { name: t('nav.purchasing'), to: '/purchasing', icon: Truck },
    { name: t('nav.shifts'), to: '/shifts', icon: Clock },
    { name: t('nav.treasury'), to: '/treasury', icon: Vault },
    { name: t('nav.reports'), to: '/reports', icon: FileSpreadsheet },
    { name: 'إدارة الموظفين', en: 'Employees', to: '/users', icon: Users },
    { name: 'إدارة الصلاحيات', en: 'Permissions', to: '/permissions', icon: ShieldCheck },
    { name: t('nav.settings'), to: '/settings', icon: Settings },
  ];

  const ribbonItems = allRibbonItems.filter(item => isAllowed(item.to));
  const navigation = allNavigation.filter(item => isAllowed(item.to));

  return (
    <div className="flex h-screen bg-slate-100 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col border-x border-slate-800">
        <div className="h-14 flex items-center gap-3 px-5 bg-slate-950 border-b border-slate-800">
          {tenant?.logo_base64 ? (
            <img src={tenant.logo_base64} alt="Logo" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
          ) : (
            <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-base">
              {isRTL ? 'م' : 'M'}
            </div>
          )}
          <div className="truncate">
            <h1 className="font-bold text-white tracking-wide text-xs">{tenant?.name || 'Motion Store'}</h1>
            <p className="text-[10px] text-emerald-400 font-mono">v1.0.0 PRO</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ' +
                  (isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')
                }
              >
                <Icon size={15} />
                <span>{isRTL ? item.name : (item.en || item.name)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-semibold">
              {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{user?.username}</p>
              <p className="text-[10px] text-emerald-400 font-mono">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
            title={t('nav.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP RIBBON BAR */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shadow-md">
          <div className="flex items-center gap-1.5 flex-nowrap">
            {ribbonItems.map((btn) => {
              const Icon = btn.icon;
              return (
                <NavLink
                  key={btn.to}
                  to={btn.to}
                  className={({ isActive }) =>
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition whitespace-nowrap ' +
                    (isActive
                      ? 'bg-emerald-600 text-white shadow-inner'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700')
                  }
                >
                  <Icon size={14} />
                  <span>{isRTL ? btn.name : (btn.en || btn.name)}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 transition cursor-pointer"
            >
              <Globe size={14} />
              <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              ● متصل
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

