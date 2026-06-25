import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  FileText,
  Link as LinkIcon,
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type {
  ApplicationDetail,
  ApplicationIntakeResult,
  ApplicationStatus,
  ApplicationUpdatePatch,
  CalendarEventSummary,
  CalendarProvider,
  CalendarSnapshot,
  CalendarStatusResult,
  InterviewCreatePayload,
  InterviewDetail,
  InterviewErrorCode,
  InterviewListItem,
  InterviewPriority,
  InterviewQuestionPayload,
  InterviewRetroEvaluation,
  InterviewRetroPayload,
  InterviewStage,
  InterviewStageCreatePayload,
  InterviewStageFormat,
  InterviewStatus,
  InterviewStageStatus,
  InterviewStageType,
  InterviewStageUpdatePatch,
  LinkedMeeting,
  PrepBriefPayload,
  RetroPromptDecision,
  VacancyDossierPayload,
} from '../../types/interviews';
import { applicationApi, interviewApi, stageApi } from './api';
import { CalendarDatePickerButton } from './CalendarDatePickerButton';
import { DateTimePickerField } from './DateTimePickerField';
import { createInterviewUiError, normalizeInterviewError, type InterviewUiError } from './interviewErrors';
import {
  formatCalendarDayLabel,
  isStageDateRangeInvalid,
  normalizeEpoch,
  normalizeStageDateRange,
  type StageDateRangeField,
} from './dateTime';
import type { TopSearchResultRow, VacancyTopSearchContext } from './topSearchHelpers';
import { getNearestStage } from './vacancySelectors';

interface MeetingSummary {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
}

export interface InterviewMeetingStartMetadata {
  title?: string;
  calendarEventId?: string;
  interviewEventId?: string;
  interviewStageId?: string;
  applicationId?: string;
  source?: 'manual' | 'calendar';
}

interface InterviewCommandCenterProps {
  meetings: MeetingSummary[];
  upcomingEvents: CalendarEventSummary[];
  isRefreshing: boolean;
  isMeetingActive: boolean;
  onRefresh: () => Promise<void> | void;
  onStartMeeting: (metadata?: InterviewMeetingStartMetadata) => void;
  onOpenMeeting: (meeting: MeetingSummary) => void;
  onOpenSettings: (tab?: string) => void;
  onCalendarConnected: (connected: boolean) => void;
  onSearchContextChange?: (context: VacancyTopSearchContext | null) => void;
}

const STATUS_OPTIONS: InterviewStatus[] = ['active', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived'];
const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = ['lead_found', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived'];
const PRIORITY_OPTIONS: InterviewPriority[] = ['normal', 'high', 'low'];
const DETAIL_TABS = ['Vacancy', 'Stages'] as const;
const STAGE_TYPE_OPTIONS: InterviewStageType[] = ['recruiter_screen', 'technical_screen', 'system_design', 'leadership', 'final', 'offer_security', 'custom'];
const STAGE_STATUS_OPTIONS: InterviewStageStatus[] = ['draft', 'scheduled', 'done', 'waiting_feedback', 'passed', 'rejected', 'canceled', 'archived'];
const STAGE_FORMAT_OPTIONS: InterviewStageFormat[] = ['online', 'onsite', 'phone', 'async', 'unknown'];

type DetailTab = 'Vacancy' | 'Stages' | 'Prep' | 'Retro' | 'Questions';
type DraftStatus = 'synced' | 'dirty' | 'saved' | 'failed';
type VacancyStatusFilter = 'active' | 'all' | ApplicationStatus;

interface VacancyListItem {
  id: string;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  source?: string | null;
  vacancyUrl?: string | null;
  status: ApplicationStatus;
  priority: InterviewPriority;
  selectedInterviewId: string | null;
  selectedStageId?: string | null;
  startsAt?: number | null;
  stageTitle?: string | null;
  stageCount: number;
  linkedMeetingCount: number;
  questionCount: number;
  updatedAt: string;
  stages: InterviewListItem[];
}

const DETAIL_TAB_I18N_KEY: Record<typeof DETAIL_TABS[number], string> = {
  Vacancy: 'interviews.detailTabs.vacancy',
  Stages: 'interviews.detailTabs.stages',
};

const DRAFT_PREFIX = 'openoffer:interviews:draft';
const PANE_LAYOUT_STORAGE_KEY = 'openoffer:interviews:pane-layout:v1';
const INACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>(['rejected', 'withdrawn', 'archived']);
const PANE_LAYOUT_LIMITS = {
  calendarMin: 220,
  calendarMax: 520,
  vacancyMin: 280,
  vacancyMax: 560,
  detailMin: 420,
};
const DEFAULT_PANE_LAYOUT: InterviewPaneLayout = {
  calendarWidth: 280,
  vacancyWidth: 360,
  detailMinWidth: PANE_LAYOUT_LIMITS.detailMin,
  updatedAt: '',
};

interface InterviewPaneLayout {
  calendarWidth: number;
  vacancyWidth: number;
  detailMinWidth: number;
  updatedAt: string;
}

function draftKey(interviewId: string, kind: 'dossier' | 'prep' | 'retro'): string {
  return `${DRAFT_PREFIX}:${interviewId}:${kind}`;
}

function readLocalDraft<T>(interviewId: string, kind: 'dossier' | 'prep' | 'retro'): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(draftKey(interviewId, kind));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeLocalDraft<T>(interviewId: string, kind: 'dossier' | 'prep' | 'retro', draft: T): DraftStatus {
  try {
    if (typeof window === 'undefined') return 'failed';
    window.localStorage.setItem(draftKey(interviewId, kind), JSON.stringify(draft));
    return 'saved';
  } catch {
    return 'failed';
  }
}

function clearLocalDraft(interviewId: string, kind: 'dossier' | 'prep' | 'retro'): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey(interviewId, kind));
  } catch {
    // Local draft cleanup is best-effort.
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePaneLayout(value: Partial<InterviewPaneLayout> | null | undefined): InterviewPaneLayout {
  return {
    calendarWidth: clampNumber(
      Number(value?.calendarWidth) || DEFAULT_PANE_LAYOUT.calendarWidth,
      PANE_LAYOUT_LIMITS.calendarMin,
      PANE_LAYOUT_LIMITS.calendarMax
    ),
    vacancyWidth: clampNumber(
      Number(value?.vacancyWidth) || DEFAULT_PANE_LAYOUT.vacancyWidth,
      PANE_LAYOUT_LIMITS.vacancyMin,
      PANE_LAYOUT_LIMITS.vacancyMax
    ),
    detailMinWidth: PANE_LAYOUT_LIMITS.detailMin,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : '',
  };
}

function readPaneLayout(): InterviewPaneLayout {
  try {
    if (typeof window === 'undefined') return DEFAULT_PANE_LAYOUT;
    const raw = window.localStorage.getItem(PANE_LAYOUT_STORAGE_KEY);
    return raw ? normalizePaneLayout(JSON.parse(raw) as Partial<InterviewPaneLayout>) : DEFAULT_PANE_LAYOUT;
  } catch {
    return DEFAULT_PANE_LAYOUT;
  }
}

function persistPaneLayout(layout: InterviewPaneLayout): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PANE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    }
  } catch {
    // Pane layout persistence is best-effort.
  }
}

