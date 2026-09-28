import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function CostingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // الحالة الحالية والحالة المحفوظة لمقارنة التغييرات
  const [form, setForm] = useState({
    method: 'WEIGHT',
    high_grade_pct: 55,
    mid_grade_pct: 30,
    liquidation_grade_pct: 10,
    waste_grade_pct: 5,
  });

  const [savedForm, setSavedForm] = useState({
    method: 'WEIGHT',
    high_grade_pct: 55,
    mid_grade_pct: 30,
    liquidation_grade_pct: 10,
    waste_grade_pct: 5,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/costing-config/current/');
      if (res.data) {
        const loadedData = {
          method: res.data.method || 'WEIGHT',
          high_grade_pct: Number(res.data.high_grade_pct) || 55,
          mid_grade_pct: Number(res.data.mid_grade_pct) || 30,
          liquidation_grade_pct: Number(res.data.liquidation_grade_pct) || 10,
          waste_grade_pct: Number(res.data.waste_grade_pct) || 5,
        };
        setForm(loadedData);
        setSavedForm(loadedData);
      }
    } catch (err) {
      console.error('Failed to load costing config', err);
    } finally {
      setLoading(false);
    }
  };

  // المجموع للنسب
  const totalPct =
    Number(form.high_grade_pct || 0) +
    Number(form.mid_grade_pct || 0) +
    Number(form.liquidation_grade_pct || 0) +
    Number(form.waste_grade_pct || 0);

  const isPctValid = form.method !== 'PERCENTAGE' || Math.abs(totalPct - 100) < 0.01;

  // فحص هل فيه تغيير حصل عن المحفوظ؟
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (form.method === 'PERCENTAGE' && !isPctValid) {
      setMsg({
        type: 'error',
        text: `⚠️ مجموع نسب الدرجات يجب أن يساوي 100% تماماً! (المجموع الحالي: ${totalPct.toFixed(1)}%)`,
      });
      return;
    }

    try {
      setSaving(true);
      await axiosClient.patch('/costing-config/current/', {
        method: form.method,
        high_grade_pct: form.high_grade_pct,
        mid_grade_pct: form.mid_grade_pct,
        liquidation_grade_pct: form.liquidation_grade_pct,
        waste_grade_pct: form.waste_grade_pct,
      });

      // تحيين الحالة المحفوظة لتطابق الحالية وتفعيل اللون الرمادي
      setSavedForm({ ...form });
      setMsg({ type: 'success', text: '🎉 تم تغيير وتطبيق سياسة التكلفة بنجاح!' });
      setTimeout(() => setMsg({ type: '', text: '' }), 5000);
    } catch (err) {
      const serverErr =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        'حدث خطأ أثناء حفظ الإعدادات.';
      setMsg({ type: 'error', text: `❌ ${serverErr}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-500 font-bold">جاري تحميل سياسة التكلفة...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
        <span className="text-2xl">⚖️</span>
        <div>
          <h3 className="text-lg font-bold text-slate-800">طريقة وسياسة حساب التكلفة (Costing Policy)</h3>
          <p className="text-xs text-slate-500">
            تحديد كيفية توزيع تكلفة الشراء على مخرجات الفرز وتسجيل نصيب الهالك في الحسابات
          </p>
        </div>
      </div>

      {msg.text && (
        <div
          className={`mb-5 p-3 rounded-lg text-sm font-bold ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            اختر طريقة حساب التكلفة المعتمدة:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. بالوزن */}
            <label
              className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.method === 'WEIGHT'
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">1. بالوزن</span>
                <input
                  type="radio"
                  name="costMethod"
                  value="WEIGHT"
                  checked={form.method === 'WEIGHT'}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-4 h-4 text-emerald-600"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                كل كيلو من البالة يحصل على نفس التكلفة بالتساوي (الأكثر شيوعاً ومطابقة للواقع).
              </p>
            </label>

            {/* 2. بالقطعة */}
            <label
              className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.method === 'PIECE'
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">2. بالقطعة</span>
                <input
                  type="radio"
                  name="costMethod"
                  value="PIECE"
                  checked={form.method === 'PIECE'}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-4 h-4 text-emerald-600"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                كل قطعة مفروزة تحصل على نفس التكلفة بالتساوي بغض النظر عن وزنها.
              </p>
            </label>

            {/* 3. بنسب الدرجات */}
            <label
              className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.method === 'PERCENTAGE'
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800">3. بنسب الدرجات</span>
                <input
                  type="radio"
                  name="costMethod"
                  value="PERCENTAGE"
                  checked={form.method === 'PERCENTAGE'}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-4 h-4 text-emerald-600"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                توزيع التكلفة بنسب محددة مسبقاً لكل درجة من درجات الفرز الأربعة.
              </p>
            </label>
          </div>
        </div>

        {/* خانات النسب إذا تم اختيار الطريقة الثالثة */}
        {form.method === 'PERCENTAGE' && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-800">
                حدد نسب توزيع التكلفة على الدرجات الأربعة:
              </h4>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isPctValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                المجموع: {totalPct.toFixed(1)}% {isPctValid ? '✓' : '(يجب أن يكون 100%)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">عالي %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.high_grade_pct}
                  onChange={(e) => setForm({ ...form, high_grade_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">وسط %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.mid_grade_pct}
                  onChange={(e) => setForm({ ...form, mid_grade_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تصفيات %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.liquidation_grade_pct}
                  onChange={(e) => setForm({ ...form, liquidation_grade_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-600 mb-1">هالك % (خسارة فرز)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.waste_grade_pct}
                  onChange={(e) => setForm({ ...form, waste_grade_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-rose-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-bold text-rose-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* تنبيه معالجة الهالك */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
          <span>💡</span>
          <div>
            <strong>معالجة الهالك في الحسابات:</strong>
            <p className="mt-0.5 text-amber-800">
              مهما كانت الطريقة المختارة، يتم توزيع تكلفة الشراء بالكامل على الأربعة درجات من البداية، ويتم تسجيل نصيب الهالك كبند مستقل في الحسابات باسم <strong>"خسارة هالك الفرز"</strong>.
            </p>
          </div>
        </div>

        {/* الزرار الأخضر والرمادي وحالة التعديل */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !isDirty || (form.method === 'PERCENTAGE' && !isPctValid)}
            className={`px-6 py-2.5 font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${
              !isDirty || (form.method === 'PERCENTAGE' && !isPctValid)
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-200'
            }`}
          >
            {saving ? (
              'جاري الحفظ...'
            ) : !isDirty ? (
              '✓ تم تطبيق السياسة'
            ) : (
              '💾 حفظ وتطبيق سياسة التكلفة'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}