import type {
  ApplicationCreateFromIntakePayload,
  ApplicationCreateFromIntakeResult,
  ApplicationDetail,
  ApplicationIntakeInput,
  ApplicationIntakeResult,
  ApplicationIntakeTask,
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
  InterviewRetroEvaluation,
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
import type { AiTask, TaskModelResolution } from '../TaskModelPolicy';

const VALID_STATUSES = new Set(['active', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived']);
const VALID_PRIORITIES = new Set(['low', 'normal', 'high']);
const VALID_CALENDAR_PROVIDERS = new Set(['google', 'macos', 'manual']);
const VALID_CALENDAR_SYNC_STATUSES = new Set(['local_only', 'linked', 'changed', 'missing', 'calendar_disabled', 'refresh_error']);
const VALID_INTAKE_CLASSIFICATIONS = new Set(['vacancy_only', 'vacancy_with_scheduled_stage', 'stage_update_for_existing_vacancy', 'calendar_only', 'unknown']);
const VALID_APPLICATION_INTAKE_TASKS = new Set(['vacancy_intake', 'scraping', 'agent_actions']);
const VALID_STAGE_TYPES = new Set(['recruiter_screen', 'technical_screen', 'system_design', 'leadership', 'final', 'offer_security', 'custom']);
const VALID_STAGE_STATUSES = new Set(['draft', 'scheduled', 'done', 'waiting_feedback', 'passed', 'rejected', 'canceled', 'archived']);

export type InterviewModelResolver = (task: AiTask) => TaskModelResolution;
export type InterviewStructuredGenerator = (prompt: string, options?: { modelId?: string | null; task?: AiTask }) => Promise<string>;

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
  const task = typeof payload?.task === 'string' && VALID_APPLICATION_INTAKE_TASKS.has(payload.task)
    ? payload.task as ApplicationIntakeTask
    : undefined;
  return {
    text: textValue,
    sourceHint: sourceHint as ApplicationIntakeInput['sourceHint'],
    candidateApplicationIds: Array.isArray(payload?.candidateApplicationIds)
      ? payload.candidateApplicationIds.map((id: unknown, index: number) => assertId(id, `candidateApplicationIds[${index}]`))
      : undefined,
    useAi: Boolean(payload?.useAi),
    task,
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
      description: text(application.description, 'intake.application.description', 1200) ?? undefined,
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

function clampConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function cleanStringArray(value: unknown, maxItems = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);
}

function extractJsonObject(raw: string): any {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain JSON.');
    return JSON.parse(match[0]);
  }
}

function normalizeRetroEvaluationResult(raw: string): Pick<InterviewRetroEvaluation, 'summary' | 'signals' | 'risks' | 'followups' | 'confidence'> {
  const parsed = extractJsonObject(raw);
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 1200) : '';
  return {
    summary: summary || null,
    signals: cleanStringArray(parsed.signals),
    risks: cleanStringArray(parsed.risks),
    followups: cleanStringArray(parsed.followups),
    confidence: clampConfidence(parsed.confidence),
  };
}

function buildRetroEvaluationPrompt(input: {
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  stage?: string | null;
  transcriptText: string;
}): string {
  const transcript = input.transcriptText.slice(0, 18000);
  return `You are evaluating a completed job interview from the candidate's perspective.

Vacancy:
- Title: ${input.title}
- Company: ${input.company || 'unknown'}
- Role: ${input.roleTitle || 'unknown'}
- Stage: ${input.stage || 'unknown'}

Transcript:
${transcript}

Return ONLY valid JSON with this shape:
{
  "summary": "2-4 sentences with the main interview signal. Do not invent facts absent from the transcript.",
  "signals": ["specific positive signal from the transcript"],
  "risks": ["specific concern or weak moment from the transcript"],
  "followups": ["concrete next action for the candidate"],
	  "confidence": 0.0
	}`;
}

function cleanBoundedText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.trim().slice(0, max) || undefined : undefined;
}

function cleanBoundedUrl(value: unknown): string | undefined {
  const raw = cleanBoundedText(value, 2048);
  if (!raw) return undefined;
  try {
    new URL(raw);
    return raw;
  } catch {
    return undefined;
  }
}

function cleanEpoch(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function enumOrFallback<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value) ? value as T : fallback;
}

