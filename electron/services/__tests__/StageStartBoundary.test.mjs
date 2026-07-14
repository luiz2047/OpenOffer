import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('stage cards cannot bypass the selected-workspace readiness and context boundary', () => {
  const commandCenter = fs.readFileSync(path.join(root, 'src/features/interviews/InterviewCommandCenter.tsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/features/interviews/StageWorkspacePanel.tsx'), 'utf8');
  const ipc = fs.readFileSync(path.join(root, 'electron/ipcHandlers.ts'), 'utf8');
  assert.match(commandCenter, /onClick=\{\(\) => openStageWorkspace\(stage\)\}/);
  assert.doesNotMatch(commandCenter, /onClick=\{\(\) => void startStageRecording\(stage\)\}/);
  const globalStart = commandCenter.match(/const startSelectedInterview = \(\) => \{([\s\S]*?)\n\s*\};\n\n  const paneLayoutStyle/);
  assert.ok(globalStart, 'global start handler should remain explicit and inspectable');
  assert.doesNotMatch(globalStart[1], /onStartMeeting\(/);
  assert.match(globalStart[1], /setDetailTab\(['"]Stages['"]\)/);
  assert.match(globalStart[1], /setWorkspaceStageId\(targetStage\.id\)/);
  assert.match(panel, /!contextConfirmed/);
  assert.match(panel, /stageWorkspaceApi\.start/);
  assert.match(panel, /confirmed: true/);
  assert.match(ipc, /stage_workspace_required/);
  assert.match(ipc, /ss\.status = 'initializing'/);
  assert.match(ipc, /stage_session_not_ready/);
  assert.match(commandCenter, /stageWorkspaceApi\.updateStage\(stage\.id, patch, workspace\.revision\)/);
  assert.match(ipc, /interview-stages:update[\s\S]*getStageWorkspaceService\(\)\.updateStageDetails/);
  assert.match(ipc, /interview-stages:archive[\s\S]*getStageWorkspaceService\(\)\.updateStageDetails/);
  assert.match(ipc, /interview-stages:attach-meeting[\s\S]*getStageWorkspaceService\(\)\.attachMeeting/);
  assert.match(ipc, /stage-workspace:attach-meeting/);
});
