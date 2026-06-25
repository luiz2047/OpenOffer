import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Settings, RefreshCw, UserSearch } from 'lucide-react';
import MeetingDetails from './MeetingDetails';
import TopSearchPill from './TopSearchPill';
import GlobalChatOverlay from './GlobalChatOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { analytics } from '../lib/analytics/analytics.service'; // Added analytics import
import { useShortcuts } from '../hooks/useShortcuts';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { isMac } from '../utils/platformUtils';
import WindowControls from './WindowControls';
import InterviewCommandCenter, { type InterviewMeetingStartMetadata } from '../features/interviews/InterviewCommandCenter';
import type { VacancyTopSearchContext } from '../features/interviews/topSearchHelpers';

interface Meeting {
    id: string;
    title: string;
    date: string;
    duration: string;
    summary: string;
    detailedSummary?: {
        actionItems: string[];
        keyPoints: string[];
    };
    transcript?: Array<{
        speaker: string;
        text: string;
        timestamp: number;
    }>;
    usage?: Array<{
        type: 'assist' | 'followup' | 'chat' | 'followup_questions';
        timestamp: number;
        question?: string;
        answer?: string;
        items?: string[];
    }>;
    active?: boolean; // UI state
    time?: string; // Optional for compatibility
}

interface LauncherProps {
    onStartMeeting: (metadata?: InterviewMeetingStartMetadata) => void;
    onOpenSettings: (tab?: string) => void;
    onOpenProfile?: () => void;
    onPageChange?: (isMain: boolean) => void;
    ollamaPullStatus?: 'idle' | 'downloading' | 'complete' | 'failed';
    ollamaPullPercent?: number;
    ollamaPullMessage?: string;
}

