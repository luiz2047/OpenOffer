import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const modulePath = path.resolve(process.cwd(), 'dist-electron/electron/services/InterfaceTranslationPacks.js');
const packs = await import(modulePath);

const builtInResources = {
  en: {
    translation: {
      common: { close: 'Close', refresh: 'Refresh' },
      settings: {
        general: {
          title: 'General settings',
          translationPacksTitle: 'Translation packs',
        },
      },
    },
  },
  ru: {
    translation: {
      common: { close: 'Закрыть', refresh: 'Обновить' },
      settings: {
        general: {
          title: 'Основные настройки',
          translationPacksTitle: 'Пакеты переводов',
        },
      },
    },
  },
};

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('valid custom translation pack is selectable and contributes resources', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-i18n-pack-'));
  writeJson(path.join(root, 'pl', 'manifest.json'), {
    schemaVersion: 1,
    locale: 'pl',
    label: 'Polish',
    nativeLabel: 'Polski',
    direction: 'ltr',
  });
  writeJson(path.join(root, 'pl', 'common.json'), {
    close: 'Zamknij',
  });
  writeJson(path.join(root, 'pl', 'settings.json'), {
    general: {
      title: 'Ustawienia ogólne',
    },
  });

  const snapshot = packs.scanInterfaceTranslationPacks(root, builtInResources);
  const option = snapshot.locales.find((locale) => locale.code === 'pl');

  assert.equal(option?.valid, true);
  assert.equal(option?.source, 'custom');
  assert.equal(option?.nativeLabel, 'Polski');
  assert.equal(snapshot.resources.pl.common.close, 'Zamknij');
  assert.equal(packs.isSelectableInterfaceLanguage('pl', snapshot), true);
  assert.equal(packs.resolveInterfaceLanguagePreference('pl', ['en-US'], snapshot), 'pl');
  assert.equal(packs.resolveInterfaceLanguagePreference('system', ['pl-PL'], snapshot), 'pl');
});

test('invalid custom packs are surfaced but not selectable or loaded', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-i18n-invalid-'));
  writeJson(path.join(root, 'de', 'manifest.json'), {
    schemaVersion: 1,
    locale: 'fr',
    nativeLabel: 'Deutsch',
  });
  writeJson(path.join(root, 'de', 'common.json'), {
    close: ['Schliessen'],
  });
  writeJson(path.join(root, 'en', 'manifest.json'), {
    schemaVersion: 1,
    locale: 'en',
    nativeLabel: 'English override',
  });
  writeJson(path.join(root, 'en', 'common.json'), {
    close: 'Override',
  });
  writeJson(path.join(root, 'it', 'manifest.json'), {
    schemaVersion: 1,
    locale: 'it',
    nativeLabel: 'Italiano',
  });
  writeJson(path.join(root, 'it', 'common.json'), {
    close: '<b>Chiudi</b>',
  });

  const snapshot = packs.scanInterfaceTranslationPacks(root, builtInResources);
  const de = snapshot.locales.find((locale) => locale.code === 'de');
  const enOverride = snapshot.locales.find((locale) => locale.source === 'custom' && locale.code === 'en');
  const it = snapshot.locales.find((locale) => locale.code === 'it');

  assert.equal(de?.valid, false);
  assert.match(de?.errors.join('\n') ?? '', /must match folder/);
  assert.equal(enOverride?.valid, false);
  assert.match(enOverride?.errors.join('\n') ?? '', /cannot override built-in/);
  assert.equal(it?.valid, false);
  assert.match(it?.errors.join('\n') ?? '', /plain text/);
  assert.equal(snapshot.resources.de, undefined);
  assert.equal(snapshot.resources.en, undefined);
  assert.equal(snapshot.resources.it, undefined);
  assert.equal(packs.isSelectableInterfaceLanguage('de', snapshot), false);
  assert.equal(packs.resolveInterfaceLanguagePreference('de', ['fr-FR'], snapshot), 'en');
});
