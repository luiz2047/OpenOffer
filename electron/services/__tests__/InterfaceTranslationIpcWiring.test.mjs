import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('interface translation pack IPC handlers are registered', () => {
  const source = read('electron/ipcHandlers.ts');
  for (const channel of [
    'get-interface-translations',
    'refresh-interface-translations',
    'open-interface-translations-folder',
  ]) {
    assert.match(source, new RegExp(`safeHandle\\(['"]${channel}['"]`), `${channel} must be registered`);
  }
  assert.match(source, /broadcastInterfaceTranslationsChanged\(snapshot\)/);
  assert.match(source, /isSelectableInterfaceLanguage\(normalized, snapshot\)/);
});

test('preload and renderer types expose translation pack APIs', () => {
  const preload = read('electron/preload.ts');
  const types = read('src/types/electron.d.ts');
  for (const method of [
    'getInterfaceTranslations',
    'refreshInterfaceTranslations',
    'openInterfaceTranslationsFolder',
    'onInterfaceTranslationsChanged',
  ]) {
    assert.match(preload, new RegExp(`${method}:`), `${method} missing from preload`);
    assert.match(types, new RegExp(`${method}:`), `${method} missing from renderer types`);
  }
});
