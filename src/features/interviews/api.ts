import type {
  InterviewCreatePayload,
  InterviewDetail,
  InterviewIpcResult,
  InterviewListInput,
  InterviewListItem,
  InterviewQuestion,
  InterviewQuestionPayload,
  InterviewRetro,
  InterviewRetroPayload,
  InterviewSourceParseResult,
  InterviewUpdatePatch,
  PrepBrief,
  PrepBriefPayload,
  ReadinessResult,
  RetroPromptActionPayload,
  RetroPromptDecision,
  VacancyDossier,
  VacancyDossierPayload,
} from '../../types/interviews';

function requireBridge() {
  const api = window.electronAPI;
  if (!api) throw new Error('Electron API is unavailable');
  return api;
}

function unwrap<T>(result: InterviewIpcResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(result.message);
}

export function newOperationId(action: string): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${action}:${suffix}`;
}

export const interviewApi = {
  async list(input?: InterviewListInput): Promise<InterviewListItem[]> {
    return unwrap(await requireBridge().interviewsList(input));
  },

  async get(id: string): Promise<InterviewDetail> {
    return unwrap(await requireBridge().interviewsGet({
      id,
      include: ['dossier', 'prep', 'retros', 'questions', 'contacts', 'meetings'],
    }));
  },

  async create(payload: InterviewCreatePayload): Promise<InterviewDetail> {
    return unwrap(await requireBridge().interviewsCreate(newOperationId('interviews:create'), payload));
  },

  async parseSourceText(text: string): Promise<InterviewSourceParseResult> {
    return unwrap(await requireBridge().interviewsParseSourceText({ text }));
  },

  async update(id: string, patch: InterviewUpdatePatch): Promise<InterviewDetail> {
    return unwrap(await requireBridge().interviewsUpdate(id, patch));
  },

  async archive(id: string): Promise<{ archived: boolean }> {
    return unwrap(await requireBridge().interviewsArchive(id));
  },

  async attachMeeting(interviewId: string, meetingId: string): Promise<{ attached: boolean }> {
    return unwrap(await requireBridge().interviewsAttachMeeting(interviewId, meetingId));
  },

  async getReadiness(interviewId: string): Promise<ReadinessResult> {
    return unwrap(await requireBridge().interviewsGetReadiness(interviewId));
  },

  async getRetroPrompt(interviewId: string): Promise<RetroPromptDecision> {
    return unwrap(await requireBridge().interviewsGetRetroPrompt(interviewId));
  },

  async updateRetroPrompt(interviewId: string, payload: RetroPromptActionPayload): Promise<RetroPromptDecision> {
    return unwrap(await requireBridge().interviewsUpdateRetroPrompt(interviewId, payload));
  },

  async saveDossier(interviewId: string, payload: VacancyDossierPayload): Promise<VacancyDossier> {
    return unwrap(await requireBridge().vacancyDossierSave(interviewId, newOperationId('vacancy-dossiers:save'), payload));
  },

  async savePrep(interviewId: string, payload: PrepBriefPayload): Promise<PrepBrief> {
    return unwrap(await requireBridge().prepBriefSave(interviewId, newOperationId('prep-briefs:save'), payload));
  },

  async saveRetro(interviewId: string, payload: InterviewRetroPayload): Promise<InterviewRetro> {
    return unwrap(await requireBridge().interviewRetroSave(interviewId, newOperationId('interview-retros:save'), payload));
  },

  async listQuestions(interviewId?: string): Promise<InterviewQuestion[]> {
    return unwrap(await requireBridge().interviewQuestionsList(interviewId));
  },

  async saveQuestions(interviewId: string, questions: InterviewQuestionPayload[]): Promise<InterviewQuestion[]> {
    return unwrap(await requireBridge().interviewQuestionsSave(interviewId, newOperationId('interview-questions:save'), questions));
  },
};
