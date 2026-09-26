import React, { useState } from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { exportToPDF, exportToExcel } from '../utils/reportExport';

export default function ExportButtons({ getReport, disabled }) {
  const { isRTL } = useLanguage();
  const [busy, setBusy] = useState(null);

  const run = async (kind) => {
    if (busy) return;
    const report = getReport ? getReport() : null;
    if (!report || !report.rows || report.rows.length === 0) {
      alert(isRTL ? 'مفيش بيانات للتصدير' : 'No data to export');
      return;
    }
    setBusy(kind);
    try {
      const args = { ...report, isRTL };
      if (kind === 'pdf') await exportToPDF(args);
      else await exportToExcel(args);
    } catch (e) {
      console.error(e);
      alert((isRTL ? 'فشل التصدير: ' : 'Export failed: ') + (e?.message || ''));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={disabled || !!busy}
        onClick={() => run('pdf')}
        className="h-10 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        <FileText size={15} /> {busy === 'pdf' ? '...' : 'PDF'}
      </button>
      <button
        type="button"
        disabled={disabled || !!busy}
        onClick={() => run('excel')}
        className="h-10 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        <FileSpreadsheet size={15} /> {busy === 'excel' ? '...' : 'Excel'}
      </button>
    </div>
  );
}