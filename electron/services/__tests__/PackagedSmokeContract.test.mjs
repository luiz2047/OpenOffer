import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('packaged launch smoke uses the explicit no-window/no-provider mode', () => {
  const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
  const smoke = fs.readFileSync(path.join(root, 'scripts/packaged-launch-smoke.mjs'), 'utf8');
  assert.match(main, /OPENOFFER_PACKAGED_SMOKE === ['"]1['"]/);
  assert.match(main, /app\.quit\(\);/);
  assert.match(smoke, /OPENOFFER_PACKAGED_SMOKE: ['"]1['"]/);
  assert.match(smoke, /15_000/);
});
