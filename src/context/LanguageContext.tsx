import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { VI_DICT, EN_DICT, ZH_CN_DICT } from './translations/viEnZh';
import { ZH_CN_PHRASES } from './translations/zhCnPhrases';
import { ZH_TW_DICT, ZH_TW_PHRASES } from './translations/phrases/zhTw';
import { JA_DICT, JA_PHRASES } from './translations/phrases/ja_2';
import { KO_DICT, KO_PHRASES } from './translations/phrases/ko_2';
import { FR_DICT, FR_PHRASES } from './translations/phrases/fr_2';
import { DE_DICT, DE_PHRASES } from './translations/phrases/de_2';
import { ES_DICT, ES_PHRASES } from './translations/phrases/es_2';
import { PT_DICT, PT_PHRASES } from './translations/phrases/pt_2';
import { RU_DICT, RU_PHRASES } from './translations/phrases/ru_2';
import { AR_DICT, AR_PHRASES } from './translations/phrases/ar_2';
import { HI_DICT, HI_PHRASES } from './translations/phrases/hi_2';
import { ID_DICT, ID_PHRASES } from './translations/phrases/id_2';
import { TH_DICT, TH_PHRASES } from './translations/phrases/th_2';
import { IT_DICT, IT_PHRASES } from './translations/phrases/it_2';
import { NL_DICT, NL_PHRASES } from './translations/phrases/nl_2';
import { TR_DICT, TR_PHRASES } from './translations/phrases/tr_2';
import { PL_DICT, PL_PHRASES } from './translations/phrases/pl_2';
import { UK_DICT, UK_PHRASES } from './translations/phrases/uk_2';
import { FA_DICT, FA_PHRASES } from './translations/phrases/fa_2';
import { HE_DICT, HE_PHRASES } from './translations/phrases/he_2';
import { UR_DICT, UR_PHRASES } from './translations/phrases/ur_2';
import { BN_DICT, BN_PHRASES } from './translations/phrases/bn_2';
import { MS_DICT, MS_PHRASES } from './translations/phrases/ms_2';
import { FIL_DICT, FIL_PHRASES } from './translations/phrases/fil_2';
import { SW_DICT, SW_PHRASES } from './translations/phrases/sw_2';
import { EL_DICT, EL_PHRASES } from './translations/phrases/el_2';
import { CS_DICT, CS_PHRASES } from './translations/phrases/cs_2';
import { SV_DICT, SV_PHRASES } from './translations/phrases/sv_2';
import { DA_DICT, DA_PHRASES } from './translations/phrases/da_2';
import { NO_DICT, NO_PHRASES } from './translations/phrases/no_2';
import { FI_DICT, FI_PHRASES } from './translations/phrases/fi_2';

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
  | 'th'
  | 'it'
  | 'nl'
  | 'tr'
  | 'pl'
  | 'uk'
  | 'fa'
  | 'he'
  | 'ur'
  | 'bn'
  | 'ms'
  | 'fil'
  | 'sw'
  | 'el'
  | 'cs'
  | 'sv'
  | 'da'
  | 'no'
  | 'fi';

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
  { code: 'it', name: 'Italiano', flag: '🇮🇹', label: 'Italia' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', label: 'Nederland' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', label: 'Türkiye' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', label: 'Polska' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦', label: 'Україна' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷', label: 'ایران' },
  { code: 'he', name: 'עברית', flag: '🇮🇱', label: 'ישראל' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', label: 'پاکستان' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', label: 'বাংলাদেশ' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾', label: 'Malaysia' },
  { code: 'fil', name: 'Filipino', flag: '🇵🇭', label: 'Pilipinas' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪', label: 'Kenya' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', label: 'Ελλάδα' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿', label: 'Česko' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪', label: 'Sverige' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰', label: 'Danmark' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴', label: 'Norge' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮', label: 'Suomi' },
];

const SUPPORTED_SET = new Set<LanguageCode>(WORLD_LANGUAGES.map((l) => l.code));
const RTL_LANGUAGES = new Set<LanguageCode>(['ar', 'fa', 'he', 'ur']);

export function normalizeLanguageCode(raw?: string | null): LanguageCode {
  if (!raw) return 'vi';
  const trimmed = raw.trim();
  if (SUPPORTED_SET.has(trimmed as LanguageCode)) {
    return trimmed as LanguageCode;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'zh' || lower === 'zh_cn' || lower === 'zh-cn' || lower === 'zh-hans' || lower === 'zh-sg') return 'zh-CN';
  if (lower === 'zh_tw' || lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk' || lower === 'zh-mo') return 'zh-TW';
  if (lower === 'tl' || lower === 'tl-ph' || lower === 'fil-ph') return 'fil';
  if (lower === 'nb' || lower === 'nn' || lower === 'nb-no' || lower === 'nn-no') return 'no';
  if (lower === 'iw') return 'he';
  if (lower === 'in') return 'id';
  const prefix = lower.split(/[-_]/)[0];
  if (prefix === 'tl') return 'fil';
  if (prefix === 'nb' || prefix === 'nn') return 'no';
  if (prefix === 'iw') return 'he';
  if (prefix === 'in') return 'id';
  if (SUPPORTED_SET.has(prefix as LanguageCode)) {
    return prefix as LanguageCode;
  }
  return 'vi';
}

export function getActiveLanguage(): LanguageCode {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('app_language');
      if (saved) return normalizeLanguageCode(saved);
    }
    if (typeof document !== 'undefined' && document.documentElement?.lang) {
      return normalizeLanguageCode(document.documentElement.lang);
    }
  } catch {}
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
    case 'it': return 'it-IT';
    case 'nl': return 'nl-NL';
    case 'tr': return 'tr-TR';
    case 'pl': return 'pl-PL';
    case 'uk': return 'uk-UA';
    case 'fa': return 'fa-IR';
    case 'he': return 'he-IL';
    case 'ur': return 'ur-PK';
    case 'bn': return 'bn-BD';
    case 'ms': return 'ms-MY';
    case 'fil': return 'fil-PH';
    case 'sw': return 'sw-KE';
    case 'el': return 'el-GR';
    case 'cs': return 'cs-CZ';
    case 'sv': return 'sv-SE';
    case 'da': return 'da-DK';
    case 'no': return 'nb-NO';
    case 'fi': return 'fi-FI';
    default: return 'vi-VN';
  }
}

