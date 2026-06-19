import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

function createStack(options = {}) {
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
  const service = new InterviewService(repo, options.resolveModelForTask, options.generateStructuredContent);
  return { db, repo, service };
}

function createTranscriptTable(db) {
  db.exec(`
    CREATE TABLE transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT,
      speaker TEXT,
      content TEXT,
      timestamp_ms INTEGER
    );
  `);
}

describe('Interview schema', () => {
  test('creates the interview domain tables, indexes, and meetings link column idempotently', () => {
    const { db } = createStack();
    applyInterviewSchema(db);

    const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    for (const table of [
      'interview_events',
      'applications',
      'interview_stages',
      'legacy_interview_event_map',
      'vacancy_dossiers',
      'prep_briefs',
      'interview_retros',
      'interview_questions',
      'contacts',
      'interview_contacts',
      'retro_prompt_state',
      'interview_client_operations',
      'agent_proposal_applied_groups',
      'interview_retro_evaluations',
    ]) {
      assert.ok(tableNames.includes(table), `${table} must exist`);
    }

    const meetingColumns = db.prepare('PRAGMA table_info(meetings)').all().map(row => row.name);
    assert.ok(meetingColumns.includes('interview_event_id'));
    assert.ok(meetingColumns.includes('interview_stage_id'));
    assert.ok(meetingColumns.includes('application_id'));

    const eventIndexes = db.prepare('PRAGMA index_list(interview_events)').all().map(row => row.name);
    assert.ok(eventIndexes.includes('idx_interview_events_time'));
    assert.ok(eventIndexes.includes('idx_interview_events_status'));
    assert.ok(eventIndexes.includes('uq_interview_events_calendar_ref'));
    const stageIndexes = db.prepare('PRAGMA index_list(interview_stages)').all().map(row => row.name);
    assert.ok(stageIndexes.includes('uq_interview_stages_calendar_ref'));
    const meetingIndexes = db.prepare('PRAGMA index_list(meetings)').all().map(row => row.name);
    assert.ok(meetingIndexes.includes('idx_meetings_application_id'));
    assert.ok(meetingIndexes.includes('idx_meetings_interview_stage_id'));
    assert.ok(meetingIndexes.includes('idx_meetings_interview_event_id'));
    assert.ok(meetingIndexes.includes('idx_meetings_calendar_event_id'));
    const retroEvalIndexes = db.prepare('PRAGMA index_list(interview_retro_evaluations)').all().map(row => row.name);
    assert.ok(retroEvalIndexes.includes('idx_interview_retro_evaluations_meeting_id'));

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
    assert.equal(detail.linkedMeetings[0].interviewEventId, event.id);

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

  test('creates application and stage from intake while preserving legacy interview compatibility', () => {
    const { db, repo } = createStack();
    const result = repo.createApplicationFromIntake({
      classification: 'vacancy_with_scheduled_stage',
      confidence: 0.9,
      application: {
        title: 'Acme ML Engineer',
        company: 'Acme',
        roleTitle: 'ML Engineer',
        description: 'Acme is hiring an ML Engineer for a production model deployment process. A recruiter screen is scheduled.',
        source: 'HH',
        vacancyUrl: 'https://example.com/vacancy/1',
        requirements: ['Stack: Python'],
        risks: ['Legacy stack'],
        questionsToAsk: ['How is ML deployed?'],
        rawSourceText: 'Acme ML Engineer interview tomorrow',
      },
      stage: {
        title: 'Recruiter screen',
        stageType: 'recruiter_screen',
        startsAt: 1_800_000_000_000,
        endsAt: 1_800_003_600_000,
        timezone: 'Europe/Moscow',
        meetingUrl: 'https://meet.example/acme',
        status: 'scheduled',
      },
      warnings: [],
      missingFields: [],
    }, 'op-app-intake-1');

    assert.equal(result.application.company, 'Acme');
    assert.equal(result.application.stages.length, 1);
    assert.equal(result.application.stages[0].status, 'scheduled');
    assert.ok(result.legacyInterview?.id);

    const mapped = repo.get(result.legacyInterview.id, ['dossier']);
    assert.equal(mapped.applicationId, result.application.id);
    assert.equal(mapped.selectedStageId, result.application.stages[0].id);
    assert.equal(mapped.dossier.description, 'Acme is hiring an ML Engineer for a production model deployment process. A recruiter screen is scheduled.');
    assert.notEqual(mapped.dossier.description, mapped.rawSourceText);
    assert.deepEqual(mapped.dossier.requirements, ['Stack: Python']);
    const stage = repo.updateStageCalendarForLegacyInterview(result.legacyInterview.id, {
      calendarProvider: 'google',
      calendarId: 'primary',
      calendarEventId: 'evt-stage-1',
      calendarSyncStatus: 'linked',
    });
    assert.equal(stage.calendarEventId, 'evt-stage-1');
    assert.equal(repo.getApplication(result.application.id).stages[0].calendarSyncStatus, 'linked');
    assert.equal(repo.listApplications()[0].id, result.application.id);

    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms, application_id)
      VALUES ('meeting-app-link', 'Application linked recording', '2026-06-18T11:00:00.000Z', ?, 1800000, ?)
    `).run(1_800_000_000_000, result.application.id);
    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms, interview_stage_id)
      VALUES ('meeting-stage-link', 'Stage linked recording', '2026-06-18T12:00:00.000Z', ?, 1800000, ?)
    `).run(1_800_003_600_000, result.application.stages[0].id);
    const detailWithLinkage = repo.get(result.legacyInterview.id, ['meetings']);
    assert.deepEqual(
      detailWithLinkage.linkedMeetings.map(meeting => meeting.id),
      ['meeting-stage-link', 'meeting-app-link'],
      'legacy detail reads include stage/application-linked recordings',
    );
    const applicationDetail = repo.getApplication(result.application.id);
    assert.deepEqual(
      applicationDetail.linkedMeetings.map(meeting => meeting.id),
      ['meeting-stage-link', 'meeting-app-link'],
      'application detail exposes enough linked meeting ids for vacancy refresh',
    );
    assert.equal(
      applicationDetail.linkedMeetings.find(meeting => meeting.id === 'meeting-stage-link')?.interviewStageId,
      result.application.stages[0].id,
    );
    assert.equal(
      applicationDetail.linkedMeetings.find(meeting => meeting.id === 'meeting-app-link')?.applicationId,
      result.application.id,
    );

    const legacyOnly = repo.create({ title: 'Legacy only calendar owner' });
    repo.update(legacyOnly.id, {
      calendarProvider: 'google',
      calendarId: 'primary',
      calendarEventId: 'evt-legacy-only',
      calendarSyncStatus: 'linked',
    });
    assert.throws(
      () => repo.updateCalendarForLegacyInterview(result.legacyInterview.id, {
        calendarProvider: 'google',
        calendarId: 'primary',
        calendarEventId: 'evt-legacy-only',
        calendarSyncStatus: 'linked',
      }),
      /UNIQUE constraint failed|constraint/i,
      'legacy and stage calendar updates must roll back together on duplicate references',
    );
    assert.equal(repo.getApplication(result.application.id).stages[0].calendarEventId, 'evt-stage-1');
  });

  test('adds a proposed stage to an existing application without duplicating the vacancy', () => {
    const { repo } = createStack();
    const initial = repo.createApplicationFromIntake({
      classification: 'vacancy_only',
      confidence: 0.8,
      application: {
        title: 'Northstar Learning Data Scientist',
        company: 'Northstar Learning',
        roleTitle: 'Data Scientist',
        source: 'Telegram',
        requirements: ['ML', 'LLM'],
        risks: [],
        questionsToAsk: [],
        rawSourceText: 'Initial synthetic vacancy paste',
      },
      warnings: [],
      missingFields: [],
    }, 'op-northstar-vacancy');

    const attached = repo.createApplicationFromIntake({
      classification: 'vacancy_with_scheduled_stage',
      confidence: 0.9,
      application: {
        title: 'Northstar Learning Data Scientist',
        company: 'Northstar Learning',
        roleTitle: 'Data Scientist',
        source: 'Telegram',
        requirements: [],
        risks: [],
        questionsToAsk: [],
        rawSourceText: 'Synthetic stage paste',
      },
      stage: {
        title: 'Recruiter screen',
        stageType: 'recruiter_screen',
        startsAt: 1_780_919_600_000,
        endsAt: 1_780_920_500_000,
        timezone: 'Europe/Moscow',
        meetingUrl: 'https://telemost.yandex.ru/j/10000000000002',
        status: 'scheduled',
      },
      warnings: [],
      missingFields: [],
    }, 'op-northstar-stage', initial.application.id);

    assert.equal(repo.listApplications().length, 1);
    assert.equal(attached.application.id, initial.application.id);
    assert.equal(attached.application.stages.length, 1);
    assert.equal(attached.application.stages[0].meetingUrl, 'https://telemost.yandex.ru/j/10000000000002');
    assert.equal(attached.legacyInterview.applicationId, initial.application.id);
    assert.equal(attached.legacyInterview.selectedStageId, attached.application.stages[0].id);

    repo.update(attached.legacyInterview.id, { status: 'withdrawn' });
    assert.equal(repo.getApplication(initial.application.id).status, 'withdrawn');

    assert.equal(repo.archive(attached.legacyInterview.id), true);
    const archived = repo.getApplication(initial.application.id);
    assert.equal(archived.status, 'archived');
    assert.ok(archived.archivedAt);
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
      () => service.createApplicationFromIntake('op-invalid-intake-url', {
        intake: {
          classification: 'vacancy_with_scheduled_stage',
          confidence: 0.8,
          application: {
            title: 'Unsafe intake',
            vacancyUrl: 'not-a-url',
            rawSourceText: 'raw',
          },
          stage: {
            stageType: 'recruiter_screen',
            status: 'scheduled',
          },
          warnings: [],
          missingFields: [],
        },
      }),
      error => error instanceof InterviewDomainError && error.code === 'invalid_payload',
    );
    assert.throws(
      () => service.createApplicationFromIntake('op-invalid-intake-stage', {
        intake: {
          classification: 'vacancy_with_scheduled_stage',
          confidence: 0.8,
          application: {
            title: 'Unsafe intake',
            rawSourceText: 'raw',
          },
          stage: {
            stageType: 'unknown_stage',
            status: 'scheduled',
          },
          warnings: [],
          missingFields: [],
        },
      }),
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

  test('uses task model policy and structured AI to improve agent vacancy intake', async () => {
    const sourceText = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/synthetic-cv-hr-vacancy.txt'), 'utf8');
    const startsAt = Date.parse('2026-06-10T11:00:00.000Z');
    const endsAt = Date.parse('2026-06-10T12:00:00.000Z');
    const { service } = createStack({
      resolveModelForTask: (task) => {
        assert.equal(task, 'agent_actions');
        return {
          task,
          requestedMode: 'pinned',
          resolvedModelId: 'gpt-5.4',
          availability: 'available',
          fallbackUsed: false,
          warnings: [],
        };
      },
      generateStructuredContent: async (prompt, options) => {
        assert.equal(options.modelId, 'gpt-5.4');
        assert.equal(options.task, 'agent_actions');
        assert.match(prompt, /Task: agent_actions/);
        assert.match(prompt, /Orbit Vision Lab/);
        assert.match(prompt, /application.description must be a concise 1-3 sentence summary/);
        assert.match(prompt, /Prefix each item with a logical group/);
        return JSON.stringify({
          classification: 'vacancy_with_scheduled_stage',
          confidence: 0.93,
          application: {
            title: 'Orbit Vision Lab · Senior / Middle+ ML Engineer',
            company: 'Orbit Vision Lab',
            roleTitle: 'Senior / Middle+ Machine Learning Engineer',
            description: 'Orbit Vision Lab builds production computer-vision services for image and video processing. The role is a hands-on ML engineering position focused on production CV pipelines, with an interview already scheduled.',
            source: 'HH',
            vacancyUrl: 'https://example.com/vacancy/orbit-vision-ml',
            compensationText: null,
            requirements: ['Stack: Python 3.x', 'Domain: Computer Vision', 'Stack: OpenCV', 'Stack: PyTorch/TensorFlow', 'Responsibilities: Object detection'],
            risks: ['Need to clarify production CV ownership and GPU optimization expectations'],
            questionsToAsk: ['Which CV models are already in production?', 'What latency targets exist for video streams?'],
            rawSourceText: sourceText,
          },
          stage: {
            stageType: 'recruiter_screen',
            title: 'Orbit Vision Lab interview',
            startsAt,
            endsAt,
            timezone: 'Europe/Moscow',
            meetingUrl: 'https://zoom.us/j/1234567890',
            status: 'scheduled',
          },
          warnings: [],
          missingFields: [],
        });
      },
    });

    const intake = await service.parseApplicationIntake({
      text: sourceText,
      useAi: true,
      task: 'agent_actions',
    });

    assert.equal(intake.classification, 'vacancy_with_scheduled_stage');
    assert.equal(intake.confidence, 0.93);
    assert.equal(intake.application.company, 'Orbit Vision Lab');
    assert.equal(intake.application.roleTitle, 'Senior / Middle+ Machine Learning Engineer');
    assert.equal(intake.application.description, 'Orbit Vision Lab builds production computer-vision services for image and video processing. The role is a hands-on ML engineering position focused on production CV pipelines, with an interview already scheduled.');
    assert.equal(intake.application.vacancyUrl, 'https://example.com/vacancy/orbit-vision-ml');
    assert.deepEqual(intake.application.requirements.slice(0, 3), ['Stack: Python 3.x', 'Domain: Computer Vision', 'Stack: OpenCV']);
    assert.equal(intake.stage.stageType, 'recruiter_screen');
    assert.equal(intake.stage.startsAt, startsAt);
    assert.equal(intake.stage.endsAt, endsAt);
    assert.equal(intake.stage.meetingUrl, 'https://zoom.us/j/1234567890');
    assert.equal(intake.calendarProposal.startsAt, startsAt);
    assert.equal(intake.calendarProposal.locationOrUrl, 'https://zoom.us/j/1234567890');
    assert.deepEqual(intake.missingFields, []);
  });

  test('lets AI agent correct recruiter chat fields without leaking stale parser warnings', async () => {
    const sourceText = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/synthetic-recruiter-stage-chat.txt'), 'utf8');
    const deterministic = parseInterviewSourceText(sourceText);
    assert.deepEqual(deterministic.warnings, ['company_not_detected', 'role_not_detected']);

    const startsAt = Date.parse('2026-06-18T14:00:00.000Z');
    const endsAt = Date.parse('2026-06-18T14:30:00.000Z');
    const { service } = createStack({
      resolveModelForTask: (task) => ({
        task,
        requestedMode: 'pinned',
        resolvedModelId: 'gpt-5.4',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      generateStructuredContent: async (prompt, options) => {
        assert.equal(options.task, 'agent_actions');
        assert.match(prompt, /Read recruiter chats as dialogue/);
        assert.match(prompt, /candidate's accepted slot and the final meeting confirmation override earlier offered slots/);
        assert.match(prompt, /company_not_detected, role_not_detected, or low_confidence_parse/);
        return JSON.stringify({
          classification: 'vacancy_with_scheduled_stage',
          confidence: 0.91,
          application: {
            title: 'Nimbus Systems · Applied Math Developer',
            company: 'Nimbus Systems',
            roleTitle: 'Applied Math Developer',
            description: 'Nimbus Systems is hiring an Applied Math Developer. The recruiter chat confirms the next step is a 30-minute technical screening with the engineering team.',
            source: 'Telegram',
            vacancyUrl: null,
            compensationText: null,
            requirements: ['Process: Technical screening with engineers', 'Logistics: Video interview with camera'],
            risks: [],
            questionsToAsk: ['Что будет на техническом скрининге?'],
            rawSourceText: sourceText,
          },
          stage: {
            stageType: 'technical_screen',
            title: 'Технический скрининг с командой',
            startsAt,
            endsAt,
            timezone: 'Europe/Moscow',
            meetingUrl: 'https://video.example.com/meet/nimbus-tech-screen',
            status: 'scheduled',
          },
          warnings: [],
          missingFields: [],
        });
      },
    });

    const intake = await service.parseApplicationIntake({
      text: sourceText,
      useAi: true,
      task: 'agent_actions',
    });

    assert.equal(intake.application.company, 'Nimbus Systems');
    assert.equal(intake.application.roleTitle, 'Applied Math Developer');
    assert.match(intake.application.description, /30-minute technical screening/);
    assert.deepEqual(intake.application.requirements, ['Process: Technical screening with engineers', 'Logistics: Video interview with camera']);
    assert.equal(intake.stage.stageType, 'technical_screen');
    assert.equal(intake.stage.meetingUrl, 'https://video.example.com/meet/nimbus-tech-screen');
    assert.equal(intake.stage.startsAt, startsAt);
    assert.equal(intake.stage.endsAt, endsAt);
    assert.deepEqual(intake.warnings, []);
    assert.deepEqual(intake.missingFields, []);
    assert.equal(intake.calendarProposal.locationOrUrl, 'https://video.example.com/meet/nimbus-tech-screen');
  });

  test('AI intake prompt preserves final recruiter messages from long pasted chats', async () => {
    const sourceText = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/synthetic-recruiter-stage-chat.txt'), 'utf8');
    const longPreamble = Array.from({ length: 600 }, (_, index) => (
      `Earlier unrelated message ${index}: обсуждали вакансию без финального подтверждения.`
    )).join('\n');
    const longSourceText = `${sourceText}\n\n${longPreamble}\n\n${sourceText}`;
    assert.ok(longSourceText.length > 30000);
    assert.ok(longSourceText.length < 50000);

    const startsAt = Date.parse('2026-06-18T14:00:00.000Z');
    const endsAt = Date.parse('2026-06-18T14:30:00.000Z');
    const { service } = createStack({
      resolveModelForTask: (task) => ({
        task,
        requestedMode: 'pinned',
        resolvedModelId: 'gpt-5.4',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      generateStructuredContent: async (prompt, options) => {
        assert.equal(options.task, 'agent_actions');
        assert.match(prompt, /middle of long source omitted/);
        assert.match(prompt, /Nimbus Systems/);
        assert.match(prompt, /https:\/\/video\.example\.com\/meet\/nimbus-tech-screen/);
        return JSON.stringify({
          classification: 'vacancy_with_scheduled_stage',
          confidence: 0.91,
          application: {
            title: 'Nimbus Systems · Applied Math Developer',
            company: 'Nimbus Systems',
            roleTitle: 'Applied Math Developer',
            description: 'Nimbus Systems is hiring an Applied Math Developer. The long chat ends with a confirmed technical screening.',
            source: 'Telegram',
            vacancyUrl: null,
            compensationText: null,
            requirements: ['Process: Technical screening with engineers'],
            risks: [],
            questionsToAsk: [],
            rawSourceText: longSourceText,
          },
          stage: {
            stageType: 'technical_screen',
            title: 'Технический скрининг с командой',
            startsAt,
            endsAt,
            timezone: 'Europe/Moscow',
            meetingUrl: 'https://video.example.com/meet/nimbus-tech-screen',
            status: 'scheduled',
          },
          warnings: [],
          missingFields: [],
        });
      },
    });

    const intake = await service.parseApplicationIntake({
      text: longSourceText,
      useAi: true,
      task: 'agent_actions',
    });

    assert.equal(intake.application.company, 'Nimbus Systems');
    assert.equal(intake.application.roleTitle, 'Applied Math Developer');
    assert.equal(intake.stage.meetingUrl, 'https://video.example.com/meet/nimbus-tech-screen');
    assert.equal(intake.stage.startsAt, startsAt);
    assert.deepEqual(intake.warnings, []);
  });

  test('extracts synthetic Telegram recruiter chat as vacancy plus scheduled stage without AI', async () => {
    const sourceText = fs.readFileSync(path.join(root, 'tests/fixtures/interviews/synthetic-telegram-recruiter-chat.txt'), 'utf8');
    const { service } = createStack();

    const intake = await service.parseApplicationIntake({
      text: sourceText,
      useAi: false,
      task: 'agent_actions',
    });

    assert.equal(intake.classification, 'vacancy_with_scheduled_stage');
    assert.equal(intake.application.company, 'Northstar Learning');
    assert.equal(intake.application.roleTitle, 'Data Scientist');
    assert.match(intake.application.description, /Northstar Learning/);
    assert.notEqual(intake.application.description, intake.application.rawSourceText);
    assert.equal(intake.stage?.stageType, 'recruiter_screen');
    assert.equal(intake.stage?.title, 'Recruiter screen');
    assert.equal(intake.stage?.meetingUrl, 'https://telemost.yandex.ru/j/10000000000002');
    assert.equal(intake.stage?.status, 'scheduled');

    const startsAt = new Date(intake.stage?.startsAt);
    assert.equal(startsAt.getFullYear(), 2026);
    assert.equal(startsAt.getMonth(), 5);
    assert.equal(startsAt.getDate(), 8);
    assert.equal(startsAt.getHours(), 13);
    assert.equal(startsAt.getMinutes(), 0);
    assert.equal(intake.stage?.endsAt, intake.stage?.startsAt + 15 * 60 * 1000);

    const result = service.createApplicationFromIntake('op-synthetic-intake', { intake });
    assert.equal(result.application.company, 'Northstar Learning');
    assert.equal(result.application.stages.length, 1);
    assert.notEqual(result.legacyInterview?.dossier?.description, intake.application.rawSourceText);
    assert.equal(result.application.stages[0].meetingUrl, 'https://telemost.yandex.ru/j/10000000000002');
    assert.equal(result.legacyInterview?.meetingUrl, 'https://telemost.yandex.ru/j/10000000000002');
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

  test('generates and stores AI retro evaluation from a linked recording transcript', async () => {
    const { db, repo } = createStack();
    createTranscriptTable(db);
    const service = new InterviewService(
      repo,
      task => ({
        task,
        requestedMode: 'default',
        resolvedModelId: 'gemini-3.1-flash-lite',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      async () => JSON.stringify({
        summary: 'The candidate gave strong backend tradeoff answers but was thin on Kubernetes depth.',
        signals: ['Clear transaction tradeoff answer'],
        risks: ['Kubernetes follow-up lacked detail'],
        followups: ['Send a short follow-up with infrastructure examples'],
        confidence: 0.82,
      }),
    );
    const detail = service.create('op-retro-eval-create', {
      title: 'Backend interview',
      company: 'Acme',
      roleTitle: 'Backend Developer',
    });
    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms, interview_event_id)
      VALUES ('meeting-retro-eval', 'Backend call', '2026-06-18T10:00:00.000Z', ?, 3600000, ?)
    `).run(Date.now(), detail.id);
    db.prepare(`
      INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms)
      VALUES ('meeting-retro-eval', 'Interviewer', 'Tell me about transaction isolation.', 1000)
    `).run();
    db.prepare(`
      INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms)
      VALUES ('meeting-retro-eval', 'Candidate', 'I would choose repeatable read and call out phantom read tradeoffs.', 2000)
    `).run();

    const evaluation = await service.generateRetroEvaluation(detail.id);
    assert.equal(evaluation.status, 'ready');
    assert.equal(evaluation.meetingId, 'meeting-retro-eval');
    assert.equal(evaluation.modelId, 'gemini-3.1-flash-lite');
    assert.deepEqual(evaluation.signals, ['Clear transaction tradeoff answer']);

    const saved = service.getRetroEvaluation(detail.id);
    assert.equal(saved.id, evaluation.id);
    assert.equal(saved.isActive, true);
  });

  test('retro evaluation requires a linked transcript before calling AI', async () => {
    const { db, service } = createStack({
      resolveModelForTask: task => ({
        task,
        requestedMode: 'default',
        resolvedModelId: 'gemini-3.1-flash-lite',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      generateStructuredContent: async () => {
        throw new Error('AI must not be called without a transcript');
      },
    });
    createTranscriptTable(db);
    const detail = service.create('op-retro-no-transcript', {
      title: 'No transcript interview',
      company: 'Acme',
      roleTitle: 'Backend Developer',
    });

    await assert.rejects(
      () => service.generateRetroEvaluation(detail.id),
      error => error instanceof InterviewDomainError
        && error.code === 'invalid_payload'
        && /No linked recording transcript/.test(error.message),
    );
  });

  test('retro evaluation records skipped and failed states and supersedes older meeting evaluations', async () => {
    const { db, repo } = createStack();
    createTranscriptTable(db);
    const detail = repo.create({
      title: 'Backend interview',
      company: 'Acme',
      roleTitle: 'Backend Developer',
    });
    db.prepare(`
      INSERT INTO meetings (id, title, created_at, start_time, duration_ms, interview_event_id)
      VALUES ('meeting-retro-states', 'Backend call', '2026-06-18T10:00:00.000Z', ?, 3600000, ?)
    `).run(Date.now(), detail.id);
    db.prepare(`
      INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms)
      VALUES ('meeting-retro-states', 'Candidate', 'I explained observability and rollback tradeoffs.', 1000)
    `).run();

    const unavailableService = new InterviewService(
      repo,
      task => ({
        task,
        requestedMode: 'default',
        resolvedModelId: null,
        availability: 'missing_credentials',
        fallbackUsed: true,
        warnings: ['No configured retro model.'],
      }),
      async () => {
        throw new Error('AI must not be called when no model is available');
      },
    );
    const skipped = await unavailableService.generateRetroEvaluation(detail.id);
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.isActive, true);
    assert.match(skipped.error, /No configured retro model/);

    const failingService = new InterviewService(
      repo,
      task => ({
        task,
        requestedMode: 'default',
        resolvedModelId: 'gemini-3.1-flash-lite',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      async () => {
        throw new Error('provider json malformed');
      },
    );
    const failed = await failingService.generateRetroEvaluation(detail.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.isActive, true);
    assert.match(failed.error, /provider json malformed/);
    assert.equal(
      db.prepare('SELECT is_active FROM interview_retro_evaluations WHERE id = ?').get(skipped.id).is_active,
      0,
    );

    const readyService = new InterviewService(
      repo,
      task => ({
        task,
        requestedMode: 'default',
        resolvedModelId: 'gemini-3.1-flash-lite',
        availability: 'available',
        fallbackUsed: false,
        warnings: [],
      }),
      async () => JSON.stringify({
        summary: 'The candidate gave grounded backend answers.',
        signals: ['Strong rollback tradeoff answer'],
        risks: [],
        followups: ['Send concise follow-up'],
        confidence: 0.86,
      }),
    );
    const ready = await readyService.generateRetroEvaluation(detail.id);
    assert.equal(ready.status, 'ready');
    assert.equal(ready.isActive, true);
    assert.equal(
      db.prepare('SELECT is_active FROM interview_retro_evaluations WHERE id = ?').get(failed.id).is_active,
      0,
    );
    assert.equal(readyService.getRetroEvaluation(detail.id).id, ready.id);
  });
});
