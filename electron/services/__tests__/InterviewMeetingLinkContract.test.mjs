import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('renderer starts meetings with selected interview metadata without dropping audio metadata', () => {
  const commandCenter = read('src/features/interviews/InterviewCommandCenter.tsx');
  const app = read('src/App.tsx');

  assert.match(commandCenter, /interviewEventId:\s*detail\.id/);
  assert.match(commandCenter, /calendarEventId:\s*detail\.calendarEventId\s*\?\?/);
  assert.match(commandCenter, /source:\s*['"]manual['"]/);
  assert.match(app, /const handleStartMeeting = async \(metadata: StartMeetingMetadata = \{\}\)/);
  assert.match(app, /\.\.\.metadata,[\s\S]*audio: \{ inputDeviceId, outputDeviceId \}/);
  assert.match(app, /doNotPersist: meetingRetention === ['"]never['"]/);
});

test('meeting persistence snapshots and writes interviewEventId on placeholder and processed rows', () => {
  const persistence = read('electron/MeetingPersistence.ts');
  const tracker = read('electron/SessionTracker.ts');

  assert.match(tracker, /interviewEventId\?: string/);
  assert.match(tracker, /interviewStageId\?: string/);
  assert.match(tracker, /applicationId\?: string/);
  assert.match(tracker, /this\.currentMeetingMetadata = null/);
  assert.match(persistence, /interviewEventId:\s*metadataSnapshot\?\.interviewEventId/);
  assert.match(persistence, /interviewStageId:\s*metadataSnapshot\?\.interviewStageId/);
  assert.match(persistence, /applicationId:\s*metadataSnapshot\?\.applicationId/);
  assert.match(persistence, /interviewStageId\?: string/);
  assert.match(persistence, /applicationId\?: string/);
  assert.match(persistence, /if \(metadata\.interviewEventId\) interviewEventId = metadata\.interviewEventId/);
  assert.match(persistence, /if \(metadata\.interviewStageId\) interviewStageId = metadata\.interviewStageId/);
  assert.match(persistence, /if \(metadata\.applicationId\) applicationId = metadata\.applicationId/);
  assert.match(persistence, /interviewEventId:\s*interviewEventId/);
  assert.match(persistence, /interviewStageId:\s*interviewStageId/);
  assert.match(persistence, /applicationId:\s*applicationId/);
});

test('DatabaseManager preserves explicit links and resolves vacancy-first calendar links', () => {
  const source = read('electron/db/DatabaseManager.ts');

  assert.match(source, /interviewEventId\?: string/);
  assert.match(source, /interviewStageId\?: string/);
  assert.match(source, /applicationId\?: string/);
  assert.match(source, /SELECT calendar_event_id, interview_event_id, interview_stage_id, application_id FROM meetings WHERE id = \?/);
  assert.match(source, /meeting\.interviewEventId \?\? existingMeeting\?\.interview_event_id/);
  assert.match(source, /meeting\.interviewStageId \?\? existingMeeting\?\.interview_stage_id/);
  assert.match(source, /meeting\.applicationId \?\? existingMeeting\?\.application_id/);
  assert.match(source, /FROM legacy_interview_event_map/);
  assert.match(source, /FROM interview_stages[\s\S]*WHERE calendar_event_id = \? AND archived_at IS NULL[\s\S]*LIMIT 2/);
  assert.match(source, /if \(stageMatches\.length === 1\)/);
  assert.match(source, /FROM interview_events e[\s\S]*WHERE e\.calendar_event_id = \? AND e\.archived_at IS NULL[\s\S]*LIMIT 2/);
  assert.match(source, /interview_stage_id, application_id/);
});
