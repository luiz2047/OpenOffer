import type {
  InterviewCreatePayload,
  InterviewDetail,
  InterviewErrorAction,
  InterviewErrorCode,
  InterviewGetInput,
  InterviewIpcResult,
  InterviewListInput,
  InterviewListItem,
  InterviewQuestion,
  InterviewQuestionPayload,
  InterviewRetro,
  InterviewRetroPayload,
  InterviewUpdatePatch,
  PrepBrief,
  PrepBriefPayload,
  ReadinessResult,
} from '../../../src/types/interviews';
import { InterviewRepository } from './InterviewRepository';

const VALID_STATUSES = new Set(['active', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived']);
const VALID_PRIORITIES = new Set(['low', 'normal', 'high']);
const VALID_CALENDAR_PROVIDERS = new Set(['google', 'macos', 'manual']);
const VALID_CALENDAR_SYNC_STATUSES = new Set(['local_only', 'linked', 'changed', 'missing', 'calendar_disabled', 'refresh_error']);

export class InterviewDomainError extends Error {
  constructor(
    public readonly code: InterviewErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly action: InterviewErrorAction = 'none',
  ) {
    super(message);
    this.name = 'InterviewDomainError';
  }
}

export function interviewSuccess<T>(data: T): InterviewIpcResult<T> {
  return { ok: true, data };
}

export function interviewFailure(error: unknown): InterviewIpcResult<never> {
  if (error instanceof InterviewDomainError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      action: error.action,
    };
  }
  const message = String((error as any)?.message || error || '');
  if (/UNIQUE constraint failed: interview_events\.calendar_provider|uq_interview_events_calendar_ref/i.test(message)) {
    return {
      ok: false,
      code: 'duplicate_calendar_ref',
      message: 'That calendar event is already linked to another interview.',
      retryable: false,
      action: 'open_existing',
    };
  }
  if (/SQLITE_BUSY|database is locked/i.test(message)) {
    return {
      ok: false,
      code: 'conflict_retry',
      message: 'The local database is busy. Retry the interview action.',
      retryable: true,
      action: 'retry',
    };
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Interview not found.',
      retryable: false,
      action: 'none',
    };
  }
  return {
    ok: false,
    code: 'unexpected_error',
    message: 'The interview action failed. Try again or reopen the app.',
    retryable: true,
    action: 'retry',
  };
}

export async function safeInterviewHandle<T>(fn: () => T | Promise<T>): Promise<InterviewIpcResult<T>> {
  try {
    return interviewSuccess(await fn());
  } catch (error) {
    return interviewFailure(error) as InterviewIpcResult<T>;
  }
}

function assertId(id: unknown, field = 'id'): string {
  if (typeof id !== 'string' || id.length < 1 || id.length > 128) {
    throw new InterviewDomainError('invalid_payload', `${field} is invalid.`, false, 'fix_input');
  }
  return id;
}

function text(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new InterviewDomainError('invalid_payload', `${field} is required.`, false, 'fix_input');
    return null;
  }
  if (typeof value !== 'string') {
    throw new InterviewDomainError('invalid_payload', `${field} must be text.`, false, 'fix_input');
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new InterviewDomainError('invalid_payload', `${field} is required.`, false, 'fix_input');
  }
  if (trimmed.length > max) {
    throw new InterviewDomainError('invalid_payload', `${field} is too long.`, false, 'fix_input');
  }
  return trimmed || null;
}

function optionalEpoch(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InterviewDomainError('invalid_payload', `${field} must be a finite timestamp.`, false, 'fix_input');
  }
  return value;
}

function optionalUrl(value: unknown, field: string): string | null {
  const raw = text(value, field, 2048, false);
  if (!raw) return null;
  try {
    new URL(raw);
    return raw;
  } catch {
    throw new InterviewDomainError('invalid_payload', `${field} must be a valid URL.`, false, 'fix_input');
  }
}

function optionalObject<T>(value: unknown, field: string): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new InterviewDomainError('invalid_payload', `${field} must be an object.`, false, 'fix_input');
  }
  return value as T;
}

function stringArray(value: unknown, field: string, maxItems = 200): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new InterviewDomainError('invalid_payload', `${field} must be a bounded list.`, false, 'fix_input');
  }
  return value.map((item, index) => text(item, `${field}[${index}]`, 1000, true) as string);
}

