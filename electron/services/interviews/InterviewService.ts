import type {
  ApplicationCreateFromIntakePayload,
  ApplicationCreateFromIntakeResult,
  ApplicationDetail,
  ApplicationIntakeInput,
  ApplicationIntakeResult,
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
  InterviewSourceParseResult,
  InterviewStageType,
  InterviewUpdatePatch,
  PrepBrief,
  PrepBriefPayload,
  ReadinessResult,
  RetroPromptAction,
  RetroPromptActionPayload,
  RetroPromptDecision,
  VacancyDossier,
  VacancyDossierPayload,
} from '../../../src/types/interviews';
import { InterviewRepository } from './InterviewRepository';
import { parseInterviewSourceText } from './parser';

const VALID_STATUSES = new Set(['active', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived']);
const VALID_PRIORITIES = new Set(['low', 'normal', 'high']);
const VALID_CALENDAR_PROVIDERS = new Set(['google', 'macos', 'manual']);
const VALID_CALENDAR_SYNC_STATUSES = new Set(['local_only', 'linked', 'changed', 'missing', 'calendar_disabled', 'refresh_error']);
const VALID_INTAKE_CLASSIFICATIONS = new Set(['vacancy_only', 'vacancy_with_scheduled_stage', 'stage_update_for_existing_vacancy', 'calendar_only', 'unknown']);
const VALID_STAGE_TYPES = new Set(['recruiter_screen', 'technical_screen', 'system_design', 'leadership', 'final', 'offer_security', 'custom']);
const VALID_STAGE_STATUSES = new Set(['draft', 'scheduled', 'done', 'waiting_feedback', 'passed', 'rejected', 'canceled', 'archived']);

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

function requiredEpoch(value: unknown, field: string): number {
  const epoch = optionalEpoch(value, field);
  if (epoch === null) {
    throw new InterviewDomainError('invalid_payload', `${field} is required.`, false, 'fix_input');
  }
  return epoch;
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

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new InterviewDomainError('invalid_payload', `${field} must be a boolean.`, false, 'fix_input');
  }
  return value;
}

function boundedConfidence(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new InterviewDomainError('invalid_payload', `${field} must be a number from 0 to 1.`, false, 'fix_input');
  }
  return value;
}

function enumText<T extends string>(
  value: unknown,
  allowed: Set<string>,
  field: string,
  fallback?: T,
): T {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new InterviewDomainError('invalid_payload', `${field} is required.`, false, 'fix_input');
  }
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new InterviewDomainError('invalid_payload', `${field} is invalid.`, false, 'fix_input');
  }
  return value as T;
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

function normalizeDossier(payload: any): VacancyDossierPayload {
  return {
    description: text(payload?.description, 'description', 20000),
    requirements: stringArray(payload?.requirements, 'requirements'),
    compensationText: text(payload?.compensationText, 'compensationText', 1000),
    fitHypothesis: text(payload?.fitHypothesis, 'fitHypothesis', 4000),
    risks: stringArray(payload?.risks, 'risks'),
    questionsToAsk: stringArray(payload?.questionsToAsk, 'questionsToAsk'),
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
    quality: normalizeQuestionQuality(question?.quality, `questions[${index}].quality`),
    weakSpot: Boolean(question?.weakSpot),
    followUpNote: text(question?.followUpNote, `questions[${index}].followUpNote`, 20000),
  }));
}

function normalizeQuestionQuality(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 5) {
    throw new InterviewDomainError('invalid_payload', `${field} must be an integer from 0 to 5.`, false, 'fix_input');
  }
  return value;
}

