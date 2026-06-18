import crypto from 'crypto';
import type {
  ApplicationCreateFromIntakeResult,
  ApplicationDetail,
  ApplicationIntakeResult,
  ApplicationStatus,
  InterviewStage,
  InterviewStageStatus,
  InterviewStageType,
  InterviewCreatePayload,
  InterviewDetail,
  InterviewEvent,
  InterviewListInput,
  InterviewListItem,
  InterviewQuestion,
  InterviewQuestionPayload,
  InterviewRetro,
  InterviewRetroPayload,
  RetroPromptAction,
  RetroPromptState,
  InterviewUpdatePatch,
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
      LEFT JOIN meetings m ON m.interview_event_id = e.id
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
    }
    if (include.includes('questions')) {
      detail.questions = this.listQuestions({ interviewId: id });
    }
    if (include.includes('meetings')) {
      detail.linkedMeetings = this.db
        .prepare('SELECT id, title, created_at AS date, duration_ms FROM meetings WHERE interview_event_id = ? ORDER BY start_time DESC')
        .all<any>(id)
        .map(row => ({
          id: row.id,
          title: row.title,
          date: row.date,
          duration: String(row.duration_ms ?? 0),
        }));
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

  listApplications(): ApplicationDetail[] {
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
      WHERE a.archived_at IS NULL
      ORDER BY a.updated_at DESC
      LIMIT 200
    `).all<any>();
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
    return application;
  }

  listStages(applicationId: string): InterviewStage[] {
    return this.db.prepare(`
      SELECT *
      FROM interview_stages
      WHERE application_id = ?
      ORDER BY
        CASE WHEN starts_at IS NULL THEN 1 ELSE 0 END,
        starts_at ASC,
        updated_at DESC
    `).all<any>(applicationId).map(stageFromRow);
  }

  createApplicationFromIntake(
    intake: ApplicationIntakeResult,
    operationId?: string,
  ): ApplicationCreateFromIntakeResult {
    return this.withOperation(operationId, 'applications:create-from-intake', () => {
      return this.db.transaction(() => {
        const timestamp = nowIso();
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

        if (intake.application.requirements?.length || intake.application.risks?.length || intake.application.questionsToAsk?.length || intake.application.compensationText) {
          this.saveDossier(legacyId, {
            description: intake.application.rawSourceText,
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
    columns.updated_at = nowIso();
    const names = Object.keys(columns);
    if (names.length === 0) return this.get(id);
    this.db.prepare(`
      UPDATE interview_events
      SET ${names.map(name => `${name} = ?`).join(', ')}
      WHERE id = ?
    `).run(...names.map(name => columns[name]), id);
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
    const result = this.db
      .prepare('UPDATE interview_events SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL')
      .run(nowIso(), nowIso(), id);
    return result.changes > 0;
  }

  hardDelete(id: string, includeLinkedMeetings = false): boolean {
    return this.db.transaction(() => {
      if (includeLinkedMeetings) {
        this.db.prepare('DELETE FROM meetings WHERE interview_event_id = ?').run(id);
      } else {
        this.db.prepare('UPDATE meetings SET interview_event_id = NULL WHERE interview_event_id = ?').run(id);
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
      const result = this.db.prepare('UPDATE meetings SET interview_event_id = ? WHERE id = ?').run(interviewId, meetingId);
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
