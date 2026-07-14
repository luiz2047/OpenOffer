import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { applyInterviewSchema } = require(path.join(root, 'dist-electron/electron/services/interviews/schema.js'));
const { InterviewRepository, createBetterSqliteExecutor } = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewRepository.js'));
const { StageWorkspaceService } = require(path.join(root, 'dist-electron/electron/services/interviews/StageWorkspaceService.js'));

function createWorkspace() {
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
    CREATE TABLE transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT,
      speaker TEXT,
      content TEXT,
      timestamp_ms INTEGER
    );
  `);
  applyInterviewSchema(db);
  const executor = createBetterSqliteExecutor(db);
  const repo = new InterviewRepository(executor);
  return { db, repo, workspace: new StageWorkspaceService(repo, executor) };
}

function createTwoStages(repo) {
  const created = repo.createApplicationFromIntake({
    classification: 'vacancy_only',
    confidence: 1,
    application: {
      title: 'Acme Platform Engineer',
      company: 'Acme',
      roleTitle: 'Platform Engineer',
      source: 'manual',
      requirements: ['TypeScript'],
      risks: [],
      questionsToAsk: [],
      rawSourceText: 'Acme Platform Engineer vacancy',
    },
    warnings: [],
    missingFields: [],
  }, 'create-acme');
  const first = repo.createStage({
    applicationId: created.application.id,
    title: 'Recruiter screen',
    stageType: 'recruiter_screen',
    status: 'scheduled',
    rawSourceText: 'Recruiter screen context',
  }).stages.find(stage => stage.title === 'Recruiter screen');
  const second = repo.createStage({
    applicationId: created.application.id,
    title: 'Technical screen',
    stageType: 'technical_screen',
    status: 'scheduled',
    rawSourceText: 'Technical screen context',
  }).stages.find(stage => stage.title === 'Technical screen');
  assert.ok(first && second);
  return { first, second };
}

describe('StageWorkspaceService', () => {
  test('keeps preparation, sessions, transcript artifacts, and review strictly stage-owned', () => {
    const { db, repo, workspace } = createWorkspace();
    const { first, second } = createTwoStages(repo);

    let firstSnapshot = workspace.getStageWorkspace(first.id);
    let secondSnapshot = workspace.getStageWorkspace(second.id);
    assert.equal(firstSnapshot.context.confirmed, true);
    assert.equal(secondSnapshot.context.confirmed, true);
    assert.equal(firstSnapshot.sessions.length, 0);
    assert.equal(secondSnapshot.sessions.length, 0);

    firstSnapshot = workspace.createPreparationDraft(first.id, {
      oneLineGoal: 'Show ownership of production systems.',
      expectedTopics: ['incident response'],
      cheatsheet: 'Use one concrete outage story.',
      riskHandling: [],
      lastChecklist: [],
    }, firstSnapshot.revision, 'prep-first');
    const prepReplay = workspace.createPreparationDraft(first.id, {
      oneLineGoal: 'Show ownership of production systems.',
      expectedTopics: ['incident response'],
      cheatsheet: 'Use one concrete outage story.',
      riskHandling: [],
      lastChecklist: [],
    }, firstSnapshot.revision - 1, 'prep-first');
    assert.equal(prepReplay.preparation.oneLineGoal, firstSnapshot.preparation.oneLineGoal);
    assert.throws(
      () => workspace.createPreparationDraft(first.id, { oneLineGoal: 'Different request' }, firstSnapshot.revision, 'prep-first'),
      error => error?.code === 'operation_id_conflict',
    );
    secondSnapshot = workspace.createPreparationDraft(second.id, {
      oneLineGoal: 'Explain the platform boundary.',
      expectedTopics: ['queues'],
      cheatsheet: 'Name the trade-off.',
      riskHandling: [],
      lastChecklist: [],
    }, secondSnapshot.revision, 'prep-second');
    assert.equal(firstSnapshot.preparation.oneLineGoal, 'Show ownership of production systems.');
    assert.equal(secondSnapshot.preparation.oneLineGoal, 'Explain the platform boundary.');

    const startRevision = firstSnapshot.revision;
    firstSnapshot = workspace.startStageSession(first.id, 'start-first', startRevision, { confirmed: true, providerRoutes: { provider: 'openai', apiKey: 'secret-key', model: 'gpt' } });
    assert.equal(firstSnapshot.status.session, 'initializing');
    firstSnapshot = workspace.confirmStageSessionStarted(firstSnapshot.activeSession.meetingId, firstSnapshot.activeSession.revision);
    assert.equal(firstSnapshot.status.session, 'recording');
    assert.deepEqual(
      db.prepare('SELECT artifact_type, status FROM stage_artifact_jobs WHERE meeting_id = ? ORDER BY artifact_type').all(firstSnapshot.activeSession.meetingId),
      [
        { artifact_type: 'ai_review', status: 'blocked' },
        { artifact_type: 'summary', status: 'blocked' },
        { artifact_type: 'transcript', status: 'blocked' },
      ],
    );
    const startReplay = workspace.startStageSession(first.id, 'start-first', startRevision, { confirmed: true, providerRoutes: { provider: 'openai', apiKey: 'secret-key', model: 'gpt' } });
    assert.equal(startReplay.activeSession.meetingId, firstSnapshot.activeSession.meetingId);
    const firstMeetingId = firstSnapshot.activeSession.meetingId;
    const savedContext = JSON.parse(db.prepare('SELECT snapshot_json FROM stage_session_contexts WHERE meeting_id = ?').get(firstMeetingId).snapshot_json);
    assert.equal(savedContext.application.id, first.applicationId);
    assert.equal(savedContext.stage.id, first.id);
    assert.equal(savedContext.sources[0].sourceType, 'stage_context');
    assert.equal(savedContext.sources[0].content, 'Recruiter screen context');
    assert.ok(savedContext.sources[0].contentHash);
    assert.doesNotMatch(db.prepare('SELECT provider_routes_json FROM stage_session_contexts WHERE meeting_id = ?').get(firstMeetingId).provider_routes_json, /secret-key|apiKey/i);
    firstSnapshot = workspace.completeStageSession(firstMeetingId, 'stop-first', firstSnapshot.activeSession.revision);
    assert.equal(firstSnapshot.primarySessionId, firstMeetingId);
    assert.equal(firstSnapshot.status.session, 'stopped');
    assert.equal(db.prepare("SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'summary'").get(firstMeetingId).status, 'queued');
    assert.equal(db.prepare("SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'ai_review'").get(firstMeetingId).status, 'cancelled');

    db.prepare('INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms) VALUES (?, ?, ?, ?)')
      .run(firstMeetingId, 'interviewer', 'Tell me about the incident.', Date.now());
    db.prepare(`
      UPDATE stage_session_artifacts
      SET status = 'ready', updated_at = CURRENT_TIMESTAMP
      WHERE meeting_id = ? AND artifact_type = 'transcript'
    `).run(firstMeetingId);
    firstSnapshot = workspace.saveStageReview(first.id, firstMeetingId, { mainSignal: 'Clear ownership.' }, firstSnapshot.revision);
    assert.throws(
      () => db.prepare('DELETE FROM meetings WHERE id = ?').run(firstMeetingId),
      /primary stage session must be cleared or replaced/i,
      'primary session deletion must be explicit and review-safe',
    );

    secondSnapshot = workspace.getStageWorkspace(second.id);
    assert.equal(secondSnapshot.preparation.oneLineGoal, 'Explain the platform boundary.');
    assert.equal(secondSnapshot.sessions.length, 0, 'stage two must not inherit stage one sessions');
    assert.equal(secondSnapshot.primarySessionId, null, 'stage two must not inherit stage one primary session');
    assert.equal(secondSnapshot.primaryArtifacts, null, 'stage two must not inherit stage one transcript status');
    assert.equal(secondSnapshot.review, null, 'stage two must not inherit stage one review');
    const firstLegacyId = firstSnapshot.stage.legacyInterviewEventId;
    assert.ok(firstLegacyId);
    assert.equal(
      repo.getLatestLinkedMeetingTranscript(firstLegacyId, second.id),
      null,
      'strict transcript lookup for stage two must not return stage one transcript',
    );

    assert.throws(
      () => workspace.setStageNextAction(second.id, { text: 'Send follow-up' }, firstSnapshot.revision),
      error => error?.code === 'stage_conflict',
      'stale stage writes must be rejected instead of overwriting another stage revision',
    );
  });

  test('stop is idempotent across operation ids and ownership constraints reject drift', () => {
    const { db, repo, workspace } = createWorkspace();
    const { first } = createTwoStages(repo);
    let snapshot = workspace.getStageWorkspace(first.id);
    snapshot = workspace.startStageSession(first.id, 'start-idempotent', snapshot.revision, { confirmed: true });
    const session = snapshot.activeSession;
    const stopped = workspace.completeStageSession(session.meetingId, 'stop-one', session.revision);
    const replay = workspace.completeStageSession(session.meetingId, 'stop-two', session.revision + 1);
    assert.equal(replay.primarySessionId, stopped.primarySessionId);
    assert.equal(replay.sessions.length, 1);
    assert.throws(
      () => db.prepare('UPDATE meetings SET interview_stage_id = NULL WHERE id = ?').run(session.meetingId),
      /ownership is immutable/i,
    );
  });

  test('native capture failure leaves a terminal failed session and cancels post-call work', () => {
    const { db, repo, workspace } = createWorkspace();
    const { first } = createTwoStages(repo);
    let snapshot = workspace.getStageWorkspace(first.id);
    snapshot = workspace.startStageSession(first.id, 'start-failed', snapshot.revision, { confirmed: true });
    const failed = workspace.failStageSession(snapshot.activeSession.meetingId, 'fail-native', 'mic_permission_denied');
    assert.equal(failed.status.session, 'failed');
    assert.equal(failed.sessions[0].failureCode, 'mic_permission_denied');
    const artifacts = db.prepare('SELECT status FROM stage_session_artifacts WHERE meeting_id = ? ORDER BY artifact_type').all(snapshot.activeSession.meetingId);
    assert.deepEqual(artifacts.map(row => row.status), ['cancelled', 'cancelled', 'cancelled']);
    assert.equal(failed.capabilities.canStop, false);
  });

  test('artifact leases are fenced and late workers cannot commit', () => {
    const { db, repo, workspace } = createWorkspace();
    const { first } = createTwoStages(repo);
    let snapshot = workspace.getStageWorkspace(first.id);
    snapshot = workspace.startStageSession(first.id, 'start-lease', snapshot.revision, { confirmed: true });
    workspace.completeStageSession(snapshot.activeSession.meetingId, 'stop-lease', snapshot.activeSession.revision);
    const owner = 'worker-a';
    const claims = workspace.claimArtifactJobs(snapshot.activeSession.meetingId, owner);
    assert.equal(claims.length, 2);
    assert.equal(workspace.completeArtifactJob(snapshot.activeSession.meetingId, 'summary', 'worker-b', claims.find(item => item.artifactType === 'summary').fencingToken, 'succeeded'), false);
    assert.equal(workspace.completeArtifactJob(snapshot.activeSession.meetingId, 'summary', owner, claims.find(item => item.artifactType === 'summary').fencingToken, 'succeeded'), true);
    assert.equal(db.prepare("SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'summary'").get(snapshot.activeSession.meetingId).status, 'succeeded');
  });

test('exports a stage workspace without transcript/audio by default', () => {
    const { db, repo, workspace } = createWorkspace();
    const { first } = createTwoStages(repo);
    let snapshot = workspace.getStageWorkspace(first.id);
    snapshot = workspace.startStageSession(first.id, 'start-export', snapshot.revision, { confirmed: true });
    const meetingId = snapshot.activeSession.meetingId;
    workspace.completeStageSession(meetingId, 'stop-export', snapshot.activeSession.revision);
    db.prepare('INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms) VALUES (?, ?, ?, ?)')
      .run(meetingId, 'interviewer', 'Sensitive transcript text', 1000);

    const json = workspace.exportStageWorkspace(first.id, 'json');
    assert.equal(json.includesTranscript, false);
    assert.equal(json.filename.endsWith('.json'), true);
    assert.equal(json.content.includes('Sensitive transcript text'), false);
    assert.equal(json.content.includes('Recruiter screen context'), true);

    const markdown = workspace.exportStageWorkspace(first.id, 'markdown', true);
    assert.equal(markdown.includesTranscript, true);
    assert.equal(markdown.content.includes('Sensitive transcript text'), true);
    assert.equal(markdown.content.includes('## Next action'), true);
  });
});

test('failed and cancelled artifact jobs expose an explicit manual retry', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  let snapshot = workspace.startStageSession(first.id, 'retry-start', workspace.getStageWorkspace(first.id).revision, { confirmed: true });
  snapshot = workspace.confirmStageSessionStarted(snapshot.activeSession.meetingId, snapshot.activeSession.revision);
  snapshot = workspace.completeStageSession(snapshot.activeSession.meetingId, 'retry-stop', snapshot.activeSession.revision);
  const meetingId = snapshot.primarySessionId;
  const owner = 'retry-worker';
  const claim = workspace.claimArtifactJobs(meetingId, owner).find(item => item.artifactType === 'summary');
  assert.equal(workspace.completeArtifactJob(meetingId, 'summary', owner, claim.fencingToken, 'failed', 'provider_probe_failed'), true);
  snapshot = workspace.retryArtifactJob(meetingId, 'summary');
  assert.equal(snapshot.primaryArtifacts.summary, 'pending');
  assert.equal(db.prepare("SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'summary'").get(meetingId).status, 'queued');
});

test('AI review is an explicit queued draft and never silently saves user review', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  let snapshot = workspace.startStageSession(first.id, 'ai-start', workspace.getStageWorkspace(first.id).revision, { confirmed: true });
  snapshot = workspace.completeStageSession(snapshot.activeSession.meetingId, 'ai-stop', snapshot.activeSession.revision);
  const meetingId = snapshot.primarySessionId;
  snapshot = workspace.requestAiReviewJob(meetingId);
  assert.equal(snapshot.primaryArtifacts.aiReview, 'pending');
  assert.match(snapshot.sessions.find(session => session.meetingId === meetingId).artifactOperationIds.aiReview, /^ai-review:/);
  assert.equal(db.prepare("SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'ai_review'").get(meetingId).status, 'queued');
  snapshot = workspace.saveAiReviewDraft(meetingId, { mainSignal: 'Draft only', generatedBy: 'ai' });
  assert.equal(snapshot.review.status, 'draft');
  assert.equal(snapshot.review.review.mainSignal, 'Draft only');
  assert.equal(db.prepare("SELECT status FROM stage_reviews WHERE interview_stage_id = ?").get(first.id).status, 'draft');
});

test('readiness provider blocks standard recording when STT is not configured', () => {
  const { db, repo } = createWorkspace();
  const { first } = createTwoStages(repo);
  const blockedReadiness = () => ({
    score: 60,
    level: 'needs_work',
    blockers: ['stt_not_configured'],
    warnings: [],
    completed: ['stage_context', 'microphone_permission', 'system_audio_permission'],
    nextAction: 'Choose and configure a speech-to-text provider in Settings.',
  });
  const workspace = new StageWorkspaceService(
    repo,
    createBetterSqliteExecutor(db),
    blockedReadiness,
  );
  const snapshot = workspace.getStageWorkspace(first.id);
  assert.equal(snapshot.readiness.level, 'needs_work');
  assert.equal(snapshot.status.coreReadiness, 'blocked');
  assert.equal(snapshot.capabilities.canStart, false);
  assert.throws(
    () => workspace.startStageSession(first.id, 'blocked-start', snapshot.revision, { confirmed: true }),
    error => error?.code === 'stt_not_configured',
  );
});

test('recording requires explicit stage-context confirmation', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  const snapshot = workspace.getStageWorkspace(first.id);
  assert.throws(
    () => workspace.startStageSession(first.id, 'unconfirmed-start', snapshot.revision),
    error => error?.code === 'invalid_payload' && /confirm/i.test(error.message),
  );
});

test('stage metadata edits use workspace revisions and durable operation replay', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  const initial = workspace.getStageWorkspace(first.id);
  const patch = { title: 'Recruiter screen v2', rawSourceText: 'Updated context' };
  const updated = workspace.updateStageDetails(first.id, patch, initial.revision, 'stage-edit-1');
  assert.equal(updated.stage.title, 'Recruiter screen v2');
  assert.equal(updated.context.sourceText, 'Updated context');
  const replay = workspace.updateStageDetails(first.id, patch, initial.revision, 'stage-edit-1');
  assert.equal(replay.revision, updated.revision);
  assert.throws(
    () => workspace.updateStageDetails(first.id, { title: 'stale' }, initial.revision, 'stage-edit-2'),
    error => error?.code === 'stage_conflict',
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stage_workspace_operations WHERE operation_id = ?').get('stage-edit-1').count, 1);
});

test('recording attachments use stage ownership, revision checks, and operation replay', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first, second } = createTwoStages(repo);
  db.prepare('INSERT INTO meetings (id, title, created_at) VALUES (?, ?, ?)').run('manual-recording-1', 'Manual recording', new Date().toISOString());
  const initial = workspace.getStageWorkspace(first.id);
  const attached = workspace.attachMeeting(first.id, 'manual-recording-1', initial.revision, 'attach-1');
  assert.equal(db.prepare('SELECT interview_stage_id FROM meetings WHERE id = ?').get('manual-recording-1').interview_stage_id, first.id);
  assert.equal(attached.revision, initial.revision + 1);
  const replay = workspace.attachMeeting(first.id, 'manual-recording-1', initial.revision, 'attach-1');
  assert.equal(replay.revision, attached.revision);
  assert.throws(
    () => workspace.attachMeeting(second.id, 'manual-recording-1', workspace.getStageWorkspace(second.id).revision, 'attach-2'),
    error => error?.code === 'stage_conflict',
  );
});

test('stage session deletion requires explicit confirmation and clears cascaded data', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  let snapshot = workspace.startStageSession(first.id, 'delete-start', workspace.getStageWorkspace(first.id).revision, { confirmed: true });
  const meetingId = snapshot.activeSession.meetingId;
  assert.throws(
    () => workspace.deleteStageSession(meetingId, 'wrong-token', snapshot.revision),
    error => error?.code === 'invalid_payload',
  );
  snapshot = workspace.confirmStageSessionStarted(meetingId, snapshot.activeSession.revision);
  snapshot = workspace.completeStageSession(meetingId, 'delete-stop', snapshot.activeSession.revision);
  assert.throws(
    () => workspace.deleteStageSession(meetingId, 'delete-stage-session', snapshot.revision),
    error => error?.code === 'primary_session_review_conflict',
  );
  snapshot = workspace.selectPrimarySession(first.id, null, snapshot.revision);
  snapshot = workspace.deleteStageSession(meetingId, 'delete-stage-session', snapshot.revision);
  assert.equal(snapshot.sessions.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM meetings WHERE id = ?').get(meetingId).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stage_session_contexts WHERE meeting_id = ?').get(meetingId).count, 0);
});

test('primary session changes require clearing a saved review and next-action terminal states are explicit', () => {
  const { db, repo, workspace } = createWorkspace();
  const { first } = createTwoStages(repo);
  let snapshot = workspace.getStageWorkspace(first.id);
  snapshot = workspace.startStageSession(first.id, 'primary-start-1', snapshot.revision, { confirmed: true });
  const firstMeeting = snapshot.activeSession.meetingId;
  snapshot = workspace.completeStageSession(firstMeeting, 'primary-stop-1', snapshot.activeSession.revision);
  snapshot = workspace.startStageSession(first.id, 'primary-start-2', snapshot.revision, { confirmed: true });
  const secondMeeting = snapshot.activeSession.meetingId;
  snapshot = workspace.completeStageSession(secondMeeting, 'primary-stop-2', snapshot.activeSession.revision);
  assert.equal(snapshot.primarySessionId, firstMeeting, 'first stopped session remains primary');
  assert.doesNotThrow(() => workspace.selectPrimarySession(first.id, secondMeeting, snapshot.revision));
  snapshot = workspace.getStageWorkspace(first.id);
  db.prepare("INSERT INTO stage_reviews (interview_stage_id, meeting_id, status, review_json, created_at, updated_at) VALUES (?, ?, 'saved', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run(first.id, secondMeeting);
  assert.throws(
    () => workspace.selectPrimarySession(first.id, firstMeeting, snapshot.revision),
    error => error?.code === 'primary_session_review_conflict',
  );
  snapshot = workspace.clearStageReview(first.id, 'clear-stage-review', snapshot.revision);
  snapshot = workspace.selectPrimarySession(first.id, firstMeeting, snapshot.revision);
  snapshot = workspace.setStageNextAction(first.id, { text: 'Send follow-up' }, snapshot.revision);
  snapshot = workspace.completeStageNextAction(first.id, snapshot.revision);
  assert.equal(snapshot.nextAction.state, 'completed');
  snapshot = workspace.markNoStageNextActionRequired(first.id, snapshot.revision);
  assert.equal(snapshot.nextAction.state, 'none_required');
});
