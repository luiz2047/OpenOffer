export type InterviewStatus =
  | 'active'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived';

export type InterviewPriority = 'low' | 'normal' | 'high';

export type CalendarProvider = 'google' | 'macos' | 'manual';

export type ApplicationStatus =
  | 'lead_found'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived';

export type InterviewStageStatus =
  | 'draft'
  | 'scheduled'
  | 'done'
  | 'waiting_feedback'
  | 'passed'
  | 'rejected'
  | 'canceled'
  | 'archived';

export type InterviewStageType =
  | 'recruiter_screen'
  | 'technical_screen'
  | 'system_design'
  | 'leadership'
  | 'final'
  | 'offer_security'
  | 'custom';

export type CalendarSyncStatus =
  | 'local_only'
  | 'linked'
  | 'changed'
  | 'missing'
  | 'calendar_disabled'
  | 'refresh_error';

export type CalendarProviderId = 'google' | 'macos';

export type CalendarProviderState =
  | 'connected'
  | 'available'
  | 'permission_unknown'
  | 'needs_setup'
  | 'permission_denied'
  | 'unavailable'
  | 'syncing'
  | 'error';

export type CalendarCapability = 'yes' | 'no' | 'unknown';

export interface CalendarAttendeeSummary {
  email: string;
  name?: string;
  photoUrl?: string;
  response?: 'accepted' | 'declined' | 'tentative' | 'needsAction' | string;
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  link?: string;
  source: CalendarProviderId;
  attendees?: CalendarAttendeeSummary[];
}

export interface CalendarProviderStatus {
  provider: CalendarProviderId;
  state: CalendarProviderState;
  labelKey: string;
  detailKey?: string;
  accountLabel?: string;
  lastSyncAt?: number | null;
  lastErrorCode?: string | null;
  readCapability: CalendarCapability;
  writeCapability: CalendarCapability;
  canConnect: boolean;
}

export interface CalendarStatusResult {
  providers: CalendarProviderStatus[];
  preferredProvider: CalendarProviderId | null;
  connected: boolean;
  email?: string;
}

export interface CalendarRefreshProviderResult {
  provider: CalendarProviderId;
  ok: boolean;
  eventCount?: number;
  errorCode?: string;
}

export interface CalendarRefreshResult {
  refreshedAt: number;
  providers: CalendarRefreshProviderResult[];
  status: CalendarStatusResult;
}

export interface ClearArchivedApplicationsResult {
  applicationsDeleted: number;
  stagesDeleted: number;
  legacyEventsDeleted: number;
  meetingsDetached: number;
}

export type InterviewErrorCode =
  | 'bridge_unavailable'
  | 'invalid_payload'
  | 'invalid_stage_time_range'
  | 'ambiguous_stage'
  | 'ambiguous_application_match'
  | 'local_database_unavailable'
  | 'not_found'
  | 'calendar_disabled'
  | 'calendar_refresh_failed'
  | 'calendar_event_missing'
  | 'calendar_event_changed'
  | 'duplicate_calendar_ref'
  | 'conflict_retry'
  | 'ambiguous_meeting_match'
  | 'meeting_attach_failed'
  | 'interview_deleted_or_archived'
  | 'parser_input_too_large'
  | 'parser_no_fields'
  | 'migration_incomplete'
  | 'provider_unavailable'
  | 'stale_proposal'
  | 'unexpected_error';

export type InterviewErrorAction =
  | 'fix_input'
  | 'refresh_calendar'
  | 'connect_calendar'
  | 'open_existing'
  | 'retry'
  | 'manual_attach'
  | 'choose_stage'
  | 'choose_application'
  | 'none';

export type InterviewIpcResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: InterviewErrorCode;
      message: string;
      retryable: boolean;
      action: InterviewErrorAction;
    };

export interface CalendarSnapshot {
  provider: CalendarProvider;
  calendarId?: string;
  eventId?: string;
  title?: string;
  startsAt?: number;
  endsAt?: number;
  meetingUrl?: string;
  attendeeEmails?: string[];
  attendeeNames?: string[];
  sourceUpdatedAt?: number;
  capturedAt: number;
}

