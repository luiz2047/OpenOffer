PRAGMA foreign_keys = ON;
PRAGMA user_version = 19;

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  role_title TEXT,
  status TEXT NOT NULL DEFAULT 'lead_found',
  priority TEXT DEFAULT 'normal',
  source TEXT,
  source_url TEXT,
  vacancy_url TEXT,
  compensation_text TEXT,
  location_format TEXT,
  next_action TEXT,
  next_action_due_at INTEGER,
  raw_source_text TEXT,
  legacy_interview_event_id TEXT,
  archived_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE interview_stages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  stage_type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at INTEGER,
  ends_at INTEGER,
  timezone TEXT,
  format TEXT,
  meeting_url TEXT,
  calendar_provider TEXT,
  calendar_id TEXT,
  calendar_event_id TEXT,
  calendar_snapshot_json TEXT,
  calendar_last_seen_at INTEGER,
  calendar_missing_since INTEGER,
  calendar_sync_status TEXT DEFAULT 'local_only',
  raw_source_text TEXT,
  legacy_interview_event_id TEXT,
  archived_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time INTEGER,
  duration_ms INTEGER,
  created_at TEXT,
  interview_stage_id TEXT,
  application_id TEXT
);

INSERT INTO applications (id, title, status) VALUES ('app-v19', 'Example company', 'interviewing');
INSERT INTO interview_stages (id, application_id, stage_type, title, status)
VALUES ('stage-v19', 'app-v19', 'technical', 'Technical interview', 'scheduled');
INSERT INTO meetings (id, title, start_time, duration_ms, created_at, interview_stage_id, application_id)
VALUES ('meeting-v19', 'Technical interview', 1710000000000, 3600000, '2024-03-09T10:00:00Z', 'stage-v19', 'app-v19');
