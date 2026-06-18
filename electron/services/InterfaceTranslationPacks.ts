import * as fs from 'fs';
import * as path from 'path';

export const CUSTOM_TRANSLATIONS_DIR_NAME = 'translations';
export const MAX_TRANSLATION_PACK_BYTES = 2 * 1024 * 1024;
export const MAX_TRANSLATION_NAMESPACE_BYTES = 512 * 1024;
export const MAX_TRANSLATION_STRING_CODEPOINTS = 2000;

export const INTERFACE_TRANSLATION_GROUPS = [
  'common',
  'settings',
  'launcher',
  'interviews',
  'overlay',
  'onboarding',
  'search',
] as const;

export type InterfaceLocaleSource = 'builtin' | 'custom';
export type TranslationTree = { [key: string]: string | TranslationTree };
export type BuiltInTranslationResources = Record<string, { translation: TranslationTree }>;

export interface InterfaceLocaleOption {
  code: string;
  label: string;
  nativeLabel: string;
  description: string;
  source: InterfaceLocaleSource;
  coverage: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InterfaceTranslationsSnapshot {
  translationsPath: string;
  locales: InterfaceLocaleOption[];
  resources: Record<string, TranslationTree>;
}

const LOCALE_CODE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;
const BUILT_IN_LOCALE_CODES = new Set(['en', 'ru']);
const TRANSLATION_GROUP_SET = new Set<string>(INTERFACE_TRANSLATION_GROUPS);

export const BUILT_IN_INTERFACE_LOCALE_OPTIONS: InterfaceLocaleOption[] = [
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

export function normalizeInterfaceLocaleCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/_/g, '-').toLowerCase();
  if (!LOCALE_CODE_RE.test(normalized)) return null;
  return normalized;
}

export function isInterfaceLocaleCode(value: unknown): value is string {
  return normalizeInterfaceLocaleCode(value) !== null;
}

export function isSelectableInterfaceLanguage(
  value: unknown,
  snapshot: InterfaceTranslationsSnapshot,
): value is string {
  if (value === 'system') return true;
  const normalized = normalizeInterfaceLocaleCode(value);
  if (!normalized) return false;
  return snapshot.locales.some((locale) => (
    locale.valid
    && locale.code === normalized
    && (locale.source === 'builtin' || locale.source === 'custom')
  ));
}

function flattenTranslationKeys(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    out.add(prefix);
    return out;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, child] of Object.entries(value)) {
    flattenTranslationKeys(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function countMatchingKeys(reference: Set<string>, candidate: Set<string>): number {
  let matches = 0;
  for (const key of candidate) {
    if (reference.has(key)) matches += 1;
  }
  return matches;
}

function readJsonObject(filePath: string): { value?: Record<string, unknown>; error?: string } {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: `${path.basename(filePath)} must contain a JSON object` };
    }
    return { value: parsed as Record<string, unknown> };
  } catch (error: any) {
    return { error: `${path.basename(filePath)} is not valid JSON: ${error?.message || String(error)}` };
  }
}

