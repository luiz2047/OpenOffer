import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Cloud, Terminal, Monitor, Server, Plus } from 'lucide-react';
import { getCodexCliModelDisplayName, STANDARD_CLOUD_MODELS, prettifyModelId } from '../../utils/modelUtils';

interface ModelSelectorProps {
    currentModel: string;
    onSelectModel: (model: string) => void;
}

interface CustomProvider {
    id: string;
    name: string;
    curlCommand: string;
}

interface AnswerStylePackOption {
    id: string;
    label: string;
    shortLabel?: string;
    description: string;
    sample?: string;
    language: 'any';
    recommended: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onSelectModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'cloud' | 'custom' | 'local'>('cloud');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
    const [cloudModels, setCloudModels] = useState<{ id: string; name: string; desc: string; provider: string }[]>([]);
    const [answerStylePacks, setAnswerStylePacks] = useState<AnswerStylePackOption[]>([]);
    const [answerStyleSelectedId, setAnswerStyleSelectedId] = useState<string>('automatic');
    const [answerStyleLabel, setAnswerStyleLabel] = useState<string>('Automatic');
    const [answerStyleSummary, setAnswerStyleSummary] = useState<string>('Question-aware default behavior');
    const [answerStyleSavingId, setAnswerStyleSavingId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const applyAnswerStyleState = (answerStyleState: any) => {
        const selectedId = answerStyleState?.selectedId || 'automatic';
        const packs = (answerStyleState?.packs || []) as AnswerStylePackOption[];
        const selected = packs.find(pack => pack.id === selectedId);
        setAnswerStylePacks(packs);
        setAnswerStyleSelectedId(selectedId);
        setAnswerStyleLabel(selected?.shortLabel || selected?.label || 'Automatic');
        setAnswerStyleSummary(selectedId === 'automatic'
            ? (answerStyleState?.automaticSummary || 'Question-aware default behavior')
            : (selected?.sample || selected?.description || 'Custom answer behavior'));
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load Data
    useEffect(() => {
        if (!isOpen) return;

        const loadData = async () => {
            try {
                // Load Custom
                const custom = await window.electronAPI?.getCustomProviders() as CustomProvider[];
                if (custom) setCustomProviders(custom);

                // Load Ollama
                const local = await window.electronAPI?.getAvailableOllamaModels() as string[];
                if (local) setOllamaModels(local);

                // Build dynamic cloud models from credentials
                // @ts-ignore
                const creds = await window.electronAPI?.getStoredCredentials?.();
                const cModels: { id: string; name: string; desc: string; provider: string }[] = [];

                for (const [prov, cfg] of Object.entries(STANDARD_CLOUD_MODELS)) {
                    if (!cfg.hasKeyCheck(creds)) continue;
                    cfg.ids.forEach((id, i) => cModels.push({ id, name: cfg.names[i], desc: cfg.descs[i], provider: prov }));
                    const pm = creds?.[cfg.pmKey];
                    if (pm && !cfg.ids.includes(pm)) {
                        cModels.push({ id: pm, name: prettifyModelId(pm), desc: `${prov.charAt(0).toUpperCase() + prov.slice(1)} • Preferred`, provider: prov });
                    }
                }
                setCloudModels(cModels);

                const answerStyleState = await window.electronAPI?.getAnswerStylePacks?.({ modelId: currentModel });
                if (answerStyleState) {
                    applyAnswerStyleState(answerStyleState);
                }
            } catch (e) {
                console.error("Failed to load models:", e);
            }
        };
        loadData();
    }, [isOpen, currentModel]);

    const handleSelect = (model: string) => {
        // For custom/local, we might need to pass an ID or specific format
        // The backend logic (LLMHelper) needs to know how to handle this string or we need a richer object
        // For now, consistent with existing app, we pass a string. 
        // We'll rely on a prefix convention or just the name if unique enough, 
        // OR the app state handling this selection needs to store provider type.
        // Assuming onSelectModel handles the switching logic.

        onSelectModel(model);
        setIsOpen(false);
    };

    const handleAnswerStyleSelect = async (styleId: string) => {
        setAnswerStyleSavingId(styleId);
        try {
            const result = await window.electronAPI?.setAnswerStylePack?.(styleId, { modelId: currentModel });
            if (result?.success) {
                applyAnswerStyleState(result);
            }
        } catch (e) {
            console.error("Failed to set answer style:", e);
        } finally {
            setAnswerStyleSavingId(null);
        }
    };

    const getModelDisplayName = (model: string) => {
        const codexCliName = getCodexCliModelDisplayName(model);
        if (codexCliName) return codexCliName;
        if (model.startsWith('ollama-')) return model.replace('ollama-', '');
        if (model === 'gemini-3.5-flash') return 'Gemini 3.5 Flash';
        if (model === 'gemini-3.1-flash-lite') return 'Gemini 3.1 Flash Lite';
        if (model === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro';
        if (model === 'llama-3.3-70b-versatile') return 'Groq Llama 3.3';
        if (model === 'gpt-5.4') return 'GPT 5.4';
        if (model === 'claude-sonnet-4-6') return 'Sonnet 4.6';
        if (model.startsWith('yandex/')) return prettifyModelId(model.replace('yandex/', ''));

        // Check dynamic cloud models
        const cloud = cloudModels.find(m => m.id === model);
        if (cloud) return cloud.name;

        // Check custom providers
        const custom = customProviders.find(p => p.id === model || p.name === model);
        if (custom) return custom.name;

        return model;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg transition-colors text-xs font-medium text-text-primary max-w-[150px]"
            >
                <span className="truncate">{getModelDisplayName(currentModel)}</span>
                <ChevronDown size={14} className={`shrink-0 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-bg-item-surface border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden animated fadeIn">
                    {/* Tabs */}
                    <div className="flex border-b border-border-subtle bg-bg-input/50">
                        <button
                            onClick={() => setActiveTab('cloud')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'cloud' ? 'text-accent-primary bg-bg-item-surface border-t-2 border-t-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            Cloud
                        </button>
                        <button
                            onClick={() => setActiveTab('custom')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'custom' ? 'text-accent-primary bg-bg-item-surface border-t-2 border-t-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            Custom
                        </button>
                        <button
                            onClick={() => setActiveTab('local')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'local' ? 'text-accent-primary bg-bg-item-surface border-t-2 border-t-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            Local
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-2 max-h-64 overflow-y-auto">

                        {/* Cloud Models */}
                        {activeTab === 'cloud' && (
                            <div className="space-y-1">
                                {cloudModels.length === 0 ? (
                                    <div className="text-center py-6 text-text-tertiary">
                                        <p className="text-xs mb-2">No cloud providers configured.</p>
                                        <p className="text-[10px] opacity-70">Add API keys in Settings.</p>
                                    </div>
                                ) : (
                                    cloudModels.map((m, idx) => {
                                        const prevProvider = idx > 0 ? cloudModels[idx - 1].provider : null;
                                        const showDivider = prevProvider && prevProvider !== m.provider;
                                        const icon = m.provider === 'gemini' ? <Monitor size={14} /> : <Cloud size={14} />;
                                        return (
                                            <React.Fragment key={m.id}>
                                                {showDivider && <div className="h-px bg-border-subtle my-1" />}
                                                <ModelOption
                                                    id={m.id}
                                                    name={m.name}
                                                    desc={m.desc}
                                                    icon={icon}
                                                    selected={currentModel === m.id}
                                                    onSelect={() => handleSelect(m.id)}
                                                />
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Custom Models */}
                        {activeTab === 'custom' && (
                            <div className="space-y-1">
                                {customProviders.length === 0 ? (
                                    <div className="text-center py-6 text-text-tertiary">
                                        <p className="text-xs mb-2">No custom providers.</p>
                                        <button className="text-[10px] text-accent-primary hover:underline">Manage in Settings</button>
                                    </div>
                                ) : (
                                    customProviders.map(provider => (
                                        <ModelOption
                                            key={provider.id}
                                            id={provider.id}
                                            name={provider.name}
                                            desc="Custom cURL"
                                            icon={<Terminal size={14} />}
                                            selected={currentModel === provider.id}
                                            onSelect={() => handleSelect(provider.id)}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {/* Local Models (Ollama) */}
                        {activeTab === 'local' && (
                            <div className="space-y-1">
                                {ollamaModels.length === 0 ? (
                                    <div className="text-center py-6 text-text-tertiary">
                                        <p className="text-xs">No Ollama models found.</p>
                                        <p className="text-[10px] mt-1 opacity-70">Ensure Ollama is running.</p>
                                    </div>
                                ) : (
                                    ollamaModels.map(model => (
                                        <ModelOption
                                            key={model}
                                            id={`ollama-${model}`}
                                            name={model}
                                            desc="Local"
                                            icon={<Server size={14} />}
                                            selected={currentModel === `ollama-${model}`}
                                            onSelect={() => handleSelect(`ollama-${model}`)}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border-subtle p-2 bg-bg-input/30">
                        <div className="flex items-start justify-between gap-3 px-1">
                            <div className="min-w-0">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Answer style</span>
                                <span className="block text-[11px] font-medium text-text-primary truncate">{answerStyleLabel}</span>
                            </div>
                            <span className="text-[9px] text-emerald-500 font-medium shrink-0">Model</span>
                        </div>
                        <p className="px-1 pt-1 text-[9px] text-text-tertiary leading-snug">{answerStyleSummary}</p>
                        {answerStylePacks.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 pt-2">
                                {answerStylePacks.map(style => {
                                    const selected = answerStyleSelectedId === style.id;
                                    return (
                                        <button
                                            key={style.id}
                                            type="button"
                                            title={style.description}
                                            disabled={answerStyleSavingId !== null}
                                            onClick={() => handleAnswerStyleSelect(style.id)}
                                            className={`min-w-0 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${selected
                                                ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                                                : 'border-border-subtle bg-bg-item-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                                                }`}
                                        >
                                            <span className="block truncate">{style.shortLabel || style.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ModelOptionProps {
    id: string;
    name: string;
    desc: string;
    icon: React.ReactNode;
    selected: boolean;
    onSelect: () => void;
}

const ModelOption: React.FC<ModelOptionProps> = ({ name, desc, icon, selected, onSelect }) => (
    <button
        onClick={onSelect}
        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors group ${selected ? 'bg-accent-primary/10' : 'hover:bg-bg-input'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-md ${selected ? 'bg-accent-primary/20 text-accent-primary' : 'bg-bg-elevated text-text-secondary group-hover:text-text-primary'}`}>
                {icon}
            </div>
            <div className="text-left">
                <div className={`text-xs font-medium truncate max-w-[140px] ${selected ? 'text-accent-primary' : 'text-text-primary'}`}>{name}</div>
                <div className="text-[10px] text-text-tertiary">{desc}</div>
            </div>
        </div>
        {selected && <Check size={14} className="text-accent-primary" />}
    </button>
);