const PHRASE_MAPS: Partial<Record<LanguageCode, Record<string, string>>> = {
  'zh-CN': ZH_CN_PHRASES,
  'zh-TW': ZH_TW_PHRASES,
  ja: JA_PHRASES,
  ko: KO_PHRASES,
  fr: FR_PHRASES,
  de: DE_PHRASES,
  es: ES_PHRASES,
  pt: PT_PHRASES,
  ru: RU_PHRASES,
  ar: AR_PHRASES,
  hi: HI_PHRASES,
  id: ID_PHRASES,
  th: TH_PHRASES,
  it: IT_PHRASES,
  nl: NL_PHRASES,
  tr: TR_PHRASES,
  pl: PL_PHRASES,
  uk: UK_PHRASES,
  fa: FA_PHRASES,
  he: HE_PHRASES,
  ur: UR_PHRASES,
  bn: BN_PHRASES,
  ms: MS_PHRASES,
  fil: FIL_PHRASES,
  sw: SW_PHRASES,
  el: EL_PHRASES,
  cs: CS_PHRASES,
  sv: SV_PHRASES,
  da: DA_PHRASES,
  no: NO_PHRASES,
  fi: FI_PHRASES,
};

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
  if (normalized === 'en') return en;
  if (typeof en === 'string') {
    const phraseMap = PHRASE_MAPS[normalized];
    if (phraseMap && phraseMap[en] !== undefined) {
      return phraseMap[en] as unknown as T;
    }
  }
  if (normalized === 'zh-CN') return zhCN !== undefined ? zhCN : en;
  if (normalized === 'zh-TW') return zhCN !== undefined ? zhCN : en;
  return en;
}

export function pickActiveLang<T = string>(
  vi: T,
  en: T,
  zhCN?: T,
  extra?: Partial<Record<LanguageCode, T>>
): T {
  return pickLang<T>(getActiveLanguage(), vi, en, zhCN, extra);
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
  it: IT_DICT,
  nl: NL_DICT,
  tr: TR_DICT,
  pl: PL_DICT,
  uk: UK_DICT,
  fa: FA_DICT,
  he: HE_DICT,
  ur: UR_DICT,
  bn: BN_DICT,
  ms: MS_DICT,
  fil: FIL_DICT,
  sw: SW_DICT,
  el: EL_DICT,
  cs: CS_DICT,
  sv: SV_DICT,
  da: DA_DICT,
  no: NO_DICT,
  fi: FI_DICT,
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
      document.documentElement.dir = RTL_LANGUAGES.has(currentLang) ? 'rtl' : 'ltr';
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
