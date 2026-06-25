import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTsModule } from '../../scripts/i18n/load-ts-module.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const selectors = await importTsModule(path.join(root, 'src/features/interviews/vacancySelectors.ts'));

function stage(id, startsAt, status = 'scheduled') {
  return {
    id,
    status,
    archivedAt: status === 'archived' ? '2026-06-25T10:00:00.000Z' : null,
    startsAt,
    updatedAt: `2026-06-25T10:00:0${id.length}.000Z`,
  };
}

test('getNearestStage chooses the soonest upcoming active stage', () => {
  const reference = 1_800_000_000_000;
  const result = selectors.getNearestStage([
    stage('later', reference + 7_200_000),
    stage('archived', reference + 600_000, 'archived'),
    stage('soon', reference + 1_800_000),
  ], reference);

  assert.equal(result.id, 'soon');
});

test('getNearestStage falls back to the most recent active past stage when no upcoming stage exists', () => {
  const reference = 1_800_000_000_000;
  const result = selectors.getNearestStage([
    stage('past-later', reference - 1_800_000),
    stage('past-earlier', reference - 7_200_000),
    stage('archived', reference + 1_800_000, 'archived'),
  ], reference);

  assert.equal(result.id, 'past-later');
});

test('getNearestStage returns null when every stage is archived', () => {
  assert.equal(selectors.getNearestStage([stage('archived', 1_800_000_000_000, 'archived')]), null);
});
