export const YANDEX_DEFAULT_MODEL = "yandex/yandexgpt-5-lite";

export const YANDEX_MODEL_KEYS = [
  "yandexgpt-5-lite",
  "yandexgpt-5-pro",
  "yandexgpt-5.1",
  "aliceai-llm",
  "aliceai-llm-flash",
] as const;

const YANDEX_MODEL_KEY_SET = new Set<string>(YANDEX_MODEL_KEYS);

export function isYandexModelId(modelId?: string | null): boolean {
  return typeof modelId === "string" && modelId.startsWith("yandex/");
}

export function canonicalizeYandexModelId(modelId?: string | null, fallback: string = YANDEX_DEFAULT_MODEL): string {
  const raw = String(modelId || fallback || YANDEX_DEFAULT_MODEL).trim();
  if (!raw) return YANDEX_DEFAULT_MODEL;

  if (raw.startsWith("gpt://")) {
    const key = raw.split("/").pop() || "";
    return canonicalizeYandexModelId(key, fallback);
  }

  const key = raw.replace(/^yandex\//, "");
  if (!YANDEX_MODEL_KEY_SET.has(key)) {
    throw new Error(`Unsupported Yandex model id: ${raw}`);
  }
  return `yandex/${key}`;
}

export function getYandexModelKey(modelId?: string | null, fallback: string = YANDEX_DEFAULT_MODEL): string {
  return canonicalizeYandexModelId(modelId, fallback).replace(/^yandex\//, "");
}

export function getYandexModelUri(folderId: string, modelId?: string | null, fallback: string = YANDEX_DEFAULT_MODEL): string {
  const folder = String(folderId || "").trim();
  if (!folder) throw new Error("Yandex folder ID is not configured");
  return `gpt://${folder}/${getYandexModelKey(modelId, fallback)}`;
}