function formatDateTime(ms?: number | null): string {
  if (!ms) return 'Unscheduled';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(value: Date): Date {
  const next = startOfDay(value);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(next, mondayOffset);
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function copyText(value?: string | null): Promise<void> {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function joinLines(value?: string[] | null): string {
  return (value ?? []).join('\n');
}

function statusFromInterview(status: InterviewStatus): ApplicationStatus {
  return status === 'active' ? 'lead_found' : status;
}

function legacyIdForApplication(application: ApplicationDetail): string | null {
  const selectedStage = application.stages.find(stage => stage.id === application.selectedStageId);
  return selectedStage?.legacyInterviewEventId
    ?? application.stages.find(stage => stage.legacyInterviewEventId)?.legacyInterviewEventId
    ?? application.legacyInterviewEventId
    ?? null;
}

function legacyIdForVacancy(vacancy: VacancyListItem): string | null {
  return vacancy.selectedInterviewId ?? vacancy.stages.find(stage => stage.id)?.id ?? null;
}

function isActiveApplication(status: ApplicationStatus): boolean {
  return !INACTIVE_APPLICATION_STATUSES.has(status);
}

function vacancyFromApplication(application: ApplicationDetail, fallback?: VacancyListItem): VacancyListItem {
  const selectedStage = application.stages.find(stage => stage.id === application.selectedStageId) ?? application.stages[0] ?? null;
  const meetings = application.linkedMeetings ?? [];
  return {
    id: application.id,
    title: application.title,
    company: application.company,
    roleTitle: application.roleTitle,
    source: application.source,
    vacancyUrl: application.vacancyUrl,
    status: application.status,
    priority: application.priority,
    selectedInterviewId: legacyIdForApplication(application),
    selectedStageId: selectedStage?.id ?? null,
    startsAt: selectedStage?.startsAt ?? fallback?.startsAt ?? null,
    stageTitle: selectedStage?.title ?? fallback?.stageTitle ?? null,
    stageCount: application.stages.filter(stage => stage.archivedAt === null || stage.archivedAt === undefined).length,
    linkedMeetingCount: meetings.length || fallback?.linkedMeetingCount || 0,
    questionCount: fallback?.questionCount || 0,
    updatedAt: application.updatedAt,
    stages: fallback?.stages ?? [],
  };
}

function groupVacanciesFromInterviews(interviews: InterviewListItem[]): VacancyListItem[] {
  const groups = new Map<string, VacancyListItem>();
  for (const item of interviews) {
    const status = statusFromInterview(item.status);
    if (!isActiveApplication(status)) continue;
    const id = item.applicationId ?? item.id;
    const current = groups.get(id);
    const nextStages = [...(current?.stages ?? []), item].sort((a, b) => {
      const left = a.startsAt ?? Number.MAX_SAFE_INTEGER;
      const right = b.startsAt ?? Number.MAX_SAFE_INTEGER;
      return left - right || b.updatedAt.localeCompare(a.updatedAt);
    });
    const selected = nextStages.find(stage => stage.id === item.selectedStageId) ?? nextStages[0] ?? item;
    const updatedAtCandidates = [current?.updatedAt, item.updatedAt].filter(Boolean).sort();
    groups.set(id, {
      id,
      title: current?.title ?? item.title,
      company: current?.company ?? item.company,
      roleTitle: current?.roleTitle ?? item.roleTitle,
      source: current?.source ?? item.source,
      vacancyUrl: current?.vacancyUrl ?? null,
      status: current?.status === 'lead_found' ? status : current?.status ?? status,
      priority: current?.priority ?? item.priority,
      selectedInterviewId: selected.id,
      selectedStageId: selected.selectedStageId,
      startsAt: selected.startsAt,
      stageTitle: selected.stage,
      stageCount: nextStages.length,
      linkedMeetingCount: nextStages.reduce((sum, stage) => sum + stage.linkedMeetingCount, 0),
      questionCount: nextStages.reduce((sum, stage) => sum + stage.questionCount, 0),
      updatedAt: updatedAtCandidates[updatedAtCandidates.length - 1] ?? item.updatedAt,
      stages: nextStages,
    });
  }
  return Array.from(groups.values()).sort((a, b) => {
    const left = a.startsAt ?? Number.MAX_SAFE_INTEGER;
    const right = b.startsAt ?? Number.MAX_SAFE_INTEGER;
    return left - right || b.updatedAt.localeCompare(a.updatedAt);
  });
}

function groupRequirementLines(lines: string[], defaultLabel: string): Array<{ label: string; items: string[] }> {
  const groups = new Map<string, string[]>();
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*•]\s*/, '').trim();
    if (!line) continue;
    const match = line.match(/^([^:：]{2,42})[:：]\s*(.+)$/);
    const label = (match?.[1] ?? defaultLabel).trim();
    const item = (match?.[2] ?? line).trim();
    if (!item) continue;
    const current = groups.get(label) ?? [];
    current.push(item);
    groups.set(label, current);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function statusTone(status: InterviewStatus): string {
  switch (status) {
    case 'offer':
      return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    case 'rejected':
    case 'withdrawn':
      return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    case 'interviewing':
      return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
    case 'screening':
      return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    default:
      return 'text-zinc-200 bg-white/[0.04] border-white/[0.08]';
  }
}

function applicationStatusTone(status: ApplicationStatus): string {
  return statusTone(status === 'lead_found' ? 'active' : status);
}

function applicationStatusLabelKey(status: ApplicationStatus): string {
  return status === 'lead_found' ? 'interviews.status.active' : `interviews.status.${status}`;
}

function intakeClassificationLabelKey(classification: ApplicationIntakeResult['classification']): string {
  return `interviews.agent.intakeClassification.${classification}`;
}

function statusLabelKey(status: InterviewStatus, item?: Pick<InterviewListItem, 'stage' | 'startsAt' | 'selectedStageId'> | null): string {
  if (status === 'active') {
    return item?.stage || item?.startsAt || item?.selectedStageId
      ? 'interviews.status.interviewing'
      : 'interviews.status.active';
  }
  return `interviews.status.${status}`;
}

function eventProvider(event: CalendarEventSummary): CalendarProvider {
  return event.source === 'macos' ? 'macos' : 'google';
}

function eventSnapshot(event: CalendarEventSummary): CalendarSnapshot {
  return {
    provider: eventProvider(event),
    calendarId: 'primary',
    eventId: event.id,
    title: event.title,
    startsAt: new Date(event.startTime).getTime(),
    endsAt: new Date(event.endTime).getTime(),
    meetingUrl: event.link,
    attendeeEmails: (event.attendees ?? []).map(attendee => attendee.email).filter(Boolean),
    attendeeNames: (event.attendees ?? []).map(attendee => attendee.name || attendee.email).filter(Boolean),
    capturedAt: Date.now(),
  };
}

function linkedMeetingsForStage(stage: InterviewStage, meetings: LinkedMeeting[], stageCount: number): LinkedMeeting[] {
  return meetings.filter(meeting => (
    meeting.interviewStageId === stage.id
    || (stage.legacyInterviewEventId && meeting.interviewEventId === stage.legacyInterviewEventId)
    || (
      stageCount === 1
      && meeting.applicationId === stage.applicationId
      && !meeting.interviewStageId
      && !meeting.interviewEventId
    )
  ));
}

function initialCreateForm(): InterviewCreatePayload {
  return {
    title: '',
    company: '',
    roleTitle: '',
    stage: 'Recruiter screen',
    status: 'active',
    priority: 'normal',
    source: 'manual',
    vacancyUrl: '',
    meetingUrl: '',
    startsAt: null,
    endsAt: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rawSourceText: '',
  };
}

function initialDossierDraft() {
  return {
    description: '',
    requirements: '',
    compensationText: '',
    fitHypothesis: '',
    risks: '',
    questionsToAsk: '',
  };
}

function applicationDraftFromDetail(application: ApplicationDetail | null) {
  return {
    title: application?.title ?? '',
    company: application?.company ?? '',
    roleTitle: application?.roleTitle ?? '',
    status: application?.status ?? 'lead_found' as ApplicationStatus,
    priority: application?.priority ?? 'normal' as InterviewPriority,
    source: application?.source ?? '',
    sourceUrl: application?.sourceUrl ?? '',
    vacancyUrl: application?.vacancyUrl ?? '',
    compensationText: application?.compensationText ?? '',
    locationFormat: application?.locationFormat ?? '',
    nextAction: application?.nextAction ?? '',
    nextActionDueAt: normalizeEpoch(application?.nextActionDueAt),
    rawSourceText: application?.rawSourceText ?? '',
  };
}

function stageDraftFromStage(stage: InterviewStage) {
  return {
    title: stage.title,
    stageType: stage.stageType,
    status: stage.status,
    startsAt: normalizeEpoch(stage.startsAt),
    endsAt: normalizeEpoch(stage.endsAt),
    timezone: stage.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    format: stage.format ?? 'unknown' as InterviewStageFormat,
    meetingUrl: stage.meetingUrl ?? '',
    rawSourceText: stage.rawSourceText ?? '',
  };
}

function dossierDraftFromDetail(detail: InterviewDetail) {
  return {
    description: detail.dossier?.description ?? '',
    requirements: joinLines(detail.dossier?.requirements),
    compensationText: detail.dossier?.compensationText ?? '',
    fitHypothesis: detail.dossier?.fitHypothesis ?? '',
    risks: joinLines(detail.dossier?.risks),
    questionsToAsk: joinLines(detail.dossier?.questionsToAsk),
  };
}

function prepDraftFromDetail(detail: InterviewDetail) {
  return {
    oneLineGoal: detail.prep?.oneLineGoal ?? '',
    pitch30s: detail.prep?.pitch30s ?? '',
    pitch2m: detail.prep?.pitch2m ?? '',
    expectedTopics: joinLines(detail.prep?.expectedTopics),
    cheatsheet: detail.prep?.cheatsheet ?? '',
    riskHandling: joinLines(detail.prep?.riskHandling),
    lastChecklist: joinLines(detail.prep?.lastChecklist),
  };
}

function initialRetroDraft() {
  return { passProbability: '', mainSignal: '', strongMoments: '', weakMoments: '', newFacts: '', followUpActions: '' };
}

function hasDossierPayload(payload?: VacancyDossierPayload | null): boolean {
  if (!payload) return false;
  return Boolean(
    payload.description
    || payload.compensationText
    || payload.fitHypothesis
    || (payload.requirements?.length ?? 0) > 0
    || (payload.risks?.length ?? 0) > 0
    || (payload.questionsToAsk?.length ?? 0) > 0
  );
}

function hasPrepPayload(payload?: Pick<PrepBriefPayload, 'expectedTopics' | 'cheatsheet' | 'riskHandling'> | null): boolean {
  if (!payload) return false;
  return Boolean(payload.cheatsheet || (payload.expectedTopics?.length ?? 0) > 0 || (payload.riskHandling?.length ?? 0) > 0);
}

const inputClass = 'min-h-11 w-full rounded-md border border-white/[0.08] bg-[#090b0d] px-3 py-2.5 text-[13px] text-text-primary outline-none transition focus:border-cyan-300/45 focus:bg-black/30';
const labelClass = 'text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500';
const iconButtonClass = 'inline-flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60';
const paneHeaderClass = 'flex min-h-16 items-center justify-between border-b border-white/[0.07] px-4';
const primaryButtonClass = 'inline-flex min-h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-[13px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

const InterviewCommandCenter: React.FC<InterviewCommandCenterProps> = ({
  meetings,
  upcomingEvents,
  isRefreshing,
  isMeetingActive,
  onRefresh,
  onStartMeeting,
  onOpenMeeting,
  onOpenSettings,
  onCalendarConnected,
  onSearchContextChange,
}) => {
  const { t, i18n } = useTranslation();
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [retroPrompt, setRetroPrompt] = useState<RetroPromptDecision | null>(null);
  const [retroEvaluation, setRetroEvaluation] = useState<InterviewRetroEvaluation | null>(null);
  const [retroEvaluating, setRetroEvaluating] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatusResult | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [rawSourceExpanded, setRawSourceExpanded] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('Vacancy');
  const [statusFilter, setStatusFilter] = useState<VacancyStatusFilter>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<InterviewCreatePayload>(initialCreateForm);
  const [createCalendarProvider, setCreateCalendarProvider] = useState<'none' | 'google' | 'macos'>('none');
  const [intakePreview, setIntakePreview] = useState<ApplicationIntakeResult | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [dossierDraft, setDossierDraft] = useState(initialDossierDraft);
  const [applicationDraft, setApplicationDraft] = useState(() => applicationDraftFromDetail(null));
  const [applicationSaveStatus, setApplicationSaveStatus] = useState<DraftStatus>('synced');
  const [stageDrafts, setStageDrafts] = useState<Record<string, ReturnType<typeof stageDraftFromStage>>>({});
  const [stageSaveStatus, setStageSaveStatus] = useState<Record<string, DraftStatus>>({});
  const [paneLayout, setPaneLayout] = useState<InterviewPaneLayout>(() => readPaneLayout());
  const [prepDraft, setPrepDraft] = useState({
    oneLineGoal: '',
    pitch30s: '',
    pitch2m: '',
    expectedTopics: '',
    cheatsheet: '',
    riskHandling: '',
    lastChecklist: '',
  });
  const [retroDraft, setRetroDraft] = useState(initialRetroDraft);
  const [draftStatus, setDraftStatus] = useState<Record<'dossier' | 'prep' | 'retro', DraftStatus>>({
    dossier: 'synced',
    prep: 'synced',
    retro: 'synced',
  });
  const [questionDrafts, setQuestionDrafts] = useState<InterviewQuestionPayload[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [questionCategory, setQuestionCategory] = useState('');
  const [attachMeetingIds, setAttachMeetingIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InterviewUiError | null>(null);

  const showError = useCallback((err: unknown, fallbackCode: InterviewErrorCode = 'unexpected_error') => {
    setError(normalizeInterviewError(err, fallbackCode));
  }, []);

  const loadInterviews = useCallback(async () => {
    try {
      setError(null);
      const [rows, applicationRows] = await Promise.all([
        interviewApi.list({ limit: 100 }),
        applicationApi.list({ includeArchived: true }).catch(() => [] as ApplicationDetail[]),
      ]);
      setInterviews(rows);
      setApplications(applicationRows);
      setSelectedId(current => {
        const currentApplication = current
          ? applicationRows.find(application => legacyIdForApplication(application) === current)
          : null;
        if (current && (rows.some(row => row.id === current) || currentApplication)) return current;
        const firstApplication = applicationRows.find(application => isActiveApplication(application.status));
        const applicationLegacyId = firstApplication ? legacyIdForApplication(firstApplication) : null;
        return applicationLegacyId ?? rows[0]?.id ?? null;
      });
    } catch (err: any) {
      showError(err);
    }
  }, [showError]);

  const loadCalendarStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI?.getCalendarStatus?.();
      if (status) {
        setCalendarStatus(status);
        onCalendarConnected(Boolean(status.connected));
      }
    } catch {
      setCalendarStatus(null);
      onCalendarConnected(false);
    }
  }, [onCalendarConnected]);

  useEffect(() => {
    void loadInterviews();
    void loadCalendarStatus();
  }, [loadCalendarStatus, loadInterviews]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setApplicationDetail(null);
      setRetroEvaluation(null);
      return;
    }
    setRawSourceExpanded(false);
    let cancelled = false;
    void (async () => {
      try {
        const [nextDetail, nextRetroPrompt] = await Promise.all([
          interviewApi.get(selectedId),
          interviewApi.getRetroPrompt(selectedId),
        ]);
        const nextApplication = nextDetail.applicationId
          ? await applicationApi.get(nextDetail.applicationId).catch(() => null)
          : null;
        if (cancelled) return;
        setDetail(nextDetail);
        setApplicationDetail(nextApplication);
        setApplicationDraft(applicationDraftFromDetail(nextApplication));
        setApplicationSaveStatus('synced');
        setStageDrafts(Object.fromEntries((nextApplication?.stages ?? []).map(stage => [stage.id, stageDraftFromStage(stage)])));
        setStageSaveStatus(Object.fromEntries((nextApplication?.stages ?? []).map(stage => [stage.id, 'synced' as DraftStatus])));
        setRetroPrompt(nextRetroPrompt);
        setRetroEvaluation(nextDetail.retroEvaluation ?? null);
        const dossierLocalDraft = readLocalDraft<ReturnType<typeof initialDossierDraft>>(nextDetail.id, 'dossier');
        const prepLocalDraft = readLocalDraft<ReturnType<typeof prepDraftFromDetail>>(nextDetail.id, 'prep');
        const retroLocalDraft = readLocalDraft<ReturnType<typeof initialRetroDraft>>(nextDetail.id, 'retro');
        setDossierDraft(dossierLocalDraft ?? dossierDraftFromDetail(nextDetail));
        setPrepDraft(prepLocalDraft ?? prepDraftFromDetail(nextDetail));
        setRetroDraft(retroLocalDraft ?? initialRetroDraft());
        setDraftStatus({
          dossier: dossierLocalDraft ? 'dirty' : 'synced',
          prep: prepLocalDraft ? 'dirty' : 'synced',
          retro: retroLocalDraft ? 'dirty' : 'synced',
        });
        setQuestionDrafts(nextDetail.questions ?? []);
      } catch (err: any) {
        if (!cancelled) showError(err, 'not_found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, showError]);

  useEffect(() => {
    if (!applicationDetail?.id) return;
    let cancelled = false;
    void applicationApi.get(applicationDetail.id)
      .then(next => {
        if (cancelled) return;
        setApplicationDetail(next);
        setStageDrafts(current => ({
          ...Object.fromEntries(next.stages.map(stage => [stage.id, stageDraftFromStage(stage)])),
          ...Object.fromEntries(Object.entries(current).filter(([stageId]) => next.stages.some(stage => stage.id === stageId))),
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [meetings.length]);

  const vacancyItems = useMemo(() => {
    const grouped = new Map(groupVacanciesFromInterviews(interviews).map(item => [item.id, item]));
    for (const application of applications) {
      grouped.set(application.id, vacancyFromApplication(application, grouped.get(application.id)));
    }
    return Array.from(grouped.values()).sort((a, b) => {
      const left = a.startsAt ?? Number.MAX_SAFE_INTEGER;
      const right = b.startsAt ?? Number.MAX_SAFE_INTEGER;
      return left - right || b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [applications, interviews]);

  const statusFilteredVacancies = useMemo(() => {
    if (statusFilter === 'all') return vacancyItems;
    if (statusFilter === 'active') return vacancyItems.filter(item => isActiveApplication(item.status));
    return vacancyItems.filter(item => item.status === statusFilter);
  }, [statusFilter, vacancyItems]);

  const filteredVacancies = useMemo(() => {
    return statusFilteredVacancies;
  }, [statusFilteredVacancies]);
  const archivedVacancyCount = useMemo(
    () => vacancyItems.filter(item => item.status === 'archived').length,
    [vacancyItems],
  );

  const topSearchRows = useMemo<TopSearchResultRow[]>(() => {
    const rows: TopSearchResultRow[] = [];
    for (const application of applications) {
      const stageRows = application.stages
        .filter(stage => stage.status !== 'archived' && !stage.archivedAt)
        .map(stage => ({
          id: stage.id,
          kind: 'stage' as const,
          applicationId: application.id,
          title: stage.title,
          company: application.company,
          roleTitle: application.roleTitle,
          source: application.source,
          vacancyUrl: application.vacancyUrl,
          stageTitle: stage.title,
          startsAt: stage.startsAt,
          endsAt: stage.endsAt,
          timezone: stage.timezone,
          updatedAt: stage.updatedAt,
          stageType: stage.stageType,
          status: stage.status,
        }));
      rows.push({
        id: application.id,
        kind: 'vacancy',
        title: application.title,
        company: application.company,
        roleTitle: application.roleTitle,
        source: application.source,
        vacancyUrl: application.vacancyUrl,
        status: application.status,
        priority: application.priority,
        selectedInterviewId: legacyIdForApplication(application),
        selectedStageId: application.selectedStageId,
        startsAt: stageRows[0]?.startsAt ?? null,
        stageTitle: stageRows[0]?.title ?? null,
        stageCount: stageRows.length,
        linkedMeetingCount: application.linkedMeetings?.length ?? 0,
        questionCount: 0,
        updatedAt: application.updatedAt,
        stages: stageRows,
      });
      rows.push(...stageRows);
    }
    return rows;
  }, [applications]);

  const openTopSearchRow = useCallback((row: TopSearchResultRow) => {
    const application = row.kind === 'stage'
      ? applications.find(item => item.id === row.applicationId)
      : applications.find(item => item.id === row.id);
    if (!application) return;
    const stage = row.kind === 'stage'
      ? application.stages.find(item => item.id === row.id)
      : application.stages.find(item => item.id === application.selectedStageId) ?? application.stages[0] ?? null;
    const legacyId = stage?.legacyInterviewEventId ?? legacyIdForApplication(application);
    setDetailTab(row.kind === 'stage' ? 'Stages' : 'Vacancy');
    if (legacyId) {
      setSelectedId(legacyId);
    } else {
      setApplicationDetail(application);
      setApplicationDraft(applicationDraftFromDetail(application));
      setStageDrafts(Object.fromEntries(application.stages.map(item => [item.id, stageDraftFromStage(item)])));
      setStageSaveStatus(Object.fromEntries(application.stages.map(item => [item.id, 'synced' as DraftStatus])));
    }
  }, [applications]);

  const upcomingAgenda = useMemo(() => {
    return upcomingEvents
      .filter(event => new Date(event.endTime).getTime() > Date.now() - 5 * 60_000)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [upcomingEvents]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      const count = upcomingAgenda.filter(event => isSameLocalDay(new Date(event.startTime), day)).length
        + interviews.filter(item => item.startsAt && isSameLocalDay(new Date(item.startsAt), day)).length;
      return { day, count };
    });
  }, [interviews, selectedDate, upcomingAgenda]);

  const selectedDayEvents = useMemo(() => {
    return upcomingAgenda
      .filter(event => isSameLocalDay(new Date(event.startTime), selectedDate))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [selectedDate, upcomingAgenda]);

  const selectedDayInterviews = useMemo(() => {
    return interviews
      .filter(item => item.startsAt && isSameLocalDay(new Date(item.startsAt), selectedDate))
      .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  }, [interviews, selectedDate]);

  const selectedDayCount = selectedDayEvents.length + selectedDayInterviews.length;
  const selectedDayLabel = useMemo(() => formatCalendarDayLabel(
    selectedDate,
    { today: t('interviews.today'), tomorrow: t('interviews.tomorrow') },
    i18n.language,
  ), [i18n.language, selectedDate, t]);
  const stages = applicationDetail?.stages ?? [];
  const nearestStage = useMemo(() => getNearestStage(stages), [stages]);
  const activeStages = stages.filter(stage => stage.status !== 'archived' && !stage.archivedAt);
  const archivedStages = stages.filter(stage => stage.status === 'archived' || stage.archivedAt);
  const formatSchedule = useCallback((ms?: number | null) => (ms ? formatDateTime(ms) : t('interviews.unscheduled')), [t]);
  const requirementGroups = useMemo(
    () => groupRequirementLines(splitLines(dossierDraft.requirements), t('interviews.detail.requirements')),
    [dossierDraft.requirements, t],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const previewTopSearchIntake = useCallback((input: Parameters<typeof applicationApi.parseIntake>[0]) => {
    return applicationApi.parseIntake(input);
  }, []);

  const applyTopSearchIntake = useCallback(async (
    intake: ApplicationIntakeResult,
    options?: { selectedApplicationId?: string | null },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await applicationApi.createFromIntake(intake, options);
      await loadInterviews();
      setSelectedId(result.legacyInterview?.id ?? result.application.legacyInterviewEventId ?? null);
      return result;
    } catch (err: any) {
      showError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [loadInterviews, showError]);

  const topSearchContext = useMemo<VacancyTopSearchContext>(() => ({
    isActive: true,
    selectedApplicationId: applicationDetail?.id ?? null,
    selectedStageId: applicationDetail?.selectedStageId ?? null,
    rows: topSearchRows,
    candidateApplications: vacancyItems
      .filter(item => isActiveApplication(item.status))
      .map(item => ({
        id: item.id,
        title: item.title,
        company: item.company,
        roleTitle: item.roleTitle,
      })),
    onOpenRow: openTopSearchRow,
    onPreviewIntake: previewTopSearchIntake,
    onApplyIntake: applyTopSearchIntake,
  }), [applicationDetail?.id, applicationDetail?.selectedStageId, applyTopSearchIntake, openTopSearchRow, previewTopSearchIntake, topSearchRows, vacancyItems]);

  useEffect(() => {
    onSearchContextChange?.(topSearchContext);
  }, [onSearchContextChange, topSearchContext]);

  useEffect(() => {
    return () => onSearchContextChange?.(null);
  }, [onSearchContextChange]);

  const updateDraft = <T extends Record<string, string>>(
    kind: 'dossier' | 'prep' | 'retro',
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: string,
    value: string,
  ) => {
    setter(prev => {
      const next = { ...prev, [key]: value };
      if (detail?.id) {
        setDraftStatus(current => ({ ...current, [kind]: 'dirty' }));
        const status = writeLocalDraft(detail.id, kind, next);
        setDraftStatus(current => ({ ...current, [kind]: status }));
      }
      return next;
    });
  };

  const clearDraftStatus = (kind: 'dossier' | 'prep' | 'retro', interviewId: string) => {
    clearLocalDraft(interviewId, kind);
    setDraftStatus(current => ({ ...current, [kind]: 'synced' }));
  };

  const refreshAll = async () => {
    await Promise.all([Promise.resolve(onRefresh()), loadInterviews(), loadCalendarStatus()]);
  };

  const clearArchivedApplications = async () => {
    if (archivedVacancyCount < 1) return;
    if (!window.confirm(t('interviews.clearArchiveConfirm', { count: archivedVacancyCount }))) return;
    await run(async () => {
      await applicationApi.clearArchived();
      setSelectedId(null);
      setDetail(null);
      setApplicationDetail(null);
      setStatusFilter('active');
      await loadInterviews();
    });
  };

  const applyIntakePreviewToForm = (preview: ApplicationIntakeResult) => {
    setCreateForm(prev => {
      const range = normalizeStageDateRange({
        startsAt: prev.startsAt ?? preview.stage?.startsAt ?? null,
        endsAt: prev.endsAt ?? preview.stage?.endsAt ?? null,
      }, 'startsAt');
      return {
        ...prev,
        title: prev.title.trim() || preview.application.title || prev.title,
        company: prev.company?.trim() ? prev.company : preview.application.company ?? prev.company,
        roleTitle: prev.roleTitle?.trim() ? prev.roleTitle : preview.application.roleTitle ?? prev.roleTitle,
        stage: prev.stage?.trim() && prev.stage !== 'Recruiter screen' ? prev.stage : preview.stage?.title ?? prev.stage,
        source: preview.application.source ?? prev.source,
        vacancyUrl: prev.vacancyUrl?.trim() ? prev.vacancyUrl : preview.application.vacancyUrl ?? prev.vacancyUrl,
        meetingUrl: prev.meetingUrl?.trim() ? prev.meetingUrl : preview.stage?.meetingUrl ?? prev.meetingUrl,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        timezone: preview.stage?.timezone ?? prev.timezone,
        rawSourceText: preview.application.rawSourceText ?? prev.rawSourceText,
      };
    });
  };

  const parseSourceText = async (useAi = false) => {
    const rawText = createForm.rawSourceText ?? '';
    await run(async () => {
      const parsed = await applicationApi.parseIntake({ text: rawText, useAi });
      setIntakePreview(parsed);
      setParseWarnings(parsed.warnings);
      applyIntakePreviewToForm(parsed);
    });
  };

  const createInterview = async () => {
    if (isStageDateRangeInvalid({ startsAt: createForm.startsAt ?? null, endsAt: createForm.endsAt ?? null })) {
      setError(createInterviewUiError('invalid_stage_time_range'));
      return;
    }
    await run(async () => {
      const preview = intakePreview ?? await applicationApi.parseIntake({ text: createForm.rawSourceText ?? createForm.title, useAi: false });
      const result = await applicationApi.createFromIntake({
        ...preview,
        application: {
          ...preview.application,
          title: createForm.title || preview.application.title,
          company: createForm.company ?? preview.application.company,
          roleTitle: createForm.roleTitle ?? preview.application.roleTitle,
          source: createForm.source ?? preview.application.source,
          vacancyUrl: createForm.vacancyUrl ?? preview.application.vacancyUrl,
          rawSourceText: createForm.rawSourceText ?? preview.application.rawSourceText,
        },
        stage: preview.stage ? {
          ...preview.stage,
          title: createForm.stage ?? preview.stage.title,
          startsAt: createForm.startsAt ?? preview.stage.startsAt,
          endsAt: createForm.endsAt ?? preview.stage.endsAt,
          timezone: createForm.timezone ?? preview.stage.timezone,
          meetingUrl: createForm.meetingUrl ?? preview.stage.meetingUrl,
        } : undefined,
      });
      const legacyId = result.legacyInterview?.id;
      if (legacyId && createCalendarProvider !== 'none' && createForm.startsAt && createForm.endsAt) {
        try {
          await interviewApi.createCalendarEvent(legacyId, createCalendarProvider);
        } catch (err: any) {
          showError(err, 'calendar_refresh_failed');
        }
      }
      setShowCreate(false);
      setCreateForm(initialCreateForm());
      setCreateCalendarProvider('none');
      setIntakePreview(null);
      setParseWarnings([]);
      await loadInterviews();
      setSelectedId(legacyId ?? result.application.legacyInterviewEventId ?? null);
    });
  };

  const createFromEvent = async (event: CalendarEventSummary) => {
    await run(async () => {
      const startsAt = new Date(event.startTime).getTime();
      const endsAt = new Date(event.endTime).getTime();
      const created = await interviewApi.create({
        title: event.title || 'Interview',
        stage: 'Scheduled interview',
        status: 'interviewing',
        priority: 'high',
        source: eventProvider(event) === 'macos' ? 'macOS Calendar' : 'Google Calendar',
        meetingUrl: event.link ?? null,
        startsAt,
        endsAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendarProvider: eventProvider(event),
        calendarId: 'primary',
        calendarEventId: event.id,
        calendarSnapshot: eventSnapshot(event),
        calendarLastSeenAt: Date.now(),
        calendarSyncStatus: 'linked',
      });
      await loadInterviews();
      setSelectedId(created.id);
    });
  };

  const updateStatus = async (id: string, status: InterviewStatus) => {
    await run(async () => {
      const updated = await interviewApi.update(id, { status });
      await loadInterviews();
      setSelectedId(updated.id);
    });
  };

  const updateApplicationDraft = <K extends keyof typeof applicationDraft>(key: K, value: typeof applicationDraft[K]) => {
    setApplicationDraft(prev => ({ ...prev, [key]: value }));
    setApplicationSaveStatus('dirty');
  };

  const saveApplication = async () => {
    if (!applicationDetail) return;
    const patch: ApplicationUpdatePatch = {
      title: applicationDraft.title,
      company: emptyToNull(applicationDraft.company),
      roleTitle: emptyToNull(applicationDraft.roleTitle),
      status: applicationDraft.status,
      priority: applicationDraft.priority,
      source: emptyToNull(applicationDraft.source),
      sourceUrl: emptyToNull(applicationDraft.sourceUrl),
      vacancyUrl: emptyToNull(applicationDraft.vacancyUrl),
      compensationText: emptyToNull(applicationDraft.compensationText),
      locationFormat: emptyToNull(applicationDraft.locationFormat),
      nextAction: emptyToNull(applicationDraft.nextAction),
      nextActionDueAt: applicationDraft.nextActionDueAt,
      rawSourceText: emptyToNull(applicationDraft.rawSourceText),
    };
    await run(async () => {
      const updated = await applicationApi.update(applicationDetail.id, patch);
      setApplicationDetail(updated);
      setApplicationDraft(applicationDraftFromDetail(updated));
      setStageDrafts(Object.fromEntries(updated.stages.map(stage => [stage.id, stageDraftFromStage(stage)])));
      setApplicationSaveStatus('saved');
      await loadInterviews();
      const nextLegacyId = legacyIdForApplication(updated);
      if (nextLegacyId) setSelectedId(nextLegacyId);
    }).catch(() => setApplicationSaveStatus('failed'));
  };

  const updateStageDraft = <K extends keyof ReturnType<typeof stageDraftFromStage>>(stageId: string, key: K, value: ReturnType<typeof stageDraftFromStage>[K]) => {
    setStageDrafts(prev => ({
      ...prev,
      [stageId]: {
        ...(prev[stageId] ?? {}),
        [key]: value,
      } as ReturnType<typeof stageDraftFromStage>,
    }));
    setStageSaveStatus(prev => ({ ...prev, [stageId]: 'dirty' }));
  };

  const updateCreateFormDate = (key: StageDateRangeField, value: number | null) => {
    setCreateForm(prev => ({
      ...prev,
      ...normalizeStageDateRange({
        startsAt: key === 'startsAt' ? value : prev.startsAt ?? null,
        endsAt: key === 'endsAt' ? value : prev.endsAt ?? null,
      }, key),
    }));
  };

  const updateStageDraftDate = (stage: InterviewStage, key: StageDateRangeField, value: number | null) => {
    setStageDrafts(prev => {
      const current = prev[stage.id] ?? stageDraftFromStage(stage);
      return {
        ...prev,
        [stage.id]: {
          ...current,
          ...normalizeStageDateRange({
            startsAt: key === 'startsAt' ? value : current.startsAt,
            endsAt: key === 'endsAt' ? value : current.endsAt,
          }, key),
        },
      };
    });
    setStageSaveStatus(prev => ({ ...prev, [stage.id]: 'dirty' }));
  };

  const saveStage = async (stage: InterviewStage) => {
    const draft = stageDrafts[stage.id] ?? stageDraftFromStage(stage);
    if (isStageDateRangeInvalid({ startsAt: draft.startsAt, endsAt: draft.endsAt })) {
      setError(createInterviewUiError('invalid_stage_time_range'));
      return;
    }
    const patch: InterviewStageUpdatePatch = {
      title: draft.title,
      stageType: draft.stageType,
      status: draft.status,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      timezone: emptyToNull(draft.timezone),
      format: draft.format,
      meetingUrl: emptyToNull(draft.meetingUrl),
      rawSourceText: emptyToNull(draft.rawSourceText),
      calendarProvider: draft.startsAt || draft.endsAt || draft.meetingUrl ? stage.calendarProvider ?? 'manual' : stage.calendarProvider ?? null,
      calendarSyncStatus: stage.calendarSyncStatus ?? 'local_only',
    };
    await run(async () => {
      const updated = await stageApi.update(stage.id, patch);
      setApplicationDetail(updated);
      setStageDrafts(Object.fromEntries(updated.stages.map(nextStage => [nextStage.id, stageDraftFromStage(nextStage)])));
      setStageSaveStatus(prev => ({ ...prev, [stage.id]: 'saved' }));
      await loadInterviews();
      const nextLegacyId = legacyIdForApplication(updated);
      if (nextLegacyId) setSelectedId(nextLegacyId);
    }).catch(() => setStageSaveStatus(prev => ({ ...prev, [stage.id]: 'failed' })));
  };

  const addStage = async () => {
    if (!applicationDetail) return;
    const payload: InterviewStageCreatePayload = {
      applicationId: applicationDetail.id,
      title: t('interviews.detail.newStageTitle'),
      stageType: 'custom',
      status: 'draft',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      format: 'unknown',
    };
    await run(async () => {
      const updated = await stageApi.create(payload);
      setApplicationDetail(updated);
      setStageDrafts(Object.fromEntries(updated.stages.map(stage => [stage.id, stageDraftFromStage(stage)])));
      await loadInterviews();
    });
  };

  const archiveStage = async (stage: InterviewStage) => {
    await run(async () => {
      const updated = await stageApi.archive(stage.id);
      setApplicationDetail(updated);
      setStageDrafts(Object.fromEntries(updated.stages.map(nextStage => [nextStage.id, stageDraftFromStage(nextStage)])));
      await loadInterviews();
    });
  };

  const restoreStage = async (stage: InterviewStage) => {
    await run(async () => {
      const updated = await stageApi.restore(stage.id, 'scheduled');
      setApplicationDetail(updated);
      setStageDrafts(Object.fromEntries(updated.stages.map(nextStage => [nextStage.id, stageDraftFromStage(nextStage)])));
      await loadInterviews();
    });
  };

  const createStageCalendarEvent = async (stage: InterviewStage, provider: 'google' | 'macos') => {
    await run(async () => {
      const updated = await stageApi.createCalendarEvent(stage.id, provider);
      setApplicationDetail(updated);
      setStageDrafts(Object.fromEntries(updated.stages.map(nextStage => [nextStage.id, stageDraftFromStage(nextStage)])));
      await loadInterviews();
    });
  };

  const startStageRecording = (stage: InterviewStage) => {
    if (!applicationDetail || stage.status === 'archived' || stage.archivedAt) return;
    onStartMeeting({
      title: stage.title || applicationDetail.title,
      interviewEventId: stage.legacyInterviewEventId ?? applicationDetail.legacyInterviewEventId ?? undefined,
      interviewStageId: stage.id,
      applicationId: applicationDetail.id,
      calendarEventId: stage.calendarEventId ?? undefined,
      source: 'manual',
    });
  };

  const saveDossier = async () => {
    if (!detail) return;
    const payload: VacancyDossierPayload = {
      description: dossierDraft.description,
      requirements: splitLines(dossierDraft.requirements),
      compensationText: dossierDraft.compensationText,
      fitHypothesis: dossierDraft.fitHypothesis,
      risks: splitLines(dossierDraft.risks),
      questionsToAsk: splitLines(dossierDraft.questionsToAsk),
    };
    await run(async () => {
      await interviewApi.saveDossier(detail.id, payload);
      clearDraftStatus('dossier', detail.id);
      const next = await interviewApi.get(detail.id);
      setDetail(next);
      setApplicationDetail(next.applicationId ? await applicationApi.get(next.applicationId).catch(() => null) : null);
    });
  };

  const savePrep = async () => {
    if (!detail) return;
    const payload: PrepBriefPayload = {
      oneLineGoal: prepDraft.oneLineGoal,
      pitch30s: prepDraft.pitch30s,
      pitch2m: prepDraft.pitch2m,
      expectedTopics: splitLines(prepDraft.expectedTopics),
      cheatsheet: prepDraft.cheatsheet,
      riskHandling: splitLines(prepDraft.riskHandling),
      lastChecklist: splitLines(prepDraft.lastChecklist),
    };
    await run(async () => {
      await interviewApi.savePrep(detail.id, payload);
      clearDraftStatus('prep', detail.id);
      const next = await interviewApi.get(detail.id);
      setDetail(next);
      setApplicationDetail(next.applicationId ? await applicationApi.get(next.applicationId).catch(() => null) : null);
    });
  };

  const saveRetro = async () => {
    if (!detail) return;
    const probability = retroDraft.passProbability.trim() ? Number(retroDraft.passProbability) : null;
    const payload: InterviewRetroPayload = {
      passProbability: Number.isFinite(probability) ? probability : null,
      mainSignal: retroDraft.mainSignal,
      strongMoments: splitLines(retroDraft.strongMoments),
      weakMoments: splitLines(retroDraft.weakMoments),
      newFacts: splitLines(retroDraft.newFacts),
      followUpActions: splitLines(retroDraft.followUpActions),
    };
    await run(async () => {
      await interviewApi.saveRetro(detail.id, payload);
      clearDraftStatus('retro', detail.id);
      const next = await interviewApi.get(detail.id);
      setDetail(next);
      setRetroEvaluation(next.retroEvaluation ?? retroEvaluation);
      setRetroPrompt(await interviewApi.getRetroPrompt(detail.id));
      setRetroDraft(initialRetroDraft());
    });
  };

  const generateRetroEvaluation = async () => {
    if (!detail) return;
    setRetroEvaluating(true);
    try {
      setError(null);
      const evaluation = await interviewApi.generateRetroEvaluation(detail.id);
      setRetroEvaluation(evaluation);
    } catch (err: any) {
      showError(err);
    } finally {
      setRetroEvaluating(false);
    }
  };

  const updateRetroPrompt = async (action: 'snooze' | 'dismiss' | 'complete') => {
    if (!detail) return;
    await run(async () => {
      const next = await interviewApi.updateRetroPrompt(detail.id, action === 'snooze'
        ? { action, snoozeMs: 24 * 60 * 60 * 1000 }
        : { action });
      setRetroPrompt(next);
      if (action === 'complete') setDetailTab('Retro');
    });
  };

  const saveQuestions = async () => {
    if (!detail) return;
    await run(async () => {
      await interviewApi.saveQuestions(detail.id, questionDrafts);
      setDetail(await interviewApi.get(detail.id));
    });
  };

  const addQuestion = () => {
    const text = questionText.trim();
    if (!text) return;
    setQuestionDrafts(prev => [
      ...prev,
      {
        questionText: text,
        category: questionCategory.trim() || null,
        weakSpot: false,
      },
    ]);
    setQuestionText('');
    setQuestionCategory('');
  };

  const attachMeeting = async (stage: InterviewStage) => {
    if (!detail || !applicationDetail) return;
    const meetingId = attachMeetingIds[stage.id];
    if (!meetingId) return;
    await run(async () => {
      await stageApi.attachMeeting(stage.id, meetingId);
      const next = await interviewApi.get(detail.id);
      const nextApplication = await applicationApi.get(applicationDetail.id).catch(() => null);
      setDetail(next);
      setApplicationDetail(nextApplication);
      setAttachMeetingIds(prev => ({ ...prev, [stage.id]: '' }));
    });
  };

  const updatePaneLayout = useCallback((nextLayout: InterviewPaneLayout) => {
    setPaneLayout(nextLayout);
    persistPaneLayout(nextLayout);
  }, []);

  const resetPaneLayout = useCallback(() => {
    updatePaneLayout({
      ...DEFAULT_PANE_LAYOUT,
      updatedAt: new Date().toISOString(),
    });
  }, [updatePaneLayout]);

  const startPaneResize = useCallback((pane: 'calendar' | 'vacancy', event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return;
    event.preventDefault();
    const startX = event.clientX;
    const startLayout = paneLayout;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextLayout = normalizePaneLayout({
        ...startLayout,
        calendarWidth: pane === 'calendar' ? startLayout.calendarWidth + delta : startLayout.calendarWidth,
        vacancyWidth: pane === 'vacancy' ? startLayout.vacancyWidth + delta : startLayout.vacancyWidth,
        updatedAt: new Date().toISOString(),
      });
      updatePaneLayout(nextLayout);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [paneLayout, updatePaneLayout]);

  const startSelectedInterview = () => {
    if (!detail) {
      onStartMeeting();
      return;
    }
    if (!applicationDetail) {
      onStartMeeting({
        title: detail.title,
        interviewEventId: detail.id,
        interviewStageId: detail.selectedStageId ?? undefined,
        applicationId: detail.applicationId ?? undefined,
        calendarEventId: detail.calendarEventId ?? undefined,
        source: 'manual',
      });
      return;
    }
    void run(async () => {
      const activeStage = applicationDetail.stages.find(stage => stage.status !== 'archived' && !stage.archivedAt);
      const targetApplication = activeStage
        ? applicationDetail
        : await stageApi.create({
          applicationId: applicationDetail.id,
          title: t('interviews.detail.defaultRecordingStageTitle'),
          stageType: 'custom',
          status: 'draft',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          format: 'unknown',
        });
      const targetStage = activeStage
        ?? targetApplication.stages.find(stage => stage.status !== 'archived' && !stage.archivedAt)
        ?? targetApplication.stages[0];
      setApplicationDetail(targetApplication);
      setStageDrafts(Object.fromEntries(targetApplication.stages.map(stage => [stage.id, stageDraftFromStage(stage)])));
      onStartMeeting({
        title: targetStage?.title || targetApplication.title || detail.title,
        interviewEventId: targetStage?.legacyInterviewEventId ?? targetApplication.legacyInterviewEventId ?? detail.id,
        interviewStageId: targetStage?.id,
        applicationId: targetApplication.id,
        calendarEventId: targetStage?.calendarEventId ?? detail.calendarEventId ?? undefined,
        source: 'manual',
      });
    });
  };

  const paneLayoutStyle = {
    '--interview-calendar-width': `${paneLayout.calendarWidth}px`,
    '--interview-vacancy-width': `${paneLayout.vacancyWidth}px`,
    '--interview-detail-min-width': `${paneLayout.detailMinWidth}px`,
  } as React.CSSProperties;

  return (
    <div
      data-testid="interview-command-center"
      className="grid h-full min-h-0 grid-cols-1 overflow-y-auto bg-[#0a0b0c] text-text-primary lg:grid-cols-[minmax(220px,var(--interview-calendar-width))_6px_minmax(280px,var(--interview-vacancy-width))_6px_minmax(var(--interview-detail-min-width),1fr)] lg:overflow-hidden"
      style={paneLayoutStyle}
    >
      <aside className="flex min-h-[520px] flex-col bg-[#101214] lg:min-h-0 lg:border-r lg:border-white/[0.07]">
        <div className={paneHeaderClass}>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-cyan-300" />
            <span className="text-[15px] font-semibold">{t('interviews.calendar')}</span>
          </div>
          <button type="button" className={iconButtonClass} onClick={refreshAll} title={t('common.refresh')}>
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="border-b border-white/[0.07] p-3">
          <div className="flex min-h-9 items-center justify-between gap-3">
            {calendarStatus?.connected ? (
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex min-w-0 items-center gap-2 text-[12px] font-medium text-text-secondary transition hover:text-white"
                title={calendarStatus.email ?? t('interviews.sync')}
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-cyan-300' : 'text-cyan-300'} />
                <span className="truncate">{t('interviews.sync')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenSettings('calendar')}
                className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-text-tertiary transition hover:text-white"
              >
                <span className="truncate">{t('interviews.syncNotConfigured')}</span>
                <ArrowUpRight size={12} />
              </button>
            )}
            {calendarStatus?.email && (
              <span className="truncate text-[11px] text-text-tertiary">{calendarStatus.email}</span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button"
              className={iconButtonClass}
              onClick={() => setSelectedDate(prev => addDays(prev, -7))}
              title={t('interviews.previousWeek')}
              aria-label={t('interviews.previousWeek')}
            >
              <ChevronLeft size={16} />
            </button>
            <CalendarDatePickerButton
              value={selectedDate}
              label={selectedDayLabel}
              ariaLabel={t('interviews.chooseDate')}
              onChange={date => setSelectedDate(startOfDay(date))}
              className="min-w-0 flex-1"
            />
            <button type="button"
              className={iconButtonClass}
              onClick={() => setSelectedDate(prev => addDays(prev, 7))}
              title={t('interviews.nextWeek')}
              aria-label={t('interviews.nextWeek')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 border-b border-white/[0.07] p-3">
          {calendarDays.map(({ day, count }) => {
            const today = day.toDateString() === new Date().toDateString();
            const selected = isSameLocalDay(day, selectedDate);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => setSelectedDate(startOfDay(day))}
                className={`flex h-14 flex-col items-center justify-center rounded-md text-center transition ${selected ? 'bg-cyan-400/10 text-white ring-1 ring-cyan-300/25' : today ? 'bg-white/[0.035] text-white' : 'text-text-secondary hover:bg-white/[0.035]'}`}
              >
                <span className="text-[10px] uppercase text-zinc-500">{day.toLocaleDateString([], { weekday: 'short' })}</span>
                <span className="text-[14px] font-semibold tabular-nums">{day.getDate()}</span>
                {count > 0 ? <span className="mt-1 h-1.5 w-5 rounded-full bg-cyan-300/85" /> : <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/[0.12]" />}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>{selectedDayLabel}</span>
            <span className="text-[11px] text-text-tertiary">{selectedDayCount}</span>
          </div>
          <div className="space-y-2">
            {selectedDayInterviews.map(item => (
              <button type="button"
                key={`interview:${item.id}`}
                onClick={() => setSelectedId(item.id)}
                className="min-h-16 w-full rounded-md border border-transparent px-3 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{item.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                      <Clock3 size={12} />
                      {formatSchedule(item.startsAt)}
                    </div>
                  </div>
                  <ChevronRight size={15} className="mt-0.5 text-text-secondary" />
                </div>
              </button>
            ))}
            {selectedDayEvents.map(event => (
              <button type="button"
                key={`event:${event.source}:${event.id}`}
                onClick={() => createFromEvent(event)}
                className="min-h-16 w-full rounded-md border border-transparent px-3 py-2.5 text-left transition hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{event.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                      <Clock3 size={12} />
                      {formatDateTime(new Date(event.startTime).getTime())} · {eventProvider(event) === 'macos' ? t('interviews.mac') : t('interviews.google')}
                    </div>
                  </div>
                  <Plus size={15} className="mt-0.5 text-text-secondary" />
                </div>
              </button>
            ))}
            {selectedDayCount === 0 && (
              <div className="rounded-md bg-white/[0.025] p-4 text-[12px] text-text-tertiary">
                {t('interviews.noEventsForSelectedDay')}
              </div>
            )}
          </div>
        </div>
      </aside>

      <PaneResizeHandle
        label={t('interviews.resizePanes')}
        onPointerDown={(event) => startPaneResize('calendar', event)}
        onDoubleClick={resetPaneLayout}
      />

      <section className="flex min-h-[560px] flex-col bg-[#0c0e10] lg:min-h-0 lg:border-r lg:border-white/[0.07]">
        <div className={paneHeaderClass}>
          <div>
            <div className="text-[15px] font-semibold">{t('interviews.vacancyOS')}</div>
            <div className="text-[11px] text-text-tertiary">{t('interviews.activeProcessCount', { count: vacancyItems.filter(item => isActiveApplication(item.status)).length })}</div>
          </div>
          <button type="button"
            onClick={() => setShowCreate(true)}
            className={primaryButtonClass}
          >
            <Plus size={14} />
            {t('interviews.newVacancyShort')}
          </button>
        </div>

        <div className="border-b border-white/[0.07] p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              ['active', t('interviews.filters.active')],
              ['all', t('interviews.filters.all')],
              ['lead_found', t(applicationStatusLabelKey('lead_found'))],
              ['applied', t(applicationStatusLabelKey('applied'))],
              ['screening', t(applicationStatusLabelKey('screening'))],
              ['interviewing', t(applicationStatusLabelKey('interviewing'))],
              ['offer', t(applicationStatusLabelKey('offer'))],
              ['rejected', t(applicationStatusLabelKey('rejected'))],
              ['withdrawn', t(applicationStatusLabelKey('withdrawn'))],
              ['archived', t(applicationStatusLabelKey('archived'))],
            ] as Array<[VacancyStatusFilter, string]>).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`min-h-9 rounded-md px-2 text-[11px] font-semibold transition ${statusFilter === value ? 'bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-300/25' : 'bg-white/[0.025] text-text-secondary hover:bg-white/[0.06] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {statusFilter === 'archived' && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white/[0.025] px-2 py-2">
              <span className="text-[11px] text-text-tertiary">
                {t('interviews.archivedVacancyCount', { count: archivedVacancyCount })}
              </span>
              <button
                type="button"
                onClick={clearArchivedApplications}
                disabled={busy || archivedVacancyCount < 1}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={13} />
                {t('interviews.clearArchive')}
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="space-y-2">
            {filteredVacancies.map(item => (
              <button type="button"
                key={item.id}
                onClick={() => {
                  const legacyId = legacyIdForVacancy(item);
                  if (legacyId) setSelectedId(legacyId);
                }}
                className={`min-h-24 w-full rounded-md border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60 ${item.stages.some(stage => stage.id === selectedId) || item.selectedInterviewId === selectedId ? 'border-cyan-300/35 bg-cyan-300/[0.08]' : 'border-transparent bg-transparent hover:bg-white/[0.045]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{item.title}</div>
                    <div className="mt-1 truncate text-[12px] text-text-secondary">
                      {[item.company, item.roleTitle].filter(Boolean).join(' · ') || item.stageTitle || t('interviews.noVacancyContext')}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${applicationStatusTone(item.status)}`}>
                    {t(applicationStatusLabelKey(item.status))}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-text-tertiary">
                  <span>{formatSchedule(item.startsAt)}</span>
                  <span>{item.stageCount > 1 ? t('interviews.stagesCount', { count: item.stageCount }) : t('interviews.questionsCount', { count: item.questionCount })}</span>
                </div>
              </button>
            ))}
            {filteredVacancies.length === 0 && (
              <div className="rounded-md bg-white/[0.025] p-4 text-[13px] text-text-tertiary">
                {t('interviews.noVacanciesYet')}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>{t('interviews.recordings')}</span>
            <button type="button" onClick={startSelectedInterview} className="min-h-11 px-2 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200" style={{ minWidth: 44 }}>
              {isMeetingActive ? t('common.openLive') : t('common.start')}
            </button>
          </div>
          <div className="space-y-1.5">
            {meetings.slice(0, 3).map(meeting => (
              <button type="button" key={meeting.id} onClick={() => onOpenMeeting(meeting)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-[12px] transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60">
                <span className="truncate text-text-secondary">{meeting.title}</span>
                <ChevronRight size={14} className="shrink-0 text-text-tertiary" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <PaneResizeHandle
        label={t('interviews.resizePanes')}
        onPointerDown={(event) => startPaneResize('vacancy', event)}
        onDoubleClick={resetPaneLayout}
      />

      <section className="flex min-h-[680px] flex-col bg-[#0a0b0c] lg:min-h-0">
        <div className="flex min-h-16 items-center justify-between border-b border-white/[0.07] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-300">
              <BriefcaseBusiness size={17} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{applicationDetail?.title ?? detail?.title ?? t('interviews.noInterviewSelected')}</div>
              <div className="truncate text-[11px] text-text-tertiary">{detail ? [applicationDetail?.company ?? detail.company, applicationDetail?.roleTitle ?? detail.roleTitle].filter(Boolean).join(' · ') || t('interviews.vacancyContextPending') : t('interviews.createOrSelectProcess')}</div>
            </div>
          </div>
          {detail && (
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={startSelectedInterview}
                className={primaryButtonClass}
                style={{ minWidth: 44 }}
              >
                {isMeetingActive ? t('common.openLive') : t('common.start')}
              </button>
              <select
                value={applicationDetail?.status ?? statusFromInterview(detail.status)}
                onChange={event => {
                  updateApplicationDraft('status', event.target.value as ApplicationStatus);
                  if (applicationDetail) void run(async () => {
                    const updated = await applicationApi.update(applicationDetail.id, { status: event.target.value as ApplicationStatus });
                    setApplicationDetail(updated);
                    setApplicationDraft(applicationDraftFromDetail(updated));
                    await loadInterviews();
                  });
                }}
                className="min-h-11 rounded-md border border-white/[0.08] bg-black/20 px-3 text-[12px] outline-none focus:border-cyan-300/45"
              >
                {APPLICATION_STATUS_OPTIONS.map(status => <option key={status} value={status}>{t(applicationStatusLabelKey(status))}</option>)}
              </select>
              <button type="button" className={iconButtonClass} title={t('interviews.archive')} onClick={() => detail && run(async () => {
                if (applicationDetail) {
                  await applicationApi.update(applicationDetail.id, { status: 'archived' });
                } else {
                  await interviewApi.archive(detail.id);
                }
                await loadInterviews();
              })}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {detail ? (
          <div className="min-h-0 flex-1">
            <div className="h-full min-h-0 overflow-y-auto p-5 pb-24 custom-scrollbar">
              <div className="mb-5 flex items-center gap-1 border-b border-white/[0.07]">
                {DETAIL_TABS.map(tab => (
                  <button type="button"
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`min-h-11 flex-1 px-3 text-[12px] font-semibold transition ${detailTab === tab ? 'border-b-2 border-cyan-300 text-white' : 'border-b-2 border-transparent text-text-secondary hover:text-white'}`}
                  >
                    {t(DETAIL_TAB_I18N_KEY[tab])}
                  </button>
                ))}
              </div>

              {detailTab === 'Vacancy' && (
                <div className="space-y-4">
                  <div data-testid="application-fields-card" className="rounded-md bg-[#101214] p-4 ring-1 ring-white/[0.04]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold">{t('interviews.detail.applicationFields')}</div>
                        <div className="mt-0.5 text-[11px] text-text-tertiary">
                          {applicationSaveStatus === 'dirty'
                            ? t('interviews.detail.draftChanged')
                            : applicationSaveStatus === 'saved'
                              ? t('interviews.detail.synced')
                              : applicationSaveStatus === 'failed'
                                ? t('interviews.detail.draftNotSavedLocally')
                                : t('interviews.detail.synced')}
                        </div>
                      </div>
	                      <button type="button" onClick={saveApplication} disabled={busy || !applicationDetail || !applicationDraft.title.trim()} className={primaryButtonClass}>
	                        {t('common.save')}
	                      </button>
	                    </div>
	                    {nearestStage && (
	                      <button
	                        type="button"
	                        onClick={() => setDetailTab('Stages')}
	                        className="mb-4 flex w-full items-start justify-between gap-3 rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60"
	                      >
	                        <div className="min-w-0">
	                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-cyan-200/80">{t('interviews.detail.nearestStage')}</div>
	                          <div className="mt-1 truncate text-[14px] font-semibold text-text-primary">{nearestStage.title}</div>
	                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
	                            <span>{formatSchedule(nearestStage.startsAt)}</span>
	                            <span className="text-white/[0.16]">/</span>
	                            <span>{t(`interviews.stageStatus.${nearestStage.status}`)}</span>
	                          </div>
	                        </div>
	                        <ChevronRight size={16} className="mt-1 flex-none text-cyan-100/70" />
	                      </button>
	                    )}
	                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label={t('interviews.detail.title')}>
                        <input className={inputClass} value={applicationDraft.title} onChange={event => updateApplicationDraft('title', event.target.value)} />
                      </Field>
                      <Field label={t('interviews.detail.company')}>
                        <input className={inputClass} value={applicationDraft.company} onChange={event => updateApplicationDraft('company', event.target.value)} />
                      </Field>
                      <Field label={t('interviews.detail.role')}>
                        <input className={inputClass} value={applicationDraft.roleTitle} onChange={event => updateApplicationDraft('roleTitle', event.target.value)} />
                      </Field>
                      <Field label={t('interviews.detail.status')}>
                        <select className={inputClass} value={applicationDraft.status} onChange={event => updateApplicationDraft('status', event.target.value as ApplicationStatus)}>
                          {APPLICATION_STATUS_OPTIONS.map(status => <option key={status} value={status}>{t(applicationStatusLabelKey(status))}</option>)}
                        </select>
                      </Field>
                      <Field label={t('interviews.detail.priority')}>
                        <select className={inputClass} value={applicationDraft.priority} onChange={event => updateApplicationDraft('priority', event.target.value as InterviewPriority)}>
                          {PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{t(`interviews.priority.${priority}`, priority)}</option>)}
                        </select>
                      </Field>
                      <Field label={t('interviews.detail.source')}>
                        <input className={inputClass} value={applicationDraft.source} onChange={event => updateApplicationDraft('source', event.target.value)} />
                      </Field>
                      <Field label={t('interviews.detail.sourceUrl')}>
                        <UrlInput
                          value={applicationDraft.sourceUrl}
                          emptyLabel={t('interviews.detail.notSpecified')}
                          invalidLabel={t('interviews.detail.invalidUrl')}
                          onChange={value => updateApplicationDraft('sourceUrl', value)}
                        />
                      </Field>
                      <Field label={t('interviews.detail.vacancyUrl')}>
                        <UrlInput
                          value={applicationDraft.vacancyUrl}
                          emptyLabel={t('interviews.detail.notSpecified')}
                          invalidLabel={t('interviews.detail.invalidUrl')}
                          onChange={value => updateApplicationDraft('vacancyUrl', value)}
                        />
                      </Field>
                      <Field label={t('interviews.detail.compensation')}>
                        <input className={inputClass} value={applicationDraft.compensationText} onChange={event => updateApplicationDraft('compensationText', event.target.value)} />
                      </Field>
                      <Field label={t('interviews.detail.locationFormat')}>
                        <input className={inputClass} value={applicationDraft.locationFormat} onChange={event => updateApplicationDraft('locationFormat', event.target.value)} />
                      </Field>
	                      <div className="md:col-span-2">
                        <Field label={t('interviews.detail.sourceText')}>
                          <textarea className={`${inputClass} min-h-[120px] resize-y`} value={applicationDraft.rawSourceText} onChange={event => updateApplicationDraft('rawSourceText', event.target.value)} />
                        </Field>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-[#101214] p-4 ring-1 ring-white/[0.04]">
                    <div className={labelClass}>{t('interviews.detail.summary')}</div>
                    <div className="mt-2 text-[13px] leading-6 text-text-primary">
                      {dossierDraft.description.trim() || t('interviews.detail.noSummary')}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {requirementGroups.length > 0 ? requirementGroups.map(group => (
                        <div key={group.label} className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{group.label}</div>
                          <ul className="mt-2 space-y-1.5 text-[12px] leading-5 text-text-secondary">
                            {group.items.map((item, index) => (
                              <li key={`${group.label}-${index}`} className="flex gap-2">
                                <span className="mt-2 h-1 w-1 flex-none rounded-full bg-cyan-300/80" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )) : (
                        <div className="text-[12px] text-text-tertiary">{t('interviews.detail.noRequirements')}</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-[#101214] p-4 ring-1 ring-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <div className={labelClass}>{t('interviews.detail.rawVacancyContext')}</div>
                      {detail.rawSourceText && detail.rawSourceText.length > 360 && (
                        <button
                          type="button"
                          onClick={() => setRawSourceExpanded(value => !value)}
                          className="min-h-8 rounded-md border border-white/[0.08] px-2 text-[11px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white"
                        >
                          {rawSourceExpanded ? t('common.hide') : t('common.show')}
                        </button>
                      )}
                    </div>
                    <div className={`${rawSourceExpanded ? '' : 'max-h-28 overflow-hidden'} mt-3 whitespace-pre-wrap text-[13px] leading-6 text-text-secondary`}>
                      {detail.rawSourceText || t('interviews.detail.noSourceText')}
                    </div>
                    {!rawSourceExpanded && detail.rawSourceText && detail.rawSourceText.length > 360 && (
                      <div className="mt-2 text-[11px] text-text-tertiary">
                        {t('interviews.detail.sourceTextCollapsed', { count: detail.rawSourceText.length })}
                      </div>
                    )}
                  </div>
                  <EditorPanel
                    title={t('interviews.detail.vacancyDossier')}
                    action={t('interviews.detail.saveDossier')}
                    busy={busy}
                    status={draftStatus.dossier}
                    onSave={saveDossier}
                    fields={[
                      { key: 'description', label: t('interviews.detail.description'), value: dossierDraft.description, rows: 6 },
                      { key: 'requirements', label: t('interviews.detail.requirements'), value: dossierDraft.requirements, rows: 5 },
                      { key: 'compensationText', label: t('interviews.detail.compensation'), value: dossierDraft.compensationText, rows: 2 },
                      { key: 'fitHypothesis', label: t('interviews.detail.fitHypothesis'), value: dossierDraft.fitHypothesis, rows: 4 },
                      { key: 'risks', label: t('interviews.detail.risks'), value: dossierDraft.risks, rows: 4 },
                      { key: 'questionsToAsk', label: t('interviews.detail.questionsToAsk'), value: dossierDraft.questionsToAsk, rows: 4 },
                    ]}
                    onChange={(key, value) => updateDraft('dossier', setDossierDraft, key, value)}
                  />
                </div>
              )}

              {detailTab === 'Stages' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{t('interviews.detail.stages')}</div>
                      <div className="mt-0.5 text-[11px] text-text-tertiary">{t('interviews.stagesCount', { count: activeStages.length })}</div>
                    </div>
                    <button type="button" onClick={addStage} disabled={busy || !applicationDetail} className={primaryButtonClass}>
                      <Plus size={14} />
                      {t('interviews.detail.addStage')}
                    </button>
                  </div>

                  {stages.length > 0 ? (
                    [...activeStages, ...archivedStages].map((stage, index) => {
                      const stageMeetings = linkedMeetingsForStage(
                        stage,
                        applicationDetail?.linkedMeetings ?? detail.linkedMeetings ?? [],
                        stages.length,
                      );
                      const stageDraft = stageDrafts[stage.id] ?? stageDraftFromStage(stage);
                      const isArchived = stage.status === 'archived' || Boolean(stage.archivedAt);
                      return (
                        <React.Fragment key={stage.id}>
                          {index === activeStages.length && archivedStages.length > 0 && (
                            <div className="flex items-center gap-3 pt-2">
                              <div className="h-px flex-1 bg-white/[0.08]" />
                              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">{t('interviews.detail.archivedStages')}</span>
                              <div className="h-px flex-1 bg-white/[0.08]" />
                            </div>
                          )}
                          <div data-testid="interview-stage-card" className={`rounded-md bg-[#101214] p-3 ring-1 ring-white/[0.04] ${isArchived ? 'opacity-70' : ''}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[14px] font-semibold text-text-primary">{stage.title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-tertiary">
                                  <span>{formatSchedule(stage.startsAt)}</span>
                                  <span className="text-white/[0.16]">/</span>
                                  <span>{t(`interviews.stageStatus.${stage.status}`)}</span>
                                  <span className="text-white/[0.16]">/</span>
                                  <span>{stage.calendarSyncStatus}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {!isArchived && (
                                  <button type="button" onClick={() => startStageRecording(stage)} className={primaryButtonClass}>
                                    {isMeetingActive ? t('common.openLive') : t('interviews.detail.startRecording')}
                                  </button>
                                )}
                                <button type="button" onClick={() => createStageCalendarEvent(stage, 'google')} disabled={busy || isArchived || !stage.startsAt || !stage.endsAt} className={secondaryButtonClass}>
                                  {t('interviews.detail.createInGoogleCalendar')}
                                </button>
                                <button type="button" onClick={() => createStageCalendarEvent(stage, 'macos')} disabled={busy || isArchived || !stage.startsAt || !stage.endsAt} className={secondaryButtonClass}>
                                  {t('interviews.detail.createInMacCalendar')}
                                </button>
                                {!isArchived ? (
                                  <button type="button" onClick={() => archiveStage(stage)} disabled={busy} className={iconButtonClass} title={t('interviews.detail.archiveStage')}>
                                    <Trash2 size={14} />
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => restoreStage(stage)} disabled={busy} className={iconButtonClass} title={t('interviews.detail.restoreStage')}>
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                              <Field label={t('interviews.detail.title')}>
                                <input className={inputClass} value={stageDraft.title} onChange={event => updateStageDraft(stage.id, 'title', event.target.value)} />
                              </Field>
                              <Field label={t('interviews.detail.stageType')}>
                                <select className={inputClass} value={stageDraft.stageType} onChange={event => updateStageDraft(stage.id, 'stageType', event.target.value as InterviewStageType)}>
                                  {STAGE_TYPE_OPTIONS.map(type => <option key={type} value={type}>{t(`interviews.stageType.${type}`, type)}</option>)}
                                </select>
                              </Field>
                              <Field label={t('interviews.detail.status')}>
                                <select className={inputClass} value={stageDraft.status} onChange={event => updateStageDraft(stage.id, 'status', event.target.value as InterviewStageStatus)}>
                                  {STAGE_STATUS_OPTIONS.map(status => <option key={status} value={status}>{t(`interviews.stageStatus.${status}`)}</option>)}
                                </select>
                              </Field>
                              <Field label={t('interviews.detail.format')}>
                                <select className={inputClass} value={stageDraft.format} onChange={event => updateStageDraft(stage.id, 'format', event.target.value as InterviewStageFormat)}>
                                  {STAGE_FORMAT_OPTIONS.map(format => <option key={format} value={format}>{t(`interviews.stageFormat.${format}`, format)}</option>)}
                                </select>
                              </Field>
                              <Field label={t('interviews.detail.starts')}>
                                <DateTimePickerField
                                  value={stageDraft.startsAt}
                                  placeholder={t('interviews.unscheduled')}
                                  invalid={isStageDateRangeInvalid({ startsAt: stageDraft.startsAt, endsAt: stageDraft.endsAt })}
                                  onChange={value => updateStageDraftDate(stage, 'startsAt', value)}
                                />
                              </Field>
                              <Field label={t('interviews.detail.ends')}>
                                <DateTimePickerField
                                  value={stageDraft.endsAt}
                                  placeholder={t('interviews.unscheduled')}
                                  invalid={isStageDateRangeInvalid({ startsAt: stageDraft.startsAt, endsAt: stageDraft.endsAt })}
                                  onChange={value => updateStageDraftDate(stage, 'endsAt', value)}
                                />
                              </Field>
                              <Field label={t('interviews.detail.timezone')}>
                                <input className={inputClass} value={stageDraft.timezone} onChange={event => updateStageDraft(stage.id, 'timezone', event.target.value)} />
                              </Field>
                              <Field label={t('interviews.detail.meetingUrl')}>
                                <UrlInput
                                  value={stageDraft.meetingUrl}
                                  emptyLabel={t('interviews.detail.notSpecified')}
                                  invalidLabel={t('interviews.detail.invalidUrl')}
                                  onChange={value => updateStageDraft(stage.id, 'meetingUrl', value)}
                                />
                              </Field>
                              <div className="md:col-span-2">
                                <Field label={t('interviews.detail.sourceText')}>
                                  <textarea className={`${inputClass} min-h-[68px] resize-y`} value={stageDraft.rawSourceText} onChange={event => updateStageDraft(stage.id, 'rawSourceText', event.target.value)} />
                                </Field>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="text-[11px] text-text-tertiary">
                                {stageSaveStatus[stage.id] === 'dirty'
                                  ? t('interviews.detail.draftChanged')
                                  : stageSaveStatus[stage.id] === 'saved'
                                    ? t('interviews.detail.synced')
                                    : stageSaveStatus[stage.id] === 'failed'
                                      ? t('interviews.detail.draftNotSavedLocally')
                                      : t('interviews.detail.synced')}
                              </div>
                              <button type="button" onClick={() => saveStage(stage)} disabled={busy || !stageDraft.title.trim()} className={primaryButtonClass}>
                                {t('common.save')}
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                              <InfoTile icon={<FileText size={15} />} label={t('interviews.detail.stageRecordings')} value={`${stageMeetings.length}`} valueTestId="stage-recording-count" />
                              <InfoTile icon={<CalendarDays size={15} />} label={t('interviews.detail.calendarSync')} value={stage.calendarSyncStatus} />
                              <InfoTile icon={<CircleDot size={15} />} label={t('interviews.detail.stageStatus')} value={t(`interviews.stageStatus.${stage.status}`)} />
                            </div>
                            {!isArchived && (
                              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                <select
                                  value={attachMeetingIds[stage.id] ?? ''}
                                  onChange={event => setAttachMeetingIds(prev => ({ ...prev, [stage.id]: event.target.value }))}
                                  className={inputClass}
                                  aria-label={t('interviews.detail.attachRecording')}
                                >
                                  <option value="">{t('interviews.detail.selectMeeting')}</option>
                                  {meetings.map(meeting => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                                </select>
                                <button type="button" onClick={() => attachMeeting(stage)} disabled={!attachMeetingIds[stage.id] || busy} className={secondaryButtonClass}>
                                  {t('interviews.detail.link')}
                                </button>
                              </div>
                            )}
                            <div className="mt-3 space-y-1.5">
                              {stageMeetings.length > 0 ? stageMeetings.map(meeting => (
                                <button
                                  type="button"
                                  key={meeting.id}
                                  onClick={() => onOpenMeeting({
                                    id: meeting.id,
                                    title: meeting.title,
                                    date: meeting.date,
                                    duration: meeting.duration,
                                    summary: '',
                                  })}
                                  className="flex min-h-9 w-full items-center justify-between rounded bg-black/20 px-2 py-1.5 text-left text-[12px] text-text-secondary transition hover:bg-white/[0.05]"
                                >
                                  <span className="truncate">{meeting.title}</span>
                                  <ChevronRight size={13} className="shrink-0 text-text-tertiary" />
                                </button>
                              )) : (
                                <div className="text-[12px] text-text-tertiary">{t('interviews.detail.none')}</div>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-white/[0.025] p-4 text-[13px] text-text-tertiary">
                      {t('interviews.detail.noStages')}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'Prep' && (
                <EditorPanel
                  title={t('interviews.detail.preparation')}
                  action={t('interviews.detail.savePrep')}
                  busy={busy}
                  status={draftStatus.prep}
                  onSave={savePrep}
                  fields={[
                    { key: 'oneLineGoal', label: t('interviews.detail.oneLineGoal'), value: prepDraft.oneLineGoal, rows: 2 },
                    { key: 'pitch30s', label: t('interviews.detail.pitch30s'), value: prepDraft.pitch30s, rows: 3 },
                    { key: 'pitch2m', label: t('interviews.detail.pitch2m'), value: prepDraft.pitch2m, rows: 4 },
                    { key: 'expectedTopics', label: t('interviews.detail.expectedTopics'), value: prepDraft.expectedTopics, rows: 4 },
                    { key: 'cheatsheet', label: t('interviews.detail.cheatSheet'), value: prepDraft.cheatsheet, rows: 8 },
                    { key: 'riskHandling', label: t('interviews.detail.riskHandling'), value: prepDraft.riskHandling, rows: 4 },
                    { key: 'lastChecklist', label: t('interviews.detail.lastChecklist'), value: prepDraft.lastChecklist, rows: 4 },
                  ]}
                  onChange={(key, value) => updateDraft('prep', setPrepDraft, key, value)}
                />
              )}

              {detailTab === 'Retro' && (
                <div className="space-y-4">
                  {retroPrompt?.due && (
                    <div className="rounded-md border border-amber-400/20 bg-amber-500/10 p-4">
                      <div className="text-[13px] font-semibold text-amber-100">{t('interviews.detail.retroDue')}</div>
                      <div className="mt-1 text-[12px] text-amber-100/75">{t('interviews.detail.retroDueDescription')}</div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setDetailTab('Retro')} className="min-h-11 rounded-md bg-amber-300 px-3 text-[12px] font-semibold text-black">{t('interviews.detail.write')}</button>
                        <button type="button" onClick={() => updateRetroPrompt('snooze')} className="min-h-11 rounded-md border border-amber-300/25 px-3 text-[12px] font-semibold text-amber-100">{t('interviews.detail.snooze')}</button>
                        <button type="button" onClick={() => updateRetroPrompt('dismiss')} className="min-h-11 rounded-md border border-white/[0.08] px-3 text-[12px] font-semibold text-text-secondary">{t('common.dismiss')}</button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-md bg-[#101214] p-4 ring-1 ring-white/[0.04]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={labelClass}>{t('interviews.detail.aiEvaluation')}</div>
                        <div className="mt-1 text-[12px] text-text-tertiary">
                          {detail.linkedMeetings?.length
                            ? t('interviews.detail.aiEvaluationDescription')
                            : t('interviews.detail.aiEvaluationNeedsRecording')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={generateRetroEvaluation}
                        disabled={retroEvaluating || busy || !(detail.linkedMeetings?.length)}
                        className={secondaryButtonClass}
                      >
                        <RefreshCw size={14} className={retroEvaluating ? 'animate-spin' : ''} />
                        {retroEvaluation ? t('interviews.detail.regenerateAiEvaluation') : t('interviews.detail.generateAiEvaluation')}
                      </button>
                    </div>
                    {retroEvaluation?.status === 'ready' && (
                      <div className="mt-4 space-y-3 text-[12px] text-text-secondary">
                        {retroEvaluation.summary && (
                          <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-3 leading-5 text-text-primary">
                            {retroEvaluation.summary}
                          </div>
                        )}
                        {([
                          ['signals', t('interviews.detail.aiSignals'), retroEvaluation.signals],
                          ['risks', t('interviews.detail.aiRisks'), retroEvaluation.risks],
                          ['followups', t('interviews.detail.aiFollowups'), retroEvaluation.followups],
                        ] as const).map(([, label, items]) => (
                          items.length > 0 && (
                            <div key={label}>
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{label}</div>
                              <div className="space-y-1.5">
                                {items.map((item, index) => (
                                  <div key={`${label}-${index}`} className="rounded border border-white/[0.06] bg-black/20 px-3 py-2">{item}</div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    {retroEvaluation && retroEvaluation.status !== 'ready' && (
                      <div className="mt-4 rounded-md border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[12px] leading-5 text-amber-100/80">
                        {retroEvaluation.error || t(`interviews.detail.aiEvaluationStatus.${retroEvaluation.status}`)}
                      </div>
                    )}
                    {!retroEvaluation && detail.linkedMeetings?.length ? (
                      <div className="mt-4 rounded-md border border-white/[0.06] bg-white/[0.025] p-3 text-[12px] text-text-tertiary">
                        {t('interviews.detail.aiEvaluationEmpty')}
                      </div>
                    ) : null}
                  </div>
                  <EditorPanel
                    title={t('interviews.detail.retro')}
                    action={t('interviews.detail.saveRetro')}
                    busy={busy}
                    status={draftStatus.retro}
                    onSave={saveRetro}
                    fields={[
                      { key: 'passProbability', label: t('interviews.detail.passProbability'), value: retroDraft.passProbability, rows: 1 },
                      { key: 'mainSignal', label: t('interviews.detail.mainSignal'), value: retroDraft.mainSignal, rows: 4 },
                      { key: 'strongMoments', label: t('interviews.detail.strongMoments'), value: retroDraft.strongMoments, rows: 4 },
                      { key: 'weakMoments', label: t('interviews.detail.weakMoments'), value: retroDraft.weakMoments, rows: 4 },
                      { key: 'newFacts', label: t('interviews.detail.newFacts'), value: retroDraft.newFacts, rows: 4 },
                      { key: 'followUpActions', label: t('interviews.detail.followUpActions'), value: retroDraft.followUpActions, rows: 4 },
                    ]}
                    onChange={(key, value) => updateDraft('retro', setRetroDraft, key, value)}
                  />
                </div>
              )}

              {detailTab === 'Questions' && (
                <div className="space-y-4">
                  <div className="rounded-md bg-[#101214] p-4 ring-1 ring-white/[0.04]">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_150px_auto]">
                      <input value={questionText} onChange={event => setQuestionText(event.target.value)} className={inputClass} placeholder={t('interviews.detail.question')} />
                      <input value={questionCategory} onChange={event => setQuestionCategory(event.target.value)} className={inputClass} placeholder={t('interviews.detail.category')} />
                      <button type="button" onClick={addQuestion} className={primaryButtonClass}>{t('interviews.detail.add')}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {questionDrafts.map((question, index) => (
                      <div key={`${question.id ?? 'draft'}-${index}`} className="flex items-start justify-between gap-3 rounded-md bg-white/[0.025] p-3">
                        <div>
                          <div className="text-[13px] font-medium">{question.questionText}</div>
                          <div className="mt-1 text-[11px] text-text-tertiary">{question.category || t('interviews.detail.uncategorized')}</div>
                        </div>
                        <button type="button" className={iconButtonClass} onClick={() => setQuestionDrafts(prev => prev.filter((_, i) => i !== index))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={saveQuestions} disabled={busy} className={primaryButtonClass}>{t('interviews.detail.saveQuestions')}</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[360px] p-6 text-center">
              <BriefcaseBusiness size={26} className="mx-auto text-cyan-300" />
              <div className="mt-3 text-[15px] font-semibold">{t('interviews.startProcess')}</div>
              <div className="mt-2 text-[13px] leading-5 text-text-tertiary">{t('interviews.noActiveProcessSelected')}</div>
              <button type="button" onClick={() => setShowCreate(true)} className={`${primaryButtonClass} mt-4`}>{t('interviews.newVacancy')}</button>
            </div>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-24px)] w-[min(760px,calc(100vw-24px))] overflow-y-auto rounded-md bg-[#111417] p-5 shadow-2xl ring-1 ring-white/[0.1]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-semibold">{t('interviews.newVacancy')}</div>
                <div className="text-[12px] text-text-tertiary">{t('interviews.detail.rawIntake')}</div>
              </div>
              <button type="button" className={iconButtonClass} onClick={() => {
                setShowCreate(false);
                setCreateCalendarProvider('none');
                setIntakePreview(null);
                setParseWarnings([]);
              }} aria-label={t('common.close')}>
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label={t('interviews.detail.sourceText')}>
                  <textarea
                    className={`${inputClass} min-h-[160px] resize-none`}
                    value={createForm.rawSourceText ?? ''}
                    onChange={event => {
                      setIntakePreview(null);
                      setParseWarnings([]);
                      setCreateForm(prev => ({ ...prev, rawSourceText: event.target.value }));
                    }}
                    placeholder={t('interviews.detail.rawIntakePlaceholder')}
                  />
                </Field>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 text-[11px] text-text-tertiary">
                    {intakePreview
                      ? `${t(intakeClassificationLabelKey(intakePreview.classification))} · ${t('interviews.agent.confidence', { value: Math.round(intakePreview.confidence * 100) })}`
                      : t('interviews.detail.unparsedSource')}
                    {parseWarnings.length > 0 ? ` · ${parseWarnings.join(', ')}` : ''}
                  </div>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => parseSourceText(false)}
                      disabled={busy || !(createForm.rawSourceText ?? '').trim()}
                      className={secondaryButtonClass}
                    >
                      <FileText size={14} />
                      {t('interviews.detail.extractFields')}
                    </button>
                    <button type="button"
                      onClick={() => parseSourceText(true)}
                      disabled={busy || !(createForm.rawSourceText ?? '').trim()}
                      className={secondaryButtonClass}
                    >
                      <MessageSquareText size={14} />
                      {t('interviews.detail.extractWithAi')}
                    </button>
                  </div>
                </div>
              </div>
              <Field label={t('interviews.detail.title')}><input className={inputClass} value={createForm.title} onChange={event => setCreateForm(prev => ({ ...prev, title: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.company')}><input className={inputClass} value={createForm.company ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, company: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.role')}><input className={inputClass} value={createForm.roleTitle ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, roleTitle: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.stage')}><input className={inputClass} value={createForm.stage ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, stage: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.status')}>
                <select className={inputClass} value={createForm.status} onChange={event => setCreateForm(prev => ({ ...prev, status: event.target.value as InterviewStatus }))}>
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{t(`interviews.status.${status}`)}</option>)}
                </select>
              </Field>
              <Field label={t('interviews.detail.priority')}>
                <select className={inputClass} value={createForm.priority} onChange={event => setCreateForm(prev => ({ ...prev, priority: event.target.value as InterviewPriority }))}>
                  {PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </Field>
              <Field label={t('interviews.detail.starts')}>
                <DateTimePickerField
                  value={createForm.startsAt}
                  placeholder={t('interviews.unscheduled')}
                  invalid={isStageDateRangeInvalid({ startsAt: createForm.startsAt ?? null, endsAt: createForm.endsAt ?? null })}
                  onChange={value => updateCreateFormDate('startsAt', value)}
                />
              </Field>
              <Field label={t('interviews.detail.ends')}>
                <DateTimePickerField
                  value={createForm.endsAt}
                  placeholder={t('interviews.unscheduled')}
                  invalid={isStageDateRangeInvalid({ startsAt: createForm.startsAt ?? null, endsAt: createForm.endsAt ?? null })}
                  onChange={value => updateCreateFormDate('endsAt', value)}
                />
              </Field>
              <Field label={t('interviews.detail.vacancyUrl')}><input className={inputClass} value={createForm.vacancyUrl ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, vacancyUrl: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.meetingUrl')}><input className={inputClass} value={createForm.meetingUrl ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, meetingUrl: event.target.value }))} /></Field>
              <Field label={t('interviews.detail.calendarSync')}>
                <select className={inputClass} value={createCalendarProvider} onChange={event => setCreateCalendarProvider(event.target.value as 'none' | 'google' | 'macos')}>
                  <option value="none">{t('interviews.detail.doNotAdd')}</option>
                  <option value="google">{t('interviews.detail.createInGoogleCalendar')}</option>
                  <option value="macos">{t('interviews.detail.createInMacCalendar')}</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => {
                setShowCreate(false);
                setCreateCalendarProvider('none');
                setIntakePreview(null);
                setParseWarnings([]);
              }} className={secondaryButtonClass}>{t('common.cancel')}</button>
              <button type="button" onClick={createInterview} disabled={busy || !(createForm.rawSourceText ?? createForm.title).trim()} className={primaryButtonClass}>
                {intakePreview?.stage ? t('interviews.detail.createVacancyStage') : t('interviews.detail.createVacancy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-[140] flex w-[min(420px,calc(100vw-32px))] items-start gap-3 rounded-md border border-rose-400/25 bg-[#180d10] p-4 text-left shadow-2xl shadow-black/45"
        >
          <AlertCircle size={18} className="mt-0.5 flex-none text-rose-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-rose-100">{t(error.i18nKey)}</div>
            <div className="mt-1 font-mono text-[11px] text-rose-200/70">code: {error.code}</div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-rose-200/70 transition hover:bg-white/[0.06] hover:text-white"
            title={t('common.dismiss')}
            aria-label={t('common.dismiss')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className={labelClass}>{label}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);

const PaneResizeHandle: React.FC<{
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}> = ({ label, onPointerDown, onDoubleClick }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    title={label}
    data-testid="interview-pane-resize-handle"
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    className="group hidden cursor-col-resize items-stretch justify-center bg-[#0a0b0c] outline-none transition hover:bg-cyan-300/[0.08] focus-visible:bg-cyan-300/[0.08] lg:flex"
    tabIndex={0}
  >
    <div className="my-3 w-px rounded-full bg-white/[0.08] transition group-hover:bg-cyan-300/40" />
  </div>
);

const UrlInput: React.FC<{
  value: string;
  emptyLabel: string;
  invalidLabel: string;
  onChange: (value: string) => void;
}> = ({ value, emptyLabel, invalidLabel, onChange }) => {
  const hasValue = value.trim().length > 0;
  const valid = isValidUrl(value);
  return (
    <div>
      <div className="flex gap-1.5">
        <input
          className={`${inputClass} min-w-0 flex-1`}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={emptyLabel}
        />
        <button type="button" className={iconButtonClass} disabled={!valid} onClick={() => window.electronAPI?.openExternal?.(value)} title={emptyLabel}>
          <ArrowUpRight size={14} />
        </button>
        <button type="button" className={iconButtonClass} disabled={!hasValue} onClick={() => void copyText(value)} title="Copy">
          <Copy size={14} />
        </button>
        <button type="button" className={iconButtonClass} disabled={!hasValue} onClick={() => onChange('')} title="Clear">
          <X size={14} />
        </button>
      </div>
      {!hasValue && <div className="mt-1.5 text-[11px] text-text-tertiary">{emptyLabel}</div>}
      {hasValue && !valid && <div className="mt-1.5 text-[11px] text-red-300">{invalidLabel}</div>}
    </div>
  );
};

const InfoTile: React.FC<{ icon: React.ReactNode; label: string; value: string; valueTestId?: string }> = ({ icon, label, value, valueTestId }) => (
  <div className="rounded-md bg-white/[0.025] p-3 ring-1 ring-white/[0.04]">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
      {icon}
      {label}
    </div>
    <div data-testid={valueTestId} className="mt-2 truncate text-[14px] font-semibold">{value}</div>
  </div>
);

const EditorPanel: React.FC<{
  title: string;
  action: string;
  busy: boolean;
  status?: DraftStatus;
  fields: Array<{ key: string; label: string; value: string; rows: number }>;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
}> = ({ title, action, busy, status = 'synced', fields, onChange, onSave }) => {
  const { t } = useTranslation();
  const statusText = status === 'dirty'
    ? t('interviews.detail.draftChanged')
    : status === 'saved'
      ? t('interviews.detail.draftSavedLocally')
      : status === 'failed'
        ? t('interviews.detail.draftNotSavedLocally')
        : t('interviews.detail.synced');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">{title}</div>
          <div className="mt-0.5 text-[11px] text-text-tertiary">
            {statusText}
          </div>
        </div>
        <button type="button" onClick={onSave} disabled={busy} className={primaryButtonClass}>
          {action}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {fields.map(field => (
          <div key={field.key} className={field.rows > 4 ? 'md:col-span-2' : undefined}>
            <Field label={field.label}>
              <textarea
                className={`${inputClass} resize-none`}
                rows={field.rows}
                value={field.value}
                onChange={event => onChange(field.key, event.target.value)}
              />
            </Field>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterviewCommandCenter;
