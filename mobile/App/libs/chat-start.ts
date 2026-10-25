// Pure helpers for starting a chat: its title, the rule that the first message is sent only
// once, and how a failed send is explained to the user.

const MAX_TITLE_CHARACTERS = 40;

// Same rule as web: the first 40 characters, with an ellipsis when cut. Counted in code points
// so an emoji is never split. Undefined means "no title", and the server default applies.
export function titleFromMessage(message: string): string | undefined {
  const text = message.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  const characters = Array.from(text);
  if (characters.length <= MAX_TITLE_CHARACTERS) return text;
  return `${characters.slice(0, MAX_TITLE_CHARACTERS).join('')}...`;
}

// A new chat is opened with the first message in its route. The chat screen can mount more than
// once (re-renders, Fast Refresh, navigation), and sending twice would save the message twice,
// so the claim lives at module level rather than in component state.
const claimedFirstMessages = new Set<string>();

export function claimFirstMessage(chatId: string): boolean {
  if (claimedFirstMessages.has(chatId)) return false;
  claimedFirstMessages.add(chatId);
  return true;
}

export function releaseFirstMessage(chatId: string): void {
  claimedFirstMessages.delete(chatId);
}

export interface SendFailure {
  message: string;
  canRetry: boolean;
}

interface ServerErrorLike {
  message?: string;
  statusCode?: number;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

// Apollo 4 reports an answer from the server as an error carrying `errors`; anything else
// that reaches us (fetch rejecting, timeouts) never got an answer, so it is a connection problem.
export function describeSendFailure(error: unknown): SendFailure {
  const serverError = error as ServerErrorLike | null;
  const serverAnswer = Array.isArray(serverError?.errors) ? serverError?.errors : undefined;

  if (serverAnswer) {
    const first = serverAnswer[0];
    if (first?.message === 'Chat not found') {
      return { message: 'This chat no longer exists.', canRetry: false };
    }
    // An unexpected server failure carries internal wording that is no use to the user.
    if (first?.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      return { message: 'The server had a problem. Please try again.', canRetry: true };
    }
    return { message: first?.message || 'The reply could not be created.', canRetry: true };
  }

  // The server answered with an HTTP error (rate limit, gateway, outage): not a lost connection.
  if (typeof serverError?.statusCode === 'number') {
    return { message: 'The server could not handle that. Please try again.', canRetry: true };
  }

  if (error instanceof Error) {
    return { message: 'No connection. Check your internet and try again.', canRetry: true };
  }
  return { message: 'Something went wrong. Please try again.', canRetry: true };
}
