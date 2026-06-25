import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSafeHandle, sliceSafeHandleBlock } from './ipcTestUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('MacCalendarManager reads local Calendar.app through a bounded osascript bridge', () => {
  const source = read('electron/services/MacCalendarManager.ts');

  assert.match(source, /execFileAsync\('\/usr\/bin\/osascript', \['-l', 'JavaScript'/);
  assert.match(source, /timeout:\s*DEFAULT_TIMEOUT_MS/);
  assert.match(source, /events\.whose\(\{/);
  assert.doesNotMatch(source, /calendar\.events\(\)\.forEach/, 'macOS reads must not scan every historical event');
  assert.match(source, /process\.platform === 'darwin'/);
  assert.match(source, /source:\s*'macos' as const/);
  assert.doesNotMatch(source, /npm|icalBuddy|sqlite/i, 'local calendar support must not add an external runtime dependency');
});

test('get-upcoming-events merges Google and macOS calendar sources', () => {
  const ipc = read('electron/ipcHandlers.ts');
  const coordinator = read('electron/services/CalendarProviderCoordinator.ts');
  const block = sliceSafeHandleBlock(ipc, 'get-upcoming-events');

  assert.ok(findSafeHandle(ipc, 'get-upcoming-events') >= 0);
  assert.match(block, /CalendarProviderCoordinator\.getInstance\(\)\.getUpcomingEvents\(\)/);
  assert.match(coordinator, /safeReadGoogle\(\)/);
  assert.match(coordinator, /safeReadMacos\(\)/);
  assert.match(coordinator, /\.sort\(\(a, b\) =>/);
});

test('renderer calendar event type accepts both Google and macOS source labels', () => {
  assert.match(read('electron/preload.ts'), /CalendarEventSummary/);
  assert.match(read('src/types/electron.d.ts'), /CalendarEventSummary/);
  assert.match(read('src/types/interviews.ts'), /export type CalendarProviderId = ['"]google['"] \| ['"]macos['"]/);
});
