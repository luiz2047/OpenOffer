import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  Link as LinkIcon,
  ListChecks,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type {
  CalendarProvider,
  CalendarSnapshot,
  InterviewCreatePayload,
  InterviewDetail,
  InterviewListItem,
  InterviewPriority,
  InterviewQuestionPayload,
  InterviewRetroPayload,
  InterviewSourceParseResult,
  InterviewStatus,
  PrepBriefPayload,
  ReadinessResult,
  RetroPromptDecision,
  VacancyDossierPayload,
} from '../../types/interviews';
import { interviewApi } from './api';

interface MeetingSummary {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
}

interface CalendarEventSummary {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  link?: string;
  source: 'google' | 'macos' | string;
  attendees?: Array<{ email: string; name?: string; photoUrl?: string; response?: string }>;
}

export interface InterviewMeetingStartMetadata {
  title?: string;
  calendarEventId?: string;
  interviewEventId?: string;
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
}

const STATUS_OPTIONS: InterviewStatus[] = ['active', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived'];
const PRIORITY_OPTIONS: InterviewPriority[] = ['normal', 'high', 'low'];
const DETAIL_TABS = ['Vacancy', 'Prep', 'Retro', 'Questions'] as const;

type DetailTab = typeof DETAIL_TABS[number];
type DraftStatus = 'synced' | 'dirty' | 'saved' | 'failed';

const DRAFT_PREFIX = 'openoffer:interviews:draft';

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

function formatDateTime(ms?: number | null): string {
  if (!ms) return 'Unscheduled';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalInputValue(ms?: number | null): string {
  if (!ms) return '';
  const date = new Date(ms);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
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

function readinessTone(level?: ReadinessResult['level']): string {
  if (level === 'ready') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (level === 'needs_work') return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
}

function statusTone(status: InterviewStatus): string {
  switch (status) {
    case 'offer':
      return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    case 'rejected':
    case 'withdrawn':
      return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    case 'interviewing':
      return 'text-sky-300 bg-sky-500/10 border-sky-500/20';
    case 'screening':
      return 'text-violet-300 bg-violet-500/10 border-violet-500/20';
    default:
      return 'text-zinc-200 bg-white/[0.04] border-white/[0.08]';
  }
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

function dossierDraftFromDetail(detail: InterviewDetail) {
  return {
    description: detail.dossier?.description ?? detail.rawSourceText ?? '',
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

const inputClass = 'w-full rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-[13px] text-text-primary outline-none transition focus:border-sky-400/40 focus:bg-black/30';
const labelClass = 'text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary';
const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-white/[0.06] hover:text-text-primary';

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
}) => {
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [retroPrompt, setRetroPrompt] = useState<RetroPromptDecision | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [activeProvider, setActiveProvider] = useState<CalendarProvider>('google');
  const [detailTab, setDetailTab] = useState<DetailTab>('Vacancy');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<InterviewCreatePayload>(initialCreateForm);
  const [createCalendarProvider, setCreateCalendarProvider] = useState<'none' | 'google' | 'macos'>('none');
  const [sourceParsePreview, setSourceParsePreview] = useState<InterviewSourceParseResult | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [dossierDraft, setDossierDraft] = useState(initialDossierDraft);
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
  const [attachMeetingId, setAttachMeetingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInterviews = useCallback(async () => {
    try {
      setError(null);
      const rows = await interviewApi.list({ limit: 100 });
      setInterviews(rows);
      setSelectedId(current => {
        if (current && rows.some(row => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load interviews.');
    }
  }, []);

  const loadCalendarStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI?.getCalendarStatus?.();
      if (status) {
        setCalendarStatus(status);
        onCalendarConnected(Boolean(status.connected));
      }
    } catch {
      setCalendarStatus({ connected: false });
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
      setReadiness(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [nextDetail, nextReadiness, nextRetroPrompt] = await Promise.all([
          interviewApi.get(selectedId),
          interviewApi.getReadiness(selectedId),
          interviewApi.getRetroPrompt(selectedId),
        ]);
        if (cancelled) return;
        setDetail(nextDetail);
        setReadiness(nextReadiness);
        setRetroPrompt(nextRetroPrompt);
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
        if (!cancelled) setError(err?.message || 'Could not open interview.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredInterviews = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return interviews;
    return interviews.filter(item => [
      item.title,
      item.company,
      item.roleTitle,
      item.stage,
      item.source,
    ].some(value => String(value ?? '').toLowerCase().includes(needle)));
  }, [interviews, query]);

  const upcomingForProvider = useMemo(() => {
    return upcomingEvents
      .filter(event => eventProvider(event) === activeProvider)
      .filter(event => new Date(event.endTime).getTime() > Date.now() - 5 * 60_000)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [activeProvider, upcomingEvents]);

  const calendarDays = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const count = upcomingForProvider.filter(event => new Date(event.startTime).toDateString() === day.toDateString()).length;
      return { day, count };
    });
  }, [upcomingForProvider]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

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

  const parseSourceText = async () => {
    const rawText = createForm.rawSourceText ?? '';
    await run(async () => {
      const parsed = await interviewApi.parseSourceText(rawText);
      setSourceParsePreview(parsed);
      setParseWarnings(parsed.warnings);
      setCreateForm(prev => ({
        ...prev,
        title: prev.title.trim() || parsed.fields.title || prev.title,
        company: prev.company?.trim() ? prev.company : parsed.fields.company ?? prev.company,
        roleTitle: prev.roleTitle?.trim() ? prev.roleTitle : parsed.fields.roleTitle ?? prev.roleTitle,
        stage: prev.stage?.trim() && prev.stage !== 'Recruiter screen' ? prev.stage : parsed.fields.stage ?? prev.stage,
        source: parsed.fields.source ?? prev.source,
        vacancyUrl: prev.vacancyUrl?.trim() ? prev.vacancyUrl : parsed.fields.vacancyUrl ?? prev.vacancyUrl,
        meetingUrl: prev.meetingUrl?.trim() ? prev.meetingUrl : parsed.fields.meetingUrl ?? prev.meetingUrl,
        rawSourceText: parsed.fields.rawSourceText ?? prev.rawSourceText,
      }));
    });
  };

  const createInterview = async () => {
    await run(async () => {
      const created = await interviewApi.create(createForm);
      if (sourceParsePreview && hasDossierPayload(sourceParsePreview.dossier)) {
        await interviewApi.saveDossier(created.id, sourceParsePreview.dossier);
      }
      if (sourceParsePreview && hasPrepPayload(sourceParsePreview.prep)) {
        await interviewApi.savePrep(created.id, {
          expectedTopics: sourceParsePreview.prep.expectedTopics ?? [],
          cheatsheet: sourceParsePreview.prep.cheatsheet ?? null,
          riskHandling: sourceParsePreview.prep.riskHandling ?? [],
        });
      }
      if (createCalendarProvider !== 'none' && createForm.startsAt && createForm.endsAt) {
        try {
          await interviewApi.createCalendarEvent(created.id, createCalendarProvider);
        } catch (err: any) {
          setError(`Created locally. Calendar sync failed: ${err?.message || 'unknown error'}`);
        }
      }
      setShowCreate(false);
      setCreateForm(initialCreateForm());
      setCreateCalendarProvider('none');
      setSourceParsePreview(null);
      setParseWarnings([]);
      await loadInterviews();
      setSelectedId(created.id);
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
        source: activeProvider === 'macos' ? 'macOS Calendar' : 'Google Calendar',
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
      setReadiness(await interviewApi.getReadiness(detail.id));
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
      setReadiness(await interviewApi.getReadiness(detail.id));
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
      setDetail(await interviewApi.get(detail.id));
      setRetroPrompt(await interviewApi.getRetroPrompt(detail.id));
      setRetroDraft(initialRetroDraft());
    });
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

  const attachMeeting = async () => {
    if (!detail || !attachMeetingId) return;
    await run(async () => {
      await interviewApi.attachMeeting(detail.id, attachMeetingId);
      setDetail(await interviewApi.get(detail.id));
      setAttachMeetingId('');
    });
  };

  const startSelectedInterview = () => {
    if (!detail) {
      onStartMeeting();
      return;
    }
    onStartMeeting({
      title: detail.title,
      interviewEventId: detail.id,
      calendarEventId: detail.calendarEventId ?? undefined,
      source: 'manual',
    });
  };

  return (
    <div data-testid="interview-command-center" className="grid h-full min-h-0 grid-cols-[292px_minmax(300px,380px)_1fr] bg-[#0b0d0f] text-text-primary">
      <aside className="flex min-h-0 flex-col border-r border-white/[0.07] bg-[#101316]">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-sky-300" />
            <span className="text-[14px] font-semibold">Calendar</span>
          </div>
          <button className={iconButtonClass} onClick={refreshAll} title="Refresh">
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="border-b border-white/[0.07] p-3">
          <div className="grid grid-cols-2 rounded-md bg-black/20 p-1">
            {(['google', 'macos'] as CalendarProvider[]).map(provider => (
              <button
                key={provider}
                onClick={() => setActiveProvider(provider)}
                className={`rounded px-2 py-1.5 text-[12px] font-medium transition ${activeProvider === provider ? 'bg-white/[0.08] text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
              >
                {provider === 'google' ? 'Google' : 'Mac'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-text-primary">
                {activeProvider === 'google' ? (calendarStatus?.connected ? 'Connected' : 'Not connected') : 'Local calendar'}
              </div>
              <div className="truncate text-[11px] text-text-tertiary">
                {activeProvider === 'google' ? (calendarStatus?.email ?? 'Google Calendar') : 'macOS Calendar'}
              </div>
            </div>
            {activeProvider === 'google' ? (
              <button
                className="rounded-md bg-sky-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-sky-400"
                onClick={() => window.electronAPI?.calendarConnect?.().then(result => {
                  if (result.success) void loadCalendarStatus();
                  else setError(result.error || 'Calendar connection failed.');
                })}
              >
                {calendarStatus?.connected ? 'Reconnect' : 'Connect'}
              </button>
            ) : (
              <button
                className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary"
                onClick={() => onOpenSettings('calendar')}
              >
                Settings
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 border-b border-white/[0.07] p-3">
          {calendarDays.map(({ day, count }) => {
            const today = day.toDateString() === new Date().toDateString();
            return (
              <div key={day.toISOString()} className={`flex h-14 flex-col items-center justify-center rounded-md border text-center ${today ? 'border-sky-400/30 bg-sky-500/10' : 'border-white/[0.06] bg-white/[0.025]'}`}>
                <span className="text-[10px] uppercase text-text-tertiary">{day.toLocaleDateString([], { weekday: 'short' })}</span>
                <span className="text-[14px] font-semibold">{day.getDate()}</span>
                <span className="h-1.5 min-w-1.5 rounded-full bg-sky-400/80 px-1 text-[8px] leading-[6px] text-transparent">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Upcoming</span>
            <span className="text-[11px] text-text-tertiary">{upcomingForProvider.length}</span>
          </div>
          <div className="space-y-2">
            {upcomingForProvider.slice(0, 12).map(event => (
              <button
                key={event.id}
                onClick={() => createFromEvent(event)}
                className="w-full rounded-md border border-white/[0.07] bg-white/[0.035] p-3 text-left transition hover:border-sky-400/30 hover:bg-sky-500/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{event.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                      <Clock3 size={12} />
                      {formatDateTime(new Date(event.startTime).getTime())}
                    </div>
                  </div>
                  <Plus size={15} className="mt-0.5 text-text-secondary" />
                </div>
              </button>
            ))}
            {upcomingForProvider.length === 0 && (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-4 text-[12px] text-text-tertiary">
                No scheduled events.
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col border-r border-white/[0.07] bg-[#0d1013]">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4">
          <div>
            <div className="text-[14px] font-semibold">Interview OS</div>
            <div className="text-[11px] text-text-tertiary">{interviews.length} active process{interviews.length === 1 ? '' : 'es'}</div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-white text-black px-3 py-1.5 text-[12px] font-semibold transition hover:bg-zinc-200"
          >
            <Plus size={14} />
            Interview
          </button>
        </div>

        <div className="border-b border-white/[0.07] p-3">
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
            <Search size={15} className="text-text-tertiary" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search company, role, stage"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="space-y-2">
            {filteredInterviews.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-md border p-3 text-left transition ${selectedId === item.id ? 'border-sky-400/35 bg-sky-500/10' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.055]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{item.title}</div>
                    <div className="mt-1 truncate text-[12px] text-text-secondary">
                      {[item.company, item.roleTitle].filter(Boolean).join(' · ') || item.stage || 'No vacancy context'}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-text-tertiary">
                  <span>{formatDateTime(item.startsAt)}</span>
                  <span>{item.questionCount} questions</span>
                </div>
              </button>
            ))}
            {filteredInterviews.length === 0 && (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.025] p-4 text-[13px] text-text-tertiary">
                No interviews yet.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Recordings</span>
            <button onClick={startSelectedInterview} className="text-[11px] font-semibold text-sky-300 hover:text-sky-200">
              {isMeetingActive ? 'Open live' : 'Start'}
            </button>
          </div>
          <div className="space-y-1.5">
            {meetings.slice(0, 3).map(meeting => (
              <button key={meeting.id} onClick={() => onOpenMeeting(meeting)} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.05]">
                <span className="truncate text-text-secondary">{meeting.title}</span>
                <ChevronRight size={14} className="shrink-0 text-text-tertiary" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-[#0b0d0f]">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-sky-300">
              <BriefcaseBusiness size={17} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{detail?.title ?? 'No interview selected'}</div>
              <div className="truncate text-[11px] text-text-tertiary">{detail ? [detail.company, detail.roleTitle].filter(Boolean).join(' · ') || 'Vacancy context pending' : 'Create or select a process'}</div>
            </div>
          </div>
          {detail && (
            <div className="flex items-center gap-2">
              <button
                onClick={startSelectedInterview}
                className="rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-zinc-200"
              >
                {isMeetingActive ? 'Open live' : 'Start'}
              </button>
              <select
                value={detail.status}
                onChange={event => updateStatus(detail.id, event.target.value as InterviewStatus)}
                className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5 text-[12px] outline-none"
              >
                {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              <button className={iconButtonClass} title="Archive" onClick={() => detail && run(async () => {
                await interviewApi.archive(detail.id);
                await loadInterviews();
              })}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {detail ? (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_268px]">
            <div className="min-h-0 overflow-y-auto p-5 custom-scrollbar">
              <div className="mb-5 flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.025] p-1">
                {DETAIL_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition ${detailTab === tab ? 'bg-white/[0.08] text-white' : 'text-text-secondary hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {detailTab === 'Vacancy' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoTile icon={<BriefcaseBusiness size={16} />} label="Company" value={detail.company || 'Unfilled'} />
                    <InfoTile icon={<UserRound size={16} />} label="Role" value={detail.roleTitle || 'Unfilled'} />
                    <InfoTile icon={<CircleDot size={16} />} label="Stage" value={detail.stage || 'Unfilled'} />
                    <InfoTile icon={<Clock3 size={16} />} label="Schedule" value={formatDateTime(detail.startsAt)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className="flex items-center justify-between rounded-md border border-white/[0.07] bg-white/[0.03] p-3 text-left transition hover:border-sky-400/30"
                      onClick={() => detail.vacancyUrl && window.electronAPI?.openExternal?.(detail.vacancyUrl)}
                    >
                      <span className="text-[13px] text-text-secondary">Vacancy URL</span>
                      <ArrowUpRight size={15} className="text-text-tertiary" />
                    </button>
                    <button
                      className="flex items-center justify-between rounded-md border border-white/[0.07] bg-white/[0.03] p-3 text-left transition hover:border-sky-400/30"
                      onClick={() => detail.meetingUrl && window.electronAPI?.openExternal?.(detail.meetingUrl)}
                    >
                      <span className="text-[13px] text-text-secondary">Meeting URL</span>
                      <LinkIcon size={15} className="text-text-tertiary" />
                    </button>
                  </div>
                  <div className="rounded-md border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className={labelClass}>Raw vacancy / HR context</div>
                    <div className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-text-secondary">
                      {detail.rawSourceText || 'No source text yet.'}
                    </div>
                  </div>
                  <EditorPanel
                    title="Vacancy dossier"
                    action="Save dossier"
                    busy={busy}
                    status={draftStatus.dossier}
                    onSave={saveDossier}
                    fields={[
                      { key: 'description', label: 'Description', value: dossierDraft.description, rows: 6 },
                      { key: 'requirements', label: 'Requirements', value: dossierDraft.requirements, rows: 5 },
                      { key: 'compensationText', label: 'Compensation', value: dossierDraft.compensationText, rows: 2 },
                      { key: 'fitHypothesis', label: 'Fit hypothesis', value: dossierDraft.fitHypothesis, rows: 4 },
                      { key: 'risks', label: 'Risks', value: dossierDraft.risks, rows: 4 },
                      { key: 'questionsToAsk', label: 'Questions to ask', value: dossierDraft.questionsToAsk, rows: 4 },
                    ]}
                    onChange={(key, value) => updateDraft('dossier', setDossierDraft, key, value)}
                  />
                  <div className="rounded-md border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className={labelClass}>Attach recording</div>
                    <div className="mt-3 flex gap-2">
                      <select value={attachMeetingId} onChange={event => setAttachMeetingId(event.target.value)} className={inputClass}>
                        <option value="">Select meeting</option>
                        {meetings.map(meeting => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                      </select>
                      <button onClick={attachMeeting} disabled={!attachMeetingId || busy} className="rounded-md bg-sky-500 px-3 text-[12px] font-semibold text-white disabled:opacity-40">
                        Link
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'Prep' && (
                <EditorPanel
                  title="Preparation"
                  action="Save prep"
                  busy={busy}
                  status={draftStatus.prep}
                  onSave={savePrep}
                  fields={[
                    { key: 'oneLineGoal', label: 'One-line goal', value: prepDraft.oneLineGoal, rows: 2 },
                    { key: 'pitch30s', label: '30s pitch', value: prepDraft.pitch30s, rows: 3 },
                    { key: 'pitch2m', label: '2m pitch', value: prepDraft.pitch2m, rows: 4 },
                    { key: 'expectedTopics', label: 'Expected topics', value: prepDraft.expectedTopics, rows: 4 },
                    { key: 'cheatsheet', label: 'Cheat sheet', value: prepDraft.cheatsheet, rows: 8 },
                    { key: 'riskHandling', label: 'Risk handling', value: prepDraft.riskHandling, rows: 4 },
                    { key: 'lastChecklist', label: 'Last checklist', value: prepDraft.lastChecklist, rows: 4 },
                  ]}
                  onChange={(key, value) => updateDraft('prep', setPrepDraft, key, value)}
                />
              )}

              {detailTab === 'Retro' && (
                <div className="space-y-4">
                  {retroPrompt?.due && (
                    <div className="rounded-md border border-amber-400/20 bg-amber-500/10 p-4">
                      <div className="text-[13px] font-semibold text-amber-100">Retro is due</div>
                      <div className="mt-1 text-[12px] text-amber-100/75">Capture what changed before the interview context decays.</div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setDetailTab('Retro')} className="rounded-md bg-amber-300 px-3 py-1.5 text-[12px] font-semibold text-black">Write</button>
                        <button onClick={() => updateRetroPrompt('snooze')} className="rounded-md border border-amber-300/25 px-3 py-1.5 text-[12px] font-semibold text-amber-100">Snooze</button>
                        <button onClick={() => updateRetroPrompt('dismiss')} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-text-secondary">Dismiss</button>
                      </div>
                    </div>
                  )}
                  <EditorPanel
                    title="Retro"
                    action="Save retro"
                    busy={busy}
                    status={draftStatus.retro}
                    onSave={saveRetro}
                    fields={[
                      { key: 'passProbability', label: 'Pass probability', value: retroDraft.passProbability, rows: 1 },
                      { key: 'mainSignal', label: 'Main signal', value: retroDraft.mainSignal, rows: 4 },
                      { key: 'strongMoments', label: 'Strong moments', value: retroDraft.strongMoments, rows: 4 },
                      { key: 'weakMoments', label: 'Weak moments', value: retroDraft.weakMoments, rows: 4 },
                      { key: 'newFacts', label: 'New facts', value: retroDraft.newFacts, rows: 4 },
                      { key: 'followUpActions', label: 'Follow-up actions', value: retroDraft.followUpActions, rows: 4 },
                    ]}
                    onChange={(key, value) => updateDraft('retro', setRetroDraft, key, value)}
                  />
                </div>
              )}

              {detailTab === 'Questions' && (
                <div className="space-y-4">
                  <div className="rounded-md border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="grid grid-cols-[1fr_150px_auto] gap-2">
                      <input value={questionText} onChange={event => setQuestionText(event.target.value)} className={inputClass} placeholder="Question" />
                      <input value={questionCategory} onChange={event => setQuestionCategory(event.target.value)} className={inputClass} placeholder="Category" />
                      <button onClick={addQuestion} className="rounded-md bg-white px-3 text-[12px] font-semibold text-black">Add</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {questionDrafts.map((question, index) => (
                      <div key={`${question.id ?? 'draft'}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
                        <div>
                          <div className="text-[13px] font-medium">{question.questionText}</div>
                          <div className="mt-1 text-[11px] text-text-tertiary">{question.category || 'uncategorized'}</div>
                        </div>
                        <button className={iconButtonClass} onClick={() => setQuestionDrafts(prev => prev.filter((_, i) => i !== index))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={saveQuestions} disabled={busy} className="rounded-md bg-sky-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">Save questions</button>
                </div>
              )}
            </div>

            <aside className="min-h-0 overflow-y-auto border-l border-white/[0.07] bg-[#101316] p-4 custom-scrollbar">
              <div className={`rounded-md border px-3 py-2 ${readinessTone(readiness?.level)}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">Readiness</span>
                  <span className="text-[18px] font-bold tabular-nums">{readiness?.score ?? 0}</span>
                </div>
                <div className="mt-1 text-[11px] text-current opacity-80">{readiness?.nextAction ?? readiness?.level ?? 'not_started'}</div>
              </div>
              <SideMetric icon={<ListChecks size={15} />} label="Checklist" value={`${detail.prep?.lastChecklist?.length ?? 0} items`} />
              <SideMetric icon={<MessageSquareText size={15} />} label="Questions" value={`${detail.questions?.length ?? 0} saved`} />
              <SideMetric icon={<FileText size={15} />} label="Retros" value={`${detail.retros?.length ?? 0} notes`} />
              <div className="mt-4 rounded-md border border-white/[0.07] bg-white/[0.025] p-3">
                <div className={labelClass}>Linked recordings</div>
                <div className="mt-3 space-y-2">
                  {(detail.linkedMeetings ?? []).map(meeting => (
                    <div key={meeting.id} className="rounded bg-black/20 px-2 py-1.5 text-[12px] text-text-secondary">{meeting.title}</div>
                  ))}
                  {(detail.linkedMeetings ?? []).length === 0 && <div className="text-[12px] text-text-tertiary">None</div>}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-[360px] rounded-md border border-white/[0.07] bg-white/[0.03] p-6 text-center">
              <Sparkles size={26} className="mx-auto text-sky-300" />
              <div className="mt-3 text-[15px] font-semibold">Start a process</div>
              <div className="mt-2 text-[13px] leading-5 text-text-tertiary">No active process selected.</div>
              <button onClick={() => setShowCreate(true)} className="mt-4 rounded-md bg-white px-4 py-2 text-[12px] font-semibold text-black">New interview</button>
            </div>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="w-[680px] rounded-lg border border-white/[0.1] bg-[#111417] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-semibold">New interview</div>
                <div className="text-[12px] text-text-tertiary">Manual intake</div>
              </div>
              <button className={iconButtonClass} onClick={() => {
                setShowCreate(false);
                setCreateCalendarProvider('none');
                setSourceParsePreview(null);
                setParseWarnings([]);
              }} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input className={inputClass} value={createForm.title} onChange={event => setCreateForm(prev => ({ ...prev, title: event.target.value }))} /></Field>
              <Field label="Company"><input className={inputClass} value={createForm.company ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, company: event.target.value }))} /></Field>
              <Field label="Role"><input className={inputClass} value={createForm.roleTitle ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, roleTitle: event.target.value }))} /></Field>
              <Field label="Stage"><input className={inputClass} value={createForm.stage ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, stage: event.target.value }))} /></Field>
              <Field label="Status">
                <select className={inputClass} value={createForm.status} onChange={event => setCreateForm(prev => ({ ...prev, status: event.target.value as InterviewStatus }))}>
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputClass} value={createForm.priority} onChange={event => setCreateForm(prev => ({ ...prev, priority: event.target.value as InterviewPriority }))}>
                  {PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </Field>
              <Field label="Starts"><input className={inputClass} type="datetime-local" value={toLocalInputValue(createForm.startsAt)} onChange={event => setCreateForm(prev => ({ ...prev, startsAt: fromLocalInputValue(event.target.value) }))} /></Field>
              <Field label="Ends"><input className={inputClass} type="datetime-local" value={toLocalInputValue(createForm.endsAt)} onChange={event => setCreateForm(prev => ({ ...prev, endsAt: fromLocalInputValue(event.target.value) }))} /></Field>
              <Field label="Vacancy URL"><input className={inputClass} value={createForm.vacancyUrl ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, vacancyUrl: event.target.value }))} /></Field>
              <Field label="Meeting URL"><input className={inputClass} value={createForm.meetingUrl ?? ''} onChange={event => setCreateForm(prev => ({ ...prev, meetingUrl: event.target.value }))} /></Field>
              <Field label="Calendar sync">
                <select className={inputClass} value={createCalendarProvider} onChange={event => setCreateCalendarProvider(event.target.value as 'none' | 'google' | 'macos')}>
                  <option value="none">Do not add</option>
                  <option value="google">Create in Google Calendar</option>
                  <option value="macos">Create in Mac Calendar</option>
                </select>
              </Field>
              <div className="self-end pb-2 text-[11px] leading-4 text-text-tertiary">
                Requires start and end time.
              </div>
              <div className="col-span-2">
                <Field label="Source text">
                  <textarea
                    className={`${inputClass} min-h-[130px] resize-none`}
                    value={createForm.rawSourceText ?? ''}
                    onChange={event => {
                      setSourceParsePreview(null);
                      setParseWarnings([]);
                      setCreateForm(prev => ({ ...prev, rawSourceText: event.target.value }));
                    }}
                  />
                </Field>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-[11px] text-text-tertiary">
                    {sourceParsePreview ? `${sourceParsePreview.fieldCount} fields detected` : 'Paste HH, Getmatch, Telegram, or calendar context.'}
                    {parseWarnings.length > 0 ? ` · ${parseWarnings.join(', ')}` : ''}
                  </div>
                  <button
                    onClick={parseSourceText}
                    disabled={busy || !(createForm.rawSourceText ?? '').trim()}
                    className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                  >
                    <Sparkles size={14} />
                    Parse
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => {
                setShowCreate(false);
                setCreateCalendarProvider('none');
                setSourceParsePreview(null);
                setParseWarnings([]);
              }} className="rounded-md border border-white/[0.08] px-4 py-2 text-[12px] font-semibold text-text-secondary">Cancel</button>
              <button onClick={createInterview} disabled={busy || !createForm.title.trim()} className="rounded-md bg-sky-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">
                Create
              </button>
            </div>
          </div>
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

const InfoTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
      {icon}
      {label}
    </div>
    <div className="mt-2 truncate text-[14px] font-semibold">{value}</div>
  </div>
);

const SideMetric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="mt-3 flex items-center justify-between rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2">
    <div className="flex items-center gap-2 text-[12px] text-text-secondary">
      {icon}
      {label}
    </div>
    <div className="text-[12px] font-semibold">{value}</div>
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
}> = ({ title, action, busy, status = 'synced', fields, onChange, onSave }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[11px] text-text-tertiary">
          {status === 'dirty' ? 'Draft changed' : status === 'saved' ? 'Draft saved locally' : status === 'failed' ? 'Draft not saved locally' : 'Synced'}
        </div>
      </div>
      <button onClick={onSave} disabled={busy} className="rounded-md bg-sky-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">
        {action}
      </button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {fields.map(field => (
        <Field key={field.key} label={field.label}>
          <textarea
            className={`${inputClass} resize-none ${field.rows > 4 ? 'col-span-2' : ''}`}
            rows={field.rows}
            value={field.value}
            onChange={event => onChange(field.key, event.target.value)}
          />
        </Field>
      ))}
    </div>
  </div>
);

export default InterviewCommandCenter;
