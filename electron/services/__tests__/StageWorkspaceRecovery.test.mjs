import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const databaseManager = fs.readFileSync(path.join(root, 'electron/db/DatabaseManager.ts'), 'utf8');

test('startup recovery releases stale Stage Workspace recorder leases', () => {
  assert.match(databaseManager, /recoverStageSessionsOnStartup\(\)/);
  assert.match(databaseManager, /status IN \('initializing', 'recording', 'stopping'\)/);
  assert.match(databaseManager, /stop_interrupted/);
  assert.match(databaseManager, /capture_start_interrupted/);
  assert.match(databaseManager, /session_abandoned/);
  assert.match(databaseManager, /workspace_revision = workspace_revision \+ 1/);
  assert.match(databaseManager, /stage_artifact_jobs/);
  assert.match(databaseManager, /startup_retry_exhausted/);
  assert.match(databaseManager, /status = 'queued'/);
  assert.match(databaseManager, /updated_at < datetime\('now', '-30 days'\)/);
});
