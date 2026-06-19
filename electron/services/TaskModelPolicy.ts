export type AiTask = 'chat' | 'vacancy_intake' | 'scraping' | 'retro' | 'agent_actions';

export type TaskModelMode = 'default' | 'auto' | 'pinned';
export type TaskModelAvailability = 'available' | 'missing_credentials' | 'provider_disabled' | 'model_unavailable';

export interface TaskModelOverride {
  mode: TaskModelMode;
  modelId?: string;
  quality?: 'fast' | 'balanced' | 'quality';
}

export interface TaskModelPolicy {
  version: 1;
  defaultModelId: string | null;
  seededFromProviderPreferred?: boolean;
  tasks: Partial<Record<AiTask, TaskModelOverride>>;
  updatedAt: string;
}

export interface TaskModelResolution {
  task: AiTask;
  requestedMode: TaskModelMode;
  resolvedModelId: string | null;
  availability: TaskModelAvailability;
  fallbackUsed: boolean;
  warnings: string[];
}

export interface TaskModelResolveOptions {
  overrideModelId?: string | null;
  now?: string;
}

export interface TaskModelCredentialSnapshot {
  geminiApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  deepseekApiKey?: string;
  yandexApiKey?: string;
  yandexFolderId?: string;
  yandexPreferredModel?: string;
  litellmBaseURL?: string;
  defaultModel?: string;
  geminiPreferredModel?: string;
  groqPreferredModel?: string;
  openaiPreferredModel?: string;
  claudePreferredModel?: string;
  deepseekPreferredModel?: string;
  customProviders?: Array<{ id: string }>;
  curlProviders?: Array<{ id: string }>;
  taskModelPolicy?: TaskModelPolicy;
}

export const AI_TASKS: readonly AiTask[] = ['chat', 'vacancy_intake', 'scraping', 'retro', 'agent_actions'] as const;

const TASKS = new Set<string>(AI_TASKS);
const MODES = new Set<string>(['default', 'auto', 'pinned']);
const QUALITIES = new Set<string>(['fast', 'balanced', 'quality']);

const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  gemini: 'gemini-3.1-flash-lite',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-5.4',
  claude: 'claude-sonnet-4-6',
  deepseek: 'deepseek-v4-flash',
  yandex: 'yandex/yandexgpt-5-lite',
};

const FALLBACK_PROVIDER_ORDER = ['gemini', 'yandex', 'openai', 'claude', 'groq', 'deepseek'];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanModelId(value: unknown): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function providerForModelId(modelId: string | null | undefined): string | null {
  if (!modelId) return null;
  if (modelId.startsWith('yandex/')) return 'yandex';
  if (modelId.startsWith('litellm/')) return 'litellm';
  if (modelId.startsWith('ollama-') || modelId.startsWith('ollama/')) return 'ollama';
  if (modelId.startsWith('codex-cli:')) return 'codex-cli';
  if (/^gpt-|^o[0-9]|^chatgpt-/i.test(modelId)) return 'openai';
  if (/^claude/i.test(modelId)) return 'claude';
  if (/^deepseek/i.test(modelId)) return 'deepseek';
  if (/^llama|^mixtral|^gemma/i.test(modelId)) return 'groq';
  if (/^gemini/i.test(modelId)) return 'gemini';
  return null;
}

