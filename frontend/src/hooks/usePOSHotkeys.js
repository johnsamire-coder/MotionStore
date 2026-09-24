import { useEffect } from 'react';

export const usePOSHotkeys = ({ onSave, onNew, onQuickSearch }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // منع المتصفح من استخدام زراير F1 أو F7 وتوجيهها للحفظ
            if (e.key === 'F1' || e.key === 'F7') {
                e.preventDefault();
                if (onSave) onSave();
            }
            // منع المتصفح من البحث وتوجيه F3 لفاتورة جديدة
            if (e.key === 'F3') {
                e.preventDefault();
                if (onNew) onNew();
            }
            // نجمة النامباد أو Shift+8 للبحث السريع أو صنف مفضل
            if (e.key === '*') {
                e.preventDefault();
                if (onQuickSearch) onQuickSearch();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        // تنظيف الحدث عند الخروج من شاشة الكاشير
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onSave, onNew, onQuickSearch]);
};