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

export type CalendarSyncStatus =
  | 'local_only'
  | 'linked'
  | 'changed'
  | 'missing'
  | 'calendar_disabled'
  | 'refresh_error';

export type InterviewErrorCode =
  | 'invalid_payload'
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
  | 'unexpected_error';

export type InterviewErrorAction =
  | 'fix_input'
  | 'refresh_calendar'
  | 'connect_calendar'
  | 'open_existing'
  | 'retry'
  | 'manual_attach'
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
  questions?: InterviewQuestion[];
  contacts?: Array<Contact & { relationship?: string | null }>;
  linkedMeetings?: Array<{ id: string; title: string; date: string; duration: string }>;
}

export interface ReadinessResult {
  score: number;
  level: 'not_started' | 'needs_work' | 'ready';
  blockers: string[];
  warnings: string[];
  completed: string[];
  nextAction: string | null;
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
