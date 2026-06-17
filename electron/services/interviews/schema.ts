export interface InterviewSchemaDb {
  exec(sql: string): void;
}

export function applyInterviewSchema(db: InterviewSchemaDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS interview_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT,
      role_title TEXT,
      stage TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT DEFAULT 'normal',
      source TEXT,
      vacancy_url TEXT,
      meeting_url TEXT,
      calendar_provider TEXT,
      calendar_id TEXT,
      calendar_event_id TEXT,
      calendar_snapshot_json TEXT,
      calendar_last_seen_at INTEGER,
      calendar_missing_since INTEGER,
      calendar_sync_status TEXT DEFAULT 'local_only',
      starts_at INTEGER,
      ends_at INTEGER,
      timezone TEXT,
      raw_source_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS vacancy_dossiers (
      id TEXT PRIMARY KEY,
      interview_event_id TEXT NOT NULL UNIQUE,
      description TEXT,
      requirements_json TEXT,
      compensation_text TEXT,
      fit_hypothesis TEXT,
      risks_json TEXT,
      questions_to_ask_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prep_briefs (
      id TEXT PRIMARY KEY,
      interview_event_id TEXT NOT NULL UNIQUE,
      one_line_goal TEXT,
      pitch_30s TEXT,
      pitch_2m TEXT,
      expected_topics_json TEXT,
      cheatsheet TEXT,
      risk_handling_json TEXT,
      last_checklist_json TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_retros (
      id TEXT PRIMARY KEY,
      interview_event_id TEXT NOT NULL,
      pass_probability INTEGER,
      main_signal TEXT,
      strong_moments_json TEXT,
      weak_moments_json TEXT,
      new_facts_json TEXT,
      follow_up_actions_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_questions (
      id TEXT PRIMARY KEY,
      interview_event_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      category TEXT,
      quality INTEGER,
      weak_spot INTEGER DEFAULT 0,
      follow_up_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      company TEXT,
      email TEXT,
      telegram_handle TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interview_contacts (
      interview_event_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      relationship TEXT,
      PRIMARY KEY(interview_event_id, contact_id),
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE,
      FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS retro_prompt_state (
      interview_event_id TEXT PRIMARY KEY,
      prompted_at INTEGER,
      dismissed_at INTEGER,
      snoozed_until INTEGER,
      completed_at INTEGER,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_client_operations (
      operation_id TEXT NOT NULL,
      action TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(operation_id, action)
    );

    CREATE INDEX IF NOT EXISTS idx_interview_events_time ON interview_events(starts_at);
    CREATE INDEX IF NOT EXISTS idx_interview_events_status ON interview_events(status);
    CREATE INDEX IF NOT EXISTS idx_interview_events_calendar_ref ON interview_events(calendar_provider, calendar_id, calendar_event_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_events_calendar_ref
      ON interview_events(calendar_provider, calendar_id, calendar_event_id)
      WHERE calendar_provider IS NOT NULL AND calendar_id IS NOT NULL AND calendar_event_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_interview_questions_event ON interview_questions(interview_event_id);
    CREATE INDEX IF NOT EXISTS idx_interview_contacts_contact ON interview_contacts(contact_id);
    CREATE INDEX IF NOT EXISTS idx_interview_client_operations_created_at ON interview_client_operations(created_at);
  `);

  try {
    db.exec('ALTER TABLE meetings ADD COLUMN interview_event_id TEXT');
  } catch (error: any) {
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_meetings_interview_event_id ON meetings(interview_event_id);');
}
