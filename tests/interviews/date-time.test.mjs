import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const dateTime = await importTsModule(path.join(root, 'src/features/interviews/dateTime.ts'));

test('local date-time values round trip without converting empty values to epoch zero', () => {
  assert.equal(dateTime.toLocalDateTimeInputValue(null), '');
  assert.equal(dateTime.fromLocalDateTimeInputValue(''), null);
  assert.equal(dateTime.fromLocalDateTimeInputValue('bad-value'), null);

  const value = '2026-06-25T09:30';
  const epoch = dateTime.fromLocalDateTimeInputValue(value);

  assert.equal(typeof epoch, 'number');
  assert.equal(dateTime.toLocalDateTimeInputValue(epoch), value);
});

test('date and time parts combine into a local timestamp', () => {
  const epoch = dateTime.epochFromLocalDateAndTime(new Date(2026, 5, 25), '14:15');

  assert.equal(dateTime.toLocalDateTimeInputValue(epoch), '2026-06-25T14:15');
  assert.equal(dateTime.epochFromLocalDateAndTime(new Date(2026, 5, 25), '99:99'), null);
});

test('stage date ranges default to a one-hour duration when start changes', () => {
  const startsAt = dateTime.fromLocalDateTimeInputValue('2026-06-25T10:00');

  const normalized = dateTime.normalizeStageDateRange({ startsAt, endsAt: null }, 'startsAt');

  assert.equal(normalized.startsAt, startsAt);
  assert.equal(normalized.endsAt, startsAt + dateTime.DEFAULT_STAGE_DURATION_MS);
});

test('manual end edits can stay invalid so save validation can block them', () => {
  const startsAt = dateTime.fromLocalDateTimeInputValue('2026-06-25T10:00');
  const endsAt = dateTime.fromLocalDateTimeInputValue('2026-06-25T09:30');

  const normalized = dateTime.normalizeStageDateRange({ startsAt, endsAt }, 'endsAt');

  assert.equal(normalized.endsAt, endsAt);
  assert.equal(dateTime.isStageDateRangeInvalid(normalized), true);
});

test('moving a start after an existing end moves the end to the default duration', () => {
  const startsAt = dateTime.fromLocalDateTimeInputValue('2026-06-25T12:00');
  const endsAt = dateTime.fromLocalDateTimeInputValue('2026-06-25T11:00');

  const normalized = dateTime.normalizeStageDateRange({ startsAt, endsAt }, 'startsAt');

  assert.equal(normalized.endsAt, startsAt + dateTime.DEFAULT_STAGE_DURATION_MS);
  assert.equal(dateTime.isStageDateRangeInvalid(normalized), false);
});

test('calendar day labels distinguish today, tomorrow, and exact dates', () => {
  const reference = new Date(2026, 5, 25, 12, 0);
  const labels = { today: 'Today', tomorrow: 'Tomorrow' };

  assert.equal(dateTime.classifyCalendarDay(new Date(2026, 5, 25, 23, 59), reference), 'today');
  assert.equal(dateTime.classifyCalendarDay(new Date(2026, 5, 26, 0, 1), reference), 'tomorrow');
  assert.equal(dateTime.classifyCalendarDay(new Date(2026, 5, 27, 9, 0), reference), 'date');
  assert.equal(dateTime.formatCalendarDayLabel(new Date(2026, 5, 25), labels, 'en-US', reference), 'Today');
  assert.equal(dateTime.formatCalendarDayLabel(new Date(2026, 5, 26), labels, 'en-US', reference), 'Tomorrow');
  assert.match(dateTime.formatCalendarDayLabel(new Date(2026, 5, 27), labels, 'en-US', reference), /2026/);
});
