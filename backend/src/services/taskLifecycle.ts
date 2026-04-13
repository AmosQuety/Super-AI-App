export const TASK_STATUSES = ["queued", "processing", "completed", "failed", "canceled"] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export const TERMINAL_TASK_STATUSES: ReadonlyArray<TaskStatus> = ["completed", "failed", "canceled"];

export function isTerminalTaskStatus(status: string): status is Exclude<TaskStatus, "queued" | "processing"> {
  return TERMINAL_TASK_STATUSES.includes(status as TaskStatus);
}

export function isValidTaskTransition(currentStatus: string, nextStatus: string): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  switch (currentStatus) {
    case "queued":
      return ["processing", "failed", "canceled"].includes(nextStatus);
    case "processing":
      return ["completed", "failed", "canceled"].includes(nextStatus);
    case "completed":
    case "failed":
    case "canceled":
      return false;
    default:
      return false;
  }
}

export function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.floor(progress)));
}

export function sanitizeTaskErrorMessage(errorMessage?: string | null): string | undefined {
  if (!errorMessage) {
    return undefined;
  }

  const cleanedMessage = errorMessage.trim().replace(/\s+/g, " ");
  return cleanedMessage.slice(0, 500) || undefined;
}

export function serializeTaskMetadata(metadata?: Record<string, unknown> | null): string | undefined {
  if (!metadata) {
    return undefined;
  }

  return JSON.stringify(metadata).slice(0, 4000);
}

export function mergeTaskMetadata(
  currentMetadata?: string | null,
  nextMetadata?: Record<string, unknown> | null,
): string | undefined {
  if (!nextMetadata) {
    return currentMetadata ?? undefined;
  }

  const parsedMetadata = currentMetadata ? safeParseMetadata(currentMetadata) : {};
  return JSON.stringify({ ...parsedMetadata, ...nextMetadata }).slice(0, 4000);
}

export function safeParseMetadata(metadata: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed metadata and recover with an empty object.
  }

  return {};
}

export function getTaskArchiveCutoff(retentionDays: number, now = new Date()): Date {
  const safeRetentionDays = Math.max(1, Math.floor(retentionDays));
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - safeRetentionDays);
  return cutoff;
}