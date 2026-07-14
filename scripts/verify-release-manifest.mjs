#!/usr/bin/env node

/**
 * Produce a small, reproducible release manifest after electron-builder.
 * The manifest is intentionally independent of GitHub Releases so preview
 * artifacts can be inspected locally before upload.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import process from 'node:process';

const root = process.cwd();
const releaseDir = path.resolve(root, process.argv[2] || 'release');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const maxBytes = Number(process.env.OPENOFFER_MAX_ARTIFACT_MB || 750) * 1024 * 1024;

if (!fs.existsSync(releaseDir)) throw new Error(`Release directory does not exist: ${releaseDir}`);

const files = fs.readdirSync(releaseDir, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name)
  .filter(name => !['SHA256SUMS.txt', 'RELEASE_MANIFEST.json'].includes(name))
  .sort();

if (files.length === 0) throw new Error(`No release files found in ${releaseDir}`);

const artifacts = files.map(name => {
  const filePath = path.join(releaseDir, name);
  const buffer = fs.readFileSync(filePath);
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) {
    throw new Error(`${name} is ${(stat.size / 1024 / 1024).toFixed(1)} MiB, above OPENOFFER_MAX_ARTIFACT_MB=${maxBytes / 1024 / 1024}`);
  }
  return {
    name,
    bytes: stat.size,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
});

const manifest = {
  schemaVersion: 1,
  product: 'OpenOffer',
  version: packageJson.version,
  generatedAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA || process.env.GIT_COMMIT || null,
  runner: { platform: process.platform, arch: process.arch, node: process.version, os: os.release() },
  artifacts,
};

fs.writeFileSync(path.join(releaseDir, 'RELEASE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(releaseDir, 'ARTIFACT_SIZES.md'), [
  `# OpenOffer ${packageJson.version} artifact sizes`,
  '',
  '| Asset | Size | SHA-256 |',
  '| --- | ---: | --- |',
  ...artifacts.map(item => `| ${item.name} | ${(item.bytes / 1024 / 1024).toFixed(1)} MiB | \`${item.sha256}\` |`),
  '',
].join('\n'));

console.log(JSON.stringify(manifest, null, 2));
