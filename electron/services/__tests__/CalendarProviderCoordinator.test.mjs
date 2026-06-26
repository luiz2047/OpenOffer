import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

const {
  CalendarProviderCoordinator,
} = require(path.join(root, 'dist-electron/electron/services/CalendarProviderCoordinator.js'));

function googleSource(overrides = {}) {
  return {
    isProxyConfigured: () => true,
    isClientConfigured: () => true,
    getConnectionStatus: () => ({ connected: true }),
    getUpcomingEvents: async () => [],
    createEvent: async input => ({
      id: 'google-event',
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      link: input.link,
      source: 'google',
      attendees: [],
    }),
    ...overrides,
  };
}

function macosSource(overrides = {}) {
  return {
    isAvailable: () => true,
    getUpcomingEvents: async () => [{
      id: 'mac-event',
      title: 'Mac event',
      startTime: '2026-06-25T10:00:00.000Z',
      endTime: '2026-06-25T11:00:00.000Z',
      source: 'macos',
      attendees: [],
    }],
    createEvent: async input => ({
      id: 'mac-created',
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      link: input.link,
      source: 'macos',
      attendees: [],
    }),
    ...overrides,
  };
}

function settingsStore(initial = undefined) {
  let value = initial;
  return {
    get: () => value,
    set: (_key, next) => { value = next; },
  };
}

test('CalendarProviderCoordinator exposes a provider matrix and defaults macOS on Darwin before permission is proven', () => {
  const coordinator = new CalendarProviderCoordinator({
    google: googleSource({ getConnectionStatus: () => ({ connected: false }) }),
    macos: macosSource(),
    settings: settingsStore(),
    now: () => 1000,
  });

  const status = coordinator.getStatus();

  assert.equal(status.providers.length, 2);
  assert.equal(status.providers.find(provider => provider.provider === 'google').state, 'needs_setup');
  assert.equal(status.providers.find(provider => provider.provider === 'macos').state, 'permission_unknown');
  assert.equal(status.preferredProvider, 'macos');
});

test('CalendarProviderCoordinator refresh is concurrent and returns partial provider results', async () => {
  const coordinator = new CalendarProviderCoordinator({
    google: googleSource({
      getUpcomingEvents: async () => {
        throw new Error('Google Calendar fetch timed out');
      },
    }),
    macos: macosSource(),
    settings: settingsStore('google'),
    now: () => 2000,
  });

  const result = await coordinator.refresh();

  assert.equal(result.refreshedAt, 2000);
  assert.deepEqual(
    result.providers.map(provider => [provider.provider, provider.ok, provider.eventCount ?? provider.errorCode]),
    [
      ['google', false, 'timeout'],
      ['macos', true, 1],
    ],
  );
  assert.equal(result.status.providers.find(provider => provider.provider === 'google').lastErrorCode, 'timeout');
  assert.equal(result.status.providers.find(provider => provider.provider === 'macos').state, 'available');
});

test('CalendarProviderCoordinator createEvent uses the resolved preferred provider when provider is omitted', async () => {
  const coordinator = new CalendarProviderCoordinator({
    google: googleSource({ getConnectionStatus: () => ({ connected: false }) }),
    macos: macosSource(),
    settings: settingsStore(null),
    now: () => 3000,
  });

  const event = await coordinator.createEvent(null, {
    title: 'Interview',
    startTime: '2026-06-25T10:00:00.000Z',
    endTime: '2026-06-25T11:00:00.000Z',
  });

  assert.equal(event.source, 'macos');
  assert.equal(event.id, 'mac-created');
  assert.equal(coordinator.getStatus().providers.find(provider => provider.provider === 'macos').state, 'available');
});