const Launcher: React.FC<LauncherProps> = ({ onStartMeeting, onOpenSettings, onOpenProfile, onPageChange }) => {
    const { t } = useTranslation();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isDetectable, setIsDetectable] = useState(false);
    const [isMeetingActive, setIsMeetingActive] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [forwardMeeting, setForwardMeeting] = useState<Meeting | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [, setIsCalendarConnected] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [vacancySearchContext, setVacancySearchContext] = useState<VacancyTopSearchContext | null>(null);

    // Global search state (for AI chat overlay)
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [submittedGlobalQuery, setSubmittedGlobalQuery] = useState('');
    const [globalChatForceProposal, setGlobalChatForceProposal] = useState(false);
    const [globalChatVacancyContext, setGlobalChatVacancyContext] = useState<VacancyTopSearchContext | null>(null);

    const [showProfileOnboarding, setShowProfileOnboarding] = useState(false);

    const fetchMeetings = () => {
        if (window.electronAPI && window.electronAPI.getRecentMeetings) {
            window.electronAPI.getRecentMeetings().then(setMeetings).catch(err => console.error("Failed to fetch meetings:", err));
        }
    };

    const fetchEvents = () => {
        if (window.electronAPI && window.electronAPI.getUpcomingEvents) {
            window.electronAPI.getUpcomingEvents().then(setUpcomingEvents).catch(err => console.error("Failed to fetch events:", err));
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true);
        analytics.trackCommandExecuted('refresh_calendar');
        try {
            if (window.electronAPI && window.electronAPI.calendarRefresh) {
                setShowNotification(true);
                await window.electronAPI.calendarRefresh();
                fetchEvents();
                fetchMeetings();
                setTimeout(() => {
                    setShowNotification(false);
                }, 3000);
            } else {
                console.warn("electronAPI.calendarRefresh not found");
            }
        } catch (e) {
            console.error("Refresh failed in handleRefresh:", e);
        } finally {
            // Ensure distinct feedback provided (min 500ms spin)
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // Keybinds
    const { isShortcutPressed } = useShortcuts();
    const isLight = useResolvedTheme() === 'light';
    useEffect(() => {
        let mounted = true;
        console.log("Launcher mounted");
        // Seed demo data if needed (safe to call always — runs ONCE on mount)
        if (window.electronAPI && window.electronAPI.seedDemo) {
            window.electronAPI.seedDemo().catch(err => console.error("Failed to seed demo:", err));
        }

        // Onboarding Check
        const hasSeenProfileOnboarding = localStorage.getItem('natively_seen_profile_onboarding_v1');
        if (!hasSeenProfileOnboarding) {
            setTimeout(() => {
                if (mounted) setShowProfileOnboarding(true);
            }, 9000);
        }

        // Sync initial undetectable state
        if (window.electronAPI?.getUndetectable) {
            window.electronAPI.getUndetectable().then((undetectable) => {
                if (mounted) setIsDetectable(!undetectable);
            });
        }

        // Listen for undetectable changes
        let removeUndetectableListener: (() => void) | undefined;
        if (window.electronAPI?.onUndetectableChanged) {
            removeUndetectableListener = window.electronAPI.onUndetectableChanged((undetectable) => {
                setIsDetectable(!undetectable);
            });
        }

        fetchMeetings();
        fetchEvents();

        // Sync initial meeting active state — guarded so unmounted component isn't written to
        if (window.electronAPI?.getMeetingActive) {
            window.electronAPI.getMeetingActive()
                .then((active) => { if (mounted) setIsMeetingActive(active); })
                .catch(() => {});
        }

        // Listen for meeting state changes (e.g. meeting started/ended from overlay)
        let removeMeetingStateListener: (() => void) | undefined;
        if (window.electronAPI?.onMeetingStateChanged) {
            removeMeetingStateListener = window.electronAPI.onMeetingStateChanged(({ isActive }) => {
                setIsMeetingActive(isActive);
            });
        }

        // Listen for background updates (e.g. after meeting processing finishes)
        const removeMeetingsListener = window.electronAPI.onMeetingsUpdated(() => {
            console.log("Received meetings-updated event");
            fetchMeetings();
        });

        // Simple polling for events every minute
        const interval = setInterval(fetchEvents, 60000);

        return () => {
            mounted = false;
            if (removeMeetingsListener) removeMeetingsListener();
            if (removeUndetectableListener) removeUndetectableListener();
            if (removeMeetingStateListener) removeMeetingStateListener();
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount-only: stable setup that must run exactly once

    // Separate effect for keyboard listener — re-registers when isShortcutPressed changes
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isShortcutPressed(e, 'toggleVisibility')) {
                e.preventDefault();
                window.electronAPI.toggleWindow();
            } else if (isShortcutPressed(e, 'moveWindowUp')) {
                e.preventDefault();
                window.electronAPI.moveWindowUp?.();
            } else if (isShortcutPressed(e, 'moveWindowDown')) {
                e.preventDefault();
                window.electronAPI.moveWindowDown?.();
            } else if (isShortcutPressed(e, 'moveWindowLeft')) {
                e.preventDefault();
                window.electronAPI.moveWindowLeft?.();
            } else if (isShortcutPressed(e, 'moveWindowRight')) {
                e.preventDefault();
                window.electronAPI.moveWindowRight?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isShortcutPressed]);

    // Notify parent if we are on the main launcher list view
    useEffect(() => {
        if (onPageChange) {
            onPageChange(!selectedMeeting && !isGlobalChatOpen);
        }
    }, [selectedMeeting, isGlobalChatOpen, onPageChange]);

    if (!window.electronAPI) {
        return <div className="text-white p-10">Ошибка: Electron API не инициализирован. Проверьте preload-скрипт.</div>;
    }

    const handleOpenMeeting = async (meeting: Meeting) => {
        setForwardMeeting(null); // Clear forward history on new navigation
        console.log("[Launcher] Opening meeting:", meeting.id);
        analytics.trackCommandExecuted('open_meeting_details');

        // Fetch full meeting details including transcript and usage
        if (window.electronAPI && window.electronAPI.getMeetingDetails) {
            try {
                console.log("[Launcher] Fetching full meeting details...");
                const fullMeeting = await window.electronAPI.getMeetingDetails(meeting.id);
                console.log("[Launcher] Got meeting details:", fullMeeting);
                console.log("[Launcher] Transcript count:", fullMeeting?.transcript?.length);
                console.log("[Launcher] Usage count:", fullMeeting?.usage?.length);
                if (fullMeeting) {
                    setSelectedMeeting(fullMeeting);
                    return;
                }
            } catch (err) {
                console.error("[Launcher] Failed to fetch meeting details:", err);
            }
        } else {
            console.warn("[Launcher] getMeetingDetails not available on electronAPI");
        }
        // Fallback to list-view data if fetch fails
        setSelectedMeeting(meeting);
    };

    const handleBack = () => {
        setForwardMeeting(selectedMeeting);
        setSelectedMeeting(null);
    };

    const handleForward = () => {
        if (forwardMeeting) {
            setSelectedMeeting(forwardMeeting);
            setForwardMeeting(null);
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-bg-primary text-text-primary font-sans overflow-hidden selection:bg-accent-secondary/30">
            {/* 1. Header (Static) */}
            <header className={`relative flex h-[40px] w-full min-w-0 shrink-0 items-center justify-between pl-0 drag-region select-none ${isLight ? 'bg-bg-primary' : 'bg-bg-secondary'} border-b border-border-subtle z-[200]`}>
                {/* Left: Spacing for Traffic Lights + Navigation Arrows */}
                <div className="flex items-center gap-1 no-drag">
                    {isMac && <div className="w-[70px]" />} {/* Traffic Light Spacer (macOS only) */}

                    {/* Back Button */}
                    <button type="button"
                        onClick={selectedMeeting ? handleBack : undefined}
                        disabled={!selectedMeeting}
                        className={`
                            transition-all duration-300 p-1 flex items-center justify-center mt-1 ml-2
                            ${selectedMeeting
                                ? `text-text-secondary hover:text-text-primary ${isLight ? 'hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]' : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}`
                                : 'text-text-tertiary opacity-50 cursor-default'}
                        `}
                    >
                        <ArrowLeft size={16} />
                    </button>

                    {/* Forward Button */}
                    <button type="button"
                        onClick={handleForward}
                        disabled={!forwardMeeting}
                        className={`
                            transition-all duration-300 p-1 flex items-center justify-center mt-1
                            ${forwardMeeting
                                ? `text-text-secondary hover:text-text-primary ${isLight ? 'hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]' : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}`
                                : 'text-text-tertiary opacity-0 cursor-default'}
                        `}
                    >
                        <ArrowRight size={16} />
                    </button>
                </div>


                {/* Center: Spotlight-style Search Pill */}
                <TopSearchPill
                    meetings={meetings}
                    vacancyContext={selectedMeeting ? null : vacancySearchContext}
                    onAIQuery={(query, options) => {
                        analytics.trackCommandExecuted('ai_query_search');
                        setSubmittedGlobalQuery(query);
                        setGlobalChatForceProposal(Boolean(options?.forceProposal));
                        setGlobalChatVacancyContext(options?.vacancyContext ?? vacancySearchContext);
                        setIsGlobalChatOpen(true);
                    }}
                    onLiteralSearch={(query) => {
                        analytics.trackCommandExecuted('literal_search');
                        // GLOBAL SEARCH V2 (Phase 9): real local-DB literal search behind
                        // global_search_v2_enabled. When enabled and there's a match, open
                        // the top-ranked meeting directly. Otherwise fall back to the
                        // existing AI-query behavior (preserved). The backend returns
                        // { enabled:false } when the flag is off, so this is a pure no-op then.
                        // The handler stays synchronous (prop is `(q) => void`); the await
                        // runs in an inner IIFE so we never return a floating Promise to the
                        // event-handler prop.
                        const runFallback = () => {
                            setSubmittedGlobalQuery(query);
                            setIsGlobalChatOpen(true);
                        };
                        void (async () => {
                            try {
                                const resp = await window.electronAPI.searchGlobalMeetings?.(query);
                                if (resp?.enabled && Array.isArray(resp.results) && resp.results.length > 0) {
                                    const top = resp.results[0];
                                    const meeting = meetings.find((m) => m.id === top.meetingId);
                                    if (meeting) {
                                        handleOpenMeeting(meeting);
                                        return;
                                    }
                                }
                            } catch (_) { /* fall through to AI query */ }
                            runFallback();
                        })();
                    }}
                    onOpenMeeting={(meetingId) => {
                        const meeting = meetings.find(m => m.id === meetingId);
                        if (meeting) {
                            handleOpenMeeting(meeting);
                            analytics.trackCommandExecuted('open_meeting_from_search');
                        }
                    }}
                />

                {/* Right: Actions */}
                <div className={`flex shrink-0 items-center gap-1 no-drag ${isMac ? 'mr-1' : ''}`}>
                    <div className="relative hidden select-none group/profile-btn sm:block">
                        <button type="button"
                            data-testid="open-profile-intelligence"
                            onClick={() => {
                                setShowProfileOnboarding(false);
                                localStorage.setItem('natively_seen_profile_onboarding_v1', 'true');
                                window.electronAPI?.onboardingSetFlag?.('seenProfileOnboarding', true).catch(() => {});
                                onOpenProfile?.();
                            }}
                            title={t('launcher.profileIntelligence')}
                            className={`flex h-11 w-11 items-center justify-center text-text-secondary transition-all duration-300 hover:text-text-primary ${isLight ? 'hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]' : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}`}
                        >
                            <UserSearch size={18} />
                        </button>
                        
                        <AnimatePresence>
                            {showProfileOnboarding && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.96, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, y: -2, scale: 0.98, filter: "blur(2px)", transition: { duration: 0.15, ease: "easeOut" } }}
                                    transition={{ type: "spring", stiffness: 350, damping: 25, mass: 1 }}
                                    className={`absolute top-[38px] right-2 w-[270px] rounded-[20px] p-4 z-[300] origin-top-right backdrop-blur-[40px] saturate-[180%] transform-gpu ${
                                        isLight 
                                        ? 'bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]' 
                                        : 'bg-[#18181A]/70 shadow-[0_8px_30px_rgb(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)]'
                                    }`}
                                >
                                    {/* Triangle Pointer */}
                                    <div className={`absolute -top-[5px] right-[14px] w-2.5 h-2.5 rotate-45 rounded-tl-[3px] ${
                                        isLight 
                                        ? 'bg-white/70 border-t border-l border-black/5 backdrop-blur-[40px]' 
                                        : 'bg-[#18181A]/70 border-t border-l border-white/5 backdrop-blur-[40px]'
                                    }`} />
                                    
                                    <div className="relative flex gap-3">
                                        <div className={`w-9 h-9 flex items-center justify-center shrink-0 rounded-full ${
                                            isLight
                                            ? 'bg-blue-500 bg-opacity-10 text-blue-500'
                                            : 'bg-blue-500 bg-opacity-15 text-blue-400'
                                        }`}>
                                            <UserSearch size={18} />
                                        </div>
                                        <div className="flex-1 pt-[2px]">
                                            <h3 className="text-[14px] font-semibold tracking-[-0.015em] mb-1 flex items-center gap-2">
                                                <span className={isLight ? 'text-slate-900' : 'text-slate-100'}>{t('launcher.profileIntelShort')}</span>
                                                <span className={`text-[10px] font-medium px-1.5 py-[1px] rounded-[5px] ${
                                                    isLight
                                                    ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                                                    : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                    {t('common.beta')}
                                                </span>
                                            </h3>
                                            <p className={`text-[12px] leading-[1.35] mb-3.5 tracking-[-0.01em] ${
                                                isLight ? 'text-slate-500' : 'text-slate-400'
                                            }`}>
                                                {t('launcher.profileDescription')}
                                            </p>
                                            <div className="flex justify-end gap-1.5 isolate">
                                                <button type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setShowProfileOnboarding(false); 
                                                        localStorage.setItem('natively_seen_profile_onboarding_v1', 'true'); 
                                                        window.electronAPI?.onboardingSetFlag?.('seenProfileOnboarding', true).catch(() => {});
                                                    }}
                                                    className={`text-[12px] font-medium px-3.5 py-[6px] rounded-full transition-all active:scale-95 ${
                                                        isLight
                                                        ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                                                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {t('common.dismiss')}
                                                </button>
                                                <button type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        onOpenProfile?.(); 
                                                        setShowProfileOnboarding(false); 
                                                        localStorage.setItem('natively_seen_profile_onboarding_v1', 'true'); 
                                                        window.electronAPI?.onboardingSetFlag?.('seenProfileOnboarding', true).catch(() => {});
                                                    }}
                                                    className={`text-[12px] font-medium px-4 py-[6px] rounded-full transition-all active:scale-95 shadow-sm ${
                                                        isLight
                                                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                                                        : 'bg-slate-100 text-slate-900 hover:bg-white'
                                                    }`}
                                                >
                                                    {t('launcher.tryItOut')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button type="button"
                        onClick={() => {
                            onOpenSettings();
                        }}
                        title={t('common.settings')}
                        className={`flex h-11 w-11 items-center justify-center text-text-secondary transition-all duration-300 hover:text-text-primary ${isLight ? 'hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]' : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}`}
                    >
                        <Settings size={18} />
                    </button>
                    {!isMac && <WindowControls />}
                </div>
            </header>

            <div className="relative flex-1 flex flex-col overflow-hidden">
                {!isDetectable && (
                    <div className={`absolute inset-1 border-2 border-dashed rounded-2xl pointer-events-none z-[100] ${isLight ? 'border-black/15' : 'border-white/20'}`} />
                )}
                <AnimatePresence mode="wait">
                    {selectedMeeting ? (
                        <motion.div
                            key="details"
                            className="flex-1 overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MeetingDetails
                                meeting={selectedMeeting}
                                onBack={handleBack}
                                onOpenSettings={onOpenSettings}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="launcher"
                            className="flex-1 flex flex-col overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <InterviewCommandCenter
                                meetings={meetings}
                                upcomingEvents={upcomingEvents}
                                isRefreshing={isRefreshing}
                                isMeetingActive={isMeetingActive}
                                onRefresh={handleRefresh}
                                onStartMeeting={onStartMeeting}
                                onOpenMeeting={handleOpenMeeting}
                                onOpenSettings={onOpenSettings}
                                onCalendarConnected={setIsCalendarConnected}
                                onSearchContextChange={setVacancySearchContext}
                            />                        </motion.div>
                    )}
                </AnimatePresence>
            </div>



            {/* Notification Toast - Liquid Glass (macOS 26 Tahoe Concept) */}
            <AnimatePresence>
                {showNotification && (
                    <motion.div
                        initial={{ x: 300, opacity: 0, scale: 0.9 }}
                        animate={{ x: 0, opacity: 1, scale: 1 }}
                        exit={{ x: 300, opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 1 }}
                        className={`fixed bottom-10 right-10 z-[2000] flex items-center gap-4 pl-4 pr-6 py-3.5 rounded-[18px] backdrop-blur-xl saturate-[180%] ring-1 ring-black/10 ${isLight ? 'bg-bg-elevated/90 border border-border-muted shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]' : 'bg-[#2A2A2E]/40 border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(255,255,255,0.05)]'}`}
                    >
                        {/* Liquid Icon Orb */}
                        <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-b from-blue-400/20 to-blue-600/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] border border-white/5">
                            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md" />
                            <RefreshCw size={15} className="text-blue-300 animate-[spin_2s_linear_infinite] drop-shadow-[0_0_5px_rgba(59,130,246,0.6)]" />
                        </div>

                        {/* Text Content */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] font-semibold text-text-primary leading-none tracking-tight">{t('launcher.refreshed')}</span>
                            <span className="text-[11px] text-text-tertiary font-medium leading-none tracking-wide">{t('launcher.syncedWithCalendar')}</span>
                        </div>

                        {/* Specular Highlight Overlay */}
                        <div className="absolute inset-0 rounded-[18px] bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Chat Overlay */}
            <GlobalChatOverlay
                isOpen={isGlobalChatOpen}
                onClose={() => {
                    setIsGlobalChatOpen(false);
                    setSubmittedGlobalQuery('');
                    setGlobalChatForceProposal(false);
                    setGlobalChatVacancyContext(null);
                }}
                initialQuery={submittedGlobalQuery}
                forceProposal={globalChatForceProposal}
                vacancyContext={globalChatVacancyContext ?? vacancySearchContext}
            />
        </div >
    );
};

export default Launcher;
