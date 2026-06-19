import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSafeHandle } from './ipcTestUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const channels = [
  ['interviewsList', 'interviews:list'],
  ['interviewsGet', 'interviews:get'],
  ['interviewsCreate', 'interviews:create'],
  ['interviewsParseSourceText', 'interviews:parse-source-text'],
  ['applicationIntakeParse', 'application-intake:parse'],
  ['applicationsList', 'applications:list'],
  ['applicationsGet', 'applications:get'],
  ['applicationsCreateFromIntake', 'applications:create-from-intake'],
  ['interviewsUpdate', 'interviews:update'],
  ['interviewsArchive', 'interviews:archive'],
  ['interviewsDelete', 'interviews:delete'],
  ['interviewsAttachMeeting', 'interviews:attach-meeting'],
  ['interviewsCreateCalendarEvent', 'interviews:create-calendar-event'],
  ['interviewsGetReadiness', 'interviews:get-readiness'],
  ['interviewsGetRetroPrompt', 'interviews:get-retro-prompt'],
  ['interviewsGetRetroEvaluation', 'interviews:get-retro-evaluation'],
  ['interviewsGenerateRetroEvaluation', 'interviews:generate-retro-evaluation'],
  ['interviewsUpdateRetroPrompt', 'interviews:update-retro-prompt'],
  ['vacancyDossierSave', 'vacancy-dossiers:save'],
  ['prepBriefSave', 'prep-briefs:save'],
  ['interviewRetroSave', 'interview-retros:save'],
  ['interviewQuestionsList', 'interview-questions:list'],
  ['interviewQuestionsSave', 'interview-questions:save'],
];

const taskModelChannels = [
  ['getTaskModelPolicy', 'get-task-model-policy'],
  ['setTaskModelPolicy', 'set-task-model-policy'],
  ['resolveModelForTask', 'resolve-model-for-task'],
];

test('Interview Command Center IPC handlers are registered through safeHandle', () => {
  const source = read('electron/ipcHandlers.ts');

  assert.match(source, /InterviewService/);
  assert.match(source, /safeInterviewHandle/);
  assert.match(source, /local_database_unavailable/);

  for (const [, channel] of channels) {
    assert.ok(findSafeHandle(source, channel) >= 0, `${channel} handler must be registered`);
  }
  for (const [, channel] of taskModelChannels) {
    assert.ok(findSafeHandle(source, channel) >= 0, `${channel} handler must be registered`);
  }
});

test('preload exposes narrow wrappers for every interview IPC channel', () => {
  const preload = read('electron/preload.ts');

  for (const [method, channel] of channels) {
    assert.match(preload, new RegExp(`${method}:\\s*\\(`), `${method} must be exposed`);
    assert.match(
      preload,
      new RegExp(`ipcRenderer\\.invoke\\(['"]${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${method} must call ${channel}`,
    );
  }
  for (const [method, channel] of taskModelChannels) {
    assert.match(preload, new RegExp(`${method}:\\s*\\(`), `${method} must be exposed`);
    assert.match(
      preload,
      new RegExp(`ipcRenderer\\.invoke\\(['"]${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${method} must call ${channel}`,
    );
  }
});

test('renderer electron.d.ts declares typed interview methods and shared result envelope', () => {
  const types = read('src/types/electron.d.ts');

  assert.match(types, /import type \{[\s\S]*InterviewIpcResult[\s\S]*\} from ['"]\.\/interviews['"]/);
  assert.match(types, /interviewsList:\s*\(input\?: InterviewListInput\) => Promise<InterviewIpcResult<InterviewListItem\[\]>>/);
  assert.match(types, /interviewsGet:\s*\(input: \{ id: string; include\?: Array<['"]dossier['"]/);
  assert.match(types, /interviewsCreate:\s*\(operationId: string, payload: InterviewCreatePayload\) => Promise<InterviewIpcResult<InterviewDetail>>/);
  assert.match(types, /interviewsParseSourceText:\s*\(input: InterviewSourceParseInput \| string\) => Promise<InterviewIpcResult<InterviewSourceParseResult>>/);
  assert.match(types, /applicationIntakeParse:\s*\(input: ApplicationIntakeInput \| string\) => Promise<InterviewIpcResult<ApplicationIntakeResult>>/);
  assert.match(types, /applicationsList:\s*\(\) => Promise<InterviewIpcResult<ApplicationDetail\[\]>>/);
  assert.match(types, /applicationsCreateFromIntake:\s*\(operationId: string, payload: ApplicationCreateFromIntakePayload\) => Promise<InterviewIpcResult<ApplicationCreateFromIntakeResult>>/);
  assert.match(types, /interviewsCreateCalendarEvent:\s*\(interviewId: string, provider: ['"]google['"] \| ['"]macos['"]\) => Promise<InterviewIpcResult<InterviewDetail>>/);
  assert.match(types, /vacancyDossierSave:\s*\(interviewId: string, operationId: string, payload: VacancyDossierPayload\) => Promise<InterviewIpcResult<VacancyDossier>>/);
  assert.match(types, /interviewsUpdateRetroPrompt:\s*\(interviewId: string, payload: RetroPromptActionPayload\) => Promise<InterviewIpcResult<RetroPromptDecision>>/);
  assert.match(types, /interviewsGenerateRetroEvaluation:\s*\(interviewId: string\) => Promise<InterviewIpcResult<InterviewRetroEvaluation>>/);
  assert.match(types, /prepBriefSave:\s*\(interviewId: string, operationId: string, payload: PrepBriefPayload\) => Promise<InterviewIpcResult<PrepBrief>>/);
  assert.match(types, /interviewQuestionsSave:\s*\(interviewId: string, operationId: string, questions: InterviewQuestionPayload\[\]\) => Promise<InterviewIpcResult<InterviewQuestion\[\]>>/);
  assert.match(types, /getTaskModelPolicy:\s*\(\) => Promise<TaskModelPolicy>/);
  assert.match(types, /setTaskModelPolicy:\s*\(policy: TaskModelPolicy\) => Promise<\{ success: boolean; policy\?: TaskModelPolicy; error\?: string \}>/);
  assert.match(types, /resolveModelForTask:\s*\(task: AiTask, options\?: \{ overrideModelId\?: string \| null \}\) => Promise<TaskModelResolution>/);
});
