import crypto from 'node:crypto';
import type {
  ApplicationDetail,
  InterviewStage,
  PrepBrief,
  PrepBriefPayload,
  ReadinessResult,
  StageArtifactStatus,
  StageNextAction,
  StageReviewSummary,
  StageSessionSummary,
  StageWorkspaceSessionStatus,
  StageWorkspaceSnapshot,
  StageWorkspaceExportFormat,
  StageWorkspaceExportResult,
  StageWorkspaceStatus,
  InterviewErrorCode,
} from '../../../src/types/interviews';
import { InterviewDomainError, normalizeStageUpdatePatch } from './InterviewService';
import type { DbExecutor } from './InterviewRepository';
import { InterviewRepository } from './InterviewRepository';

type StageWorkspaceContext = {
  confirmed?: boolean;
  sourceText?: string | null;
  providerRoutes?: Record<string, unknown>;
  redactionVersion?: string;
};

export type StageWorkspaceReadinessProvider = (
  stage: InterviewStage,
  contextReady: boolean,
) => ReadinessResult;

type StageSessionRow = {
  meeting_id: string;
  operation_id?: string | null;
  interview_stage_id: string;
  status: Exclude<StageWorkspaceSessionStatus, 'none'>;
  started_at?: number | null;
  stopped_at?: number | null;
  heartbeat_at?: number | null;
  stop_requested_at?: number | null;
  stop_operation_id?: string | null;
  failure_code?: string | null;
  revision: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sourceHash(sourceText: string | null): string | null {
  return sourceText ? crypto.createHash('sha256').update(sourceText).digest('hex') : null;
}

function artifactStatus(value: unknown): StageArtifactStatus {
  return value === 'pending' || value === 'ready' || value === 'failed' || value === 'skipped' || value === 'cancelled'
    ? value
    : 'not_requested';
}

function emptyArtifacts(): Record<'transcript' | 'summary' | 'aiReview', StageArtifactStatus> {
  return { transcript: 'not_requested', summary: 'not_requested', aiReview: 'not_requested' };
}

function stageSessionStatus(row: StageSessionRow, db: DbExecutor): StageSessionSummary {
  const artifacts = emptyArtifacts();
  const artifactOperationIds: Partial<Record<'transcript' | 'summary' | 'aiReview', string>> = {};
  const rows = db.prepare(`
    SELECT a.artifact_type, a.status, j.request_json
    FROM stage_session_artifacts a
    LEFT JOIN stage_artifact_jobs j ON j.meeting_id = a.meeting_id AND j.artifact_type = a.artifact_type
    WHERE a.meeting_id = ?
  `).all<{ artifact_type: string; status: string; request_json?: string | null }>(row.meeting_id);
  for (const artifact of rows) {
    if (artifact.artifact_type === 'transcript' || artifact.artifact_type === 'summary') {
      artifacts[artifact.artifact_type] = artifactStatus(artifact.status);
    } else if (artifact.artifact_type === 'ai_review') {
      artifacts.aiReview = artifactStatus(artifact.status);
    }
    if (artifact.request_json) {
      try {
        const operationId = (JSON.parse(artifact.request_json) as { operationId?: unknown }).operationId;
        const key = artifact.artifact_type === 'ai_review' ? 'aiReview' : artifact.artifact_type as 'transcript' | 'summary';
        if (typeof operationId === 'string' && operationId) artifactOperationIds[key] = operationId;
      } catch {
        // Older rows contain opaque request JSON without an operation handle.
      }
    }
  }
  return {
    meetingId: row.meeting_id,
    interviewStageId: row.interview_stage_id,
    status: row.status,
    startedAt: row.started_at ?? null,
    stoppedAt: row.stopped_at ?? null,
    heartbeatAt: row.heartbeat_at ?? null,
    stopRequestedAt: row.stop_requested_at ?? null,
    stopOperationId: row.stop_operation_id ?? null,
    failureCode: row.failure_code ?? null,
    revision: Number(row.revision ?? 0),
    artifacts,
    artifactOperationIds,
  };
}

function hasPreparation(prep: PrepBrief | null): boolean {
  return Boolean(prep?.oneLineGoal || prep?.pitch30s || prep?.pitch2m || prep?.cheatsheet || prep?.expectedTopics?.length);
}

function isPreparationReady(prep: PrepBrief | null): boolean {
  return Boolean(prep?.oneLineGoal && (prep.cheatsheet || prep.expectedTopics?.length));
}

function stageReviewExists(db: DbExecutor, stageId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM stage_reviews WHERE interview_stage_id = ? LIMIT 1').get(stageId));
}

function sanitizeProviderRoutes(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const blocked = /(api[_-]?key|authorization|bearer|token|secret|password|credential)/i;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.test(key)) continue;
    if (item && typeof item === 'object' && !Array.isArray(item)) result[key] = sanitizeProviderRoutes(item);
    else if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) result[key] = item;
  }
  return result;
}

export class StageWorkspaceService {
  constructor(
    private readonly repo: InterviewRepository,
    private readonly db: DbExecutor,
    private readonly readinessProvider?: StageWorkspaceReadinessProvider,
  ) {}

