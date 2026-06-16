/**
 * relaySession.ts — compatibility shim for the retired STT relay path.
 *
 * The public baseline no longer resolves hosted relay sessions or walks a
 * hosted fallback ladder. This module remains only so older imports keep
 * compiling, but the functions are inert and avoid network access.
 */

export type RelayRegion = 'us' | 'asia' | 'railway';

export interface RelaySttConfig {
    sampleRate: number;
    audioChannels: number;
    language: string;
    languageAlternates: string[];
    channel: string;
}

export interface RelaySessionLimits {
    maxSampleRate: number;
    maxChannels: number;
    allowDualStream: boolean;
    maxSessionSeconds: number;
    maxBytesPerSession: number;
}

export interface RelaySessionConfig {
    sessionId: string;
    sessionToken: string;
    relayWsUrl: string;
    fallbackRelayWsUrl: string | null;
    railwayFallbackWsUrl: string;
    selectedRegion: string;
    sttConfig: RelaySttConfig;
    limits: RelaySessionLimits;
    quotaRemaining: number;
    expiresAt: number;
}

export interface ResolveRelaySessionOpts {
    apiKey?: string;
    trialToken?: string;
    channel: string;
    language: string;
    languageAlternates: string[];
    sampleRate: number;
    audioChannels: number;
    appVersion: string;
    platform: string;
    controlPlaneBaseUrl: string;
    regionHint?: string | null;
    latencyProbes?: Record<string, number> | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    intent?: string;
}

export async function resolveRelaySession(
    opts: ResolveRelaySessionOpts,
): Promise<RelaySessionConfig | null> {
    void opts;
    return null;
}

export function buildFallbackChain(config: RelaySessionConfig | null): string[] {
    if (!config) return [];
    const ordered = [config.relayWsUrl, config.fallbackRelayWsUrl];
    const seen = new Set<string>();
    const chain: string[] = [];
    for (const url of ordered) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        chain.push(url);
    }
    return chain;
}

const CACHE_SKEW_MS = 15_000;
const _sessionCache = new Map<string, { config: RelaySessionConfig; validUntil: number }>();

export function getCachedSession(channel: string): RelaySessionConfig | null {
    const entry = _sessionCache.get(channel);
    if (!entry) return null;
    if (Date.now() >= entry.validUntil) {
        _sessionCache.delete(channel);
        return null;
    }
    return entry.config;
}

export function setCachedSession(channel: string, config: RelaySessionConfig): void {
    if (!config) return;
    _sessionCache.set(channel, { config, validUntil: config.expiresAt - CACHE_SKEW_MS });
}

export function clearCachedSession(channel: string): void {
    _sessionCache.delete(channel);
}

export function clearAllCachedSessions(): void {
    _sessionCache.clear();
}

export function deriveHealthUrl(wsUrl: string): string | null {
    try {
        const u = new URL(wsUrl);
        const scheme = u.protocol === 'wss:' ? 'https:' : 'http:';
        return `${scheme}//${u.host}/healthz`;
    } catch {
        return null;
    }
}

export function getRelayLatencyProbes(
    fetchImpl?: typeof fetch,
    now: () => number = Date.now,
): Record<string, number> | null {
    void fetchImpl;
    void now;
    return null;
}

export async function refreshRelayLatencyProbes(
    fetchImpl?: typeof fetch,
    now: () => number = Date.now,
): Promise<Record<string, number>> {
    void fetchImpl;
    void now;
    return {};
}

export function clearRelayLatencyProbes(): void {
    // Compatibility no-op.
}