function normalizeSourceParseInput(input: unknown): string {
  const raw = typeof input === 'string' ? input : (input as any)?.text;
  if (typeof raw !== 'string') {
    throw new InterviewDomainError('invalid_payload', 'text must be provided.', false, 'fix_input');
  }
  if (raw.length > 50000) {
    throw new InterviewDomainError('parser_input_too_large', 'Source text is too large. Paste a shorter vacancy or HR message.', false, 'fix_input');
  }
  if (!raw.trim()) {
    throw new InterviewDomainError('parser_no_fields', 'Paste a vacancy, HR message, or calendar note first.', false, 'fix_input');
  }
  return raw;
}

function normalizeApplicationIntakeInput(input: unknown): ApplicationIntakeInput {
  const payload = typeof input === 'string' ? { text: input } : (input as any);
  const textValue = normalizeSourceParseInput(payload);
  const sourceHint = text(payload?.sourceHint, 'sourceHint', 80);
  return {
    text: textValue,
    sourceHint: sourceHint as ApplicationIntakeInput['sourceHint'],
    candidateApplicationIds: Array.isArray(payload?.candidateApplicationIds)
      ? payload.candidateApplicationIds.map((id: unknown, index: number) => assertId(id, `candidateApplicationIds[${index}]`))
      : undefined,
    useAi: Boolean(payload?.useAi),
  };
}

function normalizeApplicationIntakeResult(input: unknown): ApplicationIntakeResult {
  const payload = optionalObject<any>(input, 'intake');
  if (!payload) {
    throw new InterviewDomainError('invalid_payload', 'intake is required.', false, 'fix_input');
  }
  const application = optionalObject<any>(payload.application, 'intake.application');
  if (!application) {
    throw new InterviewDomainError('invalid_payload', 'intake.application is required.', false, 'fix_input');
  }
  const normalized: ApplicationIntakeResult = {
    classification: enumText(payload.classification, VALID_INTAKE_CLASSIFICATIONS, 'intake.classification'),
    confidence: boundedConfidence(payload.confidence, 'intake.confidence'),
    application: {
      title: text(application.title, 'intake.application.title', 180) ?? undefined,
      company: text(application.company, 'intake.application.company', 120) ?? undefined,
      roleTitle: text(application.roleTitle, 'intake.application.roleTitle', 120) ?? undefined,
      source: text(application.source, 'intake.application.source', 120) ?? undefined,
      vacancyUrl: optionalUrl(application.vacancyUrl, 'intake.application.vacancyUrl') ?? undefined,
      compensationText: text(application.compensationText, 'intake.application.compensationText', 2000) ?? undefined,
      requirements: stringArray(application.requirements, 'intake.application.requirements', 80),
      risks: stringArray(application.risks, 'intake.application.risks', 80),
      questionsToAsk: stringArray(application.questionsToAsk, 'intake.application.questionsToAsk', 80),
      rawSourceText: text(application.rawSourceText, 'intake.application.rawSourceText', 50000, true) as string,
    },
    warnings: stringArray(payload.warnings, 'intake.warnings', 50),
    missingFields: stringArray(payload.missingFields, 'intake.missingFields', 50),
  };

  const stage = optionalObject<any>(payload.stage, 'intake.stage');
  if (stage) {
    normalized.stage = {
      stageType: enumText(stage.stageType, VALID_STAGE_TYPES, 'intake.stage.stageType', 'custom'),
      title: text(stage.title, 'intake.stage.title', 180) ?? undefined,
      startsAt: optionalEpoch(stage.startsAt, 'intake.stage.startsAt') ?? undefined,
      endsAt: optionalEpoch(stage.endsAt, 'intake.stage.endsAt') ?? undefined,
      timezone: text(stage.timezone, 'intake.stage.timezone', 120) ?? undefined,
      meetingUrl: optionalUrl(stage.meetingUrl, 'intake.stage.meetingUrl') ?? undefined,
      status: enumText(stage.status, VALID_STAGE_STATUSES, 'intake.stage.status', 'draft'),
    };
  }

  const existingApplicationMatch = optionalObject<any>(payload.existingApplicationMatch, 'intake.existingApplicationMatch');
  if (existingApplicationMatch) {
    normalized.existingApplicationMatch = {
      applicationId: assertId(existingApplicationMatch.applicationId, 'intake.existingApplicationMatch.applicationId'),
      confidence: boundedConfidence(existingApplicationMatch.confidence, 'intake.existingApplicationMatch.confidence'),
      reason: text(existingApplicationMatch.reason, 'intake.existingApplicationMatch.reason', 1000, true) as string,
    };
  }

  const calendarProposal = optionalObject<any>(payload.calendarProposal, 'intake.calendarProposal');
  if (calendarProposal) {
    normalized.calendarProposal = {
      shouldCreate: booleanValue(calendarProposal.shouldCreate, 'intake.calendarProposal.shouldCreate'),
      title: text(calendarProposal.title, 'intake.calendarProposal.title', 180, true) as string,
      startsAt: requiredEpoch(calendarProposal.startsAt, 'intake.calendarProposal.startsAt'),
      endsAt: requiredEpoch(calendarProposal.endsAt, 'intake.calendarProposal.endsAt'),
      timezone: text(calendarProposal.timezone, 'intake.calendarProposal.timezone', 120, true) as string,
      locationOrUrl: text(calendarProposal.locationOrUrl, 'intake.calendarProposal.locationOrUrl', 2048) ?? undefined,
      description: text(calendarProposal.description, 'intake.calendarProposal.description', 5000, true) as string,
      reminders: Array.isArray(calendarProposal.reminders)
        ? calendarProposal.reminders.slice(0, 10).map((reminder: any, index: number) => {
          const minutesBefore = reminder?.minutesBefore;
          if (typeof minutesBefore !== 'number' || !Number.isInteger(minutesBefore) || minutesBefore < 0 || minutesBefore > 10080) {
            throw new InterviewDomainError('invalid_payload', `intake.calendarProposal.reminders[${index}].minutesBefore is invalid.`, false, 'fix_input');
          }
          return { minutesBefore };
        })
        : [],
    };
  }

  return normalized;
}

