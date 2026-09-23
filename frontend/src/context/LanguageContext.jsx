import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

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

  const t = (path) => {
    if (!path) return '';
    const keys = path.split('.');
    let current = translations[lang];
    for (const k of keys) {
      if (current && current[k] !== undefined) {
        current = current[k];
      } else {
        let fallback = translations['en'];
        for (const fk of keys) {
          if (fallback && fallback[fk] !== undefined) {
            fallback = fallback[fk];
          } else {
            return path;
          }
        }
        return fallback;
      }
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ lang, isRTL: lang === 'ar', toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
