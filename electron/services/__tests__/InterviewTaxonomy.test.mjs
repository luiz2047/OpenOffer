import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

const {
  INTERVIEW_TAXONOMY,
  findTaxonomyEntry,
} = require(path.join(root, 'dist-electron/electron/services/interviews/taxonomy.js'));

test('Obsidian interview workflow headings are mapped into the P1 interview model', () => {
  const requiredMapped = [
    ['pre-interview goal', 'prep_briefs.one_line_goal'],
    ['pitches', 'prep_briefs.pitch_30s'],
    ['role fit', 'vacancy_dossiers.fit_hypothesis'],
    ['questions to ask', 'vacancy_dossiers.questions_to_ask_json'],
    ['risk handling', 'prep_briefs.risk_handling_json'],
    ['last checklist', 'prep_briefs.last_checklist_json'],
    ['post-interview summary', 'interview_retros.main_signal'],
    ['questions asked', 'interview_questions.question_text'],
    ['weak moments', 'interview_retros.weak_moments_json'],
    ['vacancy intake', 'interview_events.raw_source_text'],
    ['requirements', 'vacancy_dossiers.requirements_json'],
    ['readiness/checklist', 'readiness rules'],
  ];

  for (const [heading, expectedTarget] of requiredMapped) {
    const entry = findTaxonomyEntry(heading.toUpperCase());
    assert.ok(entry, `${heading} must be present in taxonomy`);
    assert.equal(entry.status, 'mapped', `${heading} must be implemented in P1`);
    assert.match(entry.target, new RegExp(expectedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('resume and ATS workflow stays explicit P2 scope instead of disappearing', () => {
  const deferred = INTERVIEW_TAXONOMY.filter(entry => entry.status === 'deferred');

  assert.deepEqual(
    deferred.map(entry => entry.sourceHeading).sort(),
    ['ATS check', 'resume edits'],
  );
  assert.ok(deferred.every(entry => /P2 resume/.test(entry.target)));
  assert.ok(deferred.every(entry => entry.rationale.length > 20));
});
