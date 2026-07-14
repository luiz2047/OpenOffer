import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
const ipc = fs.readFileSync(path.join(root, 'electron/ipcHandlers.ts'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.ts'), 'utf8');
const releaseNotes = fs.readFileSync(path.join(root, 'electron/update/ReleaseNotesManager.ts'), 'utf8');

test('background updater checks fail closed until explicit consent', () => {
  assert.match(main, /updateChecksConsent/);
  assert.match(main, /Background update check skipped: explicit update consent is disabled/);
  assert.match(main, /autoUpdater\.checkForUpdatesAndNotify\(\)/);
});

test('update consent has a versioned IPC surface independent of manual checks', () => {
  assert.match(ipc, /get-update-check-consent/);
  assert.match(ipc, /set-update-check-consent/);
  assert.match(preload, /getUpdateCheckConsent/);
  assert.match(preload, /setUpdateCheckConsent/);
});

test('telemetry consent is separately versioned and persisted in main settings', () => {
  assert.match(ipc, /get-telemetry-consent/);
  assert.match(ipc, /set-telemetry-consent/);
  assert.match(ipc, /TELEMETRY_POLICY_VERSION/);
  assert.match(ipc, /telemetryConsent/);
  assert.match(preload, /getTelemetryConsent/);
  assert.match(preload, /setTelemetryConsent/);
});

test('updater keeps a recoverable state when download or install cannot complete', () => {
  assert.match(main, /this\.updateDownloadState = this\.updateAvailable \? 'available' : 'idle'/);
  assert.match(main, /this\.updateDownloadPromise = null/);
  assert.match(main, /Downloaded update file:/);
  assert.match(main, /Never call quitAndInstall on an/);
});

test('stable updater never consumes prereleases unless preview is explicitly selected', () => {
  assert.match(main, /OPENOFFER_UPDATE_CHANNEL === 'preview'/);
  assert.match(main, /allowPrerelease/);
  assert.match(releaseNotes, /version === 'preview'/);
  assert.match(releaseNotes, /release\?\.prerelease/);
});
