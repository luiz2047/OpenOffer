import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(repoRoot, 'scripts/build-preview-dmgs.cjs'), 'utf8');

test('preview DMG builder falls back to hdiutil when create-dmg is unavailable', () => {
  assert.match(source, /function commandExists\(command\)/);
  assert.match(source, /commandExists\('create-dmg'\)/);
  assert.match(source, /buildDmgWithHdiutil/);
  assert.match(source, /execFileSync\('hdiutil'/);
  assert.match(source, /fs\.symlinkSync\('\/Applications'/);
});
