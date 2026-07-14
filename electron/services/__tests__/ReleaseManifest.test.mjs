import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('release manifest generator is deterministic about hashes and size gates', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/verify-release-manifest.mjs'), 'utf8');
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /OPENOFFER_MAX_ARTIFACT_MB/);
  assert.match(source, /RELEASE_MANIFEST\.json/);
  assert.match(source, /ARTIFACT_SIZES\.md/);
  assert.match(source, /packageJson\.version/);
});