function normalizeCreatePayload(payload: any): InterviewCreatePayload {
  const status = payload?.status ?? 'active';
  const priority = payload?.priority ?? 'normal';
  if (!VALID_STATUSES.has(status)) throw new InterviewDomainError('invalid_payload', 'status is invalid.', false, 'fix_input');
  if (!VALID_PRIORITIES.has(priority)) throw new InterviewDomainError('invalid_payload', 'priority is invalid.', false, 'fix_input');
  const rawSourceText = text(payload?.rawSourceText, 'rawSourceText', 50000, false);
  const calendarProvider = payload?.calendarProvider ?? null;
  const calendarSyncStatus = payload?.calendarSyncStatus ?? 'local_only';
  if (calendarProvider !== null && calendarProvider !== undefined && !VALID_CALENDAR_PROVIDERS.has(calendarProvider)) {
    throw new InterviewDomainError('invalid_payload', 'calendarProvider is invalid.', false, 'fix_input');
  }
  if (!VALID_CALENDAR_SYNC_STATUSES.has(calendarSyncStatus)) {
    throw new InterviewDomainError('invalid_payload', 'calendarSyncStatus is invalid.', false, 'fix_input');
  }
  return {
    title: text(payload?.title, 'title', 180, true) as string,
    company: text(payload?.company, 'company', 120),
    roleTitle: text(payload?.roleTitle, 'roleTitle', 120),
    stage: text(payload?.stage, 'stage', 120),
    status,
    priority,
    source: text(payload?.source, 'source', 120),
    vacancyUrl: optionalUrl(payload?.vacancyUrl, 'vacancyUrl'),
    meetingUrl: optionalUrl(payload?.meetingUrl, 'meetingUrl'),
    startsAt: optionalEpoch(payload?.startsAt, 'startsAt'),
    endsAt: optionalEpoch(payload?.endsAt, 'endsAt'),
    timezone: text(payload?.timezone, 'timezone', 120),
    rawSourceText,
    calendarProvider,
    calendarId: text(payload?.calendarId, 'calendarId', 512),
    calendarEventId: text(payload?.calendarEventId, 'calendarEventId', 512),
    calendarSnapshot: optionalObject(payload?.calendarSnapshot, 'calendarSnapshot'),
    calendarLastSeenAt: optionalEpoch(payload?.calendarLastSeenAt, 'calendarLastSeenAt'),
    calendarSyncStatus,
  };
}

function normalizeUpdatePatch(patch: any): InterviewUpdatePatch {
  const out: InterviewUpdatePatch = {};
  if ('title' in patch) out.title = text(patch.title, 'title', 180, true) as string;
  if ('company' in patch) out.company = text(patch.company, 'company', 120);
  if ('roleTitle' in patch) out.roleTitle = text(patch.roleTitle, 'roleTitle', 120);
  if ('stage' in patch) out.stage = text(patch.stage, 'stage', 120);
  if ('status' in patch) {
    if (!VALID_STATUSES.has(patch.status)) throw new InterviewDomainError('invalid_payload', 'status is invalid.', false, 'fix_input');
    out.status = patch.status;
  }
  if ('priority' in patch) {
    if (!VALID_PRIORITIES.has(patch.priority)) throw new InterviewDomainError('invalid_payload', 'priority is invalid.', false, 'fix_input');
    out.priority = patch.priority;
  }
  if ('source' in patch) out.source = text(patch.source, 'source', 120);
  if ('vacancyUrl' in patch) out.vacancyUrl = optionalUrl(patch.vacancyUrl, 'vacancyUrl');
  if ('meetingUrl' in patch) out.meetingUrl = optionalUrl(patch.meetingUrl, 'meetingUrl');
  if ('startsAt' in patch) out.startsAt = optionalEpoch(patch.startsAt, 'startsAt');
  if ('endsAt' in patch) out.endsAt = optionalEpoch(patch.endsAt, 'endsAt');
  if ('timezone' in patch) out.timezone = text(patch.timezone, 'timezone', 120);
  if ('rawSourceText' in patch) out.rawSourceText = text(patch.rawSourceText, 'rawSourceText', 50000);
  if ('calendarProvider' in patch) {
    if (patch.calendarProvider !== null && patch.calendarProvider !== undefined && !VALID_CALENDAR_PROVIDERS.has(patch.calendarProvider)) {
      throw new InterviewDomainError('invalid_payload', 'calendarProvider is invalid.', false, 'fix_input');
    }
    out.calendarProvider = patch.calendarProvider ?? null;
  }
  if ('calendarId' in patch) out.calendarId = text(patch.calendarId, 'calendarId', 512);
  if ('calendarEventId' in patch) out.calendarEventId = text(patch.calendarEventId, 'calendarEventId', 512);
  if ('calendarSnapshot' in patch) out.calendarSnapshot = optionalObject(patch.calendarSnapshot, 'calendarSnapshot');
  if ('calendarLastSeenAt' in patch) out.calendarLastSeenAt = optionalEpoch(patch.calendarLastSeenAt, 'calendarLastSeenAt');
  if ('calendarMissingSince' in patch) out.calendarMissingSince = optionalEpoch(patch.calendarMissingSince, 'calendarMissingSince');
  if ('calendarSyncStatus' in patch) {
    if (!VALID_CALENDAR_SYNC_STATUSES.has(patch.calendarSyncStatus)) {
      throw new InterviewDomainError('invalid_payload', 'calendarSyncStatus is invalid.', false, 'fix_input');
    }
    out.calendarSyncStatus = patch.calendarSyncStatus;
  }
  return out;
}

