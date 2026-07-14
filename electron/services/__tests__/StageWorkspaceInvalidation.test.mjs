import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('stage invalidations carry only revisions and a reconnectable sequence', () => {
  const source = fs.readFileSync(path.join(root, 'electron/services/interviews/StageWorkspaceEvents.ts'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron/preload.ts'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/features/interviews/StageWorkspacePanel.tsx'), 'utf8');
  assert.match(source, /eventSeq/);
  assert.match(source, /workspaceRevision/);
  assert.match(source, /stage-workspace-invalidated/);
  assert.doesNotMatch(source, /sourceText|transcript|review_json/);
  assert.match(preload, /onStageWorkspaceInvalidated/);
  assert.match(panel, /sequenceGap/);
  assert.match(panel, /stageWorkspaceApi\.get|void load\(\)/);
});
