import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  Settings
} from 'lucide-react';

export default function AppLayout() {
  const { user, tenant, logout } = useAuth();

  const navigation = [
    { name: 'لوحة المؤشرات', to: '/', icon: BarChart3 },
    { name: 'نقطة البيع (الكاشير)', to: '/pos', icon: ShoppingCart },
    { name: 'ساحة فرز البالات', to: '/sorting', icon: Layers },
    { name: 'المخزون التام والحركات', to: '/inventory', icon: Package },
    { name: 'المشتريات والبالات الخام', to: '/purchasing', icon: Truck },
    { name: 'الورديات وتسليم العهدة', to: '/shifts', icon: Clock },
    { name: 'الخزائن والصناديق', to: '/treasury', icon: Vault },
    { name: 'التقارير وقائمة الدخل', to: '/reports', icon: FileSpreadsheet },
    { name: 'إعدادات النظام والسياسات', to: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800">
        <div className="h-16 flex items-center gap-3 px-6 bg-slate-950 border-b border-slate-800">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-base">
            م
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wide text-sm">موشن ستور</h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{tenant?.name || 'إدارة البالات والملابس'}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
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

        {/* User Footer */}
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
            title="تسجيل الخروج"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Store size={16} className="text-emerald-600" />
            <span className="font-bold text-slate-800">{tenant?.name || 'موشن ستور الإسكندرية'}</span>
            <span>/</span>
            <span className="text-slate-600 text-xs">مساحة العمل التشغيلية</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              ● النظام متصل ويعمل
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
