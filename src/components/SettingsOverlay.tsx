import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import packageJson from '../../package.json';
import {
    X, Mic, Speaker, Monitor, Keyboard, User, LifeBuoy, LogOut, Upload,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Camera, RotateCcw, Eye, Layout, MessageSquare, Crop,
    ChevronDown, ChevronUp, Check, BadgeCheck, Power, Palette, Calendar, Ghost, Sun, Moon, RefreshCw, Info, Globe, Languages, FlaskConical, Terminal, Settings, Activity, ExternalLink, Trash2,
    Sparkles, Pencil, Briefcase, Building2, Search, MapPin, CheckCircle, HelpCircle, Zap, SlidersHorizontal, PointerOff,
    Star, AlertCircle, Gift, Smartphone, Cpu, Shield
} from 'lucide-react';
import { analytics } from '../lib/analytics/analytics.service';
import { AboutSection } from './AboutSection';
import { HelpSettings } from './settings/HelpSettings';
import { AIProvidersSettings } from './settings/AIProvidersSettings';
import { PhoneMirrorSettings } from './settings/PhoneMirrorSettings';
import { IntelligenceSettings } from './settings/IntelligenceSettings';
import { SkillsSettings } from './settings/SkillsSettings';
import { LocalWhisperModelPanel } from './LocalWhisperModelPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcuts } from '../hooks/useShortcuts';
import { isMac } from '../utils/platformUtils';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import {
    clampOverlayOpacity,
    getOverlayAppearance,
    OVERLAY_OPACITY_DEFAULT,
    OVERLAY_OPACITY_MIN,
    getDefaultOverlayOpacity,
} from '../lib/overlayAppearance';
import { getMeetingInterfaceTheme, setMeetingInterfaceTheme, type MeetingInterfaceTheme } from '../lib/meetingInterfaceTheme';
import { KeyRecorder } from './ui/KeyRecorder';
import icon from './icon.png';
import { sanitizeSttProvider } from '../lib/legacyStateMigration';
import type { InterfaceLanguagePreference, InterfaceLocaleOption, InterfaceTranslationsSnapshot } from '../i18n';
import type { CalendarEventSummary, CalendarStatusResult } from '../types/interviews';

const EMPTY_CALENDAR_STATUS: CalendarStatusResult = {
    providers: [],
    preferredProvider: null,
    connected: false,
};

// ---------------------------------------------------------------------------
// StarRating — renders filled/empty stars for culture ratings


// ---------------------------------------------------------------------------
// MockupOpenOfferInterface — fake in-meeting widget for the opacity preview
// ---------------------------------------------------------------------------
const MockupOpenOfferInterface = ({ opacity }: { opacity: number }) => {
    const resolvedTheme = useResolvedTheme();
    const { t } = useTranslation();
    const appearance = useMemo(
        () => getOverlayAppearance(opacity, resolvedTheme),
        [opacity, resolvedTheme]
    );

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none bg-transparent">
                {/* OpenOffer overlay widget — opacity controlled by the slider */}
                <div
                    id="mockup-openoffer-interface"
                    className="flex flex-col items-center pointer-events-none -mt-56"
                >
                    {/* TopPill Replica */}
                    <div className="flex justify-center mb-2 select-none z-50">
                        <div className="flex items-center gap-2 rounded-full overlay-pill-surface backdrop-blur-md pl-1.5 pr-1.5 py-1.5" style={appearance.pillStyle}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden overlay-icon-surface" style={appearance.iconStyle}>
                                <img
                                    src={icon}
                                    alt="OpenOffer"
                                    className="w-[24px] h-[24px] object-contain opacity-95 scale-105 force-black-icon"
                                    draggable="false"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-medium border overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <ChevronUp className="w-3.5 h-3.5 opacity-70" />
                                <span className="opacity-80 tracking-wide">{t('common.hide')}</span>
                            </div>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center overlay-icon-surface overlay-text-primary" style={appearance.iconStyle}>
                                <div className="w-3.5 h-3.5 rounded-[3px] bg-red-400 opacity-80" />
                            </div>
                        </div>
                    </div>

                    {/* Main Interface Window Replica */}
                    <div className="relative w-[600px] max-w-full overlay-shell-surface overlay-text-primary backdrop-blur-2xl border rounded-[24px] overflow-hidden flex flex-col pt-2 pb-3" style={appearance.shellStyle}>

                        {/* Rolling Transcript Bar */}
                        <div className="w-full flex justify-center py-2 px-4 border-b mb-1 overlay-transcript-surface" style={appearance.transcriptStyle}>
                            <p className="text-[13px] truncate max-w-[90%] font-medium overlay-text-primary">
                                <span className={`${resolvedTheme === 'light' ? 'text-blue-700' : 'text-blue-400'} mr-2 font-semibold`}>Интервьюер</span>
                                <span className="opacity-95">Как бы вы оптимизировали текущий алгоритм?</span>
                            </p>
                        </div>

                        {/* Chat History Mock */}
                        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                            <div className="flex justify-start">
                                <div className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed font-normal overlay-text-primary">
                                    <span className="font-semibold text-emerald-500 block mb-1">Подсказка</span>
                                    Хороший подход — использовать хеш-таблицу для кеширования промежуточных результатов, что снижает временную сложность с O(n²) до O(n).
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-nowrap justify-center items-center gap-1.5 px-4 pb-3 pt-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <Pencil className="w-3 h-3 opacity-70" /> {t('overlay.whatToAnswer')}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <MessageSquare className="w-3 h-3 opacity-70" /> {t('overlay.clarify')}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <RefreshCw className="w-3 h-3 opacity-70" /> {t('overlay.recap')}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <HelpCircle className="w-3 h-3 opacity-70" /> {t('overlay.followUpQuestion')}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium min-w-[74px] shrink-0 border overlay-chip-surface overlay-text-interactive" style={appearance.chipStyle}>
                                <Zap className="w-3 h-3 opacity-70" /> {t('overlay.answer')}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="px-3">
                            <div className="relative group">
                                <div className="w-full border rounded-xl pl-3 pr-10 py-2.5 h-[38px] flex items-center overlay-input-surface" style={appearance.inputStyle}>
                                    <span className="text-[13px] overlay-text-muted">{t('overlay.inputPlaceholderPrefix')}</span>
                                </div>
                            </div>

                            {/* Bottom Row */}
                            <div className="flex items-center justify-between mt-3 px-0.5">
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium w-[140px] overlay-control-surface overlay-text-interactive" style={appearance.controlStyle}>
                                        <span className="truncate min-w-0 flex-1">Gemini 3 Flash</span>
                                        <ChevronDown size={14} className="shrink-0" />
                                    </div>
                                    <div className="w-px h-3 mx-1" style={appearance.dividerStyle} />
                                    <div className="w-7 h-7 flex items-center justify-center rounded-lg overlay-icon-surface overlay-text-muted" style={appearance.iconStyle}>
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    );
};

