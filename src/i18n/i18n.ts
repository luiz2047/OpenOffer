import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';
import {
  type InterfaceLanguagePreference,
  normalizeInterfaceLanguagePreference,
  resolveInterfaceLanguage,
} from './locales';

const DEFAULT_LANGUAGE = 'en';

function getNavigatorLanguage(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.language || navigator.languages?.[0];
}

export function getInitialInterfaceLanguage(): string {
  return resolveInterfaceLanguage('system', getNavigatorLanguage());
}

export function initI18n(initialPreference: InterfaceLanguagePreference = 'system') {
  if (i18n.isInitialized) return i18n;

  const lng = resolveInterfaceLanguage(
    normalizeInterfaceLanguagePreference(initialPreference),
    getNavigatorLanguage(),
  );

  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
  });

  return i18n;
}

export { i18n };