  getStageWorkspace(stageId: string): StageWorkspaceSnapshot {
    const stage = this.repo.getStage(stageId);
    if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
    const application = this.repo.getApplication(stage.applicationId);
    if (!application) throw new InterviewDomainError('not_found', 'Owning application not found.', false, 'none');

    const legacyId = stage.legacyInterviewEventId;
    const legacy = legacyId ? this.repo.get(legacyId, ['prep']) : null;
    const preparation = legacy?.prep ?? null;
    const rows = this.db.prepare(`
      SELECT meeting_id, interview_stage_id, status, started_at, stopped_at,
             heartbeat_at, stop_requested_at, stop_operation_id, failure_code, revision
      FROM stage_sessions
      WHERE interview_stage_id = ?
      ORDER BY created_at ASC
    `).all<StageSessionRow>(stageId);
    const sessions = rows.map(row => stageSessionStatus(row, this.db));
    const primarySessionId = stage.primarySessionMeetingId ?? null;
    const primarySession = sessions.find(session => session.meetingId === primarySessionId) ?? null;
    const activeSession = sessions.find(session => ['initializing', 'recording', 'stopping'].includes(session.status)) ?? null;
    const latestSession = sessions[sessions.length - 1] ?? null;

    const reviewRow = this.db.prepare(`
      SELECT meeting_id, status, review_json, created_at, updated_at
      FROM stage_reviews
      WHERE interview_stage_id = ?
    `).get<any>(stageId);
    const review: StageReviewSummary | null = reviewRow ? {
      meetingId: reviewRow.meeting_id,
      status: reviewRow.status,
      review: JSON.parse(reviewRow.review_json),
      createdAt: reviewRow.created_at,
      updatedAt: reviewRow.updated_at,
    } : null;

    const nextAction: StageNextAction = {
      text: stage.nextAction ?? null,
      dueAt: stage.nextActionDueAt ?? null,
      state: stage.nextActionState ?? 'missing',
      completedAt: stage.nextActionCompletedAt ?? null,
    };
    const contextText = stage.rawSourceText ?? application.rawSourceText ?? null;
    const contextReady = Boolean(contextText?.trim());
    const fallbackReadiness: ReadinessResult = {
      score: contextReady ? 100 : 0,
      level: contextReady ? 'ready' : 'not_started',
      blockers: contextReady ? [] : ['stage_context_missing'],
      warnings: [],
      completed: contextReady ? ['stage_context'] : [],
      nextAction: contextReady ? null : 'Add the recruiter or stage context.',
    };
    const readiness = this.readinessProvider
      ? this.readinessProvider(stage, contextReady)
      : fallbackReadiness;
    const status = this.deriveStatus({ stage, preparation, contextReady, readiness, sessions, primarySession, activeSession, latestSession, review, nextAction });
    const primaryArtifacts = primarySession?.artifacts ?? null;
    return {
      schemaVersion: 1,
      stageId,
      revision: Number(stage.workspaceRevision ?? 0),
      application,
      stage,
      context: { sourceText: contextText, sourceHash: sourceHash(contextText), confirmed: contextReady },
      preparation,
      readiness,
      sessions,
      primarySessionId,
      activeSession,
      primaryArtifacts,
      review,
      nextAction,
      status,
      capabilities: {
        canPrepare: Boolean(legacyId),
        canStart: readiness.level === 'ready' && !activeSession,
        canStop: Boolean(activeSession),
        canReview: Boolean(primarySession?.artifacts.transcript === 'ready' || primarySession?.status === 'stopped'),
        canSetNextAction: true,
      },
    };
  }