function normalizePrep(payload: any): PrepBriefPayload {
  return {
    oneLineGoal: text(payload?.oneLineGoal, 'oneLineGoal', 1000),
    pitch30s: text(payload?.pitch30s, 'pitch30s', 4000),
    pitch2m: text(payload?.pitch2m, 'pitch2m', 8000),
    expectedTopics: stringArray(payload?.expectedTopics, 'expectedTopics'),
    cheatsheet: text(payload?.cheatsheet, 'cheatsheet', 20000),
    riskHandling: stringArray(payload?.riskHandling, 'riskHandling'),
    lastChecklist: stringArray(payload?.lastChecklist, 'lastChecklist'),
  };
}

function normalizeRetro(payload: any): InterviewRetroPayload {
  const passProbability = payload?.passProbability;
  if (passProbability !== undefined && passProbability !== null && (!Number.isInteger(passProbability) || passProbability < 0 || passProbability > 100)) {
    throw new InterviewDomainError('invalid_payload', 'passProbability must be 0..100.', false, 'fix_input');
  }
  return {
    passProbability: passProbability ?? null,
    mainSignal: text(payload?.mainSignal, 'mainSignal', 4000),
    strongMoments: stringArray(payload?.strongMoments, 'strongMoments'),
    weakMoments: stringArray(payload?.weakMoments, 'weakMoments'),
    newFacts: stringArray(payload?.newFacts, 'newFacts'),
    followUpActions: stringArray(payload?.followUpActions, 'followUpActions'),
  };
}

function normalizeQuestions(questions: any): InterviewQuestionPayload[] {
  if (!Array.isArray(questions) || questions.length > 200) {
    throw new InterviewDomainError('invalid_payload', 'questions must be a bounded list.', false, 'fix_input');
  }
  return questions.map((question, index) => ({
    id: question?.id ? assertId(question.id, `questions[${index}].id`) : undefined,
    questionText: text(question?.questionText, `questions[${index}].questionText`, 1000, true) as string,
    category: text(question?.category, `questions[${index}].category`, 120),
    quality: question?.quality ?? null,
    weakSpot: Boolean(question?.weakSpot),
    followUpNote: text(question?.followUpNote, `questions[${index}].followUpNote`, 20000),
  }));
}

export class InterviewService {
  constructor(private readonly repo: InterviewRepository) {}

  private requireActiveInterview(id: string): InterviewDetail {
    const detail = this.repo.get(id);
    if (!detail) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');
    if (detail.archivedAt || detail.status === 'archived') {
      throw new InterviewDomainError('interview_deleted_or_archived', 'Interview is archived.', false, 'open_existing');
    }
    return detail;
  }

  list(input: InterviewListInput = {}): InterviewListItem[] {
    return this.repo.list(input);
  }

  get(input: InterviewGetInput): InterviewDetail {
    const id = assertId(input.id);
    const detail = this.repo.get(id, input.include ?? []);
    if (!detail) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');
    return detail;
  }