export interface InterviewEvent {
  id: string;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  stage?: string | null;
  status: InterviewStatus;
  priority: InterviewPriority;
  source?: string | null;
  vacancyUrl?: string | null;
  meetingUrl?: string | null;
  calendarProvider?: CalendarProvider | null;
  calendarId?: string | null;
  calendarEventId?: string | null;
  calendarSnapshot?: CalendarSnapshot | null;
  calendarLastSeenAt?: number | null;
  calendarMissingSince?: number | null;
  calendarSyncStatus: CalendarSyncStatus;
  startsAt?: number | null;
  endsAt?: number | null;
  timezone?: string | null;
  rawSourceText?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  applicationId?: string | null;
  selectedStageId?: string | null;
}

export interface InterviewListItem
  extends Pick<
    InterviewEvent,
    | 'id'
    | 'title'
    | 'company'
    | 'roleTitle'
    | 'stage'
    | 'status'
    | 'priority'
    | 'source'
    | 'startsAt'
    | 'endsAt'
    | 'timezone'
    | 'calendarSyncStatus'
    | 'updatedAt'
  > {
  readinessLevel?: ReadinessResult['level'];
  readinessScore?: number;
  linkedMeetingCount: number;
  questionCount: number;
  applicationId?: string | null;
  selectedStageId?: string | null;
}

