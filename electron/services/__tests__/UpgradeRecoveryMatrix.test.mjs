import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(new URL('.', import.meta.url).pathname, '../../..');

test('upgrade/recovery matrix preserves v19 data and can replay migration after restore', async () => {
  const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/openoffer-v19.sql'), 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-upgrade-'));
  const preMigration = path.join(dir, 'v19.sqlite');
  const restored = path.join(dir, 'restored.sqlite');
  try {
    const db = new Database(preMigration);
    db.exec(fixture);
    assert.equal(db.pragma('user_version', { simple: true }), 19);
    await import('../../../dist-electron/electron/services/interviews/schema.js').then(({ applyInterviewSchema }) => {
      applyInterviewSchema(db);
      applyInterviewSchema(db);
    });
    assert.equal(db.prepare('SELECT title FROM meetings WHERE id = ?').get('meeting-v19').title, 'Technical interview');
    assert.doesNotThrow(() => db.prepare('SELECT 1 FROM stage_workspace_operations LIMIT 1').get());
    await db.backup(restored);
    db.close();

    const recovered = new Database(restored);
    assert.equal(recovered.prepare('SELECT title FROM meetings WHERE id = ?').get('meeting-v19').title, 'Technical interview');
    assert.doesNotThrow(() => recovered.prepare('SELECT 1 FROM stage_sessions LIMIT 1').get());
    recovered.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
