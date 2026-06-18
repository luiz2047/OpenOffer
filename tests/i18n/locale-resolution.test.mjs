import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const root = process.cwd();
const locales = await importTsModule(path.join(root, 'src/i18n/locales.ts'));

test('resolves system language to supported built-in locale', () => {
  assert.equal(locales.resolveInterfaceLanguage('system', 'ru-RU'), 'ru');
  assert.equal(locales.resolveInterfaceLanguage('system', 'en-GB'), 'en');
  assert.equal(locales.resolveInterfaceLanguage('system', 'fr-FR'), 'en');
});

test('normalizes invalid preferences to system', () => {
  assert.equal(locales.normalizeInterfaceLanguagePreference('ru'), 'ru');
  assert.equal(locales.normalizeInterfaceLanguagePreference('en'), 'en');
  assert.equal(locales.normalizeInterfaceLanguagePreference('system'), 'system');
  assert.equal(locales.normalizeInterfaceLanguagePreference('de'), 'de');
  assert.equal(locales.normalizeInterfaceLanguagePreference('not a locale'), 'system');
  assert.equal(locales.normalizeInterfaceLanguagePreference(null), 'system');
});

test('explicit built-in preference wins over system language', () => {
  assert.equal(locales.resolveInterfaceLanguage('ru', 'en-US'), 'ru');
  assert.equal(locales.resolveInterfaceLanguage('en', 'ru-RU'), 'en');
});
