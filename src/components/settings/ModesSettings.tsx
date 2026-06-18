import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  FileText,
  LayoutGrid,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ModeTemplateType =
  | 'general'
  | 'looking-for-work'
  | 'sales'
  | 'recruiting'
  | 'team-meet'
  | 'lecture'
  | 'technical-interview';

type Mode = {
  id: string;
  name: string;
  templateType: ModeTemplateType;
  customContext: string;
  isActive: boolean;
  createdAt: string;
  referenceFileCount?: number;
};

type ReferenceFile = {
  id: string;
  modeId: string;
  fileName: string;
  content: string;
  createdAt: string;
};

type NoteSection = {
  id: string;
  modeId: string;
  title: string;
  description: string;
  sortOrder: number;
};

type ModesSettingsProps = {
  onClose?: () => void;
  isPremium?: boolean;
  isLoaded?: boolean;
  isTrialActive?: boolean;
};

const templates: Array<{ type: ModeTemplateType; label: string; description: string }> = [
  { type: 'general', label: 'General', description: 'A flexible assistant for any conversation.' },
  { type: 'looking-for-work', label: 'Looking for work', description: 'Interview answers, role context, and follow-up prep.' },
  { type: 'technical-interview', label: 'Technical Interview', description: 'Coding, architecture, system design, and debugging rounds.' },
  { type: 'sales', label: 'Sales', description: 'Discovery, objections, next steps, and deal notes.' },
  { type: 'recruiting', label: 'Recruiting', description: 'Structured candidate evaluation and interview notes.' },
  { type: 'team-meet', label: 'Team Meet', description: 'Decisions, blockers, and action items.' },
  { type: 'lecture', label: 'Lecture', description: 'Concept capture and study notes.' },
];

function templateLabel(type: string): string {
  return templates.find(t => t.type === type)?.label ?? type;
}

function templateI18nKey(type: string): string {
  if (type === 'looking-for-work') return 'lookingForWork';
  if (type === 'technical-interview') return 'technicalInterview';
  if (type === 'team-meet') return 'teamMeet';
  return type;
}

