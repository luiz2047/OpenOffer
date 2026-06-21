import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

let helperModulePromise = null;

async function loadHelpers() {
  if (!helperModulePromise) {
    helperModulePromise = (async () => {
      const sourcePath = path.join(repoRoot, 'src/features/interviews/topSearchHelpers.ts');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2022,
          verbatimModuleSyntax: false,
        },
      }).outputText;
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-top-search-'));
      process.once('exit', () => fs.rmSync(tempDir, { recursive: true, force: true }));
      const compiledPath = path.join(tempDir, 'topSearchHelpers.mjs');
      fs.writeFileSync(compiledPath, compiled);
      return import(pathToFileURL(compiledPath).href);
    })();
  }
  return helperModulePromise;
}

function vacancy(id, overrides = {}) {
  return {
    id,
    kind: 'vacancy',
    title: 'Backend Developer',
    company: 'Acme',
    roleTitle: 'Backend Developer',
    source: 'manual',
    vacancyUrl: null,
    stageTitle: null,
    startsAt: null,
    updatedAt: '2026-06-22T00:00:00.000Z',
    status: 'interviewing',
    priority: 'normal',
    stageCount: 0,
    linkedMeetingCount: 0,
    questionCount: 0,
    stages: [],
    selectedInterviewId: null,
    selectedStageId: null,
    ...overrides,
  };
}

function preview(overrides = {}) {
  return {
    application: {
      title: 'Backend Developer',
      company: 'Acme',
      roleTitle: 'Backend Developer',
      source: 'manual',
      vacancyUrl: null,
      status: 'interviewing',
      priority: 'normal',
      ...overrides.application,
    },
    stage: overrides.stage ?? null,
    dossier: null,
    confidence: overrides.confidence ?? 0.8,
    warnings: [],
    existingApplicationMatch: overrides.existingApplicationMatch ?? null,
  };
}

describe('topSearchHelpers', () => {
  test('detectTopSearchPasteIntent separates vacancy sources from stage updates', async () => {
    const { detectTopSearchPasteIntent } = await loadHelpers();

    const vacancyIntent = detectTopSearchPasteIntent(
      'Company: Acme. Position: Backend Developer. Requirements: Node.js and PostgreSQL. Salary: 400k. https://jobs.example/acme-backend',
    );
    assert.equal(vacancyIntent.intent, 'vacancy');
    assert.ok(vacancyIntent.confidence >= 25);

    const stageIntent = detectTopSearchPasteIntent(
      'Recruiter scheduled an interview stage for tomorrow. Please confirm time and meeting details.',
    );
    assert.equal(stageIntent.intent, 'stage');
    assert.ok(stageIntent.confidence >= 25);
  });

  test('resolveTopSearchProposalTarget auto-selects only strong AI matches', async () => {
    const { resolveTopSearchProposalTarget } = await loadHelpers();

    const result = resolveTopSearchProposalTarget(
      preview({
        existingApplicationMatch: { applicationId: 'app_1', confidence: 0.92 },
        stage: { title: 'Technical screen' },
      }),
      [vacancy('app_1')],
    );

    assert.equal(result.requiresManualSelection, false);
    assert.equal(result.selectedApplicationId, 'app_1');
    assert.equal(result.reason, 'strong_ai_match');
  });

  test('resolveTopSearchProposalTarget keeps weak AI matches manual', async () => {
    const { resolveTopSearchProposalTarget } = await loadHelpers();

    const result = resolveTopSearchProposalTarget(
      preview({
        existingApplicationMatch: { applicationId: 'app_1', confidence: 0.42 },
        stage: { title: 'Technical screen' },
      }),
      [vacancy('app_1')],
    );

    assert.equal(result.requiresManualSelection, true);
    assert.equal(result.selectedApplicationId, null);
    assert.equal(result.reason, 'weak_match');
  });

  test('resolveTopSearchProposalTarget marks close local candidates ambiguous', async () => {
    const { resolveTopSearchProposalTarget } = await loadHelpers();

    const result = resolveTopSearchProposalTarget(
      preview({ stage: { title: 'Recruiter screen' } }),
      [vacancy('app_1'), vacancy('app_2')],
    );

    assert.equal(result.requiresManualSelection, true);
    assert.equal(result.selectedApplicationId, null);
    assert.equal(result.reason, 'ambiguous_match');
  });

  test('makeSafeExcerpt does not return the full raw source in result labels', async () => {
    const { makeSafeExcerpt } = await loadHelpers();
    const raw = `Acme ${'requirements '.repeat(60)}SECRET_TRAILING_CANARY`;

    const excerpt = makeSafeExcerpt(raw, 'not-present', { maxLength: 80 });

    assert.ok(excerpt.length <= 80);
    assert.notEqual(excerpt, raw.toLowerCase());
    assert.doesNotMatch(excerpt, /SECRET_TRAILING_CANARY/i);
  });
});
