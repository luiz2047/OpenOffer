import type { AnswerStyle } from './answerStyle';

export type AnswerStylePackId =
  | 'automatic'
  | 'standard'
  | 'strict'
  | 'expanded'
  | 'hint'
  | 'grounded';

export interface AnswerStylePack {
  id: AnswerStylePackId;
  label: string;
  shortLabel: string;
  description: string;
  sample: string;
  language: 'any';
}

export interface AnswerStylePackSelection {
  provider?: string;
  modelId?: string;
  inputLanguage?: string;
  requestedPackId?: string | null;
}

export type YandexAdapterPromptPackId =
  | 'current-openoffer-baseline'
  | 'yandex-ru-lite'
  | 'yandex-ru-strict-grounded';

const ANSWER_STYLE_PACKS: Record<AnswerStylePackId, AnswerStylePack> = {
  automatic: {
    id: 'automatic',
    label: 'Automatic',
    shortLabel: 'Auto',
    description: 'Uses the recommended behavior for the selected model and response language.',
    sample: 'Question-aware defaults; Yandex/RU uses the Russian interview prompt.',
    language: 'any',
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    shortLabel: 'Standard',
    description: 'Balanced, speakable answers without forcing extra structure.',
    sample: 'Direct answer, then only the context needed to say it naturally.',
    language: 'any',
  },
  strict: {
    id: 'strict',
    label: 'Strict',
    shortLabel: 'Strict',
    description: 'Short, firm answers with minimal hedging and no filler.',
    sample: '2-4 sentences or 3-5 tight bullets, grounded and decisive.',
    language: 'any',
  },
  expanded: {
    id: 'expanded',
    label: 'Expanded',
    shortLabel: 'Expanded',
    description: 'More complete answers with reasoning, tradeoffs, and examples.',
    sample: 'A fuller explanation that still stays usable in an interview.',
    language: 'any',
  },
  hint: {
    id: 'hint',
    label: 'Hint mode',
    shortLabel: 'Hint',
    description: 'Coaching cues instead of a fully scripted final answer.',
    sample: 'A compact structure, key points, and what to emphasize next.',
    language: 'any',
  },
  grounded: {
    id: 'grounded',
    label: 'Grounded',
    shortLabel: 'Grounded',
    description: 'Extra conservative about personal facts, metrics, and claims.',
    sample: 'Uses loaded profile facts; admits missing context instead of inventing.',
    language: 'any',
  },
};

const LEGACY_YANDEX_TO_STYLE: Partial<Record<string, AnswerStylePackId | undefined>> = {
  'current-openoffer-baseline': undefined,
  'yandex-ru-lite': undefined,
  'yandex-ru-strict-grounded': 'grounded',
};

export function providerForModelId(modelId?: string | null): string | undefined {
  if (!modelId) return undefined;
  if (modelId.startsWith('yandex/')) return 'yandex';
  if (modelId.startsWith('litellm/')) return 'litellm';
  if (modelId.startsWith('codex-cli:')) return 'codex-cli';
  if (modelId.startsWith('ollama-')) return 'ollama';
  if (/^gpt-|^o\d|^chatgpt-/i.test(modelId)) return 'openai';
  if (/claude|sonnet|haiku|opus/i.test(modelId)) return 'claude';
  if (/deepseek/i.test(modelId)) return 'deepseek';
  if (/llama|groq/i.test(modelId)) return 'groq';
  if (/gemini/i.test(modelId)) return 'gemini';
  return undefined;
}

export function listAnswerStylePacks(): AnswerStylePack[] {
  return Object.values(ANSWER_STYLE_PACKS);
}

export function getAnswerStylePack(id: string): AnswerStylePack {
  const pack = ANSWER_STYLE_PACKS[id as AnswerStylePackId];
  if (!pack) throw new Error(`Unknown answer style: ${id}`);
  return pack;
}

export function normalizeAnswerStylePackId(id?: string | null): AnswerStylePackId | undefined {
  if (!id || id === 'automatic') return undefined;
  if (Object.prototype.hasOwnProperty.call(LEGACY_YANDEX_TO_STYLE, id)) {
    return LEGACY_YANDEX_TO_STYLE[id];
  }
  if (ANSWER_STYLE_PACKS[id as AnswerStylePackId]) return id as AnswerStylePackId;
  throw new Error(`Unknown answer style: ${id}`);
}

export function coerceAnswerStylePackId(id?: string | null): AnswerStylePackId | undefined {
  try {
    return normalizeAnswerStylePackId(id);
  } catch {
    return undefined;
  }
}

export function getEnvAnswerStylePackId(env: NodeJS.ProcessEnv = process.env): AnswerStylePackId | undefined {
  return coerceAnswerStylePackId(env.OPENOFFER_ANSWER_STYLE);
}

export function getEnvYandexPromptPackOverride(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.OPENOFFER_YANDEX_PROMPT_PACK || getEnvAnswerStylePackId(env);
}

export function getPlannerAnswerStyleForPackId(id?: string | null): AnswerStyle | undefined {
  const normalized = coerceAnswerStylePackId(id);
  switch (normalized) {
    case 'strict':
      return 'strict';
    case 'expanded':
      return 'expanded';
    case 'hint':
      return 'hint';
    case 'grounded':
      return 'grounded';
    case 'standard':
    default:
      return undefined;
  }
}

export function isRussianLanguage(language?: string): boolean {
  if (!language || language === 'auto') return true;
  return /^(ru([-_].*)?|russian|рус|русский)$/i.test(language.trim());
}

export function getAutomaticAnswerStyleSummary(selection: AnswerStylePackSelection = {}): string {
  const provider = selection.provider || providerForModelId(selection.modelId);
  if (provider === 'yandex' && isRussianLanguage(selection.inputLanguage)) {
    return 'Russian interview mode for YandexGPT';
  }
  return 'Question-aware default behavior';
}

export function resolveYandexAdapterPromptPackId(selection: AnswerStylePackSelection = {}): YandexAdapterPromptPackId {
  if (selection.provider && selection.provider !== 'yandex') return 'current-openoffer-baseline';

  const requested = selection.requestedPackId || undefined;
  if (requested === 'current-openoffer-baseline' || requested === 'yandex-ru-lite' || requested === 'yandex-ru-strict-grounded') {
    return requested;
  }

  if (!isRussianLanguage(selection.inputLanguage)) return 'current-openoffer-baseline';

  const styleId = coerceAnswerStylePackId(requested);
  if (styleId === 'strict' || styleId === 'grounded') return 'yandex-ru-strict-grounded';
  return 'yandex-ru-lite';
}
