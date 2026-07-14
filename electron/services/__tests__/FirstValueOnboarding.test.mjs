import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('clean first launch does not foreground permissions', () => {
  const source = read('src/App.tsx');
  const firstLaunch = source.match(/if \(!permsShown\) \{([\s\S]*?)\n\s*\} else \{/);

  assert.ok(firstLaunch, 'first-launch permissions branch should exist');
  assert.equal(firstLaunch[1].includes('setShowPermissionsToaster(true)'), false);
  assert.match(firstLaunch[1], /localStorage\.setItem\(['"]natively_perms_shown_v1['"], ['"]1['"]\)/);
  assert.equal(firstLaunch[1].includes("onboardingSetFlag?.('permsShown', true)"), true);
});

test('permission toaster remains a recovery surface for revoked access', () => {
  const source = read('src/App.tsx');
  assert.match(source, /blocked\(p\.microphone\).*blocked\(p\.screen\)/s);
  assert.match(source, /setShowPermissionsToaster\(true\)/);
});
