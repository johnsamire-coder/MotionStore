import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Settings, Building2, Store, Warehouse, Upload, Save, CheckCircle2, Plus, Image as ImageIcon, Edit2, Trash2, ShieldAlert, X, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { user, tenant, updateTenant } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('COMPANY'); // COMPANY | BRANCHES | WAREHOUSES

  // Data States
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Password Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Edit Modals
  const [editingBranch, setEditingBranch] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // Tab 1: Company Profile Form & Saved Baseline
  const [companyForm, setCompanyForm] = useState({
    name: tenant?.name || 'Motion Store',
    logo_base64: tenant?.logo_base64 || ''
  });

  const [savedCompanyForm, setSavedCompanyForm] = useState({
    name: tenant?.name || 'Motion Store',
    logo_base64: tenant?.logo_base64 || ''
  });

  // Tab 2: New Branch Form
  const [branchForm, setBranchForm] = useState({
    name: '', code: '', phone: '', address: ''
  });

  // Tab 3: New Warehouse Form
  const [warehouseForm, setWarehouseForm] = useState({
    name: '', code: '', branch: '', warehouse_type: 'MAIN'
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
        const info = {
          name: tRes.data.name,
          logo_base64: tRes.data.logo_base64 || ''
        };
        setCompanyForm(info);
        setSavedCompanyForm(info);
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Verify Admin Password via Auth Login
  const requireSecurityVerification = (actionCallback) => {
    setPendingAction(() => actionCallback);
    setAdminPassword('');
    setShowSecurityModal(true);
  };

  const handleConfirmSecurity = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) return;

    try {
      await axiosClient.post('/auth/login/', {
        username: user?.username || 'admin',
        password: adminPassword.trim()
      });

      setShowSecurityModal(false);
      if (pendingAction) {
        pendingAction();
      }
    } catch (err) {
      alert(t('settings.invalidPass'));
    }
  };

  // Logo Upload
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(t('settings.logoSizeError'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyForm(prev => ({ ...prev, logo_base64: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Check if company name or logo has changed from baseline
  const hasCompanyChanged = 
    companyForm.name.trim() !== savedCompanyForm.name.trim() ||
    companyForm.logo_base64 !== savedCompanyForm.logo_base64;

  // Save Company Profile with Manager Password Requirement
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return alert(t('settings.nameRequired'));
    if (!hasCompanyChanged) return;

    requireSecurityVerification(async () => {
      setSaving(true);
      try {
        const tenantId = tenant?.id || localStorage.getItem('tenant_id');
        const res = await axiosClient.patch('/tenants/' + tenantId + '/', {
          name: companyForm.name.trim(),
          logo_base64: companyForm.logo_base64
        });

        const updatedInfo = {
          name: res.data.name,
          logo_base64: res.data.logo_base64
        };

        if (updateTenant) {
          updateTenant(updatedInfo);
        }

        setCompanyForm(updatedInfo);
        setSavedCompanyForm(updatedInfo);

        setSuccessMsg(t('settings.companySuccess'));
        fetchSettingsData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        alert(t('settings.companyError'));
      } finally {
        setSaving(false);
      }
    });
  };

  // Create Branch
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim()) return alert(t('settings.branchNameRequired'));

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

      setSuccessMsg(t('settings.branchSuccess'));
      setBranchForm({ name: '', code: '', phone: '', address: '' });
      fetchSettingsData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(t('settings.branchError'));
    } finally {
      setSaving(false);
    }
  };

  // Update Branch
  const handleUpdateBranch = async (e) => {
    e.preventDefault();
    requireSecurityVerification(async () => {
      try {
        await axiosClient.patch('/branches/' + editingBranch.id + '/', editingBranch);
        setEditingBranch(null);
        setSuccessMsg('تم تحديث بيانات الفرع بنجاح ✅');
        fetchSettingsData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        alert('فشل تعديل الفرع');
      }
    });
  };

  // Delete Branch
  const handleDeleteBranch = (b) => {
    if (!window.confirm(t('settings.confirmDeleteBranch'))) return;
    requireSecurityVerification(async () => {
      try {
        await axiosClient.delete('/branches/' + b.id + '/');
        setSuccessMsg('تم حذف الفرع بنجاح ✅');
        fetchSettingsData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        alert('لا يمكن حذف الفرع لاحتوائه على بيانات حية');
      }
    });
  };

  // Create Warehouse
  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.branch) return alert(t('settings.warehouseNameRequired'));

    setSaving(true);
    try {
      await axiosClient.post('/warehouses/', {
        branch: warehouseForm.branch,
        name: warehouseForm.name.trim(),
        code: warehouseForm.code || ('WH-' + (warehouses.length + 1)),
        warehouse_type: warehouseForm.warehouse_type
      });

      setSuccessMsg(t('settings.warehouseSuccess'));
      setWarehouseForm({ name: '', code: '', branch: branches[0]?.id || '', warehouse_type: 'MAIN' });
      fetchSettingsData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(t('settings.warehouseError'));
    } finally {
      setSaving(false);
    }
  };

  // Update Warehouse
  const handleUpdateWarehouse = async (e) => {
    e.preventDefault();
    requireSecurityVerification(async () => {
      try {
        await axiosClient.patch('/warehouses/' + editingWarehouse.id + '/', editingWarehouse);
        setEditingWarehouse(null);
        setSuccessMsg('تم تحديث بيانات المخزن بنجاح ✅');
        fetchSettingsData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        alert('فشل تعديل المخزن');
      }
    });
  };

  // Delete Warehouse
  const handleDeleteWarehouse = (w) => {
    if (!window.confirm(t('settings.confirmDeleteWarehouse'))) return;
    requireSecurityVerification(async () => {
      try {
        await axiosClient.delete('/warehouses/' + w.id + '/');
        setSuccessMsg('تم حذف المخزن بنجاح ✅');
        fetchSettingsData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        alert('لا يمكن حذف المخزن لاحتوائه على بضائع مسجلة');
      }
    });
  };

  return (
    <div className="space-y-6 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Header & Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Settings className="text-emerald-600" size={22} />
            {t('settings.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('COMPANY')}
            className={'px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ' + (activeTab === 'COMPANY' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900')}
          >
            <Building2 size={15} />
            <span>{t('settings.tabCompany')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BRANCHES')}
            className={'px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ' + (activeTab === 'BRANCHES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900')}
          >
            <Store size={15} />
            <span>{t('settings.tabBranches')} ({branches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WAREHOUSES')}
            className={'px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ' + (activeTab === 'WAREHOUSES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900')}
          >
            <Warehouse size={15} />
            <span>{t('settings.tabWarehouses')} ({warehouses.length})</span>
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
            {t('settings.companyTitle')}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.companyName')}</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">{t('settings.logoLabel')}</label>
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
                    <span>{t('settings.uploadLogo')}</span>
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                  <p className="text-[11px] text-slate-400">{t('settings.logoHelp')}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!hasCompanyChanged || saving}
            className={'w-full py-3.5 rounded-xl font-black text-sm shadow-md transition flex items-center justify-center gap-2 ' + (
              hasCompanyChanged
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer animate-pulse'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <Save size={18} />
            <span>
              {saving
                ? t('settings.saving')
                : (hasCompanyChanged ? t('settings.saveCompanyBtn') : 'محفوظ ✓')}
            </span>
          </button>
        </form>
      )}

      {/* TAB 2: BRANCHES MANAGEMENT */}
      {activeTab === 'BRANCHES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateBranch} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2">
              <Plus className="text-emerald-600" size={18} />
              {t('settings.addBranchTitle')}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchName')}</label>
                <input
                  type="text"
                  placeholder={t('settings.branchNamePlaceholder')}
                  value={branchForm.name}
                  onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchCode')}</label>
                <input
                  type="text"
                  placeholder="BR-02"
                  value={branchForm.code}
                  onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchPhone')}</label>
                <input
                  type="text"
                  placeholder="01507092909"
                  value={branchForm.phone}
                  onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchAddress')}</label>
                <input
                  type="text"
                  placeholder={t('settings.branchAddressPlaceholder')}
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
              <span>{saving ? t('settings.saving') : t('settings.saveBranchBtn')}</span>
            </button>
          </form>

          {/* Branches List Table with Edit/Delete */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-3 flex items-center gap-2">
              <Store className="text-emerald-600" size={18} />
              {t('settings.branchesListTitle')} ({branches.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-3">{t('settings.colBranchCode')}</th>
                    <th className="p-3">{t('settings.colBranchName')}</th>
                    <th className="p-3">{t('settings.colPhone')}</th>
                    <th className="p-3 text-center">{t('settings.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {branches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-600">{b.code || 'BR-01'}</td>
                      <td className="p-3 font-black text-slate-900">{b.name}</td>
                      <td className="p-3 text-slate-600">{b.phone || '—'}</td>
                      <td className="p-3 text-center space-x-2 space-x-reverse">
                        <button
                          type="button"
                          onClick={() => setEditingBranch(b)}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          <span>{t('settings.edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(b)}
                          className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>{t('settings.delete')}</span>
                        </button>
                      </td>
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
              {t('settings.addWarehouseTitle')}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.selectBranch')}</label>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.warehouseName')}</label>
                <input
                  type="text"
                  placeholder={t('settings.warehouseNamePlaceholder')}
                  value={warehouseForm.name}
                  onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.warehouseType')}</label>
                <select
                  value={warehouseForm.warehouse_type}
                  onChange={e => setWarehouseForm({ ...warehouseForm, warehouse_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                >
                  <option value="MAIN">{t('settings.typeMain')}</option>
                  <option value="SORTING">{t('settings.typeSorting')}</option>
                  <option value="TRANSIT">{t('settings.typeTransit')}</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>{saving ? t('settings.saving') : t('settings.saveWarehouseBtn')}</span>
            </button>
          </form>

          {/* Warehouses List Table with Edit/Delete */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b pb-3 flex items-center gap-2">
              <Warehouse className="text-emerald-600" size={18} />
              {t('settings.warehousesListTitle')} ({warehouses.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-y">
                  <tr>
                    <th className="p-3">{t('settings.colWarehouseName')}</th>
                    <th className="p-3">{t('settings.colWarehouseType')}</th>
                    <th className="p-3">{t('settings.colParentBranch')}</th>
                    <th className="p-3 text-center">{t('settings.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {warehouses.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-slate-900">{w.name}</td>
                      <td className="p-3 font-bold text-slate-600">{w.warehouse_type}</td>
                      <td className="p-3 text-slate-500 font-bold">{w.branch_name || t('settings.mainBranchFallback')}</td>
                      <td className="p-3 text-center space-x-2 space-x-reverse">
                        <button
                          type="button"
                          onClick={() => setEditingWarehouse(w)}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          <span>{t('settings.edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWarehouse(w)}
                          className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>{t('settings.delete')}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY PASSWORD CONFIRMATION MODAL */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleConfirmSecurity} className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 text-rose-700 font-black text-sm">
              <span className="flex items-center gap-1.5"><ShieldAlert size={18}/> {t('settings.securityTitle')}</span>
              <button type="button" onClick={() => setShowSecurityModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            <p className="text-xs text-slate-600 font-bold">{t('settings.securityDesc')}</p>

            <div className="relative">
              <Lock size={16} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-10 pl-3 py-2.5 text-sm font-black text-slate-900 focus:ring-2 focus:ring-rose-500"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-black text-xs shadow transition cursor-pointer"
              >
                تأكيد واعتماد الإجراء
              </button>
              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT BRANCH MODAL */}
      {editingBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateBranch} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800 text-sm">
              <span className="flex items-center gap-1.5"><Edit2 size={18}/> {t('settings.editBranchTitle')}</span>
              <button type="button" onClick={() => setEditingBranch(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchName')}</label>
                <input
                  type="text"
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchPhone')}</label>
                <input
                  type="text"
                  value={editingBranch.phone || ''}
                  onChange={e => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.branchAddress')}</label>
                <input
                  type="text"
                  value={editingBranch.address || ''}
                  onChange={e => setEditingBranch({ ...editingBranch, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black text-xs shadow transition cursor-pointer"
              >
                تأكيد تعديل الفرع
              </button>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT WAREHOUSE MODAL */}
      {editingWarehouse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateWarehouse} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3 font-black text-slate-800 text-sm">
              <span className="flex items-center gap-1.5"><Edit2 size={18}/> {t('settings.editWarehouseTitle')}</span>
              <button type="button" onClick={() => setEditingWarehouse(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.warehouseName')}</label>
                <input
                  type="text"
                  value={editingWarehouse.name}
                  onChange={e => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('settings.warehouseType')}</label>
                <select
                  value={editingWarehouse.warehouse_type}
                  onChange={e => setEditingWarehouse({ ...editingWarehouse, warehouse_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                >
                  <option value="MAIN">{t('settings.typeMain')}</option>
                  <option value="SORTING">{t('settings.typeSorting')}</option>
                  <option value="TRANSIT">{t('settings.typeTransit')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black text-xs shadow transition cursor-pointer"
              >
                تأكيد تعديل المخزن
              </button>
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
