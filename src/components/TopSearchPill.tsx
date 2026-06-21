import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, FileText, BriefcaseBusiness, CircleDot } from 'lucide-react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { useTranslation } from 'react-i18next';
import type { ApplicationIntakeResult } from '../types/interviews';
import {
    detectTopSearchPasteIntent,
    makeSafeExcerpt,
    resolveTopSearchProposalTarget,
    type TopSearchActionKind,
    type TopSearchProposalTargetReason,
    type TopSearchResultRow,
    type VacancyTopSearchContext,
} from '../features/interviews/topSearchHelpers';

type PillState = 'idle' | 'focused' | 'results';

interface Meeting {
    id: string;
    title: string;
    date: string;
    summary?: string;
}

interface MeetingResult {
    id: string;
    title: string;
    subtitle?: string;
    meetingId: string;
}

interface TopSearchPillProps {
    meetings: Meeting[];
    vacancyContext?: VacancyTopSearchContext | null;
    onAIQuery: (query: string) => void;
    onLiteralSearch: (query: string) => void;
    onOpenMeeting: (meetingId: string) => void;
    onExpansionChange?: (isExpanded: boolean) => void;
}

type SearchGroup = 'actions' | 'sessions' | 'vacancies' | 'stages';

type SearchEntry =
    | { id: string; kind: 'action'; group: SearchGroup; title: string; subtitle: string; action: TopSearchActionKind }
    | { id: string; kind: 'meeting'; group: SearchGroup; title: string; subtitle?: string; meetingId: string }
    | { id: string; kind: 'vacancy' | 'stage'; group: SearchGroup; title: string; subtitle?: string; row: TopSearchResultRow };

const AGENT_INPUT_MAX_CHARS = 50000;
const PROPOSAL_INPUT_CLASS = 'min-h-9 w-full rounded-md border border-white/[0.08] bg-black/20 px-2 text-[12px] outline-none focus:border-cyan-300/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60';

type TopSearchTranslationFunction = (key: string, options?: Record<string, any>) => string;

function fuzzyMatch(text: string, query: string): boolean {
    return text.toLowerCase().includes(query.toLowerCase());
}

