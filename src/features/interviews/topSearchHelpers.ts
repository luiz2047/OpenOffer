import type {
  ApplicationCreateFromIntakeResult,
  ApplicationIntakeInput,
  ApplicationIntakeResult,
  ApplicationStatus,
  InterviewPriority,
  InterviewStageStatus,
  InterviewStageType,
} from '../../types/interviews';

export type TopSearchRowKind = 'vacancy' | 'stage';
export type TopSearchActionKind = 'ask_ai' | 'literal_meeting_search' | 'parse_vacancy_source' | 'add_stage_from_text';
export type TopSearchProposalState = 'idle' | 'parsing' | 'proposal' | 'applying' | 'success' | 'error';

export interface BaseTopSearchRow {
  id: string;
  kind: TopSearchRowKind;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  source?: string | null;
  vacancyUrl?: string | null;
  stageTitle?: string | null;
  startsAt?: number | null;
  updatedAt?: string | null;
}

export interface TopSearchVacancyRow extends BaseTopSearchRow {
  kind: 'vacancy';
  status: ApplicationStatus;
  priority: InterviewPriority;
  stageCount: number;
  linkedMeetingCount: number;
  questionCount: number;
  stages: TopSearchStageRow[];
  selectedInterviewId?: string | null;
  selectedStageId?: string | null;
}

export interface TopSearchStageRow extends BaseTopSearchRow {
  kind: 'stage';
  applicationId: string;
  stageType?: InterviewStageType;
  status: InterviewStageStatus;
  endsAt?: number | null;
  timezone?: string | null;
}

export type TopSearchResultRow = TopSearchVacancyRow | TopSearchStageRow;

export interface TopSearchCandidateApplication {
  id: string;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
}

export interface VacancyTopSearchContext {
  isActive: boolean;
  selectedApplicationId?: string | null;
  selectedStageId?: string | null;
  rows: TopSearchResultRow[];
  candidateApplications: TopSearchCandidateApplication[];
  onOpenRow: (row: TopSearchResultRow) => void;
  onPreviewIntake: (input: ApplicationIntakeInput) => Promise<ApplicationIntakeResult>;
  onApplyIntake: (
    intake: ApplicationIntakeResult,
    options?: { selectedApplicationId?: string | null },
  ) => Promise<ApplicationCreateFromIntakeResult>;
}

export interface TopSearchPasteIntent {
  intent: 'vacancy' | 'stage' | 'both' | 'unknown';
  confidence: number;
  rawText: string;
  matchedSignals: string[];
  vacancyScore: number;
  stageScore: number;
}

export interface SafeExcerptOptions {
  maxLength?: number;
  fallbackPrefix?: string;
  fallbackSuffix?: string;
}

export interface TopSearchMatchSignal {
  field: 'vacancyUrl' | 'company' | 'title' | 'role' | 'stage' | 'rawText';
  weight: number;
  matchedValue?: string;
}

export interface TopSearchMatch {
  row: TopSearchResultRow;
  score: number;
  reasons: TopSearchMatchSignal[];
}

export interface TopSearchMatchResult {
  candidates: TopSearchMatch[];
  primary: TopSearchMatch | null;
  ambiguous: boolean;
  scoreGap: number;
}

export type TopSearchProposalTargetReason =
  | 'none'
  | 'strong_ai_match'
  | 'strong_local_match'
  | 'ambiguous_match'
  | 'weak_match'
  | 'no_match'
  | 'invalid_ai_match';

export interface TopSearchProposalTargetResolution {
  selectedApplicationId: string | null;
  requiresManualSelection: boolean;
  reason: TopSearchProposalTargetReason;
  matches: TopSearchMatchResult;
}

