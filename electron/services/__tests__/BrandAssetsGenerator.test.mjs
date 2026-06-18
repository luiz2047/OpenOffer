import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function repoPath(relativePath) {
  return path.join(root, relativePath);
}

async function expectImage(relativePath, expected) {
  const metadata = await sharp(repoPath(relativePath)).metadata();
  assert.equal(metadata.width, expected.size, `${relativePath} width`);
  assert.equal(metadata.height, expected.size, `${relativePath} height`);
  if (expected.format) {
    assert.equal(metadata.format, expected.format, `${relativePath} format`);
  }
}

describe('OpenOffer brand assets', () => {
  test('npm script points at the checked-in brand asset generator', () => {
    const packageJson = JSON.parse(fs.readFileSync(repoPath('package.json'), 'utf8'));
    assert.equal(packageJson.scripts['brand:assets'], 'node scripts/generate-brand-assets.mjs');
  });

  test('generated app logo files match their target dimensions', async () => {
    await expectImage('assets/brand/openoffer-mark.png', { size: 1024, format: 'png' });
    await expectImage('assets/brand/openoffer-symbol.png', { size: 1024, format: 'png' });
    await expectImage('assets/icon.png', { size: 512, format: 'png' });
    await expectImage('src/assets/logo.png', { size: 644, format: 'png' });
    await expectImage('src/assets/logo.webp', { size: 644, format: 'webp' });
    await expectImage('renderer/public/logo192.png', { size: 192, format: 'png' });
    await expectImage('renderer/public/logo512.png', { size: 512, format: 'png' });
  });

  test('mac and windows package icon files are present', () => {
    for (const relativePath of [
      'assets/icon.icns',
      'assets/icons/mac/icon.icns',
      'src/icons/AppIcon.icns',
      'assets/icons/win/icon.ico',
      'renderer/public/favicon.ico',
    ]) {
      assert.ok(fs.statSync(repoPath(relativePath)).size > 1024, `${relativePath} should be generated`);
    }
  });
});
