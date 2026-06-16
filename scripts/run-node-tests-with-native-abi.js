const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const testGlobs = [
  'electron/services/__tests__/**/*.test.mjs',
  'electron/llm/__tests__/**/*.test.mjs',
  'electron/llm/codeVerification/__tests__/**/*.test.mjs',
  'electron/audio/__tests__/**/*.test.mjs',
  'electron/update/**/*.test.mjs',
];

function run(label, command, args, options = {}) {
  console.log(`[test-native-abi] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status}`);
    error.status = result.status;
    throw error;
  }
}

let testStatus = 0;

try {
  run('build Electron test bundle', npmBin, ['run', 'build:electron']);
  run('rebuild native modules for Node test runner', npmBin, ['rebuild', 'better-sqlite3', 'keytar']);
  run('run Node test suite', process.execPath, ['--test', ...testGlobs]);
} catch (error) {
  testStatus = error.status || 1;
} finally {
  try {
    run('restore native modules for Electron runtime', process.execPath, ['scripts/rebuild-native-electron.js']);
  } catch (error) {
    process.exit(error.status || 1);
  }
}

process.exit(testStatus);
