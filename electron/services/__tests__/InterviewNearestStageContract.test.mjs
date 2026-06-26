import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('vacancy detail derives nearest stage instead of exposing legacy next action fields', () => {
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const selector = read('src/features/interviews/vacancySelectors.ts');
  const resources = read('src/i18n/resources.ts');

  assert.match(commandCenter, /getNearestStage\(stages\)/);
  assert.match(commandCenter, /interviews\.detail\.nearestStage/);
  assert.match(commandCenter, /setDetailTab\('Stages'\)/);
  assert.doesNotMatch(commandCenter, /Field label=\{t\(['"]interviews\.detail\.nextAction['"]\)\}/);
  assert.doesNotMatch(commandCenter, /Field label=\{t\(['"]interviews\.detail\.nextActionDueAt['"]\)\}/);
  assert.match(selector, /function isActiveStage/);
  assert.match(resources, /Ближайший этап/);
});
