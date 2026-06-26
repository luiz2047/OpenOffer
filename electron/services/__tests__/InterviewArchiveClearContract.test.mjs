import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
let sqliteSkipReason = '';
try {
  const probe = new Database(':memory:');
  probe.close();
} catch (error) {
  sqliteSkipReason = `better-sqlite3 is unavailable in this Node runtime: ${error?.message || error}`;
}

const { applyInterviewSchema } = require(path.join(root, 'dist-electron/electron/services/interviews/schema.js'));
const { InterviewRepository, createBetterSqliteExecutor } = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewRepository.js'));
const { InterviewService } = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewService.js'));

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function createStack() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      start_time INTEGER,
      duration_ms INTEGER,
      summary TEXT
    );
  `);
  applyInterviewSchema(db);
  const repo = new InterviewRepository(createBetterSqliteExecutor(db));
  const service = new InterviewService(repo);
  return { db, service };
}

function intake(title, company) {
  return {
    intake: {
      classification: 'vacancy_with_scheduled_stage',
      confidence: 0.9,
      application: {
        title,
        company,
        roleTitle: 'Engineer',
        source: 'manual',
        requirements: [],
        risks: [],
        questionsToAsk: [],
        rawSourceText: title,
      },
      stage: {
        title: 'Recruiter screen',
        stageType: 'recruiter_screen',
        startsAt: 1_800_000_000_000,
        endsAt: 1_800_003_600_000,
        timezone: 'Europe/Moscow',
        status: 'scheduled',
      },
      warnings: [],
      missingFields: [],
    },
  };
}

test('clearArchivedApplications deletes archived vacancies without deleting archived stages in active vacancies', { skip: sqliteSkipReason || false }, () => {
  const { db, service } = createStack();
  const archived = service.createApplicationFromIntake('op-archived-clear', intake('Archived vacancy', 'ArchiveCo'));
  const active = service.createApplicationFromIntake('op-active-clear', intake('Active vacancy', 'ActiveCo'));
  const activeStageId = active.application.stages[0].id;

  service.updateApplication(archived.application.id, { status: 'archived' });
  service.archiveStage(activeStageId);

  db.prepare(`
    INSERT INTO meetings (id, title, created_at, start_time, duration_ms, application_id, interview_stage_id, interview_event_id)
    VALUES ('archived-meeting', 'Archived meeting', '2026-06-25T10:00:00.000Z', 1800000000000, 1800000, ?, ?, ?)
  `).run(archived.application.id, archived.application.stages[0].id, archived.legacyInterview.id);
  db.prepare(`
    INSERT INTO meetings (id, title, created_at, start_time, duration_ms, application_id, interview_stage_id, interview_event_id)
    VALUES ('active-stage-meeting', 'Active archived stage meeting', '2026-06-25T11:00:00.000Z', 1800003600000, 1800000, ?, ?, ?)
  `).run(active.application.id, activeStageId, active.legacyInterview.id);
  db.prepare(`
    INSERT INTO interview_events (id, title, status, archived_at, created_at, updated_at)
    VALUES ('orphan-legacy-archived', 'Standalone archived legacy event', 'archived', '2026-06-25T12:00:00.000Z', '2026-06-25T12:00:00.000Z', '2026-06-25T12:00:00.000Z')
  `).run();

  const result = service.clearArchivedApplications();

  assert.equal(result.applicationsDeleted, 1);
  assert.equal(result.stagesDeleted, 1);
  assert.equal(result.legacyEventsDeleted, 1);
  assert.equal(result.meetingsDetached, 1);
  assert.equal(service.listApplications({ includeArchived: true }).some(item => item.id === archived.application.id), false);

  const activeAfter = service.getApplication(active.application.id);
  assert.equal(activeAfter.stages.some(stage => stage.id === activeStageId && stage.status === 'archived'), true);

  const detached = db.prepare('SELECT application_id, interview_stage_id, interview_event_id FROM meetings WHERE id = ?').get('archived-meeting');
  assert.deepEqual(detached, { application_id: null, interview_stage_id: null, interview_event_id: null });
  const preserved = db.prepare('SELECT application_id, interview_stage_id, interview_event_id FROM meetings WHERE id = ?').get('active-stage-meeting');
  assert.equal(preserved.application_id, active.application.id);
  assert.equal(preserved.interview_stage_id, activeStageId);

  const orphanLegacy = db.prepare('SELECT id, status, archived_at FROM interview_events WHERE id = ?').get('orphan-legacy-archived');
  assert.equal(orphanLegacy.id, 'orphan-legacy-archived');
  assert.equal(orphanLegacy.status, 'archived');
  assert.equal(orphanLegacy.archived_at, '2026-06-25T12:00:00.000Z');
});

test('archive clear is wired through IPC, preload, renderer types, and the vacancy archive filter UI', () => {
  const ipc = read('electron/ipcHandlers.ts');
  const preload = read('electron/preload.ts');
  const types = read('src/types/electron.d.ts');
  const api = read('src/features/interviews/api.ts');
  const ui = read('src/features/interviews/InterviewCommandCenter.tsx');

  assert.match(ipc, /applications:clear-archived/);
  assert.match(preload, /applicationsClearArchived/);
  assert.match(types, /applicationsClearArchived/);
  assert.match(api, /clearArchived\(\)/);
  assert.match(ui, /clearArchivedApplications/);
  assert.match(ui, /statusFilter === 'archived'/);
  assert.match(ui, /interviews\.clearArchiveConfirm/);
});
