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
const {
  parseInterviewSourceText,
} = require(path.join(root, 'dist-electron/electron/services/interviews/parser.js'));

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

  test('stores vacancy dossiers and clamps list size for bounded home rendering', () => {
    const { repo } = createStack();
    const first = repo.create({ title: 'Backend process' });
    const dossier = repo.saveDossier(first.id, {
      description: 'Payments backend vacancy',
      requirements: ['Node.js', 'PostgreSQL'],
      compensationText: '300-450k руб',
      fitHypothesis: 'Strong domain fit',
      risks: ['Legacy codebase'],
      questionsToAsk: ['How is on-call organized?'],
    }, 'op-dossier-1');

    assert.equal(dossier.description, 'Payments backend vacancy');
    assert.deepEqual(dossier.requirements, ['Node.js', 'PostgreSQL']);
    assert.equal(repo.saveDossier(first.id, { description: 'Replay must not win' }, 'op-dossier-1').description, 'Payments backend vacancy');

    for (let index = 0; index < 240; index += 1) {
      repo.create({ title: `Process ${index}` });
    }
    assert.equal(repo.list({ limit: 1000 }).length, 200);
  });

  test('filters lists by status and time range, archives rows, and can delete linked meetings', () => {
    const { db, repo } = createStack();
    const now = 1_800_000_000_000;
    const unscheduled = repo.create({ title: 'Unscheduled process', status: 'active' });
    const screen = repo.create({ title: 'Recruiter screen', status: 'screening', startsAt: now + 60_000 });
    const offer = repo.create({ title: 'Offer discussion', status: 'offer', startsAt: now + 7_200_000 });

    assert.deepEqual(repo.list({ status: 'screening' }).map(item => item.id), [screen.id]);
    assert.deepEqual(
      repo.list({ status: ['screening', 'offer'], range: { start: now, end: now + 3_600_000 } }).map(item => item.id),
      [screen.id],
    );

    assert.equal(repo.archive(screen.id), true);
    assert.deepEqual(repo.list({ status: ['screening', 'offer'] }).map(item => item.id), [offer.id]);

    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms, interview_event_id)
      VALUES ('meeting-delete-1', 'Delete with interview', '2026-06-18T10:00:00.000Z', ?, 3600000, ?)
    `).run(now, unscheduled.id);
    assert.equal(repo.hardDelete(unscheduled.id, true), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM meetings WHERE id = ?').get('meeting-delete-1').count, 0);
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

  test('rejects invalid enum and numeric payloads before persistence', () => {
    const { service } = createStack();
    const detail = service.create('op-validation-create', { title: 'Validation interview' });

    assert.throws(
      () => service.create('op-invalid-status', { title: 'Bad status', status: 'done' }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );
    assert.throws(
      () => service.create('op-invalid-priority', { title: 'Bad priority', priority: 'urgent' }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );
    assert.throws(
      () => service.update(detail.id, { calendarProvider: 'icloud' }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );
    assert.throws(
      () => service.saveRetro(detail.id, 'op-invalid-retro', { passProbability: 101 }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );
    assert.throws(
      () => service.saveQuestions(detail.id, 'op-invalid-quality', [{ questionText: 'Q', quality: 6 }]),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );

    const saved = service.saveQuestions(detail.id, 'op-valid-quality', [{ questionText: 'Q', quality: 5 }]);
    assert.equal(saved[0].quality, 5);

    service.archive(detail.id);
    assert.throws(
      () => service.saveDossier(detail.id, 'op-archived-dossier', { description: 'Should not save.' }),
      error => error instanceof InterviewDomainError && error.code === 'interview_deleted_or_archived',
    );
  });

  test('parses HR/vacancy paste safely and maps parser errors to IPC codes', async () => {
    const { service } = createStack();
    const parsed = service.parseSourceText({
      text: `
        <script>alert('xss')</script>
        Вакансия: Middle Backend Developer
        Компания: FinTech Lab
        https://hh.ru/vacancy/123
        https://meet.google.com/abc-defg-hij
        Требования:
        - Node.js
        - PostgreSQL
        Вопросы:
        - Как устроены релизы?
        Зарплата: 300-500k руб
      `,
    });

    assert.equal(parsed.fields.company, 'FinTech Lab');
    assert.equal(parsed.fields.roleTitle, 'Middle Backend Developer');
    assert.equal(parsed.fields.source, 'HH');
    assert.equal(parsed.fields.vacancyUrl, 'https://hh.ru/vacancy/123');
    assert.equal(parsed.fields.meetingUrl, 'https://meet.google.com/abc-defg-hij');
    assert.equal(parsed.dossier.compensationText, '300-500k руб');
    assert.deepEqual(parsed.prep.expectedTopics.slice(0, 2), ['Node.js', 'PostgreSQL']);
    assert.equal(parsed.normalizedText.includes('<script>'), false);

    const empty = await safeInterviewHandle(() => service.parseSourceText({ text: '   ' }));
    assert.equal(empty.ok, false);
    assert.equal(empty.code, 'parser_no_fields');

    const tooLarge = await safeInterviewHandle(() => service.parseSourceText({ text: 'x'.repeat(50001) }));
    assert.equal(tooLarge.ok, false);
    assert.equal(tooLarge.code, 'parser_input_too_large');

    const getmatch = parseInterviewSourceText('Getmatch role\\nCompany: Data Now\\nPosition: ML Engineer\\nhttps://getmatch.ru/vacancies/42');
    assert.equal(getmatch.detectedSource, 'Getmatch');
    const telegram = parseInterviewSourceText('Telegram HR\\nКомпания: BotWorks\\nПозиция: Frontend Developer\\nhttps://t.me/hr_channel');
    assert.equal(telegram.detectedSource, 'Telegram');
  });

  test('tracks retro prompt due, snooze, dismiss, and completion idempotently', () => {
    const { service } = createStack();
    const detail = service.create('op-ended-create', {
      title: 'Past technical',
      startsAt: Date.now() - 2 * 60 * 60 * 1000,
      endsAt: Date.now() - 60 * 60 * 1000,
    });

    const due = service.getRetroPrompt(detail.id);
    assert.equal(due.due, true);
    assert.equal(due.reason, 'due');
    assert.ok(due.state.promptedAt);

    const snoozed = service.updateRetroPrompt(detail.id, { action: 'snooze', snoozeMs: 60 * 60 * 1000 });
    assert.equal(snoozed.due, false);
    assert.equal(snoozed.reason, 'snoozed');

    const dismissed = service.updateRetroPrompt(detail.id, { action: 'dismiss' });
    assert.equal(dismissed.due, false);
    assert.equal(dismissed.reason, 'dismissed');

    service.saveRetro(detail.id, 'op-retro-complete', {
      passProbability: 80,
      mainSignal: 'Strong signal',
      strongMoments: ['Architecture'],
    });
    const complete = service.getRetroPrompt(detail.id);
    assert.equal(complete.due, false);
    assert.equal(complete.reason, 'has_retro');
    assert.ok(complete.state.completedAt);
  });
});
