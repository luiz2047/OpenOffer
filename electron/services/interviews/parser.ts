import type {
  InterviewCreatePayload,
  InterviewSourceParseResult,
  VacancyDossierPayload,
} from '../../../src/types/interviews';

const MAX_SOURCE_TEXT = 50_000;

const MEETING_HOSTS = [
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'webex.com',
];

const VACANCY_HOST_HINTS = [
  'hh.ru',
  'headhunter',
  'getmatch',
  'linkedin',
  'habr.com',
  'career',
  'jobs',
  'greenhouse.io',
  'lever.co',
];

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function normalizeInterviewSourceText(input: string): string {
  return decodeBasicEntities(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimValue(value?: string | null, max = 180): string | null {
  const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function unique(values: string[], max = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = trimValue(value, 1000);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= max) break;
  }
  return result;
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return unique(matches.map(url => url.replace(/[.,;:!?]+$/g, '')), 20);
}

function hostContains(url: string, hints: string[]): boolean {
  try {
    const parsed = new URL(url);
    const haystack = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return hints.some(hint => haystack.includes(hint));
  } catch {
    return false;
  }
}

function detectSource(text: string, urls: string[]): string | null {
  const haystack = `${text}\n${urls.join('\n')}`.toLowerCase();
  if (/\bhh\b|hh\.ru|headhunter/.test(haystack)) return 'HH';
  if (/getmatch/.test(haystack)) return 'Getmatch';
  if (/telegram|t\.me\//.test(haystack)) return 'Telegram';
  if (/linkedin/.test(haystack)) return 'LinkedIn';
  if (/habr/.test(haystack)) return 'Habr Career';
  return null;
}

function lineValue(lines: string[], patterns: RegExp[], max = 160): string | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) return trimValue(match[1], max);
    }
  }
  return null;
}

function firstMeaningfulLine(lines: string[]): string | null {
  return trimValue(
    lines.find(line =>
      line.length >= 4
      && line.length <= 180
      && !/^https?:\/\//i.test(line)
      && !/^(откликнуться|respond|apply|описание|description)$/i.test(line)
    ),
    180,
  );
}

function extractSection(lines: string[], headers: RegExp[], stops: RegExp[], max = 12): string[] {
  const collected: string[] = [];
  let active = false;

  for (const line of lines) {
    if (headers.some(pattern => pattern.test(line))) {
      active = true;
      const inline = line.split(/[:—-]/).slice(1).join('-').trim();
      if (inline) collected.push(inline);
      continue;
    }
    if (!active) continue;
    if (stops.some(pattern => pattern.test(line))) break;
    const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (cleaned && cleaned.length <= 500) collected.push(cleaned);
    if (collected.length >= max) break;
  }

  return unique(collected, max);
}

