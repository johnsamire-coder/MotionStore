import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { Settings, Building2, Store, Warehouse, Upload, Save, CheckCircle2, Plus, Image as ImageIcon, Phone, MapPin } from 'lucide-react';

export default function SettingsPage() {
  const { user, tenant, updateTenant } = useAuth();
  const [activeTab, setActiveTab] = useState('COMPANY'); // COMPANY | BRANCHES | WAREHOUSES

  // Data States
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Tab 1: Company Profile Form
  const [companyForm, setCompanyForm] = useState({
    name: tenant?.name || 'Motion Store',
    logo_base64: tenant?.logo_base64 || ''
  });

  // Tab 2: New Branch Form
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    phone: '',
    address: ''
  });

  // Tab 3: New Warehouse Form
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    code: '',
    branch: '',
    warehouse_type: 'MAIN'
  });

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, tRes] = await Promise.all([
        axiosClient.get('/branches/'),
        axiosClient.get('/warehouses/'),
        axiosClient.get('/tenants/public_info/')
      ]);
      const bList = bRes.data.results || bRes.data || [];
      const wList = wRes.data.results || wRes.data || [];
      setBranches(bList);
      setWarehouses(wList);
      if (bList.length > 0) {
        setWarehouseForm(prev => ({ ...prev, branch: bList[0].id }));
      }

      if (tRes.data && tRes.data.name) {
        setCompanyForm({
          name: tRes.data.name,
          logo_base64: tRes.data.logo_base64 || ''
        });
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Logo Upload to Base64
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyForm(prev => ({ ...prev, logo_base64: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Company Profile & Logo
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return alert('يرجى إدخال اسم المنشأة');

    setSaving(true);
    try {
      const tenantId = tenant?.id || localStorage.getItem('tenant_id');
      const targetUrl = '/tenants/' + tenantId + '/';
      const res = await axiosClient.patch(targetUrl, {
        name: companyForm.name.trim(),
        logo_base64: companyForm.logo_base64
      });

      // Update AuthContext & localStorage to persist across navigations
      if (updateTenant) {
        updateTenant({
          name: res.data.name,
          logo_base64: res.data.logo_base64
        });
      }

      setSuccessMsg('تم حفظ وتثبيت بيانات المنشأة واللوجو بنجاح ✅');
      fetchSettingsData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء حفظ بيانات المنشأة');
    } finally {
      setSaving(false);
    }
  };

  // Save New Branch
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim()) return alert('يرجى إدخال اسم الفرع');

    setSaving(true);
    try {
      const companyRes = await axiosClient.get('/companies/');
      const companyId = (companyRes.data.results || companyRes.data || [])[0]?.id;

      await axiosClient.post('/branches/', {
        company: companyId,
        name: branchForm.name.trim(),
        code: branchForm.code || ('BR-' + (branches.length + 1)),
        phone: branchForm.phone,
        address: branchForm.address
      });

      setSuccessMsg('تم إضافة الفرع الجديد (' + branchForm.name + ') بنجاح ✅');
      setBranchForm({ name: '', code: '', phone: '', address: '' });
      fetchSettingsData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل إضافة الفرع الجديد');
    } finally {
      setSaving(false);
    }
  };

  // Save New Warehouse
  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.branch) return alert('أكمل بيانات المخزن والفرع');

    setSaving(true);
    try {
      await axiosClient.post('/warehouses/', {
        branch: warehouseForm.branch,
        name: warehouseForm.name.trim(),
        code: warehouseForm.code || ('WH-' + (warehouses.length + 1)),
        warehouse_type: warehouseForm.warehouse_type
      });

      setSuccessMsg('تم إضافة المخزن الجديد (' + warehouseForm.name + ') بنجاح ✅');
      setWarehouseForm({ name: '', code: '', branch: branches[0]?.id || '', warehouse_type: 'MAIN' });
      fetchSettingsData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('فشل إضافة المخزن الجديد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header & Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Settings className="text-emerald-600" size={22} />
            شاشة الإعدادات العامة والمنشأة والفروع
          </h1>
          <p className="text-xs text-slate-500 mt-1">تعديل اسم الشركة واللوجو، إضافة الفروع والمخازن الجديدة وتثبيتها بالكامل</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('COMPANY')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMPANY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={15} />
            <span>1. المنشأة واللوجو</span>
          </button>

          <button
            onClick={() => setActiveTab('BRANCHES')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BRANCHES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store size={15} />
            <span>2. إدارة الفروع ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('WAREHOUSES')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'WAREHOUSES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Warehouse size={15} />
            <span>3. إدارة المخازن ({warehouses.length})</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="text-emerald-600" size={18} />
          {successMsg}
        </div>
      )}

      {/* TAB 1: COMPANY PROFILE & LOGO */}
      {activeTab === 'COMPANY' && (
        <form onSubmit={handleSaveCompany} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-2xl space-y-6">
          <h2 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={18} />
            بيانات المنشأة الرسمية واللوجو
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم المنشأة / الشركة الرسمية *</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">لوجو الشركة (يظهر في القائمة والتقارير المطبوعة):</label>
              <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                  {companyForm.logo_base64 ? (
                    <img src={companyForm.logo_base64} alt="Company Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="text-slate-300" size={32} />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer shadow-md transition">
                    <Upload size={15} />
                    <span>رفع لوجو جديد من الجهاز</span>
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                  <p className="text-[11px] text-slate-400">الصيغ المتاحة: PNG, JPG, WEBP — بحد أقصى 2 ميجابايت</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <Save size={18} />
            <span>{saving ? 'جاري الحفظ والربط...' : 'حفظ وتثبيت بيانات المنشأة واللوجو'}</span>
          </button>
        </form>
      )}

      {/* TAB 2: BRANCHES MANAGEMENT */}
      {activeTab === 'BRANCHES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateBranch} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2">
              <Plus className="text-emerald-600" size={18} />
              إضافة فرع جديد للشركة
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الفرع *</label>
                <input
                  type="text"
                  placeholder="مثال: فرع الجولف / فرع ألكس"
                  value={branchForm.name}
                  onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">كود الفرع</label>
                <input
                  type="text"
                  placeholder="BR-02"
                  value={branchForm.code}
                  onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">رقم تليفون الفرع</label>
                <input
                  type="text"
                  placeholder="01507092909"
                  value={branchForm.phone}
                  onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">العنوان التفصيلي</label>
                <input
                  type="text"
                  placeholder="8 أحمد الدرديري - أرض الجولف"
                  value={branchForm.address}
                  onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ وإضافة الفرع'}</span>
            </button>
          </form>

          {/* Branches List */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-3 flex items-center gap-2">
              <Store className="text-emerald-600" size={18} />
              قائمة الفروع الحالية للشركة ({branches.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-3">كود الفرع</th>
                    <th className="p-3">اسم الفرع</th>
                    <th className="p-3">التليفون</th>
                    <th className="p-3">العنوان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {branches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-600">{b.code || 'BR-01'}</td>
                      <td className="p-3 font-black text-slate-900">{b.name}</td>
                      <td className="p-3 text-slate-600">{b.phone || '—'}</td>
                      <td className="p-3 text-slate-500">{b.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WAREHOUSES MANAGEMENT */}
      {activeTab === 'WAREHOUSES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateWarehouse} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2">
              <Plus className="text-emerald-600" size={18} />
              إضافة مخزن جديد
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اختر الفرع التابع له المخزن *</label>
                <select
                  value={warehouseForm.branch}
                  onChange={e => setWarehouseForm({ ...warehouseForm, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800"
                  required
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم المخزن *</label>
                <input
                  type="text"
                  placeholder="مثال: مخزن الفرز الرئيسي / مخزن المعرض"
                  value={warehouseForm.name}
                  onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">نوع المخزن *</label>
                <select
                  value={warehouseForm.warehouse_type}
                  onChange={e => setWarehouseForm({ ...warehouseForm, warehouse_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                >
                  <option value="MAIN">مخزن بيع رئيسي (MAIN)</option>
                  <option value="SORTING">مخزن فرز واستلام بالات (SORTING)</option>
                  <option value="TRANSIT">مخزن عبور وتحويلات (TRANSIT)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ وإضافة المخزن'}</span>
            </button>
          </form>

          {/* Warehouses List */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-3 flex items-center gap-2">
              <Warehouse className="text-emerald-600" size={18} />
              قائمة المخازن المفعّلة للشركة ({warehouses.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-3">اسم المخزن</th>
                    <th className="p-3">نوع المخزن</th>
                    <th className="p-3">الفرع التابع له</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {warehouses.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-slate-900">{w.name}</td>
                      <td className="p-3 font-bold text-slate-600">{w.warehouse_type}</td>
                      <td className="p-3 text-slate-500 font-bold">{w.branch_name || 'الفرع الرئيسي'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
