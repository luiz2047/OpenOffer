import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const helpers = await importTsModule(path.join(root, 'src/features/interviews/topSearchHelpers.ts'));

test('Russian recruiter next-stage messages route to add-stage intent', () => {
  const intent = helpers.detectTopSearchPasteIntent(
    'Приглашаем на следующий этап по вакансии Acme Backend Developer. Техническое интервью завтра, ссылка https://meet.example/ru-tech',
  );

  assert.equal(intent.intent, 'stage');
  assert.ok(intent.stageScore > intent.vacancyScore);
});

test('English recruiter next-stage messages route to add-stage intent', () => {
  const intent = helpers.detectTopSearchPasteIntent(
    'Synthetic stage update for existing saved vacancy. Technical interview tomorrow at https://meet.example/tech',
  );

  assert.equal(intent.intent, 'stage');
  assert.ok(intent.stageScore > intent.vacancyScore);
});
