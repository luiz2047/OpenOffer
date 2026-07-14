import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'src/lib/analytics/analytics.service.ts'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const resources = fs.readFileSync(path.join(root, 'src/i18n/resources.ts'), 'utf8');
const releaseWorkflow = fs.readFileSync(path.join(root, '.github/workflows/release-desktop.yml'), 'utf8');
const escapedVersion = pkg.version.replaceAll('.', '\\.');

test('release truth uses package version across public docs and analytics', () => {
  assert.match(readme, new RegExp(`Version-${escapedVersion}`));
  assert.match(readme, new RegExp('Current public version: `' + escapedVersion + '`'));
  assert.match(analytics, /packageJson\.version/);
  assert.doesNotMatch(analytics, /1\.1\.3/);
});

test('release configuration names artifacts from the package version', () => {
  const config = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  assert.match(config, /\$\{version\}/);
});

test('preview packaging signs only after electron-builder finalizes native files', () => {
  const config = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const preview = fs.readFileSync(path.join(root, 'electron-builder.preview.cjs'), 'utf8');
  const signer = fs.readFileSync(path.join(root, 'scripts/ad-hoc-sign.js'), 'utf8');

  assert.match(config, /"afterSign":\s*"\.\/scripts\/ad-hoc-sign\.js"/);
  assert.doesNotMatch(config, /"afterPack":\s*"\.\/scripts\/ad-hoc-sign\.js"/);
  assert.match(preview, /identity:\s*'-'/);
  assert.match(signer, /Re-sealing main app after native module signing/);
});

test('clean renderer launch has no external font dependency', () => {
  assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(indexHtml, /font-src 'self'/);
});

test('public translations use neutral screen-share language', () => {
  assert.doesNotMatch(resources, /Undetectable mode|Stealth typing|stealth typing|Невидимый/);
  assert.match(resources, /Screen-share privacy/);
  assert.match(resources, /Приватность демонстрации/);
});

test('desktop release workflow runs quality gates before platform artifacts', () => {
  assert.match(releaseWorkflow, /quality-gates:/);
  assert.match(releaseWorkflow, /npm run public-docs:check/);
  assert.match(releaseWorkflow, /CanonicalIntakeFixture\.test\.mjs/);
  assert.match(releaseWorkflow, /npm test/);
  assert.match(releaseWorkflow, /build-macos:\n\s+needs: quality-gates/);
  assert.match(releaseWorkflow, /build-windows:\n\s+needs: quality-gates/);
  assert.match(releaseWorkflow, /verify-release-manifest\.mjs/);
  assert.match(releaseWorkflow, /legacy-state-migration\.test\.mjs/);
  assert.match(releaseWorkflow, /LegacySchemaFixture\.test\.mjs/);
  assert.match(releaseWorkflow, /UpgradeRecoveryMatrix\.test\.mjs/);
  assert.match(releaseWorkflow, /StageProviderPreflight\.test\.mjs/);
  assert.match(releaseWorkflow, /CleanLaunchNetworkPolicy\.test\.mjs/);
  assert.match(releaseWorkflow, /StageStartBoundary\.test\.mjs/);
  assert.match(releaseWorkflow, /packaged-launch-smoke\.mjs/);
  assert.match(releaseWorkflow, /WINDOWS_CERT_P12_BASE64/);
  assert.match(releaseWorkflow, /WIN_CSC_LINK=/);
  assert.match(releaseWorkflow, /Get-AuthenticodeSignature/);
  assert.match(releaseWorkflow, /openoffer-windows-x64-\$\{\{ steps\.windows_mode\.outputs\.artifact_label \}\}/);
});
