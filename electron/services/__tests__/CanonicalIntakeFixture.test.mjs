import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const { parseInterviewSourceText } = require(path.join(root, 'dist-electron/electron/services/interviews/parser.js'));
const Database = require('better-sqlite3');
const { applyInterviewSchema } = require(path.join(root, 'dist-electron/electron/services/interviews/schema.js'));
const { InterviewRepository, createBetterSqliteExecutor } = require(path.join(root, 'dist-electron/electron/services/interviews/InterviewRepository.js'));
const fixturePath = path.join(root, 'tests/fixtures/interviews/canonical-recruiter-chat.txt');
const source = fs.readFileSync(fixturePath, 'utf8');

test('canonical recruiter fixture has a stable source and deterministic stage proposal', () => {
  assert.equal(
    crypto.createHash('sha256').update(source).digest('hex'),
    'e740f107ebd6bc0d141ecf1a0c30cce38f62d7f7ff15937c7be7341f772f8398',
  );
  const parsed = parseInterviewSourceText(source);
  assert.equal(parsed.fields.company, 'ExampleAI');
  assert.equal(parsed.fields.roleTitle, 'Senior/Lead ML Engineer');
  assert.equal(parsed.fields.stage, 'Intro call');
  assert.equal(parsed.dossier.compensationText, '7-9k EUR');
  assert.equal(parsed.warnings.length, 0);
  assert.ok(parsed.fields.startsAt, 'weekday/time should produce a scheduled stage');
});

test('canonical intake creates an exact reviewable application and stage without AI', () => {
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
  const repo = new InterviewRepository(createBetterSqliteExecutor(db));
  const started = performance.now();
  const parsed = parseInterviewSourceText(source);
  const created = repo.createApplicationFromIntake({
    classification: 'vacancy_and_stage',
    confidence: 1,
    application: {
      title: parsed.fields.roleTitle,
      company: parsed.fields.company,
      roleTitle: parsed.fields.roleTitle,
      source: 'recruiter_text',
      vacancyUrl: parsed.fields.vacancyUrl,
      rawSourceText: source,
      requirements: parsed.dossier.requirements,
      risks: parsed.dossier.risks,
      questionsToAsk: parsed.dossier.questionsToAsk,
    },
    stage: {
      title: parsed.fields.stage,
      stageType: 'recruiter_screen',
      status: 'scheduled',
      startsAt: parsed.fields.startsAt,
      rawSourceText: source,
    },
    warnings: parsed.warnings,
    missingFields: [],
  }, 'canonical-intake');
  const elapsed = performance.now() - started;
  assert.ok(created.application.id);
  assert.equal(created.application.company, 'ExampleAI');
  assert.equal(created.application.stages.length, 1);
  assert.equal(created.application.stages[0].title, 'Intro call');
  assert.equal(created.application.stages[0].applicationId, created.application.id);
  assert.ok(elapsed < 60_000, `deterministic intake took ${elapsed}ms`);
  db.close();
});