function mergeStringArrays(fallback: string[] | undefined, value: unknown, maxItems: number): string[] {
  const cleaned = cleanStringArray(value, maxItems);
  return cleaned.length > 0 ? cleaned : fallback ?? [];
}

function buildApplicationDescription(result: Pick<ApplicationIntakeResult, 'application' | 'stage'>): string {
  const company = result.application.company?.trim();
  const role = result.application.roleTitle?.trim() || result.application.title?.trim();
  const source = result.application.source?.trim();
  const stage = result.stage?.title?.trim();
  const schedule = result.stage?.startsAt ? new Date(result.stage.startsAt).toLocaleString() : null;
  const subject = [company, role].filter(Boolean).join(' · ') || role || company || 'Vacancy';
  const parts = [`${subject}.`];
  if (source) parts.push(`Source: ${source}.`);
  if (stage) parts.push(`Current process: ${stage}${schedule ? ` scheduled for ${schedule}` : ''}.`);
  return parts.join(' ').slice(0, 1200);
}

function recomputeApplicationIntakeMissingFields(result: ApplicationIntakeResult): string[] {
  const missingFields: string[] = [];
  if (!result.application.company) missingFields.push('company');
  if (!result.application.roleTitle && !result.application.title) missingFields.push('roleTitle');
  if (result.stage?.startsAt && !result.stage.endsAt) missingFields.push('endsAt');
  return missingFields;
}

function reconcileApplicationIntakeWarnings(result: ApplicationIntakeResult, warnings: string[]): string[] {
  const next = new Set(warnings);
  if (result.application.company) next.delete('company_not_detected');
  if (result.application.roleTitle) next.delete('role_not_detected');
  if (
    result.confidence >= 0.6
    && result.application.company
    && (result.application.roleTitle || result.application.title)
  ) {
    next.delete('low_confidence_parse');
  }
  return Array.from(next);
}

