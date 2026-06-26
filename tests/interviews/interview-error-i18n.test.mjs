import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/types/interviews.ts'), 'utf8');
const { resources } = await importTsModule(path.join(root, 'src/i18n/resources.ts'));

function extractInterviewErrorCodes() {
  const match = source.match(/export type InterviewErrorCode =([\s\S]*?);/);
  assert.ok(match, 'InterviewErrorCode union not found');
  return Array.from(match[1].matchAll(/'([^']+)'/g), item => item[1]);
}

test('every InterviewErrorCode has English and Russian i18n copy', () => {
  const codes = extractInterviewErrorCodes();
  const en = resources.en.translation.errors.interviews;
  const ru = resources.ru.translation.errors.interviews;

  assert.ok(codes.length > 0);
  for (const code of codes) {
    assert.equal(typeof en[code], 'string', `missing English errors.interviews.${code}`);
    assert.equal(typeof ru[code], 'string', `missing Russian errors.interviews.${code}`);
    assert.ok(en[code].length > 8, `English errors.interviews.${code} is too short`);
    assert.ok(ru[code].length > 8, `Russian errors.interviews.${code} is too short`);
  }
});