function preferredModels(credentials: TaskModelCredentialSnapshot): string[] {
  return [
    credentials.geminiPreferredModel,
    credentials.groqPreferredModel,
    credentials.openaiPreferredModel,
    credentials.claudePreferredModel,
    credentials.deepseekPreferredModel,
    credentials.yandexPreferredModel,
  ].map(cleanModelId).filter((value): value is string => Boolean(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function createInitialTaskModelPolicy(
  credentials: TaskModelCredentialSnapshot = {},
  now = new Date().toISOString(),
): TaskModelPolicy {
  const storedDefault = cleanModelId(credentials.defaultModel);
  const preferred = unique(preferredModels(credentials));
  const seeded = !storedDefault && preferred.length === 1;
  return {
    version: 1,
    defaultModelId: storedDefault || (seeded ? preferred[0] : null),
    seededFromProviderPreferred: seeded || undefined,
    tasks: {},
    updatedAt: now,
  };
}

export function normalizeTaskModelPolicy(
  input: unknown,
  credentials: TaskModelCredentialSnapshot = {},
  now = new Date().toISOString(),
): TaskModelPolicy {
  const fallback = createInitialTaskModelPolicy(credentials, now);
  const raw = input && typeof input === 'object' ? input as any : {};
  const tasks: TaskModelPolicy['tasks'] = {};
  const rawTasks = raw.tasks && typeof raw.tasks === 'object' ? raw.tasks : {};
  for (const [task, value] of Object.entries(rawTasks)) {
    if (!TASKS.has(task) || !value || typeof value !== 'object') continue;
    const override = value as any;
    const mode = MODES.has(override.mode) ? override.mode as TaskModelMode : 'default';
    const quality = QUALITIES.has(override.quality) ? override.quality as TaskModelOverride['quality'] : undefined;
    tasks[task as AiTask] = {
      mode,
      modelId: cleanModelId(override.modelId),
      quality,
    };
  }
  return {
    version: 1,
    defaultModelId: cleanModelId(raw.defaultModelId) ?? fallback.defaultModelId,
    seededFromProviderPreferred: raw.seededFromProviderPreferred === true || fallback.seededFromProviderPreferred || undefined,
    tasks,
    updatedAt: hasText(raw.updatedAt) ? raw.updatedAt : now,
  };
}

function providerAvailable(provider: string | null, modelId: string, credentials: TaskModelCredentialSnapshot): TaskModelAvailability {
  if (!provider) {
    const customMatch = [...(credentials.customProviders ?? []), ...(credentials.curlProviders ?? [])]
      .some(providerEntry => providerEntry.id === modelId);
    return customMatch ? 'available' : 'model_unavailable';
  }
  if (provider === 'gemini') return hasText(credentials.geminiApiKey) ? 'available' : 'missing_credentials';
  if (provider === 'groq') return hasText(credentials.groqApiKey) ? 'available' : 'missing_credentials';
  if (provider === 'openai') return hasText(credentials.openaiApiKey) ? 'available' : 'missing_credentials';
  if (provider === 'claude') return hasText(credentials.claudeApiKey) ? 'available' : 'missing_credentials';
  if (provider === 'deepseek') return hasText(credentials.deepseekApiKey) ? 'available' : 'missing_credentials';
  if (provider === 'yandex') return hasText(credentials.yandexApiKey) && hasText(credentials.yandexFolderId) ? 'available' : 'missing_credentials';
  if (provider === 'litellm') return hasText(credentials.litellmBaseURL) ? 'available' : 'provider_disabled';
  if (provider === 'ollama' || provider === 'codex-cli') return 'available';
  return 'model_unavailable';
}

function preferredForProvider(provider: string, credentials: TaskModelCredentialSnapshot): string {
  const key = `${provider}PreferredModel` as keyof TaskModelCredentialSnapshot;
  return cleanModelId(credentials[key]) || DEFAULT_PROVIDER_MODELS[provider];
}

function configuredFallbackModels(credentials: TaskModelCredentialSnapshot): string[] {
  const models: string[] = [];
  for (const provider of FALLBACK_PROVIDER_ORDER) {
    const model = preferredForProvider(provider, credentials);
    if (providerAvailable(provider, model, credentials) === 'available') models.push(model);
  }
  return models;
}

function autoModelForTask(task: AiTask, override: TaskModelOverride | undefined, credentials: TaskModelCredentialSnapshot): string | null {
  const candidates = configuredFallbackModels(credentials);
  if (override?.quality === 'quality') {
    return candidates.find(model => ['openai', 'claude', 'yandex'].includes(providerForModelId(model) || '')) ?? candidates[0] ?? null;
  }
  if (task === 'retro' || task === 'agent_actions') {
    return candidates.find(model => ['yandex', 'openai', 'claude', 'gemini'].includes(providerForModelId(model) || '')) ?? candidates[0] ?? null;
  }
  return candidates[0] ?? null;
}

export function resolveTaskModel(
  task: AiTask,
  policyInput: TaskModelPolicy | null | undefined,
  credentials: TaskModelCredentialSnapshot = {},
  options: TaskModelResolveOptions = {},
): TaskModelResolution {
  if (!TASKS.has(task)) {
    throw new Error(`Unknown AI task: ${task}`);
  }
  const policy = normalizeTaskModelPolicy(policyInput, credentials, options.now);
  const override = policy.tasks[task];
  const requestedMode: TaskModelMode = options.overrideModelId
    ? 'pinned'
    : (override?.mode ?? 'default');
  const warnings: string[] = [];
  const candidates: string[] = [];

  if (cleanModelId(options.overrideModelId)) candidates.push(options.overrideModelId!.trim());
  if (!options.overrideModelId && override?.mode === 'pinned' && cleanModelId(override.modelId)) candidates.push(override.modelId!.trim());
  if (!options.overrideModelId && override?.mode === 'auto') {
    const auto = autoModelForTask(task, override, credentials);
    if (auto) candidates.push(auto);
  }
  if (policy.defaultModelId) candidates.push(policy.defaultModelId);
  candidates.push(...configuredFallbackModels(credentials));

  const uniqueCandidates = unique(candidates);
  let firstUnavailable: TaskModelAvailability | null = null;
  for (let index = 0; index < uniqueCandidates.length; index++) {
    const modelId = uniqueCandidates[index];
    const availability = providerAvailable(providerForModelId(modelId), modelId, credentials);
    if (availability === 'available') {
      const fallbackUsed = index > 0 || (requestedMode === 'default' && modelId !== policy.defaultModelId);
      if (fallbackUsed) warnings.push(`Model policy fell back to ${modelId}.`);
      return { task, requestedMode, resolvedModelId: modelId, availability, fallbackUsed, warnings };
    }
    firstUnavailable ??= availability;
    warnings.push(`${modelId} is not available for ${task}: ${availability}.`);
  }

  warnings.push(`No configured AI model is available for ${task}.`);
  return {
    task,
    requestedMode,
    resolvedModelId: null,
    availability: firstUnavailable ?? 'missing_credentials',
    fallbackUsed: uniqueCandidates.length > 0,
    warnings,
  };
}
