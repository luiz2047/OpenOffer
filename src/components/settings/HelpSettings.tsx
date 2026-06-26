import React from 'react';
import {
    Brain,
    Calendar,
    Command,
    ExternalLink,
    Ghost,
    Key,
    Mic,
    Monitor,
    Settings,
    Smartphone,
    Sparkles,
    User,
    Wifi,
    Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShortcuts } from '../../hooks/useShortcuts';

type HelpSection = {
    title: string;
    icon: React.ReactNode;
    points: string[];
};

const formatShortcut = (value: string | string[] | undefined, emptyLabel: string) => {
    if (Array.isArray(value)) return value.length ? value.join(' / ') : emptyLabel;
    return value || emptyLabel;
};

const ShortcutRow = ({ label, value, emptyLabel }: { label: string; value?: string | string[]; emptyLabel: string }) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-item-surface px-3 py-2">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="rounded-md border border-border-subtle bg-bg-input px-2 py-1 font-mono text-xs text-text-primary">
            {formatShortcut(value, emptyLabel)}
        </span>
    </div>
);

export const HelpSettings: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
    const { t } = useTranslation();
    const { shortcuts } = useShortcuts();
    const tr = (key: string) => t(`helpSettings.${key}`);
    const section = (key: string, icon: React.ReactNode, pointCount: number): HelpSection => ({
        title: tr(`sections.${key}.title`),
        icon,
        points: Array.from({ length: pointCount }, (_, index) => tr(`sections.${key}.points.${index}`)),
    });

    const sections: HelpSection[] = [
        section('quickStart', <Zap size={16} />, 4),
        section('permissions', <Monitor size={16} />, 3),
        section('audio', <Mic size={16} />, 3),
        section('aiProviders', <Brain size={16} />, 3),
        section('profile', <User size={16} />, 3),
        section('calendar', <Calendar size={16} />, 3),
        section('phoneMirror', <Smartphone size={16} />, 3),
        section('stealth', <Ghost size={16} />, 3),
    ];

    return (
        <div className="space-y-6 pb-10">
            <div className="rounded-2xl border border-border-subtle bg-bg-item-surface p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-input text-accent-primary">
                        <Command size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">{tr('title')}</h3>
                        <p className="text-sm text-text-secondary">{tr('subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {sections.map((section) => (
                    <section key={section.title} className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                        <div className="mb-3 flex items-center gap-2 text-text-primary">
                            <span className="text-accent-primary">{section.icon}</span>
                            <h4 className="text-sm font-bold">{section.title}</h4>
                        </div>
                        <ul className="space-y-2">
                            {section.points.map((point) => (
                                <li key={point} className="flex gap-2 text-xs leading-relaxed text-text-secondary">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary/70" />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                <div className="mb-3 flex items-center gap-2 text-text-primary">
                    <Key size={16} className="text-accent-primary" />
                    <h4 className="text-sm font-bold">{tr('shortcuts.title')}</h4>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    <ShortcutRow label={tr('shortcuts.toggleVisibility')} value={shortcuts.toggleVisibility} emptyLabel={tr('shortcuts.empty')} />
                    <ShortcutRow label={tr('shortcuts.captureAndProcess')} value={shortcuts.captureAndProcess} emptyLabel={tr('shortcuts.empty')} />
                    <ShortcutRow label={tr('shortcuts.processScreenshots')} value={shortcuts.processScreenshots} emptyLabel={tr('shortcuts.empty')} />
                    <ShortcutRow label={tr('shortcuts.takeScreenshot')} value={shortcuts.takeScreenshot} emptyLabel={tr('shortcuts.empty')} />
                    <ShortcutRow label={tr('shortcuts.whatToAnswer')} value={shortcuts.whatToAnswer} emptyLabel={tr('shortcuts.empty')} />
                    <ShortcutRow label={tr('shortcuts.answer')} value={shortcuts.answer} emptyLabel={tr('shortcuts.empty')} />
                </div>
            </section>

            <section className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                <div className="mb-2 flex items-center gap-2 text-text-primary">
                    <Wifi size={16} className="text-accent-primary" />
                    <h4 className="text-sm font-bold">{tr('links.title')}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => window.electronAPI?.openExternal?.('https://ollama.com/download')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        Ollama <ExternalLink size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => window.electronAPI?.openExternal?.('https://app.tavily.com/home')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        Tavily <ExternalLink size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('ai-providers') : window.electronAPI?.openSettingsTab?.('ai-providers')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Settings size={12} /> {tr('links.aiProviders')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('audio') : window.electronAPI?.openSettingsTab?.('audio')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Mic size={12} /> {tr('links.audio')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('profile') : window.electronAPI?.openSettingsTab?.('profile')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Sparkles size={12} /> {tr('links.profile')}
                    </button>
                </div>
            </section>
        </div>
    );
};
