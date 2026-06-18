import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSafeHandle } from './ipcTestUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Google calendar manager can create events with write scope but still proxies token secrets', () => {
  const source = read('electron/services/CalendarManager.ts');

  assert.match(source, /calendar\.readonly/);
  assert.match(source, /calendar\.events/);
  assert.match(source, /public async createEvent\(input: CalendarCreateEventInput\)/);
  assert.match(source, /method: ['"]POST['"]/);
  assert.match(source, /https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/\$\{encodeURIComponent\(calendarId\)\}\/events/);
  assert.match(source, /this\.getCalendarProxyBaseUrl\(\)\}\/api\/calendar\/exchange/);
  assert.match(source, /this\.getCalendarProxyBaseUrl\(\)\}\/api\/calendar\/refresh/);
  assert.doesNotMatch(source, /process\.env\.GOOGLE_CLIENT_SECRET|const\s+GOOGLE_CLIENT_SECRET/);
});

test('macOS calendar manager creates local Calendar.app events through bounded JXA', () => {
  const source = read('electron/services/MacCalendarManager.ts');

  assert.match(source, /MAC_CALENDAR_CREATE_JXA/);
  assert.match(source, /Calendar\.Event\(\{/);
  assert.match(source, /calendar\.events\.push\(event\)/);
  assert.match(source, /OPENOFFER_MAC_CALENDAR_CREATE_JSON/);
  assert.match(source, /timeout: DEFAULT_TIMEOUT_MS/);
});

test('manual interview creation can push an event to Google or Mac calendar', () => {
  const ipc = read('electron/ipcHandlers.ts');
  const preload = read('electron/preload.ts');
  const types = read('src/types/electron.d.ts');
  const api = read('src/features/interviews/api.ts');
  const ui = read('src/features/interviews/InterviewCommandCenter.tsx');
  const resources = read('src/i18n/resources.ts');

  assert.ok(findSafeHandle(ipc, 'interviews:create-calendar-event') >= 0);
  assert.match(ipc, /CalendarManager'\)\.CalendarManager\.getInstance\(\)\.createEvent/);
  assert.match(ipc, /MacCalendarManager'\)\.MacCalendarManager\.getInstance\(\)\.createEvent/);
  assert.match(preload, /interviewsCreateCalendarEvent: \(interviewId: string, provider: ['"]google['"] \| ['"]macos['"]\)/);
  assert.match(types, /interviewsCreateCalendarEvent: \(interviewId: string, provider: ['"]google['"] \| ['"]macos['"]\)/);
  assert.match(api, /createCalendarEvent\(interviewId: string, provider: ['"]google['"] \| ['"]macos['"]\)/);
  assert.match(ui, /interviews\.detail\.createInGoogleCalendar/);
  assert.match(ui, /interviews\.detail\.createInMacCalendar/);
  assert.match(resources, /Создать в Google Calendar/);
  assert.match(resources, /Создать в календаре Mac/);
  assert.match(ui, /const legacyId = result\.legacyInterview\?\.id/);
  assert.match(ui, /interviewApi\.createCalendarEvent\(legacyId, createCalendarProvider\)/);
});