  ensureStageBackingRecord(stageId: string, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      this.assertRevision(stageId, expectedRevision);
      const before = this.repo.getStage(stageId);
      if (!before) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      const legacyId = this.repo.ensureStageBackingRecord(stageId);
      if (!legacyId) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (!before.legacyInterviewEventId) this.bumpRevision(stageId);
      return this.getStageWorkspace(stageId);
    });
  }

  /** Update editable stage metadata through the workspace revision boundary. */
  updateStageDetails(
    stageId: string,
    patch: Record<string, unknown>,
    expectedRevision?: number,
    operationId?: string,
  ): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const replay = this.beginOperation(operationId, 'updateStageDetails', { stageId, expectedRevision, patch }, stageId);
      if (replay) return replay;
      this.assertRevision(stageId, expectedRevision);
      const existing = this.repo.getStage(stageId);
      if (!existing) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      // Keep the workspace boundary as strict as the legacy service boundary:
      // callers cannot smuggle arbitrary columns or malformed calendar/time
      // values through the revision-aware mutation path.
      const updated = this.repo.updateStage(stageId, normalizeStageUpdatePatch(patch));
      if (!updated) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      this.bumpRevision(stageId);
      const result = this.getStageWorkspace(stageId);
      this.commitOperation(operationId, result);
      return result;
    });
  }

  /** Attach an existing recording only through the owning stage workspace. */
  attachMeeting(stageId: string, meetingId: string, expectedRevision?: number, operationId?: string): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const replay = this.beginOperation(operationId, 'attachMeeting', { stageId, meetingId, expectedRevision }, stageId);
      if (replay) return replay;
      this.assertRevision(stageId, expectedRevision);
      const stage = this.repo.getStage(stageId);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      const meeting = this.db.prepare('SELECT interview_stage_id FROM meetings WHERE id = ?').get<{ interview_stage_id?: string | null }>(meetingId);
      if (!meeting) throw new InterviewDomainError('not_found', 'Recording not found.', false, 'none');
      if (meeting.interview_stage_id && meeting.interview_stage_id !== stageId) {
        throw new InterviewDomainError('stage_conflict', 'That recording is already attached to another stage.', true, 'choose_stage');
      }
      if (!this.repo.attachMeetingToStage(stageId, meetingId)) {
        throw new InterviewDomainError('meeting_attach_failed', 'Could not attach that recording.', true, 'manual_attach');
      }
      this.bumpRevision(stageId);
      const result = this.getStageWorkspace(stageId);
      this.commitOperation(operationId, result);
      return result;
    });
  }

  createPreparationDraft(stageId: string, payload: PrepBriefPayload, expectedRevision?: number, operationId?: string): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const replay = this.beginOperation(operationId, 'createPreparationDraft', { stageId, expectedRevision, payload }, stageId);
      if (replay) return replay;
      this.assertRevision(stageId, expectedRevision);
      const stage = this.repo.getStage(stageId);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      const backing = this.repo.ensureStageBackingRecord(stageId);
      if (!backing) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      this.repo.savePrep(backing, payload, operationId);
      this.bumpRevision(stageId);
      const result = this.getStageWorkspace(stageId);
      this.commitOperation(operationId, result);
      return result;
    });
  }

  startStageSession(stageId: string, operationId: string, expectedRevision?: number, context: StageWorkspaceContext = {}): StageWorkspaceSnapshot {
    if (!operationId) throw new InterviewDomainError('invalid_payload', 'operationId is required.', false, 'fix_input');
    return this.db.transaction(() => {
      const replay = this.beginOperation(operationId, 'startStageSession', { stageId, expectedRevision, context }, stageId);
      if (replay) return replay;
      this.assertRevision(stageId, expectedRevision);
      const workspace = this.getStageWorkspace(stageId);
      if (!workspace.context.confirmed) {
        throw new InterviewDomainError('invalid_payload', 'Stage context must be confirmed before recording.', false, 'fix_input');
      }
      if (context.confirmed !== true) {
        throw new InterviewDomainError('invalid_payload', 'Confirm the selected stage context before recording.', false, 'fix_input');
      }
      if (workspace.readiness.level !== 'ready') {
        const candidateCode = workspace.readiness.blockers[0] || 'stage_readiness_blocked';
        const code: InterviewErrorCode = ['stt_not_configured', 'stt_probe_failed', 'provider_probe_timeout', 'microphone_permission_denied', 'system_audio_permission_denied', 'stage_readiness_blocked'].includes(candidateCode)
          ? candidateCode as InterviewErrorCode
          : 'stage_readiness_blocked';
        throw new InterviewDomainError(code, workspace.readiness.nextAction || 'Stage readiness checks must pass before recording.', true, 'retry');
      }
      if (workspace.activeSession) {
        throw new InterviewDomainError('operation_in_progress', 'Another stage recording is already active.', true, 'retry');
      }
      const timestamp = Date.now();
      const createdAt = nowIso();
      const meetingId = `meeting_${crypto.randomUUID()}`;
      const legacyId = this.repo.ensureStageBackingRecord(stageId);
      this.db.prepare(`
        INSERT INTO meetings (
          id, title, created_at, start_time, duration_ms, application_id,
          interview_stage_id, interview_event_id
        )
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
      `).run(meetingId, workspace.stage.title, createdAt, timestamp, workspace.stage.applicationId, stageId, legacyId);
      this.db.prepare(`
        INSERT INTO stage_sessions (
          meeting_id, operation_id, interview_stage_id, status, started_at, heartbeat_at,
          revision, created_at, updated_at
        )
        VALUES (?, ?, ?, 'initializing', ?, ?, 1, ?, ?)
      `).run(meetingId, operationId, stageId, timestamp, timestamp, createdAt, createdAt);
      this.db.prepare(`
        INSERT INTO stage_session_contexts (
          meeting_id, schema_version, snapshot_json, provider_routes_json,
          redaction_version, created_at
        )
        VALUES (?, 1, ?, ?, 'v1', ?)
      `).run(
        meetingId,
        JSON.stringify({
          schemaVersion: 1,
          application: { id: workspace.application.id, label: workspace.application.title },
          stage: { id: workspace.stage.id, label: workspace.stage.title },
          includedCategories: ['stage_context'],
          sources: [{
            sourceType: 'stage_context',
            updatedAt: workspace.stage.updatedAt ?? workspace.application.updatedAt ?? null,
            contentHash: sourceHash(context.sourceText ?? workspace.context.sourceText),
            content: context.sourceText ?? workspace.context.sourceText,
          }],
        }),
        JSON.stringify(sanitizeProviderRoutes(context.providerRoutes)),
        createdAt,
      );
      for (const artifactType of ['transcript', 'summary', 'ai_review']) {
        this.db.prepare(`
          INSERT INTO stage_session_artifacts (meeting_id, artifact_type, status, updated_at)
          VALUES (?, ?, 'not_requested', ?)
        `).run(meetingId, artifactType, createdAt);
        this.db.prepare(`
          INSERT INTO stage_artifact_jobs (
            meeting_id, artifact_type, status, request_json, created_at, updated_at
          ) VALUES (?, ?, 'blocked', ?, ?, ?)
        `).run(meetingId, artifactType, JSON.stringify({ requested: artifactType !== 'ai_review', schemaVersion: 1 }), createdAt, createdAt);
      }
      this.bumpRevision(stageId);
      const result = this.getStageWorkspace(stageId);
      this.commitIntentOperation(operationId, result);
      return result;
    });
  }

  /** Complete the durable pre-capture handshake after native capture confirms. */
  confirmStageSessionStarted(meetingId: string, expectedSessionRevision?: number): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      if (expectedSessionRevision !== undefined && Number(session.revision) !== expectedSessionRevision) {
        throw new InterviewDomainError('stage_conflict', 'Stage session changed before capture started.', true, 'retry');
      }
      if (session.status === 'initializing') {
        this.db.prepare(`
          UPDATE stage_sessions
          SET status = 'recording', revision = revision + 1, updated_at = ?, heartbeat_at = ?
          WHERE meeting_id = ? AND status = 'initializing' AND revision = ?
        `).run(nowIso(), Date.now(), meetingId, session.revision);
        this.bumpRevision(session.interview_stage_id);
        if (session.operation_id) {
          this.db.prepare(`
            UPDATE stage_workspace_operations
            SET status = 'committed', updated_at = ?
            WHERE operation_id = ? AND status = 'intent_committed'
          `).run(nowIso(), session.operation_id);
        }
      } else if (session.status !== 'recording') {
        throw new InterviewDomainError('session_capture_failed', 'Stage capture did not reach recording state.', true, 'retry');
      }
      const result = this.getStageWorkspace(session.interview_stage_id);
      if (session.operation_id) {
        this.db.prepare('UPDATE stage_workspace_operations SET result_json = ?, updated_at = ? WHERE operation_id = ? AND status = \'committed\'').run(JSON.stringify(result), nowIso(), session.operation_id);
      }
      return result;
    });
  }

  completeStageSession(meetingId: string, operationId: string, expectedSessionRevision?: number): StageWorkspaceSnapshot {
    if (!operationId) throw new InterviewDomainError('invalid_payload', 'operationId is required.', false, 'fix_input');
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      if (expectedSessionRevision !== undefined && Number(session.revision) !== expectedSessionRevision) {
        throw new InterviewDomainError('stage_conflict', 'Stage session changed. Refresh before stopping it.', true, 'retry');
      }
      if (!['stopped', 'abandoned', 'failed'].includes(session.status)) {
        const stoppedAt = Date.now();
        this.db.prepare(`
          UPDATE stage_sessions
          SET status = 'stopped', stopped_at = ?, stop_requested_at = ?, stop_operation_id = ?,
              revision = revision + 1, updated_at = ?
          WHERE meeting_id = ? AND revision = ?
        `).run(stoppedAt, stoppedAt, operationId, nowIso(), meetingId, session.revision);
        this.db.prepare('UPDATE meetings SET duration_ms = ? WHERE id = ?').run(
          session.started_at ? Math.max(0, stoppedAt - session.started_at) : null,
          meetingId,
        );
        try {
          const transcript = this.db.prepare(`
            SELECT 1 FROM transcripts
            WHERE meeting_id = ? AND length(trim(content)) > 0
            LIMIT 1
          `).get(meetingId);
          this.db.prepare(`
            UPDATE stage_session_artifacts
            SET status = ?, updated_at = ?
            WHERE meeting_id = ? AND artifact_type = 'transcript'
          `).run(transcript ? 'ready' : 'pending', nowIso(), meetingId);
          this.activateArtifactJobs(meetingId);
        } catch {
          // Older/recovery databases may not have transcripts yet. The artifact
          // stays truthful as pending and will be projected again on refresh.
        }
        const stage = this.repo.getStage(session.interview_stage_id);
        if (stage && !stage.primarySessionMeetingId) {
          this.db.prepare(`
            UPDATE interview_stages
            SET primary_session_meeting_id = ?, workspace_revision = workspace_revision + 1, updated_at = ?
            WHERE id = ? AND primary_session_meeting_id IS NULL
          `).run(meetingId, nowIso(), stage.id);
        } else {
          this.bumpRevision(session.interview_stage_id);
        }
      }
      return this.getStageWorkspace(session.interview_stage_id);
    });
  }

  /**
   * Finalize a session whose native capture never became usable. This is
   * intentionally distinct from Stop: no recording was successfully made,
   * so the durable state must be `failed` and blocked post-call work must not
   * pretend that a transcript will arrive.
   */
  failStageSession(meetingId: string, operationId: string, failureCode = 'capture_start_failed'): StageWorkspaceSnapshot {
    if (!operationId) throw new InterviewDomainError('invalid_payload', 'operationId is required.', false, 'fix_input');
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      if (!['failed', 'abandoned', 'stopped'].includes(session.status)) {
        const updatedAt = nowIso();
        this.db.prepare(`
          UPDATE stage_sessions
          SET status = 'failed', failure_code = ?, stop_operation_id = ?,
              revision = revision + 1, updated_at = ?
          WHERE meeting_id = ? AND status IN ('initializing', 'recording', 'stopping')
        `).run(failureCode, operationId, updatedAt, meetingId);
        this.db.prepare(`
          UPDATE stage_session_artifacts
          SET status = 'cancelled', updated_at = ?
          WHERE meeting_id = ? AND status IN ('pending', 'not_requested')
        `).run(updatedAt, meetingId);
        this.db.prepare(`
          UPDATE stage_artifact_jobs
          SET status = 'cancelled', last_error_json = ?, updated_at = ?
          WHERE meeting_id = ? AND status IN ('blocked', 'queued', 'running')
        `).run(JSON.stringify({ code: failureCode }), updatedAt, meetingId);
        if (session.operation_id) {
          this.db.prepare(`
            UPDATE stage_workspace_operations
            SET status = 'failed', error_json = ?, updated_at = ?
            WHERE operation_id = ? AND status IN ('pending', 'intent_committed')
          `).run(JSON.stringify({ code: failureCode }), updatedAt, session.operation_id);
        }
        this.bumpRevision(session.interview_stage_id);
      }
      return this.getStageWorkspace(session.interview_stage_id);
    });
  }

  /** Activate blocked post-call work only after a durable stopped session. */
  activateArtifactJobs(meetingId: string): void {
    const updatedAt = nowIso();
    this.db.prepare(`
      UPDATE stage_artifact_jobs
      SET status = 'queued', request_json = json_set(request_json, '$.operationId', ?), updated_at = ?
      WHERE meeting_id = ? AND status = 'blocked'
        AND artifact_type IN ('transcript', 'summary')
    `).run(`post-call:${crypto.randomUUID()}`, updatedAt, meetingId);
    this.db.prepare(`
      UPDATE stage_artifact_jobs
      SET status = 'cancelled', updated_at = ?
      WHERE meeting_id = ? AND status = 'blocked' AND artifact_type = 'ai_review'
    `).run(updatedAt, meetingId);
    this.db.prepare(`
      UPDATE stage_session_artifacts
      SET status = 'pending', updated_at = ?
      WHERE meeting_id = ? AND artifact_type IN ('transcript', 'summary') AND status = 'not_requested'
    `).run(updatedAt, meetingId);
    this.db.prepare(`
      UPDATE stage_session_artifacts
      SET status = 'skipped', updated_at = ?
      WHERE meeting_id = ? AND artifact_type = 'ai_review' AND status = 'not_requested'
    `).run(updatedAt, meetingId);
  }

  /** Claim queued jobs with a short lease; the returned tokens fence late workers. */
  claimArtifactJobs(meetingId: string, leaseOwner: string, leaseMs = 60_000, artifactType?: 'transcript' | 'summary' | 'ai_review'): Array<{ artifactType: string; fencingToken: number }> {
    const now = Date.now();
    const leaseExpiresAt = now + leaseMs;
    const rows = this.db.prepare(`
      SELECT artifact_type, fencing_token
      FROM stage_artifact_jobs
      WHERE meeting_id = ? AND (? IS NULL OR artifact_type = ?)
        AND (status = 'queued' OR (status = 'running' AND lease_expires_at < ?))
    `).all<{ artifact_type: string; fencing_token: number }>(meetingId, artifactType ?? null, artifactType ?? null, now);
    const claim = this.db.prepare(`
      UPDATE stage_artifact_jobs
      SET status = 'running', lease_owner = ?, lease_expires_at = ?,
          fencing_token = fencing_token + 1, attempt_count = attempt_count + 1, updated_at = ?
      WHERE meeting_id = ? AND artifact_type = ?
        AND (? IS NULL OR artifact_type = ?)
        AND (status = 'queued' OR (status = 'running' AND lease_expires_at < ?))
    `);
    return rows.flatMap(row => {
      const result = claim.run(leaseOwner, leaseExpiresAt, nowIso(), meetingId, row.artifact_type, artifactType ?? null, artifactType ?? null, now);
      return result.changes ? [{ artifactType: row.artifact_type, fencingToken: Number(row.fencing_token) + 1 }] : [];
    });
  }

  /** Complete a job only when the current lease owner and fencing token match. */
  completeArtifactJob(
    meetingId: string,
    artifactType: 'transcript' | 'summary' | 'ai_review',
    leaseOwner: string,
    fencingToken: number,
    status: 'succeeded' | 'failed',
    errorCode?: string,
  ): boolean {
    const updatedAt = nowIso();
    const result = this.db.prepare(`
      UPDATE stage_artifact_jobs
      SET status = ?, lease_owner = NULL, lease_expires_at = NULL,
          last_error_json = ?, updated_at = ?
      WHERE meeting_id = ? AND artifact_type = ? AND status = 'running'
        AND lease_owner = ? AND fencing_token = ?
    `).run(status, errorCode ? JSON.stringify({ code: errorCode }) : null, updatedAt, meetingId, artifactType, leaseOwner, fencingToken);
    if (result.changes) {
      this.db.prepare(`
        UPDATE stage_session_artifacts
        SET status = ?, error_code = ?, updated_at = ?
        WHERE meeting_id = ? AND artifact_type = ?
      `).run(status === 'succeeded' ? 'ready' : 'failed', errorCode ?? null, updatedAt, meetingId, artifactType);
    }
    return Boolean(result.changes);
  }

  retryArtifactJob(meetingId: string, artifactType: 'transcript' | 'summary' | 'ai_review'): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session || !['stopped', 'abandoned'].includes(session.status)) {
        throw new InterviewDomainError('invalid_payload', 'Only a completed stage session can be retried.', false, 'fix_input');
      }
      const job = this.db.prepare(`SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = ?`).get<{ status: string }>(meetingId, artifactType);
      if (!job || !['failed', 'cancelled', 'skipped'].includes(job.status)) {
        throw new InterviewDomainError('operation_in_progress', 'This artifact is not waiting for a retry.', true, 'retry');
      }
      const timestamp = nowIso();
      const operationId = `artifact-retry:${crypto.randomUUID()}`;
      this.db.prepare(`
        UPDATE stage_artifact_jobs
        SET status = 'queued', request_json = ?, attempt_count = 0,
            lease_owner = NULL, lease_expires_at = NULL, last_error_json = NULL,
            fencing_token = fencing_token + 1, updated_at = ?
        WHERE meeting_id = ? AND artifact_type = ?
        `).run(JSON.stringify({ requested: true, manualRetry: true, operationId, schemaVersion: 1 }), timestamp, meetingId, artifactType);
      this.db.prepare(`
        UPDATE stage_session_artifacts
        SET status = 'pending', attempt_count = 0, error_code = NULL, updated_at = ?
        WHERE meeting_id = ? AND artifact_type = ?
      `).run(timestamp, meetingId, artifactType);
      this.bumpRevision(session.interview_stage_id);
      return this.getStageWorkspace(session.interview_stage_id);
    });
  }

  /** Queue an explicit, user-approved AI review draft after the call. */
  requestAiReviewJob(meetingId: string): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session || !['stopped', 'abandoned'].includes(session.status)) {
        throw new InterviewDomainError('invalid_payload', 'AI review is available after a completed stage session.', false, 'fix_input');
      }
      const stage = this.repo.getStage(session.interview_stage_id);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (stage.primarySessionMeetingId && stage.primarySessionMeetingId !== meetingId) {
        throw new InterviewDomainError('primary_session_review_conflict', 'Select this session as primary before generating its review.', false, 'choose_stage');
      }
      const job = this.db.prepare(`SELECT status FROM stage_artifact_jobs WHERE meeting_id = ? AND artifact_type = 'ai_review'`).get<{ status: string }>(meetingId);
      if (!job) throw new InterviewDomainError('not_found', 'AI review job was not found.', false, 'none');
      if (job.status === 'queued' || job.status === 'running') {
        throw new InterviewDomainError('operation_in_progress', 'AI review is already being generated.', true, 'retry');
      }
      const timestamp = nowIso();
      const operationId = `ai-review:${crypto.randomUUID()}`;
      this.db.prepare(`
        UPDATE stage_artifact_jobs
        SET status = 'queued', request_json = ?, attempt_count = 0,
            lease_owner = NULL, lease_expires_at = NULL, last_error_json = NULL,
            fencing_token = fencing_token + 1, updated_at = ?
        WHERE meeting_id = ? AND artifact_type = 'ai_review'
      `).run(JSON.stringify({ requested: true, explicit: true, operationId, schemaVersion: 1 }), timestamp, meetingId);
      this.db.prepare(`
        UPDATE stage_session_artifacts
        SET status = 'pending', attempt_count = 0, error_code = NULL, updated_at = ?
        WHERE meeting_id = ? AND artifact_type = 'ai_review'
      `).run(timestamp, meetingId);
      this.bumpRevision(session.interview_stage_id);
      return this.getStageWorkspace(session.interview_stage_id);
    });
  }

  /** Persist an AI-generated review as an editable draft, never as user-approved review. */
  saveAiReviewDraft(meetingId: string, review: Record<string, unknown>): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT interview_stage_id FROM stage_sessions WHERE meeting_id = ?').get<{ interview_stage_id: string }>(meetingId);
      if (!session) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      const stageId = session.interview_stage_id;
      const stage = this.repo.getStage(stageId);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (stage.primarySessionMeetingId && stage.primarySessionMeetingId !== meetingId) {
        throw new InterviewDomainError('primary_session_review_conflict', 'AI review drafts must use the primary session.', false, 'choose_stage');
      }
      const existing = this.db.prepare('SELECT status FROM stage_reviews WHERE interview_stage_id = ?').get<{ status: string }>(stageId);
      if (existing?.status === 'saved') return this.getStageWorkspace(stageId);
      const timestamp = nowIso();
      this.db.prepare(`
        INSERT INTO stage_reviews (interview_stage_id, meeting_id, status, review_json, created_at, updated_at)
        VALUES (?, ?, 'draft', ?, ?, ?)
        ON CONFLICT(interview_stage_id) DO UPDATE SET
          meeting_id = excluded.meeting_id,
          status = CASE WHEN stage_reviews.status = 'saved' THEN stage_reviews.status ELSE 'draft' END,
          review_json = CASE WHEN stage_reviews.status = 'saved' THEN stage_reviews.review_json ELSE excluded.review_json END,
          updated_at = excluded.updated_at
      `).run(stageId, meetingId, JSON.stringify(review), timestamp, timestamp);
      this.bumpRevision(stageId);
      return this.getStageWorkspace(stageId);
    });
  }

  saveStageReview(stageId: string, meetingId: string, review: Record<string, unknown>, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      this.assertRevision(stageId, expectedRevision);
      const session = this.db.prepare(`
        SELECT * FROM stage_sessions
        WHERE meeting_id = ? AND interview_stage_id = ? AND status IN ('stopped', 'abandoned')
      `).get<StageSessionRow>(meetingId, stageId);
      if (!session) throw new InterviewDomainError('invalid_payload', 'Review source session is not a completed session for this stage.', false, 'fix_input');
      const stage = this.repo.getStage(stageId);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (stage.primarySessionMeetingId && stage.primarySessionMeetingId !== meetingId) {
        throw new InterviewDomainError('primary_session_review_conflict', 'Select the primary session before saving this review.', false, 'choose_stage');
      }
      const timestamp = nowIso();
      this.db.prepare(`
        INSERT INTO stage_reviews (interview_stage_id, meeting_id, status, review_json, created_at, updated_at)
        VALUES (?, ?, 'saved', ?, ?, ?)
        ON CONFLICT(interview_stage_id) DO UPDATE SET
          meeting_id = excluded.meeting_id,
          status = excluded.status,
          review_json = excluded.review_json,
          updated_at = excluded.updated_at
      `).run(stageId, meetingId, JSON.stringify(review), timestamp, timestamp);
      this.bumpRevision(stageId);
      return this.getStageWorkspace(stageId);
    });
  }

  /** Explicitly choose which completed session is the stage's review source. */
  selectPrimarySession(stageId: string, meetingId: string | null, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      this.assertRevision(stageId, expectedRevision);
      const stage = this.repo.getStage(stageId);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (meetingId !== null) {
        const session = this.db.prepare(`
          SELECT meeting_id FROM stage_sessions
          WHERE meeting_id = ? AND interview_stage_id = ? AND status IN ('stopped', 'abandoned')
        `).get(meetingId, stageId);
        if (!session) throw new InterviewDomainError('invalid_payload', 'Choose a completed session from this stage.', false, 'fix_input');
      }
      if (stageReviewExists(this.db, stageId) && meetingId !== stage.primarySessionMeetingId) {
        throw new InterviewDomainError('primary_session_review_conflict', 'Clear the saved review before changing its source session.', false, 'choose_stage');
      }
      this.db.prepare(`
        UPDATE interview_stages
        SET primary_session_meeting_id = ?, workspace_revision = workspace_revision + 1, updated_at = ?
        WHERE id = ?
      `).run(meetingId, nowIso(), stageId);
      return this.getStageWorkspace(stageId);
    });
  }

  /** Clear a user-owned review before switching or deleting its source session. */
  clearStageReview(stageId: string, confirmationToken: string, expectedRevision?: number): StageWorkspaceSnapshot {
    if (confirmationToken !== 'clear-stage-review') {
      throw new InterviewDomainError('invalid_payload', 'A confirmation token is required to clear the saved review.', false, 'fix_input');
    }
    return this.db.transaction(() => {
      this.assertRevision(stageId, expectedRevision);
      const result = this.db.prepare('DELETE FROM stage_reviews WHERE interview_stage_id = ?').run(stageId);
      if (result.changes) this.bumpRevision(stageId);
      return this.getStageWorkspace(stageId);
    });
  }

  /** Permanently remove one completed stage session and its cascaded artifacts. */
  deleteStageSession(meetingId: string, confirmationToken: string, expectedRevision?: number): StageWorkspaceSnapshot {
    if (confirmationToken !== 'delete-stage-session') {
      throw new InterviewDomainError('invalid_payload', 'A confirmation token is required to delete stage data.', false, 'fix_input');
    }
    return this.db.transaction(() => {
      const session = this.db.prepare('SELECT * FROM stage_sessions WHERE meeting_id = ?').get<StageSessionRow>(meetingId);
      if (!session) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      if (!['stopped', 'abandoned', 'failed'].includes(session.status)) {
        throw new InterviewDomainError('operation_in_progress', 'Active stage sessions cannot be deleted.', true, 'retry');
      }
      this.assertRevision(session.interview_stage_id, expectedRevision);
      const stage = this.repo.getStage(session.interview_stage_id);
      if (!stage) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      if (stage.primarySessionMeetingId === meetingId) {
        throw new InterviewDomainError('primary_session_review_conflict', 'Clear the review source before deleting this session.', false, 'choose_stage');
      }
      const deleted = this.db.prepare('DELETE FROM meetings WHERE id = ?').run(meetingId);
      if (!deleted.changes) throw new InterviewDomainError('not_found', 'Stage session not found.', false, 'none');
      this.bumpRevision(stage.id);
      return this.getStageWorkspace(stage.id);
    });
  }

  completeStageNextAction(stageId: string, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.setStageNextAction(stageId, { state: 'completed' }, expectedRevision);
  }

  markNoStageNextActionRequired(stageId: string, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.setStageNextAction(stageId, { text: null, state: 'none_required' }, expectedRevision);
  }

  cancelStageOperation(operationId: string): { cancelled: boolean } {
    if (!operationId) throw new InterviewDomainError('invalid_payload', 'operationId is required.', false, 'fix_input');
    const result = this.db.prepare(`
      UPDATE stage_workspace_operations
      SET status = 'cancelled', error_json = ?, updated_at = ?
      WHERE operation_id = ? AND status IN ('pending', 'intent_committed')
    `).run(JSON.stringify({ code: 'operation_cancelled' }), nowIso(), operationId);
    return { cancelled: Boolean(result.changes) };
  }

  setStageNextAction(stageId: string, nextAction: { text?: string | null; dueAt?: number | null; state?: StageNextAction['state'] }, expectedRevision?: number): StageWorkspaceSnapshot {
    return this.db.transaction(() => {
      this.assertRevision(stageId, expectedRevision);
      const state = nextAction.state ?? (nextAction.text?.trim() ? 'saved' : 'none_required');
      const completedAt = state === 'completed' ? Date.now() : null;
      const result = this.db.prepare(`
        UPDATE interview_stages
        SET next_action = ?, next_action_due_at = ?, next_action_state = ?,
            next_action_completed_at = ?, workspace_revision = workspace_revision + 1,
            updated_at = ?
        WHERE id = ?
      `).run(nextAction.text?.trim() || null, nextAction.dueAt ?? null, state, completedAt, nowIso(), stageId);
      if (!result.changes) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
      return this.getStageWorkspace(stageId);
    });
  }

  exportStageWorkspace(
    stageId: string,
    format: StageWorkspaceExportFormat,
    includeTranscript = false,
  ): StageWorkspaceExportResult {
    const workspace = this.getStageWorkspace(stageId);
    const session = workspace.primarySessionId
      ? workspace.sessions.find(candidate => candidate.meetingId === workspace.primarySessionId) ?? null
      : null;
    const transcript = includeTranscript && session
      ? this.db.prepare(`
          SELECT speaker, content, timestamp_ms
          FROM transcripts
          WHERE meeting_id = ?
          ORDER BY timestamp_ms ASC
        `).all<{ speaker: string | null; content: string | null; timestamp_ms: number | null }>(session.meetingId)
      : [];
    const safe = {
      schemaVersion: 1,
      exportedAt: nowIso(),
      application: {
        id: workspace.application.id,
        title: workspace.application.title,
        company: workspace.application.company,
        roleTitle: workspace.application.roleTitle,
        vacancyUrl: workspace.application.vacancyUrl,
        status: workspace.application.status,
      },
      stage: {
        id: workspace.stage.id,
        title: workspace.stage.title,
        type: workspace.stage.stageType,
        status: workspace.stage.status,
        format: workspace.stage.format,
        startsAt: workspace.stage.startsAt,
      },
      context: {
        sourceText: workspace.context.sourceText,
        sourceHash: workspace.context.sourceHash,
      },
      preparation: workspace.preparation,
      review: workspace.review,
      nextAction: workspace.nextAction,
      session: session ? {
        meetingId: session.meetingId,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt,
        status: session.status,
      } : null,
      transcript: includeTranscript ? transcript.map(row => ({
        speaker: row.speaker,
        text: row.content,
        timestamp: row.timestamp_ms,
      })) : undefined,
    };
    const base = `openoffer-stage-${workspace.stage.id}`;
    if (format === 'json') {
      return {
        format,
        filename: `${base}.json`,
        content: JSON.stringify(safe, null, 2),
        includesTranscript: includeTranscript,
      };
    }
    const lines = [
      `# ${workspace.stage.title || 'Interview stage'}`,
      '',
      `**Application:** ${workspace.application.title || 'Untitled'}${workspace.application.company ? ` — ${workspace.application.company}` : ''}`,
      workspace.application.roleTitle ? `**Role:** ${workspace.application.roleTitle}` : '',
      '',
      '## Context',
      workspace.context.sourceText || '_No recruiter or stage context._',
      '',
      '## Preparation',
      workspace.preparation?.oneLineGoal ? `**Goal:** ${workspace.preparation.oneLineGoal}` : '_No preparation saved._',
      workspace.preparation?.cheatsheet ? `\n${workspace.preparation.cheatsheet}` : '',
      '',
      '## Review',
      workspace.review ? `\n\`\`\`json\n${JSON.stringify(workspace.review.review, null, 2)}\n\`\`\`` : '_No review saved._',
      '',
      '## Next action',
      workspace.nextAction.text || '_No next action._',
    ];
    if (includeTranscript) {
      lines.push('', '## Transcript', ...transcript.map(row => `- ${row.speaker || 'speaker'}: ${row.content || ''}`));
    }
    return {
      format,
      filename: `${base}.md`,
      content: lines.filter((line, index) => !(line === '' && lines[index - 1] === '')).join('\n'),
      includesTranscript: includeTranscript,
    };
  }

  private assertRevision(stageId: string, expectedRevision?: number): void {
    if (expectedRevision === undefined) return;
    const row = this.db.prepare('SELECT workspace_revision FROM interview_stages WHERE id = ?').get<{ workspace_revision?: number }>(stageId);
    if (!row) throw new InterviewDomainError('not_found', 'Interview stage not found.', false, 'none');
    if (Number(row.workspace_revision ?? 0) !== expectedRevision) {
      throw new InterviewDomainError('stage_conflict', 'Stage workspace changed. Refresh before saving.', true, 'retry');
    }
  }

  private beginOperation(
    operationId: string | undefined,
    action: string,
    request: unknown,
    stageId: string,
  ): StageWorkspaceSnapshot | null {
    if (!operationId) throw new InterviewDomainError('invalid_payload', 'operationId is required.', false, 'fix_input');
    const requestJson = JSON.stringify(request);
    const requestHash = crypto.createHash('sha256').update(requestJson).digest('hex');
    const existing = this.db.prepare(`
      SELECT action, request_hash, status, result_json
      FROM stage_workspace_operations
      WHERE operation_id = ?
    `).get<{ action: string; request_hash: string; status: string; result_json?: string | null }>(operationId);
    if (existing) {
      if (existing.action !== action || existing.request_hash !== requestHash) {
        throw new InterviewDomainError('operation_id_conflict', 'operationId was already used for a different request.', false, 'fix_input');
      }
      if (existing.status === 'committed' && existing.result_json) return JSON.parse(existing.result_json) as StageWorkspaceSnapshot;
      throw new InterviewDomainError('operation_in_progress', 'The same stage operation is already in progress.', true, 'retry');
    }
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO stage_workspace_operations (
        operation_id, action, request_hash, request_json, stage_id, status,
        attempt_count, fencing_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 1, 1, ?, ?)
    `).run(operationId, action, requestHash, requestJson, stageId, timestamp, timestamp);
    return null;
  }

  private commitOperation(operationId: string | undefined, result: StageWorkspaceSnapshot): void {
    if (!operationId) return;
    this.db.prepare(`
      UPDATE stage_workspace_operations
      SET status = 'committed', result_json = ?, updated_at = ?
      WHERE operation_id = ?
    `).run(JSON.stringify(result), nowIso(), operationId);
  }

  private commitIntentOperation(operationId: string | undefined, result: StageWorkspaceSnapshot): void {
    if (!operationId) return;
    this.db.prepare(`
      UPDATE stage_workspace_operations
      SET status = 'intent_committed', result_json = ?, updated_at = ?
      WHERE operation_id = ?
    `).run(JSON.stringify(result), nowIso(), operationId);
  }

  private bumpRevision(stageId: string): number {
    this.db.prepare('UPDATE interview_stages SET workspace_revision = workspace_revision + 1, updated_at = ? WHERE id = ?').run(nowIso(), stageId);
    const row = this.db.prepare('SELECT workspace_revision FROM interview_stages WHERE id = ?').get<{ workspace_revision?: number }>(stageId);
    return Number(row?.workspace_revision ?? 0);
  }

  private deriveStatus(input: {
    stage: InterviewStage;
    preparation: PrepBrief | null;
    contextReady: boolean;
    readiness: ReadinessResult;
    sessions: StageSessionSummary[];
    primarySession: StageSessionSummary | null;
    activeSession: StageSessionSummary | null;
    latestSession: StageSessionSummary | null;
    review: StageReviewSummary | null;
    nextAction: StageNextAction;
  }): StageWorkspaceStatus {
    const { preparation, contextReady, readiness, primarySession, activeSession, latestSession, review, nextAction } = input;
    const prepState = !preparation ? 'empty' : isPreparationReady(preparation) ? 'ready' : 'draft';
    const session: StageWorkspaceSessionStatus = activeSession?.status ?? primarySession?.status ?? latestSession?.status ?? 'none';
    const artifacts = primarySession?.artifacts ?? null;
    const reviewState = review?.status ?? (primarySession ? 'ready' : 'unavailable');
    const primaryStep = !contextReady ? 'context'
      : prepState !== 'ready' ? 'prepare'
        : session === 'none' ? 'preflight'
          : session === 'stopped' && reviewState !== 'saved' ? 'review'
            : 'interview';
    return {
      primaryStep,
      context: contextReady ? 'ready' : 'missing',
      preparation: prepState,
      coreReadiness: readiness.level === 'ready' ? 'ready' : readiness.level === 'not_started' ? 'unknown' : 'blocked',
      session,
      artifacts,
      review: reviewState,
      nextAction: nextAction.state,
      complete: review?.status === 'saved' && ['saved', 'completed', 'none_required'].includes(nextAction.state),
    };
  }
}