function attachCalendarProposal(result: ApplicationIntakeResult): ApplicationIntakeResult {
  delete result.calendarProposal;
  if (result.stage?.startsAt && result.stage.endsAt) {
    const timezone = result.stage.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const title = result.application.title
      || [result.application.company, result.application.roleTitle].filter(Boolean).join(' · ')
      || result.stage.title
      || 'Interview';
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

function buildDeterministicApplicationIntakeResult(
  normalized: ApplicationIntakeInput,
  parsed: InterviewSourceParseResult,
  warnings: string[] = parsed.warnings,
): ApplicationIntakeResult {
  const classification = classificationFromParsed(parsed);
  const timezone = parsed.fields.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasStage = classification === 'vacancy_with_scheduled_stage';
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
      description: undefined,
      source: parsed.fields.source ?? parsed.detectedSource ?? normalized.sourceHint ?? undefined,
      vacancyUrl: parsed.fields.vacancyUrl ?? undefined,
      compensationText: parsed.dossier?.compensationText ?? undefined,
      requirements: parsed.dossier?.requirements ?? [],
      risks: parsed.dossier?.risks ?? [],
      questionsToAsk: parsed.dossier?.questionsToAsk ?? [],
      rawSourceText: parsed.fields.rawSourceText ?? parsed.normalizedText ?? normalized.text,
    },
    warnings,
    missingFields: [],
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
  result.application.description = buildApplicationDescription(result);
  result.missingFields = recomputeApplicationIntakeMissingFields(result);
  return attachCalendarProposal(result);
}

function sourceExcerptForAi(sourceText: string): string {
  const normalized = sourceText.trim();
  const maxLength = 30000;
  if (normalized.length <= maxLength) return normalized;
  const headLength = 12000;
  const tailLength = 18000;
  const head = normalized.slice(0, headLength).trimEnd();
  const tail = normalized.slice(-tailLength).trimStart();
  return `${head}\n\n[... middle of long source omitted; preserved the final recruiter/calendar messages below ...]\n\n${tail}`;
}

function buildApplicationIntakePrompt(input: {
  sourceText: string;
  deterministic: ApplicationIntakeResult;
  task: ApplicationIntakeTask;
}): string {
  const deterministicDraft = {
    ...input.deterministic,
    application: {
      ...input.deterministic.application,
      rawSourceText: '[same as source text]',
    },
  };
  return `You extract job application and interview scheduling data from pasted vacancy, recruiter, calendar, browser, or email text.

Current time: ${new Date().toISOString()}
Task: ${input.task}

Rules:
- Return ONLY valid JSON. No markdown.
- Do not invent company, role, dates, links, compensation, or requirements.
- application.description must be a concise 1-3 sentence summary of what the company does, what the role is, and what is happening in the process. Do not copy the pasted source text, chat transcript, or vacancy body into description.
- application.requirements must be short bullet facts, not paragraphs. Prefix each item with a logical group such as "Stack:", "Responsibilities:", "Experience:", "Process:", "Domain:", or "Logistics:".
- Read recruiter chats as dialogue, not only as vacancy pages.
- In recruiter chats, infer the employer from phrases like "IT recruiter <Company>" or "recruiter at <Company>" when explicit.
- In recruiter chats, infer the role from phrases like "по позиции <role>", "for the <role> position", or "следующий этап по <role>" when explicit.
- For scheduling chats, the candidate's accepted slot and the final meeting confirmation override earlier offered slots.
- Treat video meeting links on non-standard company domains as meetingUrl when the surrounding text says they are meeting links.
- If the deterministic draft has company_not_detected, role_not_detected, or low_confidence_parse but the source text explicitly provides the field, fill the field and do not repeat that stale warning.
- Keep rawSourceText exactly as the source text when you return application.rawSourceText.
- If a date/time is explicit, return startsAt/endsAt as Unix epoch milliseconds.
- If only start time is known and duration is absent, omit endsAt.
- Use these enum values only:
  classification: vacancy_only, vacancy_with_scheduled_stage, stage_update_for_existing_vacancy, calendar_only, unknown
  stageType: recruiter_screen, technical_screen, system_design, leadership, final, offer_security, custom
  stage.status: draft, scheduled, done, waiting_feedback, passed, rejected, canceled, archived

Deterministic draft to improve:
${JSON.stringify(deterministicDraft, null, 2)}

Source text:
${sourceExcerptForAi(input.sourceText)}

Return this JSON shape:
{
  "classification": "vacancy_only",
  "confidence": 0.0,
  "application": {
    "title": "short display title",
    "company": "company name",
    "roleTitle": "role title",
    "description": "1-3 sentence summary, never the raw pasted text",
    "source": "HH/Getmatch/Telegram/email/browser/manual/etc",
    "vacancyUrl": "https://...",
    "compensationText": "text if present",
    "requirements": ["Stack: Python", "Responsibilities: Build production ML services"],
    "risks": ["candidate risk or gap explicitly present"],
    "questionsToAsk": ["useful question based on the source"],
    "rawSourceText": "same source text"
  },
  "stage": {
    "stageType": "recruiter_screen",
    "title": "stage title",
    "startsAt": 0,
    "endsAt": 0,
    "timezone": "IANA timezone if known",
    "meetingUrl": "https://...",
    "status": "scheduled"
  },
  "warnings": [],
  "missingFields": []
}`;
}

function normalizeAiApplicationIntakeResult(
  raw: string,
  fallback: ApplicationIntakeResult,
  normalized: ApplicationIntakeInput,
): ApplicationIntakeResult {
  const parsed = extractJsonObject(raw);
  const payload = parsed?.intake && typeof parsed.intake === 'object' ? parsed.intake : parsed;
  const application = payload?.application && typeof payload.application === 'object' ? payload.application : {};
  const stagePayload = payload?.stage && typeof payload.stage === 'object' ? payload.stage : null;

  const result: ApplicationIntakeResult = {
    classification: enumOrFallback(payload?.classification, VALID_INTAKE_CLASSIFICATIONS, fallback.classification),
    confidence: clampConfidence(payload?.confidence) ?? fallback.confidence,
    application: {
      title: cleanBoundedText(application.title, 180) ?? fallback.application.title,
      company: cleanBoundedText(application.company, 120) ?? fallback.application.company,
      roleTitle: cleanBoundedText(application.roleTitle, 120) ?? fallback.application.roleTitle,
      description: cleanBoundedText(application.description, 1200) ?? fallback.application.description,
      source: cleanBoundedText(application.source, 120) ?? fallback.application.source ?? normalized.sourceHint,
      vacancyUrl: cleanBoundedUrl(application.vacancyUrl) ?? fallback.application.vacancyUrl,
      compensationText: cleanBoundedText(application.compensationText, 2000) ?? fallback.application.compensationText,
      requirements: mergeStringArrays(fallback.application.requirements, application.requirements, 24),
      risks: mergeStringArrays(fallback.application.risks, application.risks, 12),
      questionsToAsk: mergeStringArrays(fallback.application.questionsToAsk, application.questionsToAsk, 12),
      rawSourceText: normalized.text,
    },
    warnings: [
      ...fallback.warnings,
      ...cleanStringArray(payload?.warnings, 20),
    ],
    missingFields: [],
  };

  const fallbackStage = fallback.stage;
  const hasAiStage = Boolean(stagePayload);
  const stageTitle = cleanBoundedText(stagePayload?.title, 180);
  const startsAt = cleanEpoch(stagePayload?.startsAt) ?? fallbackStage?.startsAt;
  const endsAt = cleanEpoch(stagePayload?.endsAt) ?? fallbackStage?.endsAt;
  const meetingUrl = cleanBoundedUrl(stagePayload?.meetingUrl) ?? fallbackStage?.meetingUrl;
  if (hasAiStage || fallbackStage) {
    result.stage = {
      stageType: enumOrFallback(
        stagePayload?.stageType,
        VALID_STAGE_TYPES,
        fallbackStage?.stageType ?? stageTypeFromParsedStage(stageTitle),
      ),
      title: stageTitle ?? fallbackStage?.title ?? 'Interview stage',
      startsAt,
      endsAt,
      timezone: cleanBoundedText(stagePayload?.timezone, 120) ?? fallbackStage?.timezone,
      meetingUrl,
      status: enumOrFallback(
        stagePayload?.status,
        VALID_STAGE_STATUSES,
        fallbackStage?.status ?? (startsAt ? 'scheduled' : 'draft'),
      ),
    };
  }

  if (
    result.stage
    && result.classification !== 'stage_update_for_existing_vacancy'
    && result.classification !== 'calendar_only'
    && (result.stage.startsAt || result.stage.meetingUrl || result.stage.title)
  ) {
    result.classification = 'vacancy_with_scheduled_stage';
  }

  const existingApplicationMatch = payload?.existingApplicationMatch;
  if (existingApplicationMatch && typeof existingApplicationMatch === 'object') {
    const applicationId = cleanBoundedText(existingApplicationMatch.applicationId, 128);
    if (applicationId && normalized.candidateApplicationIds?.includes(applicationId)) {
      result.existingApplicationMatch = {
        applicationId,
        confidence: clampConfidence(existingApplicationMatch.confidence) ?? 0.5,
        reason: cleanBoundedText(existingApplicationMatch.reason, 1000) ?? 'Matched by AI intake.',
      };
    }
  }

  result.missingFields = recomputeApplicationIntakeMissingFields(result);
  result.warnings = reconcileApplicationIntakeWarnings(result, result.warnings);
  result.application.description = result.application.description || buildApplicationDescription(result);
  return attachCalendarProposal(result);
}

export class InterviewService {
  constructor(
    private readonly repo: InterviewRepository,
    private readonly resolveModelForTask?: InterviewModelResolver,
    private readonly generateStructuredContent?: InterviewStructuredGenerator,
  ) {}

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

  async parseApplicationIntake(input: unknown): Promise<ApplicationIntakeResult> {
    const normalized = normalizeApplicationIntakeInput(input);
    const parsed = this.parseSourceText({ text: normalized.text });
    const warnings = [...parsed.warnings];
    const deterministic = buildDeterministicApplicationIntakeResult(normalized, parsed, warnings);
    if (normalized.useAi) {
      const task = normalized.task ?? 'vacancy_intake';
      const resolution = this.resolveModelForTask?.(task);
      if (!resolution?.resolvedModelId || resolution.availability !== 'available') {
        deterministic.warnings.push(
          'AI vacancy intake is unavailable; deterministic extraction was used.',
          ...(resolution?.warnings ?? []),
        );
      } else {
        console.log('[InterviewService] application-intake:parse resolved AI model', {
          task: resolution.task,
          resolvedModelId: resolution.resolvedModelId,
          mode: resolution.requestedMode,
          fallbackUsed: resolution.fallbackUsed,
        });
        if (!this.generateStructuredContent) {
          deterministic.warnings.push('AI vacancy intake is not configured in this process; deterministic extraction was used.');
          if (resolution.fallbackUsed) deterministic.warnings.push(...resolution.warnings);
        } else {
          try {
            const raw = await this.generateStructuredContent(buildApplicationIntakePrompt({
              sourceText: normalized.text,
              deterministic,
              task,
            }), { modelId: resolution.resolvedModelId, task });
            const result = normalizeAiApplicationIntakeResult(raw, deterministic, normalized);
            if (resolution.fallbackUsed) result.warnings.push(...resolution.warnings);
            return result;
          } catch (error: any) {
            deterministic.warnings.push(
              'AI vacancy intake failed; deterministic extraction was used.',
              (error?.message || 'Unknown AI intake error.').toString().slice(0, 240),
            );
          }
        }
      }
    }
    deterministic.missingFields = recomputeApplicationIntakeMissingFields(deterministic);
    return attachCalendarProposal(deterministic);
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
    return this.repo.createApplicationFromIntake(
      normalizeApplicationIntakeResult(input?.intake),
      operationId,
      input?.selectedApplicationId ? assertId(input.selectedApplicationId, 'selectedApplicationId') : undefined,
    );
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

  getRetroEvaluation(interviewId: string): InterviewRetroEvaluation | null {
    const id = assertId(interviewId, 'interviewId');
    this.requireActiveInterview(id);
    return this.repo.getLatestRetroEvaluation(id);
  }

  async generateRetroEvaluation(interviewId: string): Promise<InterviewRetroEvaluation> {
    const id = assertId(interviewId, 'interviewId');
    const detail = this.requireActiveInterview(id);
    const linked = this.repo.getLatestLinkedMeetingTranscript(id);
    if (!linked) {
      throw new InterviewDomainError(
        'invalid_payload',
        'No linked recording transcript is available for this interview yet.',
        false,
        'fix_input',
      );
    }

    const resolution = this.resolveModelForTask?.('retro');
    if (!resolution?.resolvedModelId || resolution.availability !== 'available') {
      return this.repo.saveRetroEvaluation({
        applicationId: linked.applicationId,
        interviewStageId: linked.interviewStageId,
        interviewEventId: linked.interviewEventId ?? id,
        meetingId: linked.meeting.id,
        status: 'skipped',
        modelId: resolution?.resolvedModelId ?? null,
        error: [
          'AI retro evaluation is unavailable.',
          ...(resolution?.warnings ?? []),
        ].join(' '),
      });
    }

    if (!this.generateStructuredContent) {
      return this.repo.saveRetroEvaluation({
        applicationId: linked.applicationId,
        interviewStageId: linked.interviewStageId,
        interviewEventId: linked.interviewEventId ?? id,
        meetingId: linked.meeting.id,
        status: 'skipped',
        modelId: resolution.resolvedModelId,
        error: 'AI retro evaluation is not configured in this process.',
      });
    }

    try {
      const raw = await this.generateStructuredContent(buildRetroEvaluationPrompt({
        title: detail.title,
        company: detail.company,
        roleTitle: detail.roleTitle,
        stage: detail.stage,
        transcriptText: linked.transcriptText,
      }), { modelId: resolution.resolvedModelId, task: 'retro' });
      const normalized = normalizeRetroEvaluationResult(raw);
      return this.repo.saveRetroEvaluation({
        applicationId: linked.applicationId,
        interviewStageId: linked.interviewStageId,
        interviewEventId: linked.interviewEventId ?? id,
        meetingId: linked.meeting.id,
        status: 'ready',
        modelId: resolution.resolvedModelId,
        summary: normalized.summary,
        signals: normalized.signals,
        risks: normalized.risks,
        followups: normalized.followups,
        confidence: normalized.confidence,
        error: resolution.fallbackUsed ? resolution.warnings.join(' ') : null,
      });
    } catch (error: any) {
      return this.repo.saveRetroEvaluation({
        applicationId: linked.applicationId,
        interviewStageId: linked.interviewStageId,
        interviewEventId: linked.interviewEventId ?? id,
        meetingId: linked.meeting.id,
        status: 'failed',
        modelId: resolution.resolvedModelId,
        error: error?.message || 'AI retro evaluation failed.',
      });
    }
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
