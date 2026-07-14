import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
const ipcHandlers = fs.readFileSync(path.join(root, 'electron/ipcHandlers.ts'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'src/lib/analytics/analytics.service.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const networkSmoke = fs.readFileSync(path.join(root, 'scripts/clean-launch-network-smoke.mjs'), 'utf8');

test('clean launch keeps outbound analytics, provider, update, and font requests behind explicit actions', () => {
  assert.match(main, /enabled: telemetryEnabledSetting === true/);
  assert.match(main, /localEnabled: telemetryEnabledSetting === true/);
  assert.match(main, /updateChecksConsent/);
  assert.match(analytics, /openoffer_analytics_consent.*granted/);
  assert.doesNotMatch(index, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(ipcHandlers, /stage-workspace:preflight/);
  assert.match(ipcHandlers, /runStageProviderPreflight/);
  assert.match(networkSmoke, /OPENOFFER_PACKAGED_SMOKE/);
  assert.match(networkSmoke, /lsof/);
  assert.match(networkSmoke, /Get-NetTCPConnection/);
  assert.match(networkSmoke, /powershell\.exe/);
  assert.match(networkSmoke, /Unexpected clean-launch outbound connections/);
});
