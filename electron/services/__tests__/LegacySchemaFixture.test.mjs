import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('v19 interview fixture upgrades additively and remains idempotent', async () => {
  const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/openoffer-v19.sql'), 'utf8');
  const db = new Database(':memory:');
  db.exec(fixture);

  // The compiled schema helper is the same additive operation used by the
  // v19 -> v20 migration inside DatabaseManager.
  const { applyInterviewSchema } = await import('../../../dist-electron/electron/services/interviews/schema.js');
  applyInterviewSchema(db);
  applyInterviewSchema(db);

  assert.equal(db.pragma('user_version', { simple: true }), 19);
  assert.equal(db.prepare('SELECT title FROM meetings WHERE id = ?').get('meeting-v19').title, 'Technical interview');
  for (const table of ['stage_sessions', 'stage_session_contexts', 'stage_session_artifacts', 'stage_artifact_jobs', 'stage_workspace_operations']) {
    assert.doesNotThrow(() => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get());
  }
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_stage_sessions_validate_insert'").get().sql, /stage session stage not found/);
  db.close();
});
