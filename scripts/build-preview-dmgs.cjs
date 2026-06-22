const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'release');
const pkg = require('../package.json');

const PRODUCT_NAME = pkg.build?.productName || pkg.productName || pkg.name || 'OpenOffer';
const BACKGROUND = path.join(ROOT, 'assets', 'dmg-background.png');
const VOLICON = path.join(ROOT, 'assets', 'openoffer.icns');

function commandExists(command) {
  try {
    execFileSync('/usr/bin/which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findApp(archDir) {
  const dir = path.join(OUT_DIR, archDir);
  if (!fs.existsSync(dir)) return null;
  const app = fs.readdirSync(dir).find((file) => file.endsWith('.app'));
  return app ? path.join(dir, app) : null;
}

function buildDmgWithHdiutil({ appPath, outDmg, stage }) {
  const applicationsLink = path.join(stage, 'Applications');
  if (!fs.existsSync(applicationsLink)) {
    fs.symlinkSync('/Applications', applicationsLink);
  }

  console.warn('[preview-dmg] create-dmg not found; using hdiutil fallback without custom Finder layout.');
  execFileSync('hdiutil', [
    'create',
    '-volname', PRODUCT_NAME,
    '-srcfolder', stage,
    '-ov',
    '-format', 'UDZO',
    outDmg,
  ], { stdio: 'inherit' });
}

function buildDmg({ appPath, outDmg }) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-preview-dmg-'));
  const stagedApp = path.join(stage, path.basename(appPath));

  try {
    execFileSync('ditto', [appPath, stagedApp], { stdio: 'inherit' });
    if (fs.existsSync(outDmg)) fs.unlinkSync(outDmg);

    if (!commandExists('create-dmg')) {
      buildDmgWithHdiutil({ appPath, outDmg, stage });
      return;
    }

    const args = [
      '--volname', PRODUCT_NAME,
      '--window-pos', '200', '120',
      '--window-size', '660', '400',
      '--icon-size', '120',
      '--icon', path.basename(appPath), '170', '190',
      '--app-drop-link', '490', '190',
      '--hide-extension', path.basename(appPath),
      '--no-internet-enable',
      '--hdiutil-quiet',
    ];

    if (fs.existsSync(VOLICON)) args.push('--volicon', VOLICON);
    if (fs.existsSync(BACKGROUND)) args.push('--background', BACKGROUND);
    args.push(outDmg, stage);

    try {
      execFileSync('create-dmg', args, { stdio: 'inherit' });
    } catch (error) {
      if (error.status === 2 && fs.existsSync(outDmg)) {
        console.warn('[preview-dmg] create-dmg exit 2; keeping the generated DMG.');
      } else {
        throw error;
      }
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

const targets = [
  { archDir: 'mac', suffix: '' },
  { archDir: 'mac-arm64', suffix: '-arm64' },
];

const built = [];
for (const { archDir, suffix } of targets) {
  const appPath = findApp(archDir);
  if (!appPath) {
    console.warn(`[preview-dmg] No app found in release/${archDir}; skipping.`);
    continue;
  }

  const outDmg = path.join(OUT_DIR, `${PRODUCT_NAME}-${pkg.version}${suffix}.dmg`);
  console.log(`[preview-dmg] Building ${path.basename(outDmg)} from ${appPath}`);
  buildDmg({ appPath, outDmg });
  built.push(outDmg);
}

if (built.length === 0) {
  throw new Error('No preview DMGs were built; release/mac and release/mac-arm64 were missing apps.');
}

console.log('[preview-dmg] Built preview DMGs:');
for (const file of built) {
  console.log(`- ${path.relative(ROOT, file)}`);
}
