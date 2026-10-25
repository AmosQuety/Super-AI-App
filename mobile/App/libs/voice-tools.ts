// Pure helpers for the voice screen's text tools (translate and summarize through the backend).

// Same limit as the backend (processVoiceTask).
export const MAX_TEXT_LENGTH = 5000;

export function canProcessText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_LENGTH;
}

export interface VoiceFailure {
  message: string;
  canRetry: boolean;
}

const GENERIC_FAILURE: VoiceFailure = {
  message: 'The text could not be processed. Please try again.',
  canRetry: true,
};

// The server says why only for the two cases the user can fix; any other wording (it can contain
// internal details) becomes one fixed sentence.
export function textTooLong(): VoiceFailure {
  return {
    message: `That text is too long. Keep it under ${MAX_TEXT_LENGTH} characters.`,
    canRetry: false,
  };
}

// A result must never replace text the user changed while the request was running.
export function shouldApplyResult(sentText: string, currentText: string): boolean {
  return sentText === currentText;
}

export function describeVoiceFailure(serverMessage?: string | null): VoiceFailure {
  const text = serverMessage ?? '';
  if (/exceeds the maximum/i.test(text)) return textTooLong();
  if (/going too fast/i.test(text)) {
    return { message: 'You are going too fast. Wait a minute, then try again.', canRetry: true };
  }
  if (/invalid target language/i.test(text)) {
    return { message: 'That language cannot be used.', canRetry: false };
  }
  return GENERIC_FAILURE;
}

// For an error thrown by the request itself: Apollo 4 reports an answer from the server as an
// error carrying `errors`, an HTTP error carries `statusCode`, and anything else never got an answer.
export function describeVoiceError(error: unknown): VoiceFailure {
  const candidate = error as {
    errors?: { message?: string; extensions?: { code?: string } }[];
    statusCode?: number;
  } | null;
  if (Array.isArray(candidate?.errors)) {
    if (candidate?.errors[0]?.extensions?.code === 'UNAUTHENTICATED') {
      return { message: 'Your session has ended. Please sign in again.', canRetry: false };
    }
    return describeVoiceFailure(candidate?.errors[0]?.message);
  }
  if (typeof candidate?.statusCode === 'number') return GENERIC_FAILURE;
  return { message: 'No connection. Check your internet and try again.', canRetry: true };
}