function classificationFromParsed(parsed: InterviewSourceParseResult): ApplicationIntakeResult['classification'] {
  if (parsed.fields.startsAt || parsed.fields.meetingUrl || parsed.fields.stage) return 'vacancy_with_scheduled_stage';
  if (parsed.fields.company || parsed.fields.roleTitle || parsed.fields.vacancyUrl || parsed.fieldCount > 1) return 'vacancy_only';
  return 'unknown';
}

function intakeConfidence(parsed: InterviewSourceParseResult): number {
  let score = 0.45;
  if (parsed.fields.company) score += 0.12;
  if (parsed.fields.roleTitle) score += 0.12;
  if (parsed.fields.vacancyUrl) score += 0.08;
  if (parsed.fields.startsAt) score += 0.08;
  if (parsed.fields.meetingUrl) score += 0.05;
  if ((parsed.dossier?.requirements?.length ?? 0) > 0) score += 0.05;
  return Math.max(0.1, Math.min(0.95, score));
}

function stageTypeFromParsedStage(stage?: string | null): InterviewStageType {
  const textValue = (stage ?? '').toLowerCase();
  if (/recruit|hr|screen|скрин|рекрутер|эйчар/.test(textValue)) return 'recruiter_screen';
  if (/system|design|архитект/.test(textValue)) return 'system_design';
  if (/lead|manager|руковод/.test(textValue)) return 'leadership';
  if (/final|финал/.test(textValue)) return 'final';
  if (/offer|security|оффер|сб/.test(textValue)) return 'offer_security';
  if (/tech|technical|тех/.test(textValue)) return 'technical_screen';
  return 'custom';
}