function validateTranslationTree(
  value: unknown,
  location: string,
  errors: string[],
): TranslationTree | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${location} must be a JSON object`);
    return null;
  }

  const out: TranslationTree = {};
  for (const [key, child] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
      errors.push(`${location}.${key} has an invalid key`);
      continue;
    }

    if (typeof child === 'string') {
      if ([...child].length > MAX_TRANSLATION_STRING_CODEPOINTS) {
        errors.push(`${location}.${key} exceeds ${MAX_TRANSLATION_STRING_CODEPOINTS} code points`);
        continue;
      }
      if (HTML_TAG_RE.test(child)) {
        errors.push(`${location}.${key} must be plain text, not HTML`);
        continue;
      }
      out[key] = child;
      continue;
    }

    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = validateTranslationTree(child, `${location}.${key}`, errors);
      if (nested) out[key] = nested;
      continue;
    }

    errors.push(`${location}.${key} must be a string or nested object`);
  }
  return out;
}

function emptyCustomOption(folderName: string, errors: string[], warnings: string[] = []): InterfaceLocaleOption {
  const normalized = normalizeInterfaceLocaleCode(folderName) ?? folderName;
  return {
    code: normalized,
    label: normalized,
    nativeLabel: normalized,
    description: 'Custom translation pack',
    source: 'custom',
    coverage: 0,
    valid: false,
    errors,
    warnings,
  };
}

function loadTranslationPack(
  translationsDir: string,
  folderName: string,
  referenceKeys: Set<string>,
): { option: InterfaceLocaleOption; resources?: TranslationTree } {
  const packDir = path.join(translationsDir, folderName);
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedFolder = normalizeInterfaceLocaleCode(folderName);
  if (!normalizedFolder) {
    return {
      option: emptyCustomOption(folderName, [
        `Folder name must be a locale code like "pl" or "pt-br"; got "${folderName}"`,
      ]),
    };
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(packDir, { withFileTypes: true });
  } catch (error: any) {
    return {
      option: emptyCustomOption(normalizedFolder, [
        `Could not read translation pack: ${error?.message || String(error)}`,
      ]),
    };
  }

  let totalBytes = 0;
  const regularFiles = entries.filter((entry) => entry.isFile());
  for (const entry of regularFiles) {
    const stat = fs.statSync(path.join(packDir, entry.name));
    totalBytes += stat.size;
  }
  if (totalBytes > MAX_TRANSLATION_PACK_BYTES) {
    errors.push(`Pack exceeds ${MAX_TRANSLATION_PACK_BYTES} bytes`);
  }

  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.json is required');
  }

  const manifest = fs.existsSync(manifestPath) ? readJsonObject(manifestPath) : {};
  if (manifest.error) errors.push(manifest.error);
  const manifestValue = manifest.value ?? {};

  const manifestLocale = normalizeInterfaceLocaleCode(manifestValue.locale);
  if (!manifestLocale) {
    errors.push('manifest.locale must be a locale code like "pl" or "pt-br"');
  } else if (manifestLocale !== normalizedFolder) {
    errors.push(`manifest.locale "${manifestLocale}" must match folder "${normalizedFolder}"`);
  }
  if (BUILT_IN_LOCALE_CODES.has(normalizedFolder)) {
    errors.push(`Custom packs cannot override built-in locale "${normalizedFolder}"`);
  }

  const label = typeof manifestValue.label === 'string' && manifestValue.label.trim()
    ? manifestValue.label.trim()
    : normalizedFolder;
  const nativeLabel = typeof manifestValue.nativeLabel === 'string' && manifestValue.nativeLabel.trim()
    ? manifestValue.nativeLabel.trim()
    : label;
  if (manifestValue.direction && manifestValue.direction !== 'ltr' && manifestValue.direction !== 'rtl') {
    errors.push('manifest.direction must be "ltr" or "rtl"');
  }

  const bundle: TranslationTree = {};
  for (const entry of regularFiles) {
    if (entry.name === 'manifest.json') continue;
    if (!entry.name.endsWith('.json')) {
      warnings.push(`${entry.name} ignored; only JSON namespace files are loaded`);
      continue;
    }

    const group = entry.name.replace(/\.json$/, '');
    if (!TRANSLATION_GROUP_SET.has(group)) {
      warnings.push(`${entry.name} ignored; "${group}" is not a supported translation group`);
      continue;
    }

    const filePath = path.join(packDir, entry.name);
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_TRANSLATION_NAMESPACE_BYTES) {
      errors.push(`${entry.name} exceeds ${MAX_TRANSLATION_NAMESPACE_BYTES} bytes`);
      continue;
    }

    const parsed = readJsonObject(filePath);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }
    const tree = validateTranslationTree(parsed.value, group, errors);
    if (tree) bundle[group] = tree;
  }

  const bundleKeys = flattenTranslationKeys(bundle);
  if (bundleKeys.size === 0) {
    errors.push('At least one supported namespace JSON file is required');
  }
  const coverage = referenceKeys.size > 0
    ? Math.min(100, Math.round((countMatchingKeys(referenceKeys, bundleKeys) / referenceKeys.size) * 100))
    : 0;

  return {
    option: {
      code: normalizedFolder,
      label,
      nativeLabel,
      description: 'Custom translation pack',
      source: 'custom',
      coverage,
      valid: errors.length === 0,
      errors,
      warnings,
    },
    resources: errors.length === 0 ? bundle : undefined,
  };
}

export function scanInterfaceTranslationPacks(
  translationsDir: string,
  builtInResources: BuiltInTranslationResources,
): InterfaceTranslationsSnapshot {
  const referenceKeys = flattenTranslationKeys(builtInResources.en?.translation ?? {});
  const locales: InterfaceLocaleOption[] = BUILT_IN_INTERFACE_LOCALE_OPTIONS.map((option) => ({ ...option }));
  const resources: Record<string, TranslationTree> = {};

  if (!fs.existsSync(translationsDir)) {
    return { translationsPath: translationsDir, locales, resources };
  }

  const entries = fs.readdirSync(translationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const loaded = loadTranslationPack(translationsDir, entry.name, referenceKeys);
    locales.push(loaded.option);
    if (loaded.option.valid && loaded.resources) {
      resources[loaded.option.code] = loaded.resources;
    }
  }

  return { translationsPath: translationsDir, locales, resources };
}

export function resolveInterfaceLanguagePreference(
  preference: string,
  systemLanguages: string[],
  snapshot: InterfaceTranslationsSnapshot,
): string {
  if (preference !== 'system') {
    const normalized = normalizeInterfaceLocaleCode(preference);
    return normalized && isSelectableInterfaceLanguage(normalized, snapshot) ? normalized : 'en';
  }

  const validCodes = snapshot.locales
    .filter((locale) => locale.valid && locale.code !== 'system')
    .map((locale) => locale.code);
  for (const language of systemLanguages) {
    const normalized = normalizeInterfaceLocaleCode(language);
    if (!normalized) continue;
    if (validCodes.includes(normalized)) return normalized;
    const base = normalized.split('-')[0];
    if (validCodes.includes(base)) return base;
    if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru';
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  }
  return 'en';
}
