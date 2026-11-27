import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';

export type SupportedLanguage = 'en' | 'fr' | 'ar';
export type SupportedCurrency = string;

interface PreferencesState {
  currency: SupportedCurrency;
  language: SupportedLanguage;
  vendorCategories: Record<string, string>;
}

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
const STORAGE_KEY = 'ledgerly:preferences';

function getSupportedCurrencies(): SupportedCurrency[] {
  try {
    // @ts-ignore - Intl.supportedValuesOf is available in modern browsers but not in TS types yet
    return Intl.supportedValuesOf('currency');
  } catch {
    return [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN',
      'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK',
      'RUB', 'TRY', 'ZAR', 'KRW', 'SGD', 'HKD', 'NZD', 'ILS', 'AED', 'SAR',
      'THB', 'MYR', 'PHP', 'IDR', 'VND', 'TWD', 'EGP', 'NGN', 'KES', 'GHS',
    ];
  }
}

function getCurrencyDisplayName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames(locale, { type: 'currency' }).of(code) || code;
  } catch {
    return code;
  }
}

function loadPreferences(): PreferencesState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PreferencesState;
  } catch {}
  return { currency: DEFAULT_CURRENCY, language: DEFAULT_LANGUAGE, vendorCategories: {} };
}

function savePreferences(prefs: PreferencesState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

interface PreferencesContextValue extends PreferencesState {
  setCurrency: (currency: SupportedCurrency) => void;
  setLanguage: (language: SupportedLanguage) => void;
  getVendorCategory: (vendor: string) => string | undefined;
  setVendorCategory: (vendor: string, category: string) => void;
  supportedCurrencies: SupportedCurrency[];
  supportedLanguages: { code: SupportedLanguage; name: string; nativeName: string; rtl: boolean }[];
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (date: string | undefined, short?: boolean) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const SUPPORTED_LANGUAGES = [
  { code: 'en' as SupportedLanguage, name: 'English', nativeName: 'English', rtl: false },
  { code: 'fr' as SupportedLanguage, name: 'French', nativeName: 'Français', rtl: false },
  { code: 'ar' as SupportedLanguage, name: 'Arabic', nativeName: 'العربية', rtl: true },
];

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(() => loadPreferences());
  const [supportedCurrencies] = useState<SupportedCurrency[]>(() => getSupportedCurrencies());

  useEffect(() => {
    savePreferences(prefs);
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = SUPPORTED_LANGUAGES.find(l => l.code === prefs.language)?.rtl ? 'rtl' : 'ltr';
  }, [prefs]);

  const setCurrency = (currency: SupportedCurrency) => {
    setPrefs(p => ({ ...p, currency }));
  };

  const setLanguage = (language: SupportedLanguage) => {
    setPrefs(p => ({ ...p, language }));
  };

  const getVendorCategory = (vendor: string) => prefs.vendorCategories[vendor.toLowerCase().trim()];

  const setVendorCategory = (vendor: string, category: string) => {
    const key = vendor.toLowerCase().trim();
    if (!key) return;
    setPrefs(p => ({ ...p, vendorCategories: { ...p.vendorCategories, [key]: category } }));
  };

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat(prefs.language, {
      style: 'currency',
      currency: prefs.currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (date: string | undefined, short?: boolean) => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return '—';
      return short ? format(d, 'MMM d, yyyy') : format(d, 'PPP');
    } catch {
      return '—';
    }
  };

  const value = useMemo<PreferencesContextValue>(() => ({
    currency: prefs.currency,
    language: prefs.language,
    vendorCategories: prefs.vendorCategories,
    setCurrency,
    setLanguage,
    getVendorCategory,
    setVendorCategory,
    supportedCurrencies,
    supportedLanguages: [...SUPPORTED_LANGUAGES],
    formatCurrency,
    formatDate,
  }), [prefs, supportedCurrencies]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}