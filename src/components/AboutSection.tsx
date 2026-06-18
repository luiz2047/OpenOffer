import React from 'react';
import {
    Github, Shield, Cpu, Database,
    Mail, MicOff, Star, Bug, Globe, Zap, LayoutGrid, Volume2, Activity, Users
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AboutSectionProps { }

export const AboutSection: React.FC<AboutSectionProps> = () => {
    const { t } = useTranslation();
    const handleOpenLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault();

        // Use backend shell.openExternal
        if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="space-y-6 animated fadeIn pb-10">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">{t('about.title')}</h3>
                <p className="text-sm text-text-secondary">{t('about.subtitle')}</p>
            </div>

            {/* What's New Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">{t('about.whatsNew')}</h4>
                <div className="bg-bg-item-surface rounded-xl border border-border-subtle overflow-hidden">
                    {/* 1. Two New Meeting UI Styles */}
                    <div className="p-3 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                <LayoutGrid size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.twoStylesTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.twoStylesDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2. DeepSeek AI Integrated */}
                    <div className="p-3 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.deepseekTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.deepseekDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 3. Audio & TCC Resolved */}
                    <div className="p-3 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                                <Volume2 size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.audioTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.audioDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 4. Optimized Modes Manager */}
                    <div className="p-3 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                                <Activity size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.modesTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.modesDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 5. In-App Updates */}
                    <div className="p-3 bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                                <Zap size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.updatesTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.updatesDescription')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Architecture Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">{t('about.howItWorks')}</h4>
                <div className="bg-bg-item-surface rounded-xl border border-border-subtle overflow-hidden">
                    <div className="p-3 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.hybridTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.hybridDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                                <Database size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">{t('about.memoryTitle')}</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    {t('about.memoryDescription')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Privacy Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">{t('about.privacyTitle')}</h4>
                <div className="bg-bg-item-surface rounded-xl border border-border-subtle p-5 space-y-4">
                    <div className="flex items-start gap-3">
                        <Shield size={16} className="text-green-400 mt-0.5" />
                        <div>
                            <h5 className="text-sm font-medium text-text-primary">{t('about.stealthTitle')}</h5>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                                {t('about.stealthDescription')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MicOff size={16} className="text-red-500 mt-0.5" />
                        <div>
                            <h5 className="text-sm font-medium text-text-primary">{t('about.noRecordingTitle')}</h5>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                                {t('about.noRecordingDescription')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Community Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">{t('about.community')}</h4>
                <div className="space-y-4">
                    {/* 0. Project Repository */}
                    <div className="bg-bg-item-surface rounded-xl border border-border-subtle p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm shadow-indigo-500/5">
                                <Globe size={18} className="opacity-80" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary">{t('about.projectRepository')}</h5>
                            </div>
                        </div>
                        <a
                            href="https://github.com/luiz2047/openoffer"
                            onClick={(e) => handleOpenLink(e, "https://github.com/luiz2047/openoffer")}
                            className="whitespace-nowrap px-4 py-2 bg-text-primary hover:bg-white/90 text-bg-main text-xs font-bold rounded-lg transition-all shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                        >
                            <Globe size={14} />
                            {t('about.openGithub')}
                        </a>
                    </div>

                    {/* 1. Project Stewardship */}
                    <div className="bg-bg-item-surface rounded-xl p-5">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-border-subtle flex items-center justify-center shrink-0 text-blue-400">
                                    <Users size={22} />
                                </div>
                                <div className="pt-0.5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h5 className="text-sm font-bold text-text-primary">{t('about.contributors')}</h5>
                                        <span className="text-[10px] font-medium px-1.5 py-[1px] rounded-full bg-blue-500/10 text-blue-200 border border-blue-400/10">{t('about.project')}</span>
                                    </div>
                                    <p className="text-xs text-text-secondary leading-relaxed max-w-lg">
                                        {t('about.stewardshipDescription')}
                                        <br />
                                        <span className="font-bold text-text-primary">{t('about.stewardshipFocus')}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pl-[60px]">
                                <a
                                    href="https://github.com/luiz2047/openoffer"
                                    onClick={(e) => handleOpenLink(e, "https://github.com/luiz2047/openoffer")}
                                    className="text-text-tertiary hover:text-text-primary transition-colors"
                                    title="GitHub"
                                >
                                    <Github size={18} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* 2. Star & Report */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <a
                            href="https://github.com/luiz2047/openoffer"
                            onClick={(e) => handleOpenLink(e, "https://github.com/luiz2047/openoffer")}
                            className="bg-bg-item-surface border border-border-subtle rounded-xl p-5 transition-all group flex items-center gap-4 h-full hover:bg-white/10"
                        >
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0 group-hover:scale-110 transition-transform">
                                <Star size={20} className="transition-all group-hover:fill-current" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary">{t('about.starTitle')}</h5>
                                <p className="text-xs text-text-secondary mt-0.5">{t('about.starDescription')}</p>
                            </div>
                        </a>

                        <a
                            href="https://github.com/luiz2047/openoffer/issues"
                            onClick={(e) => handleOpenLink(e, "https://github.com/luiz2047/openoffer/issues")}
                            className="bg-bg-item-surface border border-border-subtle rounded-xl p-5 transition-all group flex items-center gap-4 h-full hover:bg-white/10"
                        >
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                                <Bug size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary">{t('about.issueTitle')}</h5>
                                <p className="text-xs text-text-secondary mt-0.5">{t('about.issueDescription')}</p>
                            </div>
                        </a>
                    </div>

                    {/* 3. Product Feedback */}
                    <div className="bg-bg-item-surface rounded-xl border border-border-subtle p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-sm shadow-blue-500/5">
                                <Mail size={18} className="opacity-80" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary">{t('about.feedbackTitle')}</h5>
                                <p className="text-xs text-text-secondary mt-0.5">{t('about.feedbackDescription')}</p>
                            </div>
                        </div>
                        <a
                            href="https://github.com/luiz2047/openoffer/issues"
                            onClick={(e) => handleOpenLink(e, "https://github.com/luiz2047/openoffer/issues")}
                            className="whitespace-nowrap px-4 py-2 bg-text-primary hover:bg-white/90 text-bg-main text-xs font-bold rounded-lg transition-all shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                        >
                            <Mail size={14} />
                            {t('about.openIssues')}
                        </a>
                    </div>
                </div>
            </div>

            {/* Credits */}
            <div className="pt-4 border-t border-border-subtle">
                <div>
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3">{t('about.coreTechnology')}</h4>
                    <div className="flex flex-wrap gap-2">
                        {['Groq', 'Gemini', 'OpenAI', 'Deepgram', 'ElevenLabs', 'Electron', 'React', 'Rust', 'Sharp', 'TypeScript', 'Tailwind CSS', 'Vite', 'Google Cloud', 'SQLite'].map(tech => (
                            <span key={tech} className="px-2.5 py-1 rounded-md bg-bg-input border border-border-subtle text-[11px] font-medium text-text-secondary">
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div >
    );
};
