import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, FileText, BriefcaseBusiness, CircleDot } from 'lucide-react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { useTranslation } from 'react-i18next';
import {
    detectTopSearchPasteIntent,
    makeSafeExcerpt,
    type TopSearchActionKind,
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
    onAIQuery: (query: string, options?: { forceProposal?: boolean; vacancyContext?: VacancyTopSearchContext | null }) => void;
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

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
        }, 150);
    }, []);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.slice(0, AGENT_INPUT_MAX_CHARS);
        setQuery(value);
        setSelectedIndex(0);
        setState(value.trim() ? 'results' : 'focused');
    }, []);

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
                onAIQuery(query, { forceProposal: true, vacancyContext });
                close();
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
    }, [close, entries, onAIQuery, onLiteralSearch, onOpenMeeting, query, vacancyContext]);

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
            } else if (event.key === 'Enter') {
                event.preventDefault();
                handleSelect(selectedIndex);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [close, entries.length, handleSelect, open, selectedIndex, state]);

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
                                className="fixed inset-0 z-[90] bg-[rgba(17,17,19,0.54)] backdrop-blur-[8px]"
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
                            className="relative max-w-[calc(100vw-96px)] transform-gpu sm:max-w-none"
                        >
                            <div className="relative">
                                <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl backdrop-saturate-150 ${isLight ? 'border-black/[0.08] bg-[#F2F2F7]/95 shadow-[0_10px_24px_rgba(0,0,0,0.08)]' : 'border-white/[0.10] bg-bg-card shadow-[0_14px_34px_rgba(0,0,0,0.26)] ring-1 ring-white/[0.035]'}`}>
                                        <div className="relative flex min-h-10 items-center" onClick={() => state === 'idle' && open()}>
                                            <div className="pointer-events-none absolute left-3 flex items-center gap-1.5">
                                                <Sparkles size={15} className="text-cyan-300" />
                                                <span className="hidden text-[10px] font-semibold uppercase text-text-secondary min-[421px]:inline">
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
                                            className={`w-full bg-transparent py-2 pl-10 pr-3 text-[13px] font-medium text-text-primary placeholder-text-tertiary focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60 min-[421px]:pl-36 min-[421px]:pr-4 ${state === 'idle' ? 'cursor-default' : 'cursor-text'}`}
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
                                                <div className="border-t border-border-muted py-2" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
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
                                                                        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-100 ${selected ? 'bg-bg-item-active' : 'hover:bg-bg-item-hover'}`}
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
