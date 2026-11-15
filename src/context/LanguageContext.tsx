import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { VI_DICT, EN_DICT, ZH_CN_DICT } from './translations/viEnZh';
import { ZH_TW_DICT, JA_DICT, KO_DICT } from './translations/eastAsia';
import { FR_DICT, DE_DICT, ES_DICT, PT_DICT, RU_DICT } from './translations/europe';
import { AR_DICT, HI_DICT, ID_DICT, TH_DICT } from './translations/asiaMiddleEast';

export type LanguageCode =
  | 'vi'
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'de'
  | 'es'
  | 'pt'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'id'
  | 'th';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  flag: string;
  label: string;
}

export const WORLD_LANGUAGES: LanguageInfo[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', label: 'Việt Nam' },
  { code: 'en', name: 'English', flag: '🇺🇸', label: 'English' },
  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳', label: '简体中文' },
  { code: 'zh-TW', name: '中文 (繁體)', flag: '🇹🇼', label: '繁體中文' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', label: '日本' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', label: '한국' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', label: 'France' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', label: 'Deutschland' },
  { code: 'es', name: 'Español', flag: '🇪🇸', label: 'España' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', label: 'Brasil' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', label: 'Россия' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', label: 'العربية' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', label: 'भारत' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', label: 'Indonesia' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭', label: 'ประเทศไทย' },
];

const SUPPORTED_SET = new Set<LanguageCode>(WORLD_LANGUAGES.map((l) => l.code));

export function normalizeLanguageCode(raw?: string | null): LanguageCode {
  if (!raw) return 'vi';
  const trimmed = raw.trim();
  if (SUPPORTED_SET.has(trimmed as LanguageCode)) {
    return trimmed as LanguageCode;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'zh' || lower === 'zh_cn' || lower === 'zh-cn' || lower === 'zh-hans') return 'zh-CN';
  if (lower === 'zh_tw' || lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk') return 'zh-TW';
  const prefix = lower.split(/[-_]/)[0];
  if (SUPPORTED_SET.has(prefix as LanguageCode)) {
    return prefix as LanguageCode;
  }
  return 'vi';
}

export function getLocaleTag(lang: LanguageCode | string): string {
  const normalized = normalizeLanguageCode(lang);
  switch (normalized) {
    case 'vi': return 'vi-VN';
    case 'en': return 'en-US';
    case 'zh-CN': return 'zh-CN';
    case 'zh-TW': return 'zh-TW';
    case 'ja': return 'ja-JP';
    case 'ko': return 'ko-KR';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    case 'es': return 'es-ES';
    case 'pt': return 'pt-BR';
    case 'ru': return 'ru-RU';
    case 'ar': return 'ar-SA';
    case 'hi': return 'hi-IN';
    case 'id': return 'id-ID';
    case 'th': return 'th-TH';
    default: return 'vi-VN';
  }
}

export function pickLang<T = string>(
  lang: LanguageCode | string,
  vi: T,
  en: T,
  zhCN?: T,
  extra?: Partial<Record<LanguageCode, T>>
): T {
  const normalized = normalizeLanguageCode(lang);
  if (extra && extra[normalized] !== undefined) {
    return extra[normalized]!;
  }
  if (normalized === 'vi') return vi;
  if (normalized === 'zh-CN') return zhCN !== undefined ? zhCN : en;
  if (normalized === 'zh-TW') return extra?.['zh-TW'] ?? (zhCN !== undefined ? zhCN : en);
  return en;
}

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  vi: VI_DICT,
  en: EN_DICT,
  'zh-CN': ZH_CN_DICT,
  'zh-TW': ZH_TW_DICT,
  ja: JA_DICT,
  ko: KO_DICT,
  fr: FR_DICT,
  de: DE_DICT,
  es: ES_DICT,
  pt: PT_DICT,
  ru: RU_DICT,
  ar: AR_DICT,
  hi: HI_DICT,
  id: ID_DICT,
  th: TH_DICT,
};

interface LanguageContextType {
  currentLang: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLang, setCurrentLangState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('app_language');
      if (saved) {
        const normalized = normalizeLanguageCode(saved);
        if (saved !== normalized) {
          try { localStorage.setItem('app_language', normalized); } catch {}
        }
        return normalized;
      }
    } catch {}
    return 'vi';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [currentLang]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    const normalized = normalizeLanguageCode(lang);
    setCurrentLangState(normalized);
    try {
      localStorage.setItem('app_language', normalized);
    } catch {}
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[currentLang];
    if (dict && dict[key]) {
      return dict[key];
    }
    if (currentLang !== 'vi' && EN_DICT[key]) {
      return EN_DICT[key];
    }
    if (VI_DICT[key]) {
      return VI_DICT[key];
    }
    return fallback || key;
  }, [currentLang]);

  const contextValue = useMemo(() => ({
    currentLang,
    setLanguage,
    t,
    languages: WORLD_LANGUAGES,
  }), [currentLang, setLanguage, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