function normalizeRetroPromptAction(payload: any): { action: RetroPromptAction; snoozeUntil?: number | null } {
  const action = payload?.action;
  if (!['prompted', 'snooze', 'dismiss', 'complete'].includes(action)) {
    throw new InterviewDomainError('invalid_payload', 'retro prompt action is invalid.', false, 'fix_input');
  }
  let snoozeUntil: number | null | undefined;
  if (action === 'snooze') {
    if (payload?.snoozeUntil !== undefined && payload?.snoozeUntil !== null) {
      snoozeUntil = optionalEpoch(payload.snoozeUntil, 'snoozeUntil');
    } else if (payload?.snoozeMs !== undefined && payload?.snoozeMs !== null) {
      const snoozeMs = optionalEpoch(payload.snoozeMs, 'snoozeMs');
      snoozeUntil = Date.now() + Math.min(Math.max(snoozeMs ?? 0, 5 * 60 * 1000), 14 * 24 * 60 * 60 * 1000);
    }
  }
  return { action, snoozeUntil };
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

  parseSourceText(input: unknown): InterviewSourceParseResult {
    try {
      return parseInterviewSourceText(normalizeSourceParseInput(input));
    } catch (error: any) {
      if (error?.code === 'parser_input_too_large') {
        throw new InterviewDomainError('parser_input_too_large', 'Source text is too large. Paste a shorter vacancy or HR message.', false, 'fix_input');
      }
      if (error?.code === 'parser_no_fields') {
        throw new InterviewDomainError('parser_no_fields', error.message || 'Could not extract interview fields.', false, 'fix_input');
      }
      throw error;
    }
  }

  parseApplicationIntake(input: unknown): ApplicationIntakeResult {
    const normalized = normalizeApplicationIntakeInput(input);
    const parsed = this.parseSourceText({ text: normalized.text });
    const classification = classificationFromParsed(parsed);
    const timezone = parsed.fields.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hasStage = classification === 'vacancy_with_scheduled_stage';
    const warnings = [...parsed.warnings];
    if (normalized.useAi) {
      warnings.push('AI enrichment is not configured yet; deterministic extraction was used.');
    }
    const missingFields: string[] = [];
    if (!parsed.fields.company) missingFields.push('company');
    if (!parsed.fields.roleTitle && !parsed.fields.title) missingFields.push('roleTitle');
    if (hasStage && parsed.fields.startsAt && !parsed.fields.endsAt) missingFields.push('endsAt');
    const title = parsed.fields.title
      || [parsed.fields.company, parsed.fields.roleTitle].filter(Boolean).join(' · ')
      || 'Untitled vacancy';
    const result: ApplicationIntakeResult = {
      classification,
      confidence: intakeConfidence(parsed),
      application: {
        title,
        company: parsed.fields.company ?? undefined,
        roleTitle: parsed.fields.roleTitle ?? undefined,
        source: parsed.fields.source ?? parsed.detectedSource ?? normalized.sourceHint ?? undefined,
        vacancyUrl: parsed.fields.vacancyUrl ?? undefined,
        compensationText: parsed.dossier?.compensationText ?? undefined,
        requirements: parsed.dossier?.requirements ?? [],
        risks: parsed.dossier?.risks ?? [],
        questionsToAsk: parsed.dossier?.questionsToAsk ?? [],
        rawSourceText: parsed.fields.rawSourceText ?? parsed.normalizedText ?? normalized.text,
      },
      warnings,
      missingFields,
    };
    if (hasStage) {
      result.stage = {
        stageType: stageTypeFromParsedStage(parsed.fields.stage),
        title: parsed.fields.stage ?? 'Initial stage',
        startsAt: parsed.fields.startsAt ?? undefined,
        endsAt: parsed.fields.endsAt ?? undefined,
        timezone,
        meetingUrl: parsed.fields.meetingUrl ?? undefined,
        status: parsed.fields.startsAt ? 'scheduled' : 'draft',
      };
    }
    if (result.stage?.startsAt && result.stage.endsAt) {
      result.calendarProposal = {
        shouldCreate: true,
        title,
        startsAt: result.stage.startsAt,
        endsAt: result.stage.endsAt,
        timezone,
        locationOrUrl: result.stage.meetingUrl,
        description: [
          result.application.company ? `Company: ${result.application.company}` : null,
          result.application.roleTitle ? `Role: ${result.application.roleTitle}` : null,
          result.application.vacancyUrl ? `Vacancy: ${result.application.vacancyUrl}` : null,
        ].filter(Boolean).join('\n'),
        reminders: [{ minutesBefore: 15 }],
      };
    }
    return result;
  }

  listApplications(): ApplicationDetail[] {
    return this.repo.listApplications();
  }

  getApplication(id: string): ApplicationDetail {
    const detail = this.repo.getApplication(assertId(id, 'applicationId'));
    if (!detail) throw new InterviewDomainError('not_found', 'Application not found.', false, 'none');
    return detail;
  }

  createApplicationFromIntake(operationId: string, payload: unknown): ApplicationCreateFromIntakeResult {
    assertId(operationId, 'operationId');
    const input = payload as ApplicationCreateFromIntakePayload;
    return this.repo.createApplicationFromIntake(normalizeApplicationIntakeResult(input?.intake), operationId);
  }

  update(id: string, patch: unknown): InterviewDetail {
    const updated = this.repo.update(assertId(id), normalizeUpdatePatch(patch));
    if (!updated) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');
    return this.repo.get(updated.id, ['dossier', 'prep', 'retros', 'questions', 'meetings']) as InterviewDetail;
  }

  updateStageCalendarForLegacyInterview(interviewId: string, patch: unknown): void {
    this.repo.updateStageCalendarForLegacyInterview(
      assertId(interviewId, 'interviewId'),
      normalizeUpdatePatch(patch),
    );
  }

  updateCalendarForLegacyInterview(interviewId: string, patch: unknown): InterviewDetail {
    const updated = this.repo.updateCalendarForLegacyInterview(
      assertId(interviewId, 'interviewId'),
      normalizeUpdatePatch(patch),
    );
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

  saveDossier(interviewId: string, operationId: string, payload: unknown): VacancyDossier {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    return this.repo.saveDossier(id, normalizeDossier(payload), assertId(operationId, 'operationId'));
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

  getRetroPrompt(interviewId: string): RetroPromptDecision {
    const id = assertId(interviewId, 'interviewId');
    const detail = this.repo.get(id, ['retros']);
    if (!detail) throw new InterviewDomainError('not_found', 'Interview not found.', false, 'none');

    let state = this.repo.getRetroPromptState(id);
    if (detail.archivedAt || detail.status === 'archived') {
      return { interviewEventId: id, due: false, reason: 'archived', state };
    }
    if ((detail.retros ?? []).length > 0) {
      state = this.repo.recordRetroPromptAction(id, 'complete');
      return { interviewEventId: id, due: false, reason: 'has_retro', state };
    }
    const now = Date.now();
    if (!detail.endsAt || detail.endsAt > now) {
      return { interviewEventId: id, due: false, reason: 'not_ended', state };
    }
    if (state?.completedAt) return { interviewEventId: id, due: false, reason: 'already_completed', state };
    if (state?.dismissedAt) return { interviewEventId: id, due: false, reason: 'dismissed', state };
    if (state?.snoozedUntil && state.snoozedUntil > now) {
      return { interviewEventId: id, due: false, reason: 'snoozed', state };
    }
    if (!state?.promptedAt) {
      state = this.repo.recordRetroPromptAction(id, 'prompted', { now });
    }
    return { interviewEventId: id, due: true, reason: 'due', state };
  }

  updateRetroPrompt(interviewId: string, payload: RetroPromptActionPayload): RetroPromptDecision {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    const action = normalizeRetroPromptAction(payload);
    this.repo.recordRetroPromptAction(id, action.action, { snoozeUntil: action.snoozeUntil });
    return this.getRetroPrompt(id);
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