function searchMeetings(meetings: Meeting[], query: string, locale: string): MeetingResult[] {
    if (!query.trim()) return [];
    const results: MeetingResult[] = [];
    const seen = new Set<string>();

    for (const meeting of meetings) {
        if (seen.has(meeting.id)) continue;
        const titleMatch = fuzzyMatch(meeting.title, query);
        const summaryMatch = meeting.summary && fuzzyMatch(meeting.summary, query);
        if (titleMatch || summaryMatch) {
            seen.add(meeting.id);
            results.push({
                id: meeting.id,
                title: meeting.title,
                subtitle: new Date(meeting.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                meetingId: meeting.id,
            });
        }
        if (results.length >= 5) break;
    }

    return results;
}

function rowHaystack(row: TopSearchResultRow): string {
    return [
        row.title,
        row.company,
        row.roleTitle,
        row.stageTitle,
        row.source,
        row.vacancyUrl,
    ].filter(Boolean).join(' ').toLowerCase();
}

function searchVacancyRows(rows: TopSearchResultRow[], query: string): TopSearchResultRow[] {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return rows
        .filter(row => rowHaystack(row).includes(needle))
        .sort((left, right) => {
            if (left.kind !== right.kind) return left.kind === 'vacancy' ? -1 : 1;
            return (left.startsAt ?? Number.MAX_SAFE_INTEGER) - (right.startsAt ?? Number.MAX_SAFE_INTEGER);
        })
        .slice(0, 8);
}

function getGroupLabel(t: TopSearchTranslationFunction, group: SearchGroup): string {
    return t(`topSearch.groups.${group}`);
}

function proposalTitle(t: TopSearchTranslationFunction, action: TopSearchActionKind): string {
    if (action === 'add_stage_from_text') return t('topSearch.actions.addStageFromText');
    if (action === 'parse_vacancy_source') return t('topSearch.actions.parseVacancySource');
    if (action === 'ask_ai') return t('topSearch.actions.askAi');
    return t('topSearch.actions.literalMeetingSearch');
}

function isProposalAction(action: TopSearchActionKind): boolean {
    return action === 'parse_vacancy_source' || action === 'add_stage_from_text';
}

const TopSearchPill: React.FC<TopSearchPillProps> = ({
    meetings,
    vacancyContext,
    onAIQuery,
    onLiteralSearch,
    onOpenMeeting,
    onExpansionChange
}) => {
    const { t, i18n } = useTranslation();
    const isLight = useResolvedTheme() === 'light';
    const [state, setState] = useState<PillState>('idle');
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [proposalState, setProposalState] = useState<'idle' | 'parsing' | 'proposal' | 'applying' | 'success' | 'error'>('idle');
    const [proposalAction, setProposalAction] = useState<TopSearchActionKind>('parse_vacancy_source');
    const [proposal, setProposal] = useState<ApplicationIntakeResult | null>(null);
    const [targetApplicationId, setTargetApplicationId] = useState<string>('');
    const [proposalTargetReason, setProposalTargetReason] = useState<TopSearchProposalTargetReason>('none');
    const [proposalError, setProposalError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const applyInFlightRef = useRef(false);

    useEffect(() => {
        onExpansionChange?.(state !== 'idle');
    }, [state, onExpansionChange]);

    const pasteIntent = useMemo(() => detectTopSearchPasteIntent(query), [query]);
    const isLongPaste = query.length > 180 || query.split(/\n/).length > 2 || pasteIntent.intent !== 'unknown';
    const vacancyRows = useMemo(() => searchVacancyRows(vacancyContext?.rows ?? [], query), [query, vacancyContext?.rows]);
    const locale = useMemo(() => {
        if (i18n.language.startsWith('en')) return 'en-US';
        if (i18n.language.startsWith('ru')) return 'ru-RU';
        return i18n.language || 'en';
    }, [i18n.language]);
    const sessionResults = useMemo(() => state === 'results' && query.trim() ? searchMeetings(meetings, query, locale) : [], [locale, meetings, query, state]);

    const entries = useMemo<SearchEntry[]>(() => {
        const trimmed = query.trim();
        if (state !== 'results' || !trimmed) return [];
        const actionRows: SearchEntry[] = [
            {
                id: 'action:ask_ai',
                kind: 'action',
                group: 'actions',
                title: t('topSearch.actions.askAi'),
                subtitle: makeSafeExcerpt(trimmed, '', { maxLength: 96 }),
                action: 'ask_ai',
            },
            {
                id: 'action:literal_meeting_search',
                kind: 'action',
                group: 'actions',
                title: t('topSearch.actions.literalMeetingSearch'),
                subtitle: t('topSearch.actionSubtitles.literalMeetingSearch', {
                    query: makeSafeExcerpt(trimmed, '', { maxLength: 72 }),
                }),
                action: 'literal_meeting_search',
            },
        ];

        if (vacancyContext?.isActive) {
            const proposalActionKind: TopSearchActionKind = pasteIntent.intent === 'stage'
                || (pasteIntent.stageScore > 0 && pasteIntent.stageScore >= pasteIntent.vacancyScore)
                ? 'add_stage_from_text'
                : 'parse_vacancy_source';
            const proposalRow: SearchEntry = {
                id: `action:${proposalActionKind}`,
                kind: 'action',
                group: 'actions',
                title: proposalTitle(t, proposalActionKind),
                subtitle: t('topSearch.actionSubtitles.proposalReadyReview'),
                action: proposalActionKind,
            };
            actionRows.unshift(proposalRow);
        }

        const localRows: SearchEntry[] = vacancyRows.map(row => ({
            id: `${row.kind}:${row.id}`,
            kind: row.kind,
            group: row.kind === 'vacancy' ? 'vacancies' : 'stages',
            title: row.title || row.stageTitle || t('topSearch.item.untitled'),
            subtitle: makeSafeExcerpt([row.company, row.roleTitle, row.stageTitle].filter(Boolean).join(' · '), trimmed, { maxLength: 110 }),
            row,
        }));

        const meetingRows: SearchEntry[] = sessionResults.map(result => ({
            id: `meeting:${result.id}`,
            kind: 'meeting',
            group: 'sessions',
            title: result.title,
            subtitle: result.subtitle,
            meetingId: result.meetingId,
        }));

        if (isLongPaste && vacancyContext?.isActive) {
            const [proposalRow, ...restActions] = actionRows;
            return [proposalRow, ...localRows, ...meetingRows, ...restActions];
        }

        return [...localRows, ...meetingRows, ...actionRows];
    }, [isLongPaste, pasteIntent.intent, query, sessionResults, state, t, vacancyContext?.isActive, vacancyRows]);

    useEffect(() => {
        if (entries.length === 0) {
            setSelectedIndex(0);
            return;
        }
        setSelectedIndex(prev => Math.min(Math.max(prev, 0), entries.length - 1));
    }, [entries.length]);

    const resetProposal = useCallback(() => {
        setProposalState('idle');
        setProposal(null);
        setTargetApplicationId('');
        setProposalTargetReason('none');
        setProposalError(null);
        applyInFlightRef.current = false;
    }, []);

    const open = useCallback(() => {
        setState('focused');
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const close = useCallback(() => {
        setState('idle');
        inputRef.current?.blur();
        window.setTimeout(() => {
            setQuery('');
            setSelectedIndex(0);
            resetProposal();
        }, 150);
    }, [resetProposal]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.slice(0, AGENT_INPUT_MAX_CHARS);
        setQuery(value);
        setSelectedIndex(0);
        resetProposal();
        setState(value.trim() ? 'results' : 'focused');
    }, [resetProposal]);

    const openProposal = useCallback(async (action: TopSearchActionKind) => {
        if (!vacancyContext?.isActive || !isProposalAction(action) || !query.trim()) return;
        setProposalAction(action);
        setProposalState('parsing');
        setProposal(null);
        setProposalError(null);
        try {
            const preview = await vacancyContext.onPreviewIntake({
                text: query,
                useAi: true,
                task: 'agent_actions',
                candidateApplicationIds: vacancyContext.candidateApplications.map(candidate => candidate.id),
            });
            const targetResolution = resolveTopSearchProposalTarget(preview, vacancyContext.rows);
            setProposal(preview);
            setTargetApplicationId(preview.stage && targetResolution.selectedApplicationId ? targetResolution.selectedApplicationId : '');
            setProposalTargetReason(preview.stage ? targetResolution.reason : 'none');
            setProposalState('proposal');
        } catch (error: any) {
            setProposalError(error?.message || t('topSearch.errors.parseFailed'));
            setProposalState('error');
        }
    }, [query, t, vacancyContext]);

    const handleSelect = useCallback((index: number) => {
        const entry = entries[index];
        if (!entry) return;
        if (entry.kind === 'action') {
            if (entry.action === 'ask_ai') {
                onAIQuery(query);
                close();
            } else if (entry.action === 'literal_meeting_search') {
                onLiteralSearch(query);
                close();
            } else {
                void openProposal(entry.action);
            }
            return;
        }
        if (entry.kind === 'meeting') {
            onOpenMeeting(entry.meetingId);
            close();
            return;
        }
        vacancyContext?.onOpenRow(entry.row);
        close();
    }, [close, entries, onAIQuery, onLiteralSearch, onOpenMeeting, openProposal, query, vacancyContext]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (state === 'idle') open();
                else close();
                return;
            }
            if (state === 'idle') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (state !== 'results' || entries.length === 0) return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, entries.length - 1));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (event.key === 'Enter' && proposalState !== 'proposal' && proposalState !== 'applying') {
                event.preventDefault();
                handleSelect(selectedIndex);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [close, entries.length, handleSelect, open, proposalState, selectedIndex, state]);

    useEffect(() => {
        if (state === 'idle') return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
        };
        const timer = window.setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [state, close]);

    const updateApplicationField = useCallback((field: keyof ApplicationIntakeResult['application'], value: string) => {
        setProposal(prev => prev ? { ...prev, application: { ...prev.application, [field]: value } } : prev);
    }, []);

    const updateStageField = useCallback((field: keyof NonNullable<ApplicationIntakeResult['stage']>, value: string) => {
        setProposal(prev => prev?.stage ? { ...prev, stage: { ...prev.stage, [field]: value } } : prev);
    }, []);

    const applyProposal = useCallback(async () => {
        if (!proposal || !vacancyContext?.isActive || applyInFlightRef.current) return;
        const requiresTarget = proposalAction === 'add_stage_from_text' && !!proposal.stage;
        if (requiresTarget && !targetApplicationId) return;
        applyInFlightRef.current = true;
        setProposalState('applying');
        setProposalError(null);
        try {
            await vacancyContext.onApplyIntake(proposal, {
                selectedApplicationId: proposal.stage && targetApplicationId ? targetApplicationId : null,
            });
            setProposalState('success');
            window.setTimeout(close, 500);
        } catch (error: any) {
            setProposalError(error?.message || t('topSearch.errors.applyFailed'));
            setProposalState('error');
            applyInFlightRef.current = false;
        }
    }, [close, proposal, proposalAction, targetApplicationId, t, vacancyContext]);

    const isExpanded = state !== 'idle';
    const showResults = state === 'results' && query.trim();
    const groupedEntries = useMemo(() => {
        const groups: Array<{ title: SearchEntry['group']; entries: SearchEntry[] }> = [];
        for (const entry of entries) {
            const group = groups.find(item => item.title === entry.group);
            if (group) group.entries.push(entry);
            else groups.push({ title: entry.group, entries: [entry] });
        }
        return groups;
    }, [entries]);
    const requiresTarget = proposalAction === 'add_stage_from_text' && !!proposal?.stage;
    const applyDisabled = proposalState === 'applying' || !proposal || (requiresTarget && !targetApplicationId);
    const targetSelectionMessage = requiresTarget && !targetApplicationId
        ? t(`topSearch.proposal.targetReasons.${proposalTargetReason === 'none' ? 'no_match' : proposalTargetReason}`)
        : null;

    return (
        <LazyMotion features={domAnimation}>
            <>
                {createPortal(
                    <AnimatePresence>
                        {isExpanded && (
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[8px]"
                                onClick={close}
                            />
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                <div ref={containerRef} className="absolute left-1/2 top-[7px] z-40 -translate-x-1/2 no-drag">
                    <div className="relative">
                        <m.div
                            initial={false}
                            animate={{ width: isExpanded ? 560 : 340 }}
                            transition={{ type: 'spring', stiffness: 150, damping: 25 }}
                            className="relative transform-gpu"
                        >
                            <div className="relative">
                                <div className={`relative overflow-hidden rounded-2xl shadow-sm backdrop-blur-xl backdrop-saturate-150 ${isLight ? 'bg-[#F2F2F7]/90' : 'bg-[#161618]/90'}`}>
                                        <div className="relative flex items-center" onClick={() => state === 'idle' && open()}>
                                            <div className="pointer-events-none absolute left-3 flex items-center gap-1">
                                                <Sparkles size={14} className="text-cyan-300" />
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                                                    {t('topSearch.assistantName')}
                                                </span>
                                            </div>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={query}
                                            onChange={handleInputChange}
                                            onFocus={() => state === 'idle' && setState('focused')}
                                            title={t('topSearch.assistantName')}
                                            aria-label={t('topSearch.inputAriaLabel')}
                                            data-testid="top-search-input"
                                            className={`w-full bg-transparent py-1 pl-36 pr-4 text-[13px] text-text-primary placeholder-text-tertiary focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60 ${state === 'idle' ? 'cursor-default' : 'cursor-text'}`}
                                            placeholder={t('topSearch.placeholder')}
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {showResults && (
                                            <m.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ type: 'spring', stiffness: 150, damping: 25, opacity: { duration: 0.3 } }}
                                                className="overflow-hidden"
                                            >
                                                <div className="w-[560px] border-t border-border-muted py-2">
                                                    {groupedEntries.map(group => (
                                                        <div key={group.title} className="px-3 py-1">
                                                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                                                                {getGroupLabel(t, group.title)}
                                                            </div>
                                                            {group.entries.map(entry => {
                                                                const index = entries.findIndex(item => item.id === entry.id);
                                                                const selected = selectedIndex === index;
                                                                const icon = entry.kind === 'action'
                                                                    ? <Sparkles size={12} className="text-white" />
                                                                    : entry.kind === 'meeting'
                                                                        ? <FileText size={12} className="text-text-secondary" />
                                                                        : entry.kind === 'stage'
                                                                            ? <CircleDot size={12} className="text-text-secondary" />
                                                                            : <BriefcaseBusiness size={12} className="text-text-secondary" />;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={entry.id}
                                                                        data-testid={`top-search-row-${entry.kind}`}
                                                                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-100 ${selected ? 'bg-bg-item-active' : 'hover:bg-bg-item-hover'}`}
                                                                        onClick={() => handleSelect(index)}
                                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                                    >
                                                                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${entry.kind === 'action' ? 'bg-gradient-to-br from-cyan-500 to-emerald-400' : 'bg-bg-item-surface'}`}>
                                                                            {icon}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-[13px] text-text-primary">{entry.title}</div>
                                                                            {entry.subtitle && <div className="truncate text-[11px] text-text-tertiary">{entry.subtitle}</div>}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}

                                                    {(proposalState === 'parsing' || proposalState === 'proposal' || proposalState === 'applying' || proposalState === 'success' || proposalState === 'error') && (
                                                        <div className="mx-3 mt-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.055] p-3" data-testid="top-search-proposal">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="text-[13px] font-semibold text-cyan-100">
                                                                        {proposalState === 'success'
                                                                            ? t('topSearch.proposal.applied')
                                                                            : proposalState === 'parsing'
                                                                                ? t('topSearch.proposal.parsing')
                                                                                : t('topSearch.proposal.ready')}
                                                                    </div>
                                                                    <div className="mt-1 text-[11px] text-text-tertiary">
                                                                        {proposal
                                                                            ? t('topSearch.proposal.confidence', { value: Math.round(proposal.confidence * 100) })
                                                                            : t('topSearch.proposal.noWriteUntilApply')}
                                                                    </div>
                                                                </div>
                                                                <button type="button" className="text-[11px] font-semibold text-text-secondary hover:text-white" onClick={resetProposal}>
                                                                    {t('topSearch.proposal.clear')}
                                                                </button>
                                                            </div>

                                                            {proposalError && <div className="mt-2 text-[12px] text-red-300">{proposalError}</div>}

                                                            {proposal && (
                                                                <div className="mt-3 space-y-2 text-[12px]">
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <label className="block">
                                                                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.title')}</span>
                                                                            <input className={PROPOSAL_INPUT_CLASS} value={proposal.application.title ?? ''} onChange={event => updateApplicationField('title', event.target.value)} />
                                                                        </label>
                                                                        <label className="block">
                                                                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.company')}</span>
                                                                            <input className={PROPOSAL_INPUT_CLASS} value={proposal.application.company ?? ''} onChange={event => updateApplicationField('company', event.target.value)} />
                                                                        </label>
                                                                        <label className="block">
                                                                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.role')}</span>
                                                                            <input className={PROPOSAL_INPUT_CLASS} value={proposal.application.roleTitle ?? ''} onChange={event => updateApplicationField('roleTitle', event.target.value)} />
                                                                        </label>
                                                                        {proposal.stage && (
                                                                            <label className="block">
                                                                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.stage')}</span>
                                                                                <input className={PROPOSAL_INPUT_CLASS} value={proposal.stage.title ?? ''} onChange={event => updateStageField('title', event.target.value)} />
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                    {proposal.stage && vacancyContext?.candidateApplications.length ? (
                                                                        <label className="block">
                                                                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.attachToVacancy')}</span>
                                                                            <select className={PROPOSAL_INPUT_CLASS} value={targetApplicationId} onChange={event => setTargetApplicationId(event.target.value)}>
                                                                                <option value="">{proposalAction === 'add_stage_from_text' ? t('topSearch.proposal.placeholders.enableApply') : t('topSearch.proposal.placeholders.createNewVacancy')}</option>
                                                                                {vacancyContext.candidateApplications.map(candidate => (
                                                                                    <option key={candidate.id} value={candidate.id}>
                                                                                        {[candidate.title, candidate.company, candidate.roleTitle].filter(Boolean).join(' · ')}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </label>
                                                                    ) : null}
                                                                    {targetSelectionMessage && (
                                                                        <div className="text-[11px] text-amber-200">{targetSelectionMessage}</div>
                                                                    )}
                                                                    {proposal.warnings.length > 0 && (
                                                                        <div className="text-[11px] text-amber-200">{proposal.warnings.join(', ')}</div>
                                                                    )}
                                                                    <div className="flex justify-end">
                                                                        <button type="button" data-testid="top-search-apply-proposal" onClick={applyProposal} disabled={applyDisabled} className="min-h-10 rounded-md bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">
                                                                            {proposalState === 'applying'
                                                                                ? t('topSearch.proposal.actions.applying')
                                                                                : proposalAction === 'add_stage_from_text'
                                                                                    ? t('topSearch.proposal.actions.addStage')
                                                                                    : proposal.stage
                                                                                        ? t('topSearch.proposal.actions.createVacancyStage')
                                                                                        : t('topSearch.proposal.actions.createVacancy')}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </m.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </m.div>
                    </div>
                </div>
            </>
        </LazyMotion>
    );
};

export default TopSearchPill;
