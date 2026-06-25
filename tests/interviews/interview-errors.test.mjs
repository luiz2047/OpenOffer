import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const errors = await importTsModule(path.join(root, 'src/features/interviews/interviewErrors.ts'));

test('structured interview client errors keep code, retryability, action, and i18n key', () => {
  const err = new errors.InterviewClientError({
    ok: false,
    code: 'calendar_refresh_failed',
    message: 'Calendar failed',
    retryable: true,
    action: 'refresh_calendar',
  });

  assert.equal(err.code, 'calendar_refresh_failed');
  assert.equal(err.retryable, true);
  assert.equal(err.action, 'refresh_calendar');
  assert.equal(err.i18nKey, 'errors.interviews.calendar_refresh_failed');
});

test('unknown errors normalize to unexpected_error with retry action', () => {
  const err = errors.normalizeInterviewError(new Error('boom'));

  assert.equal(err.code, 'unexpected_error');
  assert.equal(err.retryable, true);
  assert.equal(err.action, 'retry');
  assert.equal(err.i18nKey, 'errors.interviews.unexpected_error');
});
