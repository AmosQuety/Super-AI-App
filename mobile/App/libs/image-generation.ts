// Pure helpers for the image generation screen.

// Same limit as the backend (IMAGE_GENERATION_CONFIG.MAX_PROMPT_LENGTH).
export const MAX_PROMPT_LENGTH = 500;
const MAX_IMAGES = 4;
const MAX_FILE_SLUG_LENGTH = 40;

export function canGenerate(prompt: string): boolean {
  const trimmed = prompt.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PROMPT_LENGTH;
}

export interface GenerationFailure {
  message: string;
  canRetry: boolean;
}

// The server's wording can include provider details, so only a few known, user-actionable
// answers are recognised; everything else becomes one fixed sentence.
export function describeGenerationFailure(serverMessage?: string | null): GenerationFailure {
  const text = serverMessage ?? '';
  if (/daily image limit/i.test(text)) {
    return {
      message: "You have reached today's image limit. It resets every 24 hours.",
      canRetry: false,
    };
  }
  if (/rate limit|too fast/i.test(text)) {
    return {
      message: 'You are generating too quickly. Wait a minute, then try again.',
      canRetry: true,
    };
  }
  if (/prompt exceeds|too long/i.test(text)) {
    return {
      message: `That description is too long. Keep it under ${MAX_PROMPT_LENGTH} characters.`,
      canRetry: false,
    };
  }
  return { message: 'The images could not be created. Please try again.', canRetry: true };
}

// For an error thrown by the request itself (as opposed to a "success: false" answer): Apollo 4
// reports an answer from the server as an error carrying `errors`, an HTTP error carries
// `statusCode`, and anything else never got an answer.
export function describeGenerationError(error: unknown): GenerationFailure {
  const candidate = error as { errors?: { message?: string }[]; statusCode?: number } | null;
  if (Array.isArray(candidate?.errors)) {
    return describeGenerationFailure(candidate?.errors[0]?.message);
  }
  if (typeof candidate?.statusCode === 'number') {
    return describeGenerationFailure(null);
  }
  return { message: 'No connection. Check your internet and try again.', canRetry: true };
}

// A name for the saved file: letters and digits from the prompt only, so a prompt can never
// shape a path.
export function imageFileName(prompt: string, index: number, extension: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILE_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug ? `ai-image-${slug}-${index + 1}.${extension}` : `ai-image-${index + 1}.${extension}`;
}

const KNOWN_EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  webp: 'webp',
};

// The saved file is named by what it really is, so a gallery does not label a PNG as a JPEG.
export function imageExtension(source: string): string {
  const type = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(source)?.[1]?.toLowerCase();
  return (type && KNOWN_EXTENSIONS[type]) || 'jpg';
}

const IMAGE_DATA_URI = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i;

export function base64FromDataUri(uri: string): string | null {
  const match = IMAGE_DATA_URI.exec(uri);
  return match ? match[1] : null;
}

function parseMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

// Only inline image data is shown or saved: the provider returns base64, and a link would make
// the phone contact whatever host the stored data names.
function isUsableImageSource(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_DATA_URI.test(value);
}

export function keepUsableImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter(isUsableImageSource).slice(0, MAX_IMAGES);
}

// Images of a finished task, for restoring a result from the task list.
export function parseTaskImages(metadata?: string | null): string[] {
  return keepUsableImages(parseMetadata(metadata).images);
}

export function parseTaskPrompt(metadata?: string | null): string {
  const prompt = parseMetadata(metadata).prompt;
  return typeof prompt === 'string' ? prompt : '';
}

export type RestoreState = 'none' | 'loading' | 'missing' | 'running' | 'completed' | 'failed';

// What the screen shows when it was opened for one task (from the AI tasks list, or because a
// generation was still running). A task the server does not return (someone else's, deleted,
// mistyped) is "missing", so the screen never waits for something that will not come.
export function restoreState(input: {
  taskId?: string;
  task: { feature: string; status: string } | null;
  error: boolean;
  loading: boolean;
}): RestoreState {
  if (!input.taskId) return 'none';
  if (!input.task) return input.loading && !input.error ? 'loading' : 'missing';
  if (input.task.feature !== 'image_generation') return 'missing';
  if (input.task.status === 'queued' || input.task.status === 'processing') return 'running';
  if (input.task.status === 'completed') return 'completed';
  return 'failed';
}

// A generation is slow but bounded (the provider timeout is two minutes); a task that claims to be
// running and has not moved for longer is stuck, and must not block the user from trying again.
const RUNNING_TASK_MAX_AGE_MS = 3 * 60_000;

export function findRunningImageTaskId(
  tasks: { id: string; feature: string; status: string; updatedAt: string }[] | null | undefined,
  now: number = Date.now()
): string | null {
  const running = (tasks ?? []).find(
    (task) =>
      task.feature === 'image_generation' &&
      (task.status === 'queued' || task.status === 'processing') &&
      now - new Date(task.updatedAt).getTime() <= RUNNING_TASK_MAX_AGE_MS
  );
  return running?.id ?? null;
}
