import type { ReadinessCheck } from '../../../src/types/interviews';

export type StageProviderProbe = {
  id: 'stt' | 'ai';
  provider: string;
  configured: boolean;
  apiKey?: string | null;
  endpoint?: string | null;
};

export type StageProviderProbeResult = ReadinessCheck & {
  provider: string;
};

const TIMEOUT_MS = 8_000;

const probeUrls: Record<string, (endpoint?: string | null) => string | null> = {
  openai: (endpoint) => `${(endpoint || 'https://api.openai.com/v1').replace(/\/$/, '')}/models`,
  groq: () => 'https://api.groq.com/openai/v1/models',
  deepseek: () => 'https://api.deepseek.com/v1/models',
  gemini: () => 'https://generativelanguage.googleapis.com/v1beta/models',
  claude: () => 'https://api.anthropic.com/v1/models',
  deepgram: () => 'https://api.deepgram.com/v1/projects',
};

/** Return the documented, credential-free endpoint shown before a probe runs. */
export function getStageProviderProbeEndpoint(provider: string, endpoint?: string | null): string | null {
  return probeUrls[provider]?.(endpoint) ?? null;
}

function headersFor(provider: string, apiKey: string): Record<string, string> {
  if (provider === 'gemini') return { 'x-goog-api-key': apiKey };
  if (provider === 'claude') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (provider === 'deepgram') return { Authorization: `Token ${apiKey}` };
  return { Authorization: `Bearer ${apiKey}` };
}

async function probeOne(probe: StageProviderProbe, signal?: AbortSignal): Promise<StageProviderProbeResult> {
  const checkedAt = Date.now();
  if (!probe.configured || !probe.apiKey?.trim()) {
    return { id: probe.id, required: probe.id === 'stt', status: 'missing', messageKey: `${probe.id}_not_configured`, checkedAt, provider: probe.provider, recoveryAction: 'configure_provider' };
  }
  const url = probeUrls[probe.provider]?.(probe.endpoint);
  if (!url) {
    return { id: probe.id, required: probe.id === 'stt', status: 'unknown', messageKey: 'provider_credentials_present_not_live_tested', checkedAt, provider: probe.provider };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, { method: 'GET', headers: headersFor(probe.provider, probe.apiKey), signal: controller.signal, redirect: 'error' });
    if (response.ok) {
      return { id: probe.id, required: probe.id === 'stt', status: 'ready', messageKey: `${probe.id}_probe_ready`, checkedAt, expiresAt: checkedAt + 5 * 60_000, provider: probe.provider, endpoint: url };
    }
    if (response.status === 401 || response.status === 403) {
      return { id: probe.id, required: probe.id === 'stt', status: 'failed', messageKey: `${probe.id}_probe_auth_failed`, errorCode: 'stt_probe_failed', checkedAt, provider: probe.provider, endpoint: url, recoveryAction: 'check_credentials' };
    }
    return { id: probe.id, required: probe.id === 'stt', status: 'unknown', messageKey: `${probe.id}_probe_unavailable`, errorCode: `http_${response.status}`, checkedAt, provider: probe.provider, endpoint: url, recoveryAction: 'retry_preflight' };
  } catch (error: any) {
    const timedOut = error?.name === 'AbortError';
    return { id: probe.id, required: probe.id === 'stt', status: 'unknown', messageKey: timedOut ? 'provider_probe_timeout' : `${probe.id}_probe_unavailable`, errorCode: timedOut ? 'provider_probe_timeout' : 'stt_probe_failed', checkedAt, provider: probe.provider, endpoint: url, recoveryAction: 'retry_preflight' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function runStageProviderPreflight(probes: StageProviderProbe[], signal?: AbortSignal): Promise<StageProviderProbeResult[]> {
  const results: StageProviderProbeResult[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < probes.length) {
      if (signal?.aborted) return;
      const index = cursor++;
      results[index] = await probeOne(probes[index], signal);
    }
  };
  await Promise.all([worker(), worker()]);
  return results.filter(Boolean);
}
