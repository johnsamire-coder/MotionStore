import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useLanguage } from '../context/LanguageContext';
import { Tag, Plus, Save, Search, CheckCircle2, Layers, DollarSign } from 'lucide-react';

export default function ProductCodingPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    barcode: '',
    wholesale_code: '',
    category: '',
    unit_of_measure: 'PIECE',
    purchase_price: '0.00',
    retail_price: '0.00',
    wholesale_price: '0.00',
    special_price: '0.00',
    carton_price: '0.00',
    carton_capacity: '1.000',
    min_stock_level: '0.000',
    opening_balance: '0.000',
    package_type: ''
  });

  const uomList = [
    { value: 'PIECE', label: 'قطعة / عدد' },
    { value: 'KG', label: 'كيلو / كجم' },
    { value: 'BOTH', label: 'قطعة + وزن' },
    { value: 'BALE', label: 'باله' },
    { value: 'DOZEN', label: 'دسته' },
    { value: 'CARTON', label: 'كرتونه' },
    { value: 'SACK', label: 'شيكارة' },
    { value: 'BARREL', label: 'برميل' },
    { value: 'BOX', label: 'علبة' },
    { value: 'JAR', label: 'برطمان' },
    { value: 'JERRYCAN', label: 'جركن' },
    { value: 'LITER', label: 'لتر' },
    { value: 'BAG', label: 'كيس' },
    { value: 'TANK', label: 'تنك' },
    { value: 'BUNDLE', label: 'هبط' },
    { value: 'SET', label: 'مجموعة' },
    { value: 'EMPTY', label: 'فوارغ' },
    { value: 'CARD', label: 'كارت' },
    { value: 'TOTE', label: 'شنطة' },
    { value: 'LIST', label: 'لسته' },
    { value: 'OTHER', label: 'غير محدد' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        axiosClient.get('/products/'),
        axiosClient.get('/categories/')
      ]);
      const pList = pRes.data.results || pRes.data || [];
      const cList = cRes.data.results || cRes.data || [];
      setProducts(pList);
      setCategories(cList);
      if (cList.length > 0) {
        setForm(prev => ({ ...prev, category: cList[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      alert('يرجى إدخال اسم الصنف');
      return;
    }
    if (!form.category) {
      alert('يرجى اختيار أو إنشاء تصنيف أولاً');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post('/products/', form);
      setSuccessMsg('تم حفظ وتكويد الصنف بنجاح ✅');
      setForm({
        name: '',
        code: '',
        barcode: '',
        wholesale_code: '',
        category: categories[0]?.id || '',
        unit_of_measure: 'PIECE',
        purchase_price: '0.00',
        retail_price: '0.00',
        wholesale_price: '0.00',
        special_price: '0.00',
        carton_price: '0.00',
        carton_capacity: '1.000',
        min_stock_level: '0.000',
        opening_balance: '0.000',
        package_type: ''
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'فشل حفظ الصنف');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Tag className="text-emerald-600" />
            شاشة تكويد وتسعير الأصناف (F4)
          </h1>
          <p className="text-xs text-slate-500 mt-1">تكويد المنتجات، تحديد أسعار الجملة والقطاعي، وسعة الكرتونة ووحدات القياس الـ 20</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="text-emerald-600" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-black text-slate-800 border-b pb-2">بيانات التكويد والأسعار</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف / الاستوك *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: تيشرت أوفر سايز زارا"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">كود الصنف</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="SKU-1001"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">الباركود الدولي</label>
              <input
                type="text"
                value={form.barcode}
                onChange={e => setForm({ ...form, barcode: e.target.value })}
                placeholder="EAN / Barcode"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف الرئيسي</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">وحدة القياس</label>
              <select
                value={form.unit_of_measure}
                onChange={e => setForm({ ...form, unit_of_measure: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold"
              >
                {uomList.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-600" />
              مصفوفة الأسعار والتكاليف (ج.م)
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">سعر الشراء</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-black text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-0.5">سعر البيع القطاعي</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.retail_price}
                  onChange={e => setForm({ ...form, retail_price: e.target.value })}
                  className="w-full bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-xs font-black text-emerald-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">سعر بيع الجملة</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.wholesale_price}
                  onChange={e => setForm({ ...form, wholesale_price: e.target.value })}
                  className="w-full bg-blue-50 border border-blue-300 rounded-lg p-2 text-xs font-black text-blue-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-700 mb-0.5">سعر بيع خاص</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.special_price}
                  onChange={e => setForm({ ...form, special_price: e.target.value })}
                  className="w-full bg-purple-50 border border-purple-300 rounded-lg p-2 text-xs font-black text-purple-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">سعر الكرتونة / الشيكارة</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.carton_price}
                  onChange={e => setForm({ ...form, carton_price: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5">الحد الأدنى للرصيد</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.min_stock_level}
                  onChange={e => setForm({ ...form, min_stock_level: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ وتكويد الصنف (F1)'}</span>
          </button>
        </form>

        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h2 className="text-sm font-black text-slate-800">قائمة الأصناف المكودة ({filteredProducts.length})</h2>
            <div className="relative w-64">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pr-9 pl-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black border-y">
                <tr>
                  <th className="p-2.5">الكود</th>
                  <th className="p-2.5">اسم الصنف</th>
                  <th className="p-2.5">التصنيف</th>
                  <th className="p-2.5">قطاعي</th>
                  <th className="p-2.5">جملة</th>
                  <th className="p-2.5">الحد الأدنى</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-2.5 font-mono font-bold text-slate-600">{p.code || p.barcode || '—'}</td>
                    <td className="p-2.5 font-black text-slate-900">{p.name}</td>
                    <td className="p-2.5 text-slate-500">{p.category_name || 'عام'}</td>
                    <td className="p-2.5 font-black text-emerald-700">{parseFloat(p.retail_price || 0).toFixed(2)}</td>
                    <td className="p-2.5 font-black text-blue-700">{parseFloat(p.wholesale_price || 0).toFixed(2)}</td>
                    <td className="p-2.5 text-slate-600">{p.min_stock_level || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
