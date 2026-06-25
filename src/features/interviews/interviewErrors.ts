import type { InterviewErrorAction, InterviewErrorCode, InterviewIpcResult } from '../../types/interviews';

export interface InterviewUiError {
  code: InterviewErrorCode;
  message: string;
  retryable: boolean;
  action: InterviewErrorAction;
  i18nKey: `errors.interviews.${InterviewErrorCode}`;
}

export class InterviewClientError extends Error implements InterviewUiError {
  public readonly code: InterviewErrorCode;
  public readonly retryable: boolean;
  public readonly action: InterviewErrorAction;
  public readonly i18nKey: `errors.interviews.${InterviewErrorCode}`;

  constructor(result: Extract<InterviewIpcResult<never>, { ok: false }>) {
    super(result.message);
    this.name = 'InterviewClientError';
    this.code = result.code;
    this.retryable = result.retryable;
    this.action = result.action;
    this.i18nKey = interviewErrorI18nKey(result.code);
  }
}

export function interviewErrorI18nKey(code: InterviewErrorCode): `errors.interviews.${InterviewErrorCode}` {
  return `errors.interviews.${code}`;
}

export function createInterviewUiError(
  code: InterviewErrorCode,
  message: string = code,
  retryable = false,
  action: InterviewErrorAction = 'none',
): InterviewUiError {
  return {
    code,
    message,
    retryable,
    action,
    i18nKey: interviewErrorI18nKey(code),
  };
}

export function normalizeInterviewError(
  error: unknown,
  fallbackCode: InterviewErrorCode = 'unexpected_error',
  fallbackAction: InterviewErrorAction = fallbackCode === 'unexpected_error' ? 'retry' : 'none',
): InterviewUiError {
  if (error instanceof InterviewClientError) {
    return createInterviewUiError(error.code, error.message, error.retryable, error.action);
  }

  const candidate = error as Partial<InterviewUiError> | null | undefined;
  if (candidate?.code && candidate?.i18nKey) {
    return createInterviewUiError(
      candidate.code,
      candidate.message || candidate.code,
      Boolean(candidate.retryable),
      candidate.action || fallbackAction,
    );
  }

  const message = String((error as any)?.message || error || fallbackCode);
  return createInterviewUiError(fallbackCode, message, fallbackCode === 'unexpected_error', fallbackAction);
}
