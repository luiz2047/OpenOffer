export interface InterviewSchemaDb {
  exec(sql: string): void;
}

function addColumnIfMissing(db: InterviewSchemaDb, table: string, columnSql: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`);
  } catch (error: any) {
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }
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

    CREATE TABLE IF NOT EXISTS agent_proposal_applied_groups (
      group_id TEXT PRIMARY KEY,
      source_text_hash TEXT NOT NULL,
      proposal_ids_json TEXT NOT NULL,
      result_application_id TEXT,
      result_stage_ids_json TEXT NOT NULL,
      result_event_ids_json TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
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
      legacy_interview_event_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS interview_stages (
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
      legacy_interview_event_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS legacy_interview_event_map (
      legacy_interview_event_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      stage_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY(stage_id) REFERENCES interview_stages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS interview_retro_evaluations (
      id TEXT PRIMARY KEY,
      application_id TEXT,
      interview_stage_id TEXT,
      interview_event_id TEXT,
      meeting_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending_transcript', 'generating', 'ready', 'failed', 'skipped')),
      model_id TEXT,
      summary TEXT,
      signals_json TEXT,
      risks_json TEXT,
      followups_json TEXT,
      confidence REAL,
      error TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      superseded_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE SET NULL,
      FOREIGN KEY(interview_stage_id) REFERENCES interview_stages(id) ON DELETE SET NULL,
      FOREIGN KEY(interview_event_id) REFERENCES interview_events(id) ON DELETE SET NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
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
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_updated_at ON applications(updated_at);
    CREATE INDEX IF NOT EXISTS idx_applications_vacancy_url ON applications(vacancy_url);
    CREATE INDEX IF NOT EXISTS idx_interview_stages_application_id ON interview_stages(application_id);
    CREATE INDEX IF NOT EXISTS idx_interview_stages_time ON interview_stages(starts_at);
    CREATE INDEX IF NOT EXISTS idx_interview_stages_status ON interview_stages(status);
    CREATE INDEX IF NOT EXISTS idx_interview_stages_calendar_ref ON interview_stages(calendar_provider, calendar_id, calendar_event_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_stages_calendar_ref
      ON interview_stages(calendar_provider, calendar_id, calendar_event_id)
      WHERE calendar_provider IS NOT NULL AND calendar_id IS NOT NULL AND calendar_event_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_agent_proposal_groups_source_hash ON agent_proposal_applied_groups(source_text_hash);
    CREATE INDEX IF NOT EXISTS idx_interview_retro_evaluations_meeting_id ON interview_retro_evaluations(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_interview_retro_evaluations_stage_id ON interview_retro_evaluations(interview_stage_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_retro_evaluations_active_ready_meeting
      ON interview_retro_evaluations(meeting_id)
      WHERE status = 'ready' AND is_active = 1;
  `);

  addColumnIfMissing(db, 'meetings', 'calendar_event_id TEXT');
  addColumnIfMissing(db, 'meetings', 'interview_event_id TEXT');
  addColumnIfMissing(db, 'meetings', 'interview_stage_id TEXT');
  addColumnIfMissing(db, 'meetings', 'application_id TEXT');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_interview_event_id ON meetings(interview_event_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_interview_stage_id ON meetings(interview_stage_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_application_id ON meetings(application_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_calendar_event_id ON meetings(calendar_event_id);
  `);

  // Stage Workspace v20 is additive. The compatibility tables above remain the
  // source of truth for legacy screens; these columns/tables make stage ownership
  // explicit for the new service and give it durable lifecycle state.
  addColumnIfMissing(db, 'interview_stages', 'next_action TEXT');
  addColumnIfMissing(db, 'interview_stages', 'next_action_due_at INTEGER');
  addColumnIfMissing(db, 'interview_stages', "next_action_state TEXT NOT NULL DEFAULT 'missing' CHECK(next_action_state IN ('missing', 'saved', 'completed', 'none_required'))");
  addColumnIfMissing(db, 'interview_stages', 'next_action_completed_at INTEGER');
  addColumnIfMissing(db, 'interview_stages', 'primary_session_meeting_id TEXT');
  addColumnIfMissing(db, 'interview_stages', 'workspace_revision INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_event_map_stage
      ON legacy_interview_event_map(stage_id)
      WHERE stage_id IS NOT NULL;

    CREATE TRIGGER IF NOT EXISTS trg_legacy_event_map_validate_insert
    BEFORE INSERT ON legacy_interview_event_map
    WHEN NEW.stage_id IS NOT NULL AND (
      (SELECT application_id FROM interview_stages WHERE id = NEW.stage_id) IS NOT NEW.application_id
      OR (SELECT legacy_interview_event_id FROM interview_stages WHERE id = NEW.stage_id) IS NOT NEW.legacy_interview_event_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'legacy stage map ownership mismatch');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_legacy_event_map_validate_update
    BEFORE UPDATE OF application_id, stage_id, legacy_interview_event_id ON legacy_interview_event_map
    WHEN NEW.stage_id IS NOT NULL AND (
      (SELECT application_id FROM interview_stages WHERE id = NEW.stage_id) IS NOT NEW.application_id
      OR (SELECT legacy_interview_event_id FROM interview_stages WHERE id = NEW.stage_id) IS NOT NEW.legacy_interview_event_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'legacy stage map ownership mismatch');
    END;

    CREATE TABLE IF NOT EXISTS stage_sessions (
      meeting_id TEXT PRIMARY KEY,
      operation_id TEXT,
      interview_stage_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('initializing', 'recording', 'stopping', 'stopped', 'abandoned', 'failed')),
      started_at INTEGER,
      stopped_at INTEGER,
      heartbeat_at INTEGER,
      stop_requested_at INTEGER,
      stop_operation_id TEXT,
      failure_code TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY(interview_stage_id) REFERENCES interview_stages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stage_sessions_stage
      ON stage_sessions(interview_stage_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_sessions_one_active
      ON stage_sessions(interview_stage_id)
      WHERE status IN ('initializing', 'recording', 'stopping');
    CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_sessions_global_recorder
      ON stage_sessions((1))
      WHERE status IN ('initializing', 'recording', 'stopping');

    CREATE TABLE IF NOT EXISTS stage_session_contexts (
      meeting_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      provider_routes_json TEXT NOT NULL,
      redaction_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES stage_sessions(meeting_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stage_session_artifacts (
      meeting_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL CHECK(artifact_type IN ('transcript', 'summary', 'ai_review')),
      status TEXT NOT NULL CHECK(status IN ('not_requested', 'pending', 'ready', 'failed', 'skipped', 'cancelled')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(meeting_id, artifact_type),
      FOREIGN KEY(meeting_id) REFERENCES stage_sessions(meeting_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stage_reviews (
      interview_stage_id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'saved')),
      review_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(interview_stage_id) REFERENCES interview_stages(id) ON DELETE CASCADE,
      FOREIGN KEY(meeting_id) REFERENCES stage_sessions(meeting_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stage_artifact_jobs (
      meeting_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL CHECK(artifact_type IN ('transcript', 'summary', 'ai_review')),
      status TEXT NOT NULL CHECK(status IN ('blocked', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
      request_json TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      lease_owner TEXT,
      lease_expires_at INTEGER,
      fencing_token INTEGER NOT NULL DEFAULT 0,
      last_error_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(meeting_id, artifact_type),
      FOREIGN KEY(meeting_id) REFERENCES stage_sessions(meeting_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stage_workspace_operations (
      operation_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      request_json TEXT,
      stage_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'intent_committed', 'committed', 'failed', 'cancelled')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      lease_owner TEXT,
      lease_expires_at INTEGER,
      fencing_token INTEGER NOT NULL DEFAULT 0,
      result_json TEXT,
      error_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(stage_id) REFERENCES interview_stages(id) ON DELETE SET NULL
    );

    CREATE TRIGGER IF NOT EXISTS trg_stage_sessions_validate_insert
    BEFORE INSERT ON stage_sessions
    BEGIN
      SELECT CASE WHEN (SELECT id FROM interview_stages WHERE id = NEW.interview_stage_id) IS NULL
        THEN RAISE(ABORT, 'stage session stage not found') END;
      SELECT CASE WHEN (SELECT interview_stage_id FROM meetings WHERE id = NEW.meeting_id) IS NOT NEW.interview_stage_id
        THEN RAISE(ABORT, 'stage session meeting stage mismatch') END;
      SELECT CASE WHEN (SELECT application_id FROM meetings WHERE id = NEW.meeting_id) IS NOT
                         (SELECT application_id FROM interview_stages WHERE id = NEW.interview_stage_id)
        THEN RAISE(ABORT, 'stage session meeting application mismatch') END;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stage_sessions_immutable_owner
    BEFORE UPDATE OF interview_stage_id, meeting_id ON stage_sessions
    WHEN OLD.interview_stage_id IS NOT NEW.interview_stage_id OR OLD.meeting_id IS NOT NEW.meeting_id
    BEGIN
      SELECT RAISE(ABORT, 'stage session ownership is immutable');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stage_reject_application_drift
    BEFORE UPDATE OF application_id ON interview_stages
    WHEN EXISTS (SELECT 1 FROM stage_sessions WHERE interview_stage_id = OLD.id)
      AND OLD.application_id IS NOT NEW.application_id
    BEGIN
      SELECT RAISE(ABORT, 'stage application ownership is immutable after session creation');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_meetings_reject_stage_session_drift
    BEFORE UPDATE OF interview_stage_id, application_id ON meetings
    WHEN EXISTS (SELECT 1 FROM stage_sessions WHERE meeting_id = OLD.id)
      AND (NEW.interview_stage_id IS NOT OLD.interview_stage_id OR NEW.application_id IS NOT OLD.application_id)
    BEGIN
      SELECT RAISE(ABORT, 'meeting ownership is immutable after stage session creation');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_meetings_restrict_primary_session_delete
    BEFORE DELETE ON meetings
    WHEN EXISTS (
      SELECT 1 FROM interview_stages
      WHERE primary_session_meeting_id = OLD.id
    )
    BEGIN
      SELECT RAISE(ABORT, 'primary stage session must be cleared or replaced before deletion');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stage_primary_session_matches_stage
    BEFORE UPDATE OF primary_session_meeting_id ON interview_stages
    WHEN NEW.primary_session_meeting_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stage_sessions
        WHERE meeting_id = NEW.primary_session_meeting_id
          AND interview_stage_id = NEW.id
      )
    BEGIN
      SELECT RAISE(ABORT, 'primary session does not belong to stage');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stage_review_matches_stage
    BEFORE INSERT ON stage_reviews
    WHEN NOT EXISTS (
      SELECT 1 FROM stage_sessions
      WHERE meeting_id = NEW.meeting_id
        AND interview_stage_id = NEW.interview_stage_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'stage review session does not belong to stage');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stage_review_matches_stage_update
    BEFORE UPDATE OF interview_stage_id, meeting_id ON stage_reviews
    WHEN NOT EXISTS (
      SELECT 1 FROM stage_sessions
      WHERE meeting_id = NEW.meeting_id
        AND interview_stage_id = NEW.interview_stage_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'stage review session does not belong to stage');
    END;
  `);

  // Added after the first v20 preview so existing stage sessions can finish
  // the durable initializing -> recording handshake without a destructive
  // table rewrite.
  addColumnIfMissing(db, 'stage_sessions', 'operation_id TEXT');
}
