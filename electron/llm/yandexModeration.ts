import {
  SHARED_MODE_PREFIX,
  SHARED_MODE_PREFIX_SHORT,
} from "./prompts";

export type YandexBlockReason =
  | "none"
  | "content_filter"
  | "refusal_field"
  | "refusal_text";

export type NormalizedYandexStatus =
  | "ok"
  | "blocked"
  | "empty_output"
  | "provider_malformed";

export type YandexModerationDetection = {
  blocked: boolean;
  blockReason: YandexBlockReason;
  refusalTextDetected: boolean;
};

export type NormalizedYandexProviderResult = YandexModerationDetection & {
  status: NormalizedYandexStatus;
  finishReason: string | null;
  messageRefusal: string | null;
  content: string;
};

export const YANDEX_PROVIDER_MODERATION_MESSAGE =
  "Yandex AI Studio blocked this response with provider moderation. This is not an OpenOffer refusal. Try a shorter active-mode prompt, YandexGPT 5.1, or another provider.";

const YANDEX_CANONICAL_REFUSAL_RE = /Я не могу обсуждать эту тему\.?\s+Давайте поговорим о ч[её]м-нибудь ещ[её]\.?/i;

export function normalizeYandexSystemPrompt(systemPrompt?: string): string | undefined {
  if (!systemPrompt) return undefined;

  const marker = "## ACTIVE MODE\n";
  const markerIdx = systemPrompt.lastIndexOf(marker);
  if (markerIdx < 0) return systemPrompt;

  const beforeMode = systemPrompt.slice(0, markerIdx + marker.length);
  const afterMode = systemPrompt.slice(markerIdx + marker.length).replace(/^\s+/, "");
  for (const prefix of [SHARED_MODE_PREFIX, SHARED_MODE_PREFIX_SHORT]) {
    if (afterMode.startsWith(prefix)) {
      const stripped = afterMode.slice(prefix.length).replace(/^\s+/, "");
      return beforeMode + stripped;
    }
  }
  return systemPrompt;
}

export function detectYandexProviderModeration(input: {
  finishReason?: unknown;
  messageRefusal?: unknown;
  content?: unknown;
}): YandexModerationDetection {
  const finishReason = typeof input.finishReason === "string" ? input.finishReason : "";
  const messageRefusal = typeof input.messageRefusal === "string" ? input.messageRefusal.trim() : "";
  const content = typeof input.content === "string" ? input.content : "";
  const refusalTextDetected = YANDEX_CANONICAL_REFUSAL_RE.test(content);

  if (finishReason === "content_filter") {
    return { blocked: true, blockReason: "content_filter", refusalTextDetected };
  }
  if (messageRefusal.length > 0) {
    return { blocked: true, blockReason: "refusal_field", refusalTextDetected };
  }
  if (refusalTextDetected) {
    return { blocked: true, blockReason: "refusal_text", refusalTextDetected: true };
  }
  return { blocked: false, blockReason: "none", refusalTextDetected };
}

export function normalizeYandexProviderResult(raw: unknown): NormalizedYandexProviderResult {
  const choice = (raw as any)?.choices?.[0];
  if (!choice || typeof choice !== "object") {
    return {
      status: "provider_malformed",
      finishReason: null,
      messageRefusal: null,
      content: "",
      blocked: false,
      blockReason: "none",
      refusalTextDetected: false,
    };
  }

  const message = (choice as any).message || {};
  const delta = (choice as any).delta || {};
  const content = String(message.content ?? delta.content ?? "");
  const finishReason = typeof (choice as any).finish_reason === "string" ? (choice as any).finish_reason : null;
  const rawRefusal = message.refusal ?? delta.refusal ?? null;
  const messageRefusal = typeof rawRefusal === "string" ? rawRefusal : null;
  const detection = detectYandexProviderModeration({ finishReason, messageRefusal, content });

  if (detection.blocked) {
    return { status: "blocked", finishReason, messageRefusal, content, ...detection };
  }
  if (!content.trim()) {
    return { status: "empty_output", finishReason, messageRefusal, content, ...detection };
  }
  return { status: "ok", finishReason, messageRefusal, content, ...detection };
}
