import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const root = process.cwd();
const { resources } = await importTsModule(path.join(root, 'src/i18n/resources.ts'));

function flatten(value, prefix = '', out = {}) {
  if (typeof value === 'string') {
    out[prefix] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

test('Russian catalog covers English non-plural keys', () => {
  const en = flatten(resources.en.translation);
  const ru = flatten(resources.ru.translation);
  for (const key of Object.keys(en).filter((item) => !/_(one|other)$/.test(item))) {
    assert.equal(typeof ru[key], 'string', `missing ru key: ${key}`);
  }
});