const SCORE_MIN_MATCH_THRESHOLD = 10;
const AMBIGUITY_MAX_GAP = 12;
const STRONG_LOCAL_MATCH_SCORE = 30;
const STRONG_AI_MATCH_CONFIDENCE = 0.85;
const INTENT_UNKNOWN_THRESHOLD = 25;
const URI_REGEX = /\bhttps?:\/\/[^\s/$.?#].[^\s]*/i;

const VACANCY_SIGNALS = [
  { pattern: /vacancy|ваканси/i, weight: 18 },
  { pattern: /\brequirements?\b|responsibilities|требо/i, weight: 12 },
  { pattern: /salary|компенсац|зарплат/i, weight: 12 },
  { pattern: /company|компания|organization|организация/i, weight: 10 },
  { pattern: /position|role|роль|должност/i, weight: 10 },
];

const STAGE_SIGNALS = [
  { pattern: /\binterview|\bstage|собесед|стад/i, weight: 18 },
  { pattern: /\brecruiter|хирур|технич|техническ|hr/i, weight: 12 },
  { pattern: /\bmeeting|звонок|созвон|ссылка|calendar|календар/i, weight: 12 },
  { pattern: /\bschedule|time|дат|when|когда|дата/i, weight: 10 },
];

function normalize(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function splitTokens(value: string): string[] {
  return normalize(value)
    .split(/[\s,.;:/()[\]{}'"!?–—-]+/)
    .map(token => token.trim())
    .filter(token => token.length > 1);
}

function containsAllTokens(haystack: string, tokens: string[]): boolean {
  const base = normalize(haystack);
  return tokens.every(token => base.includes(token));
}

function exactMatch(left?: string | null, right?: string | null): boolean {
  return normalize(left) !== '' && normalize(left) === normalize(right);
}

export function detectTopSearchPasteIntent(rawText: string): TopSearchPasteIntent {
  const needle = normalize(rawText);
  const matchedSignals: string[] = [];
  let vacancyScore = 0;
  let stageScore = 0;

  if (!needle) {
    return {
      intent: 'unknown',
      confidence: 0,
      rawText,
      matchedSignals,
      vacancyScore,
      stageScore,
    };
  }

  if (URI_REGEX.test(needle)) {
    vacancyScore += 35;
    matchedSignals.push('vacancy_url');
  }

  for (const signal of VACANCY_SIGNALS) {
    if (signal.pattern.test(needle)) {
      vacancyScore += signal.weight;
      matchedSignals.push(signal.pattern.source);
    }
  }

  for (const signal of STAGE_SIGNALS) {
    if (signal.pattern.test(needle)) {
      stageScore += signal.weight;
      matchedSignals.push(signal.pattern.source);
    }
  }

  if (/^\s*https?:\/\//i.test(needle)) {
    vacancyScore += 8;
  }

  const maxScore = Math.max(vacancyScore, stageScore);
  const isClose = Math.abs(vacancyScore - stageScore) <= 10;
  let intent: TopSearchIntent = 'unknown';
  let confidence = Math.min(100, maxScore);

  if (maxScore >= INTENT_UNKNOWN_THRESHOLD) {
    if (isClose) {
      intent = 'both';
      confidence = Math.max(40, Math.round(confidence * 0.75));
    } else if (vacancyScore > stageScore) {
      intent = 'vacancy';
    } else {
      intent = 'stage';
    }
  }

  return {
    intent,
    confidence,
    rawText,
    matchedSignals,
    vacancyScore,
    stageScore,
  };
}

export function makeSafeExcerpt(value: string, query: string, options: SafeExcerptOptions = {}): string {
  const maxLength = Math.max(20, options.maxLength ?? 220);
  const text = normalize(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const cleanQuery = normalize(query).trim();
  if (!cleanQuery) {
    if (text.length <= maxLength) return text;
    const suffix = options.fallbackSuffix ?? '...';
    return `${text.slice(0, Math.max(1, maxLength - suffix.length)).trimEnd()}${suffix}`;
  }

  const hit = text.indexOf(cleanQuery);
  if (hit < 0) {
    const suffix = options.fallbackSuffix ?? '...';
    return `${text.slice(0, Math.max(1, maxLength - suffix.length)).trimEnd()}${suffix}`;
  }

  const prefix = options.fallbackPrefix ?? '...';
  const suffix = options.fallbackSuffix ?? '...';
  const available = maxLength - prefix.length - suffix.length;
  const queryLen = cleanQuery.length;
  const leftPad = Math.max(0, Math.floor((available - queryLen) / 2));
  const rightPad = Math.max(0, Math.ceil((available - queryLen) / 2));
  const start = Math.max(0, hit - leftPad);
  const end = Math.min(text.length, hit + queryLen + rightPad);
  const body = text.slice(start, end).trim();

  const hasLeft = start > 0;
  const hasRight = end < text.length;

  if (!hasLeft && !hasRight) return body;
  if (!hasLeft) return `${body}${suffix}`;
  if (!hasRight) return `${prefix}${body}`;
  return `${prefix}${body}${suffix}`;
}

export interface TopSearchContext {
  applicationId?: string | null;
  company?: string;
  title?: string;
  roleTitle?: string;
  vacancyUrl?: string;
  stageTitle?: string;
}

function toContext(preview: ApplicationIntakeResult): TopSearchContext {
  return {
    company: preview.application.company,
    title: preview.application.title,
    roleTitle: preview.application.roleTitle,
    vacancyUrl: preview.application.vacancyUrl,
    stageTitle: preview.stage?.title,
    applicationId: preview.existingApplicationMatch?.applicationId,
  };
}

function scoreVacancy(row: TopSearchVacancyRow, context: TopSearchContext): TopSearchMatchSignal[] {
  const reasons: TopSearchMatchSignal[] = [];
  const companyTokens = splitTokens(context.company ?? '');
  const roleTokens = splitTokens(context.roleTitle ?? '');
  const titleTokens = splitTokens(context.title ?? '');
  const stageTokens = splitTokens(context.stageTitle ?? '');

  if (context.applicationId && exactMatch(row.id, context.applicationId)) {
    reasons.push({ field: 'rawText', weight: 95, matchedValue: row.id });
  }

  if (context.vacancyUrl && exactMatch(row.vacancyUrl, context.vacancyUrl)) {
    reasons.push({ field: 'vacancyUrl', weight: 100, matchedValue: context.vacancyUrl });
  }

  if (context.company && exactMatch(row.company, context.company)) {
    reasons.push({ field: 'company', weight: 28, matchedValue: context.company });
  }

  if (context.roleTitle && exactMatch(row.roleTitle, context.roleTitle)) {
    reasons.push({ field: 'role', weight: 24, matchedValue: context.roleTitle });
  }

  if (context.title && exactMatch(row.title, context.title)) {
    reasons.push({ field: 'title', weight: 20, matchedValue: context.title });
  }

  if (companyTokens.length > 0 && row.company && containsAllTokens(row.company, companyTokens)) {
    reasons.push({ field: 'company', weight: 8, matchedValue: row.company });
  }

  if (roleTokens.length > 0 && row.roleTitle && containsAllTokens(row.roleTitle, roleTokens)) {
    reasons.push({ field: 'role', weight: 10, matchedValue: row.roleTitle });
  }

  if (titleTokens.length > 0 && row.title && containsAllTokens(row.title, titleTokens)) {
    reasons.push({ field: 'title', weight: 10, matchedValue: row.title });
  }

  if (stageTokens.length > 0 && row.stageTitle && containsAllTokens(row.stageTitle, stageTokens)) {
    reasons.push({ field: 'stage', weight: 8, matchedValue: row.stageTitle });
  }

  return reasons;
}

function scoreStage(row: TopSearchStageRow, context: TopSearchContext): TopSearchMatchSignal[] {
  const reasons: TopSearchMatchSignal[] = [];
  const stageTokens = splitTokens(context.stageTitle ?? '');
  const companyTokens = splitTokens(context.company ?? '');
  const titleTokens = splitTokens(context.title ?? '');

  if (context.applicationId && exactMatch(row.applicationId, context.applicationId)) {
    reasons.push({ field: 'rawText', weight: 95, matchedValue: context.applicationId });
  }

  if (context.roleTitle && exactMatch(row.title, context.roleTitle)) {
    reasons.push({ field: 'role', weight: 20, matchedValue: context.roleTitle });
  }

  if (stageTokens.length > 0 && row.title && containsAllTokens(row.title, stageTokens)) {
    reasons.push({ field: 'stage', weight: 38, matchedValue: row.title });
  }

  if (companyTokens.length > 0 && row.company && containsAllTokens(row.company, companyTokens)) {
    reasons.push({ field: 'company', weight: 14, matchedValue: row.company });
  }

  if (titleTokens.length > 0 && row.title && containsAllTokens(row.title, titleTokens)) {
    reasons.push({ field: 'title', weight: 12, matchedValue: row.title });
  }

  return reasons;
}

export function scoreTopSearchCandidate(row: TopSearchResultRow, preview: ApplicationIntakeResult): TopSearchMatch {
  const context = toContext(preview);
  const reasons = row.kind === 'vacancy' ? scoreVacancy(row, context) : scoreStage(row, context);
  const score = reasons.reduce((sum, signal) => sum + signal.weight, 0);
  return { row, score, reasons };
}

export function scoreTopSearchMatches(
  preview: ApplicationIntakeResult,
  candidates: TopSearchResultRow[],
): TopSearchMatchResult {
  const scored = candidates
    .map(candidate => scoreTopSearchCandidate(candidate, preview))
    .filter(item => item.score >= SCORE_MIN_MATCH_THRESHOLD)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (left.row.title || '').localeCompare(right.row.title || '');
    });

  const [primary, secondary] = scored;
  const scoreGap = (primary?.score ?? 0) - (secondary?.score ?? 0);
  const ambiguous =
    scored.length >= 2 && !!secondary && (primary.score > 0) && scoreGap <= AMBIGUITY_MAX_GAP;

  return {
    candidates: scored,
    primary: primary ?? null,
    ambiguous,
    scoreGap,
  };
}

export function resolveTopSearchProposalTarget(
  preview: ApplicationIntakeResult,
  candidates: TopSearchResultRow[],
): TopSearchProposalTargetResolution {
  const vacancyCandidates = candidates.filter((row): row is TopSearchVacancyRow => row.kind === 'vacancy');
  const matches = scoreTopSearchMatches(preview, vacancyCandidates);
  const aiMatch = preview.existingApplicationMatch;
  const aiMatchCandidate = aiMatch
    ? vacancyCandidates.find(row => row.id === aiMatch.applicationId) ?? null
    : null;

  if (aiMatch && !aiMatchCandidate) {
    return {
      selectedApplicationId: null,
      requiresManualSelection: true,
      reason: 'invalid_ai_match',
      matches,
    };
  }

  if (aiMatchCandidate && (aiMatch?.confidence ?? 0) >= STRONG_AI_MATCH_CONFIDENCE) {
    return {
      selectedApplicationId: aiMatchCandidate.id,
      requiresManualSelection: false,
      reason: 'strong_ai_match',
      matches,
    };
  }

  if (aiMatchCandidate) {
    return {
      selectedApplicationId: null,
      requiresManualSelection: true,
      reason: 'weak_match',
      matches,
    };
  }

  if (matches.ambiguous) {
    return {
      selectedApplicationId: null,
      requiresManualSelection: true,
      reason: 'ambiguous_match',
      matches,
    };
  }

  if (matches.primary?.row.kind === 'vacancy' && matches.primary.score >= STRONG_LOCAL_MATCH_SCORE) {
    return {
      selectedApplicationId: matches.primary.row.id,
      requiresManualSelection: false,
      reason: 'strong_local_match',
      matches,
    };
  }

  if (matches.primary) {
    return {
      selectedApplicationId: null,
      requiresManualSelection: true,
      reason: 'weak_match',
      matches,
    };
  }

  return {
    selectedApplicationId: null,
    requiresManualSelection: true,
    reason: 'no_match',
    matches,
  };
}

type TopSearchIntent = TopSearchPasteIntent['intent'];
