import crypto from 'crypto';
import type {
  ApplicationCreateFromIntakeResult,
  ApplicationDetail,
  ApplicationIntakeResult,
  ApplicationListInput,
  ApplicationStatus,
  ApplicationUpdatePatch,
  InterviewStage,
  InterviewStageCreatePayload,
  InterviewStageStatus,
  InterviewStageType,
  InterviewStageUpdatePatch,
  InterviewCreatePayload,
  InterviewDetail,
  InterviewEvent,
  InterviewListInput,
  InterviewListItem,
  LinkedMeeting,
  InterviewQuestion,
  InterviewQuestionPayload,
  InterviewRetro,
  InterviewRetroEvaluation,
  InterviewRetroPayload,
  RetroPromptAction,
  RetroPromptState,
  InterviewUpdatePatch,
  ClearArchivedApplicationsResult,
  PrepBrief,
  PrepBriefPayload,
  VacancyDossier,
  VacancyDossierPayload,
} from '../../../src/types/interviews';

export interface DbRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface DbStatement {
  run(...params: any[]): DbRunResult;
  get<T = unknown>(...params: any[]): T | undefined;
  all<T = unknown>(...params: any[]): T[];
}

export interface DbExecutor {
  prepare(sql: string): DbStatement;
  exec(sql: string): void;
  transaction<T>(fn: (db: DbExecutor) => T): T;
}

export function createBetterSqliteExecutor(db: any): DbExecutor {
  const executor: DbExecutor = {
    prepare: (sql: string) => db.prepare(sql),
    exec: (sql: string) => db.exec(sql),
    transaction: <T>(fn: (txDb: DbExecutor) => T): T => {
      const run = db.transaction(() => fn(executor));
      return run();
    },
  };
  return executor;
}

