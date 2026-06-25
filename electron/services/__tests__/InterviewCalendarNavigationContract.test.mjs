import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('left calendar pane uses a real date picker and readable selected-day label', () => {
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const datePicker = read('src/features/interviews/CalendarDatePickerButton.tsx');
  const helpers = read('src/features/interviews/dateTime.ts');
  const resources = read('src/i18n/resources.ts');

  assert.match(commandCenter, /CalendarDatePickerButton/);
  assert.match(commandCenter, /selectedDayLabel/);
  assert.doesNotMatch(commandCenter, /onClick=\{\(\) => setSelectedDate\(startOfDay\(new Date\(\)\)\)\}/);
  assert.doesNotMatch(commandCenter, /t\(['"]interviews\.selectedDay['"]\)/);
  assert.match(datePicker, /DayPicker/);
  assert.match(datePicker, /interviews\.today/);
  assert.match(datePicker, /interviews\.tomorrow/);
  assert.match(helpers, /formatCalendarDayLabel/);
  assert.match(resources, /Сегодня/);
  assert.match(resources, /Завтра/);
});
