import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CircleDot, FileText, Loader2, Play, Save, ShieldCheck } from 'lucide-react';
import type { ApplicationDetail, InterviewStage, StageWorkspaceSnapshot } from '../../types/interviews';
import { stageWorkspaceApi } from './api';

interface StageWorkspacePanelProps {
  application: ApplicationDetail;
  stage: InterviewStage;
  isMeetingActive: boolean;
  busy?: boolean;
  onStartMeeting: (metadata: {
    title?: string;
    interviewEventId?: string;
    interviewStageId?: string;
    applicationId?: string;
    calendarEventId?: string;
    source?: 'manual' | 'calendar';
    stageWorkspaceMeetingId?: string;
    stageWorkspaceSessionRevision?: number;
  }) => void;
  onOpenMeeting?: (meetingId: string) => void;
}

const inputClass = 'min-h-10 w-full rounded-md border border-white/[0.08] bg-bg-input px-3 py-2 text-[12px] text-text-primary outline-none transition focus:border-cyan-300/45';
const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-[12px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

function statusLabel(snapshot: StageWorkspaceSnapshot, ru = false): string {
  if (snapshot.status.session === 'recording') return ru ? 'Запись' : 'Recording';
  if (snapshot.status.session === 'initializing') return ru ? 'Подготовка записи' : 'Preparing capture';
  if (snapshot.status.session === 'stopping') return ru ? 'Завершение' : 'Finishing';
  if (snapshot.status.session === 'failed') return ru ? 'Ошибка захвата — повторите после исправления' : 'Capture failed — retry when ready';
  if (snapshot.status.session === 'abandoned') return ru ? 'Прервано — проверьте или запустите заново' : 'Interrupted — review or retake';
  if (snapshot.status.session === 'stopped') return snapshot.status.review === 'saved' ? (ru ? 'Проверено' : 'Reviewed') : (ru ? 'Готово к разбору' : 'Ready for review');
  if (snapshot.status.primaryStep === 'context') return ru ? 'Нужен контекст' : 'Context needed';
  if (snapshot.status.primaryStep === 'prepare') return ru ? 'Подготовка' : 'Prepare';
  return ru ? 'Готово' : 'Ready';
}

export const StageWorkspacePanel: React.FC<StageWorkspacePanelProps> = ({
  application,
  stage,
  isMeetingActive,
  busy = false,
  onStartMeeting,
  onOpenMeeting,
}) => {
  const { i18n } = useTranslation();
  const ru = i18n.language?.toLowerCase().startsWith('ru');
  const copy = ru ? {
    workspace: 'Рабочее пространство этапа', stage: 'Текущий этап', recording: 'Запись', finishing: 'Завершение', failed: 'Ошибка захвата — повторите после исправления', interrupted: 'Прервано — проверьте или запустите заново', reviewed: 'Проверено', reviewReady: 'Готово к разбору', contextNeeded: 'Нужен контекст', prepare: 'Подготовка', ready: 'Готово', loading: 'Загрузка', start: 'Начать этот этап', openLive: 'Открыть эфир', context: 'Контекст', contextMissing: 'Добавьте текст вакансии или этапа перед записью.', confirm: 'Подтверждаю контекст этого этапа и разрешаю использовать его для записи.', readiness: 'Готовность', runPreflight: 'Проверить провайдеры', checking: 'Проверка провайдеров…', readyContinue: 'Можно продолжать', preparation: 'Подготовка', saveGoal: 'Сохранить цель', goalPlaceholder: 'Что должно быть понятно к концу этапа?', review: 'Разбор', saveReview: 'Сохранить разбор', reviewPlaceholder: 'Какой сигнал дал этот этап?', source: 'Источник разбора', clearReview: 'Очистить сохранённый разбор перед сменой источника', sessions: 'Сессии этого этапа', useForReview: 'Использовать для разбора', clearSource: 'Снять источник разбора', deleteSession: 'Удалить данные', deleteSessionConfirm: 'Удалить эту сессию, расшифровку и сохранённые артефакты? Это нельзя отменить.', processing: 'Обработка', nextAction: 'Следующее действие', save: 'Сохранить', nextPlaceholder: 'Конкретный следующий шаг после этапа', complete: 'Отметить выполненным', none: 'Следующее действие не требуется', export: 'Экспорт рабочего пространства', exportHint: 'JSON/Markdown включают вакансию, подготовку, разбор и следующее действие. Аудио не экспортируется.', transcript: 'Включить расшифровку', json: 'JSON', markdown: 'Markdown', noContext: 'Нет текста вакансии или этапа.', openRecording: 'Открыть запись', dataFlow: 'Поток данных этапа', local: 'локальная SQLite-база', transcriptLocal: 'локально после записи', ai: 'не вызываются автоматически', stageWorkspace: 'Рабочее пространство этапа', revision: 'ревизия', noNext: 'Следующее действие не задано', noPrep: 'Подготовка не сохранена', noReview: 'Разбор не сохранён', noSession: 'Нет завершённой сессии', noProvider: 'Провайдер не готов', 
  } : {
    workspace: 'Stage Workspace', stage: 'Current stage workspace', recording: 'Recording', finishing: 'Finishing', failed: 'Capture failed — retry when ready', interrupted: 'Interrupted — review or retake', reviewed: 'Reviewed', reviewReady: 'Ready for review', contextNeeded: 'Context needed', prepare: 'Prepare', ready: 'Ready', loading: 'Loading', start: 'Start this stage', openLive: 'Open live', context: 'Context', contextMissing: 'Add recruiter or stage context before recording.', confirm: 'I confirm this is the context for this stage and may be used for the recording.', readiness: 'Readiness', runPreflight: 'Run preflight', checking: 'Checking providers…', readyContinue: 'Ready to continue', preparation: 'Preparation', saveGoal: 'Save goal', goalPlaceholder: 'What must be clear by the end of this stage?', review: 'Review', saveReview: 'Save review', reviewPlaceholder: 'What signal did this stage produce?', source: 'Review source', clearReview: 'Clear saved review to switch source', sessions: 'Sessions for this stage', useForReview: 'Use for review', clearSource: 'Clear review source', deleteSession: 'Delete data', deleteSessionConfirm: 'Delete this session, transcript, and saved artifacts? This cannot be undone.', processing: 'Processing', nextAction: 'Next action', save: 'Save', nextPlaceholder: 'The concrete next step after this stage', complete: 'Mark completed', none: 'No next action required', export: 'Export workspace', exportHint: 'JSON/Markdown include vacancy, preparation, review, and next action. Audio is never exported.', transcript: 'Include transcript', json: 'JSON', markdown: 'Markdown', noContext: 'No recruiter or stage context yet.', openRecording: 'Open recording', dataFlow: 'Data flow for this stage', local: 'local SQLite workspace', transcriptLocal: 'stored locally after recording', ai: 'not called automatically by this workspace', stageWorkspace: 'Stage Workspace', revision: 'revision', noNext: 'No next action', noPrep: 'No preparation saved', noReview: 'No review saved', noSession: 'No completed session', noProvider: 'Provider is not ready',
  };
  const [snapshot, setSnapshot] = useState<StageWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [cheatsheet, setCheatsheet] = useState('');
  const [expectedTopics, setExpectedTopics] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [review, setReview] = useState('');
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'markdown' | null>(null);
  const [saving, setSaving] = useState<'prepare' | 'review' | 'next' | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const lastEventSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = Object.prototype.hasOwnProperty.call(window.electronAPI ?? {}, 'stageWorkspaceGet')
        ? await stageWorkspaceApi.get(stage.id)
        : {
            schemaVersion: 1 as const,
            stageId: stage.id,
            revision: stage.workspaceRevision ?? 0,
            application,
            stage,
            context: {
              sourceText: stage.rawSourceText ?? application.rawSourceText ?? null,
              sourceHash: null,
              confirmed: Boolean((stage.rawSourceText ?? application.rawSourceText)?.trim()),
            },
            preparation: null,
            readiness: {
              score: 0,
              level: 'not_started' as const,
              blockers: [],
              warnings: ['Stage Workspace bridge is not available in this renderer.'],
              completed: [],
              nextAction: 'Reload OpenOffer to connect the local workspace service.',
            },
            sessions: [],
            primarySessionId: null,
            activeSession: null,
            primaryArtifacts: null,
            review: null,
            nextAction: {
              text: stage.nextAction ?? null,
              dueAt: stage.nextActionDueAt ?? null,
              state: stage.nextActionState ?? 'missing',
              completedAt: stage.nextActionCompletedAt ?? null,
            },
            status: {
              primaryStep: 'context' as const,
              context: 'missing' as const,
              preparation: 'empty' as const,
              coreReadiness: 'unknown' as const,
              session: 'none' as const,
              artifacts: null,
              review: 'unavailable' as const,
              nextAction: stage.nextActionState ?? 'missing',
              complete: false,
            },
            capabilities: {
              canPrepare: false,
              canStart: false,
              canStop: false,
              canReview: false,
              canSetNextAction: false,
            },
          };
      setSnapshot(next);
      setContextConfirmed(false);
      setGoal(next.preparation?.oneLineGoal ?? '');
      setCheatsheet(next.preparation?.cheatsheet ?? '');
      setExpectedTopics(next.preparation?.expectedTopics?.join('\n') ?? '');
      setNextAction(next.nextAction.text ?? '');
      const mainSignal = typeof next.review?.review.mainSignal === 'string' ? next.review.review.mainSignal : '';
      setReview(mainSignal);
    } catch (cause: any) {
      setError(cause?.message || 'Stage workspace is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [stage.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onStageWorkspaceInvalidated?.((event) => {
      if (event.stageId !== stage.id) return;
      const sequenceGap = lastEventSeq.current > 0 && event.eventSeq > lastEventSeq.current + 1;
      lastEventSeq.current = event.eventSeq;
      // Invalidation payloads never carry content. A sequence gap is treated
      // exactly like a reconnect: discard local projection and fetch a full
      // snapshot from the main process.
      if (sequenceGap || event.workspaceRevision >= (snapshot?.revision ?? 0)) void load();
    });
    return unsubscribe;
  }, [load, snapshot?.revision, stage.id]);

  const start = async () => {
    if (!snapshot || stage.status === 'archived' || stage.archivedAt || isMeetingActive) return;
    setSaving('prepare');
    try {
      const ensured = await stageWorkspaceApi.ensureBacking(stage.id, snapshot.revision);
      const started = await stageWorkspaceApi.start(stage.id, ensured.revision, {
        confirmed: true,
        sourceText: ensured.context.sourceText,
        providerRoutes: {},
      });
      setSnapshot(started);
      const session = started.activeSession;
      if (!session) throw new Error('Stage session was not created.');
      onStartMeeting({
        title: stage.title || application.title,
        interviewEventId: started.stage.legacyInterviewEventId ?? undefined,
        interviewStageId: stage.id,
        applicationId: application.id,
        calendarEventId: stage.calendarEventId ?? undefined,
        source: 'manual',
        stageWorkspaceMeetingId: session.meetingId,
        stageWorkspaceSessionRevision: session.revision,
      });
    } catch (cause: any) {
      setError(cause?.message || 'Could not prepare this stage for recording.');
    } finally {
      setSaving(null);
    }
  };

  const runPreflight = async () => {
    if (!snapshot) return;
    setPreflighting(true);
    setError(null);
    try {
      setSnapshot(await stageWorkspaceApi.preflight(stage.id, false));
    } catch (cause: any) {
      setError(cause?.message || 'Provider preflight failed.');
    } finally {
      setPreflighting(false);
    }
  };

  const savePreparation = async () => {
    if (!snapshot) return;
    setSaving('prepare');
    try {
      const next = await stageWorkspaceApi.prepare(stage.id, {
        oneLineGoal: goal.trim() || null,
        expectedTopics: expectedTopics.split('\n').map(value => value.trim()).filter(Boolean),
        cheatsheet: cheatsheet.trim() || null,
        pitch30s: snapshot.preparation?.pitch30s ?? null,
        pitch2m: snapshot.preparation?.pitch2m ?? null,
        riskHandling: snapshot.preparation?.riskHandling ?? [],
        lastChecklist: snapshot.preparation?.lastChecklist ?? [],
      }, snapshot.revision);
      setSnapshot(next);
    } catch (cause: any) {
      setError(cause?.message || 'Could not save preparation.');
    } finally {
      setSaving(null);
    }
  };

  const saveReview = async () => {
    if (!snapshot?.primarySessionId) return;
    setSaving('review');
    try {
      const next = await stageWorkspaceApi.saveReview(stage.id, snapshot.primarySessionId, { mainSignal: review.trim() }, snapshot.revision);
      setSnapshot(next);
    } catch (cause: any) {
      setError(cause?.message || 'Could not save review.');
    } finally {
      setSaving(null);
    }
  };

  const saveNextAction = async () => {
    if (!snapshot) return;
    setSaving('next');
    try {
      const next = await stageWorkspaceApi.setNextAction(stage.id, {
        text: nextAction.trim() || null,
        state: nextAction.trim() ? 'saved' : 'none_required',
      }, snapshot.revision);
      setSnapshot(next);
    } catch (cause: any) {
      setError(cause?.message || 'Could not save the next action.');
    } finally {
      setSaving(null);
    }
  };

  const selectPrimary = async (meetingId: string | null) => {
    if (!snapshot) return;
    setSaving('review');
    try {
      setSnapshot(await stageWorkspaceApi.selectPrimary(stage.id, meetingId, snapshot.revision));
    } catch (cause: any) {
      setError(cause?.message || 'Could not change the review session.');
    } finally {
      setSaving(null);
    }
  };

  const clearReview = async () => {
    if (!snapshot?.review) return;
    setSaving('review');
    try {
      setSnapshot(await stageWorkspaceApi.clearReview(stage.id, snapshot.revision));
    } catch (cause: any) {
      setError(cause?.message || 'Could not clear the saved review.');
    } finally {
      setSaving(null);
    }
  };

  const deleteSession = async (meetingId: string) => {
    if (!snapshot || !window.confirm(copy.deleteSessionConfirm)) return;
    setSaving('review');
    try {
      setSnapshot(await stageWorkspaceApi.deleteSession(meetingId, snapshot.revision));
    } catch (cause: any) {
      setError(cause?.message || 'Could not delete stage session data.');
    } finally {
      setSaving(null);
    }
  };

  const completeNextAction = async () => {
    if (!snapshot) return;
    setSaving('next');
    try {
      setSnapshot(await stageWorkspaceApi.completeNextAction(stage.id, snapshot.revision));
    } catch (cause: any) {
      setError(cause?.message || 'Could not complete the next action.');
    } finally {
      setSaving(null);
    }
  };

  const markNoNextAction = async () => {
    if (!snapshot) return;
    setSaving('next');
    try {
      setSnapshot(await stageWorkspaceApi.noNextAction(stage.id, snapshot.revision));
    } catch (cause: any) {
      setError(cause?.message || 'Could not mark this stage as requiring no next action.');
    } finally {
      setSaving(null);
    }
  };

  const retryArtifact = async (artifactType: 'transcript' | 'summary' | 'ai_review') => {
    const meetingId = snapshot?.primarySessionId;
    if (!meetingId) return;
    setSaving('review');
    try {
      setSnapshot(await stageWorkspaceApi.retryArtifact(meetingId, artifactType));
    } catch (cause: any) {
      setError(cause?.message || 'Could not retry artifact processing.');
    } finally {
      setSaving(null);
    }
  };

  const exportWorkspace = async (format: 'json' | 'markdown') => {
    setExporting(format);
    setError(null);
    try {
      await stageWorkspaceApi.export(stage.id, format, includeTranscript);
    } catch (cause: any) {
      setError(cause?.message || 'Could not export this stage workspace.');
    } finally {
      setExporting(null);
    }
  };

  const status = useMemo(() => (snapshot ? statusLabel(snapshot, ru) : copy.loading), [snapshot, ru, copy.loading]);
  const readinessAction = snapshot?.readiness.nextAction
    ? (ru
      ? snapshot.readiness.blockers.includes('stt_not_configured') ? 'Выберите и настройте провайдер распознавания речи в настройках.'
        : snapshot.readiness.blockers.some(code => code.includes('probe')) ? 'Запустите проверку провайдера ещё раз перед записью.'
          : snapshot.readiness.blockers.some(code => code.includes('permission')) ? 'Выдайте разрешения на микрофон и системный звук.'
            : snapshot.readiness.nextAction
      : snapshot.readiness.nextAction)
    : copy.noProvider;

  return (
    <div data-testid="stage-workspace-panel" className="rounded-md border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(103,232,249,0.08),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-200/80">
            <ShieldCheck size={14} /> {copy.workspace}
          </div>
          <div className="mt-1 truncate text-[16px] font-semibold text-text-primary">{copy.stage}</div>
          <div className="mt-1 text-[12px] text-text-tertiary">{status} · {copy.revision} {snapshot?.revision ?? '—'}</div>
        </div>
        <button type="button" className={primaryButtonClass} onClick={start} disabled={busy || loading || !snapshot?.capabilities.canStart || !contextConfirmed || saving !== null || isMeetingActive}>
          {saving === 'prepare' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {isMeetingActive ? copy.openLive : copy.start}
        </button>
      </div>

      {error && <div role="alert" className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3 text-[12px] text-rose-100">{error}</div>}
      {loading && !snapshot && <div className="mt-4 text-[12px] text-text-tertiary">{copy.loading}…</div>}

      {snapshot && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3 flex flex-wrap items-center gap-1 rounded-md border border-white/[0.06] bg-black/10 p-2" aria-label="Stage lifecycle">
            {(['context', 'prepare', 'preflight', 'interview', 'review'] as const).map((step, index) => {
              const active = snapshot.status.primaryStep === step;
              const completed = ['context', 'prepare', 'preflight', 'interview', 'review'].indexOf(snapshot.status.primaryStep) > index;
              return (
                <React.Fragment key={step}>
                  {index > 0 && <span className="px-1 text-[10px] text-text-tertiary" aria-hidden="true">→</span>}
                  <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${active ? 'bg-cyan-300/15 text-cyan-100' : completed ? 'text-emerald-200' : 'text-text-tertiary'}`}>
                    {completed ? '✓ ' : ''}{step}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><FileText size={13} /> {copy.context}</div>
            <div className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-[12px] leading-5 text-text-secondary">{snapshot.context.sourceText || copy.noContext}</div>
            {snapshot.context.confirmed ? (
              <label className="mt-3 flex items-start gap-2 text-[11px] text-text-secondary">
                <input type="checkbox" checked={contextConfirmed} onChange={event => setContextConfirmed(event.target.checked)} />
                <span>{copy.confirm}</span>
              </label>
            ) : (
              <div className="mt-3 text-[11px] text-amber-100">{copy.contextMissing}</div>
            )}
          </div>
          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500"><CircleDot size={13} /> {copy.readiness}</div>
            <div className="mt-2 text-[13px] font-semibold text-text-primary">{snapshot.readiness.level === 'ready' ? copy.readyContinue : readinessAction}</div>
            <div className="mt-1 text-[11px] text-text-tertiary">{snapshot.status.primaryStep} · {snapshot.status.session}</div>
            <button type="button" className={`${secondaryButtonClass} mt-3 w-full`} onClick={() => void runPreflight()} disabled={preflighting || loading || snapshot.status.session === 'recording' || snapshot.status.session === 'stopping'}>
              {preflighting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              {preflighting ? copy.checking : copy.runPreflight}
            </button>
            {snapshot.readiness.checks && snapshot.readiness.checks.length > 0 && (
              <div className="mt-3 space-y-1 text-[10px]">
                {snapshot.readiness.checks.map(check => <div key={check.id} className="flex items-center justify-between gap-2 text-text-tertiary"><span>{check.id}{check.provider ? ` · ${check.provider}` : ''}</span><span className={check.status === 'ready' ? 'text-emerald-200' : check.status === 'failed' || check.status === 'denied' ? 'text-rose-200' : 'text-amber-200'}>{check.status}</span></div>)}
                {snapshot.readiness.checks.filter(check => check.endpoint).map(check => <div key={`${check.id}-endpoint`} className="truncate text-[9px] text-text-tertiary" title={check.endpoint}>{check.id} → {check.endpoint}</div>)}
              </div>
            )}
          </div>

          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{copy.dataFlow}</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-text-secondary sm:grid-cols-3">
              <div><span className="text-text-tertiary">{copy.context}:</span> {copy.local}</div>
              <div><span className="text-text-tertiary">Transcript:</span> {copy.transcriptLocal}</div>
              <div><span className="text-text-tertiary">AI/STT:</span> {copy.ai}</div>
            </div>
          </div>

          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-text-primary">{copy.preparation}</div>
              <button type="button" className={secondaryButtonClass} onClick={savePreparation} disabled={saving !== null || !snapshot.capabilities.canPrepare}>
                <Save size={13} /> {copy.saveGoal}
              </button>
            </div>
            <input className={inputClass} value={goal} onChange={event => setGoal(event.target.value)} placeholder={copy.goalPlaceholder} />
            <textarea className={`${inputClass} mt-2 min-h-16 resize-y`} value={expectedTopics} onChange={event => setExpectedTopics(event.target.value)} placeholder={ru ? 'Ожидаемые темы — по одной на строку' : 'Expected topics — one per line'} />
            <textarea className={`${inputClass} mt-2 min-h-20 resize-y`} value={cheatsheet} onChange={event => setCheatsheet(event.target.value)} placeholder={ru ? 'Краткая шпаргалка и подтверждённые истории' : 'Short cheatsheet and confirmed stories'} />
          </div>

          {snapshot.primarySessionId && (
            <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-text-primary">{copy.review}</div>
                <button type="button" className={secondaryButtonClass} onClick={saveReview} disabled={saving !== null}>
                  <Check size={13} /> {copy.saveReview}
                </button>
              </div>
              <textarea className={`${inputClass} min-h-20 resize-y`} value={review} onChange={event => setReview(event.target.value)} placeholder={copy.reviewPlaceholder} />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                <span>{copy.source}: {snapshot.primarySessionId}</span>
                {snapshot.review && <button type="button" className="text-amber-200 hover:text-amber-100" onClick={() => void clearReview()} disabled={saving !== null}>{copy.clearReview}</button>}
              </div>
              {onOpenMeeting && <button type="button" className="mt-2 text-[11px] text-cyan-200 hover:text-cyan-100" onClick={() => onOpenMeeting(snapshot.primarySessionId!)}>{copy.openRecording}</button>}
            </div>
          )}

          {snapshot.sessions.length > 0 && (
            <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
              <div className="text-[12px] font-semibold text-text-primary">{copy.sessions}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {snapshot.sessions.map(session => (
                  <div key={session.meetingId} className="flex items-center justify-between gap-2 rounded border border-white/[0.06] px-2 py-2 text-[11px]">
                    <span className="min-w-0 truncate text-text-secondary">{session.meetingId} · {session.status}</span>
                    {session.status === 'stopped' || session.status === 'abandoned' || session.status === 'failed' ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {snapshot.primarySessionId === session.meetingId && !snapshot.review ? (
                          <button type="button" className="text-cyan-200 hover:text-cyan-100" onClick={() => void selectPrimary(null)} disabled={saving !== null}>{copy.clearSource}</button>
                        ) : session.status !== 'failed' ? (
                          <button type="button" className="text-cyan-200 hover:text-cyan-100" onClick={() => void selectPrimary(session.meetingId)} disabled={saving !== null || snapshot.primarySessionId === session.meetingId}>{copy.useForReview}</button>
                        ) : null}
                        {snapshot.primarySessionId !== session.meetingId ? (
                          <button type="button" className="text-rose-200 hover:text-rose-100" onClick={() => void deleteSession(session.meetingId)} disabled={saving !== null}>{copy.deleteSession}</button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {snapshot.primaryArtifacts && (
            <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
              <div className="text-[12px] font-semibold text-text-primary">{copy.processing}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-text-secondary sm:grid-cols-3">
                {([
                  [copy.transcript, snapshot.primaryArtifacts.transcript, 'transcript'],
                  [ru ? 'Сводка' : 'Summary', snapshot.primaryArtifacts.summary, 'summary'],
                  [copy.review, snapshot.primaryArtifacts.aiReview, 'ai_review'],
                ] as const).map(([label, value, artifactType]) => (
                  <div key={label} className="flex items-center justify-between gap-2 rounded border border-white/[0.06] px-2 py-1.5">
                    <span>{label}</span><span className="text-text-tertiary">{value}</span>
                    {snapshot.primarySessionId && ((artifactType === 'ai_review' && (value === 'skipped' || value === 'failed' || value === 'cancelled')) || (artifactType !== 'ai_review' && (value === 'failed' || value === 'cancelled'))) && (
                      <button type="button" className="text-cyan-200 hover:text-cyan-100" onClick={() => void retryArtifact(artifactType)} disabled={saving !== null}>{artifactType === 'ai_review' ? (ru ? 'Сделать AI-черновик' : 'Generate AI draft') : (ru ? 'Повторить' : 'Retry')}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-text-primary">{copy.nextAction}</div>
              <button type="button" className={secondaryButtonClass} onClick={saveNextAction} disabled={saving !== null}>
                <Save size={13} /> {copy.save}
              </button>
            </div>
            <input className={inputClass} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder={copy.nextPlaceholder} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => void completeNextAction()} disabled={saving !== null || snapshot.nextAction.state !== 'saved'}>{copy.complete}</button>
              <button type="button" className={secondaryButtonClass} onClick={() => void markNoNextAction()} disabled={saving !== null}>{copy.none}</button>
            </div>
          </div>

          <div className="rounded-md bg-bg-card p-3 ring-1 ring-white/[0.04] lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-text-primary">{copy.export}</div>
                <div className="mt-1 text-[11px] text-text-tertiary">{copy.exportHint}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[11px] text-text-secondary">
                  <input type="checkbox" checked={includeTranscript} onChange={event => setIncludeTranscript(event.target.checked)} />
                  {copy.transcript}
                </label>
                <button type="button" className={secondaryButtonClass} onClick={() => void exportWorkspace('json')} disabled={exporting !== null || !Object.prototype.hasOwnProperty.call(window.electronAPI ?? {}, 'stageWorkspaceExport')}>
                  {exporting === 'json' ? <Loader2 size={13} className="animate-spin" /> : null} {copy.json}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => void exportWorkspace('markdown')} disabled={exporting !== null || !Object.prototype.hasOwnProperty.call(window.electronAPI ?? {}, 'stageWorkspaceExport')}>
                  {exporting === 'markdown' ? <Loader2 size={13} className="animate-spin" /> : null} {copy.markdown}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StageWorkspacePanel;
