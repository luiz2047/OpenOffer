import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const {
  applyInterviewSchema,
} = require(path.join(root, 'dist-electron/electron/services/interviews/schema.js'));
const {
  InterviewRepository,
  createBetterSqliteExecutor,
} = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewRepository.js'));
const {
  InterviewDomainError,
  InterviewService,
  safeInterviewHandle,
} = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewService.js'));

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
  return { db, repo, service };
}

describe('Interview schema', () => {
  test('creates the interview domain tables, indexes, and meetings link column idempotently', () => {
    const { db } = createStack();
    applyInterviewSchema(db);

    const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    for (const table of [
      'interview_events',
      'vacancy_dossiers',
      'prep_briefs',
      'interview_retros',
      'interview_questions',
      'contacts',
      'interview_contacts',
      'retro_prompt_state',
      'interview_client_operations',
    ]) {
      assert.ok(tableNames.includes(table), `${table} must exist`);
    }

    const meetingColumns = db.prepare('PRAGMA table_info(meetings)').all().map(row => row.name);
    assert.ok(meetingColumns.includes('interview_event_id'));

    const eventIndexes = db.prepare('PRAGMA index_list(interview_events)').all().map(row => row.name);
    assert.ok(eventIndexes.includes('idx_interview_events_time'));
    assert.ok(eventIndexes.includes('idx_interview_events_status'));
    assert.ok(eventIndexes.includes('uq_interview_events_calendar_ref'));

    const operationColumns = db.prepare('PRAGMA table_info(interview_client_operations)').all();
    assert.deepEqual(
      operationColumns.filter(row => row.pk > 0).map(row => row.name),
      ['operation_id', 'action'],
      'idempotency records are scoped by operation id and action',
    );
  });
});

