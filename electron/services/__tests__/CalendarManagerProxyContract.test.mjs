import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(root, 'electron/services/CalendarManager.ts'), 'utf8');

describe('CalendarManager proxy contract', () => {
  test('does not default to the hosted Natively calendar proxy', () => {
    assert.doesNotMatch(src, /https:\/\/api\.natively\.software/);
    assert.match(src, /process\.env\.OPENOFFER_CALENDAR_PROXY_URL/);
    assert.match(src, /process\.env\.CALENDAR_PROXY_URL/);
  });

  test('startAuthFlow fails closed before any auth network work when no proxy is configured', () => {
    assert.match(src, /Calendar is disabled until an explicit proxy URL is configured\./);
    assert.match(src, /public async startAuthFlow\(\): Promise<void> \{\s*if \(!this\.isProxyConfigured\(\)\)/s);
  });

  test('token exchange and refresh go through the explicit proxy helper', () => {
    assert.match(src, /this\.getCalendarProxyBaseUrl\(\)\}\/api\/calendar\/exchange/);
    assert.match(src, /this\.getCalendarProxyBaseUrl\(\)\}\/api\/calendar\/refresh/);
  });

  test('status reporting advertises the disabled state when no proxy is set', () => {
    assert.match(src, /disabled\?: boolean, reason\?: string/);
    assert.match(src, /Calendar is disabled until OPENOFFER_CALENDAR_PROXY_URL or CALENDAR_PROXY_URL is set\./);
  });
});
