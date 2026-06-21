import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, CheckCircle, Save, ChevronDown, Check, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { CODEX_CLI_MODEL, CODEX_CLI_MODEL_PRESETS, codexCliSelectorId, STANDARD_CLOUD_MODELS, prettifyModelId } from '../../utils/modelUtils';
import { validateCurl } from '../../lib/curl-validator';
import { ProviderCard } from './ProviderCard';
import { sanitizeDefaultModel } from '../../lib/legacyStateMigration';

const CODEX_SERVICE_TIERS = ['default', 'fast', 'flex'] as const;
const CODEX_MODEL_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

// LiteLLM max-output-token presets — the standard per-model output budgets
// (powers of two used across the LiteLLM model registry). '' = Auto: resolve
// each model's real budget from the proxy's /model/info, fallback 8192.
const LITELLM_MAX_TOKENS_OPTIONS: ModelOption[] = [
    { id: '', name: 'Авто (по модели)' },
    { id: '4096', name: '4,096 (4K)' },
    { id: '8192', name: '8,192 (8K)' },
    { id: '16384', name: '16,384 (16K)' },
    { id: '32768', name: '32,768 (32K)' },
    { id: '65536', name: '65,536 (64K)' },
    { id: '131072', name: '131,072 (128K)' },
    { id: '262144', name: '262,144 (256K)' },
    { id: '524288', name: '524,288 (512K)' },
    { id: '1048576', name: '1,048,576 (1M)' },
];

interface CustomProvider {
    id: string;
    name: string;
    curlCommand: string;
    responsePath: string;
    /** Whether this provider accepts screenshots. undefined = auto-detect from the cURL template. */
    multimodal?: boolean;
}