interface CustomSelectProps {
    label: string;
    icon: React.ReactNode;
    value: string;
    options: MediaDeviceInfo[];
    onChange: (value: string) => void;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, icon, value, options, onChange, placeholder = "Выберите устройство" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.deviceId === value)?.label || placeholder;

    return (
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle" ref={containerRef}>
            {label && (
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-text-secondary">{icon}</span>
                    <label className="text-xs font-medium text-text-primary uppercase tracking-wide">{label}</label>
                </div>
            )}

            <div className="relative">
                <button type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
                >
                    <span className="truncate pr-4">{selectedLabel}</span>
                    <ChevronDown size={14} className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animated fadeIn">
                        <div className="p-1 space-y-0.5">
                            {options.map((device) => (
                                <button type="button"
                                    key={device.deviceId}
                                    onClick={() => {
                                        onChange(device.deviceId);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors ${value === device.deviceId ? 'bg-bg-input hover:bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                >
                                    <span className="truncate">{device.label || `Устройство ${device.deviceId.slice(0, 5)}...`}</span>
                                    {value === device.deviceId && <Check size={14} className="text-accent-primary" />}
                                </button>
                            ))}
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">Устройства не найдены</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProviderOption {
    id: string;
    label: string;
    badge?: string | null;
    recommended?: boolean;
    desc: string;
    color: string;
    icon: React.ReactNode;
}

interface ProviderSelectProps {
    value: string;
    options: ProviderOption[];
    onChange: (value: string) => void;
    placeholder: string;
    recommendedLabel: string;
}

const ProviderSelect: React.FC<ProviderSelectProps> = ({ value, options, onChange, placeholder, recommendedLabel }) => {
    const isLight = useResolvedTheme() === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(o => o.id === value);

    const getBadgeStyle = (color?: string) => {
        switch (color) {
            case 'blue': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'orange': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'purple': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'teal': return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
            case 'cyan': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            case 'green': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    const getIconStyle = (color?: string, isSelectedItem: boolean = false) => {
        if (isSelectedItem) return 'bg-accent-primary text-white shadow-sm';
        // For unselected items in list or trigger
        switch (color) {
            case 'blue': return 'bg-blue-500/10 text-blue-600';
            case 'orange': return 'bg-orange-500/10 text-orange-600';
            case 'purple': return 'bg-purple-500/10 text-purple-600';
            case 'teal': return 'bg-teal-500/10 text-teal-600';
            case 'cyan': return 'bg-cyan-500/10 text-cyan-600';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-600';
            case 'green': return 'bg-green-500/10 text-green-600';
            default: return 'bg-gray-500/10 text-gray-600';
        }
    };

    return (
        <div ref={containerRef} className="relative z-20 font-sans">
            <button type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group bg-bg-input border border-border-subtle hover:border-border-muted shadow-sm rounded-xl p-2.5 pr-3.5 flex items-center justify-between transition-all duration-200 outline-none focus:ring-2 focus:ring-accent-primary/20 ${isOpen ? 'ring-2 ring-accent-primary/20 border-accent-primary/50' : 'hover:shadow-md'}`}
            >
                {selected ? (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-300 ${getIconStyle(selected.color)}`}>
                            {selected.icon}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">{selected.label}</span>
                                {selected.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.badge === 'Saved' ? 'green' : selected.color)}`}>{selected.badge}</span>}
                                {selected.recommended && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.color)}`}>{recommendedLabel}</span>}
                            </div>
                            {/* Short description for trigger */}
                            <span className="text-[11px] text-text-tertiary truncate block leading-tight mt-0.5">{selected.desc}</span>
                        </div>
                    </div>
                ) : <span className="text-text-secondary px-2 text-sm">{placeholder}</span>}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary transition-transform duration-300 group-hover:bg-bg-input ${isOpen ? 'rotate-180 bg-bg-input text-text-primary' : ''}`}>
                    <ChevronDown size={14} strokeWidth={2.5} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute top-full left-0 w-full mt-2 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 ${isLight ? 'bg-bg-elevated border border-border-subtle' : 'bg-bg-elevated/90 border border-white/5'}`}
                    >
                        <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                            {options.map(option => {
                                const isSelected = value === option.id;
                                return (
                                    <button type="button"
                                        key={option.id}
                                        onClick={() => { onChange(option.id); setIsOpen(false); }}
                                        className={`w-full rounded-[10px] p-2 flex items-center gap-3 transition-all duration-200 group relative ${isSelected ? (isLight ? 'bg-bg-item-active shadow-inner' : 'bg-white/10 shadow-inner') : (isLight ? 'hover:bg-bg-item-surface' : 'hover:bg-white/5')}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-95 group-hover:scale-100'} ${getIconStyle(option.color, false)}`}>
                                            {option.icon}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[13px] font-medium transition-colors ${isSelected && !isLight ? 'text-white' : 'text-text-primary'}`}>{option.label}</span>
                                                    {option.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.badge === 'Saved' ? 'green' : option.color)}`}>{option.badge}</span>}
                                                    {option.recommended && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.color)}`}>{recommendedLabel}</span>}
                                                </div>
                                                {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={14} className="text-accent-primary" strokeWidth={3} /></motion.div>}
                                            </div>
                                            <span className={`text-[11px] block truncate transition-colors ${isSelected && !isLight ? 'text-white/70' : 'text-text-tertiary'}`}>{option.desc}</span>
                                        </div>
                                        {/* Hover Indicator */}
                                        {!isSelected && <div className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-transparent group-hover:ring-border-subtle pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: string;
}

type SttRuntimeChannelStatus = {
    state: 'connected' | 'reconnecting' | 'failed' | 'awaiting-audio';
    provider: string;
    error?: string;
    channel: 'user' | 'interviewer';
    reconnectAttempts?: number;
};

type SttRuntimeStatus = {
    success: boolean;
    provider?: string;
    language?: string;
    configured?: boolean;
    meetingActive?: boolean;
    lastStatus?: {
        user: SttRuntimeChannelStatus | null;
        interviewer: SttRuntimeChannelStatus | null;
    };
    providerHealth?: {
        kind?: string;
        ok?: boolean;
        state?: string;
        label?: string;
        message?: string;
        modelId?: string;
        modelName?: string;
        modelStatus?: string;
        logPath?: string;
        server?: {
            poolAvailable?: number;
            poolTotal?: number;
            reason?: string;
            baseUrl?: string;
        };
        binary?: {
            found?: boolean;
            path?: string | null;
        };
    };
    checkedAt?: string;
    error?: string;
};

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ isOpen, onClose, initialTab = 'general' }) => {
    const { t } = useTranslation();
    const isLight = useResolvedTheme() === 'light';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Sync active tab when modal opens
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);


        }
    }, [isOpen, initialTab]);

    const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
    const [isUndetectable, setIsUndetectable] = useState(false);
    const [isMousePassthrough, setIsMousePassthrough] = useState(false);
    const [disguiseMode, setDisguiseMode] = useState<'terminal' | 'settings' | 'activity' | 'none'>('none');
    const [openOnLogin, setOpenOnLogin] = useState(false);
    const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguagePreference>('system');
    const [interfaceLocales, setInterfaceLocales] = useState<InterfaceLocaleOption[]>([]);
    const [interfaceTranslationsPath, setInterfaceTranslationsPath] = useState('');
    const [isRefreshingInterfaceTranslations, setIsRefreshingInterfaceTranslations] = useState(false);
    const [isInterfaceLanguageDropdownOpen, setIsInterfaceLanguageDropdownOpen] = useState(false);
    const [interfaceLanguageError, setInterfaceLanguageError] = useState<string | null>(null);
    const [isAiLangDropdownOpen, setIsAiLangDropdownOpen] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
    const themeDropdownRef = React.useRef<HTMLDivElement>(null);
    const interfaceLanguageDropdownRef = React.useRef<HTMLDivElement>(null);
    const aiLangDropdownRef = React.useRef<HTMLDivElement>(null);
    const [meetingInterfaceTheme, setMeetingInterfaceThemeState] = useState<MeetingInterfaceTheme>(getMeetingInterfaceTheme);
    const [isInterfaceThemeDropdownOpen, setIsInterfaceThemeDropdownOpen] = useState(false);
    const interfaceThemeDropdownRef = React.useRef<HTMLDivElement>(null);


    const [verboseLogging, setVerboseLogging] = useState(false);
    const [meetingRetention, setMeetingRetention] = useState<'forever' | '7d' | '30d' | 'never'>('forever');
    const [showVerboseToast, setShowVerboseToast] = useState(false);
    const verboseToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const applyInterfaceTranslationsSnapshot = (snapshot?: InterfaceTranslationsSnapshot | null) => {
        setInterfaceLocales(Array.isArray(snapshot?.locales) ? snapshot.locales : []);
        setInterfaceTranslationsPath(typeof snapshot?.translationsPath === 'string' ? snapshot.translationsPath : '');
    };

    // Close dropdown when clicking outside
    // Sync with global state changes
    useEffect(() => {
        if (isOpen) {


            // Fetch true initial state from main process
            window.electronAPI?.getUndetectable?.().then(setIsUndetectable).catch(() => { });
            window.electronAPI?.getOverlayMousePassthrough?.().then(setIsMousePassthrough).catch(() => { });
            window.electronAPI?.getDisguise?.().then(setDisguiseMode).catch(() => { });
            window.electronAPI?.getVerboseLogging?.().then(setVerboseLogging).catch(() => { });
            window.electronAPI?.getMeetingRetention?.().then(setMeetingRetention).catch(() => { });
            window.electronAPI?.getInterfaceTranslations?.()
                .then((snapshot) => {
                    if (snapshot) {
                        applyInterfaceTranslationsSnapshot(snapshot);
                    } else {
                        return window.electronAPI?.getInterfaceLocales?.()
                            .then((locales) => setInterfaceLocales(Array.isArray(locales) ? locales : []));
                    }
                })
                .catch(() => {
                    window.electronAPI?.getInterfaceLocales?.()
                        .then((locales) => setInterfaceLocales(Array.isArray(locales) ? locales : []))
                        .catch(() => { });
                });
            window.electronAPI?.getInterfaceLanguage?.()
                .then((state) => setInterfaceLanguage(state.preference))
                .catch(() => { });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!showVerboseToast) return;
        verboseToastTimerRef.current = setTimeout(() => setShowVerboseToast(false), 5200);
        return () => {
            if (verboseToastTimerRef.current) clearTimeout(verboseToastTimerRef.current);
        };
    }, [showVerboseToast]);



    useEffect(() => {
        if (window.electronAPI?.onUndetectableChanged) {
            const unsubscribe = window.electronAPI.onUndetectableChanged((newState: boolean) => {
                setIsUndetectable(newState);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onMeetingRetentionChanged) {
            const unsubscribe = window.electronAPI.onMeetingRetentionChanged(setMeetingRetention);
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onInterfaceLanguageChanged) {
            const unsubscribe = window.electronAPI.onInterfaceLanguageChanged((state) => {
                setInterfaceLanguage(state.preference);
                setInterfaceLanguageError(null);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onInterfaceTranslationsChanged) {
            const unsubscribe = window.electronAPI.onInterfaceTranslationsChanged(applyInterfaceTranslationsSnapshot);
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onDisguiseChanged) {
            const unsubscribe = window.electronAPI.onDisguiseChanged((newMode: any) => {
                setDisguiseMode(newMode);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onOverlayMousePassthroughChanged) {
            const unsubscribe = window.electronAPI.onOverlayMousePassthroughChanged((enabled: boolean) => {
                setIsMousePassthrough(enabled);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onSttLanguageAutoDetected) {
            const unsubscribe = window.electronAPI.onSttLanguageAutoDetected((bcp47: string) => {
                setAutoDetectedLanguage(bcp47);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
                setIsThemeDropdownOpen(false);
            }
            if (interfaceLanguageDropdownRef.current && !interfaceLanguageDropdownRef.current.contains(event.target as Node)) {
                setIsInterfaceLanguageDropdownOpen(false);
            }
            if (aiLangDropdownRef.current && !aiLangDropdownRef.current.contains(event.target as Node)) {
                setIsAiLangDropdownOpen(false);
            }
            if (interfaceThemeDropdownRef.current && !interfaceThemeDropdownRef.current.contains(event.target as Node)) {
                setIsInterfaceThemeDropdownOpen(false);
            }
        };

        if (isThemeDropdownOpen || isInterfaceLanguageDropdownOpen || isAiLangDropdownOpen || isInterfaceThemeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isThemeDropdownOpen, isInterfaceLanguageDropdownOpen, isAiLangDropdownOpen, isInterfaceThemeDropdownOpen]);

    const [showTranscript, setShowTranscript] = useState(() => {
        const stored = localStorage.getItem('natively_interviewer_transcript');
        return stored !== 'false';
    });

    const [autoScroll, setAutoScroll] = useState(() => {
        const stored = localStorage.getItem('natively_auto_scroll');
        return stored === 'true';
    });

    // Recognition Language
    const [recognitionLanguage, setRecognitionLanguage] = useState('');
    const [selectedSttGroup, setSelectedSttGroup] = useState('');
    const [availableLanguages, setAvailableLanguages] = useState<Record<string, any>>({});
    const [autoDetectedLanguage, setAutoDetectedLanguage] = useState<string | null>(null);

    // AI answer locale
    const [aiResponseLanguage, setAiResponseLanguage] = useState('English');
    const [availableAiLanguages, setAvailableAiLanguages] = useState<any[]>([]);

    // Overlay Opacity state
    const [overlayOpacity, setOverlayOpacity] = useState<number>(() => {
        const stored = localStorage.getItem('natively_overlay_opacity');
        const parsed = stored ? parseFloat(stored) : NaN;
        // Treat missing value or the old default (0.65) as "not user-set"
        const isUserSet = Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
        return isUserSet ? clampOverlayOpacity(parsed) : getDefaultOverlayOpacity();
    });

    // When the theme changes and the user hasn't saved a custom value, reset to theme-aware default
    const resolvedTheme = useResolvedTheme();
    useEffect(() => {
        const stored = localStorage.getItem('natively_overlay_opacity');
        const parsed = stored ? parseFloat(stored) : NaN;
        const isUserSet = Number.isFinite(parsed) && parsed !== OVERLAY_OPACITY_DEFAULT;
        if (!isUserSet) {
            setOverlayOpacity(getDefaultOverlayOpacity());
        }
    }, [resolvedTheme]);


    // Live preview state — true while the user is holding down the slider
    const [isPreviewingOpacity, setIsPreviewingOpacity] = useState(false);
    const [previewOverlayOpacity, setPreviewOverlayOpacity] = useState(overlayOpacity);

    // Ref to hold the latest opacity value without triggering renders during drag
    const latestOpacityRef = React.useRef(overlayOpacity);

    const handleOpacityChange = (val: number) => {
        // DOM-direct updates for 0-lag 60fps drag (bypasses React reconciliation)
        const percentText = `${Math.round(val * 100)}%`;
        document.querySelectorAll('.opacity-percent-label').forEach(el => el.textContent = percentText);
        setPreviewOverlayOpacity(val);
        latestOpacityRef.current = val;

        // Broadcast IPC in real-time so actual meeting overlay tracks slider instantly
        // (safe to do at 60fps, does not trigger React renders)
        window.electronAPI?.setOverlayOpacity?.(val);
    };

    // Bug fix #3: keep latestOpacityRef in sync when overlayOpacity changes outside of a drag
    // (e.g. on first mount, or if another part of code updates it)
    useEffect(() => {
        latestOpacityRef.current = overlayOpacity;
        setPreviewOverlayOpacity(overlayOpacity);
    }, [overlayOpacity]);

    // Bug fix #3 (close-during-drag): if the overlay closes while the user is still dragging,
    // restore all DOM state so nothing is left in a broken state.
    useEffect(() => {
        if (!isOpen && isPreviewingOpacity) {
            stopPreviewingOpacity();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const startPreviewingOpacity = () => {
        // Bug fix #5: guard against rapid repeated calls (double pointerDown / touch events)
        if (isPreviewingOpacity) return;

        // Direct DOM mutation for sub-millisecond instant hide (bypassing slow React tree diffs)
        document.body.classList.add('disable-transitions');

        const backdrop = document.getElementById('settings-backdrop');
        const wrapper = document.getElementById('settings-panel-wrapper');
        const panel = document.getElementById('settings-panel');
        const card = document.getElementById('opacity-slider-card');
        const mockup = document.getElementById('settings-mockup-wrapper');
        const launcher = document.getElementById('launcher-container');

        if (backdrop) {
            backdrop.style.backgroundColor = 'transparent';
            backdrop.style.backdropFilter = 'none';
            backdrop.style.transition = 'none';
        }
        if (wrapper) {
            wrapper.style.backgroundColor = 'transparent';
            wrapper.style.border = 'none';
            wrapper.style.boxShadow = 'none';
        }
        if (panel) {
            panel.style.visibility = 'hidden';
        }
        if (launcher) {
            launcher.style.visibility = 'hidden';
        }

        if (card) {
            card.style.visibility = 'visible';
            card.style.position = 'relative';
            card.style.zIndex = '9999';
        }
        if (mockup) {
            mockup.style.opacity = '1';
        }

        setPreviewOverlayOpacity(latestOpacityRef.current);
        setIsPreviewingOpacity(true);
    };

    const stopPreviewingOpacity = () => {
        // Direct DOM restoration
        document.body.classList.remove('disable-transitions');
        const backdrop = document.getElementById('settings-backdrop');
        const wrapper = document.getElementById('settings-panel-wrapper');
        const panel = document.getElementById('settings-panel');
        const card = document.getElementById('opacity-slider-card');
        const mockup = document.getElementById('settings-mockup-wrapper');
        const launcher = document.getElementById('launcher-container');

        if (backdrop) {
            backdrop.style.backgroundColor = '';
            backdrop.style.backdropFilter = '';
            backdrop.style.transition = '';
        }
        if (wrapper) {
            wrapper.style.backgroundColor = '';
            wrapper.style.border = '';
            wrapper.style.boxShadow = '';
        }
        if (panel) {
            panel.style.visibility = '';
        }
        if (launcher) {
            launcher.style.visibility = '';
        }

        if (card) {
            card.style.visibility = '';
            card.style.position = '';
            card.style.zIndex = '';
        }
        if (mockup) {
            // Bug fix #4: restore mockup to hidden (opacity 0) rather than leaving it visible
            mockup.style.opacity = '0';
        }

        setIsPreviewingOpacity(false);
        // Sync final dragged value back to React state (persists to localStorage + IPC via useEffect)
        setOverlayOpacity(latestOpacityRef.current);
        setPreviewOverlayOpacity(latestOpacityRef.current);
    };

    useEffect(() => {
        // Only persist to localStorage here. IPC is handled real-time in handleOpacityChange
        // to avoid a redundant extra call 150ms after every drag ends.
        const timeoutId = setTimeout(() => {
            localStorage.setItem('natively_overlay_opacity', String(overlayOpacity));
        }, 150);
        return () => clearTimeout(timeoutId);
    }, [overlayOpacity]);

    useEffect(() => {
        const loadLanguages = async () => {
            if (window.electronAPI?.getRecognitionLanguages) {
                const langs = await window.electronAPI.getRecognitionLanguages();
                setAvailableLanguages(langs);

                // Load stored preference or auto-detect
                const storedStt = await window.electronAPI.getSttLanguage();
                let currentLangKey = storedStt;

                if (!currentLangKey) {
                    const systemLocale = navigator.language;
                    // Try to find exact match or primary match
                    const match = Object.entries(langs).find(([_, config]: [string, any]) =>
                        config.bcp47 === systemLocale ||
                        config.iso639 === systemLocale ||
                        (config.alternates && config.alternates.includes(systemLocale))
                    );

                    currentLangKey = match ? match[0] : 'english-us';

                    // Save the auto-detected default
                    if (window.electronAPI?.setRecognitionLanguage) {
                        window.electronAPI.setRecognitionLanguage(currentLangKey);
                    }
                }

                setRecognitionLanguage(currentLangKey);

                // Initialize Group based on current language
                if (langs[currentLangKey]) {
                    setSelectedSttGroup(langs[currentLangKey].group);
                } else {
                    setSelectedSttGroup('English');
                }
            }

            if (window.electronAPI?.getAiResponseLanguages) {
                const aiLangs = await window.electronAPI.getAiResponseLanguages();
                // Sort: Auto first, English second, then alphabetical
                const sortedAiLangs = [...aiLangs].sort((a, b) => {
                    if (a.code === 'auto') return -1;
                    if (b.code === 'auto') return 1;
                    if (a.label === 'English') return -1;
                    if (b.label === 'English') return 1;
                    return a.label.localeCompare(b.label);
                });
                setAvailableAiLanguages(sortedAiLangs);

                const storedAi = await window.electronAPI.getAiResponseLanguage();
                setAiResponseLanguage(storedAi || 'auto');
            }
        };
        loadLanguages();
    }, []);

    const handleLanguageChange = async (key: string) => {
        setRecognitionLanguage(key);
        setAutoDetectedLanguage(null);  // always reset — new session may detect a different language
        if (availableLanguages[key]) {
            setSelectedSttGroup(availableLanguages[key].group);
        }
        if (window.electronAPI?.setRecognitionLanguage) {
            await window.electronAPI.setRecognitionLanguage(key);
        }
    };

    const handleGroupChange = (group: string) => {
        setSelectedSttGroup(group);
        // Find default variant for this group (first one)
        const firstVariant = Object.entries(availableLanguages).find(([_, lang]) => lang.group === group);
        if (firstVariant) {
            handleLanguageChange(firstVariant[0]);
        }
    };

    // Helper to get unique groups
    const languageGroups = Array.from(new Set(Object.values(availableLanguages).map((l: any) => l.group)))
        .sort((a, b) => {
            if (a === 'Auto') return -1;
            if (b === 'Auto') return 1;
            if (a === 'English') return -1;
            if (b === 'English') return 1;
            return a.localeCompare(b);
        });

    // Helper to get variants for current group
    const currentGroupVariants = Object.entries(availableLanguages)

        .filter(([_, lang]) => lang.group === selectedSttGroup)
        .map(([key, lang]) => ({
            deviceId: key,
            label: lang.label,
            kind: 'audioinput' as MediaDeviceKind,
            groupId: '',
            toJSON: () => ({})
        }));

    const handleAiLanguageChange = async (key: string) => {
        if (!key) return;
        const previous = aiResponseLanguage;
        setAiResponseLanguage(key); // Optimistic update
        try {
            if (window.electronAPI?.setAiResponseLanguage) {
                const result = await window.electronAPI.setAiResponseLanguage(key);
                if (result && !result.success) {
                    // Rollback on explicit failure
                    setAiResponseLanguage(previous);
                    console.error('[Settings] Failed to set AI response language:', result.error);
                }
            }
        } catch (err) {
            // Rollback on exception
            setAiResponseLanguage(previous);
            console.error('[Settings] Exception setting AI response language:', err);
        }
    };


    // Sync transcript setting
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('natively_interviewer_transcript');
            setShowTranscript(stored !== 'false');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Sync auto-scroll setting
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('natively_auto_scroll');
            setAutoScroll(stored === 'true');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        // Listen on both `storage` (same-window) and the IPC broadcast (cross-window)
        // so the settings pane reflects the active theme regardless of which window
        // changed it. See ipcHandlers.ts `interface-theme:set` for the relay.
        const handleStorage = () => {
            setMeetingInterfaceThemeState(getMeetingInterfaceTheme());
        };
        window.addEventListener('storage', handleStorage);
        const unsubscribeIpc = window.electronAPI?.onMeetingInterfaceThemeChanged?.((theme) => {
            const valid: MeetingInterfaceTheme[] = ['default', 'liquid-glass', 'modern'];
            if (valid.includes(theme as MeetingInterfaceTheme)) {
                setMeetingInterfaceThemeState(theme as MeetingInterfaceTheme);
            }
        });
        return () => {
            window.removeEventListener('storage', handleStorage);
            unsubscribeIpc?.();
        };
    }, []);

    // Theme Handlers
    const handleSetTheme = async (mode: 'system' | 'light' | 'dark') => {
        setThemeMode(mode);
        if (window.electronAPI?.setThemeMode) {
            await window.electronAPI.setThemeMode(mode);
        }
    };

    const handleInterfaceLanguageChange = async (preference: InterfaceLanguagePreference) => {
        const previous = interfaceLanguage;
        setInterfaceLanguage(preference);
        setInterfaceLanguageError(null);
        try {
            const result = await window.electronAPI?.setInterfaceLanguage?.(preference);
            if (!result?.success) {
                setInterfaceLanguage(previous);
                setInterfaceLanguageError(result?.error || t('settings.general.interfaceLanguageSetError'));
                return;
            }
            if (result.state) {
                setInterfaceLanguage(result.state.preference);
            }
        } catch (error) {
            setInterfaceLanguage(previous);
            setInterfaceLanguageError(error instanceof Error ? error.message : t('settings.general.interfaceLanguageSetError'));
        }
    };

    const handleRefreshInterfaceTranslations = async () => {
        setIsRefreshingInterfaceTranslations(true);
        setInterfaceLanguageError(null);
        try {
            const snapshot = await window.electronAPI?.refreshInterfaceTranslations?.();
            if (snapshot) applyInterfaceTranslationsSnapshot(snapshot);
        } catch (error) {
            setInterfaceLanguageError(error instanceof Error ? error.message : t('settings.general.translationPacksRefreshError'));
        } finally {
            setIsRefreshingInterfaceTranslations(false);
        }
    };

    const handleOpenInterfaceTranslationsFolder = async () => {
        setInterfaceLanguageError(null);
        try {
            const result = await window.electronAPI?.openInterfaceTranslationsFolder?.();
            if (!result?.success) {
                setInterfaceLanguageError(result?.error || t('settings.general.translationPacksOpenError'));
            }
            if (result?.path) setInterfaceTranslationsPath(result.path);
        } catch (error) {
            setInterfaceLanguageError(error instanceof Error ? error.message : t('settings.general.translationPacksOpenError'));
        }
    };

    const selectableInterfaceLocales = (interfaceLocales.length > 0 ? interfaceLocales : [
        { code: 'system', nativeLabel: t('common.system'), label: t('common.system'), description: '', source: 'builtin' as const, coverage: 100, valid: true, errors: [], warnings: [] },
        { code: 'en', nativeLabel: 'English', label: 'English', description: '', source: 'builtin' as const, coverage: 100, valid: true, errors: [], warnings: [] },
        { code: 'ru', nativeLabel: 'Русский', label: 'Russian', description: '', source: 'builtin' as const, coverage: 100, valid: true, errors: [], warnings: [] },
    ]).filter((option) => option.valid !== false);
    const customInterfaceLocales = interfaceLocales.filter((option) => option.source === 'custom');

    // Audio Settings
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedInput, setSelectedInput] = useState('');
    const [selectedOutput, setSelectedOutput] = useState('');
    const [micLevel, setMicLevel] = useState(0);
    const [systemAudioLevel, setSystemAudioLevel] = useState(0);
    const [systemAudioTestError, setSystemAudioTestError] = useState<string | null>(null);
    const [useExperimentalSck, setUseExperimentalSck] = useState(false);
    // Most-recent device fallback notice. Populated by main process via
    // 'device-selection-applied' IPC when the saved device couldn't be opened
    // and the audio pipeline silently fell back to the system default.
    const [deviceFallbackNotice, setDeviceFallbackNotice] = useState<{
        kind: 'input' | 'output';
        requested: string | null;
        actual: string | null;
        reason?: string;
    } | null>(null);

    // STT Provider settings
    const [sttProvider, setSttProvider] = useState<'none' | 'google' | 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox' | 'local-whisper' | 'gigastt'>('none');
    const [groqSttModel, setGroqSttModel] = useState('whisper-large-v3-turbo');
    const [sttGroqKey, setSttGroqKey] = useState('');
    const [sttOpenaiKey, setSttOpenaiKey] = useState('');
    const [sttDeepgramKey, setSttDeepgramKey] = useState('');
    const [sttElevenLabsKey, setSttElevenLabsKey] = useState('');
    const [sttAzureKey, setSttAzureKey] = useState('');
    const [sttAzureRegion, setSttAzureRegion] = useState('eastus');
    const [sttIbmKey, setSttIbmKey] = useState('');
    const [sttOpenaiBaseUrl, setSttOpenaiBaseUrl] = useState('');
    const [sttTestStatus, setSttTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [sttTestError, setSttTestError] = useState('');
    const [sttSaving, setSttSaving] = useState(false);
    const [sttSaved, setSttSaved] = useState(false);
    const [googleServiceAccountPath, setGoogleServiceAccountPath] = useState<string | null>(null);
    const [hasStoredSttGroqKey, setHasStoredSttGroqKey] = useState(false);
    const [hasStoredSttOpenaiKey, setHasStoredSttOpenaiKey] = useState(false);
    const [hasStoredDeepgramKey, setHasStoredDeepgramKey] = useState(false);
    const [hasStoredElevenLabsKey, setHasStoredElevenLabsKey] = useState(false);
    const [hasStoredAzureKey, setHasStoredAzureKey] = useState(false);
    const [hasStoredIbmWatsonKey, setHasStoredIbmWatsonKey] = useState(false);
    const [sttSonioxKey, setSttSonioxKey] = useState('');
    const [hasStoredSonioxKey, setHasStoredSonioxKey] = useState(false);
    const [isSttDropdownOpen, setIsSttDropdownOpen] = useState(false);
    const [sttRuntimeStatus, setSttRuntimeStatus] = useState<SttRuntimeStatus | null>(null);
    const [sttRuntimeLoading, setSttRuntimeLoading] = useState(false);
    const sttDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close STT dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sttDropdownRef.current && !sttDropdownRef.current.contains(event.target as Node)) {
                setIsSttDropdownOpen(false);
            }
        };
        if (isSttDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSttDropdownOpen]);

    // Load STT settings on mount
    useEffect(() => {
        const loadSttSettings = async () => {
            try {
                // @ts-ignore
                const creds = await window.electronAPI?.getStoredCredentials?.();
                if (creds) {
                    setSttProvider(sanitizeSttProvider(creds.sttProvider));
                    if (creds.groqSttModel) setGroqSttModel(creds.groqSttModel);
                    setGoogleServiceAccountPath(creds.googleServiceAccountPath);
                    setHasStoredSttGroqKey(creds.hasSttGroqKey);
                    setHasStoredSttOpenaiKey(creds.hasSttOpenaiKey);
                    setHasStoredDeepgramKey(creds.hasDeepgramKey);
                    setHasStoredElevenLabsKey(creds.hasElevenLabsKey);
                    setHasStoredAzureKey(creds.hasAzureKey);
                    if (creds.azureRegion) setSttAzureRegion(creds.azureRegion);
                    setHasStoredIbmWatsonKey(creds.hasIbmWatsonKey);
                    setHasStoredSonioxKey(creds.hasSonioxKey || false);

                    // Populate key fields so switching providers doesn't make saved keys appear gone
                    if (creds.sttGroqKey) setSttGroqKey(creds.sttGroqKey);
                    if (creds.sttOpenaiKey) setSttOpenaiKey(creds.sttOpenaiKey);
                    if (creds.sttDeepgramKey) setSttDeepgramKey(creds.sttDeepgramKey);
                    if (creds.sttElevenLabsKey) setSttElevenLabsKey(creds.sttElevenLabsKey);
                    if (creds.sttAzureKey) setSttAzureKey(creds.sttAzureKey);
                    if (creds.sttIbmKey) setSttIbmKey(creds.sttIbmKey);
                    if (creds.sttSonioxKey) setSttSonioxKey(creds.sttSonioxKey);
                    if (typeof creds.openAiSttBaseUrl === 'string') setSttOpenaiBaseUrl(creds.openAiSttBaseUrl);
                }
            } catch (e) {
                console.error('Failed to load STT settings:', e);
            }
        };
        if (isOpen) loadSttSettings();
    }, [isOpen]);

    // PR #173: Live-reload settings whenever the backend broadcasts a credentials change
    // (e.g., when the user saves an STT key in a different window, or main fires it after
    // a provider auto-reconfigure like a hosted-key clear).
    useEffect(() => {
        if (!window.electronAPI?.onCredentialsChanged) return;
        const unsubscribe = window.electronAPI.onCredentialsChanged(() => {
            if (isOpen) {
                // Re-fetch credentials silently — purely additive, no state reset
                window.electronAPI?.getStoredCredentials?.().then((creds: any) => {
                    if (!creds) return;
                    setSttProvider(sanitizeSttProvider(creds.sttProvider));
                    if (creds.groqSttModel) setGroqSttModel(creds.groqSttModel);
                    setHasStoredSttGroqKey(creds.hasSttGroqKey);
                    setHasStoredSttOpenaiKey(creds.hasSttOpenaiKey);
                    setHasStoredDeepgramKey(creds.hasDeepgramKey);
                    setHasStoredElevenLabsKey(creds.hasElevenLabsKey);
                    setHasStoredAzureKey(creds.hasAzureKey);
                    setHasStoredIbmWatsonKey(creds.hasIbmWatsonKey);
                    setHasStoredSonioxKey(creds.hasSonioxKey || false);
                }).catch(() => { /* silently ignore */ });
            }
        });
        return () => unsubscribe();
    }, []); // mount-once: isOpen is checked inside the callback

    const refreshSttRuntimeStatus = React.useCallback(async () => {
        if (!window.electronAPI?.getSttRuntimeStatus) return;
        setSttRuntimeLoading(true);
        try {
            const status = await window.electronAPI.getSttRuntimeStatus();
            setSttRuntimeStatus(status);
        } catch (e: any) {
            setSttRuntimeStatus({
                success: false,
                error: e?.message || 'Failed to read STT runtime status',
            });
        } finally {
            setSttRuntimeLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || activeTab !== 'audio') return;
        refreshSttRuntimeStatus();
        const timer = window.setInterval(refreshSttRuntimeStatus, 3500);
        return () => window.clearInterval(timer);
    }, [isOpen, activeTab, sttProvider, refreshSttRuntimeStatus]);

    useEffect(() => {
        if (!window.electronAPI?.onSttStatusChanged) return;
        const unsubscribe = window.electronAPI.onSttStatusChanged((data) => {
            setSttRuntimeStatus((prev) => {
                const next: SttRuntimeStatus = prev ?? { success: true, lastStatus: { user: null, interviewer: null } };
                const lastStatus = {
                    user: next.lastStatus?.user ?? null,
                    interviewer: next.lastStatus?.interviewer ?? null,
                };
                lastStatus[data.channel] = data as SttRuntimeChannelStatus;
                return { ...next, lastStatus, provider: data.provider };
            });
        });
        return () => unsubscribe();
    }, []);

    const handleSttProviderChange = async (provider: 'none' | 'google' | 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox' | 'local-whisper' | 'gigastt') => {
        setSttProvider(provider);
        setIsSttDropdownOpen(false);
        setSttTestStatus('idle');
        setSttTestError('');
        try {
            // @ts-ignore
            await window.electronAPI?.setSttProvider?.(provider);
            refreshSttRuntimeStatus();
        } catch (e) {
            console.error('Failed to set STT provider:', e);
        }
    };

    const handleSttKeySubmit = async (provider: 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox', key: string) => {
        if (!key.trim()) return;

        // Auto-test before saving
        setSttSaving(true);
        setSttTestStatus('testing');
        setSttTestError('');

        try {
            // @ts-ignore
            const testResult = await window.electronAPI?.testSttConnection?.(
                provider,
                key.trim(),
                provider === 'azure' ? sttAzureRegion : undefined
            );

            if (!testResult?.success) {
                setSttTestStatus('error');
                setSttTestError(testResult?.error || 'Validation failed. Key not saved.');
                setSttSaving(false);
                return; // Stop save
            }

            // If success, proceed to save
            setSttTestStatus('success');
            setTimeout(() => setSttTestStatus('idle'), 3000);

            if (provider === 'groq') {
                // @ts-ignore
                await window.electronAPI?.setGroqSttApiKey?.(key.trim());
            } else if (provider === 'openai') {
                // @ts-ignore
                await window.electronAPI?.setOpenAiSttApiKey?.(key.trim());
            } else if (provider === 'elevenlabs') {
                // @ts-ignore
                await window.electronAPI?.setElevenLabsApiKey?.(key.trim());
            } else if (provider === 'azure') {
                // @ts-ignore
                await window.electronAPI?.setAzureApiKey?.(key.trim());
            } else if (provider === 'ibmwatson') {
                // @ts-ignore
                await window.electronAPI?.setIbmWatsonApiKey?.(key.trim());
            } else if (provider === 'soniox') {
                // @ts-ignore
                await window.electronAPI?.setSonioxApiKey?.(key.trim());
            } else {
                // @ts-ignore
                await window.electronAPI?.setDeepgramApiKey?.(key.trim());
            }
            if (provider === 'groq') setHasStoredSttGroqKey(true);
            else if (provider === 'openai') setHasStoredSttOpenaiKey(true);
            else if (provider === 'elevenlabs') setHasStoredElevenLabsKey(true);
            else if (provider === 'azure') setHasStoredAzureKey(true);
            else if (provider === 'ibmwatson') setHasStoredIbmWatsonKey(true);
            else if (provider === 'soniox') setHasStoredSonioxKey(true);
            else setHasStoredDeepgramKey(true);

            setSttSaved(true);
            setTimeout(() => setSttSaved(false), 2000);
        } catch (e: any) {
            console.error(`Failed to save ${provider} STT key:`, e);
            setSttTestStatus('error');
            setSttTestError(e.message || 'Validation failed');
        } finally {
            setSttSaving(false);
        }
    };

    const handleRemoveSttKey = async (provider: 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox') => {
        if (!confirm(`Are you sure you want to remove the ${provider === 'ibmwatson' ? 'IBM Watson' : provider.charAt(0).toUpperCase() + provider.slice(1)} API key?`)) return;

        try {
            if (provider === 'groq') {
                // @ts-ignore
                await window.electronAPI?.setGroqSttApiKey?.('');
                setSttGroqKey('');
                setHasStoredSttGroqKey(false);
            } else if (provider === 'openai') {
                // @ts-ignore
                await window.electronAPI?.setOpenAiSttApiKey?.('');
                setSttOpenaiKey('');
                setHasStoredSttOpenaiKey(false);
            } else if (provider === 'elevenlabs') {
                // @ts-ignore
                await window.electronAPI?.setElevenLabsApiKey?.('');
                setSttElevenLabsKey('');
                setHasStoredElevenLabsKey(false);
            } else if (provider === 'azure') {
                // @ts-ignore
                await window.electronAPI?.setAzureApiKey?.('');
                setSttAzureKey('');
                setHasStoredAzureKey(false);
            } else if (provider === 'ibmwatson') {
                // @ts-ignore
                await window.electronAPI?.setIbmWatsonApiKey?.('');
                setSttIbmKey('');
                setHasStoredIbmWatsonKey(false);
            } else if (provider === 'soniox') {
                // @ts-ignore
                await window.electronAPI?.setSonioxApiKey?.('');
                setSttSonioxKey('');
                setHasStoredSonioxKey(false);
            } else {
                // @ts-ignore
                await window.electronAPI?.setDeepgramApiKey?.('');
                setSttDeepgramKey('');
                setHasStoredDeepgramKey(false);
            }
        } catch (e) {
            console.error(`Failed to remove ${provider} STT key:`, e);
        }
    };

    const handleRemoveTavilyKey = async () => {
        if (!confirm('Are you sure you want to remove the Tavily API Key?')) return;

        try {
            await window.electronAPI?.setTavilyApiKey?.('');


        } catch (e) {
            console.error('Failed to remove Tavily API key:', e);
        }
    };

    const handleTestSttConnection = async () => {
        if (sttProvider === 'none' || sttProvider === 'google' || sttProvider === 'local-whisper' || sttProvider === 'gigastt') return;
        const keyMap: Record<string, string> = {
            groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
            elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
            soniox: sttSonioxKey,
        };
        const keyToTest = keyMap[sttProvider] || '';
        if (!keyToTest.trim()) {
            setSttTestStatus('error');
            setSttTestError('Please enter an API key first');
            return;
        }

        setSttTestStatus('testing');
        setSttTestError('');
        try {
            // @ts-ignore
            const result = await window.electronAPI?.testSttConnection?.(
                sttProvider,
                keyToTest.trim(),
                sttProvider === 'azure' ? sttAzureRegion : undefined
            );
            if (result?.success) {
                setSttTestStatus('success');
                setTimeout(() => setSttTestStatus('idle'), 3000);
            } else {
                setSttTestStatus('error');
                setSttTestError(result?.error || 'Connection failed');
            }
        } catch (e: any) {
            setSttTestStatus('error');
            setSttTestError(e.message || 'Test failed');
        }
    };


    const [calendarStatus, setCalendarStatus] = useState<CalendarStatusResult>(EMPTY_CALENDAR_STATUS);
    const [isCalendarsLoading, setIsCalendarsLoading] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
    const [isCalendarRefreshing, setIsCalendarRefreshing] = useState(false);


    // Load stored credentials on mount




    const handleCheckForUpdates = async () => {
        if (updateStatus === 'checking') return;
        setUpdateStatus('checking');
        try {
            await window.electronAPI.checkForUpdates();
        } catch (error) {
            console.error("Failed to check for updates:", error);
            setUpdateStatus('error');
            setTimeout(() => setUpdateStatus('idle'), 3000);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const unsubs = [
            window.electronAPI.onUpdateChecking(() => {
                setUpdateStatus('checking');
            }),
            window.electronAPI.onUpdateAvailable(() => {
                setUpdateStatus('available');
                // Don't close settings - let user see the button change to "Update Available"
            }),
            window.electronAPI.onUpdateNotAvailable(() => {
                setUpdateStatus('uptodate');
                setTimeout(() => setUpdateStatus('idle'), 3000);
            }),
            window.electronAPI.onUpdateError((err) => {
                console.error('[Settings] Update error:', err);
                setUpdateStatus('error');
                setTimeout(() => setUpdateStatus('idle'), 3000);
            })
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [isOpen, onClose]);



    useEffect(() => {
        if (isOpen) {
            // Load detectable status
            if (window.electronAPI?.getUndetectable) {
                window.electronAPI.getUndetectable().then(setIsUndetectable);
            }
            if (window.electronAPI?.getOpenAtLogin) {
                window.electronAPI.getOpenAtLogin().then(setOpenOnLogin);
            }
            if (window.electronAPI?.getThemeMode) {
                window.electronAPI.getThemeMode().then(({ mode }) => setThemeMode(mode));
            }

            // Load settings
            const loadDevices = async () => {
                try {
                    const [inputs, outputs] = await Promise.all([
                        // @ts-ignore
                        window.electronAPI?.getInputDevices() || Promise.resolve([]),
                        // @ts-ignore
                        window.electronAPI?.getOutputDevices() || Promise.resolve([])
                    ]);

                    // Map to shape compatible with CustomSelect (which expects MediaDeviceInfo-like objects)
                    const formatDevices = (devs: any[]) => devs.map(d => ({
                        deviceId: d.id,
                        label: d.name,
                        kind: 'audioinput' as MediaDeviceKind,
                        groupId: '',
                        toJSON: () => d
                    }));

                    setInputDevices(formatDevices(inputs));
                    setOutputDevices(formatDevices(outputs));

                    // Load saved preferences
                    const savedInput = localStorage.getItem('preferredInputDeviceId');
                    const savedOutput = localStorage.getItem('preferredOutputDeviceId');

                    if (savedInput && inputs.find((d: any) => d.id === savedInput)) {
                        setSelectedInput(savedInput);
                    } else if (inputs.length > 0 && !selectedInput) {
                        setSelectedInput(inputs[0].id);
                    }

                    if (savedOutput && outputs.find((d: any) => d.id === savedOutput)) {
                        setSelectedOutput(savedOutput);
                    } else if (outputs.length > 0 && !selectedOutput) {
                        setSelectedOutput(outputs[0].id);
                    }
                } catch (e) {
                    console.error("Error loading native devices:", e);
                }
            };
            loadDevices();

            // Load Experimental SCK pref
            const savedSck = localStorage.getItem('useExperimentalSckBackend') === 'true';
            setUseExperimentalSck(savedSck);

            // Load Calendar Status
            if (window.electronAPI?.getCalendarStatus) {
                window.electronAPI.getCalendarStatus().then(setCalendarStatus);
            }
        }
    }, [isOpen, selectedInput, selectedOutput]); // Re-run if isOpen changes, or if selected devices are cleared

    // Fetch upcoming calendar events while the Calendar tab is open and connected.
    // Polls every 60s to mirror the Launcher's cadence.
    useEffect(() => {
        if (!isOpen || activeTab !== 'calendar' || !calendarStatus.connected) return;
        if (!window.electronAPI?.getUpcomingEvents) return;

        let cancelled = false;
        const fetchEvents = () => {
            window.electronAPI.getUpcomingEvents()
                .then(events => { if (!cancelled) setCalendarEvents(events || []); })
                .catch(err => console.error('[Settings] Failed to fetch upcoming events:', err));
        };
        fetchEvents();
        const interval = setInterval(fetchEvents, 60_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [isOpen, activeTab, calendarStatus.connected]);

    // Listen for device-selection-applied so the user can see when their saved
    // device couldn't be opened and audio fell back to the system default.
    // Pre-fix this was silent: settings showed "AirPods" selected but capture
    // was actually using the built-in mic, leaving users to wonder why their
    // device choice "doesn't work".
    useEffect(() => {
        if (!window.electronAPI?.onDeviceSelectionApplied) return;
        const unsubscribe = window.electronAPI.onDeviceSelectionApplied((payload) => {
            if (payload.fellBack) {
                setDeviceFallbackNotice({
                    kind: payload.kind,
                    requested: payload.requested,
                    actual: payload.actual,
                    reason: payload.reason,
                });
            } else {
                // Successful apply for this kind — clear any stale notice that
                // pointed at the same channel.
                setDeviceFallbackNotice(prev =>
                    prev && prev.kind === payload.kind ? null : prev
                );
            }
        });
        return unsubscribe;
    }, []);

    // Use the native mic test path so device IDs stay consistent with the meeting runtime.
    // Guard: only start when selectedInput is populated (loadDevices sets it after device enum).
    // No else branch: cleanup in the return function handles stopAudioTest when this effect
    // unmounts (tab switch, settings close, selectedInput change). Avoids redundant stop calls
    // on every render where activeTab !== 'audio'.
    useEffect(() => {
        if (isOpen && activeTab === 'audio' && selectedInput) {
            const unsubscribe = window.electronAPI?.onAudioTestLevel?.((level) => {
                setMicLevel(Math.max(0, Math.min(100, level * 100)));
            });
            const unsubscribeSystemLevel = window.electronAPI?.onAudioTestSystemLevel?.((level) => {
                setSystemAudioLevel(Math.max(0, Math.min(100, level * 100)));
                setSystemAudioTestError(null);
            });
            const unsubscribeSystemError = window.electronAPI?.onAudioTestSystemError?.((errorMessage) => {
                setSystemAudioLevel(0);
                setSystemAudioTestError(errorMessage);
            });

            window.electronAPI?.startAudioTest(selectedInput).catch((error) => {
                console.error("Error starting native microphone test:", error);
                setMicLevel(0);
                setSystemAudioLevel(0);
            });

            return () => {
                unsubscribe?.();
                unsubscribeSystemLevel?.();
                unsubscribeSystemError?.();
                window.electronAPI?.stopAudioTest?.().catch((error) => {
                    console.error("Error stopping native microphone test:", error);
                });
                setMicLevel(0);
                setSystemAudioLevel(0);
                setSystemAudioTestError(null);
            };
        }
        // Effect didn't run (activeTab !== 'audio' or isOpen === false or selectedInput empty).
        // Reset meter but do NOT call stopAudioTest — cleanup above handles it when test was running.
        setMicLevel(0);
        setSystemAudioLevel(0);
        setSystemAudioTestError(null);
    }, [isOpen, activeTab, selectedInput]);

    const getSttStateClass = (state?: string) => {
        if (state === 'connected' || state === 'ready' || state === 'busy') {
            return 'text-green-500 bg-green-500/10 border-green-500/20';
        }
        if (state === 'awaiting-audio' || state === 'starting' || state === 'unknown') {
            return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        }
        if (state === 'reconnecting') {
            return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        }
        if (state === 'failed' || state === 'error' || state === 'missing' || state === 'not-running' || state === 'not-configured') {
            return 'text-red-500 bg-red-500/10 border-red-500/20';
        }
        return 'text-text-tertiary bg-bg-input border-border-subtle';
    };

    const renderRuntimePill = (label: string, state?: string, detail?: string) => (
        <div className={`rounded-lg border px-3 py-2 min-h-[58px] ${getSttStateClass(state)}`}>
            <div className="text-[10px] uppercase font-semibold tracking-wide opacity-75">{label}</div>
            <div className="text-xs font-semibold mt-1 capitalize">{state ? state.replace(/-/g, ' ') : 'No data'}</div>
            {detail && <div className="text-[10px] mt-0.5 opacity-75 truncate">{detail}</div>}
        </div>
    );

    const runtimeHealth = sttRuntimeStatus?.providerHealth;
    const runtimePool =
        typeof runtimeHealth?.server?.poolAvailable === 'number' &&
        typeof runtimeHealth?.server?.poolTotal === 'number'
            ? `${runtimeHealth.server.poolAvailable}/${runtimeHealth.server.poolTotal}`
            : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    id="settings-backdrop"
                    className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 lg:p-8 transition-colors duration-150 ${isPreviewingOpacity ? 'bg-transparent backdrop-blur-none' : 'bg-black/75 backdrop-blur-[2px]'}`}
                >
                    <motion.div
                        id="settings-panel-wrapper"
                        initial={{ scale: 0.94, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.94, opacity: 0, y: 20 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                            mass: 1
                        }}
                        className="bg-bg-elevated w-full max-w-5xl h-[calc(100dvh-16px)] max-h-[80vh] min-h-0 rounded-2xl border border-border-subtle shadow-2xl overflow-hidden relative sm:h-[80vh]"
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t('common.close')}
                            title={t('common.close')}
                            className="absolute right-2 top-2 z-[5] inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated/95 text-text-secondary shadow-lg shadow-black/20 transition hover:bg-bg-item-active hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60 sm:right-3 sm:top-3"
                        >
                            <X size={18} />
                        </button>
                        <div
                            id="settings-panel"
                            className="flex w-full h-full min-w-0"
                            style={{ visibility: isPreviewingOpacity ? 'hidden' : 'visible' }}
                        >
                        {/* Sidebar */}
                        <div className="w-56 shrink-0 bg-bg-sidebar flex flex-col border-r border-border-subtle overflow-y-auto xl:w-64">
                            <div className="p-6">
                                <h2 className="font-semibold text-gray-400 text-xs uppercase tracking-wider mb-2">{t('settings.sidebar.title')}</h2>
                                <nav className="space-y-1">
                                    <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{t('settings.sidebar.groups.core')}</div>
                                    <button type="button"
                                        onClick={() => setActiveTab('general')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'general' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Monitor size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.general')}</span>
                                    </button>
                                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{t('settings.sidebar.groups.aiData')}</div>
                                    <button type="button"
                                        onClick={() => setActiveTab('ai-providers')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'ai-providers' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <FlaskConical size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.aiProviders')}</span>
                                    </button>
                                    <button type="button"
                                        onClick={() => setActiveTab('skills')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'skills' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Sparkles size={16} className={`shrink-0 ${activeTab === 'skills' ? 'text-accent-primary' : 'text-text-secondary'}`} /> <span className="min-w-0 truncate">{t('settings.sidebar.skills')}</span>
                                    </button>
                                    <button type="button"
                                        onClick={() => setActiveTab('intelligence')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'intelligence' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Cpu size={16} className={`shrink-0 ${activeTab === 'intelligence' ? 'text-accent-primary' : ''}`} /> <span className="min-w-0 truncate">{t('settings.sidebar.intelligence')}</span>
                                    </button>
                                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{t('settings.sidebar.groups.setup')}</div>
                                    <button type="button"
                                        onClick={() => setActiveTab('calendar')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'calendar' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Calendar size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.calendar')}</span>
                                    </button>
                                    <button type="button"
                                        onClick={() => setActiveTab('audio')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'audio' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Mic size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.audio')}</span>
                                    </button>
                                    <button type="button"
                                        onClick={() => setActiveTab('keybinds')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'keybinds' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Keyboard size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.keybinds')}</span>
                                    </button>

                                    <button type="button"
                                        onClick={() => setActiveTab('phone-mirror')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'phone-mirror' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Smartphone size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.phoneMirror')}</span>
                                    </button>

                                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{t('settings.sidebar.groups.support')}</div>
                                    <button type="button"
                                        onClick={() => setActiveTab('help')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-3 ${activeTab === 'help' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <HelpCircle size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.setupHelp')}</span>
                                    </button>

                                    <button type="button"
                                        onClick={() => setActiveTab('about')}
                                        className={`w-full min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'about' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Info size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.about')}</span>
                                    </button>
                                </nav>
                            </div>

                            <div className="mt-auto p-6 border-t border-border-subtle">
                                <button type="button"
                                    onClick={() => window.electronAPI.quitApp()}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                                >
                                    <LogOut size={16} className="shrink-0" /> <span className="min-w-0 truncate">{t('settings.sidebar.quit')}</span>
                                </button>
                                <button type="button" onClick={onClose} className="group mt-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors flex items-center gap-3">
                                    <X size={18} className="shrink-0 transition-colors group-hover:text-red-500" /> <span className="min-w-0 truncate">{t('common.close')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1 bg-bg-main overflow-y-auto p-5 sm:p-6 lg:p-8 relative">
                            {activeTab === 'general' && (
                                <div className="space-y-6 animated fadeIn">
                                    <div className="space-y-3.5">
                                        {/* UndetectableToggle */}
                                        <div className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-5 border border-border-subtle flex items-center justify-between transition-all ${isUndetectable ? 'shadow-lg shadow-blue-500/10' : ''}`}>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {isUndetectable ? (
                                                        <svg
                                                            width="18"
                                                            height="18"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="text-text-primary"
                                                        >
                                                            <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" fill="currentColor" stroke="currentColor" />
                                                            <path d="M9 10h.01" stroke="var(--bg-item-surface)" strokeWidth="2.5" />
                                                            <path d="M15 10h.01" stroke="var(--bg-item-surface)" strokeWidth="2.5" />
                                                        </svg>
                                                    ) : (
                                                        <Ghost size={18} className="text-text-primary" />
                                                    )}
                                                    <h3 className="text-lg font-bold text-text-primary">{isUndetectable ? t('settings.general.undetectableTitle') : t('settings.general.detectableTitle')}</h3>
                                                </div>
                                                <p className="text-xs text-text-secondary">
                                                    {t('settings.general.undetectableStatus', { state: isUndetectable ? t('settingsPopup.undetectable').toLowerCase() : t('settingsPopup.detectable').toLowerCase() })}
                                                </p>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    const newState = !isUndetectable;
                                                    setIsUndetectable(newState);
                                                    window.electronAPI?.setUndetectable(newState);
                                                    // Analytics: Undetectable Mode Toggle
                                                    analytics.trackModeSelected(newState ? 'undetectable' : 'overlay');
                                                }}
                                                className={`w-11 h-6 rounded-full relative transition-colors ${isUndetectable ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isUndetectable ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        {/* Mouse Passthrough Toggle — Adapted from public PR #113 */}
                                        <div className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-5 border border-border-subtle flex items-center justify-between transition-all ${isMousePassthrough ? 'shadow-lg shadow-sky-500/10' : ''}`}>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <PointerOff size={18} className={isMousePassthrough ? 'text-sky-400' : 'text-text-primary'} />
                                                    <h3 className="text-lg font-bold text-text-primary">{t('settings.general.mousePassthroughTitle')}</h3>
                                                </div>
                                                <p className="text-xs text-text-secondary">
                                                    {t('settings.general.mousePassthroughDescription')}
                                                </p>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    const newState = !isMousePassthrough;
                                                    setIsMousePassthrough(newState);
                                                    window.electronAPI?.setOverlayMousePassthrough(newState);
                                                }}
                                                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${isMousePassthrough ? 'bg-sky-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isMousePassthrough ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary mb-1">{t('settings.general.title')}</h3>
                                            <p className="text-xs text-text-secondary mb-2">{t('settings.general.subtitle')}</p>

                                            <div className={`rounded-xl border ${isLight ? 'bg-bg-card border-border-subtle divide-y divide-border-subtle' : 'bg-transparent border-transparent divide-y divide-border-subtle/20'}`}>
                                            <div className="space-y-0">
                                                {/* Open at Login */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            openOnLogin
                                                                ? isLight
                                                                    ? 'border-indigo-500/30 text-indigo-600 bg-indigo-50/50'
                                                                    : 'border-indigo-500/40 text-indigo-400 bg-indigo-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Power size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.openAtLoginTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t('settings.general.openAtLoginDescription')}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !openOnLogin;
                                                            setOpenOnLogin(newState);
                                                            window.electronAPI?.setOpenAtLogin(newState);
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors ${openOnLogin ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${openOnLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Meeting Retention */}
                                                <div className="flex flex-wrap items-start justify-between px-4 py-3 gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            meetingRetention === 'never'
                                                                ? isLight
                                                                    ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50/50'
                                                                    : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Shield size={20} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.doNotSaveMeetingsTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5 leading-normal">{t('settings.general.doNotSaveMeetingsDescription')}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const nextRetention = meetingRetention === 'never' ? 'forever' : 'never';
                                                            setMeetingRetention(nextRetention);
                                                            window.electronAPI?.setMeetingRetention?.(nextRetention);
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 mt-2 ${meetingRetention === 'never' ? 'bg-emerald-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                        role="switch"
                                                        aria-checked={meetingRetention === 'never'}
                                                        aria-label={t('settings.general.doNotSaveMeetingsTitle')}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${meetingRetention === 'never' ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Debug Logging */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            verboseLogging
                                                                ? isLight
                                                                    ? 'border-amber-500/30 text-amber-600 bg-amber-50/50'
                                                                    : 'border-amber-500/40 text-amber-400 bg-amber-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Terminal size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.verboseLoggingTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t('settings.general.verboseLoggingDescription')}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !verboseLogging;
                                                            setVerboseLogging(newState);
                                                            window.electronAPI?.setVerboseLogging?.(newState);
                                                            if (newState) {
                                                                setShowVerboseToast(true);
                                                            }
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${verboseLogging ? 'bg-amber-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${verboseLogging ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Verbose logging toast */}
                                                <AnimatePresence>
                                                    {showVerboseToast && (
                                                        <motion.div
                                                            key="verbose-toast"
                                                            initial={{ opacity: 0, y: -6, height: 0 }}
                                                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                                                            exit={{ opacity: 0, y: -4, height: 0 }}
                                                            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                                                            className="mx-4 mb-1 overflow-hidden"
                                                        >
                                                            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <Terminal size={14} className="text-amber-400 shrink-0" />
                                                                    <p className="text-xs text-amber-200/80 leading-snug truncate">
                                                                        {t('settings.general.logFileHint')} <span className="font-mono text-amber-300">~/Documents/openoffer_debug.log</span>
                                                                    </p>
                                                                </div>
                                                                <button type="button"
                                                                    onClick={() => window.electronAPI?.openLogFile?.()}
                                                                    className="shrink-0 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25"
                                                                >
                                                                    {t('settings.general.openLogFile')}
                                                                </button>
                                                            </div>
                                                            {/* 5-second drain bar */}
                                                            <motion.div
                                                                className="h-[2px] bg-amber-500/40 rounded-b-xl"
                                                                initial={{ scaleX: 1, originX: 0 }}
                                                                animate={{ scaleX: 0 }}
                                                                transition={{ duration: 5, ease: 'linear', delay: 0.2 }}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Interviewer Transcript */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            showTranscript
                                                                ? isLight
                                                                    ? 'border-blue-500/30 text-blue-600 bg-blue-50/50'
                                                                    : 'border-blue-500/40 text-blue-400 bg-blue-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <MessageSquare size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.interviewerTranscriptTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t('settings.general.interviewerTranscriptDescription')}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !showTranscript;
                                                            setShowTranscript(newState);
                                                            localStorage.setItem('natively_interviewer_transcript', String(newState));
                                                            window.dispatchEvent(new Event('storage'));
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors ${showTranscript ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showTranscript ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Auto Scroll */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            autoScroll
                                                                ? isLight
                                                                    ? 'border-purple-500/30 text-purple-600 bg-purple-50/50'
                                                                    : 'border-purple-500/40 text-purple-400 bg-purple-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <ArrowDown size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.autoScrollTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t('settings.general.autoScrollDescription')}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !autoScroll;
                                                            setAutoScroll(newState);
                                                            localStorage.setItem('natively_auto_scroll', String(newState));
                                                            window.dispatchEvent(new Event('storage'));
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${autoScroll ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoScroll ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>


                                                {/* Interface Language */}
                                                <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            interfaceLanguage !== 'system'
                                                                ? isLight
                                                                    ? 'border-cyan-500/30 text-cyan-600 bg-cyan-50/50'
                                                                    : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Globe size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.interfaceLanguageTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5 leading-normal max-w-[460px]">{t('settings.general.interfaceLanguageDescription')}</p>
                                                            {interfaceLanguageError && (
                                                                <p className="text-[11px] text-red-400 mt-1">{interfaceLanguageError}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="relative w-full shrink-0 lg:w-auto" ref={interfaceLanguageDropdownRef}>
                                                        <button type="button"
                                                            onClick={() => setIsInterfaceLanguageDropdownOpen(!isInterfaceLanguageDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex w-full items-center gap-2 justify-between lg:min-w-[150px]"
                                                        >
                                                            <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                                                                {interfaceLanguage === 'system'
                                                                    ? t('common.system')
                                                                    : interfaceLocales.find((locale) => locale.code === interfaceLanguage)?.nativeLabel ?? interfaceLanguage}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isInterfaceLanguageDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {isInterfaceLanguageDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 min-w-full w-max bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none">
                                                                {selectableInterfaceLocales.map((option, index) => (
                                                                    <button type="button"
                                                                        key={`${option.source}:${option.code}:${index}`}
                                                                        onClick={() => {
                                                                            void handleInterfaceLanguageChange(option.code);
                                                                            setIsInterfaceLanguageDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${interfaceLanguage === option.code ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        <span className="font-medium">{option.code === 'system' ? t('common.system') : option.nativeLabel}</span>
                                                                        {option.source === 'custom' && (
                                                                            <span className="ml-auto text-[10px] text-text-tertiary">{option.coverage ?? 0}%</span>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Translation Packs */}
                                                <div className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="flex items-start gap-4 min-w-0">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle text-text-tertiary flex items-center justify-center shrink-0">
                                                            <Languages size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.translationPacksTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5 leading-normal max-w-[520px]">{t('settings.general.translationPacksDescription')}</p>
                                                            {interfaceTranslationsPath && (
                                                                <p className="text-[11px] text-text-tertiary mt-1 truncate max-w-[520px]">{interfaceTranslationsPath}</p>
                                                            )}
                                                            <div className="mt-2 space-y-1">
                                                                {customInterfaceLocales.length === 0 && (
                                                                    <p className="text-[11px] text-text-tertiary">{t('settings.general.translationPacksNone')}</p>
                                                                )}
                                                                {customInterfaceLocales.map((locale, index) => (
                                                                    <div key={`${locale.code}:${index}`} className="text-[11px] text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                        <span className="font-medium text-text-primary">{locale.nativeLabel || locale.code}</span>
                                                                        <span>{locale.valid ? t('settings.general.translationPackValid') : t('settings.general.translationPackInvalid')}</span>
                                                                        {locale.valid && (
                                                                            <span>{t('settings.general.translationPackCoverage', { coverage: locale.coverage ?? 0 })}</span>
                                                                        )}
                                                                        {(locale.errors?.length ?? 0) > 0 && (
                                                                            <span className="text-red-400">{locale.errors?.[0]}</span>
                                                                        )}
                                                                        {(locale.warnings?.length ?? 0) > 0 && (
                                                                            <span className="text-yellow-400">{locale.warnings?.[0]}</span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                        <button type="button"
                                                            onClick={() => void handleOpenInterfaceTranslationsFolder()}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                                                        >
                                                            <ExternalLink size={12} />
                                                            {t('settings.general.translationPacksOpenFolder')}
                                                        </button>
                                                        <button type="button"
                                                            onClick={() => void handleRefreshInterfaceTranslations()}
                                                            disabled={isRefreshingInterfaceTranslations}
                                                            className="bg-bg-component hover:bg-bg-elevated disabled:opacity-60 border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                                                        >
                                                            <RefreshCw size={12} className={isRefreshingInterfaceTranslations ? 'animate-spin' : ''} />
                                                            {isRefreshingInterfaceTranslations ? t('common.checking') : t('common.refresh')}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Theme */}
                                                <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            themeMode !== 'system'
                                                                ? isLight
                                                                    ? 'border-violet-500/30 text-violet-600 bg-violet-50/50'
                                                                    : 'border-violet-500/40 text-violet-400 bg-violet-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Palette size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.themeTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t('settings.general.themeDescription')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="relative w-full shrink-0 lg:w-auto" ref={themeDropdownRef}>
                                                        <button type="button"
                                                            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex w-full items-center gap-2 justify-between lg:min-w-[130px]"
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <span className="text-text-secondary shrink-0">
                                                                    {themeMode === 'system' && <Monitor size={14} />}
                                                                    {themeMode === 'light' && <Sun size={14} />}
                                                                    {themeMode === 'dark' && <Moon size={14} />}
                                                                </span>
                                                                <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                                                                    {themeMode === 'system'
                                                                        ? t('settings.general.themeSystem')
                                                                        : themeMode === 'light'
                                                                            ? t('settings.general.themeLight')
                                                                            : t('settings.general.themeDark')}
                                                                </span>
                                                            </div>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {isThemeDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 min-w-full w-max bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none">
                                                                {[
                                                                    { mode: 'system', label: t('settings.general.themeSystem'), icon: <Monitor size={14} /> },
                                                                    { mode: 'light', label: t('settings.general.themeLight'), icon: <Sun size={14} /> },
                                                                    { mode: 'dark', label: t('settings.general.themeDark'), icon: <Moon size={14} /> }
                                                                ].map((option) => (
                                                                    <button type="button"
                                                                        key={option.mode}
                                                                        onClick={() => {
                                                                            handleSetTheme(option.mode as any);
                                                                            setIsThemeDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${themeMode === option.mode ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        <span className={themeMode === option.mode ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}>{option.icon}</span>
                                                                        <span className="font-medium">{option.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Meeting Interface Style */}
                                                <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            (meetingInterfaceTheme === 'liquid-glass' || meetingInterfaceTheme === 'modern')
                                                                ? isLight
                                                                    ? 'border-sky-500/30 text-sky-600 bg-sky-50/50'
                                                                    : 'border-sky-500/40 text-sky-400 bg-sky-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Layout size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.meetingInterfaceStyleTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">
                                                                {meetingInterfaceTheme === 'liquid-glass'
                                                                    ? 'Liquid glass — Apple-inspired transparent overlay'
                                                                    : meetingInterfaceTheme === 'modern'
                                                                        ? 'Modern — polished dark glass with cobalt accents'
                                                                        : 'Default overlay appearance'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="relative w-full shrink-0 lg:w-auto" ref={interfaceThemeDropdownRef}>
                                                        <button type="button"
                                                            onClick={() => setIsInterfaceThemeDropdownOpen(!isInterfaceThemeDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex w-full items-center gap-2 justify-between lg:min-w-[150px]"
                                                        >
                                                            <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                                                                {meetingInterfaceTheme === 'liquid-glass'
                                                                    ? t('settings.general.meetingInterfaceLiquid')
                                                                    : meetingInterfaceTheme === 'modern'
                                                                        ? t('settings.general.meetingInterfaceModern')
                                                                        : t('settings.general.meetingInterfaceDefault')}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isInterfaceThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {isInterfaceThemeDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none">
                                                                {([
                                                                    { mode: 'default' as MeetingInterfaceTheme, label: t('settings.general.meetingInterfaceDefault') },
                                                                    { mode: 'liquid-glass' as MeetingInterfaceTheme, label: t('settings.general.meetingInterfaceLiquid') },
                                                                    { mode: 'modern' as MeetingInterfaceTheme, label: t('settings.general.meetingInterfaceModern') },
                                                                ] as const).map((option) => (
                                                                    <button type="button"
                                                                        key={option.mode}
                                                                        onClick={() => {
                                                                            setMeetingInterfaceTheme(option.mode);
                                                                            setMeetingInterfaceThemeState(option.mode);
                                                                            setIsInterfaceThemeDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${meetingInterfaceTheme === option.mode ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        <span className="font-medium">{option.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                    {/* AI answer locale */}
                                                <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            aiResponseLanguage !== 'auto'
                                                                ? isLight
                                                                    ? 'border-teal-500/30 text-teal-600 bg-teal-50/50'
                                                                    : 'border-teal-500/40 text-teal-400 bg-teal-500/5'
                                                                : 'border-border-subtle text-text-tertiary'
                                                        }`}>
                                                            <Globe size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.aiResponseLanguageTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">
                                                                {aiResponseLanguage === 'auto'
                                                                    ? t('settings.general.aiResponseLanguageAutoDescription')
                                                                    : t('settings.general.aiResponseLanguageDescription')
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="relative w-full shrink-0 lg:w-auto" ref={aiLangDropdownRef}>
                                                        <button type="button"
                                                            onClick={() => setIsAiLangDropdownOpen(!isAiLangDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex w-full items-center gap-2 justify-between lg:min-w-[130px]"
                                                        >
                                                            <span className="capitalize text-ellipsis overflow-hidden whitespace-nowrap flex items-center gap-1">
                                                                {aiResponseLanguage === 'auto' ? 'Auto' : aiResponseLanguage}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isAiLangDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {isAiLangDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 min-w-full w-max bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none max-h-60 overflow-y-auto custom-scrollbar">
                                                                {availableAiLanguages.map((option) => (
                                                                    <button type="button"
                                                                        key={option.code}
                                                                        onClick={() => {
                                                                            handleAiLanguageChange(option.code);
                                                                            setIsAiLangDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${aiResponseLanguage === option.code ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        {option.code === 'auto' ? (
                                                                            <span className="font-medium">Авто</span>
                                                                        ) : (
                                                                            <span className="font-medium">{option.label}</span>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Version */}
                                                <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="flex items-start gap-4 min-w-0">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary shrink-0">
                                                            <BadgeCheck size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t('settings.general.versionTitle')}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">
                                                                {t('settings.general.versionDescription', { version: packageJson.version })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button type="button"
                                                        onClick={async () => {
                                                            if (updateStatus === 'available') {
                                                                try {
                                                                    // @ts-ignore
                                                                    await window.electronAPI.downloadUpdate();
                                                                    onClose(); // Close settings to show the banner
                                                                } catch (err) {
                                                                    console.error("Failed to start download:", err);
                                                                }
                                                            } else {
                                                                handleCheckForUpdates();
                                                            }
                                                        }}
                                                        disabled={updateStatus === 'checking'}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-2 shrink-0 lg:min-w-[120px] ${
                                                            updateStatus === 'checking'
                                                                ? 'bg-bg-input text-text-tertiary border-border-subtle cursor-wait'
                                                                : updateStatus === 'available'
                                                                    ? 'bg-accent-primary text-white border-accent-primary hover:bg-accent-secondary shadow-lg shadow-blue-500/20'
                                                                    : updateStatus === 'uptodate'
                                                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                                        : updateStatus === 'error'
                                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                            : 'bg-bg-component hover:bg-bg-elevated text-text-primary border-border-subtle'
                                                        }`}
                                                    >
                                                        {updateStatus === 'checking' ? (
                                                            <>
                                                                <RefreshCw size={14} className="animate-spin" />
                                                                {t('common.checking')}
                                                            </>
                                                        ) : updateStatus === 'available' ? (
                                                            <>
                                                                <ArrowDown size={14} />
                                                                {t('common.update')}
                                                            </>
                                                        ) : updateStatus === 'uptodate' ? (
                                                            <>
                                                                <Check size={14} />
                                                                {t('common.upToDate')}
                                                            </>
                                                        ) : updateStatus === 'error' ? (
                                                            <>
                                                                <X size={14} />
                                                                {t('common.error')}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw size={14} />
                                                                {t('common.check')}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            </div>

                                                {/* ------------------------------------------------------------------ */}
                                                {/* Overlay opacity control                                      */}
                                                {/* ------------------------------------------------------------------ */}
                                                <div
                                                    id="opacity-slider-card"
                                                    style={isPreviewingOpacity ? { visibility: 'visible', position: 'relative', zIndex: 9999 } : {}}
                                                    className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-5 border border-border-subtle mt-4`}
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <label className="flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-wide">
                                                            <Eye size={13} className="text-text-secondary" />
                                                            {t('settings.general.interfaceOpacityTitle')}
                                                        </label>
                                                        {/*
                                                         * Render previewOverlayOpacity (live drag value), NOT
                                                         * overlayOpacity (committed). The drag handler at
                                                         * handleOpacityChange does an imperative
                                                         *   document.querySelectorAll('.opacity-percent-label')
                                                         *     .forEach(el => el.textContent = percentText)
                                                         * for sub-frame latency, then calls setPreviewOverlayOpacity(val).
                                                         * That setter queues a React re-render — if this JSX read
                                                         * `overlayOpacity` (the un-committed pre-drag value), React
                                                         * would clobber the imperative text back to the stale value
                                                         * on the next commit, producing a visible flicker every
                                                         * drag tick. Reading previewOverlayOpacity keeps React's
                                                         * render and the imperative write in agreement — the
                                                         * imperative write still wins the sub-frame race, React's
                                                         * commit just confirms the same value.
                                                         */}
                                                        <span className="opacity-percent-label text-xs font-semibold text-text-primary tabular-nums">
                                                            {Math.round(previewOverlayOpacity * 100)}%
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="range"
                                                        min={OVERLAY_OPACITY_MIN}
                                                        max={1.0}
                                                        step={0.01}
                                                        defaultValue={overlayOpacity}
                                                        onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                                                        onPointerDown={startPreviewingOpacity}
                                                        onPointerUp={stopPreviewingOpacity}
                                                        onPointerCancel={stopPreviewingOpacity}
                                                        onPointerLeave={stopPreviewingOpacity}
                                                        className="w-full h-1.5 rounded-full appearance-none bg-bg-input accent-accent-primary"
                                                        style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                                    />

                                                    <div className="flex justify-between mt-1.5">
                                                        <span className="text-[10px] text-text-tertiary">{t('settings.general.moreStealth')}</span>
                                                        <span className="text-[10px] text-text-tertiary">{t('settings.general.fullyVisible')}</span>
                                                    </div>

                                                    <p className="text-xs text-text-tertiary mt-2">
                                                        {t('settings.general.interfaceOpacityDescription')}{' '}
                                                        <span className="text-text-secondary">{t('settings.general.holdToPreview')}</span>
                                                    </p>
                                                </div>

                                        </div>

                                    </div>

                                    {/* Disguise settings */}
                                    {/* Disguise settings */}
                                    <div className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-5 border border-border-subtle`}>
                                        <div className="flex flex-col gap-1 mb-3">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-text-primary">{t('settings.general.processDisguiseTitle')}</h3>
                                            </div>
                                            <p className="text-xs text-text-secondary">
                                                {t('settings.general.processDisguiseDescription')}
                                                <span className="block mt-1 text-text-tertiary">
                                                    {t('settings.general.processDisguiseHint')}
                                                </span>
                                            </p>
                                        </div>

                                        <div className={`grid grid-cols-2 gap-3 ${isUndetectable ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {isUndetectable && (
                                                <p className="col-span-2 text-xs text-yellow-500/80 -mt-1 mb-1">
                                                    ⚠️ {t('settings.general.disableUndetectableFirst')}
                                                </p>
                                            )}
                                            {[
                                                { id: 'none', label: t('settings.general.disguiseNone'), icon: <Layout size={14} /> },
                                                { id: 'terminal', label: t('settings.general.disguiseTerminal'), icon: <Terminal size={14} /> },
                                                { id: 'settings', label: t('settings.general.disguiseSystemSettings'), icon: <Settings size={14} /> },
                                                { id: 'activity', label: t('settings.general.disguiseActivityMonitor'), icon: <Activity size={14} /> }
                                            ].map((option) => (
                                                <button type="button"
                                                    key={option.id}
                                                    disabled={isUndetectable}
                                                    onClick={() => {
                                                        if (isUndetectable) return;
                                                        // @ts-ignore
                                                        setDisguiseMode(option.id);
                                                        // @ts-ignore
                                                        window.electronAPI?.setDisguise(option.id);
                                                        // Analytics
                                                        analytics.trackModeSelected(`disguise_${option.id}`);
                                                    }}
                                                    className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${disguiseMode === option.id
                                                        ? 'bg-accent-primary border-accent-primary text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-bg-input border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-subtle-hover'
                                                        } ${isUndetectable ? 'cursor-not-allowed' : ''}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${disguiseMode === option.id ? 'bg-white/20 text-white' : 'bg-bg-item-surface text-text-secondary'
                                                        }`}>
                                                        {option.icon}
                                                    </div>
                                                    <span className="text-xs font-medium">{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {activeTab === 'ai-providers' && (
                                <AIProvidersSettings />
                            )}
                            {activeTab === 'skills' && (
                                <SkillsSettings />
                            )}
                            {activeTab === 'keybinds' && (
                                <div className="space-y-5 animated fadeIn select-text pb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary mb-1">Горячие клавиши</h3>
                                            <p className="text-xs text-text-secondary">OpenOffer работает с этими простыми командами.</p>
                                        </div>
                                        <button type="button"
                                            onClick={resetShortcuts}
                                            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border-subtle bg-bg-subtle/30 hover:bg-bg-subtle hover:border-green-500/30 transition-all duration-200 text-xs font-medium text-text-secondary hover:text-green-500 active:scale-95 mt-1"
                                        >
                                            <RotateCcw size={13} strokeWidth={2.5} />
                                            Восстановить
                                        </button>
                                    </div>

                                    <div className="grid gap-6">
                                        {/* General Category */}
                                        <div>
                                            <h4 className="text-sm font-bold text-text-primary mb-3">Основное</h4>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><Eye size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Показать / скрыть</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.toggleVisibility}
                                                        onSave={(keys) => updateShortcut('toggleVisibility', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><PointerOff size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">{t('settings.general.mousePassthroughTitle')}</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.toggleMousePassthrough}
                                                        onSave={(keys) => updateShortcut('toggleMousePassthrough', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><MessageSquare size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Обработать скриншоты</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.processScreenshots}
                                                        onSave={(keys) => updateShortcut('processScreenshots', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><Sparkles size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Снять экран и спросить AI</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.captureAndProcess}
                                                        onSave={(keys) => updateShortcut('captureAndProcess', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><RotateCcw size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Сброс / отмена</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.resetCancel}
                                                        onSave={(keys) => updateShortcut('resetCancel', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><Camera size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Сделать скриншот</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.takeScreenshot}
                                                        onSave={(keys) => updateShortcut('takeScreenshot', keys)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between py-1.5 group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center"><Crop size={14} /></span>
                                                        <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">Выделенный скриншот</span>
                                                    </div>
                                                    <KeyRecorder
                                                        currentKeys={shortcuts.selectiveScreenshot}
                                                        onSave={(keys) => updateShortcut('selectiveScreenshot', keys)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chat Category */}
                                        <div>
                                            <div className="mb-3">
                                                <h4 className="text-sm font-bold text-text-primary">Чат</h4>
                                            </div>
                                            <div className="space-y-1">
                                                {[
                                                    { id: 'whatToAnswer', label: 'Что ответить', icon: <Sparkles size={14} /> },
                                                    { id: 'clarify', label: 'Уточнить', icon: <MessageSquare size={14} /> },
                                                    { id: 'followUp', label: 'Follow-up вопрос', icon: <MessageSquare size={14} /> },
                                                    { id: 'dynamicAction4', label: 'Рекап / брейншторм', icon: <RefreshCw size={14} /> },
                                                    { id: 'answer', label: 'Ответ / запись', icon: <Mic size={14} /> },
                                                    { id: 'codeHint', label: 'Подсказка по коду', icon: <Zap size={14} /> },
                                                    { id: 'brainstorm', label: 'Подходы к решению', icon: <Zap size={14} /> },
                                                    { id: 'scrollUp', label: 'Прокрутить вверх', icon: <ArrowUp size={14} /> },
                                                    { id: 'scrollDown', label: 'Прокрутить вниз', icon: <ArrowDown size={14} /> },
                                                    { id: 'scrollLeft', label: 'Прокрутить влево (код)', icon: <ArrowLeft size={14} /> },
                                                    { id: 'scrollRight', label: 'Прокрутить вправо (код)', icon: <ArrowRight size={14} /> },
                                                    { id: 'focusInput', label: 'Скрытый ввод', icon: <MessageSquare size={14} /> },
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1.5 group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">{item.icon}</span>
                                                            <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">{item.label}</span>
                                                        </div>
                                                        <KeyRecorder
                                                            currentKeys={shortcuts[item.id as keyof typeof shortcuts]}
                                                            onSave={(keys) => updateShortcut(item.id as any, keys)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Window Category */}
                                        <div>
                                            <h4 className="text-sm font-bold text-text-primary mb-3">Окно</h4>
                                            <div className="space-y-1">
                                                {[
                                                    { id: 'moveWindowUp', label: 'Сдвинуть окно вверх', icon: <ArrowUp size={14} /> },
                                                    { id: 'moveWindowDown', label: 'Сдвинуть окно вниз', icon: <ArrowDown size={14} /> },
                                                    { id: 'moveWindowLeft', label: 'Сдвинуть окно влево', icon: <ArrowLeft size={14} /> },
                                                    { id: 'moveWindowRight', label: 'Сдвинуть окно вправо', icon: <ArrowRight size={14} /> }
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1.5 group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-tertiary group-hover:text-text-primary transition-colors w-5 flex justify-center">{item.icon}</span>
                                                            <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">{item.label}</span>
                                                        </div>
                                                        <KeyRecorder
                                                            currentKeys={shortcuts[item.id as keyof typeof shortcuts]}
                                                            onSave={(keys) => updateShortcut(item.id as any, keys)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'audio' && (
                                <div className="space-y-6 animated fadeIn">
                                    {/* ── Speech Provider Section ── */}
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">{t('settings.audio.speechProviderTitle')}</h3>
                                        <p className="text-xs text-text-secondary mb-5">{t('settings.audio.speechProviderDescription')}</p>

                                        <div className="space-y-4">
                                            <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-3">
                                                <label className="text-xs font-medium text-text-secondary block">{t('settings.audio.speechProviderLabel')}</label>
                                                <div className="relative">
                                                    <ProviderSelect
                                                        value={sttProvider}
                                                        onChange={(val) => handleSttProviderChange(val as any)}
                                                        placeholder={t('settings.audio.speechProviderLabel')}
                                                        recommendedLabel={t('localWhisper.recommended')}
                                                        options={[
                                                            { id: 'google', label: 'Google Cloud', badge: googleServiceAccountPath ? t('settings.audio.savedBadge') : null, recommended: true, desc: 'gRPC streaming through a Service Account', color: 'blue', icon: <Mic size={14} /> },
                                                            { id: 'groq', label: 'Groq Whisper', badge: hasStoredSttGroqKey ? t('settings.audio.savedBadge') : null, recommended: true, desc: 'Very fast REST transcription', color: 'orange', icon: <Mic size={14} /> },
                                                            { id: 'openai', label: 'OpenAI Whisper', badge: hasStoredSttOpenaiKey ? t('settings.audio.savedBadge') : null, desc: 'OpenAI-compatible Whisper API', color: 'green', icon: <Mic size={14} /> },
                                                            { id: 'deepgram', label: 'Deepgram Nova-3', badge: hasStoredDeepgramKey ? t('settings.audio.savedBadge') : null, recommended: true, desc: 'High-accuracy REST transcription', color: 'purple', icon: <Mic size={14} /> },
                                                            { id: 'elevenlabs', label: 'ElevenLabs Scribe', badge: hasStoredElevenLabsKey ? t('settings.audio.savedBadge') : null, desc: 'Realtime API Scribe v2', color: 'teal', icon: <Mic size={14} /> },
                                                            { id: 'azure', label: 'Azure Speech', badge: hasStoredAzureKey ? t('settings.audio.savedBadge') : null, desc: 'Microsoft Cognitive Services STT', color: 'cyan', icon: <Mic size={14} /> },
                                                            { id: 'ibmwatson', label: 'IBM Watson', badge: hasStoredIbmWatsonKey ? t('settings.audio.savedBadge') : null, desc: 'IBM Watson cloud STT service', color: 'indigo', icon: <Mic size={14} /> },
                                                            { id: 'soniox', label: 'Soniox', badge: hasStoredSonioxKey ? t('settings.audio.savedBadge') : null, recommended: true, desc: '60+ languages, multilingual audio, and domain context', color: 'cyan', icon: <Mic size={14} /> },
                                                            { id: 'local-whisper', label: 'Local Whisper', badge: null, desc: 'Private: runs fully on this device', color: 'green', icon: <Cpu size={14} /> },
                                                            { id: 'gigastt', label: 'GigaSTT', badge: null, recommended: true, desc: 'Local STT server tuned for Russian speech', color: 'green', icon: <Cpu size={14} /> },
                                                        ]}
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Activity size={15} className="text-text-secondary shrink-0" />
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-semibold text-text-primary">{t('settings.audio.runtimeStatus')}</h4>
                                                            <p className="text-[11px] text-text-tertiary truncate">
                                                                {runtimeHealth?.message || sttRuntimeStatus?.error || t('settings.audio.checkingSttBackend')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button type="button"
                                                        onClick={refreshSttRuntimeStatus}
                                                        disabled={sttRuntimeLoading}
                                                        className="w-8 h-8 rounded-lg bg-bg-input hover:bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center disabled:opacity-50"
                                                        title={t('settings.audio.refreshRuntimeStatus')}
                                                    >
                                                        <RefreshCw size={14} className={sttRuntimeLoading ? 'animate-spin' : ''} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {renderRuntimePill(
                                                        t('settings.audio.backend'),
                                                        runtimeHealth?.state,
                                                        runtimeHealth?.label || sttRuntimeStatus?.provider || sttProvider
                                                    )}
                                                    {renderRuntimePill(
                                                        t('settings.audio.mic'),
                                                        sttRuntimeStatus?.lastStatus?.user?.state,
                                                        sttRuntimeStatus?.lastStatus?.user?.error
                                                    )}
                                                    {renderRuntimePill(
                                                        t('settings.audio.system'),
                                                        sttRuntimeStatus?.lastStatus?.interviewer?.state,
                                                        sttRuntimeStatus?.lastStatus?.interviewer?.error
                                                    )}
                                                </div>

                                                {sttProvider === 'gigastt' && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-text-secondary">
                                                        <div className="bg-bg-input rounded-lg px-3 py-2 border border-border-subtle min-w-0">
                                                            <span className="text-text-tertiary block mb-0.5">{t('settings.audio.pool')}</span>
                                                            <span className="text-text-primary font-medium">{runtimePool || t('settings.audio.unknown')}</span>
                                                        </div>
                                                        <div className="bg-bg-input rounded-lg px-3 py-2 border border-border-subtle min-w-0">
                                                            <span className="text-text-tertiary block mb-0.5">{t('settings.audio.binary')}</span>
                                                            <span className="text-text-primary font-medium truncate block">
                                                                {runtimeHealth?.binary?.path || t('settings.audio.missing')}
                                                            </span>
                                                        </div>
                                                        <div className="bg-bg-input rounded-lg px-3 py-2 border border-border-subtle min-w-0">
                                                            <span className="text-text-tertiary block mb-0.5">{t('settings.audio.log')}</span>
                                                            <span className="text-text-primary font-medium truncate block">
                                                                {runtimeHealth?.logPath || '~/.gigastt/openoffer-gigastt.log'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {sttProvider === 'local-whisper' && (
                                                    <div className="bg-bg-input rounded-lg px-3 py-2 border border-border-subtle text-[11px] text-text-secondary">
                                                        <span className="text-text-tertiary block mb-0.5">{t('settings.audio.model')}</span>
                                                        <span className="text-text-primary font-medium">
                                                            {runtimeHealth?.modelName || runtimeHealth?.modelId || t('settings.audio.noModelSelected')}
                                                        </span>
                                                        {runtimeHealth?.modelStatus && (
                                                            <span className="ml-2 text-text-tertiary">({runtimeHealth.modelStatus})</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Groq Model Selector */}
                                            {sttProvider === 'groq' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4">
                                                    <label className="text-xs font-medium text-text-secondary mb-2.5 block">Модель Whisper</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { id: 'whisper-large-v3-turbo', label: 'V3 Turbo', desc: 'Fastest' },
                                                            { id: 'whisper-large-v3', label: 'V3', desc: 'Most Accurate' },
                                                        ].map((m) => (
                                                            <button type="button"
                                                                key={m.id}
                                                                onClick={async () => {
                                                                    setGroqSttModel(m.id);
                                                                    try {
                                                                        // @ts-ignore
                                                                        await window.electronAPI?.setGroqSttModel?.(m.id);
                                                                    } catch (e) {
                                                                        console.error('Failed to set Groq model:', e);
                                                                    }
                                                                }}
                                                                className={`rounded-lg px-3 py-2.5 text-left transition-all duration-200 ease-in-out active:scale-[0.98] ${groqSttModel === m.id
                                                                    ? 'bg-blue-600 text-white shadow-md'
                                                                    : 'bg-bg-input hover:bg-bg-elevated text-text-primary'
                                                                    }`}
                                                            >
                                                                <span className="text-sm font-medium block">{m.label}</span>
                                                                <span className={`text-[11px] transition-colors ${groqSttModel === m.id ? 'text-white/70' : 'text-text-tertiary'
                                                                    }`}>{m.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Google Cloud Service Account */}
                                            {sttProvider === 'google' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4">
                                                    <label className="text-xs font-medium text-text-secondary mb-2 block">JSON сервисного аккаунта</label>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-secondary font-mono truncate">
                                                            {googleServiceAccountPath
                                                                ? <span className="text-text-primary">{googleServiceAccountPath.split('/').pop()}</span>
                                                                : <span className="text-text-tertiary italic">Файл не выбран</span>}
                                                        </div>
                                                        <button type="button"
                                                            onClick={async () => {
                                                                // @ts-ignore
                                                                const result = await window.electronAPI?.selectServiceAccount?.();
                                                                if (result?.success && result.path) {
                                                                    setGoogleServiceAccountPath(result.path);
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors flex items-center gap-2"
                                                        >
                                                            <Upload size={14} /> Select File
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-text-tertiary mt-2">
                                                        Требуется для Google Cloud Speech-to-Text.
                                                    </p>
                                                </div>
                                            )}

                                            {/* API Key Input (non-Google providers) */}
                                            {sttProvider !== 'google' && sttProvider !== 'local-whisper' && sttProvider !== 'gigastt' && sttProvider !== 'none' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-3">
                                                    <label className="text-xs font-medium text-text-secondary block">
                                                        {sttProvider === 'groq' ? 'Groq' : sttProvider === 'openai' ? 'OpenAI STT' : sttProvider === 'elevenlabs' ? 'ElevenLabs' : sttProvider === 'azure' ? 'Azure' : sttProvider === 'ibmwatson' ? 'IBM Watson' : sttProvider === 'soniox' ? 'Soniox' : 'Deepgram'} API Key
                                                    </label>
                                                    {sttProvider === 'openai' && (
                                                        <p className="text-[10px] text-text-tertiary mb-1.5">
                                                            This key is separate from your main AI Provider key.
                                                        </p>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="password"
                                                            value={
                                                                sttProvider === 'groq' ? sttGroqKey
                                                                    : sttProvider === 'openai' ? sttOpenaiKey
                                                                        : sttProvider === 'elevenlabs' ? sttElevenLabsKey
                                                                            : sttProvider === 'azure' ? sttAzureKey
                                                                                : sttProvider === 'ibmwatson' ? sttIbmKey
                                                                                    : sttProvider === 'soniox' ? sttSonioxKey
                                                                                        : sttDeepgramKey
                                                            }
                                                            onChange={(e) => {
                                                                if (sttProvider === 'groq') setSttGroqKey(e.target.value);
                                                                else if (sttProvider === 'openai') setSttOpenaiKey(e.target.value);
                                                                else if (sttProvider === 'elevenlabs') setSttElevenLabsKey(e.target.value);
                                                                else if (sttProvider === 'azure') setSttAzureKey(e.target.value);
                                                                else if (sttProvider === 'ibmwatson') setSttIbmKey(e.target.value);
                                                                else if (sttProvider === 'soniox') setSttSonioxKey(e.target.value);
                                                                else setSttDeepgramKey(e.target.value);
                                                            }}
                                                            placeholder={
                                                                sttProvider === 'groq'
                                                                    ? (hasStoredSttGroqKey ? '••••••••••••' : 'Введите API-ключ Groq')
                                                                    : sttProvider === 'openai'
                                                                        ? (hasStoredSttOpenaiKey ? '••••••••••••' : 'Введите API-ключ OpenAI STT')
                                                                        : sttProvider === 'elevenlabs'
                                                                            ? (hasStoredElevenLabsKey ? '••••••••••••' : 'Введите API-ключ ElevenLabs')
                                                                            : sttProvider === 'azure'
                                                                                ? (hasStoredAzureKey ? '••••••••••••' : 'Введите API-ключ Azure')
                                                                                : sttProvider === 'ibmwatson'
                                                                                    ? (hasStoredIbmWatsonKey ? '••••••••••••' : 'Введите API-ключ IBM Watson')
                                                                                    : sttProvider === 'soniox'
                                                                                        ? (hasStoredSonioxKey ? '••••••••••••' : 'Введите API-ключ Soniox')
                                                                                        : (hasStoredDeepgramKey ? '••••••••••••' : 'Введите API-ключ Deepgram')
                                                            }
                                                            className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                        />
                                                        <button type="button"
                                                            onClick={() => {
                                                                const keyMap: Record<string, string> = {
                                                                    groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
                                                                    elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
                                                                    soniox: sttSonioxKey,
                                                                };
                                                                handleSttKeySubmit(sttProvider as any, keyMap[sttProvider] || '');
                                                            }}
                                                            disabled={sttSaving || !(() => {
                                                                const keyMap: Record<string, string> = {
                                                                    groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
                                                                    elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
                                                                    soniox: sttSonioxKey,
                                                                };
                                                                return (keyMap[sttProvider] || '').trim();
                                                            })()}
                                                            className={`px-5 py-2.5 rounded-lg text-xs font-medium transition-colors ${sttSaved
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary disabled:opacity-50'
                                                                }`}
                                                        >
                                                            {sttSaving ? t('aiProvidersSettings.saving') : sttSaved ? t('common.saved') : t('common.save')}
                                                        </button>
                                                        {(() => {
                                                            const hasKeyMap: Record<string, boolean> = {
                                                                groq: hasStoredSttGroqKey,
                                                                openai: hasStoredSttOpenaiKey,
                                                                deepgram: hasStoredDeepgramKey,
                                                                elevenlabs: hasStoredElevenLabsKey,
                                                                azure: hasStoredAzureKey,
                                                                ibmwatson: hasStoredIbmWatsonKey,
                                                                soniox: hasStoredSonioxKey,
                                                            };
                                                            return hasKeyMap[sttProvider] ? (
                                                                <button type="button"
                                                                    onClick={() => handleRemoveSttKey(sttProvider as any)}
                                                                    className="px-2.5 py-2.5 rounded-lg text-xs font-medium text-text-tertiary hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                                    title="Удалить API-ключ"
                                                                >
                                                                    <Trash2 size={16} strokeWidth={1.5} />
                                                                </button>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Azure Region Input */}
                                                    {sttProvider === 'azure' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-medium text-text-secondary block">Регион</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={sttAzureRegion}
                                                                    onChange={(e) => setSttAzureRegion(e.target.value)}
                                                                    placeholder="e.g. eastus"
                                                                    className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                                />
                                                                <button type="button"
                                                                    onClick={async () => {
                                                                        if (!sttAzureRegion.trim()) return;
                                                                        // @ts-ignore
                                                                        await window.electronAPI?.setAzureRegion?.(sttAzureRegion.trim());
                                                                        setSttSaved(true);
                                                                        setTimeout(() => setSttSaved(false), 2000);
                                                                    }}
                                                                    disabled={!sttAzureRegion.trim()}
                                                                    className="px-5 py-2.5 rounded-lg text-xs font-medium bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary disabled:opacity-50 transition-colors"
                                                                >
                                                                    Save
                                                                </button>
                                                            </div>
                                                            <p className="text-[10px] text-text-tertiary">e.g. eastus, westeurope, westus2</p>
                                                        </div>
                                                    )}

                                                    {/* OpenAI Custom Base URL — for self-hosted OpenAI-compatible servers (e.g. Speaches).
                                                        When set, the WebSocket Realtime path is skipped and REST is used against the custom host. */}
                                                    {sttProvider === 'openai' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-medium text-text-secondary block">Пользовательский Base URL <span className="text-text-tertiary">(необязательно)</span></label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={sttOpenaiBaseUrl}
                                                                    onChange={(e) => setSttOpenaiBaseUrl(e.target.value)}
                                                                    placeholder="https://api.openai.com (default)"
                                                                    className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                                />
                                                                <button type="button"
                                                                    onClick={async () => {
                                                                        // @ts-ignore
                                                                        await window.electronAPI?.setOpenAiSttBaseUrl?.(sttOpenaiBaseUrl.trim());
                                                                        setSttSaved(true);
                                                                        setTimeout(() => setSttSaved(false), 2000);
                                                                    }}
                                                                    className="px-5 py-2.5 rounded-lg text-xs font-medium bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary transition-colors"
                                                                >
                                                                    Save
                                                                </button>
                                                            </div>
                                                            <p className="text-[10px] text-text-tertiary">Укажите любой OpenAI-совместимый сервер (например Speaches). Пользовательские серверы используют только REST — Realtime WebSocket пропускается. Оставьте пустым для значения по умолчанию.</p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3">
                                                        <button type="button"
                                                            onClick={handleTestSttConnection}
                                                            disabled={sttTestStatus === 'testing'}
                                                            className="text-xs bg-bg-input hover:bg-bg-elevated text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {sttTestStatus === 'testing' ? (
                                                                <><RefreshCw size={12} className="animate-spin" /> Проверка...</>
                                                            ) : sttTestStatus === 'success' ? (
                                                                <><Check size={12} className="text-green-500" /> Подключено</>
                                                            ) : (
                                                                <>Проверить подключение</>
                                                            )}
                                                        </button>
                                                        <button type="button"
                                                            onClick={() => {
                                                                const urls: Record<string, string> = {
                                                                    groq: 'https://console.groq.com/keys',
                                                                    openai: 'https://platform.openai.com/api-keys',
                                                                    deepgram: 'https://console.deepgram.com',
                                                                    elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
                                                                    azure: 'https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeech',
                                                                    ibmwatson: 'https://cloud.ibm.com/catalog/services/speech-to-text'
                                                                };
                                                                if (urls[sttProvider]) {
                                                                    // @ts-ignore
                                                                    window.electronAPI?.openExternal(urls[sttProvider]);
                                                                }
                                                            }}
                                                            className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors ml-1"
                                                            title="Получить API-ключ"
                                                        >
                                                            <ExternalLink size={12} />
                                                        </button>
                                                        {sttTestStatus === 'error' && (
                                                            <span className="text-xs text-red-400">{sttTestError}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Local Whisper Model Panel */}
                                            {sttProvider === 'local-whisper' && (
                                                <LocalWhisperModelPanel />
                                            )}

                                            {/* Recognition Language Family */}
                                            <CustomSelect
                                                label="Language"
                                                icon={<Globe size={14} />}
                                                value={selectedSttGroup}
                                                options={languageGroups.map(g => ({
                                                    deviceId: g,
                                                    label: g,
                                                    kind: 'audioinput' as MediaDeviceKind,
                                                    groupId: '',
                                                    toJSON: () => ({})
                                                }))}
                                                onChange={handleGroupChange}
                                                placeholder="Выберите язык"
                                            />

                                            {/* Variant/Accent Selector (Conditional) */}
                                            {currentGroupVariants.length > 1 && (
                                                <div className="mt-3 animated fadeIn">
                                                    <CustomSelect
                                                        label="Accent / Region"
                                                        icon={<MapPin size={14} />}
                                                        value={recognitionLanguage}
                                                        options={currentGroupVariants}
                                                        onChange={handleLanguageChange}
                                                        placeholder="Выберите регион"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex gap-2 items-center mt-2 px-1">
                                                <Info size={14} className="text-text-secondary shrink-0" />
                                                <p className="text-xs text-text-secondary">
                                                    {recognitionLanguage === 'auto'
                                                        ? autoDetectedLanguage
                                                            ? (() => {
                                                                const label = Object.values(availableLanguages).find((l: any) =>
                                                                    l.bcp47 === autoDetectedLanguage || l.iso639 === autoDetectedLanguage
                                                                )?.label as string | undefined;
                                                                return `Авто режим — обнаружено: ${label ?? autoDetectedLanguage}`;
                                                              })()
                                                            : 'Авто режим — язык будет определен по первым секундам аудио.'
                                                        : 'Выберите основной язык, на котором говорят на встрече.'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-border-subtle" />

                                    {/* ── Audio Configuration Section ── */}
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">Настройка аудио</h3>
                                        <p className="text-xs text-text-secondary mb-5">Управляйте устройствами ввода и вывода.</p>

                                        {/* Device-fallback banner: shown when main process couldn't
                                            open the selected device and silently used the default. */}
                                        {deviceFallbackNotice && (
                                            <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-amber-200/90 leading-snug">
                                                        Не удалось открыть выбранное {deviceFallbackNotice.kind === 'input' ? 'устройство ввода' : 'устройство вывода'}
                                                        {deviceFallbackNotice.requested ? ` "${deviceFallbackNotice.requested}"` : ''}
                                                        — используется <span className="font-medium">{deviceFallbackNotice.actual ?? 'устройство не найдено'}</span>.
                                                    </p>
                                                    {deviceFallbackNotice.reason && (
                                                        <p className="text-[11px] text-amber-200/60 mt-1 font-mono break-all">{deviceFallbackNotice.reason}</p>
                                                    )}
                                                </div>
                                                <button type="button"
                                                    onClick={() => {
                                                        // Clear stale localStorage so the next meeting starts clean.
                                                        if (deviceFallbackNotice.kind === 'input') {
                                                            localStorage.removeItem('preferredInputDeviceId');
                                                            setSelectedInput('default');
                                                        } else {
                                                            localStorage.removeItem('preferredOutputDeviceId');
                                                            setSelectedOutput('default');
                                                        }
                                                        setDeviceFallbackNotice(null);
                                                    }}
                                                    className="shrink-0 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25"
                                                >
                                                    {t('settings.audio.resetDeviceSelection')}
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <CustomSelect
                                                label={t('settings.audio.inputDevice')}
                                                icon={<Mic size={16} />}
                                                value={selectedInput}
                                                options={inputDevices}
                                                onChange={(id) => {
                                                    setSelectedInput(id);
                                                    localStorage.setItem('preferredInputDeviceId', id);
                                                }}
                                                placeholder={t('settings.audio.defaultMicrophone')}
                                            />

                                            <div>
                                                <div className="flex justify-between text-xs text-text-secondary mb-2 px-1">
                                                    <span>{t('settings.audio.inputLevel')}</span>
                                                </div>
                                                <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 transition-all duration-100 ease-out"
                                                        style={{ width: `${micLevel}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-xs text-text-secondary mb-2 px-1">
                                                    <span>{t('settings.audio.systemAudioLevel')}</span>
                                                    {systemAudioTestError && (
                                                        <span className="text-amber-400 truncate max-w-[240px]" title={systemAudioTestError}>
                                                            {systemAudioTestError}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-sky-500 transition-all duration-100 ease-out"
                                                        style={{ width: `${systemAudioLevel}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="h-px bg-border-subtle my-2" />

                                            <CustomSelect
                                                label={t('settings.audio.outputDevice')}
                                                icon={<Speaker size={16} />}
                                                value={selectedOutput}
                                                options={outputDevices}
                                                onChange={(id) => {
                                                    setSelectedOutput(id);
                                                    localStorage.setItem('preferredOutputDeviceId', id);
                                                }}
                                                placeholder={t('settings.audio.defaultSpeakers')}
                                            />

                                            <div className="flex justify-end">
                                                <button type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                                                            if (!AudioContext) {
                                                                console.error("Web Audio API not supported");
                                                                return;
                                                            }

                                                            const ctx = new AudioContext();

                                                            if (ctx.state === 'suspended') {
                                                                await ctx.resume();
                                                            }

                                                            const oscillator = ctx.createOscillator();
                                                            const gainNode = ctx.createGain();

                                                            oscillator.connect(gainNode);
                                                            gainNode.connect(ctx.destination);

                                                            oscillator.type = 'sine';
                                                            oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
                                                            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                                                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

                                                            if (selectedOutput && (ctx as any).setSinkId) {
                                                                try {
                                                                    await (ctx as any).setSinkId(selectedOutput);
                                                                } catch (e) {
                                                                    console.warn("Error setting sink for AudioContext", e);
                                                                }
                                                            }

                                                            oscillator.start();
                                                            oscillator.stop(ctx.currentTime + 1.0);
                                                        } catch (e) {
                                                            console.error("Error playing test sound", e);
                                                        }
                                                    }}
                                                    className="text-xs bg-bg-input hover:bg-bg-elevated text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                                >
                                                    <Speaker size={12} /> Проверить звук
                                                </button>
                                            </div>

                                            {/* SCK Backend Toggle — macOS only. The ScreenCaptureKit
                                                backend is a CoreAudio alternative implemented in the
                                                Rust speaker module under #[cfg(target_os="macos")];
                                                Windows audio runs via WASAPI loopback so the toggle
                                                has no meaning there and routing "sck" as a device id
                                                silently breaks system audio (issue #252 audit / F-003). */}
                                            {isMac && (
                                                <>
                                                    <div className="h-px bg-border-subtle my-2" />
                                                    <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                                                                    <FlaskConical size={18} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <h3 className="text-sm font-bold text-text-primary">{t('settings.audio.sckBackendTitle')}</h3>
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 uppercase tracking-wide">{t('settings.audio.alternativeBadge')}</span>
                                                                    </div>
                                                                    <p className="text-xs text-text-secondary leading-relaxed max-w-[300px]">
                                                                        {t('settings.audio.sckBackendDescription')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div
                                                                onClick={() => {
                                                                    const newState = !useExperimentalSck;
                                                                    setUseExperimentalSck(newState);
                                                                    window.localStorage.setItem('useExperimentalSckBackend', newState ? 'true' : 'false');
                                                                }}
                                                                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${useExperimentalSck ? 'bg-amber-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                            >
                                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useExperimentalSck ? 'translate-x-5' : 'translate-x-0'}`} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}


                            {activeTab === 'calendar' && (
                                <div className="space-y-6 animated fadeIn h-full">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-2">{t('settings.calendar.visibleCalendarsTitle')}</h3>
                                        <p className="text-xs text-text-secondary mb-4">{t('settings.calendar.visibleCalendarsDescription')}</p>
                                    </div>

                                    <div className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden">
                                        {calendarStatus.connected ? (
                                            <>
                                                {/* Connection header */}
                                                <div className="p-6 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                            <Calendar size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-text-primary">Google Calendar</h4>
                                                            <p className="text-xs text-text-secondary">{t('settings.calendar.connectedAs', { email: calendarStatus.email || 'User' })}</p>
                                                        </div>
                                                    </div>

                                                    <button type="button"
                                                        onClick={async () => {
                                                            setIsCalendarsLoading(true);
                                                            try {
                                                                await window.electronAPI.calendarDisconnect();
                                                                const status = await window.electronAPI.getCalendarStatus();
                                                                setCalendarStatus(status);
                                                                setCalendarEvents([]);
                                                            } catch (e) {
                                                                console.error(e);
                                                            } finally {
                                                                setIsCalendarsLoading(false);
                                                            }
                                                        }}
                                                        disabled={isCalendarsLoading}
                                                        className="px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle text-text-primary rounded-md text-xs font-medium transition-colors"
                                                    >
                                                        {isCalendarsLoading ? t('settings.calendar.disconnecting') : t('settings.calendar.disconnect')}
                                                    </button>
                                                </div>

                                                <div className="relative border-t border-white/[0.05]">
                                                    <div className="relative flex items-end justify-between gap-4 px-6 pt-5 pb-3">
                                                        <div className="min-w-0 space-y-2">
                                                            <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-white/[0.04] ring-1 ring-white/[0.06] text-[9px] font-medium tracking-[0.18em] text-text-secondary uppercase">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
                                                                {t('settings.calendar.upcoming')}
                                                            </span>
                                                            <p className="text-[11px] text-text-tertiary tracking-[0.01em]">
                                                                {calendarEvents.length > 0
                                                                    ? t('settings.calendar.upcomingCount', { count: calendarEvents.length })
                                                                    : t('settings.calendar.nextSevenDays')}
                                                            </p>
                                                        </div>
                                                        <button type="button"
                                                            onClick={async () => {
                                                                if (!window.electronAPI?.calendarRefresh) return;
                                                                setIsCalendarRefreshing(true);
                                                                try {
                                                                    await window.electronAPI.calendarRefresh();
                                                                    const events = await window.electronAPI.getUpcomingEvents();
                                                                    setCalendarEvents(events || []);
                                                                } catch (e) {
                                                                    console.error(e);
                                                                } finally {
                                                                    setIsCalendarRefreshing(false);
                                                                }
                                                            }}
                                                            disabled={isCalendarRefreshing}
                                                            aria-label={t('settings.calendar.refreshUpcoming')}
                                                            className="group h-8 w-8 shrink-0 rounded-md bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.07] text-text-secondary hover:text-text-primary transition active:scale-[0.96] flex items-center justify-center"
                                                        >
                                                            <RefreshCw
                                                                size={12}
                                                                className={`transition-transform ${isCalendarRefreshing ? 'animate-spin' : 'group-hover:rotate-[60deg]'}`}
                                                            />
                                                        </button>
                                                    </div>

                                                    {calendarEvents.length === 0 ? (
                                                        <div className="relative px-6 pt-2 pb-7">
                                                            <div className="rounded-xl bg-bg-input/60 ring-1 ring-white/[0.04] px-6 py-9 text-center">
                                                                    <div className="mx-auto w-11 h-11 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] flex items-center justify-center mb-3">
                                                                        <Calendar size={18} className="text-text-tertiary" strokeWidth={1.5} />
                                                                    </div>
                                                                    <p className="text-[13px] text-text-primary tracking-[-0.01em]">{t('settings.calendar.emptyTitle')}</p>
                                                                    <p className="text-[11px] text-text-tertiary mt-1">{t('settings.calendar.emptyDescription')}</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <ul className="relative px-3 pb-4 space-y-1.5">
                                                            {calendarEvents.map(ev => {
                                                                const start = new Date(ev.startTime);
                                                                const end = new Date(ev.endTime);
                                                                const now = new Date();
                                                                const tomorrow = new Date(now.getTime() + 86400000);
                                                                const isToday = start.toDateString() === now.toDateString();
                                                                const isTomorrow = start.toDateString() === tomorrow.toDateString();

                                                                const diffMs = start.getTime() - now.getTime();
                                                                const diffMin = diffMs / 60000;
                                                                const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
                                                                const durationLabel = durationMin >= 60
                                                                    ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}`
                                                                    : `${durationMin}m`;

                                                                // Urgency-tinted accent for the time chip
                                                                let chipTone: { text: string; ring: string; bg: string };
                                                                if (diffMin <= 30) chipTone = { text: 'text-red-300', ring: 'ring-red-400/25', bg: 'bg-red-500/[0.08]' };
                                                                else if (diffMin <= 4 * 60) chipTone = { text: 'text-amber-200', ring: 'ring-amber-300/25', bg: 'bg-amber-400/[0.08]' };
                                                                else chipTone = { text: 'text-text-secondary', ring: 'ring-white/[0.06]', bg: 'bg-white/[0.04]' };

                                                                // Smart relative label
                                                                let chipLabel: string;
                                                                if (diffMin <= 0) chipLabel = 'Сейчас';
                                                                else if (diffMin < 60) chipLabel = `через ${Math.ceil(diffMin)} мин`;
                                                                else if (diffMin < 4 * 60) {
                                                                    const h = Math.floor(diffMin / 60);
                                                                    const m = Math.round(diffMin - h * 60);
                                                                    chipLabel = m > 0 ? `через ${h} ч ${m} мин` : `через ${h} ч`;
                                                                } else if (isToday) chipLabel = 'Сегодня';
                                                                else if (isTomorrow) chipLabel = 'Завтра';
                                                                else chipLabel = start.toLocaleDateString('ru-RU', { weekday: 'short' });

                                                                const timeRange = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

                                                                // Boarding-pass style date stub
                                                                const dayNum = start.getDate();
                                                                const monthAbbrev = start.toLocaleDateString([], { month: 'short' }).toUpperCase();

                                                                // Provider detection
                                                                let provider: string | null = null;
                                                                if (ev.link) {
                                                                    const u = ev.link.toLowerCase();
                                                                    if (u.includes('meet.google.com')) provider = 'Meet';
                                                                    else if (u.includes('zoom.us')) provider = 'Zoom';
                                                                    else if (u.includes('teams.microsoft.com')) provider = 'Teams';
                                                                    else if (u.includes('webex.com')) provider = 'Webex';
                                                                }

                                                                return (
                                                                    <li
                                                                        key={ev.id}
                                                                        className="group/row relative rounded-lg border border-white/[0.05] bg-bg-input/50 transition hover:bg-bg-input"
                                                                    >
                                                                        <div className="relative flex items-stretch gap-3 px-3 py-3">
                                                                            <div className="shrink-0 w-12 flex flex-col items-center justify-center rounded-md bg-white/[0.03] ring-1 ring-white/[0.05] py-1.5">
                                                                                <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-text-tertiary leading-none">
                                                                                    {monthAbbrev}
                                                                                </span>
                                                                                <span className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary tabular-nums leading-none mt-1">
                                                                                    {dayNum}
                                                                                </span>
                                                                            </div>

                                                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-medium tracking-[0.06em] ring-1 ${chipTone.bg} ${chipTone.text} ${chipTone.ring} tabular-nums`}>
                                                                                        {chipLabel}
                                                                                    </span>
                                                                                    {provider && (
                                                                                        <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-medium tracking-[0.06em] bg-white/[0.04] text-text-secondary ring-1 ring-white/[0.05]">
                                                                                            {provider}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <h4 className="truncate text-[13.5px] font-medium leading-snug text-text-primary">
                                                                                    {ev.title}
                                                                                </h4>
                                                                                <p className="text-[11px] text-text-tertiary tabular-nums mt-0.5">
                                                                                    <span className="text-text-secondary">{timeRange}</span>
                                                                                    <span className="mx-1.5 opacity-50">·</span>
                                                                                    <span>{durationLabel}</span>
                                                                                </p>
                                                                            </div>

                                                                            {ev.link ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => window.electronAPI?.openExternal(ev.link!)}
                                                                                    title={ev.link}
                                                                                    className="self-center shrink-0 group/btn inline-flex items-center gap-1.5 rounded-md pl-3 pr-1.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] ring-1 ring-white/[0.07] text-text-primary text-[11px] font-medium transition active:scale-[0.97]"
                                                                                >
                                                                                    <span>Войти</span>
                                                                                    <span className="w-5 h-5 rounded bg-white/[0.08] ring-1 ring-white/[0.08] flex items-center justify-center transition-transform group-hover/btn:translate-x-[1px] group-hover/btn:-translate-y-[1px]">
                                                                                        <ExternalLink size={9} strokeWidth={2} />
                                                                                    </span>
                                                                                </button>
                                                                            ) : (
                                                                                <span
                                                                                    aria-label="Нет ссылки на встречу"
                                                                                    className="self-center shrink-0 inline-flex items-center justify-center w-2 h-2 rounded-full bg-white/[0.08] mr-3"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full p-6">
                                                <div className="mb-4">
                                                    <Calendar size={24} className="text-text-tertiary mb-3" />
                                                    <h4 className="text-sm font-bold text-text-primary mb-1">Нет календарей</h4>
                                                    <p className="text-xs text-text-secondary">Начните с подключения Google-аккаунта.</p>
                                                </div>

                                                <button type="button"
                                                    onClick={async () => {
                                                        setIsCalendarsLoading(true);
                                                        try {
                                                            const res = await window.electronAPI.calendarConnect();
                                                            if (res.success) {
                                                                const status = await window.electronAPI.getCalendarStatus();
                                                                setCalendarStatus(status);
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setIsCalendarsLoading(false);
                                                        }
                                                    }}
                                                    disabled={isCalendarsLoading}
                                                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 ${isLight ? 'bg-bg-component hover:bg-bg-item-surface text-text-primary border border-border-subtle' : 'bg-[#303033] hover:bg-[#3A3A3D] text-white'}`}
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                                                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                                        </g>
                                                    </svg>
                                                    {isCalendarsLoading ? 'Подключение...' : 'Подключить Google'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'phone-mirror' && (
                                <PhoneMirrorSettings />
                            )}

                            {activeTab === 'intelligence' && (
                                <IntelligenceSettings />
                            )}

                            {activeTab === 'help' && (
                                <HelpSettings onNavigate={setActiveTab} />
                            )}

                            {activeTab === 'about' && (
                                <AboutSection />
                            )}
                        </div>
                    </div>
                    </motion.div>
                </motion.div>
            )
            }


            {/* ------------------------------------------------------------------ */}
            {/* Live Preview — mockup sits below the z-50 modal                    */}
            {/* ------------------------------------------------------------------ */}
            {/* ------------------------------------------------------------------ */}
            {/* Live Preview — mockup sits below the z-50 modal                    */}
            {/* ALWAYS MOUNTED to prevent React AnimatePresence lag spikes         */}
            {/* ------------------------------------------------------------------ */}
            <div
                id="settings-mockup-wrapper"
                className="fixed inset-0 z-[49] pointer-events-none transition-opacity duration-150"
                style={{ opacity: isPreviewingOpacity ? 1 : 0 }}
            >
                <MockupOpenOfferInterface opacity={previewOverlayOpacity} />
            </div>
        </AnimatePresence >
    );
};

export default SettingsOverlay;