type JsonValue = string[] | Record<string, unknown> | null | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function toJson(value: JsonValue): string {
  return JSON.stringify(value ?? []);
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function eventFromRow(row: any): InterviewEvent {
  return {
    id: row.id,
    title: row.title,
    company: row.company ?? null,
    roleTitle: row.role_title ?? null,
    stage: row.stage ?? null,
    status: row.status,
    priority: row.priority ?? 'normal',
    source: row.source ?? null,
    vacancyUrl: row.vacancy_url ?? null,
    meetingUrl: row.meeting_url ?? null,
    calendarProvider: row.calendar_provider ?? null,
    calendarId: row.calendar_id ?? null,
    calendarEventId: row.calendar_event_id ?? null,
    calendarSnapshot: parseJsonObject(row.calendar_snapshot_json),
    calendarLastSeenAt: row.calendar_last_seen_at ?? null,
    calendarMissingSince: row.calendar_missing_since ?? null,
    calendarSyncStatus: row.calendar_sync_status ?? 'local_only',
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    timezone: row.timezone ?? null,
    rawSourceText: row.raw_source_text ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
    applicationId: row.application_id ?? null,
    selectedStageId: row.stage_id ?? null,
  };
}

function listItemFromRow(row: any): InterviewListItem {
  return {
    id: row.id,
    title: row.title,
    company: row.company ?? null,
    roleTitle: row.role_title ?? null,
    stage: row.stage ?? null,
    status: row.status,
    priority: row.priority ?? 'normal',
    source: row.source ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    timezone: row.timezone ?? null,
    calendarSyncStatus: row.calendar_sync_status ?? 'local_only',
    updatedAt: row.updated_at,
    linkedMeetingCount: Number(row.linked_meeting_count ?? 0),
    questionCount: Number(row.question_count ?? 0),
    applicationId: row.application_id ?? null,
    selectedStageId: row.stage_id ?? null,
  };
}

function applicationFromRow(row: any): ApplicationDetail {
  return {
    id: row.id,
    title: row.title,
    company: row.company ?? null,
    roleTitle: row.role_title ?? null,
    status: row.status,
    priority: row.priority ?? 'normal',
    source: row.source ?? null,
    sourceUrl: row.source_url ?? null,
    vacancyUrl: row.vacancy_url ?? null,
    compensationText: row.compensation_text ?? null,
    locationFormat: row.location_format ?? null,
    nextAction: row.next_action ?? null,
    nextActionDueAt: row.next_action_due_at ?? null,
    rawSourceText: row.raw_source_text ?? null,
    legacyInterviewEventId: row.legacy_interview_event_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
    selectedStageId: row.selected_stage_id ?? null,
    stages: [],
  };
}

function stageFromRow(row: any): InterviewStage {
  return {
    id: row.id,
    applicationId: row.application_id,
    stageType: row.stage_type ?? 'custom',
    title: row.title,
    status: row.status ?? 'draft',
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    timezone: row.timezone ?? null,
    format: row.format ?? null,
    meetingUrl: row.meeting_url ?? null,
    calendarProvider: row.calendar_provider ?? null,
    calendarId: row.calendar_id ?? null,
    calendarEventId: row.calendar_event_id ?? null,
    calendarSnapshot: parseJsonObject(row.calendar_snapshot_json),
    calendarLastSeenAt: row.calendar_last_seen_at ?? null,
    calendarMissingSince: row.calendar_missing_since ?? null,
    calendarSyncStatus: row.calendar_sync_status ?? 'local_only',
    rawSourceText: row.raw_source_text ?? null,
    legacyInterviewEventId: row.legacy_interview_event_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
  };
}

function applicationStatusFromIntake(intake: ApplicationIntakeResult): ApplicationStatus {
  if (intake.stage?.startsAt) return 'interviewing';
  return 'lead_found';
}

function applicationStatusFromInterviewStatus(status: InterviewEvent['status']): ApplicationStatus {
  return status === 'active' ? 'lead_found' : status;
}

function interviewStatusFromApplicationStatus(status: ApplicationStatus): InterviewEvent['status'] {
  return status === 'lead_found' ? 'active' : status;
}

function interviewStatusFromStageStatus(status: InterviewStageStatus): InterviewEvent['status'] {
  if (status === 'archived') return 'archived';
  if (status === 'rejected') return 'rejected';
  if (status === 'canceled') return 'withdrawn';
  if (status === 'passed') return 'offer';
  return 'interviewing';
}

function stageStatusFromIntake(intake: ApplicationIntakeResult): InterviewStageStatus {
  if (intake.stage?.status) return intake.stage.status;
  if (intake.stage?.startsAt) return 'scheduled';
  return 'draft';
}

function stageTypeFromText(value?: string | null): InterviewStageType {
  const text = (value ?? '').toLowerCase();
  if (/recruit|hr|screen|скрин|рекрутер|эйчар|hr/.test(text)) return 'recruiter_screen';
  if (/system|design|архитект/.test(text)) return 'system_design';
  if (/lead|manager|руковод/.test(text)) return 'leadership';
  if (/final|финал/.test(text)) return 'final';
  if (/offer|security|оффер|сб/.test(text)) return 'offer_security';
  if (/tech|technical|тех/.test(text)) return 'technical_screen';
  return 'custom';
}

function applicationDescriptionFromIntake(intake: ApplicationIntakeResult): string {
  const provided = intake.application.description?.trim();
  if (provided) return provided.slice(0, 1200);
  const subject = [
    intake.application.company,
    intake.application.roleTitle || intake.application.title,
  ].filter(Boolean).join(' · ') || intake.application.title || 'Vacancy';
  const source = intake.application.source ? ` Source: ${intake.application.source}.` : '';
  const process = intake.stage?.title ? ` Current process: ${intake.stage.title}.` : '';
  return `${subject}.${source}${process}`.slice(0, 1200);
}

function dossierFromRow(row: any): VacancyDossier {
  return {
    id: row.id,
    interviewEventId: row.interview_event_id,
    description: row.description ?? null,
    requirements: parseJsonArray(row.requirements_json),
    compensationText: row.compensation_text ?? null,
    fitHypothesis: row.fit_hypothesis ?? null,
    risks: parseJsonArray(row.risks_json),
    questionsToAsk: parseJsonArray(row.questions_to_ask_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function prepFromRow(row: any): PrepBrief {
  return {
    id: row.id,
    interviewEventId: row.interview_event_id,
    oneLineGoal: row.one_line_goal ?? null,
    pitch30s: row.pitch_30s ?? null,
    pitch2m: row.pitch_2m ?? null,
    expectedTopics: parseJsonArray(row.expected_topics_json),
    cheatsheet: row.cheatsheet ?? null,
    riskHandling: parseJsonArray(row.risk_handling_json),
    lastChecklist: parseJsonArray(row.last_checklist_json),
    updatedAt: row.updated_at,
  };
}

function retroFromRow(row: any): InterviewRetro {
  return {
    id: row.id,
    interviewEventId: row.interview_event_id,
    passProbability: row.pass_probability ?? null,
    mainSignal: row.main_signal ?? null,
    strongMoments: parseJsonArray(row.strong_moments_json),
    weakMoments: parseJsonArray(row.weak_moments_json),
    newFacts: parseJsonArray(row.new_facts_json),
    followUpActions: parseJsonArray(row.follow_up_actions_json),
    createdAt: row.created_at,
  };
}

function retroEvaluationFromRow(row: any): InterviewRetroEvaluation {
  return {
    id: row.id,
    applicationId: row.application_id ?? null,
    interviewStageId: row.interview_stage_id ?? null,
    interviewEventId: row.interview_event_id ?? null,
    meetingId: row.meeting_id,
    status: row.status,
    modelId: row.model_id ?? null,
    summary: row.summary ?? null,
    signals: parseJsonArray(row.signals_json),
    risks: parseJsonArray(row.risks_json),
    followups: parseJsonArray(row.followups_json),
    confidence: row.confidence ?? null,
    error: row.error ?? null,
    isActive: Boolean(row.is_active),
    supersededAt: row.superseded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function questionFromRow(row: any): InterviewQuestion {
  return {
    id: row.id,
    interviewEventId: row.interview_event_id,
    questionText: row.question_text,
    category: row.category ?? null,
    quality: row.quality ?? null,
    weakSpot: Boolean(row.weak_spot),
    followUpNote: row.follow_up_note ?? null,
    createdAt: row.created_at,
  };
}

function retroPromptStateFromRow(row: any): RetroPromptState {
  return {
    interviewEventId: row.interview_event_id,
    promptedAt: row.prompted_at ?? null,
    dismissedAt: row.dismissed_at ?? null,
    snoozedUntil: row.snoozed_until ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  };
}

function linkedMeetingFromRow(row: any): LinkedMeeting {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    duration: String(row.duration_ms ?? 0),
    calendarEventId: row.calendar_event_id ?? null,
    interviewEventId: row.interview_event_id ?? null,
    interviewStageId: row.interview_stage_id ?? null,
    applicationId: row.application_id ?? null,
  };
}

export interface LinkedMeetingTranscript {
  meeting: LinkedMeeting;
  transcriptText: string;
  applicationId?: string | null;
  interviewStageId?: string | null;
  interviewEventId?: string | null;
}

export class InterviewRepository {
  constructor(private readonly db: DbExecutor) {}

  list(input: InterviewListInput = {}): InterviewListItem[] {
    const where: string[] = ['archived_at IS NULL'];
    const params: any[] = [];

    if (input.range?.start !== undefined) {
      where.push('(starts_at IS NULL OR starts_at >= ?)');
      params.push(input.range.start);
    }
    if (input.range?.end !== undefined) {
      where.push('(starts_at IS NULL OR starts_at <= ?)');
      params.push(input.range.end);
    }
    if (input.status) {
      const statuses = Array.isArray(input.status) ? input.status : [input.status];
      where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    params.push(limit, offset);

    const rows = this.db.prepare(`
      SELECT
        e.id, e.title, e.company, e.role_title, e.stage, e.status, e.priority,
        e.source, e.starts_at, e.ends_at, e.timezone, e.calendar_sync_status, e.updated_at,
        map.application_id, map.stage_id,
        COUNT(DISTINCT m.id) AS linked_meeting_count,
        COUNT(DISTINCT q.id) AS question_count
      FROM interview_events e
      LEFT JOIN legacy_interview_event_map map ON map.legacy_interview_event_id = e.id
      LEFT JOIN meetings m ON (
        m.interview_event_id = e.id
        OR (map.stage_id IS NOT NULL AND m.interview_stage_id = map.stage_id)
        OR (map.application_id IS NOT NULL AND m.application_id = map.application_id)
      )
      LEFT JOIN interview_questions q ON q.interview_event_id = e.id
      WHERE ${where.join(' AND ')}
      GROUP BY e.id
      ORDER BY
        CASE WHEN e.starts_at IS NULL THEN 1 ELSE 0 END,
        e.starts_at ASC,
        e.updated_at DESC
      LIMIT ? OFFSET ?
    `).all<any>(...params);

    return rows.map(listItemFromRow);
  }

  get(id: string, include: Array<'dossier' | 'prep' | 'retros' | 'questions' | 'contacts' | 'meetings'> = []): InterviewDetail | null {
    const row = this.db.prepare(`
      SELECT e.*, map.application_id, map.stage_id
      FROM interview_events e
      LEFT JOIN legacy_interview_event_map map ON map.legacy_interview_event_id = e.id
      WHERE e.id = ?
    `).get<any>(id);
    if (!row) return null;

    const detail: InterviewDetail = eventFromRow(row);
    if (include.includes('dossier')) {
      const dossier = this.db.prepare('SELECT * FROM vacancy_dossiers WHERE interview_event_id = ?').get<any>(id);
      detail.dossier = dossier ? dossierFromRow(dossier) : null;
    }
    if (include.includes('prep')) {
      const prep = this.db.prepare('SELECT * FROM prep_briefs WHERE interview_event_id = ?').get<any>(id);
      detail.prep = prep ? prepFromRow(prep) : null;
    }
    if (include.includes('retros')) {
      detail.retros = this.db
        .prepare('SELECT * FROM interview_retros WHERE interview_event_id = ? ORDER BY created_at DESC')
        .all<any>(id)
        .map(retroFromRow);
      detail.retroEvaluation = this.getLatestRetroEvaluation(id);
    }
    if (include.includes('questions')) {
      detail.questions = this.listQuestions({ interviewId: id });
    }
    if (include.includes('meetings')) {
      detail.linkedMeetings = this.db
        .prepare(`
          SELECT DISTINCT
            m.id, m.title, m.created_at AS date, m.duration_ms,
            m.calendar_event_id, m.interview_event_id, m.interview_stage_id, m.application_id
          FROM meetings m
          LEFT JOIN legacy_interview_event_map map ON map.legacy_interview_event_id = ?
          WHERE m.interview_event_id = ?
             OR (map.stage_id IS NOT NULL AND m.interview_stage_id = map.stage_id)
             OR (map.application_id IS NOT NULL AND m.application_id = map.application_id)
          ORDER BY m.start_time DESC
        `)
        .all<any>(id, id)
        .map(linkedMeetingFromRow);
    }
    return detail;
  }

  create(input: InterviewCreatePayload & { id?: string }, operationId?: string): InterviewEvent {
    return this.withOperation(operationId, 'interviews:create', () => {
      const id = input.id || newId('interview');
      const createdAt = nowIso();
      this.db.prepare(`
        INSERT INTO interview_events (
          id, title, company, role_title, stage, status, priority, source,
          vacancy_url, meeting_url, starts_at, ends_at, timezone, raw_source_text,
          calendar_provider, calendar_id, calendar_event_id, calendar_snapshot_json,
          calendar_last_seen_at, calendar_sync_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.title,
        input.company ?? null,
        input.roleTitle ?? null,
        input.stage ?? null,
        input.status ?? 'active',
        input.priority ?? 'normal',
        input.source ?? null,
        input.vacancyUrl ?? null,
        input.meetingUrl ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        input.timezone ?? null,
        input.rawSourceText ?? null,
        input.calendarProvider ?? null,
        input.calendarId ?? null,
        input.calendarEventId ?? null,
        input.calendarSnapshot ? JSON.stringify(input.calendarSnapshot) : null,
        input.calendarLastSeenAt ?? null,
        input.calendarSyncStatus ?? 'local_only',
        createdAt,
        createdAt,
      );
      return this.get(id) as InterviewEvent;
    });
  }

  listApplications(input: ApplicationListInput = {}): ApplicationDetail[] {
    const where: string[] = [];
    const params: any[] = [];
    const includeArchived = Boolean(input.includeArchived);

    if (!includeArchived) {
      where.push('a.archived_at IS NULL');
    }
    if (input.activeOnly) {
      where.push("a.status NOT IN ('rejected', 'withdrawn', 'archived')");
      if (!includeArchived) where.push('a.archived_at IS NULL');
    }
    if (input.status) {
      const statuses = Array.isArray(input.status) ? input.status : [input.status];
      where.push(`a.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const offset = Math.max(input.offset ?? 0, 0);
    params.push(limit, offset);

    const rows = this.db.prepare(`
      SELECT a.*, (
        SELECT s.id
        FROM interview_stages s
        WHERE s.application_id = a.id AND s.archived_at IS NULL
        ORDER BY
          CASE WHEN s.starts_at IS NULL THEN 1 ELSE 0 END,
          s.starts_at ASC,
          s.updated_at DESC
        LIMIT 1
      ) AS selected_stage_id
      FROM applications a
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.updated_at DESC
      LIMIT ? OFFSET ?
    `).all<any>(...params);
    return rows.map(row => {
      const application = applicationFromRow(row);
      application.stages = this.listStages(application.id);
      return application;
    });
  }

  getApplication(id: string): ApplicationDetail | null {
    const row = this.db.prepare(`
      SELECT a.*, (
        SELECT s.id
        FROM interview_stages s
        WHERE s.application_id = a.id AND s.archived_at IS NULL
        ORDER BY
          CASE WHEN s.starts_at IS NULL THEN 1 ELSE 0 END,
          s.starts_at ASC,
          s.updated_at DESC
        LIMIT 1
      ) AS selected_stage_id
      FROM applications a
      WHERE a.id = ?
    `).get<any>(id);
    if (!row) return null;
    const application = applicationFromRow(row);
    application.stages = this.listStages(id);
    const dossier = this.db.prepare('SELECT * FROM vacancy_dossiers WHERE interview_event_id = ?').get<any>(application.legacyInterviewEventId);
    application.dossier = dossier ? dossierFromRow(dossier) : null;
    application.linkedMeetings = this.db.prepare(`
      SELECT DISTINCT
        m.id, m.title, m.created_at AS date, m.duration_ms,
        m.calendar_event_id, m.interview_event_id, m.interview_stage_id, m.application_id
      FROM meetings m
      LEFT JOIN interview_stages s ON s.id = m.interview_stage_id
      WHERE m.application_id = ?
         OR s.application_id = ?
         OR (m.interview_event_id IS NOT NULL AND m.interview_event_id = ?)
      ORDER BY m.start_time DESC
    `).all<any>(id, id, application.legacyInterviewEventId).map(linkedMeetingFromRow);
    return application;
  }

  listStages(applicationId: string): InterviewStage[] {
    return this.db.prepare(`
      SELECT *
      FROM interview_stages
      WHERE application_id = ?
      ORDER BY
        CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN starts_at IS NULL THEN 1 ELSE 0 END,
        starts_at ASC,
        archived_at DESC,
        updated_at DESC
    `).all<any>(applicationId).map(stageFromRow);
  }

  getStage(id: string): InterviewStage | null {
    const row = this.db.prepare('SELECT * FROM interview_stages WHERE id = ?').get<any>(id);
    return row ? stageFromRow(row) : null;
  }

  updateApplication(id: string, patch: ApplicationUpdatePatch): ApplicationDetail | null {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM applications WHERE id = ?').get<any>(id);
      if (!existing) return null;

      const columns: Record<string, unknown> = {};
      const map: Array<[keyof ApplicationUpdatePatch, string]> = [
        ['title', 'title'],
        ['company', 'company'],
        ['roleTitle', 'role_title'],
        ['status', 'status'],
        ['priority', 'priority'],
        ['source', 'source'],
        ['sourceUrl', 'source_url'],
        ['vacancyUrl', 'vacancy_url'],
        ['compensationText', 'compensation_text'],
        ['locationFormat', 'location_format'],
        ['nextAction', 'next_action'],
        ['nextActionDueAt', 'next_action_due_at'],
        ['rawSourceText', 'raw_source_text'],
      ];
      for (const [key, column] of map) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          columns[column] = (patch as any)[key] ?? null;
        }
      }
      const timestamp = nowIso();
      if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
        columns.archived_at = patch.status === 'archived' ? existing.archived_at ?? timestamp : null;
      }
      columns.updated_at = timestamp;
      const names = Object.keys(columns);
      this.db.prepare(`
        UPDATE applications
        SET ${names.map(name => `${name} = ?`).join(', ')}
        WHERE id = ?
      `).run(...names.map(name => columns[name]), id);

      const legacyRows = this.db.prepare(`
        SELECT e.id, e.archived_at, a.legacy_interview_event_id
        FROM legacy_interview_event_map map
        JOIN interview_events e ON e.id = map.legacy_interview_event_id
        JOIN applications a ON a.id = map.application_id
        WHERE map.application_id = ?
      `).all<any>(id);
      for (const legacy of legacyRows) {
        const legacyColumns: Record<string, unknown> = {};
        if (Object.prototype.hasOwnProperty.call(patch, 'company')) legacyColumns.company = patch.company ?? null;
        if (Object.prototype.hasOwnProperty.call(patch, 'roleTitle')) legacyColumns.role_title = patch.roleTitle ?? null;
        if (Object.prototype.hasOwnProperty.call(patch, 'source')) legacyColumns.source = patch.source ?? null;
        if (Object.prototype.hasOwnProperty.call(patch, 'vacancyUrl')) legacyColumns.vacancy_url = patch.vacancyUrl ?? null;
        if (Object.prototype.hasOwnProperty.call(patch, 'rawSourceText')) legacyColumns.raw_source_text = patch.rawSourceText ?? null;
        if (Object.prototype.hasOwnProperty.call(patch, 'title') && legacy.id === legacy.legacy_interview_event_id) {
          legacyColumns.title = patch.title ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
          legacyColumns.status = interviewStatusFromApplicationStatus(patch.status as ApplicationStatus);
          legacyColumns.archived_at = patch.status === 'archived' ? legacy.archived_at ?? timestamp : null;
        }
        const legacyNames = Object.keys(legacyColumns);
        if (legacyNames.length > 0) {
          legacyColumns.updated_at = timestamp;
          const finalNames = Object.keys(legacyColumns);
          this.db.prepare(`
            UPDATE interview_events
            SET ${finalNames.map(name => `${name} = ?`).join(', ')}
            WHERE id = ?
          `).run(...finalNames.map(name => legacyColumns[name]), legacy.id);
        }
      }

      return this.getApplication(id);
    });
  }

  createStage(payload: InterviewStageCreatePayload): ApplicationDetail | null {
    return this.db.transaction(() => {
      const application = this.db.prepare('SELECT id FROM applications WHERE id = ?').get<any>(payload.applicationId);
      if (!application) return null;
      const timestamp = nowIso();
      const id = newId('stage');
      const hasLocalMeeting = Boolean(payload.startsAt || payload.endsAt || payload.meetingUrl);
      this.db.prepare(`
        INSERT INTO interview_stages (
          id, application_id, stage_type, title, status, starts_at, ends_at, timezone,
          format, meeting_url, calendar_provider, calendar_sync_status, raw_source_text,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        payload.applicationId,
        payload.stageType ?? 'custom',
        payload.title,
        payload.status ?? (payload.startsAt ? 'scheduled' : 'draft'),
        payload.startsAt ?? null,
        payload.endsAt ?? null,
        payload.timezone ?? null,
        payload.format ?? null,
        payload.meetingUrl ?? null,
        payload.calendarProvider ?? (hasLocalMeeting ? 'manual' : null),
        payload.calendarSyncStatus ?? 'local_only',
        payload.rawSourceText ?? null,
        timestamp,
        timestamp,
      );
      this.db.prepare('UPDATE applications SET updated_at = ? WHERE id = ?').run(timestamp, payload.applicationId);
      return this.getApplication(payload.applicationId);
    });
  }

  updateStage(id: string, patch: InterviewStageUpdatePatch): ApplicationDetail | null {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM interview_stages WHERE id = ?').get<any>(id);
      if (!existing) return null;
      const columns: Record<string, unknown> = {};
      const map: Array<[keyof InterviewStageUpdatePatch, string]> = [
        ['stageType', 'stage_type'],
        ['title', 'title'],
        ['status', 'status'],
        ['startsAt', 'starts_at'],
        ['endsAt', 'ends_at'],
        ['timezone', 'timezone'],
        ['format', 'format'],
        ['meetingUrl', 'meeting_url'],
        ['calendarProvider', 'calendar_provider'],
        ['calendarId', 'calendar_id'],
        ['calendarEventId', 'calendar_event_id'],
        ['calendarLastSeenAt', 'calendar_last_seen_at'],
        ['calendarMissingSince', 'calendar_missing_since'],
        ['calendarSyncStatus', 'calendar_sync_status'],
        ['rawSourceText', 'raw_source_text'],
      ];
      for (const [key, column] of map) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          columns[column] = (patch as any)[key] ?? null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'calendarSnapshot')) {
        columns.calendar_snapshot_json = patch.calendarSnapshot ? JSON.stringify(patch.calendarSnapshot) : null;
      }
      const timestamp = nowIso();
      if (patch.status === 'archived') {
        columns.archived_at = existing.archived_at ?? timestamp;
      }
      columns.updated_at = timestamp;
      const names = Object.keys(columns);
      if (names.length > 0) {
        this.db.prepare(`
          UPDATE interview_stages
          SET ${names.map(name => `${name} = ?`).join(', ')}
          WHERE id = ?
        `).run(...names.map(name => columns[name]), id);
      }
      this.syncStageLegacy(id, patch, timestamp);
      this.db.prepare('UPDATE applications SET updated_at = ? WHERE id = ?').run(timestamp, existing.application_id);
      return this.getApplication(existing.application_id);
    });
  }

  archiveStage(id: string): ApplicationDetail | null {
    return this.updateStage(id, { status: 'archived' });
  }

  restoreStage(id: string, status: Exclude<InterviewStageStatus, 'archived'> = 'scheduled'): ApplicationDetail | null {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM interview_stages WHERE id = ?').get<any>(id);
      if (!existing) return null;
      const timestamp = nowIso();
      this.db.prepare(`
        UPDATE interview_stages
        SET status = ?, archived_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(status, timestamp, id);
      this.syncStageLegacy(id, { status }, timestamp, { restoreArchived: true });
      this.db.prepare('UPDATE applications SET updated_at = ? WHERE id = ?').run(timestamp, existing.application_id);
      return this.getApplication(existing.application_id);
    });
  }

  private syncStageLegacy(
    stageId: string,
    patch: InterviewStageUpdatePatch,
    timestamp: string,
    options: { restoreArchived?: boolean } = {},
  ): void {
    const map = this.db.prepare(`
      SELECT map.legacy_interview_event_id, event.archived_at
      FROM legacy_interview_event_map map
      JOIN interview_events event ON event.id = map.legacy_interview_event_id
      WHERE map.stage_id = ?
    `).get<{ legacy_interview_event_id?: string | null; archived_at?: string | null }>(stageId);
    if (!map?.legacy_interview_event_id) return;
    const columns: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) columns.stage = patch.title ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'meetingUrl')) columns.meeting_url = patch.meetingUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'startsAt')) columns.starts_at = patch.startsAt ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'endsAt')) columns.ends_at = patch.endsAt ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'timezone')) columns.timezone = patch.timezone ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'rawSourceText')) columns.raw_source_text = patch.rawSourceText ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarProvider')) columns.calendar_provider = patch.calendarProvider ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarId')) columns.calendar_id = patch.calendarId ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarEventId')) columns.calendar_event_id = patch.calendarEventId ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarSnapshot')) {
      columns.calendar_snapshot_json = patch.calendarSnapshot ? JSON.stringify(patch.calendarSnapshot) : null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarLastSeenAt')) columns.calendar_last_seen_at = patch.calendarLastSeenAt ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarMissingSince')) columns.calendar_missing_since = patch.calendarMissingSince ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarSyncStatus')) columns.calendar_sync_status = patch.calendarSyncStatus ?? null;
    if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
      columns.status = interviewStatusFromStageStatus(patch.status as InterviewStageStatus);
      if (patch.status === 'archived') {
        columns.archived_at = map.archived_at ?? timestamp;
      } else if (options.restoreArchived) {
        columns.archived_at = null;
      }
    }
    for (const key of Object.keys(columns)) {
      if (columns[key] === undefined) delete columns[key];
    }
    const names = Object.keys(columns);
    if (names.length === 0) return;
    columns.updated_at = timestamp;
    const finalNames = Object.keys(columns);
    this.db.prepare(`
      UPDATE interview_events
      SET ${finalNames.map(name => `${name} = ?`).join(', ')}
      WHERE id = ?
    `).run(...finalNames.map(name => columns[name]), map.legacy_interview_event_id);
  }

  createApplicationFromIntake(
    intake: ApplicationIntakeResult,
    operationId?: string,
    selectedApplicationId?: string,
  ): ApplicationCreateFromIntakeResult {
    return this.withOperation(operationId, 'applications:create-from-intake', () => {
      return this.db.transaction(() => {
        const timestamp = nowIso();
        const existingApplication = selectedApplicationId
          ? this.db.prepare('SELECT * FROM applications WHERE id = ? AND archived_at IS NULL').get<any>(selectedApplicationId)
          : null;
        if (selectedApplicationId && !existingApplication) {
          throw new Error('Selected application not found.');
        }
        if (existingApplication && intake.stage) {
          const appId = selectedApplicationId as string;
          const stageId = newId('stage');
          const legacyId = newId('interview');
          const stageTitle = intake.stage.title || intake.stage.stageType || 'Initial stage';
          const stageStatus = stageStatusFromIntake(intake);
          const timezone = intake.stage.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const title = existingApplication.title
            || intake.application.title
            || [intake.application.company, intake.application.roleTitle].filter(Boolean).join(' · ')
            || 'Untitled vacancy';
          const company = existingApplication.company ?? intake.application.company ?? null;
          const roleTitle = existingApplication.role_title ?? intake.application.roleTitle ?? null;
          const source = intake.application.source ?? existingApplication.source ?? null;
          const vacancyUrl = existingApplication.vacancy_url ?? intake.application.vacancyUrl ?? null;

          this.db.prepare(`
            INSERT INTO interview_stages (
              id, application_id, stage_type, title, status, starts_at, ends_at, timezone,
              meeting_url, calendar_sync_status, raw_source_text, legacy_interview_event_id,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            stageId,
            appId,
            intake.stage.stageType ?? stageTypeFromText(stageTitle),
            stageTitle,
            stageStatus,
            intake.stage.startsAt ?? null,
            intake.stage.endsAt ?? null,
            timezone,
            intake.stage.meetingUrl ?? null,
            'local_only',
            intake.application.rawSourceText,
            legacyId,
            timestamp,
            timestamp,
          );

          this.db.prepare(`
            INSERT INTO interview_events (
              id, title, company, role_title, stage, status, priority, source, vacancy_url,
              meeting_url, starts_at, ends_at, timezone, raw_source_text, calendar_sync_status,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            legacyId,
            title,
            company,
            roleTitle,
            stageTitle,
            'interviewing',
            'normal',
            source,
            vacancyUrl,
            intake.stage.meetingUrl ?? null,
            intake.stage.startsAt ?? null,
            intake.stage.endsAt ?? null,
            timezone,
            intake.application.rawSourceText,
            'local_only',
            timestamp,
            timestamp,
          );

          this.db.prepare(`
            INSERT INTO legacy_interview_event_map (legacy_interview_event_id, application_id, stage_id)
            VALUES (?, ?, ?)
          `).run(legacyId, appId, stageId);

          this.db.prepare(`
            UPDATE applications
            SET status = CASE WHEN status = 'lead_found' THEN 'interviewing' ELSE status END,
                updated_at = ?
            WHERE id = ?
          `).run(timestamp, appId);

          const application = this.getApplication(appId) as ApplicationDetail;
          const legacyInterview = this.get(legacyId, ['dossier', 'prep', 'retros', 'questions', 'meetings']);
          return { application, legacyInterview };
        }

        const appId = newId('app');
        const stageId = intake.stage ? newId('stage') : null;
        const legacyId = newId('interview');
        const title = intake.application.title
          || [intake.application.company, intake.application.roleTitle].filter(Boolean).join(' · ')
          || 'Untitled vacancy';
        const stageTitle = intake.stage?.title || intake.stage?.stageType || 'Initial stage';
        const applicationStatus = applicationStatusFromIntake(intake);
        const stageStatus = stageStatusFromIntake(intake);
        const timezone = intake.stage?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        this.db.prepare(`
          INSERT INTO applications (
            id, title, company, role_title, status, priority, source, vacancy_url,
            compensation_text, raw_source_text, legacy_interview_event_id, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          appId,
          title,
          intake.application.company ?? null,
          intake.application.roleTitle ?? null,
          applicationStatus,
          'normal',
          intake.application.source ?? null,
          intake.application.vacancyUrl ?? null,
          intake.application.compensationText ?? null,
          intake.application.rawSourceText,
          legacyId,
          timestamp,
          timestamp,
        );

        if (stageId) {
          this.db.prepare(`
            INSERT INTO interview_stages (
              id, application_id, stage_type, title, status, starts_at, ends_at, timezone,
              meeting_url, calendar_sync_status, raw_source_text, legacy_interview_event_id,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            stageId,
            appId,
            intake.stage?.stageType ?? stageTypeFromText(stageTitle),
            stageTitle,
            stageStatus,
            intake.stage?.startsAt ?? null,
            intake.stage?.endsAt ?? null,
            timezone,
            intake.stage?.meetingUrl ?? null,
            'local_only',
            intake.application.rawSourceText,
            legacyId,
            timestamp,
            timestamp,
          );
        }

        this.db.prepare(`
          INSERT INTO interview_events (
            id, title, company, role_title, stage, status, priority, source, vacancy_url,
            meeting_url, starts_at, ends_at, timezone, raw_source_text, calendar_sync_status,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          legacyId,
          title,
          intake.application.company ?? null,
          intake.application.roleTitle ?? null,
          stageTitle,
          applicationStatus === 'lead_found' ? 'active' : applicationStatus,
          'normal',
          intake.application.source ?? null,
          intake.application.vacancyUrl ?? null,
          intake.stage?.meetingUrl ?? null,
          intake.stage?.startsAt ?? null,
          intake.stage?.endsAt ?? null,
          timezone,
          intake.application.rawSourceText,
          'local_only',
          timestamp,
          timestamp,
        );

        this.db.prepare(`
          INSERT INTO legacy_interview_event_map (legacy_interview_event_id, application_id, stage_id)
          VALUES (?, ?, ?)
        `).run(legacyId, appId, stageId);

        if (intake.application.description || intake.application.requirements?.length || intake.application.risks?.length || intake.application.questionsToAsk?.length || intake.application.compensationText) {
          this.saveDossier(legacyId, {
            description: applicationDescriptionFromIntake(intake),
            requirements: intake.application.requirements ?? [],
            compensationText: intake.application.compensationText ?? null,
            fitHypothesis: null,
            risks: intake.application.risks ?? [],
            questionsToAsk: intake.application.questionsToAsk ?? [],
          });
        }

        const application = this.getApplication(appId) as ApplicationDetail;
        const legacyInterview = this.get(legacyId, ['dossier', 'prep', 'retros', 'questions', 'meetings']);
        return { application, legacyInterview };
      });
    });
  }

  update(id: string, patch: InterviewUpdatePatch): InterviewEvent | null {
    const columns: Record<string, unknown> = {};
    const map: Array<[keyof InterviewUpdatePatch, string]> = [
      ['title', 'title'],
      ['company', 'company'],
      ['roleTitle', 'role_title'],
      ['stage', 'stage'],
      ['status', 'status'],
      ['priority', 'priority'],
      ['source', 'source'],
      ['vacancyUrl', 'vacancy_url'],
      ['meetingUrl', 'meeting_url'],
      ['startsAt', 'starts_at'],
      ['endsAt', 'ends_at'],
      ['timezone', 'timezone'],
      ['rawSourceText', 'raw_source_text'],
      ['calendarProvider', 'calendar_provider'],
      ['calendarId', 'calendar_id'],
      ['calendarEventId', 'calendar_event_id'],
      ['calendarLastSeenAt', 'calendar_last_seen_at'],
      ['calendarMissingSince', 'calendar_missing_since'],
      ['calendarSyncStatus', 'calendar_sync_status'],
    ];
    for (const [key, column] of map) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        columns[column] = (patch as any)[key] ?? null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarSnapshot')) {
      columns.calendar_snapshot_json = patch.calendarSnapshot ? JSON.stringify(patch.calendarSnapshot) : null;
    }
    const timestamp = nowIso();
    columns.updated_at = timestamp;
    const names = Object.keys(columns);
    if (names.length === 0) return this.get(id);
    const result = this.db.prepare(`
      UPDATE interview_events
      SET ${names.map(name => `${name} = ?`).join(', ')}
      WHERE id = ?
    `).run(...names.map(name => columns[name]), id);
    if (result.changes > 0 && Object.prototype.hasOwnProperty.call(patch, 'status')) {
      const map = this.db
        .prepare('SELECT application_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
        .get<{ application_id?: string | null }>(id);
      if (map?.application_id) {
        this.db.prepare(`
          UPDATE applications
          SET status = ?, updated_at = ?
          WHERE id = ? AND archived_at IS NULL
        `).run(applicationStatusFromInterviewStatus(patch.status as InterviewEvent['status']), timestamp, map.application_id);
      }
    }
    return this.get(id);
  }

  updateStageCalendarForLegacyInterview(legacyInterviewId: string, patch: InterviewUpdatePatch): InterviewStage | null {
    const map = this.db
      .prepare('SELECT stage_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
      .get<{ stage_id?: string | null }>(legacyInterviewId);
    if (!map?.stage_id) return null;
    const columns: Record<string, unknown> = {};
    const calendarMap: Array<[keyof InterviewUpdatePatch, string]> = [
      ['calendarProvider', 'calendar_provider'],
      ['calendarId', 'calendar_id'],
      ['calendarEventId', 'calendar_event_id'],
      ['calendarLastSeenAt', 'calendar_last_seen_at'],
      ['calendarMissingSince', 'calendar_missing_since'],
      ['calendarSyncStatus', 'calendar_sync_status'],
    ];
    for (const [key, column] of calendarMap) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        columns[column] = (patch as any)[key] ?? null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'calendarSnapshot')) {
      columns.calendar_snapshot_json = patch.calendarSnapshot ? JSON.stringify(patch.calendarSnapshot) : null;
    }
    columns.updated_at = nowIso();
    const names = Object.keys(columns);
    this.db.prepare(`
      UPDATE interview_stages
      SET ${names.map(name => `${name} = ?`).join(', ')}
      WHERE id = ?
    `).run(...names.map(name => columns[name]), map.stage_id);
    const row = this.db.prepare('SELECT * FROM interview_stages WHERE id = ?').get<any>(map.stage_id);
    return row ? stageFromRow(row) : null;
  }

  updateCalendarForLegacyInterview(legacyInterviewId: string, patch: InterviewUpdatePatch): InterviewEvent | null {
    return this.db.transaction(() => {
      const updated = this.update(legacyInterviewId, patch);
      if (!updated) return null;
      this.updateStageCalendarForLegacyInterview(legacyInterviewId, patch);
      return updated;
    });
  }

  archive(id: string): boolean {
    const timestamp = nowIso();
    const result = this.db
      .prepare('UPDATE interview_events SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL')
      .run(timestamp, timestamp, id);
    if (result.changes > 0) {
      const map = this.db
        .prepare('SELECT application_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
        .get<{ application_id?: string | null }>(id);
      if (map?.application_id) {
        this.db.prepare(`
          UPDATE applications
          SET archived_at = COALESCE(archived_at, ?), status = 'archived', updated_at = ?
          WHERE id = ?
        `).run(timestamp, timestamp, map.application_id);
      }
    }
    return result.changes > 0;
  }

  clearArchivedApplications(): ClearArchivedApplicationsResult {
    return this.db.transaction(() => {
      const archivedApplications = this.db.prepare(`
        SELECT id, legacy_interview_event_id
        FROM applications
        WHERE archived_at IS NOT NULL OR status = 'archived'
      `).all<{ id: string; legacy_interview_event_id?: string | null }>();
      const applicationIds = uniqueStrings(archivedApplications.map(row => row.id));
      const applicationLegacyIds = uniqueStrings(archivedApplications.map(row => row.legacy_interview_event_id));
      const applicationPlaceholders = applicationIds.length > 0 ? placeholders(applicationIds) : '';

      const stageIds = applicationIds.length > 0
        ? this.db.prepare(`
          SELECT id
          FROM interview_stages
          WHERE application_id IN (${applicationPlaceholders})
        `).all<{ id: string }>(...applicationIds).map(row => row.id)
        : [];
      const mappedLegacyIds = applicationIds.length > 0
        ? this.db.prepare(`
          SELECT legacy_interview_event_id
          FROM legacy_interview_event_map
          WHERE application_id IN (${applicationPlaceholders})
        `).all<{ legacy_interview_event_id?: string | null }>(...applicationIds).map(row => row.legacy_interview_event_id)
        : [];
      const legacyEventIds = uniqueStrings([
        ...applicationLegacyIds,
        ...mappedLegacyIds,
      ]);

      const detachLinkedRows = (table: string): number => {
        const setParts: string[] = [];
        const setParams: unknown[] = [];
        const whereParts: string[] = [];
        const whereParams: unknown[] = [];

        if (legacyEventIds.length > 0) {
          const sql = placeholders(legacyEventIds);
          setParts.push(`interview_event_id = CASE WHEN interview_event_id IN (${sql}) THEN NULL ELSE interview_event_id END`);
          setParams.push(...legacyEventIds);
          whereParts.push(`interview_event_id IN (${sql})`);
          whereParams.push(...legacyEventIds);
        }
        if (stageIds.length > 0) {
          const sql = placeholders(stageIds);
          setParts.push(`interview_stage_id = CASE WHEN interview_stage_id IN (${sql}) THEN NULL ELSE interview_stage_id END`);
          setParams.push(...stageIds);
          whereParts.push(`interview_stage_id IN (${sql})`);
          whereParams.push(...stageIds);
        }
        if (applicationIds.length > 0) {
          const sql = placeholders(applicationIds);
          setParts.push(`application_id = CASE WHEN application_id IN (${sql}) THEN NULL ELSE application_id END`);
          setParams.push(...applicationIds);
          whereParts.push(`application_id IN (${sql})`);
          whereParams.push(...applicationIds);
        }
        if (setParts.length === 0 || whereParts.length === 0) return 0;
        return this.db.prepare(`
          UPDATE ${table}
          SET ${setParts.join(', ')}
          WHERE ${whereParts.join(' OR ')}
        `).run(...setParams, ...whereParams).changes;
      };

      const meetingsDetached = detachLinkedRows('meetings');
      detachLinkedRows('interview_retro_evaluations');

      if (legacyEventIds.length > 0) {
        const eventSql = placeholders(legacyEventIds);
        for (const table of [
          'interview_contacts',
          'retro_prompt_state',
          'interview_questions',
          'interview_retros',
          'prep_briefs',
          'vacancy_dossiers',
        ]) {
          this.db.prepare(`DELETE FROM ${table} WHERE interview_event_id IN (${eventSql})`).run(...legacyEventIds);
        }
        this.db.prepare(`DELETE FROM legacy_interview_event_map WHERE legacy_interview_event_id IN (${eventSql})`).run(...legacyEventIds);
      }

      let stagesDeleted = 0;
      let applicationsDeleted = 0;
      if (applicationIds.length > 0) {
        stagesDeleted = this.db.prepare(`
          DELETE FROM interview_stages
          WHERE application_id IN (${applicationPlaceholders})
        `).run(...applicationIds).changes;
        this.db.prepare(`
          DELETE FROM legacy_interview_event_map
          WHERE application_id IN (${applicationPlaceholders})
        `).run(...applicationIds);
        applicationsDeleted = this.db.prepare(`
          DELETE FROM applications
          WHERE id IN (${applicationPlaceholders})
        `).run(...applicationIds).changes;
      }

      const legacyEventsDeleted = legacyEventIds.length > 0
        ? this.db.prepare(`
          DELETE FROM interview_events
          WHERE id IN (${placeholders(legacyEventIds)})
        `).run(...legacyEventIds).changes
        : 0;

      return {
        applicationsDeleted,
        stagesDeleted,
        legacyEventsDeleted,
        meetingsDetached,
      };
    });
  }

  hardDelete(id: string, includeLinkedMeetings = false): boolean {
    return this.db.transaction(() => {
      if (includeLinkedMeetings) {
        const map = this.db
          .prepare('SELECT application_id, stage_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
          .get<{ application_id?: string | null; stage_id?: string | null }>(id);
        this.db.prepare(`
          DELETE FROM meetings
          WHERE interview_event_id = ?
             OR (? IS NOT NULL AND interview_stage_id = ?)
             OR (? IS NOT NULL AND application_id = ?)
        `).run(id, map?.stage_id ?? null, map?.stage_id ?? null, map?.application_id ?? null, map?.application_id ?? null);
      } else {
        const map = this.db
          .prepare('SELECT application_id, stage_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
          .get<{ application_id?: string | null; stage_id?: string | null }>(id);
        this.db.prepare(`
          UPDATE meetings
          SET interview_event_id = NULL,
              interview_stage_id = CASE WHEN interview_stage_id = ? THEN NULL ELSE interview_stage_id END,
              application_id = CASE WHEN application_id = ? THEN NULL ELSE application_id END
          WHERE interview_event_id = ?
             OR (? IS NOT NULL AND interview_stage_id = ?)
             OR (? IS NOT NULL AND application_id = ?)
        `).run(
          map?.stage_id ?? null,
          map?.application_id ?? null,
          id,
          map?.stage_id ?? null,
          map?.stage_id ?? null,
          map?.application_id ?? null,
          map?.application_id ?? null,
        );
      }
      this.db.prepare('DELETE FROM interview_contacts WHERE interview_event_id = ?').run(id);
      this.db.prepare('DELETE FROM retro_prompt_state WHERE interview_event_id = ?').run(id);
      this.db.prepare('DELETE FROM interview_questions WHERE interview_event_id = ?').run(id);
      this.db.prepare('DELETE FROM interview_retros WHERE interview_event_id = ?').run(id);
      this.db.prepare('DELETE FROM prep_briefs WHERE interview_event_id = ?').run(id);
      this.db.prepare('DELETE FROM vacancy_dossiers WHERE interview_event_id = ?').run(id);
      const result = this.db.prepare('DELETE FROM interview_events WHERE id = ?').run(id);
      return result.changes > 0;
    });
  }

  attachMeeting(interviewId: string, meetingId: string): boolean {
    return this.db.transaction(() => {
      const interview = this.db.prepare('SELECT id FROM interview_events WHERE id = ? AND archived_at IS NULL').get(interviewId);
      if (!interview) return false;
      const map = this.db
        .prepare('SELECT application_id, stage_id FROM legacy_interview_event_map WHERE legacy_interview_event_id = ?')
        .get<{ application_id?: string | null; stage_id?: string | null }>(interviewId);
      const result = this.db.prepare(`
        UPDATE meetings
        SET interview_event_id = ?,
            interview_stage_id = COALESCE(?, interview_stage_id),
            application_id = COALESCE(?, application_id)
        WHERE id = ?
      `).run(interviewId, map?.stage_id ?? null, map?.application_id ?? null, meetingId);
      return result.changes > 0;
    });
  }

  attachMeetingToStage(stageId: string, meetingId: string): boolean {
    return this.db.transaction(() => {
      const stage = this.db.prepare(`
        SELECT stage.id, stage.application_id, stage.legacy_interview_event_id, event.archived_at AS legacy_archived_at
        FROM interview_stages stage
        LEFT JOIN interview_events event ON event.id = stage.legacy_interview_event_id
        WHERE stage.id = ?
          AND stage.archived_at IS NULL
      `).get<{
        id: string;
        application_id: string;
        legacy_interview_event_id?: string | null;
        legacy_archived_at?: string | null;
      }>(stageId);
      if (!stage) return false;
      const legacyInterviewId = stage.legacy_interview_event_id && !stage.legacy_archived_at
        ? stage.legacy_interview_event_id
        : null;
      const result = this.db.prepare(`
        UPDATE meetings
        SET interview_event_id = ?,
            interview_stage_id = ?,
            application_id = ?
        WHERE id = ?
      `).run(legacyInterviewId, stage.id, stage.application_id, meetingId);
      return result.changes > 0;
    });
  }

  saveDossier(interviewId: string, payload: VacancyDossierPayload, operationId?: string): VacancyDossier {
    return this.withOperation(operationId, 'vacancy-dossiers:save', () => {
      const id = `dossier_${interviewId}`;
      const timestamp = nowIso();
      this.db.prepare(`
        INSERT INTO vacancy_dossiers (
          id, interview_event_id, description, requirements_json, compensation_text,
          fit_hypothesis, risks_json, questions_to_ask_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(interview_event_id) DO UPDATE SET
          description = excluded.description,
          requirements_json = excluded.requirements_json,
          compensation_text = excluded.compensation_text,
          fit_hypothesis = excluded.fit_hypothesis,
          risks_json = excluded.risks_json,
          questions_to_ask_json = excluded.questions_to_ask_json,
          updated_at = excluded.updated_at
      `).run(
        id,
        interviewId,
        payload.description ?? null,
        toJson(payload.requirements),
        payload.compensationText ?? null,
        payload.fitHypothesis ?? null,
        toJson(payload.risks),
        toJson(payload.questionsToAsk),
        timestamp,
        timestamp,
      );
      const row = this.db.prepare('SELECT * FROM vacancy_dossiers WHERE interview_event_id = ?').get<any>(interviewId);
      return dossierFromRow(row);
    });
  }

  savePrep(interviewId: string, payload: PrepBriefPayload, operationId?: string): PrepBrief {
    return this.withOperation(operationId, 'prep-briefs:save', () => {
      const id = `prep_${interviewId}`;
      this.db.prepare(`
        INSERT INTO prep_briefs (
          id, interview_event_id, one_line_goal, pitch_30s, pitch_2m,
          expected_topics_json, cheatsheet, risk_handling_json, last_checklist_json, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(interview_event_id) DO UPDATE SET
          one_line_goal = excluded.one_line_goal,
          pitch_30s = excluded.pitch_30s,
          pitch_2m = excluded.pitch_2m,
          expected_topics_json = excluded.expected_topics_json,
          cheatsheet = excluded.cheatsheet,
          risk_handling_json = excluded.risk_handling_json,
          last_checklist_json = excluded.last_checklist_json,
          updated_at = excluded.updated_at
      `).run(
        id,
        interviewId,
        payload.oneLineGoal ?? null,
        payload.pitch30s ?? null,
        payload.pitch2m ?? null,
        toJson(payload.expectedTopics),
        payload.cheatsheet ?? null,
        toJson(payload.riskHandling),
        toJson(payload.lastChecklist),
        nowIso(),
      );
      const row = this.db.prepare('SELECT * FROM prep_briefs WHERE interview_event_id = ?').get<any>(interviewId);
      return prepFromRow(row);
    });
  }

  saveRetro(interviewId: string, payload: InterviewRetroPayload, operationId?: string): InterviewRetro {
    return this.withOperation(operationId, 'interview-retros:save', () => {
      const id = newId('retro');
      this.db.prepare(`
        INSERT INTO interview_retros (
          id, interview_event_id, pass_probability, main_signal,
          strong_moments_json, weak_moments_json, new_facts_json, follow_up_actions_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        interviewId,
        payload.passProbability ?? null,
        payload.mainSignal ?? null,
        toJson(payload.strongMoments),
        toJson(payload.weakMoments),
        toJson(payload.newFacts),
        toJson(payload.followUpActions),
        nowIso(),
      );
      const row = this.db.prepare('SELECT * FROM interview_retros WHERE id = ?').get<any>(id);
      const retro = retroFromRow(row);
      this.recordRetroPromptAction(interviewId, 'complete');
      return retro;
    });
  }

  getLatestRetroEvaluation(interviewId: string): InterviewRetroEvaluation | null {
    const row = this.db.prepare(`
      WITH map AS (
        SELECT application_id, stage_id
        FROM legacy_interview_event_map
        WHERE legacy_interview_event_id = ?
      )
      SELECT DISTINCT ev.*
      FROM interview_retro_evaluations ev
      JOIN meetings m ON m.id = ev.meeting_id
      LEFT JOIN map ON 1 = 1
      WHERE ev.is_active = 1
        AND (
          ev.interview_event_id = ?
          OR m.interview_event_id = ?
          OR (map.stage_id IS NOT NULL AND (ev.interview_stage_id = map.stage_id OR m.interview_stage_id = map.stage_id))
          OR (map.application_id IS NOT NULL AND (ev.application_id = map.application_id OR m.application_id = map.application_id))
        )
      ORDER BY CASE WHEN ev.status = 'ready' THEN 0 ELSE 1 END, ev.created_at DESC
      LIMIT 1
    `).get<any>(interviewId, interviewId, interviewId);
    return row ? retroEvaluationFromRow(row) : null;
  }

  getLatestLinkedMeetingTranscript(interviewId: string): LinkedMeetingTranscript | null {
    const meeting = this.db.prepare(`
      WITH map AS (
        SELECT application_id, stage_id
        FROM legacy_interview_event_map
        WHERE legacy_interview_event_id = ?
      )
      SELECT DISTINCT
        m.id, m.title, m.created_at AS date, m.duration_ms,
        m.calendar_event_id, m.interview_event_id, m.interview_stage_id, m.application_id
      FROM meetings m
      LEFT JOIN map ON 1 = 1
      WHERE (
          m.interview_event_id = ?
          OR (map.stage_id IS NOT NULL AND m.interview_stage_id = map.stage_id)
          OR (map.application_id IS NOT NULL AND m.application_id = map.application_id)
        )
        AND EXISTS (
          SELECT 1
          FROM transcripts t
          WHERE t.meeting_id = m.id AND length(trim(t.content)) > 0
        )
      ORDER BY m.start_time DESC
      LIMIT 1
    `).get<any>(interviewId, interviewId);
    if (!meeting) return null;
    const transcriptRows = this.db.prepare(`
      SELECT speaker, content, timestamp_ms
      FROM transcripts
      WHERE meeting_id = ?
      ORDER BY timestamp_ms ASC
    `).all<any>(meeting.id);
    const transcriptText = transcriptRows
      .map(row => `${row.speaker || 'Speaker'}: ${String(row.content ?? '').trim()}`)
      .filter(line => line.trim().length > 0)
      .join('\n');
    if (!transcriptText.trim()) return null;
    return {
      meeting: linkedMeetingFromRow(meeting),
      transcriptText,
      applicationId: meeting.application_id ?? null,
      interviewStageId: meeting.interview_stage_id ?? null,
      interviewEventId: meeting.interview_event_id ?? interviewId,
    };
  }

  saveRetroEvaluation(payload: {
    applicationId?: string | null;
    interviewStageId?: string | null;
    interviewEventId?: string | null;
    meetingId: string;
    status: InterviewRetroEvaluation['status'];
    modelId?: string | null;
    summary?: string | null;
    signals?: string[];
    risks?: string[];
    followups?: string[];
    confidence?: number | null;
    error?: string | null;
  }): InterviewRetroEvaluation {
    return this.db.transaction(() => {
      const now = nowIso();
      this.db.prepare(`
        UPDATE interview_retro_evaluations
        SET is_active = 0, superseded_at = ?, updated_at = ?
        WHERE meeting_id = ? AND is_active = 1
      `).run(now, now, payload.meetingId);
      const id = newId('retro_eval');
      this.db.prepare(`
        INSERT INTO interview_retro_evaluations (
          id, application_id, interview_stage_id, interview_event_id, meeting_id,
          status, model_id, summary, signals_json, risks_json, followups_json,
          confidence, error, is_active, superseded_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)
      `).run(
        id,
        payload.applicationId ?? null,
        payload.interviewStageId ?? null,
        payload.interviewEventId ?? null,
        payload.meetingId,
        payload.status,
        payload.modelId ?? null,
        payload.summary ?? null,
        toJson(payload.signals),
        toJson(payload.risks),
        toJson(payload.followups),
        payload.confidence ?? null,
        payload.error ?? null,
        now,
        now,
      );
      const row = this.db.prepare('SELECT * FROM interview_retro_evaluations WHERE id = ?').get<any>(id);
      return retroEvaluationFromRow(row);
    });
  }

  getRetroPromptState(interviewId: string): RetroPromptState | null {
    const row = this.db.prepare('SELECT * FROM retro_prompt_state WHERE interview_event_id = ?').get<any>(interviewId);
    return row ? retroPromptStateFromRow(row) : null;
  }

  recordRetroPromptAction(
    interviewId: string,
    action: RetroPromptAction,
    options: { now?: number; snoozeUntil?: number | null } = {},
  ): RetroPromptState {
    const timestamp = options.now ?? nowMs();
    const existing = this.getRetroPromptState(interviewId);
    const next = {
      promptedAt: existing?.promptedAt ?? null,
      dismissedAt: existing?.dismissedAt ?? null,
      snoozedUntil: existing?.snoozedUntil ?? null,
      completedAt: existing?.completedAt ?? null,
    };

    if (action === 'prompted') next.promptedAt = next.promptedAt ?? timestamp;
    if (action === 'snooze') {
      next.promptedAt = next.promptedAt ?? timestamp;
      next.snoozedUntil = options.snoozeUntil ?? timestamp + 24 * 60 * 60 * 1000;
      next.dismissedAt = null;
    }
    if (action === 'dismiss') {
      next.promptedAt = next.promptedAt ?? timestamp;
      next.dismissedAt = next.dismissedAt ?? timestamp;
      next.snoozedUntil = null;
    }
    if (action === 'complete') {
      next.promptedAt = next.promptedAt ?? timestamp;
      next.completedAt = next.completedAt ?? timestamp;
      next.snoozedUntil = null;
    }

    this.db.prepare(`
      INSERT INTO retro_prompt_state (
        interview_event_id, prompted_at, dismissed_at, snoozed_until, completed_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(interview_event_id) DO UPDATE SET
        prompted_at = excluded.prompted_at,
        dismissed_at = excluded.dismissed_at,
        snoozed_until = excluded.snoozed_until,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `).run(
      interviewId,
      next.promptedAt,
      next.dismissedAt,
      next.snoozedUntil,
      next.completedAt,
      nowIso(),
    );

    return this.getRetroPromptState(interviewId) as RetroPromptState;
  }

  listQuestions(input: { interviewId?: string; limit?: number; offset?: number } = {}): InterviewQuestion[] {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const offset = Math.max(input.offset ?? 0, 0);
    if (input.interviewId) {
      return this.db
        .prepare('SELECT * FROM interview_questions WHERE interview_event_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all<any>(input.interviewId, limit, offset)
        .map(questionFromRow);
    }
    return this.db
      .prepare('SELECT * FROM interview_questions ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all<any>(limit, offset)
      .map(questionFromRow);
  }

  saveQuestions(interviewId: string, questions: InterviewQuestionPayload[], operationId?: string): InterviewQuestion[] {
    return this.withOperation(operationId, 'interview-questions:save', () => {
      return this.db.transaction(() => {
        const saved: InterviewQuestion[] = [];
        for (const question of questions) {
          const id = question.id || newId('question');
          this.db.prepare(`
            INSERT INTO interview_questions (
              id, interview_event_id, question_text, category, quality, weak_spot, follow_up_note, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              question_text = excluded.question_text,
              category = excluded.category,
              quality = excluded.quality,
              weak_spot = excluded.weak_spot,
              follow_up_note = excluded.follow_up_note
          `).run(
            id,
            interviewId,
            question.questionText,
            question.category ?? null,
            question.quality ?? null,
            question.weakSpot ? 1 : 0,
            question.followUpNote ?? null,
            nowIso(),
          );
          const row = this.db.prepare('SELECT * FROM interview_questions WHERE id = ?').get<any>(id);
          saved.push(questionFromRow(row));
        }
        return saved;
      });
    });
  }

  private withOperation<T>(operationId: string | undefined, action: string, fn: () => T): T {
    if (!operationId) return fn();

    const existing = this.db
      .prepare('SELECT result_json FROM interview_client_operations WHERE operation_id = ? AND action = ?')
      .get<{ result_json: string }>(operationId, action);
    if (existing) return JSON.parse(existing.result_json) as T;

    return this.db.transaction(() => {
      const result = fn();
      this.db.prepare(`
        INSERT OR REPLACE INTO interview_client_operations (operation_id, action, result_json, created_at)
        VALUES (?, ?, ?, ?)
      `).run(operationId, action, JSON.stringify(result), nowMs());
      return result;
    });
  }
}
