export const BUILT_IN_INTERFACE_LANGUAGES = ['en', 'ru'] as const;
export type BuiltInInterfaceLanguage = typeof BUILT_IN_INTERFACE_LANGUAGES[number];

export const INTERFACE_LANGUAGE_PREFERENCES = ['system', ...BUILT_IN_INTERFACE_LANGUAGES] as const;
export type InterfaceLanguagePreference = 'system' | BuiltInInterfaceLanguage | (string & {});

export interface InterfaceLanguageState {
  preference: InterfaceLanguagePreference;
  resolvedLanguage: string;
  systemLanguage?: string;
}

export interface InterfaceLocaleOption {
  code: string;
  label: string;
  nativeLabel: string;
  description: string;
  source?: 'builtin' | 'custom';
  coverage?: number;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface InterfaceTranslationsSnapshot {
  translationsPath: string;
  locales: InterfaceLocaleOption[];
  resources: Record<string, Record<string, unknown>>;
}

const BUILT_IN_SET = new Set<string>(BUILT_IN_INTERFACE_LANGUAGES);
const PREFERENCE_SET = new Set<string>(INTERFACE_LANGUAGE_PREFERENCES);
const LOCALE_CODE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;

export function isBuiltInInterfaceLanguage(value: unknown): value is BuiltInInterfaceLanguage {
  return typeof value === 'string' && BUILT_IN_SET.has(value);
}

export function isInterfaceLanguagePreference(value: unknown): value is InterfaceLanguagePreference {
  if (typeof value !== 'string') return false;
  if (PREFERENCE_SET.has(value)) return true;
  return LOCALE_CODE_RE.test(value.trim().replace('_', '-').toLowerCase());
}

export function normalizeBuiltInInterfaceLanguage(value: unknown): BuiltInInterfaceLanguage {
  if (typeof value !== 'string') return 'en';
  const normalized = value.trim().toLowerCase().replace('_', '-');
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return 'en';
}

export function normalizeInterfaceLanguagePreference(value: unknown): InterfaceLanguagePreference {
  if (value === 'system') return 'system';
  if (typeof value !== 'string') return 'system';
  const normalized = value.trim().replace('_', '-').toLowerCase();
  return isInterfaceLanguagePreference(normalized) ? normalized : 'system';
}

export function resolveInterfaceLanguage(
  preference: InterfaceLanguagePreference = 'system',
  systemLanguage?: string,
): string {
  if (preference === 'system') {
    return normalizeBuiltInInterfaceLanguage(systemLanguage);
  }
  return normalizeInterfaceLanguagePreference(preference) === 'system' ? 'en' : normalizeInterfaceLanguagePreference(preference);
}

export const INTERFACE_LOCALE_OPTIONS: InterfaceLocaleOption[] = [
  {
    code: 'system',
    label: 'System',
    nativeLabel: 'System',
    description: 'Use the language selected for this device when OpenOffer supports it.',
    source: 'builtin',
    coverage: 100,
    valid: true,
    errors: [],
    warnings: [],
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    description: 'Use English for OpenOffer menus, buttons, settings, and warnings.',
    source: 'builtin',
    coverage: 100,
    valid: true,
    errors: [],
    warnings: [],
  },
  {
    code: 'ru',
    label: 'Russian',
    nativeLabel: 'Русский',
    description: 'Use Russian for OpenOffer menus, buttons, settings, and warnings.',
    source: 'builtin',
    coverage: 100,
    valid: true,
    errors: [],
    warnings: [],
  },
];
