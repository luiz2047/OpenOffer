import React from 'react';
import { Monitor, Cpu, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
    activeTab: 'general' | 'ai-providers' | 'about';
    setActiveTab: (tab: 'general' | 'ai-providers' | 'about') => void;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onClose }) => {
    const { t } = useTranslation();
    return (
        <div className="w-64 bg-bg-sidebar flex flex-col border-r border-border-subtle h-full">
            <div className="p-6">
                <h2 className="font-semibold text-gray-400 text-xs uppercase tracking-wider mb-4">{t('advancedSettings.title')}</h2>
                <nav className="space-y-1">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'general' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                    >
                        <Monitor size={16} /> {t('settings.sidebar.general')}
                    </button>
                    <button
                        onClick={() => setActiveTab('ai-providers')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'ai-providers' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                    >
                        <Cpu size={16} /> {t('settings.sidebar.aiProviders')}
                    </button>
                    {/* Add more tabs as needed */}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t border-border-subtle">
                <button
                    onClick={onClose}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors flex items-center gap-3"
                >
                    {t('common.close')}
                </button>
            </div>
        </div>
    );
};
