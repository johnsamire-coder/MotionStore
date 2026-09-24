import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
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
  FileText
} from 'lucide-react';

export default function AppLayout() {
  const { user, tenant, logout } = useAuth();
  const { t, lang, isRTL, toggleLanguage } = useLanguage();

  const navigation = [
    { name: t('nav.dashboard'), to: '/', icon: BarChart3 },
    { name: t('nav.pos'), to: '/pos', icon: ShoppingCart },
    { name: 'المبيعات والمرتجعات', to: '/sales', icon: FileText },
    { name: t('nav.sorting'), to: '/sorting', icon: Layers },
    { name: t('nav.inventory'), to: '/inventory', icon: Package },
    { name: t('nav.purchasing'), to: '/purchasing', icon: Truck },
    { name: t('nav.shifts'), to: '/shifts', icon: Clock },
    { name: t('nav.treasury'), to: '/treasury', icon: Vault },
    { name: 'التسعير والعروض', to: '/pricing', icon: Tag },
    { name: t('nav.reports'), to: '/reports', icon: FileSpreadsheet },
    { name: t('nav.settings'), to: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-x border-slate-800">
        <div className="h-16 flex items-center gap-3 px-6 bg-slate-950 border-b border-slate-800">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-base">
            {isRTL ? 'م' : 'M'}
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wide text-sm">{t('nav.brand')}</h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{tenant?.name || t('nav.brandSub')}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-semibold">
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{user?.username}</p>
              <p className="text-[10px] text-emerald-400 font-mono tracking-wider">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
            title={t('nav.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Store size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800">{tenant?.name || t('nav.brand')}</span>
            <span>/</span>
            <span className="text-slate-600 text-xs">{t('nav.workspace')}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 rounded-xl text-xs font-black transition cursor-pointer shadow-md"
            >
              <Globe size={16} />
              <span>{lang === 'ar' ? 'English (EN)' : 'العربية (AR)'}</span>
            </button>

            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              ● {t('nav.onlineEngine')}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
