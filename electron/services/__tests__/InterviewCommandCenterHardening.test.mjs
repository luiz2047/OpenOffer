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

test('vacancy and stage recording actions pass durable application-stage metadata', () => {
  const source = read('src/features/interviews/InterviewCommandCenter.tsx');

  assert.match(source, /const startSelectedInterview = \(\) => \{/);
  assert.match(source, /await stageApi\.create\(\{[\s\S]{0,300}applicationId: applicationDetail\.id/);
  assert.match(source, /defaultRecordingStageTitle/);
  assert.match(source, /interviewStageId: targetStage\?\.id/);
  assert.match(source, /applicationId: targetApplication\.id/);
  assert.match(source, /const startStageRecording = \(stage: InterviewStage\) => \{/);
  assert.match(source, /interviewStageId: stage\.id/);
  assert.match(source, /applicationId: applicationDetail\.id/);
  assert.match(source, /interviewEventId: stage\.legacyInterviewEventId \?\? applicationDetail\.legacyInterviewEventId/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]{0,120}if \(!applicationDetail\?\.id\) return;/);
});

test('interview panes expose desktop resize handles with persisted layout reset', () => {
  const source = read('src/features/interviews/InterviewCommandCenter.tsx');

  assert.match(source, /const PANE_LAYOUT_STORAGE_KEY = ['"]openoffer:interviews:pane-layout:v1['"]/);
  assert.match(source, /const PANE_LAYOUT_LIMITS = \{[\s\S]*calendarMin: 220,[\s\S]*vacancyMin: 280,[\s\S]*detailMin: 420/);
  assert.match(source, /window\.localStorage\.setItem\(PANE_LAYOUT_STORAGE_KEY, JSON\.stringify\(layout\)\)/);
  assert.match(source, /grid-cols-\[minmax\(220px,var\(--interview-calendar-width\)\)_6px_minmax\(280px,var\(--interview-vacancy-width\)\)_6px_minmax\(var\(--interview-detail-min-width\),1fr\)\]/);
  assert.match(source, /data-testid=["']interview-pane-resize-handle["']/);
  assert.match(source, /onDoubleClick=\{resetPaneLayout\}/);
  assert.match(source, /tabIndex=\{0\}/);
});

test('settings calendar polish removes ambient blobs and keeps fixed widths constrained', () => {
  const source = read('src/components/SettingsOverlay.tsx');

  assert.match(source, /max-w-5xl h-\[calc\(100dvh-16px\)\] max-h-\[80vh\] min-h-0/);
  assert.match(source, /className="flex w-full h-full min-w-0"/);
  assert.match(source, /className="w-56 shrink-0 bg-bg-sidebar/);
  assert.equal(source.includes('blur-[90px]'), false);
  assert.equal(source.includes('blur-[80px]'), false);
  assert.equal(source.includes('rounded-full pl-3 pr-1.5 py-1.5'), false);
});