function extractSalary(text: string): string | null {
  const match = text.match(
    /((?:от|до)?\s*\d[\d\s]*(?:-|–|—|до)\s*\d[\d\s]*(?:₽|руб\.?|тыс\.?|k|K|USD|EUR|€|\$)|(?:от|до)\s*\d[\d\s]*(?:₽|руб\.?|тыс\.?|k|K|USD|EUR|€|\$)|\d[\d\s]*(?:₽|руб\.?|тыс\.?|k|K|USD|EUR|€|\$)\b)/i,
  );
  if (!match?.[1]) return null;
  let salary = match[1];
  const tail = text.slice((match.index ?? 0) + salary.length).match(/^\s*(руб\.?|₽|USD|EUR|€|\$)/i);
  if (tail?.[1] && !new RegExp(`${tail[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(salary)) {
    salary = `${salary} ${tail[1]}`;
  }
  return trimValue(salary, 120);
}

function detectStage(text: string): string | null {
  if (/system design|системн(ый|ое) дизайн/i.test(text)) return 'System design';
  if (/technical|техническ|алгоритм|coding|live coding/i.test(text)) return 'Technical interview';
  if (/hr|recruiter|рекрутер|скрининг|screen/i.test(text)) return 'Recruiter screen';
  return null;
}

function buildCheatsheet(role: string | null, requirements: string[], source: string | null): string | null {
  const topics = unique([
    ...requirements.slice(0, 8),
    ...(role ? [role] : []),
  ], 8);
  if (topics.length === 0) return null;
  const prefix = source ? `${source}: ` : '';
  return `${prefix}${topics.join('\n')}`;
}

export function parseInterviewSourceText(rawText: string): InterviewSourceParseResult {
  if (typeof rawText !== 'string') {
    throw new TypeError('Interview source text must be a string.');
  }
  if (rawText.length > MAX_SOURCE_TEXT) {
    const error = new Error('Interview source text is too large.');
    (error as any).code = 'parser_input_too_large';
    throw error;
  }

  const normalizedText = normalizeInterviewSourceText(rawText);
  if (!normalizedText) {
    const error = new Error('Paste a vacancy, HR message, or calendar note first.');
    (error as any).code = 'parser_no_fields';
    throw error;
  }

  const lines = normalizedText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const urls = extractUrls(normalizedText);
  const detectedSource = detectSource(normalizedText, urls);
  const vacancyUrl = urls.find(url => hostContains(url, VACANCY_HOST_HINTS)) ?? urls.find(url => !hostContains(url, MEETING_HOSTS)) ?? null;
  const meetingUrl = urls.find(url => hostContains(url, MEETING_HOSTS)) ?? null;
  const company = lineValue(lines, [
    /^(?:компания|company|работодатель|employer)\s*[:—-]\s*(.+)$/i,
    /(?:в компании|at company|at)\s+([A-ZА-ЯЁ][\wА-Яа-яЁё ."'&-]{2,80})/i,
  ], 120);
  const roleTitle = lineValue(lines, [
    /^(?:вакансия|позиция|должность|role|position|job)\s*[:—-]\s*(.+)$/i,
    /^([A-ZА-ЯЁ][\wА-Яа-яЁё +#/.-]{2,100}(?:developer|engineer|разработчик|инженер|frontend|backend|fullstack).*)$/i,
  ], 120);
  const requirements = extractSection(
    lines,
    [/^(требования|requirements|stack|стек|что нужно|обязанности|responsibilities)(?:\s*[:—-]|$)/i],
    [/^(условия|benefits|questions|вопросы|компания|company|зарплата|salary|контакты)(?:\s*[:—-]|$)/i],
    14,
  );
  const questionsToAsk = extractSection(
    lines,
    [/^(вопросы|questions|что спросить|уточнить)(?:\s*[:—-]|$)/i],
    [/^(требования|requirements|stack|условия|benefits|зарплата|salary)(?:\s*[:—-]|$)/i],
    10,
  );
  const risks = extractSection(
    lines,
    [/^(риски|минусы|red flags|concerns)(?:\s*[:—-]|$)/i],
    [/^(вопросы|questions|требования|requirements|условия|benefits)(?:\s*[:—-]|$)/i],
    8,
  );
  const compensationText = extractSalary(normalizedText);
  const stage = detectStage(normalizedText);
  const fallbackTitle = firstMeaningfulLine(lines);
  const title = trimValue(
    [company, roleTitle || stage || fallbackTitle].filter(Boolean).join(' · ')
      || roleTitle
      || fallbackTitle
      || 'Interview',
    180,
  ) as string;

  const fields: Partial<InterviewCreatePayload> = {
    title,
    company,
    roleTitle,
    stage,
    source: detectedSource,
    vacancyUrl,
    meetingUrl,
    rawSourceText: normalizedText,
  };
  const dossier: VacancyDossierPayload = {
    description: normalizedText.slice(0, 12_000),
    requirements,
    compensationText,
    risks,
    questionsToAsk,
  };
  const prep = {
    expectedTopics: unique(requirements.slice(0, 10), 10),
    cheatsheet: buildCheatsheet(roleTitle, requirements, detectedSource),
    riskHandling: unique(risks, 8),
  };
  const fieldCount = Object.entries(fields)
    .filter(([key, value]) => key !== 'rawSourceText' && value !== null && value !== undefined && value !== '')
    .length
    + requirements.length
    + questionsToAsk.length
    + risks.length
    + (compensationText ? 1 : 0);
  const warnings: string[] = [];
  if (!company) warnings.push('company_not_detected');
  if (!roleTitle) warnings.push('role_not_detected');
  if (fieldCount <= 2) warnings.push('low_confidence_parse');

  return {
    fields,
    dossier,
    prep,
    warnings,
    fieldCount,
    detectedSource,
    normalizedText,
  };
}
