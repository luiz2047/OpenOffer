import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

const failures = [];

function expectContains(file, needle, message) {
  const text = read(file);
  if (!text.includes(needle)) {
    failures.push(`${file}: ${message}`);
  }
}

function rejectPattern(file, pattern, message) {
  const text = read(file);
  if (pattern.test(text)) {
    failures.push(`${file}: ${message}`);
  }
}

expectContains('README.md', `Current public version: \`${pkg.version}\``, 'README version must match package.json');
expectContains('README.md', 'recruiter chat', 'README should lead with the community launch demo');
expectContains('docs/RELEASE.md', 'OpenOffer release process', 'release guide must be OpenOffer-specific');

for (const file of [
  'README.md',
  'CONTRIBUTING.md',
  'docs/RELEASE.md',
  'ROADMAP.md',
  'PHASE_STATUS.md',
  '.github/RELEASE_TEMPLATE.md',
]) {
  rejectPattern(file, /Natively Setup|# Natively Roadmap|stealth activation|Cluely clone|version `1\.2\.0`/i, 'stale public launch wording found');
}

if (fs.existsSync(path.join(root, '.github/FUNDING.yml'))) {
  rejectPattern('.github/FUNDING.yml', /buymeacoffee\.com\/evinjohnn/i, 'stale funding account found');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Public docs check passed for OpenOffer ${pkg.version}.`);
