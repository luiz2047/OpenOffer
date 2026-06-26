import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('interview renderer preserves structured error codes and renders them in a popup', () => {
  const api = read('src/features/interviews/api.ts');
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const errors = read('src/features/interviews/interviewErrors.ts');

  assert.match(api, /throw new InterviewClientError\(result\)/);
  assert.match(errors, /errors\.interviews\.\$\{code\}/);
  assert.match(commandCenter, /useState<InterviewUiError \| null>/);
  assert.match(commandCenter, /role="alert"/);
  assert.match(commandCenter, /fixed bottom-5 right-5/);
  assert.match(commandCenter, /code: \{error\.code\}/);
  assert.doesNotMatch(commandCenter, /mx-5 mt-4 flex items-center gap-2 rounded-md border border-red-500/);
});