const ModesSettings: React.FC<ModesSettingsProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const api = window.electronAPI;
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [templateDraft, setTemplateDraft] = useState<ModeTemplateType>('general');
  const [contextDraft, setContextDraft] = useState('');
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(
    () => modes.find(mode => mode.id === selectedId) ?? null,
    [modes, selectedId],
  );

  const loadModes = useCallback(async () => {
    if (!api?.modesGetAll) {
      setError(t('modesManager.apiUnavailable'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [allModes, activeMode] = await Promise.all([
        api.modesGetAll(),
        api.modesGetActive?.() ?? Promise.resolve(null),
      ]);
      const normalized = (allModes ?? []) as Mode[];
      setModes(normalized);
      setSelectedId(current => {
        if (current && normalized.some(mode => mode.id === current)) return current;
        return activeMode?.id ?? normalized[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  const loadModeDetails = useCallback(async (mode: Mode | null) => {
    if (!mode) {
      setNameDraft('');
      setTemplateDraft('general');
      setContextDraft('');
      setFiles([]);
      setSections([]);
      return;
    }

    setNameDraft(mode.name);
    setTemplateDraft(mode.templateType);
    setContextDraft(mode.customContext ?? '');
    try {
      const [modeFiles, noteSections] = await Promise.all([
        api?.modesGetReferenceFiles?.(mode.id) ?? Promise.resolve([]),
        api?.modesGetNoteSections?.(mode.id) ?? Promise.resolve([]),
      ]);
      setFiles((modeFiles ?? []) as ReferenceFile[]);
      setSections(((noteSections ?? []) as NoteSection[]).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mode details.');
    }
  }, [api]);

  useEffect(() => {
    void loadModes();
  }, [loadModes]);

  useEffect(() => {
    void loadModeDetails(selectedMode);
  }, [loadModeDetails, selectedMode]);

  const createMode = async (templateType: ModeTemplateType) => {
    const create = api?.modesCreate;
    if (!create) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await create({ name: t(`modesManager.templatesData.${templateI18nKey(templateType)}.label`), templateType });
      if (!result.success) throw new Error(result.error ?? t('modesManager.createFailed'));
      await loadModes();
      if (result.mode?.id) setSelectedId(result.mode.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    if (!selectedMode) return;
    const update = api?.modesUpdate;
    if (!update) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await update(selectedMode.id, {
        name: nameDraft.trim() || selectedMode.name,
        templateType: templateDraft,
        customContext: contextDraft,
      });
      if (!result.success) throw new Error(result.error ?? t('modesManager.saveFailed'));
      await loadModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (mode: Mode) => {
    const setActiveMode = api?.modesSetActive;
    if (!setActiveMode) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await setActiveMode(mode.id);
      if (!result.success) throw new Error(result.error ?? t('modesManager.activateFailed'));
      setModes(current => current.map(item => ({ ...item, isActive: item.id === mode.id })));
      setSelectedId(mode.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.activateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedMode || selectedMode.templateType === 'general') return;
    if (!window.confirm(`Delete "${selectedMode.name}"?`)) return;

    const remove = api?.modesDelete;
    if (!remove) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await remove(selectedMode.id);
      if (!result.success) throw new Error(result.error ?? t('modesManager.deleteFailed'));
      setSelectedId(null);
      await loadModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const uploadReference = async () => {
    if (!selectedMode) return;
    const upload = api?.modesUploadReferenceFile;
    if (!upload) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await upload(selectedMode.id);
      if (result.cancelled) return;
      if (!result.success) throw new Error(result.error ?? t('modesManager.addReferenceFailed'));
      await Promise.all([loadModes(), loadModeDetails(selectedMode)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.addReferenceFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteReference = async (file: ReferenceFile) => {
    const remove = api?.modesDeleteReferenceFile;
    if (!remove) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await remove(file.id);
      if (!result.success) throw new Error(result.error ?? t('modesManager.removeReferenceFailed'));
      if (selectedMode) await Promise.all([loadModes(), loadModeDetails(selectedMode)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.removeReferenceFailed'));
    } finally {
      setSaving(false);
    }
  };

  const addNoteSection = async () => {
    if (!selectedMode) return;
    const addSection = api?.modesAddNoteSection;
    if (!addSection) {
      setError('Modes API is unavailable in this window.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await addSection(selectedMode.id, 'New section', 'Describe what OpenOffer should capture here.');
      if (!result.success) throw new Error(result.error ?? t('modesManager.addSectionFailed'));
      await loadModeDetails(selectedMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modesManager.addSectionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full bg-bg-elevated text-text-primary flex flex-col">
      <header className="h-14 px-5 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-accent-primary/15 text-accent-primary flex items-center justify-center">
            <LayoutGrid size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{t('modesManager.title')}</h2>
            <p className="text-[11px] text-text-secondary leading-tight">{t('modesManager.description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadModes()}
            className="h-8 w-8 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-item-hover flex items-center justify-center"
            title={t('modesManager.refreshModes')}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-item-hover flex items-center justify-center"
              title={t('common.close')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 grid grid-cols-[260px_1fr]">
        <aside className="border-r border-border-subtle p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase text-text-tertiary font-semibold">{t('modesManager.modes')}</span>
            <button
              type="button"
              onClick={() => void createMode('looking-for-work')}
              disabled={saving}
              className="h-7 w-7 rounded-lg bg-accent-primary text-white flex items-center justify-center disabled:opacity-50"
              title={t('modesManager.createMode')}
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="space-y-1.5">
            {loading && <div className="text-xs text-text-secondary px-2 py-3">{t('modesManager.loading')}</div>}
            {!loading && modes.length === 0 && (
              <div className="text-xs text-text-secondary px-2 py-3">{t('modesManager.none')}</div>
            )}
            {modes.map(mode => (
              <button
                type="button"
                key={mode.id}
                onClick={() => setSelectedId(mode.id)}
                className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${
                  mode.id === selectedId
                    ? 'border-accent-primary/50 bg-accent-primary/10'
                    : 'border-transparent hover:bg-bg-item-hover'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">{mode.name}</span>
                  {mode.isActive && <CheckCircle size={13} className="text-accent-primary shrink-0" />}
                </div>
                <div className="mt-0.5 text-[11px] text-text-secondary truncate">
                  {t(`modesManager.templatesData.${templateI18nKey(mode.templateType)}.label`)} · {t('modesManager.refs', { count: mode.referenceFileCount ?? 0 })}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase text-text-tertiary font-semibold mb-2">{t('modesManager.templates')}</div>
            <div className="space-y-1.5">
              {templates.filter(t => t.type !== 'general').map(template => (
                <button
                  type="button"
                  key={template.type}
                  onClick={() => void createMode(template.type)}
                  disabled={saving}
                  className="w-full text-left rounded-lg border border-border-subtle px-3 py-2 hover:bg-bg-item-hover disabled:opacity-50"
                >
                  <div className="text-xs font-medium">{t(`modesManager.templatesData.${templateI18nKey(template.type)}.label`)}</div>
                  <div className="text-[11px] text-text-secondary line-clamp-2">{t(`modesManager.templatesData.${templateI18nKey(template.type)}.description`)}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto p-5">
          {!selectedMode ? (
            <div className="h-full flex items-center justify-center text-sm text-text-secondary">
              {t('modesManager.selectOrCreate')}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              <section className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-semibold text-text-tertiary uppercase">{t('modesManager.name')}</span>
                      <input
                        value={nameDraft}
                        onChange={event => setNameDraft(event.target.value)}
                        className="h-9 rounded-lg bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-accent-primary"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-semibold text-text-tertiary uppercase">{t('modesManager.template')}</span>
                      <select
                        value={templateDraft}
                        onChange={event => setTemplateDraft(event.target.value as ModeTemplateType)}
                        className="h-9 rounded-lg bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-accent-primary"
                      >
                        {templates.map(template => (
                          <option key={template.type} value={template.type}>{t(`modesManager.templatesData.${templateI18nKey(template.type)}.label`)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void setActive(selectedMode)}
                      disabled={saving || selectedMode.isActive}
                      className="h-9 px-3 rounded-lg border border-border-subtle text-xs font-medium hover:bg-bg-item-hover disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle size={14} /> {selectedMode.isActive ? t('modesManager.active') : t('modesManager.setActive')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveSelected()}
                      disabled={saving}
                      className="h-9 px-3 rounded-lg bg-accent-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save size={14} /> {t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSelected()}
                      disabled={saving || selectedMode.templateType === 'general'}
                      className="h-9 w-9 rounded-lg border border-border-subtle text-text-secondary hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 flex items-center justify-center"
                      title={t('modesManager.deleteMode')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold">{t('modesManager.realtimeInstructions')}</h3>
                  <p className="text-xs text-text-secondary">{t('modesManager.realtimeDescription')}</p>
                </div>
                <textarea
                  value={contextDraft}
                  onChange={event => setContextDraft(event.target.value)}
                  rows={7}
                  className="w-full resize-none rounded-lg bg-bg-elevated border border-border-subtle p-3 text-sm leading-5 outline-none focus:border-accent-primary"
                  placeholder={t('modesManager.realtimePlaceholder')}
                />
              </section>

              <section className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('modesManager.referenceFiles')}</h3>
                    <p className="text-xs text-text-secondary">{t('modesManager.referenceDescription')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void uploadReference()}
                    disabled={saving}
                    className="h-8 px-3 rounded-lg border border-border-subtle text-xs font-medium hover:bg-bg-item-hover disabled:opacity-50 flex items-center gap-2"
                  >
                    <Upload size={14} /> {t('modesManager.addFile')}
                  </button>
                </div>
                <div className="space-y-2">
                  {files.length === 0 && <div className="text-xs text-text-secondary">{t('modesManager.noReferenceFiles')}</div>}
                  {files.map(file => (
                    <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} className="text-text-secondary shrink-0" />
                        <span className="text-sm truncate">{file.fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteReference(file)}
                        disabled={saving}
                        className="h-7 w-7 rounded-md text-text-secondary hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center"
                        title={t('modesManager.removeFile')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('modesManager.noteTemplate')}</h3>
                    <p className="text-xs text-text-secondary">{t('modesManager.noteTemplateDescription')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addNoteSection()}
                    disabled={saving}
                    className="h-8 px-3 rounded-lg border border-border-subtle text-xs font-medium hover:bg-bg-item-hover disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus size={14} /> {t('modesManager.section')}
                  </button>
                </div>
                <div className="grid gap-2">
                  {sections.length === 0 && <div className="text-xs text-text-secondary">{t('modesManager.noSections')}</div>}
                  {sections.map(section => (
                    <div key={section.id} className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
                      <div className="text-sm font-medium">{section.title}</div>
                      <div className="mt-0.5 text-xs text-text-secondary">{section.description}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ModesSettings;
