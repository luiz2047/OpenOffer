import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('interview editor drafts are recoverable and cleared after successful saves', () => {
  const source = read('src/features/interviews/InterviewCommandCenter.tsx');

  assert.match(source, /const DRAFT_PREFIX = ['"]openoffer:interviews:draft['"]/);
  assert.match(source, /window\.localStorage\.setItem\(draftKey\(interviewId, kind\), JSON\.stringify\(draft\)\)/);
  assert.match(source, /window\.localStorage\.removeItem\(draftKey\(interviewId, kind\)\)/);
  assert.match(source, /readLocalDraft<ReturnType<typeof initialDossierDraft>>/);
  assert.match(source, /clearDraftStatus\(['"]dossier['"], detail\.id\)/);
  assert.match(source, /clearDraftStatus\(['"]prep['"], detail\.id\)/);
  assert.match(source, /clearDraftStatus\(['"]retro['"], detail\.id\)/);
});

test('pasted vacancy context is rendered as text and parser stays local-only', () => {
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const parser = read('electron/services/interviews/parser.ts');

  assert.equal(commandCenter.includes('dangerouslySetInnerHTML'), false);
  assert.match(commandCenter, /whitespace-pre-wrap/);
  assert.equal(parser.includes('fetch('), false);
  assert.equal(parser.includes('axios'), false);
  assert.equal(parser.includes('child_process'), false);
  assert.equal(parser.includes('eval('), false);
  assert.equal(parser.includes('new Function'), false);
  assert.equal(parser.includes('console.'), false);
});
