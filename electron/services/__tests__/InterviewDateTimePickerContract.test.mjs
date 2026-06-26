import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('interview date fields use the shared picker instead of raw datetime-local inputs', () => {
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const picker = read('src/features/interviews/DateTimePickerField.tsx');
  const helpers = read('src/features/interviews/dateTime.ts');

  assert.match(commandCenter, /import \{ DateTimePickerField \} from '\.\/DateTimePickerField'/);
  assert.doesNotMatch(commandCenter, /type=["']datetime-local["']/);
  assert.match(commandCenter, /updateCreateFormDate\('startsAt'/);
  assert.match(commandCenter, /updateStageDraftDate\(stage, 'startsAt'/);
  assert.match(picker, /DayPicker/);
  assert.match(helpers, /normalizeStageDateRange/);
  assert.match(helpers, /isStageDateRangeInvalid/);
});