interface ModelOption {
    id: string;
    name: string;
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

type AiTask = 'vacancy_intake' | 'scraping' | 'retro' | 'agent_actions';
type TaskModelMode = 'default' | 'auto' | 'pinned';

interface TaskModelPolicy {
    version: 1;
    defaultModelId: string | null;
    tasks: Partial<Record<AiTask, {
        mode: TaskModelMode;
        modelId?: string;
        quality?: 'fast' | 'balanced' | 'quality';
    }>>;
    updatedAt: string;
}

const TASK_MODEL_ROWS: Array<{ task: AiTask; title: string; description: string }> = [
    { task: 'vacancy_intake', title: 'Вакансии из текста', description: 'Парсинг вакансий, HR-сообщений и встреч.' },
    { task: 'scraping', title: 'AI-скрапинг', description: 'Извлечение данных со страниц и источников.' },
    { task: 'retro', title: 'Ретро по собеседованию', description: 'Оценка созвона по транскрипту.' },
    { task: 'agent_actions', title: 'Агентные действия', description: 'Действия помощника с вакансиями и этапами.' },
];

const DEFAULT_ANSWER_STYLE_PACKS: AnswerStylePackOption[] = [
    { id: 'automatic', label: 'Автоматически', shortLabel: 'Авто', description: 'Использует рекомендованное поведение для этой модели и языка.', sample: 'Настройки по умолчанию с учетом вопроса.', language: 'any', recommended: true },
    { id: 'standard', label: 'Стандартный', shortLabel: 'Стандарт', description: 'Сбалансированные ответы, которые удобно произносить.', sample: 'Прямой ответ с естественным контекстом.', language: 'any', recommended: false },
    { id: 'strict', label: 'Строгий', shortLabel: 'Строго', description: 'Короткие уверенные ответы без воды.', sample: '2-4 предложения или плотные буллеты.', language: 'any', recommended: false },
    { id: 'expanded', label: 'Развернутый', shortLabel: 'Разверн.', description: 'Более полные ответы с компромиссами.', sample: 'Больше рассуждений, но в формате для интервью.', language: 'any', recommended: false },
    { id: 'hint', label: 'Подсказки', shortLabel: 'Хинт', description: 'Коучинговые подсказки вместо полного скрипта.', sample: 'Структура и ключевые тезисы для ответа.', language: 'any', recommended: false },
    { id: 'grounded', label: 'Фактический', shortLabel: 'Факты', description: 'Осторожен с личными фактами и метриками.', sample: 'Признает недостающий контекст вместо выдумывания.', language: 'any', recommended: false },
];

interface ModelSelectProps {
    value: string;
    options: ModelOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ value, options, onChange, placeholder = "Выберите модель", className = "" }) => {
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

    const selectedOption = options.find(o => o.id === value);

    const paddingClass = className.includes('py-') ? '' : 'py-1.5';

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full min-w-0 bg-bg-input border border-border-subtle rounded-lg px-3 ${paddingClass} ${className} text-xs text-text-primary focus:outline-none focus:border-accent-primary flex items-center justify-between hover:bg-bg-elevated transition-colors`}
                type="button"
            >
                <span className="truncate pr-2">{selectedOption ? selectedOption.name : placeholder}</span>
                <ChevronDown size={14} className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto animated fadeIn">
                    <div className="p-1 space-y-0.5">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => {
                                    onChange(option.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-md flex items-center justify-between group transition-colors ${value === option.id ? 'bg-bg-input hover:bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                type="button"
                            >
                                <span className="truncate">{option.name}</span>
                                {value === option.id && <Check size={14} className="text-accent-primary shrink-0 ml-2" />}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500 italic">Нет доступных моделей</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CodexCliModelField: React.FC<{
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    onSelect: (value: string) => void;
    onSave: () => void;
}> = ({ label, value, placeholder, onChange, onSelect, onSave }) => (
    <label className="space-y-1">
        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">{label}</span>
        <div className="flex gap-2">
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onSave}
                className="min-w-0 flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                placeholder={placeholder}
            />
            <ModelSelect
                value={value}
                options={value && !CODEX_CLI_MODEL_PRESETS.some(option => option.id === value)
                    ? [{ id: value, name: prettifyModelId(value) }, ...CODEX_CLI_MODEL_PRESETS]
                    : CODEX_CLI_MODEL_PRESETS}
                onChange={(modelId) => {
                    onChange(modelId);
                    onSelect(modelId);
                }}
                placeholder="Пресет"
                className="py-2"
            />
        </div>
    </label>
);

export const AIProvidersSettings: React.FC = () => {
    // --- Standard Providers ---
    const [apiKey, setApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [deepseekApiKey, setDeepseekApiKey] = useState('');
    const [yandexApiKey, setYandexApiKey] = useState('');
    const [yandexFolderId, setYandexFolderId] = useState('');
    const [yandexDisableDataLogging, setYandexDisableDataLogging] = useState(true);
    const [answerStylePacks, setAnswerStylePacks] = useState<AnswerStylePackOption[]>([]);
    const [yandexAnswerStyleId, setYandexAnswerStyleId] = useState<string | undefined>(undefined);
    const [yandexRecommendedAnswerStyleId, setYandexRecommendedAnswerStyleId] = useState<string>('automatic');
    const [yandexAnswerStyleLanguage, setYandexAnswerStyleLanguage] = useState<string>('auto');
    const [yandexAnswerStyleSummary, setYandexAnswerStyleSummary] = useState<string>('Поведение по умолчанию с учетом вопроса');

    // --- LiteLLM proxy (OpenAI-compatible gateway: baseURL + optional virtual key) ---
    const [litellmBaseURL, setLitellmBaseURL] = useState('');
    const [litellmApiKey, setLitellmApiKey] = useState('');
    // Max output tokens for proxied models. '' = Auto: per-model budget from the
    // proxy's /model/info (standard registry value), falling back to 8192.
    const [litellmMaxTokens, setLitellmMaxTokens] = useState('');

    // Status
    const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
    const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
    const [hasStoredKey, setHasStoredKey] = useState<Record<string, boolean>>({});
    const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
    const [testError, setTestError] = useState<Record<string, string>>({});

    // --- Пользовательские провайдеры ---
    const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
    const [isEditingCustom, setIsEditingCustom] = useState(false);
    const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
    const [customName, setCustomName] = useState('');
    const [customCurl, setCustomCurl] = useState('');
    const [customResponsePath, setCustomResponsePath] = useState('');
    // 'auto' = detect vision support from the template; 'on'/'off' = explicit override.
    const [customVision, setCustomVision] = useState<'auto' | 'on' | 'off'>('auto');
    const [curlError, setCurlError] = useState<string | null>(null);

    // --- Local (Ollama) ---
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'detected' | 'not-found' | 'fixing'>('checking');
    const [ollamaRestarted, setOllamaRestarted] = useState(false);
    const [isRefreshingOllama, setIsRefreshingOllama] = useState(false);

    // --- Local (Codex CLI) ---
    const [codexCliConfig, setCodexCliConfig] = useState({ enabled: false, path: 'codex', model: 'gpt-5.4', fastModel: 'gpt-5.3-codex-spark', timeoutMs: 60000, sandboxMode: 'read-only' as string, serviceTier: 'default', modelReasoningEffort: undefined as string | undefined });
    const [codexCliStatus, setCodexCliStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [codexCliError, setCodexCliError] = useState('');

    // --- Default Model ---
    const [defaultModel, setDefaultModel] = useState<string>('gemini-3.5-flash');
    const [taskModelPolicy, setTaskModelPolicy] = useState<TaskModelPolicy | null>(null);
    const [taskPolicySaving, setTaskPolicySaving] = useState<AiTask | 'default' | null>(null);
    const [fastResponseMode, setFastResponseMode] = useState(false);
    const [credentialsLoaded, setCredentialsLoaded] = useState(false);
    const canUseFastMode = !!(hasStoredKey.groq || codexCliConfig.enabled);

    // --- Dynamic Model Discovery ---
    const [preferredModels, setPreferredModels] = useState<Record<string, string>>({});

    // --- Screen Understanding (vision routing) ---
    const [screenUnderstandingMode, setScreenUnderstandingMode] = useState<'vision_first' | 'vision_only' | 'private_vision'>('vision_first');
    const [technicalInterviewVisionFirst, setTechnicalInterviewVisionFirst] = useState<boolean>(true);

    // --- Cloud Provider Data Scopes (fail-closed cloud share controls) ---
    const [providerDataScopes, setProviderDataScopes] = useState<{ transcript?: boolean; screenshots?: boolean; reference_files?: boolean; profile_history?: boolean; embeddings?: boolean; post_call_summary?: boolean }>({});

    const applyYandexAnswerStyleState = (answerStyleState: any) => {
        setAnswerStylePacks(answerStyleState.packs || []);
        setYandexAnswerStyleId(answerStyleState.selectedId);
        setYandexRecommendedAnswerStyleId(answerStyleState.recommendedId || 'automatic');
        setYandexAnswerStyleLanguage(answerStyleState.language || 'auto');
        setYandexAnswerStyleSummary(answerStyleState.automaticSummary || 'Поведение по умолчанию с учетом вопроса');
    };

    const loadYandexAnswerStyle = async (modelId: string) => {
        const answerStyleState = await window.electronAPI?.getAnswerStylePacks?.({
            provider: 'yandex',
            modelId,
        });
        if (answerStyleState) applyYandexAnswerStyleState(answerStyleState);
    };

    // Load Initial Data
    useEffect(() => {
        const loadCredentials = async () => {
            try {
                // Load credentials FIRST so canUseFastMode is correct before we set fastResponseMode.
                // If we set fastResponseMode before hasStoredKey is populated, the enforcement
                // effect below fires with canUseFastMode=false and immediately resets fast mode
                // to false — writing that reset back to SettingsManager on every startup.
                // @ts-ignore
                const creds = await window.electronAPI?.getStoredCredentials?.();
                if (creds) {
                    setHasStoredKey({
                        gemini: creds.hasGeminiKey,
                        groq: creds.hasGroqKey,
                        openai: creds.hasOpenaiKey,
                        claude: creds.hasClaudeKey,
                        deepseek: creds.hasDeepseekKey || false,
                        yandex: !!(creds.hasYandexKey && creds.yandexFolderId),
                        litellm: creds.hasLitellmBaseURL || false
                    });
                    if (creds.yandexFolderId) setYandexFolderId(creds.yandexFolderId);
                    setYandexDisableDataLogging(creds.yandexDisableDataLogging !== false);
                    // Prefill stored LiteLLM config so re-saving doesn't silently reset it.
                    // (baseURL is config, not a secret; the key stays masked/blank = keep.)
                    if (creds.litellmBaseURL) setLitellmBaseURL(creds.litellmBaseURL);
                    if (creds.litellmMaxTokens) setLitellmMaxTokens(String(creds.litellmMaxTokens));
                    // Load preferred models
                    const pm: Record<string, string> = {};
                    if (creds.geminiPreferredModel) pm.gemini = creds.geminiPreferredModel;
                    if (creds.groqPreferredModel) pm.groq = creds.groqPreferredModel;
                    if (creds.openaiPreferredModel) pm.openai = creds.openaiPreferredModel;
                    if (creds.claudePreferredModel) pm.claude = creds.claudePreferredModel;
                    if (creds.deepseekPreferredModel) pm.deepseek = creds.deepseekPreferredModel;
                    if (creds.yandexPreferredModel) pm.yandex = creds.yandexPreferredModel;
                    setPreferredModels(pm);
                }

                // Now it's safe to read fast mode — hasStoredKey is already set so
                // canUseFastMode will be correct when the enforcement effect runs.
                // @ts-ignore
                const cliConfig = await window.electronAPI?.getCodexCliConfig?.();
                if (cliConfig) setCodexCliConfig(cliConfig as typeof codexCliConfig);

                const fastMode = await window.electronAPI?.getGroqFastTextMode();
                if (fastMode) setFastResponseMode(fastMode.enabled);

                // Mark credentials as fully loaded so the enforcement effect can fire
                setCredentialsLoaded(true);

                // @ts-ignore
                const custom = await window.electronAPI?.getCustomProviders();
                if (custom) {
                    setCustomProviders(custom);
                }

                // Load persisted default model
                // @ts-ignore
                const result = await window.electronAPI?.getDefaultModel();
                if (result && result.model) {
                    setDefaultModel(sanitizeDefaultModel(result.model));
                }

                const taskPolicy = await window.electronAPI?.getTaskModelPolicy?.();
                if (taskPolicy) {
                    setTaskModelPolicy(taskPolicy);
                }

                await loadYandexAnswerStyle(creds?.yandexPreferredModel || 'yandex/yandexgpt-5-lite');

                // Check Ollama
                checkOllama();

            } catch (e) {
                console.error("Failed to load settings:", e);
                setCredentialsLoaded(true); // Unblock even on error
            }
        };
        loadCredentials();

        // Listen for changes from other windows (2-way sync)
        if (window.electronAPI?.onGroqFastTextChanged) {
            // @ts-ignore
            const unsubscribe = window.electronAPI.onGroqFastTextChanged((enabled: boolean) => {
                setFastResponseMode(enabled);
                localStorage.setItem('natively_groq_fast_text', String(enabled));
            });
            return () => unsubscribe();
        }
    }, []);

    // Effect to enforce fast mode disabled if neither Groq key nor Codex CLI is configured.
    // Guard with credentialsLoaded so this never fires during the initial async load phase
    // (when hasStoredKey is still empty and canUseFastMode is incorrectly false).
    useEffect(() => {
        if (!credentialsLoaded) return;
        if (!canUseFastMode && fastResponseMode) {
            setFastResponseMode(false);
            localStorage.setItem('natively_groq_fast_text', 'false');
            // @ts-ignore
            window.electronAPI?.setGroqFastTextMode(false);
        }
    }, [credentialsLoaded, canUseFastMode, fastResponseMode]);

    // Poll for Ollama status every 3 seconds requesting smart start on mount
    useEffect(() => {
        // Immediate "Smart Start" check
        ensureOllamaStartup();

        // Background polling for maintenance
        const interval = setInterval(() => {
            checkOllama(false);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Load Screen Understanding (vision routing) settings
    useEffect(() => {
        window.electronAPI?.getScreenUnderstandingMode?.().then(setScreenUnderstandingMode as any).catch(() => { });
        (window.electronAPI as any)?.getTechnicalInterviewVisionFirst?.()
            .then(setTechnicalInterviewVisionFirst)
            .catch(() => {
                // Fallback to deprecated alias if the renderer is talking to an older main process.
                window.electronAPI?.getTechnicalInterviewDirectVision?.().then(setTechnicalInterviewVisionFirst).catch(() => { });
            });
    }, []);

    useEffect(() => {
        const api: any = window.electronAPI;
        if (!api?.onScreenUnderstandingModeChanged) return;
        const unsubscribe = api.onScreenUnderstandingModeChanged(setScreenUnderstandingMode);
        return () => unsubscribe?.();
    }, []);

    useEffect(() => {
        const api: any = window.electronAPI;
        const handler = (enabled: boolean) => setTechnicalInterviewVisionFirst(enabled);
        const unsub1 = api?.onTechnicalInterviewVisionFirstChanged?.(handler);
        const unsub2 = api?.onTechnicalInterviewDirectVisionChanged?.(handler);
        return () => {
            unsub1?.();
            unsub2?.();
        };
    }, []);

    // Load Cloud Provider Data Scopes and subscribe to cross-window changes
    useEffect(() => {
        window.electronAPI?.getProviderDataScopes?.().then(setProviderDataScopes).catch(() => { });
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onProviderDataScopesChanged) {
            const unsubscribe = window.electronAPI.onProviderDataScopesChanged(setProviderDataScopes);
            return () => unsubscribe();
        }
    }, []);

    const ensureOllamaStartup = async () => {
        setOllamaStatus('checking');
        try {
            // @ts-ignore
            const result = await window.electronAPI?.invoke?.('ensure-ollama-running');
            if (result && result.success) {
                // It's running (or just started), now fetch models
                checkOllama(true);
            } else {
                setOllamaStatus('not-found');
            }
        } catch (e) {
            console.warn("Ollama ensure startup failed:", e);
            setOllamaStatus('not-found');
        }
    };

    const checkOllama = async (_isInitial = true) => {
        // Don't override 'checking' if we are already in smart-start mode
        // if (isInitial) setOllamaStatus('checking'); 

        try {
            // @ts-ignore
            const models = await window.electronAPI?.getAvailableOllamaModels?.();
            if (models && models.length > 0) {
                setOllamaModels(models);
                setOllamaStatus('detected');
            } else {
                // Silent failure on background checks
                // Only set not-found if we haven't detected it yet
                if (ollamaStatus !== 'detected') {
                    setOllamaStatus('not-found');
                }
            }
        } catch (e) {
            // console.warn(`Ollama check failed:`, e);
            if (ollamaStatus !== 'detected') {
                setOllamaStatus('not-found');
            }
        }
    };

    const handleFixOllama = async () => {
        setOllamaStatus('fixing');
        try {
            // @ts-ignore
            const result = await window.electronAPI?.invoke?.('force-restart-ollama');
            if (result && result.success) {
                setOllamaRestarted(true);
                // Wait for server to be ready
                setTimeout(() => checkOllama(false), 2000);
            } else {
                setOllamaStatus('not-found');
            }
        } catch (e) {
            console.error("Fix failed", e);
            setOllamaStatus('not-found');
        }
    };

    const saveCodexCliConfig = async (next = codexCliConfig) => {
        const normalized = { ...next, timeoutMs: Number(next.timeoutMs) || 60000 };
        setCodexCliConfig(normalized);
        const result = await window.electronAPI?.setCodexCliConfig?.(normalized);
        if (result?.config) setCodexCliConfig(result.config as typeof codexCliConfig);
        return result;
    };

    const handleTestCodexCli = async () => {
        setCodexCliStatus('testing');
        setCodexCliError('');
        try {
            const saveResult = await saveCodexCliConfig();
            const configToTest = saveResult?.config || codexCliConfig;
            const result = await window.electronAPI?.testCodexCli?.(configToTest);
            if (result?.success) {
                // If the main process auto-detected an install, reflect the
                // resolved path in the form so the user sees what got picked.
                if (result.config) setCodexCliConfig(result.config as typeof codexCliConfig);
                setCodexCliStatus('success');
                setTimeout(() => setCodexCliStatus('idle'), 3000);
            } else {
                setCodexCliStatus('error');
                setCodexCliError(result?.error || 'Codex CLI test failed');
            }
        } catch (e: any) {
            setCodexCliStatus('error');
            setCodexCliError(e.message || 'Codex CLI test failed');
        }
    };

    const handleSaveKey = async (provider: string, key: string, setter: (val: string) => void) => {
        if (!key.trim()) return;
        setSavingStatus(prev => ({ ...prev, [provider]: true }));
        try {
            let result;
            // @ts-ignore
            if (provider === 'gemini') result = await window.electronAPI.setGeminiApiKey(key);
            // @ts-ignore
            if (provider === 'groq') result = await window.electronAPI.setGroqApiKey(key);
            // @ts-ignore
            if (provider === 'openai') result = await window.electronAPI.setOpenaiApiKey(key);
            // @ts-ignore
            if (provider === 'claude') result = await window.electronAPI.setClaudeApiKey(key);
            // @ts-ignore
            if (provider === 'deepseek') result = await window.electronAPI.setDeepseekApiKey(key);

            if (result && result.success) {
                setSavedStatus(prev => ({ ...prev, [provider]: true }));
                setHasStoredKey(prev => ({ ...prev, [provider]: true }));
                setter('');
                setTimeout(() => setSavedStatus(prev => ({ ...prev, [provider]: false })), 2000);
            }
        } catch (e) {
            console.error(`Failed to save ${provider} key:`, e);
        } finally {
            setSavingStatus(prev => ({ ...prev, [provider]: false }));
        }
    };

    // LiteLLM needs three fields (baseURL + optional key + optional max-tokens),
    // so it can't use the single-key ProviderCard contract. baseURL is required
    // to enable the proxy; maxTokens empty → backend default (8192).
    const handleSaveLitellm = async () => {
        const url = litellmBaseURL.trim();
        if (!url) return;
        setSavingStatus(prev => ({ ...prev, litellm: true }));
        try {
            const parsedMax = parseInt(litellmMaxTokens, 10);
            const result = await window.electronAPI.setLitellmConfig({
                apiKey: litellmApiKey.trim(),
                baseURL: url,
                maxTokens: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : undefined,
            });
            if (result && result.success) {
                setSavedStatus(prev => ({ ...prev, litellm: true }));
                setHasStoredKey(prev => ({ ...prev, litellm: true }));
                setLitellmApiKey('');
                setTimeout(() => setSavedStatus(prev => ({ ...prev, litellm: false })), 2000);
            }
        } catch (e) {
            console.error('Failed to save LiteLLM config:', e);
        } finally {
            setSavingStatus(prev => ({ ...prev, litellm: false }));
        }
    };

    const handleRemoveLitellm = async () => {
        if (!confirm('Удалить конфигурацию прокси LiteLLM?')) return;
        try {
            const result = await window.electronAPI.setLitellmConfig({ apiKey: '', baseURL: '' });
            if (result && result.success) {
                setHasStoredKey(prev => ({ ...prev, litellm: false }));
                setLitellmBaseURL('');
                setLitellmApiKey('');
                setLitellmMaxTokens('');
            }
        } catch (e) {
            console.error('Не удалось удалить конфигурацию LiteLLM:', e);
        }
    };

    const handleSaveYandex = async () => {
        const folderId = yandexFolderId.trim();
        const preferredModel = preferredModels.yandex || 'yandex/yandexgpt-5-lite';
        if (!folderId || (!yandexApiKey.trim() && !hasStoredKey.yandex)) return;
        setSavingStatus(prev => ({ ...prev, yandex: true }));
        try {
            const result = await window.electronAPI.setYandexConfig({
                apiKey: yandexApiKey.trim(),
                folderId,
                preferredModel,
                answerStylePackId: yandexAnswerStyleId,
                disableDataLogging: yandexDisableDataLogging,
            });
            if (result && result.success) {
                setSavedStatus(prev => ({ ...prev, yandex: true }));
                setHasStoredKey(prev => ({ ...prev, yandex: true }));
                setYandexApiKey('');
                setTimeout(() => setSavedStatus(prev => ({ ...prev, yandex: false })), 2000);
            } else if (result?.error) {
                setTestStatus(prev => ({ ...prev, yandex: 'error' }));
                setTestError(prev => ({ ...prev, yandex: result.error || 'Не удалось сохранить' }));
            }
        } catch (e: any) {
            setTestStatus(prev => ({ ...prev, yandex: 'error' }));
            setTestError(prev => ({ ...prev, yandex: e.message || 'Не удалось сохранить' }));
        } finally {
            setSavingStatus(prev => ({ ...prev, yandex: false }));
        }
    };

    const handleRemoveYandex = async () => {
        if (!confirm('Удалить конфигурацию Yandex AI Studio?')) return;
        try {
            const result = await window.electronAPI.removeYandexConfig();
            if (result && result.success) {
                setHasStoredKey(prev => ({ ...prev, yandex: false }));
                setYandexApiKey('');
                setYandexFolderId('');
                setYandexDisableDataLogging(true);
                setYandexAnswerStyleId(undefined);
                setPreferredModels(prev => {
                    const next = { ...prev };
                    delete next.yandex;
                    return next;
                });
                if (defaultModel.startsWith('yandex/')) {
                    setDefaultModel('gemini-3.1-flash-lite');
                }
            }
        } catch (e) {
            console.error('Не удалось удалить конфигурацию Yandex:', e);
        }
    };

    const handleYandexAnswerStyleChange = async (styleId: string) => {
        setYandexAnswerStyleId(styleId === 'automatic' ? undefined : styleId);
        const result = await window.electronAPI?.setAnswerStylePack?.(styleId, {
            provider: 'yandex',
            modelId: preferredModels.yandex || 'yandex/yandexgpt-5-lite',
        });
        if (result && !result.success) {
            setTestStatus(prev => ({ ...prev, yandex: 'error' }));
            setTestError(prev => ({ ...prev, yandex: result.error || 'Не удалось задать стиль ответа' }));
            return;
        }
        setYandexAnswerStyleId(result?.selectedId);
        if (result?.recommendedId) setYandexRecommendedAnswerStyleId(result.recommendedId);
        if (result?.automaticSummary) setYandexAnswerStyleSummary(result.automaticSummary);
    };

    const handleTestYandexConnection = async () => {
        if (!yandexFolderId.trim() || (!yandexApiKey.trim() && !hasStoredKey.yandex)) return;
        setTestStatus(prev => ({ ...prev, yandex: 'testing' }));
        setTestError(prev => ({ ...prev, yandex: '' }));
        try {
            const result = await window.electronAPI.testYandexConnection({
                apiKey: yandexApiKey.trim(),
                folderId: yandexFolderId.trim(),
                preferredModel: preferredModels.yandex || 'yandex/yandexgpt-5-lite',
                disableDataLogging: yandexDisableDataLogging,
            });
            if (result.success) {
                setTestStatus(prev => ({ ...prev, yandex: 'success' }));
                setTimeout(() => setTestStatus(prev => ({ ...prev, yandex: 'idle' })), 3000);
            } else {
                setTestStatus(prev => ({ ...prev, yandex: 'error' }));
                setTestError(prev => ({ ...prev, yandex: result.error || 'Подключение не удалось' }));
            }
        } catch (e: any) {
            setTestStatus(prev => ({ ...prev, yandex: 'error' }));
            setTestError(prev => ({ ...prev, yandex: e.message || 'Подключение не удалось' }));
        }
    };

    const handleRemoveKey = async (provider: string, setter: (val: string) => void) => {
        if (!confirm(`Удалить API-ключ ${provider}?`)) return;
        try {
            let result;
            // @ts-ignore
            if (provider === 'gemini') result = await window.electronAPI.setGeminiApiKey('');
            // @ts-ignore
            if (provider === 'groq') result = await window.electronAPI.setGroqApiKey('');
            // @ts-ignore
            if (provider === 'openai') result = await window.electronAPI.setOpenaiApiKey('');
            // @ts-ignore
            if (provider === 'claude') result = await window.electronAPI.setClaudeApiKey('');
            // @ts-ignore
            if (provider === 'deepseek') result = await window.electronAPI.setDeepseekApiKey('');

            if (result && result.success) {
                setHasStoredKey(prev => ({ ...prev, [provider]: false }));
                setter('');
            }
        } catch (e) {
            console.error(`Failed to remove ${provider} key:`, e);
        }
    };

    const handleTestConnection = async (provider: string, key: string) => {
        // Allow testing if key is provided OR if we have a stored key
        if (!key.trim() && !hasStoredKey[provider]) {
            return;
        }
        setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
        setTestError(prev => ({ ...prev, [provider]: '' }));

        try {
            // @ts-ignore
            const result = await window.electronAPI.testLlmConnection(provider, key);
            if (result.success) {
                setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
                setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: 'idle' })), 3000);
            } else {
                setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
                setTestError(prev => ({ ...prev, [provider]: result.error || 'Подключение не удалось' }));
            }
        } catch (e: any) {
            setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
            setTestError(prev => ({ ...prev, [provider]: e.message || 'Подключение не удалось' }));
        }
    };

    const openKeyUrl = (provider: string) => {
        const urls: Record<string, string> = {
            gemini: 'https://aistudio.google.com/app/apikey',
            groq: 'https://console.groq.com/keys',
            openai: 'https://platform.openai.com/api-keys',
            claude: 'https://console.anthropic.com/settings/keys'
        };
        // @ts-ignore
        window.electronAPI?.openExternal(urls[provider]);
    };


    // --- Custom Provider Handlers ---

    const handleEditProvider = (provider: CustomProvider) => {
        setEditingProvider(provider);
        setCustomName(provider.name);
        setCustomCurl(provider.curlCommand);
        setCustomResponsePath(provider.responsePath || '');
        setCustomVision(provider.multimodal === true ? 'on' : provider.multimodal === false ? 'off' : 'auto');
        setIsEditingCustom(true);
        setCurlError(null);
    };

    const handleNewProvider = () => {
        setEditingProvider(null);
        setCustomName('');
        setCustomCurl('');
        setCustomResponsePath('');
        setCustomVision('auto');
        setIsEditingCustom(true);
        setCurlError(null);
    };

    const handleSaveCustom = async () => {
        setCurlError(null);
        if (!customName.trim()) {
            setCurlError("Укажите имя провайдера.");
            return;
        }

        const validation = validateCurl(customCurl);
        if (!validation.isValid) {
            setCurlError(validation.message || "Некорректная cURL-команда.");
            return;
        }

        const newProvider: CustomProvider = {
            id: editingProvider ? editingProvider.id : crypto.randomUUID(),
            name: customName,
            curlCommand: customCurl,
            responsePath: customResponsePath,
            // 'auto' → omit the flag so the backend auto-detects from the template.
            ...(customVision === 'on' ? { multimodal: true } : customVision === 'off' ? { multimodal: false } : {}),
        };

        try {
            // @ts-ignore
            const result = await window.electronAPI.saveCustomProvider(newProvider);
            if (result.success) {
                // Refresh list
                // @ts-ignore
                const updated = await window.electronAPI.getCustomProviders();
                setCustomProviders(updated);
                setIsEditingCustom(false);
            } else {
                setCurlError(result.error ?? null);
            }
        } catch (e: any) {
            setCurlError(e.message);
        }
    };

    const handleDeleteCustom = async (id: string) => {
        if (!confirm("Удалить этого провайдера?")) return;
        try {
            // @ts-ignore
            const result = await window.electronAPI.deleteCustomProvider(id);
            if (result.success) {
                // @ts-ignore
                const updated = await window.electronAPI.getCustomProviders();
                setCustomProviders(updated);
            }
        } catch (e) {
            console.error("Не удалось удалить провайдера:", e);
        }
    };

    const yandexStyleOptions = answerStylePacks.length ? answerStylePacks : DEFAULT_ANSWER_STYLE_PACKS;
    const selectedYandexAnswerStyle = yandexStyleOptions.find(style => style.id === (yandexAnswerStyleId || 'automatic')) || yandexStyleOptions[0];
    const availableModelOptions = useMemo(() => {
        const opts: ModelOption[] = [];

        for (const [prov, cfg] of Object.entries(STANDARD_CLOUD_MODELS)) {
            if (!hasStoredKey[prov as keyof typeof hasStoredKey]) continue;
            cfg.ids.forEach((id, i) => opts.push({ id, name: cfg.names[i] }));
            const pm = preferredModels[prov as keyof typeof preferredModels];
            if (pm && !cfg.ids.includes(pm)) {
                opts.push({ id: pm, name: prettifyModelId(pm) });
            }
        }
        if (codexCliConfig.enabled) {
            opts.push({ id: CODEX_CLI_MODEL.id, name: `${CODEX_CLI_MODEL.name} (${prettifyModelId(codexCliConfig.model)})` });
            CODEX_CLI_MODEL_PRESETS.forEach(model => {
                const id = codexCliSelectorId(model.id);
                if (!opts.find(o => o.id === id)) {
                    opts.push({ id, name: `${CODEX_CLI_MODEL.name}: ${model.name}` });
                }
            });
        }
        customProviders.forEach(p => opts.push({ id: p.id, name: p.name }));
        ollamaModels.forEach(m => opts.push({ id: `ollama-${m}`, name: `${m} (локально)` }));

        if (defaultModel && !opts.find(o => o.id === defaultModel)) {
            opts.unshift({ id: defaultModel, name: prettifyModelId(defaultModel) });
        }
        return opts;
    }, [codexCliConfig.enabled, codexCliConfig.model, customProviders, defaultModel, hasStoredKey, ollamaModels, preferredModels]);

    const saveTaskPolicy = async (next: TaskModelPolicy, savingKey: AiTask | 'default') => {
        setTaskPolicySaving(savingKey);
        setTaskModelPolicy(next);
        try {
            const result = await window.electronAPI?.setTaskModelPolicy?.(next as any);
            if (result?.policy) setTaskModelPolicy(result.policy as TaskModelPolicy);
        } catch (error) {
            console.error('Failed to save task model policy:', error);
        } finally {
            setTaskPolicySaving(null);
        }
    };

    return (
        <div className="space-y-5 animated fadeIn pb-10">
            {/* Модель по умолчанию для чата */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Модель по умолчанию для чата</h3>
                    <p className="text-xs text-text-secondary mb-2">Основная модель для новых чатов. Остальные настроенные модели используются как резервные.</p>
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between">
                    <div>
                        <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0">Активная модель</label>
                        <p className="text-[10px] text-text-secondary">Сразу применяется к новым чатам.</p>
                    </div>
                    <ModelSelect
                        value={defaultModel}
                        options={availableModelOptions}
                        onChange={(val) => {
                            setDefaultModel(val);
                            if (taskModelPolicy) {
                                void saveTaskPolicy({
                                    ...taskModelPolicy,
                                    defaultModelId: val,
                                    updatedAt: new Date().toISOString(),
                                }, 'default');
                            }
                            // @ts-ignore - persist as default + update runtime + broadcast
                            window.electronAPI?.setDefaultModel(val).catch(console.error);
                        }}
                    />
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-text-primary mb-1">Модели для задач</h3>
                            <p className="text-xs text-text-secondary">По умолчанию эти задачи используют активную модель чата. Закрепите отдельную модель только там, где это нужно.</p>
                        </div>
                        <span className="shrink-0 rounded border border-border-subtle bg-bg-input px-2 py-1 text-[10px] font-medium text-text-secondary">
                            {taskPolicySaving ? 'Сохранение...' : 'Авто'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {TASK_MODEL_ROWS.map(row => {
                            const override = taskModelPolicy?.tasks?.[row.task];
                            const mode = override?.mode ?? 'default';
                            const pinnedModel = override?.modelId || taskModelPolicy?.defaultModelId || defaultModel;
                            const updateTask = (nextMode: TaskModelMode, modelId?: string) => {
                                const base: TaskModelPolicy = taskModelPolicy ?? {
                                    version: 1,
                                    defaultModelId: defaultModel,
                                    tasks: {},
                                    updatedAt: new Date().toISOString(),
                                };
                                const next: TaskModelPolicy = {
                                    ...base,
                                    defaultModelId: base.defaultModelId || defaultModel,
                                    tasks: {
                                        ...base.tasks,
                                        [row.task]: nextMode === 'pinned'
                                            ? { mode: 'pinned', modelId: modelId || pinnedModel, quality: 'balanced' }
                                            : { mode: nextMode, quality: 'balanced' },
                                    },
                                    updatedAt: new Date().toISOString(),
                                };
                                void saveTaskPolicy(next, row.task);
                            };
                            return (
                                <div key={row.task} className="grid grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-bg-card/60 p-3 md:grid-cols-[1fr_190px_240px] md:items-center">
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-text-primary">{row.title}</div>
                                        <div className="mt-0.5 text-[10px] text-text-secondary">{row.description}</div>
                                    </div>
                                    <select
                                        value={mode}
                                        onChange={(event) => updateTask(event.target.value as TaskModelMode)}
                                        className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-primary"
                                    >
                                        <option value="default">Как активная модель</option>
                                        <option value="auto">Авто по задаче</option>
                                        <option value="pinned">Закрепить модель</option>
                                    </select>
                                    <ModelSelect
                                        value={pinnedModel}
                                        options={availableModelOptions}
                                        onChange={(modelId) => updateTask('pinned', modelId)}
                                        className={mode === 'pinned' ? '' : 'opacity-60'}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Быстрые ответы */}
                <div
                    className={`bg-bg-item-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between gap-4 ${!canUseFastMode ? 'opacity-50 grayscale' : ''}`}
                    title={!canUseFastMode ? "Сначала настройте Groq или Codex CLI" : ""}
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0">Быстрые ответы</label>
                            <span className="bg-orange-500/10 text-orange-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-orange-500/20">НОВОЕ</span>
                        </div>
                        <p className="text-[10px] text-text-secondary mt-0.5">Очень быстрые ответы через быструю модель Codex CLI или Groq. Отключите режим, чтобы использовать обычную выбранную модель.</p>
                        {!canUseFastMode && (
                            <p className="text-[10px] text-orange-500 mt-0.5 font-medium">Требуется настроенный Groq или Codex CLI.</p>
                        )}
                    </div>
                    <div
                        onClick={async () => {
                            if (!canUseFastMode) {
                                alert("Сначала настройте Groq или Codex CLI, чтобы включить быстрые ответы.");
                                return;
                            }
                            const newState = !fastResponseMode;
                            setFastResponseMode(newState);
                            localStorage.setItem('natively_groq_fast_text', String(newState));
                            // @ts-ignore
                            await window.electronAPI?.setGroqFastTextMode(newState);
                        }}
                        className={`shrink-0 w-11 h-6 rounded-full relative cursor-pointer transition-colors ${!canUseFastMode ? 'cursor-not-allowed bg-bg-toggle-switch' : fastResponseMode ? 'bg-orange-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${fastResponseMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                </div>
            </div>

            {/* Облачные провайдеры */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Облачные провайдеры</h3>
                    <p className="text-xs text-text-secondary mb-2">Добавьте API-ключи, чтобы открыть облачные AI-модели.</p>
                </div>

                <div className="space-y-4">

                    {/* Gemini */}
                    <ProviderCard
                        providerId="gemini"
                        providerName="Gemini"
                        apiKey={apiKey}
                        preferredModel={preferredModels.gemini}
                        hasStoredKey={!!hasStoredKey.gemini}
                        onKeyChange={setApiKey}
                        onSaveKey={async () => { await handleSaveKey('gemini', apiKey, setApiKey); }}
                        onRemoveKey={() => handleRemoveKey('gemini', setApiKey)}
                        onTestConnection={() => handleTestConnection('gemini', apiKey)}
                        testStatus={testStatus.gemini || 'idle'}
                        testError={testError.gemini}
                        savingStatus={!!savingStatus.gemini}
                        savedStatus={!!savedStatus.gemini}
                        keyPlaceholder="AIzaSy..."
                        keyUrl="https://aistudio.google.com/app/apikey"
                        onPreferredModelChange={(model) => setPreferredModels(prev => ({ ...prev, gemini: model }))}
                    />

                    {/* Groq */}
                    <ProviderCard
                        providerId="groq"
                        providerName="Groq"
                        apiKey={groqApiKey}
                        preferredModel={preferredModels.groq}
                        hasStoredKey={!!hasStoredKey.groq}
                        onKeyChange={setGroqApiKey}
                        onSaveKey={async () => { await handleSaveKey('groq', groqApiKey, setGroqApiKey); }}
                        onRemoveKey={() => handleRemoveKey('groq', setGroqApiKey)}
                        onTestConnection={() => handleTestConnection('groq', groqApiKey)}
                        testStatus={testStatus.groq || 'idle'}
                        testError={testError.groq}
                        savingStatus={!!savingStatus.groq}
                        savedStatus={!!savedStatus.groq}
                        keyPlaceholder="gsk_..."
                        keyUrl="https://console.groq.com/keys"
                        onPreferredModelChange={(model) => setPreferredModels(prev => ({ ...prev, groq: model }))}
                    />

                    {/* OpenAI */}
                    <ProviderCard
                        providerId="openai"
                        providerName="OpenAI"
                        apiKey={openaiApiKey}
                        preferredModel={preferredModels.openai}
                        hasStoredKey={!!hasStoredKey.openai}
                        onKeyChange={setOpenaiApiKey}
                        onSaveKey={async () => { await handleSaveKey('openai', openaiApiKey, setOpenaiApiKey); }}
                        onRemoveKey={() => handleRemoveKey('openai', setOpenaiApiKey)}
                        onTestConnection={() => handleTestConnection('openai', openaiApiKey)}
                        testStatus={testStatus.openai || 'idle'}
                        testError={testError.openai}
                        savingStatus={!!savingStatus.openai}
                        savedStatus={!!savedStatus.openai}
                        keyPlaceholder="sk-..."
                        keyUrl="https://platform.openai.com/api-keys"
                        onPreferredModelChange={(model) => setPreferredModels(prev => ({ ...prev, openai: model }))}
                    />

                    {/* Claude */}
                    <ProviderCard
                        providerId="claude"
                        providerName="Claude"
                        apiKey={claudeApiKey}
                        preferredModel={preferredModels.claude}
                        hasStoredKey={!!hasStoredKey.claude}
                        onKeyChange={setClaudeApiKey}
                        onSaveKey={async () => { await handleSaveKey('claude', claudeApiKey, setClaudeApiKey); }}
                        onRemoveKey={() => handleRemoveKey('claude', setClaudeApiKey)}
                        onTestConnection={() => handleTestConnection('claude', claudeApiKey)}
                        testStatus={testStatus.claude || 'idle'}
                        testError={testError.claude}
                        savingStatus={!!savingStatus.claude}
                        savedStatus={!!savedStatus.claude}
                        keyPlaceholder="sk-ant-..."
                        keyUrl="https://console.anthropic.com/settings/keys"
                        onPreferredModelChange={(model) => setPreferredModels(prev => ({ ...prev, claude: model }))}
                    />

                    {/* DeepSeek — text-only; intentionally not part of the screenshot/vision fallback chain. */}
                    <ProviderCard
                        providerId="deepseek"
                        providerName="DeepSeek"
                        apiKey={deepseekApiKey}
                        preferredModel={preferredModels.deepseek}
                        hasStoredKey={!!hasStoredKey.deepseek}
                        onKeyChange={setDeepseekApiKey}
                        onSaveKey={async () => { await handleSaveKey('deepseek', deepseekApiKey, setDeepseekApiKey); }}
                        onRemoveKey={() => handleRemoveKey('deepseek', setDeepseekApiKey)}
                        onTestConnection={() => handleTestConnection('deepseek', deepseekApiKey)}
                        testStatus={testStatus.deepseek || 'idle'}
                        testError={testError.deepseek}
                        savingStatus={!!savingStatus.deepseek}
                        savedStatus={!!savedStatus.deepseek}
                        keyPlaceholder="sk-..."
                        keyUrl="https://platform.deepseek.com/api_keys"
                        onPreferredModelChange={(model) => setPreferredModels(prev => ({ ...prev, deepseek: model }))}
                    />

                    {/* Yandex AI Studio — text-only OpenAI-compatible provider with folder-scoped model URIs. */}
                    <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <label className="block text-xs font-bold text-text-primary mb-0">Yandex AI Studio</label>
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-border-subtle text-text-secondary">Свой ключ</span>
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-border-subtle text-text-secondary">Только текст</span>
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-sky-500/20 text-sky-500">Стили ответа</span>
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-500">Логи выкл.</span>
                                </div>
                                <p className="text-[10px] text-text-secondary mt-1">
                                    Использует ваш ключ Yandex AI Studio и ID каталога. Автоматический режим выбирает рекомендованное поведение ответа для текущей модели и языка AI-ответа.{' '}
                                    <a href="https://aistudio.yandex.ru/docs/ru/ai-studio/quickstart/" target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">Документация</a>
                                </p>
                            </div>
                            {hasStoredKey.yandex && (
                                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide shrink-0">Настроено</span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1 block">
                                <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">API-ключ</span>
                                <input
                                    type="password"
                                    value={yandexApiKey}
                                    onChange={e => setYandexApiKey(e.target.value)}
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                    placeholder={hasStoredKey.yandex ? '•••••••• (оставьте пустым, чтобы сохранить текущий)' : 'y0_...'}
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">ID каталога</span>
                                <input
                                    value={yandexFolderId}
                                    onChange={e => setYandexFolderId(e.target.value)}
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                    placeholder="b1g..."
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
                            <div className="space-y-1 min-w-0">
                                <span className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide">Модель</span>
                                <ModelSelect
                                    value={preferredModels.yandex || 'yandex/yandexgpt-5-lite'}
                                    options={STANDARD_CLOUD_MODELS.yandex.ids.map((id, i) => ({ id, name: STANDARD_CLOUD_MODELS.yandex.names[i] }))}
                                    onChange={async (model) => {
                                        setPreferredModels(prev => ({ ...prev, yandex: model }));
                                        await window.electronAPI?.setProviderPreferredModel?.('yandex', model);
                                        await loadYandexAnswerStyle(model);
                                    }}
                                    placeholder="YandexGPT 5 Lite"
                                    className="py-2"
                                />
                            </div>

                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide">Стиль ответа</span>
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-500 truncate">
                                        {yandexRecommendedAnswerStyleId === 'automatic' ? 'Авто' : 'Рекомендовано'}
                                    </span>
                                </div>
                                <ModelSelect
                                    value={yandexAnswerStyleId || 'automatic'}
                                    options={yandexStyleOptions.map(style => ({
                                        id: style.id,
                                        name: `${style.label}${style.recommended ? ' (рекомендовано)' : ''}`,
                                    }))}
                                    onChange={handleYandexAnswerStyleChange}
                                    placeholder="Стиль ответа"
                                    className="py-2"
                                />
                                <p className="text-[10px] text-text-secondary">
                                    {selectedYandexAnswerStyle?.id === 'automatic' ? yandexAnswerStyleSummary : (selectedYandexAnswerStyle?.sample || selectedYandexAnswerStyle?.description)}
                                    <span className="text-text-tertiary"> Язык: {yandexAnswerStyleLanguage}</span>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setYandexDisableDataLogging(!yandexDisableDataLogging)}
                                className="flex items-center justify-between gap-3 min-w-0 w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated transition-colors"
                            >
                                <span>Логирование запросов</span>
                                <span className={`font-medium ${yandexDisableDataLogging ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {yandexDisableDataLogging ? 'Выкл.' : 'Вкл.'}
                                </span>
                            </button>
                        </div>

                        <p className="text-[10px] text-text-secondary">
                            Отправляет <span className="font-mono">x-data-logging-enabled: false</span> при проверке подключения, генерации и стриминге, когда логирование выключено.
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSaveYandex}
                                disabled={!yandexFolderId.trim() || (!yandexApiKey.trim() && !hasStoredKey.yandex) || !!savingStatus.yandex}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary text-white disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                            >
                                {savingStatus.yandex ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {savingStatus.yandex ? 'Сохранение...' : savedStatus.yandex ? 'Сохранено' : 'Сохранить'}
                            </button>
                            <button
                                type="button"
                                onClick={handleTestYandexConnection}
                                disabled={!yandexFolderId.trim() || (!yandexApiKey.trim() && !hasStoredKey.yandex) || testStatus.yandex === 'testing'}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-border-subtle flex items-center gap-1.5 ${testStatus.yandex === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    testStatus.yandex === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                        'bg-bg-input hover:bg-bg-elevated text-text-primary'
                                    }`}
                            >
                                {testStatus.yandex === 'testing' ? <><Loader2 size={12} className="animate-spin" /> Проверка...</> :
                                    testStatus.yandex === 'success' ? <><CheckCircle size={12} /> Подключено</> :
                                        testStatus.yandex === 'error' ? <><AlertCircle size={12} /> Ошибка</> :
                                            <>Проверить подключение</>}
                            </button>
                            {hasStoredKey.yandex && (
                                <button
                                    type="button"
                                    onClick={handleRemoveYandex}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-red-500 transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 size={12} />
                                    Удалить
                                </button>
                            )}
                        </div>

                        {testError.yandex && <p className="text-[10px] text-red-400 mt-1.5">{testError.yandex}</p>}
                    </div>

                    {/* LiteLLM — OpenAI-compatible AI gateway (100+ providers via one proxy).
                        Three fields: proxy base URL (required), optional virtual key, and an
                        optional max-output-tokens override. Models are auto-discovered from
                        the proxy and appear in the model selector with a "litellm/" prefix. */}
                    <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-xs font-bold text-text-primary mb-0">LiteLLM Proxy</label>
                                <p className="text-[10px] text-text-secondary">
                                    OpenAI-совместимый шлюз к 100+ провайдерам. Модели автоматически обнаруживаются через прокси.{' '}
                                    <a href="https://docs.litellm.ai/docs/simple_proxy" target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">Документация</a>
                                </p>
                            </div>
                            {hasStoredKey.litellm && (
                                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">Настроено</span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1 block">
                                <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Базовый URL прокси</span>
                                <input
                                    value={litellmBaseURL}
                                    onChange={e => setLitellmBaseURL(e.target.value)}
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                    placeholder="http://localhost:4000/v1"
                                />
                            </label>

                            <label className="space-y-1 block">
                                <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Виртуальный ключ (необязательно)</span>
                                <input
                                    type="password"
                                    value={litellmApiKey}
                                    onChange={e => setLitellmApiKey(e.target.value)}
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                    placeholder={hasStoredKey.litellm ? '•••••••• (оставьте пустым, чтобы сохранить текущий)' : 'sk-... (если прокси требует авторизацию)'}
                                />
                            </label>
                        </div>

                        <div className="space-y-1">
                            <span className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide">Макс. токенов ответа</span>
                            <ModelSelect
                                value={litellmMaxTokens}
                                options={LITELLM_MAX_TOKENS_OPTIONS}
                                onChange={setLitellmMaxTokens}
                                placeholder="Авто (по модели)"
                                className="py-2"
                            />
                            <p className="text-[10px] text-text-secondary">
                                Авто читает реальный лимит ответа каждой модели из <span className="font-mono">/model/info</span> прокси (если недоступно, используется 8 192). Выберите фиксированное значение, чтобы переопределить.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSaveLitellm}
                                disabled={!litellmBaseURL.trim() || !!savingStatus.litellm}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary text-white disabled:opacity-50 transition-opacity"
                            >
                                {savingStatus.litellm ? 'Сохранение…' : savedStatus.litellm ? 'Сохранено ✓' : 'Сохранить'}
                            </button>
                            {hasStoredKey.litellm && (
                                <button
                                    type="button"
                                    onClick={handleRemoveLitellm}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Удалить
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Local (Codex CLI) Provider */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Локальный провайдер (Codex CLI)</h3>
                    <p className="text-xs text-text-secondary">Отправляйте текстовые ответы и ответы по скриншотам через локально авторизованный Codex CLI.</p>
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0">Включить Codex CLI</label>
                            <p className="text-[10px] text-text-secondary">Добавляет Codex CLI как выбираемый локальный бэкенд и резервный вариант.</p>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const next = { ...codexCliConfig, enabled: !codexCliConfig.enabled };
                                await saveCodexCliConfig(next);
                            }}
                            className={`w-11 h-6 rounded-full relative transition-colors ${codexCliConfig.enabled ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${codexCliConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-1">
                            <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Исполняемый файл</span>
                            <input
                                value={codexCliConfig.path}
                                onChange={e => setCodexCliConfig(prev => ({ ...prev, path: e.target.value }))}
                                onBlur={() => saveCodexCliConfig()}
                                className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                placeholder="codex"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Таймаут (мс)</span>
                            <input
                                type="number"
                                value={codexCliConfig.timeoutMs}
                                onChange={e => setCodexCliConfig(prev => ({ ...prev, timeoutMs: Number(e.target.value) }))}
                                onBlur={() => saveCodexCliConfig()}
                                className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                                min={1000}
                            />
                        </label>
                        <CodexCliModelField
                            label="Обычная модель"
                            value={codexCliConfig.model}
                            placeholder="gpt-5.5"
                            onChange={(model) => setCodexCliConfig(prev => ({ ...prev, model }))}
                            onSelect={(model) => saveCodexCliConfig({ ...codexCliConfig, model })}
                            onSave={() => saveCodexCliConfig()}
                        />
                        <CodexCliModelField
                            label="Быстрая модель"
                            value={codexCliConfig.fastModel}
                            placeholder="gpt-5.3-codex-spark"
                            onChange={(fastModel) => setCodexCliConfig(prev => ({ ...prev, fastModel }))}
                            onSelect={(fastModel) => saveCodexCliConfig({ ...codexCliConfig, fastModel })}
                            onSave={() => saveCodexCliConfig()}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-1">
                            <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Уровень сервиса</span>
                            <ModelSelect
                                value={codexCliConfig.serviceTier ?? 'default'}
                                options={CODEX_SERVICE_TIERS.map(t => ({ id: t, name: t.charAt(0).toUpperCase() + t.slice(1) }))}
                                onChange={(serviceTier) => saveCodexCliConfig({ ...codexCliConfig, serviceTier: serviceTier as typeof CODEX_SERVICE_TIERS[number] })}
                                placeholder="default"
                            />
                            <p className="text-[9px] text-text-tertiary">Используйте более быстрый уровень сервиса, если он доступен. Только Codex Cloud.</p>
                        </label>
                        <label className="space-y-1">
                            <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Усилие рассуждения</span>
                            <ModelSelect
                                value={codexCliConfig.modelReasoningEffort ?? ''}
                                options={[
                                    { id: '', name: 'Нет' },
                                    ...CODEX_MODEL_REASONING_EFFORTS.map(e => ({ id: e, name: e.charAt(0).toUpperCase() + e.slice(1) })),
                                ]}
                                onChange={(effort) => saveCodexCliConfig({ ...codexCliConfig, modelReasoningEffort: effort || undefined })}
                                placeholder="Нет"
                            />
                            <p className="text-[9px] text-text-tertiary">Сколько рассуждения использует модель. Зависит от модели.</p>
                        </label>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="min-h-5">
                            {codexCliStatus === 'success' && (
                                <div className="flex items-center gap-2 text-xs text-green-400">
                                    <CheckCircle size={14} />
                                    <span>Codex CLI найден</span>
                                </div>
                            )}
                            {codexCliStatus === 'error' && (
                                <div className="flex items-center gap-2 text-xs text-red-400">
                                    <AlertCircle size={14} />
                                    <span>{codexCliError}</span>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleTestCodexCli}
                            disabled={codexCliStatus === 'testing'}
                            className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors disabled:opacity-60"
                        >
                            {codexCliStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Проверить CLI
                        </button>
                    </div>
                </div>
            </div>

            {/* Local (Ollama) Providers */}
            <div className="space-y-5">
                <div className="flex items-center justify-between mb-2">
                    <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Локальные модели (Ollama)</h3>
                    <p className="text-xs text-text-secondary">Запускайте open-source модели локально.</p>
                    </div>
                    <button
                        onClick={async () => {
                            setIsRefreshingOllama(true);
                            await checkOllama(false);
                            // Add a small delay for visual feedback if the check is too fast
                            setTimeout(() => setIsRefreshingOllama(false), 500);
                        }}
                        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors"
                        title="Обновить Ollama"
                        disabled={isRefreshingOllama}
                    >
                        <RefreshCw size={18} className={isRefreshingOllama ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
                    {ollamaStatus === 'checking' && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span className="animate-spin">⏳</span> Проверяем Ollama...
                        </div>
                    )}

                    {ollamaStatus === 'fixing' && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span className="animate-spin">🔧</span> Пытаемся автоматически исправить подключение...
                        </div>
                    )}

                    {ollamaStatus === 'not-found' && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs text-red-400">
                                <AlertCircle size={14} />
                                <span>Ollama не обнаружен</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-text-secondary">
                                    Убедитесь, что Ollama запущен (`ollama serve`).
                                </p>
                                <button
                                    onClick={handleFixOllama}
                                    className="text-[10px] bg-bg-elevated hover:bg-bg-input px-2 py-1 rounded border border-border-subtle"
                                >
                                    Автоисправление
                                </button>
                            </div>
                        </div>
                    )}

                    {ollamaStatus === 'detected' && ollamaModels.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-green-400 mb-3">
                                <CheckCircle size={14} />
                                <span>Ollama подключен</span>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {ollamaModels.map(model => (
                                    <div key={model} className="flex items-center justify-between p-2 bg-bg-input rounded-lg border border-border-subtle">
                                        <span className="text-xs text-text-primary font-mono">{model}</span>
                                        <span className="text-[10px] text-bg-elevated bg-text-secondary px-1.5 py-0.5 rounded-full font-bold">ЛОКАЛЬНО</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {ollamaStatus === 'detected' && ollamaModels.length === 0 && (
                        <div className="text-xs text-text-secondary">
                            Ollama запущен, но модели не найдены. Выполните `ollama pull llama3`, чтобы начать.
                        </div>
                    )}
                </div>
            </div>

            {/* Пользовательские провайдеры */}
            <div className="space-y-5">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-text-primary">Пользовательские провайдеры</h3>
                            <span className="px-1.5 py-0 rounded-full text-[7px] font-bold bg-yellow-500/10 text-yellow-500 uppercase tracking-widest border border-yellow-500/20 leading-loose mt-0.5">Экспериментально</span>
                        </div>
                        <p className="text-xs text-text-secondary">Добавьте свои AI-эндпоинты через cURL.</p>
                    </div>
                    {!isEditingCustom && (
                        <button
                            onClick={handleNewProvider}
                            className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors"
                        >
                            <Plus size={14} /> Добавить провайдера
                        </button>
                    )}
                </div>

                {isEditingCustom ? (
                    <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle animated fadeIn">
                        <h4 className="text-sm font-bold text-text-primary mb-4">{editingProvider ? 'Редактировать провайдера' : 'Новый провайдер'}</h4>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">Имя провайдера</label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="Мой LLM-провайдер"
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">cURL-команда</label>
                                <div className="relative">
                                    <textarea
                                        value={customCurl}
                                        onChange={(e) => setCustomCurl(e.target.value)}
                                        placeholder={`curl https://api.openai.com/v1/chat/completions ... "content": "{{TEXT}}"`}
                                        className="w-full h-32 bg-bg-input border border-border-subtle rounded-lg p-4 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary transition-colors resize-none leading-relaxed"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">
                                    JSON-путь ответа <span className="text-text-tertiary normal-case font-normal">(необязательно)</span>
                                </label>
                                <input
                                    type="text"
                                    value={customResponsePath}
                                    onChange={(e) => setCustomResponsePath(e.target.value)}
                                    placeholder="например choices[0].message.content"
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors font-mono"
                                />
                                <p className="text-[10px] text-text-secondary mt-1">
                                    Путь через точки к тексту ответа в JSON. Если пусто, вернется весь JSON.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">
                                    Поддержка скриншотов / vision
                                </label>
                                <select
                                    value={customVision}
                                    onChange={(e) => setCustomVision(e.target.value as 'auto' | 'on' | 'off')}
                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                >
                                    <option value="auto">Автоопределение (рекомендовано)</option>
                                    <option value="on">Всегда отправлять скриншоты</option>
                                    <option value="off">Никогда не отправлять скриншоты (только текст)</option>
                                </select>
                                <p className="text-[10px] text-text-secondary mt-1">
                                    Автоопределение включает vision, если cURL использует <code className="font-mono">{"{{IMAGE_BASE64}}"}</code> или тело <code className="font-mono">messages</code> в стиле OpenAI. Выбирайте «Всегда» только если эндпоинт принимает изображения другим способом; «Никогда» исключает провайдера из анализа скриншотов.
                                </p>
                            </div>

                            <div className="bg-bg-elevated/30 rounded-lg overflow-hidden border border-border-subtle mt-4">
                                <div className="px-4 py-3 bg-bg-elevated/50 border-b border-border-subtle flex items-center justify-between">
                                    <h5 className="block text-xs font-medium text-text-primary uppercase tracking-wide">
                                        Руководство по настройке
                                    </h5>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div>
                                        <p className="text-xs text-text-secondary mb-2 font-medium">Доступные переменные</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <code className="bg-bg-input px-1.5 py-0.5 rounded text-text-primary font-mono border border-border-subtle">{"{{TEXT}}"}</code>
                                                <span className="text-text-tertiary">Объединенные System + Context + Message (рекомендовано)</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <code className="bg-bg-input px-1.5 py-0.5 rounded text-text-primary font-mono border border-border-subtle">{"{{IMAGE_BASE64}}"}</code>
                                                <span className="text-text-tertiary">Данные скриншота (если доступны)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-text-secondary mb-2 font-medium">Примеры</p>
                                        <div className="space-y-3">
                                            {/* Ollama Example */}
                                            <div>
                                                <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">Локально (Ollama)</div>
                                                <div className="bg-bg-input p-2.5 rounded-lg border border-border-subtle overflow-x-auto group relative">
                                                    <code className="font-mono text-[10px] text-text-primary whitespace-pre block">
                                                        curl http://localhost:11434/api/generate -d '{"{"}"model": "llama3", "prompt": "{`{{TEXT}}`}"{"}"}'
                                                    </code>
                                                </div>
                                            </div>

                                            {/* OpenAI Example */}
                                            <div>
                                                <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">OpenAI-совместимый</div>
                                                <div className="bg-bg-input p-2.5 rounded-lg border border-border-subtle overflow-x-auto">
                                                    <code className="font-mono text-[10px] text-text-primary whitespace-pre block">
                                                        {`curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "{{TEXT}}"}
    ],
    "temperature": 0.7
  }'`}
                                                    </code>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {curlError && (
                                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    <span>{curlError}</span>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setIsEditingCustom(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSaveCustom}
                                    className="px-4 py-2 rounded-lg text-xs font-medium bg-accent-primary text-white hover:bg-accent-secondary transition-colors flex items-center gap-2"
                                >
                                    <Save size={14} /> Сохранить провайдера
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {customProviders.length === 0 ? (
                            <div className="text-center py-8 bg-bg-item-surface rounded-xl border border-border-subtle border-dashed">
                                <p className="text-xs text-text-tertiary">Пользовательские провайдеры пока не добавлены.</p>
                            </div>
                        ) : (
                            customProviders.map((provider) => (
                                <div key={provider.id} className="bg-bg-item-surface rounded-xl p-4 border border-border-subtle flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-bg-input flex items-center justify-center text-text-secondary font-mono text-xs font-bold">
                                            {provider.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-text-primary">{provider.name}</h4>
                                            <p className="text-[10px] text-text-tertiary font-mono truncate max-w-[200px] opacity-60">
                                                {provider.curlCommand.substring(0, 30)}...
                                            </p>
                                            {provider.responsePath && (
                                                <p className="text-[9px] text-text-tertiary font-mono opacity-40 mt-0.5">
                                                    путь: {provider.responsePath}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditProvider(provider)}
                                            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                                            title="Редактировать"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCustom(provider.id)}
                                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Удалить"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

            {/* Понимание экрана — маршрутизация через vision */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Понимание экрана</h3>
                    <p className="text-xs text-text-secondary mb-2">Выберите, как OpenOffer читает содержимое экрана. Все варианты напрямую используют AI-провайдера с vision; OCR больше не применяется.</p>
                </div>
                <div className="bg-bg-item-surface rounded-xl p-4 border border-border-subtle flex flex-col gap-2">
                    {([
                        {
                            value: 'vision_first' as const,
                            label: 'Сначала vision',
                            description: 'Рекомендовано. По очереди пробует всех настроенных vision-провайдеров; используется первый успешный.',
                        },
                        {
                            value: 'vision_only' as const,
                            label: 'Только vision',
                            description: 'Более строгий режим. Требует vision-провайдера и никогда молча не отбрасывает скриншот.',
                        },
                        {
                            value: 'private_vision' as const,
                            label: 'Приватный vision (только локально)',
                            description: 'Использует только локальную vision-модель (Ollama). Не вызывает облачный vision. Если локальный провайдер не настроен, показывает явную ошибку.',
                        },
                    ]).map(({ value, label, description }) => {
                        const selected = screenUnderstandingMode === value;
                        return (
                            <div
                                key={value}
                                onClick={() => {
                                    setScreenUnderstandingMode(value);
                                    window.electronAPI?.setScreenUnderstandingMode?.(value);
                                }}
                                className={`px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border-subtle hover:border-border-muted bg-bg-elevated/50'}`}
                                role="radio"
                                aria-checked={selected}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-semibold ${selected ? 'text-emerald-300' : 'text-text-primary'}`}>{label}</span>
                                        <span className="text-[11px] text-text-secondary leading-snug mt-0.5">{description}</span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${selected ? 'border-emerald-400 bg-emerald-400' : 'border-border-muted'}`} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-border-subtle">
                        <div className="flex flex-col">
                            <span className="text-xs text-text-primary font-semibold">Прямой vision для технических интервью</span>
                            <span className="text-[11px] text-text-secondary leading-snug mt-0.5">Использует профиль изображения с максимальным разрешением, чтобы текст кода оставался четким в режиме интервью.</span>
                        </div>
                        <div
                            onClick={() => {
                                const next = !technicalInterviewVisionFirst;
                                setTechnicalInterviewVisionFirst(next);
                                const api: any = window.electronAPI;
                                if (api?.setTechnicalInterviewVisionFirst) {
                                    api.setTechnicalInterviewVisionFirst(next);
                                } else {
                                    window.electronAPI?.setTechnicalInterviewDirectVision?.(next);
                                }
                            }}
                            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${technicalInterviewVisionFirst ? 'bg-emerald-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                            role="switch"
                            aria-checked={technicalInterviewVisionFirst}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${technicalInterviewVisionFirst ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Области данных облачных провайдеров */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Данные для облачных провайдеров</h3>
                    <p className="text-xs text-text-secondary mb-2">Управляйте тем, к каким данным могут обращаться облачные AI-провайдеры. Отключенные типы обрабатываются локально для приватности.</p>
                </div>
                <div className="bg-bg-item-surface rounded-xl p-4 border border-border-subtle flex flex-col gap-2">
                    {([
                        { key: 'transcript', label: 'Транскрипты' },
                        { key: 'screenshots', label: 'Скриншоты' },
                        { key: 'reference_files', label: 'Справочные файлы' },
                        { key: 'profile_history', label: 'История профиля' },
                        { key: 'embeddings', label: 'Облачные эмбеддинги' },
                        { key: 'post_call_summary', label: 'Саммари после звонка' },
                    ] as const).map(({ key, label }) => {
                        const allowed = providerDataScopes[key] !== false;
                        return (
                            <div key={key} className="flex items-center justify-between">
                                <span className="text-xs text-text-secondary">{label}</span>
                                <div
                                    onClick={() => {
                                        const next = { ...providerDataScopes, [key]: !allowed };
                                        setProviderDataScopes(next);
                                        window.electronAPI?.setProviderDataScopes?.(next);
                                    }}
                                    className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${allowed ? 'bg-emerald-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                    role="switch"
                                    aria-checked={allowed}
                                    aria-label={`Разрешить облачным провайдерам: ${label}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${allowed ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-start gap-2 mt-1 pt-3 border-t border-border-subtle">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        <p className="text-[11px] text-text-tertiary leading-relaxed">Когда тип данных отключен, OpenOffer переключается на лучшую доступную локальную модель, чтобы оставить эти данные на устройстве.</p>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};