describe('InterviewRepository', () => {
  test('creates, lists, updates calendar links, and deduplicates client operations', () => {
    const { repo } = createStack();

    const first = repo.create({
      title: 'Backend screen',
      company: 'Acme',
      roleTitle: 'Middle Software Developer',
      startsAt: 1_800_000_000_000,
      rawSourceText: 'HH vacancy paste',
    }, 'op-create-1');
    const replay = repo.create({
      title: 'Different title must not win',
    }, 'op-create-1');

    assert.equal(replay.id, first.id);
    assert.equal(replay.title, 'Backend screen');

    const updated = repo.update(first.id, {
      calendarProvider: 'google',
      calendarId: 'primary',
      calendarEventId: 'evt-1',
      calendarLastSeenAt: 1_800_000_000_500,
      calendarSyncStatus: 'linked',
    });
    assert.equal(updated.calendarProvider, 'google');
    assert.equal(updated.calendarSyncStatus, 'linked');

    const second = repo.create({ title: 'System design interview' });
    assert.throws(
      () => repo.update(second.id, {
        calendarProvider: 'google',
        calendarId: 'primary',
        calendarEventId: 'evt-1',
      }),
      /UNIQUE constraint failed|constraint/i,
      'duplicate calendar references must be rejected by the schema',
    );

    const list = repo.list({ limit: 20 });
    assert.deepEqual(list.map(item => item.id), [first.id, second.id]);
    assert.equal(Object.hasOwn(list[0], 'rawSourceText'), false, 'list rows must stay lightweight');
  });

  test('stores prep, retros, question bank rows, and meeting attachments', () => {
    const { db, repo } = createStack();
    const event = repo.create({
      title: 'Frontend technical',
      company: 'Globex',
      roleTitle: 'React Developer',
      startsAt: Date.now() + 48 * 60 * 60 * 1000,
      meetingUrl: 'https://meet.example/call',
    });
    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms)
      VALUES ('meeting-1', 'Globex call', '2026-06-18T10:00:00.000Z', ?, 3600000)
    `).run(Date.now());

    const prep = repo.savePrep(event.id, {
      oneLineGoal: 'Show production ownership.',
      expectedTopics: ['React rendering', 'architecture'],
      cheatsheet: 'Use concrete stories.',
      riskHandling: ['Explain backend depth honestly.'],
      lastChecklist: ['Read vacancy', 'Open questions'],
    }, 'op-prep-1');
    assert.equal(prep.oneLineGoal, 'Show production ownership.');
    assert.deepEqual(prep.expectedTopics, ['React rendering', 'architecture']);

    const retro = repo.saveRetro(event.id, {
      passProbability: 70,
      mainSignal: 'Strong React signal, weak infra depth.',
      strongMoments: ['State management story'],
      weakMoments: ['Kubernetes follow-up'],
      newFacts: ['Next round with CTO'],
      followUpActions: ['Send availability'],
    }, 'op-retro-1');
    assert.equal(retro.passProbability, 70);

    const questions = repo.saveQuestions(event.id, [
      {
        questionText: 'How would you debug slow React renders?',
        category: 'frontend',
        quality: 4,
        weakSpot: false,
        followUpNote: 'Mention profiler first.',
      },
    ], 'op-questions-1');
    assert.equal(questions.length, 1);
    assert.equal(repo.listQuestions({ interviewId: event.id })[0].category, 'frontend');

    assert.equal(repo.attachMeeting(event.id, 'meeting-1'), true);
    const detail = repo.get(event.id, ['prep', 'retros', 'questions', 'meetings']);
    assert.equal(detail.linkedMeetings.length, 1);
    assert.equal(detail.linkedMeetings[0].id, 'meeting-1');

    assert.equal(repo.hardDelete(event.id, false), true);
    assert.equal(db.prepare('SELECT interview_event_id FROM meetings WHERE id = ?').get('meeting-1').interview_event_id, null);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM prep_briefs').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM interview_questions').get().count, 0);
  });
});

describe('InterviewService', () => {
  test('normalizes inputs, computes readiness, and wraps domain errors for IPC', async () => {
    const { service } = createStack();

    assert.throws(
      () => service.create('op-invalid', { title: '   ' }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );

    const detail = service.create('op-service-create', {
      title: 'ML system design',
      company: 'Initech',
      roleTitle: 'Middle Software Developer',
      startsAt: Date.now() + 36 * 60 * 60 * 1000,
      vacancyUrl: 'https://example.com/vacancy',
    });
    let readiness = service.getReadiness(detail.id);
    assert.equal(readiness.level, 'needs_work');
    assert.ok(readiness.blockers.includes('prep_missing'));

    service.savePrep(detail.id, 'op-service-prep', {
      oneLineGoal: 'Prove pragmatic ML platform experience.',
      cheatsheet: 'Batch inference, observability, rollback.',
      riskHandling: ['Explain limited MLOps ownership with adjacent examples.'],
      lastChecklist: ['Read vacancy', 'Prepare questions'],
    });
    readiness = service.getReadiness(detail.id);
    assert.ok(readiness.score >= 60);
    assert.equal(readiness.blockers.includes('prep_missing'), false);

    const second = service.create('op-service-create-2', { title: 'Duplicate calendar target' });
    service.update(detail.id, {
      calendarProvider: 'google',
      calendarId: 'primary',
      calendarEventId: 'evt-service-1',
      calendarSyncStatus: 'linked',
    });
    const duplicateCalendar = await safeInterviewHandle(() => service.update(second.id, {
      calendarProvider: 'google',
      calendarId: 'primary',
      calendarEventId: 'evt-service-1',
    }));
    assert.equal(duplicateCalendar.ok, false);
    assert.equal(duplicateCalendar.code, 'duplicate_calendar_ref');
    assert.equal(duplicateCalendar.action, 'open_existing');

    const missingPrep = await safeInterviewHandle(() => service.savePrep('missing', 'op-missing-prep', {
      oneLineGoal: 'Should not create an orphan row.',
    }));
    assert.equal(missingPrep.ok, false);
    assert.equal(missingPrep.code, 'not_found');

    const wrapped = await safeInterviewHandle(() => service.get({ id: 'missing' }));
    assert.equal(wrapped.ok, false);
    assert.equal(wrapped.code, 'not_found');
    assert.equal(wrapped.retryable, false);
  });
});
