import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { applyInterviewSchema } = require(path.join(root, 'dist-electron/electron/services/interviews/schema.js'));
const { InterviewRepository, createBetterSqliteExecutor } = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewRepository.js'));
const { StageWorkspaceService } = require(path.join(root, 'dist-electron/electron/services/interviews/StageWorkspaceService.js'));

function setup() {
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
  return { db, repo: new InterviewRepository(executor), service: new StageWorkspaceService(new InterviewRepository(executor), executor) };
}

function createApplication(repo, suffix) {
  const result = repo.createApplicationFromIntake({
    classification: 'vacancy_only',
    confidence: 1,
    application: {
      title: `Dogfood ${suffix}`,
      company: 'ExampleAI',
      roleTitle: 'Platform Engineer',
      source: 'synthetic',
      requirements: ['TypeScript', 'SQLite'],
      risks: [],
      questionsToAsk: [],
      rawSourceText: `Canonical recruiter text for ${suffix}`,
    },
    warnings: [],
    missingFields: [],
  }, `dogfood-app-${suffix}`);
  return result.application;
}

function addStage(repo, applicationId, title, type, context) {
  const detail = repo.createStage({ applicationId, title, stageType: type, status: 'scheduled', rawSourceText: context });
  return detail.stages.find(stage => stage.title === title);
}

describe('Stage Workspace canonical dogfood', () => {
  test('completes five isolated multi-stage application runs without leakage', () => {
    for (let run = 1; run <= 5; run += 1) {
      const { db, repo, service } = setup();
      const appOne = createApplication(repo, `${run}-one`);
      const appTwo = createApplication(repo, `${run}-two`);
      const oneStageA = addStage(repo, appOne.id, 'Recruiter screen', 'recruiter_screen', `Recruiter context ${run}-A`);
      const oneStageB = addStage(repo, appOne.id, 'Technical screen', 'technical_screen', `Technical context ${run}-B`);
      const twoStage = addStage(repo, appTwo.id, 'Recruiter screen', 'recruiter_screen', `Other application context ${run}`);
      assert.ok(oneStageA && oneStageB && twoStage);

      let workspace = service.getStageWorkspace(oneStageA.id);
      workspace = service.createPreparationDraft(oneStageA.id, {
        oneLineGoal: 'Explain one production trade-off.',
        expectedTopics: ['ownership'],
        cheatsheet: 'Use one concrete example.',
        riskHandling: [],
        lastChecklist: [],
      }, workspace.revision, `dogfood-${run}-prep`);
      workspace = service.startStageSession(oneStageA.id, `dogfood-${run}-start`, workspace.revision, { confirmed: true });
      const session = workspace.activeSession;
      assert.ok(session);
      workspace = service.completeStageSession(session.meetingId, `dogfood-${run}-stop`, session.revision);
      db.prepare('INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms) VALUES (?, ?, ?, ?)')
        .run(session.meetingId, 'interviewer', `Transcript ${run}-A`, 1000);
      db.prepare(`UPDATE stage_session_artifacts SET status = 'ready' WHERE meeting_id = ? AND artifact_type = 'transcript'`)
        .run(session.meetingId);
      workspace = service.saveStageReview(oneStageA.id, session.meetingId, { mainSignal: `Signal ${run}-A` }, workspace.revision);
      workspace = service.setStageNextAction(oneStageA.id, { text: `Send follow-up ${run}`, state: 'saved' }, workspace.revision);

      const exported = service.exportStageWorkspace(oneStageA.id, 'json');
      assert.equal(exported.includesTranscript, false);
      assert.equal(exported.content.includes(`Transcript ${run}-A`), false);
      assert.equal(service.getStageWorkspace(oneStageB.id).sessions.length, 0);
      assert.equal(service.getStageWorkspace(twoStage.id).sessions.length, 0);
      assert.equal(workspace.nextAction.text, `Send follow-up ${run}`);
      workspace = service.setStageNextAction(oneStageA.id, { text: `Send follow-up ${run}`, state: 'completed' }, workspace.revision);
      assert.equal(workspace.status.complete, true);
    }
  });
});
