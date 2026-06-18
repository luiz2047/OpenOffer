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
  assert.match(tracker, /this\.currentMeetingMetadata = null/);
  assert.match(persistence, /interviewEventId:\s*metadataSnapshot\?\.interviewEventId/);
  assert.match(persistence, /metadata\?: \{ title\?: string; calendarEventId\?: string; interviewEventId\?: string/);
  assert.match(persistence, /if \(metadata\.interviewEventId\) interviewEventId = metadata\.interviewEventId/);
  assert.match(persistence, /interviewEventId:\s*interviewEventId/);
});

test('DatabaseManager preserves explicit links and only auto-links unique calendar matches', () => {
  const source = read('electron/db/DatabaseManager.ts');

  assert.match(source, /interviewEventId\?: string/);
  assert.match(source, /SELECT calendar_event_id, interview_event_id FROM meetings WHERE id = \?/);
  assert.match(source, /meeting\.interviewEventId \?\? existingMeeting\?\.interview_event_id/);
  assert.match(source, /FROM interview_events[\s\S]*WHERE calendar_event_id = \? AND archived_at IS NULL[\s\S]*LIMIT 2/);
  assert.match(source, /if \(matches\.length === 1\)/);
  assert.match(source, /INSERT OR REPLACE INTO meetings \(id, title, start_time, duration_ms, summary_json, created_at, calendar_event_id, source, is_processed, interview_event_id\)/);
});