export interface ApplicationRecord {
  id: string;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  status: ApplicationStatus;
  priority: InterviewPriority;
  source?: string | null;
  sourceUrl?: string | null;
  vacancyUrl?: string | null;
  compensationText?: string | null;
  locationFormat?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: number | null;
  rawSourceText?: string | null;
  legacyInterviewEventId?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface InterviewStage {
  id: string;
  applicationId: string;
  stageType: InterviewStageType;
  title: string;
  status: InterviewStageStatus;
  startsAt?: number | null;
  endsAt?: number | null;
  timezone?: string | null;
  format?: InterviewStageFormat | null;
  meetingUrl?: string | null;
  calendarProvider?: CalendarProvider | null;
  calendarId?: string | null;
  calendarEventId?: string | null;
  calendarSnapshot?: CalendarSnapshot | null;
  calendarLastSeenAt?: number | null;
  calendarMissingSince?: number | null;
  calendarSyncStatus: CalendarSyncStatus;
  rawSourceText?: string | null;
  legacyInterviewEventId?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface ApplicationDetail extends ApplicationRecord {
  stages: InterviewStage[];
  selectedStageId?: string | null;
  legacyInterviewEventId?: string | null;
  dossier?: VacancyDossier | null;
  linkedMeetings?: LinkedMeeting[];
}

export type IntakeClassification =
  | 'vacancy_only'
  | 'vacancy_with_scheduled_stage'
  | 'stage_update_for_existing_vacancy'
  | 'calendar_only'
  | 'unknown';

export type ApplicationIntakeTask = 'vacancy_intake' | 'scraping' | 'agent_actions';

export interface ApplicationIntakeInput {
  text: string;
  sourceHint?: 'telegram' | 'hh' | 'getmatch' | 'email' | 'calendar' | 'browser' | 'manual';
  candidateApplicationIds?: string[];
  useAi?: boolean;
  task?: ApplicationIntakeTask;
}

export interface ApplicationIntakeResult {
  classification: IntakeClassification;
  confidence: number;
  application: {
    title?: string;
    company?: string;
    roleTitle?: string;
    description?: string;
    source?: string;
    vacancyUrl?: string;
    compensationText?: string;
    requirements?: string[];
    risks?: string[];
    questionsToAsk?: string[];
    rawSourceText: string;
  };
  stage?: {
    stageType?: InterviewStageType;
    title?: string;
    startsAt?: number;
    endsAt?: number;
    timezone?: string;
    meetingUrl?: string;
    status?: InterviewStageStatus;
  };
  existingApplicationMatch?: {
    applicationId: string;
    confidence: number;
    reason: string;
  };
  calendarProposal?: {
    shouldCreate: boolean;
    title: string;
    startsAt: number;
    endsAt: number;
    timezone: string;
    locationOrUrl?: string;
    description: string;
    reminders: Array<{ minutesBefore: number }>;
  };
  warnings: string[];
  missingFields: string[];
}

export interface ApplicationCreateFromIntakePayload {
  intake: ApplicationIntakeResult;
  selectedApplicationId?: string | null;
}

export interface ApplicationCreateFromIntakeResult {
  application: ApplicationDetail;
  legacyInterview?: InterviewDetail | null;
}

export interface ApplicationListInput {
  status?: ApplicationStatus | ApplicationStatus[];
  includeArchived?: boolean;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ApplicationUpdatePatch {
  title?: string;
  company?: string | null;
  roleTitle?: string | null;
  status?: ApplicationStatus;
  priority?: InterviewPriority;
  source?: string | null;
  sourceUrl?: string | null;
  vacancyUrl?: string | null;
  compensationText?: string | null;
  locationFormat?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: number | null;
  rawSourceText?: string | null;
}

export type InterviewStageFormat = 'online' | 'onsite' | 'phone' | 'async' | 'unknown';

export interface InterviewStageCreatePayload {
  applicationId: string;
  stageType?: InterviewStageType;
  title: string;
  status?: InterviewStageStatus;
  startsAt?: number | null;
  endsAt?: number | null;
  timezone?: string | null;
  format?: InterviewStageFormat | null;
  meetingUrl?: string | null;
  calendarProvider?: CalendarProvider | null;
  calendarSyncStatus?: CalendarSyncStatus;
  rawSourceText?: string | null;
}

export interface InterviewStageUpdatePatch {
  stageType?: InterviewStageType;
  title?: string;
  status?: InterviewStageStatus;
  startsAt?: number | null;
  endsAt?: number | null;
  timezone?: string | null;
  format?: InterviewStageFormat | null;
  meetingUrl?: string | null;
  calendarProvider?: CalendarProvider | null;
  calendarId?: string | null;
  calendarEventId?: string | null;
  calendarSnapshot?: CalendarSnapshot | null;
  calendarLastSeenAt?: number | null;
  calendarMissingSince?: number | null;
  calendarSyncStatus?: CalendarSyncStatus;
  rawSourceText?: string | null;
}

export interface InterviewStageArchiveResult {
  archived: boolean;
  application: ApplicationDetail;
}

export interface InterviewStageCalendarEventPayload {
  provider: Extract<CalendarProvider, 'google' | 'macos'>;
}

export interface VacancyDossier {
  id: string;
  interviewEventId: string;
  description?: string | null;
  requirements: string[];
  compensationText?: string | null;
  fitHypothesis?: string | null;
  risks: string[];
  questionsToAsk: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VacancyDossierPayload {
  description?: string | null;
  requirements?: string[];
  compensationText?: string | null;
  fitHypothesis?: string | null;
  risks?: string[];
  questionsToAsk?: string[];
}

export interface PrepBrief {
  id: string;
  interviewEventId: string;
  oneLineGoal?: string | null;
  pitch30s?: string | null;
  pitch2m?: string | null;
  expectedTopics: string[];
  cheatsheet?: string | null;
  riskHandling: string[];
  lastChecklist: string[];
  updatedAt: string;
}

export interface InterviewRetro {
  id: string;
  interviewEventId: string;
  passProbability?: number | null;
  mainSignal?: string | null;
  strongMoments: string[];
  weakMoments: string[];
  newFacts: string[];
  followUpActions: string[];
  createdAt: string;
}

export type RetroEvaluationStatus = 'pending_transcript' | 'generating' | 'ready' | 'failed' | 'skipped';

export interface InterviewRetroEvaluation {
  id: string;
  applicationId?: string | null;
  interviewStageId?: string | null;
  interviewEventId?: string | null;
  meetingId: string;
  status: RetroEvaluationStatus;
  modelId?: string | null;
  summary?: string | null;
  signals: string[];
  risks: string[];
  followups: string[];
  confidence?: number | null;
  error?: string | null;
  isActive: boolean;
  supersededAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewQuestion {
  id: string;
  interviewEventId: string;
  questionText: string;
  category?: string | null;
  quality?: number | null;
  weakSpot: boolean;
  followUpNote?: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  telegramHandle?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewContactLink {
  interviewEventId: string;
  contactId: string;
  relationship?: string | null;
}

export interface InterviewDetail extends InterviewEvent {
  dossier?: VacancyDossier | null;
  prep?: PrepBrief | null;
  retros?: InterviewRetro[];
  retroEvaluation?: InterviewRetroEvaluation | null;
  questions?: InterviewQuestion[];
  contacts?: Array<Contact & { relationship?: string | null }>;
  linkedMeetings?: LinkedMeeting[];
}

export interface LinkedMeeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  calendarEventId?: string | null;
  interviewEventId?: string | null;
  interviewStageId?: string | null;
  applicationId?: string | null;
}

export interface ReadinessResult {
  score: number;
  level: 'not_started' | 'needs_work' | 'ready';
  blockers: string[];
  warnings: string[];
  completed: string[];
  nextAction: string | null;
}

export type RetroPromptAction = 'prompted' | 'snooze' | 'dismiss' | 'complete';

export type RetroPromptReason =
  | 'due'
  | 'not_ended'
  | 'already_completed'
  | 'has_retro'
  | 'dismissed'
  | 'snoozed'
  | 'archived';

export interface RetroPromptState {
  interviewEventId: string;
  promptedAt?: number | null;
  dismissedAt?: number | null;
  snoozedUntil?: number | null;
  completedAt?: number | null;
  updatedAt: string;
}

export interface RetroPromptDecision {
  interviewEventId: string;
  due: boolean;
  reason: RetroPromptReason;
  state: RetroPromptState | null;
}

export interface RetroPromptActionPayload {
  action: RetroPromptAction;
  snoozeUntil?: number | null;
  snoozeMs?: number | null;
}

export interface InterviewSourceParseInput {
  text: string;
}

export interface InterviewSourceParseResult {
  fields: Partial<InterviewCreatePayload>;
  dossier: VacancyDossierPayload;
  prep: Pick<PrepBriefPayload, 'expectedTopics' | 'cheatsheet' | 'riskHandling'>;
  warnings: string[];
  fieldCount: number;
  detectedSource?: string | null;
  normalizedText: string;
}

export interface InterviewListInput {
  range?: { start?: number; end?: number };
  status?: InterviewStatus | InterviewStatus[];
  limit?: number;
  offset?: number;
}

export interface InterviewGetInput {
  id: string;
  include?: Array<'dossier' | 'prep' | 'retros' | 'questions' | 'contacts' | 'meetings'>;
}

export interface InterviewCreatePayload {
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  stage?: string | null;
  status?: InterviewStatus;
  priority?: InterviewPriority;
  source?: string | null;
  vacancyUrl?: string | null;
  meetingUrl?: string | null;
  startsAt?: number | null;
  endsAt?: number | null;
  timezone?: string | null;
  rawSourceText?: string | null;
  calendarProvider?: CalendarProvider | null;
  calendarId?: string | null;
  calendarEventId?: string | null;
  calendarSnapshot?: CalendarSnapshot | null;
  calendarLastSeenAt?: number | null;
  calendarSyncStatus?: CalendarSyncStatus;
}

export interface InterviewUpdatePatch extends Partial<InterviewCreatePayload> {
  calendarProvider?: CalendarProvider | null;
  calendarId?: string | null;
  calendarEventId?: string | null;
  calendarSnapshot?: CalendarSnapshot | null;
  calendarLastSeenAt?: number | null;
  calendarMissingSince?: number | null;
  calendarSyncStatus?: CalendarSyncStatus;
}

export interface PrepBriefPayload {
  oneLineGoal?: string | null;
  pitch30s?: string | null;
  pitch2m?: string | null;
  expectedTopics?: string[];
  cheatsheet?: string | null;
  riskHandling?: string[];
  lastChecklist?: string[];
}

export interface InterviewRetroPayload {
  passProbability?: number | null;
  mainSignal?: string | null;
  strongMoments?: string[];
  weakMoments?: string[];
  newFacts?: string[];
  followUpActions?: string[];
}

export interface InterviewQuestionPayload {
  id?: string;
  questionText: string;
  category?: string | null;
  quality?: number | null;
  weakSpot?: boolean;
  followUpNote?: string | null;
}

export interface ContactPayload {
  id?: string;
  name: string;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  telegramHandle?: string | null;
  notes?: string | null;
}
