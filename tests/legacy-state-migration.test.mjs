import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const aiProvidersPath = new URL('../src/components/settings/AIProvidersSettings.tsx', import.meta.url);
const settingsOverlayPath = new URL('../src/components/SettingsOverlay.tsx', import.meta.url);
const ipcHandlersPath = new URL('../electron/ipcHandlers.ts', import.meta.url);
const preloadPath = new URL('../electron/preload.ts', import.meta.url);
const typesPath = new URL('../src/types/electron.d.ts', import.meta.url);
const removedUiPaths = [
  '../src/components/trial/FreeTrialBanner.tsx',
  '../src/components/trial/FreeTrialModal.tsx',
  '../src/components/trial/TrialPromoToaster.tsx',
  '../src/components/settings/NativelyApiSettings.tsx',
  '../src/components/settings/NativelyProSettings.tsx',
].map((relativePath) => new URL(relativePath, import.meta.url));

test('AIProvidersSettings does not expose natively as a selectable default model', () => {
  const source = readFileSync(aiProvidersPath, 'utf8');
  assert.equal(/id:\s*['"]natively['"]/.test(source), false);
  assert.match(source, /sanitizeDefaultModel\(result\.model\)/);
});

test('SettingsOverlay sanitizes legacy natively STT provider state', () => {
  const source = readFileSync(settingsOverlayPath, 'utf8');
  assert.match(source, /sanitizeSttProvider\(creds\.sttProvider\)/);
  assert.equal(/sttProvider === 'natively'/.test(source), false);
});

test('preload and typed IPC contract do not expose removed commercial APIs', () => {
  const preload = readFileSync(preloadPath, 'utf8');
  const types = readFileSync(typesPath, 'utf8');
  for (const needle of [
    'setNativelyApiKey',
    'getNativelyPricing',
    'getNativelyUsage',
    'startTrial',
    'getTrialStatus',
    'getLocalTrial',
    'convertTrial',
    'endTrialByok',
    'wipeTrialProfileData',
    'licenseActivate',
    'licenseCheckPremium',
    'licenseGetDetails',
    'licenseCheckPremiumAsync',
    'licenseDeactivate',
    'licenseGetHardwareId',
    'onTrialEnded',
    'onLicenseStatusChanged',
  ]) {
    assert.equal(preload.includes(needle), false, `preload still exposes ${needle}`);
    assert.equal(types.includes(needle), false, `types still expose ${needle}`);
  }
});

test('public build removes dead trial and Natively settings entrypoints', () => {
  for (const pathUrl of removedUiPaths) {
    assert.equal(existsSync(pathUrl), false, `${pathUrl.pathname} should be absent from the public build`);
  }
});

test('removed IPC handlers are compatibility stubs without dead legacy bodies', () => {
  const source = readFileSync(ipcHandlersPath, 'utf8');
  for (const needle of [
    "require('../premium/electron/services/LicenseManager')",
    '/v1/pricing',
    '/v1/usage',
    '/v1/trial/start',
    '/v1/trial/status',
    '/v1/trial/convert',
    'activateWithApiKey',
    'activateLicense',
  ]) {
    assert.equal(source.includes(needle), false, `ipcHandlers still contains legacy ${needle}`);
  }
  assert.match(source, /safeHandle\('license:check-premium'[\s\S]*?return false;/);
  assert.match(source, /safeHandle\('set-natively-api-key'[\s\S]*?Hosted API removed in this build/);
  assert.match(source, /safeHandle\('trial:start'[\s\S]*?Free trial removed in this build/);
});
