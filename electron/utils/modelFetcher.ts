/**
 * modelFetcher.ts - Dynamic Model Discovery
 * Fetches available models from AI provider APIs
 */

import axios from 'axios';

export interface ProviderModel {
    id: string;
    label: string;
}

type Provider = 'gemini' | 'groq' | 'openai' | 'claude' | 'deepseek' | 'yandex';

/**
 * Fetch available models from a provider's API.
 * Returns a filtered, sorted array of { id, label } objects.
 */
export async function fetchProviderModels(
    provider: Provider,
    apiKey: string,
    folderId?: string
): Promise<ProviderModel[]> {
    switch (provider) {
        case 'openai':
            return fetchOpenAIModels(apiKey);
        case 'groq':
            return fetchGroqModels(apiKey);
        case 'claude':
            return fetchAnthropicModels(apiKey);
        case 'gemini':
            return fetchGeminiModels(apiKey);
        case 'deepseek':
            return fetchDeepSeekModels(apiKey);
        case 'yandex':
            return fetchYandexModels(apiKey, folderId);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function fetchOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
    });

    const models: any[] = response.data?.data || [];

    // Only include: gpt-4o series, gpt-5.x+, o1, o3, o4 series
    const filtered = models.filter((m: any) => {
        const id = (m.id || '').toLowerCase();
        // Include gpt-4o variants
        if (id.includes('gpt-4o')) return true;
        // Include gpt-5 and above
        if (/gpt-[5-9]/.test(id)) return true;
        // Include o1/o3/o4 reasoning models (but not audio/realtime variants)
        if (/^o[134]/.test(id) && !id.includes('audio') && !id.includes('realtime')) return true;
        return false;
    });

    return filtered
        .map((m: any) => ({ id: m.id, label: m.id }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// ─── Groq ────────────────────────────────────────────────────────────────────

async function fetchGroqModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
    });

    const models: any[] = response.data?.data || [];

    // Only include text/chat models — exclude everything non-chat
    const excludePatterns = [
        'whisper', 'distil', 'guard', 'tool-use',
        'vision-preview', 'tts', 'playai', 'speech',
    ];

    const filtered = models.filter((m: any) => {
        const id = (m.id || '').toLowerCase();
        return !excludePatterns.some(p => id.includes(p));
    });

    return filtered
        .map((m: any) => ({ id: m.id, label: m.id }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function fetchAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await axios.get('https://api.anthropic.com/v1/models', {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        timeout: 15000,
    });

    const models: any[] = response.data?.data || [];

    // Only include Claude 3.5+ models (haiku, sonnet, opus)
    const filtered = models.filter((m: any) => {
        const id = (m.id || '').toLowerCase();
        if (!id.includes('claude')) return false;
        
        // Match models that are version 3.5, 3.7, 4.0, etc.
        // e.g. claude-3-5-sonnet, claude-3-7-sonnet, claude-4-opus
        const versionMatch = id.match(/claude-(\d+)-(\d+)?/);
        if (versionMatch) {
            const major = parseInt(versionMatch[1], 10);
            const minor = versionMatch[2] ? parseInt(versionMatch[2], 10) : 0;
            if (major > 3 || (major === 3 && minor >= 5)) {
                return true;
            }
        }
        return false;
    });

    return filtered
        .map((m: any) => ({ id: m.id, label: m.display_name || m.id }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// ─── DeepSeek ────────────────────────────────────────────────────────────────

// Documented current DeepSeek text models; used as fallback if /models call fails
// or returns an unexpected shape. deepseek-chat / deepseek-reasoner are deprecated
// (2026-07-24) and intentionally excluded.
const DEEPSEEK_DEFAULT_MODELS: ProviderModel[] = [
    { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash' },
    { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
];

async function fetchDeepSeekModels(apiKey: string): Promise<ProviderModel[]> {
    try {
        const response = await axios.get('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 15000,
        });

        const models: any[] = response.data?.data || [];
        if (!Array.isArray(models) || models.length === 0) {
            return DEEPSEEK_DEFAULT_MODELS;
        }

        const excludePatterns = [
            'embedding', 'embed', 'vision', 'image', 'audio',
            'tts', 'speech', 'whisper', 'stt',
        ];

        const filtered = models.filter((m: any) => {
            const id = (m.id || '').toLowerCase();
            if (!/^deepseek-v\d/.test(id)) return false;
            if (excludePatterns.some(p => id.includes(p))) return false;
            return true;
        });

        if (filtered.length === 0) return DEEPSEEK_DEFAULT_MODELS;

        return filtered
            .map((m: any) => ({ id: m.id, label: m.id }))
            .sort((a, b) => a.label.localeCompare(b.label));
    } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
            throw new Error('Invalid or unauthorized DeepSeek API key');
        }
        return DEEPSEEK_DEFAULT_MODELS;
    }
}

// ─── Yandex AI Studio ────────────────────────────────────────────────────────

const YANDEX_DEFAULT_MODELS: ProviderModel[] = [
    { id: 'yandex/yandexgpt-5-lite', label: 'YandexGPT 5 Lite' },
    { id: 'yandex/yandexgpt-5-pro', label: 'YandexGPT 5 Pro' },
    { id: 'yandex/yandexgpt-5.1', label: 'YandexGPT Pro 5.1' },
    { id: 'yandex/aliceai-llm', label: 'Alice AI LLM' },
    { id: 'yandex/aliceai-llm-flash', label: 'Alice AI LLM Flash' },
];

async function fetchYandexModels(apiKey: string, folderId?: string): Promise<ProviderModel[]> {
    const folder = (folderId || '').trim();
    if (!folder) return YANDEX_DEFAULT_MODELS;

    try {
        const response = await axios.get('https://ai.api.cloud.yandex.net/v1/models', {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'x-folder-id': folder,
                'x-data-logging-enabled': 'false',
            },
            timeout: 15000,
        });

        const models: any[] = response.data?.data || [];
        const filtered = models
            .map((m: any) => String(m?.id || '').trim())
            .filter((id: string) =>
                id &&
                !/embed|vision|image|audio|speech|realtime|art/i.test(id) &&
                /yandexgpt|aliceai-llm/i.test(id)
            )
            .map((id: string) => {
                const key = id.startsWith('gpt://')
                    ? id.split('/').pop() || id
                    : id.replace(/^yandex\//, '');
                return { id: `yandex/${key}`, label: key };
            });

        return filtered.length > 0 ? filtered : YANDEX_DEFAULT_MODELS;
    } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
            throw new Error('Invalid or unauthorized Yandex AI Studio API key or folder');
        }
        return YANDEX_DEFAULT_MODELS;
    }
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function fetchGeminiModels(apiKey: string): Promise<ProviderModel[]> {
    const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {
            timeout: 15000,
        }
    );

    const models: any[] = response.data?.models || [];

    // Only include Gemini 2.5+ models (gemini-2.5-*, gemini-3-*, etc.)
    // Must support generateContent
    const excludePatterns = ['nano', 'custom', 'computer-use', 'banana', 'tts', 'embedding', 'aqa', 'vision'];

    const filtered = models.filter((m: any) => {
        const name = (m.name || '').toLowerCase();
        const displayName = (m.displayName || '').toLowerCase();
        const combined = name + ' ' + displayName;

        // Must support generateContent
        const supportsChat = m.supportedGenerationMethods?.includes('generateContent');
        if (!supportsChat) return false;

        // Must NOT match any exclude patterns
        if (excludePatterns.some(p => combined.includes(p))) return false;

        // Match gemini-2.5, gemini-3, gemini-4, etc. (version 2.5 and above)
        return /gemini-([3-9]|2\.5)/.test(combined);
    });

    return filtered
        .map((m: any) => {
            const id = (m.name || '').replace(/^models\//, '');
            return { id, label: m.displayName || id };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}
