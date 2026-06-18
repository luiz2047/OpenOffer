#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'assets', 'brand', 'openoffer-mark.svg');

const fullPngTargets = [
  ['assets/brand/openoffer-mark.png', 1024],
  ['assets/icon.png', 512],
  ['assets/icons/png/icon_16x16.png', 16],
  ['assets/icons/png/icon_32x32.png', 32],
  ['assets/icons/png/icon_64x64.png', 64],
  ['assets/icons/png/icon_128x128.png', 128],
  ['assets/icons/png/icon_256x256.png', 256],
  ['assets/icons/png/icon_512x512.png', 512],
  ['assets/icons/png/icon_1024x1024.png', 1024],
  ['src/assets/logowebsite.png', 1024],
  ['src/icons/icon_16x16.png', 16],
  ['src/icons/icon_32x32.png', 32],
  ['src/icons/icon_64x64.png', 64],
  ['src/icons/icon_128x128.png', 128],
  ['src/icons/icon_256x256.png', 256],
  ['src/icons/icon_512x512.png', 512],
  ['src/icons/icon_1024x1024.png', 1024],
  ['renderer/public/logo192.png', 192],
  ['renderer/public/logo512.png', 512],
  ['openoffer-browser/icons/icon_16x16.png', 16],
  ['openoffer-browser/icons/icon_32x32.png', 32],
  ['openoffer-browser/icons/icon_64x64.png', 64],
  ['openoffer-browser/icons/icon_128x128.png', 128],
];

const symbolPngTargets = [
  ['assets/brand/openoffer-symbol.png', 1024],
  ['src/assets/logo.png', 644],
  ['src/components/icon.png', 644],
];

const symbolWebpTargets = [
  ['src/assets/logo.webp', 644],
];

const templateTargets = [
  ['assets/iconTemplate.png', 22],
  ['src/components/iconTemplate.png', 22],
];

const iconsetTargets = [
  'assets/icon.icns',
  'assets/openoffer.icns',
  'assets/icons/mac/icon.icns',
  'src/icons/AppIcon.icns',
];

const icoTargets = [
  ['assets/icons/win/icon.ico', [16, 24, 32, 48, 64, 128, 256]],
  ['renderer/public/favicon.ico', [16, 32, 48]],
];

function repoPath(relativePath) {
  return path.join(root, relativePath);
}

async function ensureParent(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

function withoutBackground(svg) {
  return svg.replace(/\n\s*<rect\b[^>]*fill="#0B1020"\/>/, '');
}

function asTemplate(svg) {
  return withoutBackground(svg)
    .replace(/stroke="url\(#openoffer-ring\)"/g, 'stroke="#000000"')
    .replace(/stroke="#F8FAFC"/g, 'stroke="#000000"')
    .replace(/stop-color="#[A-Fa-f0-9]+"/g, 'stop-color="#000000"');
}

async function writePng(svg, relativePath, size) {
  const output = repoPath(relativePath);
  await ensureParent(output);
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function writeWebp(svg, relativePath, size) {
  const output = repoPath(relativePath);
  await ensureParent(output);
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain' })
    .webp({ quality: 95 })
    .toFile(output);
}

async function pngBuffer(svg, size) {
  return sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function encodeIco(entries) {
  const headerSize = 6;
  const entrySize = 16;
  const count = entries.length;
  const header = Buffer.alloc(headerSize + entrySize * count);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = header.length;
  const images = [];
  entries.forEach(({ size, buffer }, index) => {
    const entryOffset = headerSize + entrySize * index;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    images.push(buffer);
    offset += buffer.length;
  });

  return Buffer.concat([header, ...images]);
}

async function writeIco(svg, relativePath, sizes) {
  const entries = [];
  for (const size of sizes) {
    entries.push({ size, buffer: await pngBuffer(svg, size) });
  }
  const output = repoPath(relativePath);
  await ensureParent(output);
  await fsp.writeFile(output, encodeIco(entries));
}

async function writeIconset(svg, iconsetDir) {
  await fsp.rm(iconsetDir, { recursive: true, force: true });
  await fsp.mkdir(iconsetDir, { recursive: true });
  const iconsetFiles = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ];
  for (const [fileName, size] of iconsetFiles) {
    await sharp(Buffer.from(svg))
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconsetDir, fileName));
  }
}

async function writeIcns(svg, relativePath) {
  if (process.platform !== 'darwin') {
    throw new Error(`Cannot generate ${relativePath}: iconutil is only available on macOS.`);
  }
  const output = repoPath(relativePath);
  await ensureParent(output);
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'openoffer-iconset-'));
  const iconsetDir = path.join(tmp, 'OpenOffer.iconset');
  try {
    await writeIconset(svg, iconsetDir);
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', output], { stdio: 'inherit' });
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
}

async function mirrorSourceIconset(svg) {
  const iconsetDir = repoPath('src/icons/openoffer.iconset');
  await writeIconset(svg, iconsetDir);
}

async function generate() {
  const fullSvg = await fsp.readFile(sourcePath, 'utf8');
  const symbolSvg = withoutBackground(fullSvg);
  const templateSvg = asTemplate(fullSvg);

  for (const [relativePath, size] of fullPngTargets) {
    await writePng(fullSvg, relativePath, size);
  }
  for (const [relativePath, size] of symbolPngTargets) {
    await writePng(symbolSvg, relativePath, size);
  }
  for (const [relativePath, size] of symbolWebpTargets) {
    await writeWebp(symbolSvg, relativePath, size);
  }
  for (const [relativePath, size] of templateTargets) {
    await writePng(templateSvg, relativePath, size);
  }
  for (const [relativePath, sizes] of icoTargets) {
    await writeIco(fullSvg, relativePath, sizes);
  }
  for (const relativePath of iconsetTargets) {
    await writeIcns(fullSvg, relativePath);
  }
  await mirrorSourceIconset(fullSvg);
}

async function verifyPng(relativePath, size) {
  const metadata = await sharp(repoPath(relativePath)).metadata();
  if (metadata.width !== size || metadata.height !== size) {
    throw new Error(`${relativePath} expected ${size}x${size}, got ${metadata.width}x${metadata.height}`);
  }
}

async function verifyIco(relativePath) {
  const buffer = await fsp.readFile(repoPath(relativePath));
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1 || buffer.readUInt16LE(4) < 1) {
    throw new Error(`${relativePath} is not a valid ICO file`);
  }
}

async function verify() {
  for (const [relativePath, size] of [...fullPngTargets, ...symbolPngTargets, ...templateTargets]) {
    await verifyPng(relativePath, size);
  }
  for (const [relativePath, size] of symbolWebpTargets) {
    const metadata = await sharp(repoPath(relativePath)).metadata();
    if (metadata.width !== size || metadata.height !== size || metadata.format !== 'webp') {
      throw new Error(`${relativePath} expected ${size}x${size} webp`);
    }
  }
  for (const [relativePath] of icoTargets) {
    await verifyIco(relativePath);
  }
  for (const relativePath of iconsetTargets) {
    const file = repoPath(relativePath);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1024) {
      throw new Error(`${relativePath} is missing or too small`);
    }
  }
}

await generate();
await verify();

console.log('[brand-assets] generated OpenOffer logo assets from assets/brand/openoffer-mark.svg');