  create(operationId: string, payload: unknown): InterviewDetail {
    assertId(operationId, 'operationId');
    const event = this.repo.create(normalizeCreatePayload(payload), operationId);
    return this.repo.get(event.id, ['dossier', 'prep', 'retros', 'questions', 'meetings']) as InterviewDetail;
  }

  update(id: string, patch: unknown): InterviewDetail {
    const updated = this.repo.update(assertId(id), normalizeUpdatePatch(patch));
    if (!updated) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');
    return this.repo.get(updated.id, ['dossier', 'prep', 'retros', 'questions', 'meetings']) as InterviewDetail;
  }

  archive(id: string): { archived: boolean } {
    return { archived: this.repo.archive(assertId(id)) };
  }

  delete(id: string, includeLinkedMeetings = false): { deleted: boolean } {
    return { deleted: this.repo.hardDelete(assertId(id), Boolean(includeLinkedMeetings)) };
  }

  attachMeeting(interviewId: string, meetingId: string): { attached: boolean } {
    const attached = this.repo.attachMeeting(assertId(interviewId, 'interviewId'), assertId(meetingId, 'meetingId'));
    if (!attached) throw new InterviewDomainError('meeting_attach_failed', 'Could not attach that meeting.', true, 'manual_attach');
    return { attached };
  }

  savePrep(interviewId: string, operationId: string, payload: unknown): PrepBrief {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    return this.repo.savePrep(id, normalizePrep(payload), assertId(operationId, 'operationId'));
  }

  saveRetro(interviewId: string, operationId: string, payload: unknown): InterviewRetro {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    return this.repo.saveRetro(id, normalizeRetro(payload), assertId(operationId, 'operationId'));
  }

  listQuestions(interviewId?: string): InterviewQuestion[] {
    return this.repo.listQuestions(interviewId ? { interviewId: assertId(interviewId, 'interviewId') } : {});
  }

  saveQuestions(interviewId: string, operationId: string, questions: unknown): InterviewQuestion[] {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    return this.repo.saveQuestions(
      id,
      normalizeQuestions(questions),
      assertId(operationId, 'operationId'),
    );
  }

  getReadiness(interviewId: string): ReadinessResult {
    const detail = this.repo.get(assertId(interviewId, 'interviewId'), ['dossier', 'prep']);
    if (!detail) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');
    return computeReadiness(detail);
  }
}

export function computeReadiness(detail: InterviewDetail): ReadinessResult {
  let score = 100;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const completed: string[] = [];

  if (!detail.startsAt) {
    blockers.push('schedule_missing');
    score -= 25;
  } else {
    completed.push('schedule_present');
  }

  if (!detail.company || !detail.roleTitle) {
    blockers.push('vacancy_context_missing');
    score -= 20;
  } else {
    completed.push('vacancy_context_present');
  }

  if (!detail.prep || (!detail.prep.cheatsheet && !detail.prep.oneLineGoal)) {
    blockers.push('prep_missing');
    score -= 25;
  } else {
    completed.push('prep_present');
  }

  if (!detail.meetingUrl && detail.calendarProvider && detail.calendarProvider !== 'manual') {
    warnings.push('meeting_link_missing');
    score -= 10;
  }

  const questionsToAsk = detail.dossier?.questionsToAsk ?? [];
  if (questionsToAsk.length === 0) {
    warnings.push('questions_to_ask_missing');
    score -= 10;
  } else {
    completed.push('questions_to_ask_present');
  }

  const risks = detail.prep?.riskHandling ?? [];
  if (risks.length === 0) {
    warnings.push('risk_handling_missing');
    score -= 10;
  } else {
    completed.push('risk_handling_present');
  }

  score = Math.max(0, Math.min(100, score));
  if (detail.startsAt && detail.startsAt - Date.now() <= 24 * 60 * 60 * 1000 && score < 70) {
    warnings.push('near_term_not_ready');
  }

  const ended = detail.endsAt !== null && detail.endsAt !== undefined && detail.endsAt < Date.now();
  const nextAction = ended ? 'write_retro' : blockers[0] ?? warnings[0] ?? null;
  const level = score < 40 ? 'not_started' : score < 80 || blockers.length > 0 ? 'needs_work' : 'ready';
  return { score, level, blockers, warnings, completed, nextAction };
}
