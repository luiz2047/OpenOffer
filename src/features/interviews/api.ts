import type {
  ApplicationCreateFromIntakeResult,
  ApplicationDetail,
  ApplicationIntakeInput,
  ApplicationIntakeResult,
  ApplicationListInput,
  ApplicationUpdatePatch,
  ClearArchivedApplicationsResult,
  InterviewCreatePayload,
  InterviewDetail,
  InterviewIpcResult,
  InterviewListInput,
  InterviewListItem,
  InterviewQuestion,
  InterviewQuestionPayload,
  InterviewRetro,
  InterviewRetroEvaluation,
  InterviewRetroPayload,
  InterviewSourceParseResult,
  InterviewStageCalendarEventPayload,
  InterviewStageCreatePayload,
  InterviewStageUpdatePatch,
  InterviewUpdatePatch,
  PrepBrief,
  PrepBriefPayload,
  ReadinessResult,
  StageWorkspaceSnapshot,
  RetroPromptActionPayload,
  RetroPromptDecision,
  VacancyDossier,
  VacancyDossierPayload,
} from '../../types/interviews';
import { InterviewClientError, createInterviewUiError } from './interviewErrors';

function requireBridge() {
  const api = window.electronAPI;
  if (!api) throw createInterviewUiError('bridge_unavailable', 'Electron API is unavailable', true, 'retry');
  return api;
}

function unwrap<T>(result: InterviewIpcResult<T>): T {
  if (result.ok) return result.data;
  throw new InterviewClientError(result);
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

  async createCalendarEvent(interviewId: string, provider: 'google' | 'macos'): Promise<InterviewDetail> {
    return unwrap(await requireBridge().interviewsCreateCalendarEvent(interviewId, provider));
  },

  async getReadiness(interviewId: string): Promise<ReadinessResult> {
    return unwrap(await requireBridge().interviewsGetReadiness(interviewId));
  },

  async getRetroPrompt(interviewId: string): Promise<RetroPromptDecision> {
    return unwrap(await requireBridge().interviewsGetRetroPrompt(interviewId));
  },

  async getRetroEvaluation(interviewId: string): Promise<InterviewRetroEvaluation | null> {
    return unwrap(await requireBridge().interviewsGetRetroEvaluation(interviewId));
  },

  async generateRetroEvaluation(interviewId: string): Promise<InterviewRetroEvaluation> {
    return unwrap(await requireBridge().interviewsGenerateRetroEvaluation(interviewId));
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

export const applicationApi = {
  async parseIntake(input: ApplicationIntakeInput | string): Promise<ApplicationIntakeResult> {
    return unwrap(await requireBridge().applicationIntakeParse(input));
  },

  async list(input?: ApplicationListInput): Promise<ApplicationDetail[]> {
    return unwrap(await requireBridge().applicationsList(input));
  },

  async get(id: string): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().applicationsGet(id));
  },

  async update(id: string, patch: ApplicationUpdatePatch): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().applicationsUpdate(id, patch));
  },

  async clearArchived(): Promise<ClearArchivedApplicationsResult> {
    return unwrap(await requireBridge().applicationsClearArchived());
  },

  async createFromIntake(intake: ApplicationIntakeResult, options?: { selectedApplicationId?: string | null }): Promise<ApplicationCreateFromIntakeResult> {
    return unwrap(await requireBridge().applicationsCreateFromIntake(
      newOperationId('applications:create-from-intake'),
      { intake, selectedApplicationId: options?.selectedApplicationId ?? null },
    ));
  },
};

export const stageApi = {
  async create(payload: InterviewStageCreatePayload): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().interviewStagesCreate(payload));
  },

  async update(id: string, patch: InterviewStageUpdatePatch): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().interviewStagesUpdate(id, patch));
  },

  async archive(id: string): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().interviewStagesArchive(id));
  },

  async restore(id: string, status: InterviewStageUpdatePatch['status'] = 'scheduled'): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().interviewStagesRestore(id, status));
  },

  async attachMeeting(id: string, meetingId: string): Promise<{ attached: boolean }> {
    return unwrap(await requireBridge().interviewStagesAttachMeeting(id, meetingId));
  },

  async createCalendarEvent(id: string, provider: InterviewStageCalendarEventPayload['provider'], expectedRevision?: number): Promise<ApplicationDetail> {
    return unwrap(await requireBridge().interviewStagesCreateCalendarEvent(id, provider, newOperationId('stage-workspace:calendar-event'), expectedRevision));
  },
};

export const stageWorkspaceApi = {
  async get(stageId: string): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceGet(stageId));
  },

  async preflight(stageId: string, includeAi = false): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspacePreflight(stageId, { includeAi }));
  },

  async retryArtifact(meetingId: string, artifactType: 'transcript' | 'summary' | 'ai_review'): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceRetryArtifact(meetingId, artifactType));
  },

  async ensureBacking(stageId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceEnsureBacking(stageId, expectedRevision));
  },

  async updateStage(stageId: string, patch: InterviewStageUpdatePatch, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceUpdateStage(stageId, newOperationId('stage-workspace:update-stage'), expectedRevision, patch));
  },

  async attachMeeting(stageId: string, meetingId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceAttachMeeting(stageId, meetingId, newOperationId('stage-workspace:attach-meeting'), expectedRevision));
  },

  async prepare(stageId: string, payload: PrepBriefPayload, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspacePrepare(stageId, newOperationId('stage-workspace:prepare'), expectedRevision, payload));
  },

  async start(stageId: string, expectedRevision?: number, context?: Record<string, unknown>): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceStart(stageId, newOperationId('stage-workspace:start'), expectedRevision, context));
  },

  async stop(meetingId: string, expectedSessionRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceStop(meetingId, newOperationId('stage-workspace:stop'), expectedSessionRevision));
  },

  async fail(meetingId: string, failureCode = 'capture_start_failed'): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceFail(meetingId, newOperationId('stage-workspace:fail'), failureCode));
  },

  async saveReview(stageId: string, meetingId: string, review: Record<string, unknown>, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceSaveReview(stageId, meetingId, review, expectedRevision));
  },

  async selectPrimary(stageId: string, meetingId: string | null, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceSelectPrimary(stageId, meetingId, expectedRevision));
  },

  async clearReview(stageId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceClearReview(stageId, 'clear-stage-review', expectedRevision));
  },

  async deleteSession(meetingId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceDeleteSession(meetingId, 'delete-stage-session', expectedRevision));
  },

  async setNextAction(stageId: string, nextAction: { text?: string | null; dueAt?: number | null; state?: 'missing' | 'saved' | 'completed' | 'none_required' }, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceSetNextAction(stageId, nextAction, expectedRevision));
  },

  async completeNextAction(stageId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceCompleteNextAction(stageId, expectedRevision));
  },

  async noNextAction(stageId: string, expectedRevision?: number): Promise<StageWorkspaceSnapshot> {
    return unwrap(await requireBridge().stageWorkspaceNoNextAction(stageId, expectedRevision));
  },

  async export(stageId: string, format: 'json' | 'markdown', includeTranscript = false) {
    return unwrap(await requireBridge().stageWorkspaceExport(stageId, format, includeTranscript));
  },
};
