import { Brain, Check, Loader2, Wifi, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Label + one-line description + group for each Intelligence OS flag. Keyed by flag key;
// an unknown key falls back to the raw key so a newly-added flag still renders.
const FLAG_META: Record<string, { labelKey: string; descKey: string; groupKey: string }> = {
  // Memory
  hindsightMemory: { labelKey: 'intelligenceSettings.flags.hindsightMemory.label', descKey: 'intelligenceSettings.flags.hindsightMemory.desc', groupKey: 'memory' },
  hindsightPostMeetingRetain: { labelKey: 'intelligenceSettings.flags.hindsightPostMeetingRetain.label', descKey: 'intelligenceSettings.flags.hindsightPostMeetingRetain.desc', groupKey: 'memory' },
  hindsightLiveRecall: { labelKey: 'intelligenceSettings.flags.hindsightLiveRecall.label', descKey: 'intelligenceSettings.flags.hindsightLiveRecall.desc', groupKey: 'memory' },
  durableMemoryWindow: { labelKey: 'intelligenceSettings.flags.durableMemoryWindow.label', descKey: 'intelligenceSettings.flags.durableMemoryWindow.desc', groupKey: 'memory' },
  conversationMemoryV2: { labelKey: 'intelligenceSettings.flags.conversationMemoryV2.label', descKey: 'intelligenceSettings.flags.conversationMemoryV2.desc', groupKey: 'memory' },
  // Search
  globalSearchV2: { labelKey: 'intelligenceSettings.flags.globalSearchV2.label', descKey: 'intelligenceSettings.flags.globalSearchV2.desc', groupKey: 'search' },
  inMeetingSearchV2: { labelKey: 'intelligenceSettings.flags.inMeetingSearchV2.label', descKey: 'intelligenceSettings.flags.inMeetingSearchV2.desc', groupKey: 'search' },
  meetingMemoryV2: { labelKey: 'intelligenceSettings.flags.meetingMemoryV2.label', descKey: 'intelligenceSettings.flags.meetingMemoryV2.desc', groupKey: 'search' },
  // Answer quality
  profileTreeV2: { labelKey: 'intelligenceSettings.flags.profileTreeV2.label', descKey: 'intelligenceSettings.flags.profileTreeV2.desc', groupKey: 'answerQuality' },
  answerDiversityGuard: { labelKey: 'intelligenceSettings.flags.answerDiversityGuard.label', descKey: 'intelligenceSettings.flags.answerDiversityGuard.desc', groupKey: 'answerQuality' },
  // Lecture & diagrams
  lectureIntelligenceV2: { labelKey: 'intelligenceSettings.flags.lectureIntelligenceV2.label', descKey: 'intelligenceSettings.flags.lectureIntelligenceV2.desc', groupKey: 'lectureDiagrams' },
  diagramIntelligence: { labelKey: 'intelligenceSettings.flags.diagramIntelligence.label', descKey: 'intelligenceSettings.flags.diagramIntelligence.desc', groupKey: 'lectureDiagrams' },
  // Advanced / shadow (observe-only — included for transparency)
  trace: { labelKey: 'intelligenceSettings.flags.trace.label', descKey: 'intelligenceSettings.flags.trace.desc', groupKey: 'advanced' },
  contextRouterV2: { labelKey: 'intelligenceSettings.flags.contextRouterV2.label', descKey: 'intelligenceSettings.flags.contextRouterV2.desc', groupKey: 'advanced' },
  liveTranscriptBrain: { labelKey: 'intelligenceSettings.flags.liveTranscriptBrain.label', descKey: 'intelligenceSettings.flags.liveTranscriptBrain.desc', groupKey: 'advanced' },
  promptAssemblerV2: { labelKey: 'intelligenceSettings.flags.promptAssemblerV2.label', descKey: 'intelligenceSettings.flags.promptAssemblerV2.desc', groupKey: 'advanced' },
  intelligenceOsEnabled: { labelKey: 'intelligenceSettings.flags.intelligenceOsEnabled.label', descKey: 'intelligenceSettings.flags.intelligenceOsEnabled.desc', groupKey: 'advanced' },
};

const GROUP_ORDER = ['memory', 'search', 'answerQuality', 'lectureDiagrams', 'advanced'];

interface FlagRow { key: string; enabled: boolean; setting: string; env: string; default: boolean }
interface HindsightCfg { baseUrl: string; hasApiKey: boolean; autoStart: boolean; serverCommand: string; llmProvider: string; available: boolean }

const Toggle: React.FC<{ on: boolean; disabled?: boolean; onClick: () => void }> = ({ on, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-pressed={on}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-accent-primary' : 'bg-bg-item-active'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

export const IntelligenceSettings: React.FC = () => {
  const { t } = useTranslation();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [cfg, setCfg] = useState<HindsightCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [savedAt, setSavedAt] = useState(false);
  // Запуски предпросмотра функций (lecture notes / diagram / in-meeting search). These call the
  // real IPCs against the CURRENT meeting transcript, so they need an active meeting + the
  // matching flag; the handlers return { enabled:false } when the flag is off.
  const [tryBusy, setTryBusy] = useState<null | 'lecture' | 'diagram' | 'search'>(null);
  const [tryOut, setTryOut] = useState<{ kind: string; text: string } | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const flagOn = useCallback((key: string) => flags.find((f) => f.key === key)?.enabled ?? false, [flags]);

  const runTry = useCallback(async (kind: 'lecture' | 'diagram' | 'search', fn: () => Promise<any>) => {
    setTryBusy(kind); setTryOut(null);
    try {
      const res = await fn();
      if (res && res.enabled === false) {
        setTryOut({ kind, text: t('intelligenceSettings.featureOff') });
        return;
      }
      const payload = res?.notes ?? res?.diagram ?? res?.results ?? res;
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      setTryOut({ kind, text: text && text !== 'null' ? text : t('intelligenceSettings.noResult') });
    } catch (e: any) {
      setTryOut({ kind, text: `${t('intelligenceSettings.errorPrefix')}: ${e?.message || 'error'}` });
    } finally { setTryBusy(null); }
  }, [t]);

  const refresh = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([
        window.electronAPI.getIntelligenceFlags?.(),
        window.electronAPI.getHindsightConfig?.(),
      ]);
      if (Array.isArray(f)) setFlags(f);
      if (c) {
        setCfg(c);
        setBaseUrl(c.baseUrl || '');
        setAutoStart(c.autoStart !== false);
        setHealthy(c.available);
      }
    } catch { /* settings panel never throws */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onToggleFlag = useCallback(async (row: FlagRow) => {
    // Optimistic flip; reconcile from the round-trip.
    setFlags((prev) => prev.map((r) => (r.key === row.key ? { ...r, enabled: !r.enabled } : r)));
    try {
      const res = await window.electronAPI.setIntelligenceFlag?.(row.key, !row.enabled);
      if (res && typeof res.enabled === 'boolean') {
        setFlags((prev) => prev.map((r) => (r.key === row.key ? { ...r, enabled: res.enabled! } : r)));
      }
    } catch { await refresh(); }
  }, [refresh]);

  const onSaveHindsight = useCallback(async () => {
    setSaving(true); setSavedAt(false);
    try {
      const res = await window.electronAPI.setHindsightConfig?.({ baseUrl, apiKey, autoStart });
      setApiKey(''); // never keep the raw key in component state after save
      if (res && typeof res.healthy === 'boolean') setHealthy(res.healthy);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2000);
      await refresh();
    } catch { /* noop */ } finally { setSaving(false); }
  }, [baseUrl, apiKey, autoStart, refresh]);

  const onTest = useCallback(async () => {
    setTesting(true);
    try {
      const res = await window.electronAPI.testHindsightConnection?.();
      setHealthy(Boolean(res?.healthy));
    } catch { setHealthy(false); } finally { setTesting(false); }
  }, []);

  const grouped = useMemo(() => {
    const byGroup: Record<string, FlagRow[]> = {};
    for (const row of flags) {
      const g = FLAG_META[row.key]?.groupKey || 'advanced';
      (byGroup[g] ||= []).push(row);
    }
    return byGroup;
  }, [flags]);

  // A flag is forced by env when a NATIVELY_* env var is set — we can't tell the raw env
  // value from the renderer, but the get payload's `setting` is the SettingsManager key;
  // when present we allow toggling. (Env-forced detection is best-effort: if a future
  // payload exposes an `envForced` field, honor it; for now toggles are always enabled.)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-accent-primary" />
        <h2 className="text-base font-semibold text-text-primary">{t('intelligenceSettings.title')}</h2>
      </div>

      {/* ── Long-term memory (Hindsight) ─────────────────────────── */}
      <section className="rounded-xl border border-border-subtle bg-bg-item-active/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">{t('intelligenceSettings.memoryServerTitle')}</div>
            <div className="text-xs text-text-secondary">{t('intelligenceSettings.memoryServerDescription')}</div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${healthy ? 'bg-green-500/15 text-green-400' : 'bg-bg-item-active text-text-secondary'}`}>
            {healthy ? <Wifi size={12} /> : <WifiOff size={12} />}{healthy ? t('intelligenceSettings.connected') : t('intelligenceSettings.notRunning')}
          </span>
        </div>

        <label className="block">
          <span className="text-xs text-text-secondary">{t('intelligenceSettings.serverUrl')}</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('intelligenceSettings.serverUrlPlaceholder')}
            className="mt-1 w-full rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-border-subtle focus:ring-accent-primary"
          />
        </label>

        <label className="block">
          <span className="text-xs text-text-secondary">{t('intelligenceSettings.apiKey', { state: cfg?.hasApiKey ? t('intelligenceSettings.apiKeySavedState') : t('intelligenceSettings.apiKeyCloudState') })}</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cfg?.hasApiKey ? `•••••••• ${t('intelligenceSettings.apiKeySavedPlaceholder')}` : t('intelligenceSettings.apiKeyCloudPlaceholder')}
            className="mt-1 w-full rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-border-subtle focus:ring-accent-primary"
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-text-primary">{t('intelligenceSettings.autoStartLocal')}</span>
          <Toggle on={autoStart} onClick={() => setAutoStart((v) => !v)} />
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSaveHindsight}
            disabled={saving}
            className="rounded-lg bg-accent-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : savedAt ? <Check size={14} /> : null}
            {savedAt ? t('intelligenceSettings.saved') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={testing || !baseUrl.trim()}
            className="rounded-lg bg-bg-item-active px-3 py-1.5 text-sm text-text-primary hover:bg-bg-item-active/70 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('intelligenceSettings.testConnection')}
          </button>
        </div>
        <p className="text-[11px] text-text-secondary">
          {t('intelligenceSettings.privacyNote')}
        </p>
      </section>

      {/* ── Функции интеллекта ────────────────────────────────── */}
      <section className="space-y-4">
        <div className="text-sm font-medium text-text-primary">{t('intelligenceSettings.featuresTitle')}</div>
        {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
          <div key={group} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t(`intelligenceSettings.groups.${group}`)}</div>
            {grouped[group].map((row) => {
              const meta = FLAG_META[row.key];
              return (
                <div key={row.key} className="flex items-start justify-between gap-4 rounded-lg px-3 py-2 hover:bg-bg-item-active/40">
                  <div className="min-w-0">
                    <div className="text-sm text-text-primary">{meta ? t(meta.labelKey) : row.key}</div>
                    {meta ? <div className="text-xs text-text-secondary">{t(meta.descKey)}</div> : null}
                  </div>
                  <Toggle on={row.enabled} onClick={() => onToggleFlag(row)} />
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* ── Предпросмотр на текущей встрече ────────────── */}
      <section className="rounded-xl border border-border-subtle bg-bg-item-active/30 p-4 space-y-3">
        <div>
          <div className="text-sm font-medium text-text-primary">{t('intelligenceSettings.tryTitle')}</div>
          <div className="text-xs text-text-secondary">{t('intelligenceSettings.tryDescription')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={tryBusy !== null || !flagOn('lectureIntelligenceV2')}
            onClick={() => runTry('lecture', () => window.electronAPI.generateLectureNotes?.())}
            className="rounded-lg bg-bg-item-active px-3 py-1.5 text-sm text-text-primary hover:bg-bg-item-active/70 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {tryBusy === 'lecture' ? <Loader2 size={14} className="animate-spin" /> : null} {t('intelligenceSettings.lectureNotes')}
          </button>
          <button
            type="button"
            disabled={tryBusy !== null || !flagOn('diagramIntelligence')}
            onClick={() => runTry('diagram', () => window.electronAPI.generateDiagram?.())}
            className="rounded-lg bg-bg-item-active px-3 py-1.5 text-sm text-text-primary hover:bg-bg-item-active/70 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {tryBusy === 'diagram' ? <Loader2 size={14} className="animate-spin" /> : null} {t('intelligenceSettings.diagram')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t('intelligenceSettings.searchPlaceholder')}
            disabled={!flagOn('inMeetingSearchV2')}
            className="flex-1 rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-border-subtle focus:ring-accent-primary disabled:opacity-40"
          />
          <button
            type="button"
            disabled={tryBusy !== null || !flagOn('inMeetingSearchV2') || !searchQ.trim()}
            onClick={() => runTry('search', () => window.electronAPI.searchInMeeting?.(searchQ.trim()))}
            className="rounded-lg bg-bg-item-active px-3 py-1.5 text-sm text-text-primary hover:bg-bg-item-active/70 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {tryBusy === 'search' ? <Loader2 size={14} className="animate-spin" /> : null} {t('intelligenceSettings.search')}
          </button>
        </div>
        {tryOut ? (
          <pre className="max-h-48 overflow-auto rounded-lg bg-bg-input p-3 text-[11px] text-text-secondary whitespace-pre-wrap">{tryOut.text}</pre>
        ) : null}
      </section>
    </div>
  );
};

export default IntelligenceSettings;
