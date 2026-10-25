// Pure helpers for showing the user's AI tasks (the server's task records).

export interface TaskRecord {
  id: string;
  feature: string;
  status: string;
  progress: number;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

const FEATURE_LABELS = new Map<string, string>(
  Object.entries({
    chat_response: 'Chat',
    image_generation: 'Image',
    voice_processing: 'Voice',
    voice_clone: 'Voice clone',
    voice_registration: 'Voice profile',
    face_processing: 'Face',
    document_ingestion: 'Document',
  })
);

const STATUS_LABELS = new Map<string, string>(
  Object.entries({
    queued: 'Waiting',
    processing: 'Working',
    completed: 'Done',
    failed: 'Did not finish',
    canceled: 'Canceled',
  })
);

export function featureLabel(feature: string): string {
  return FEATURE_LABELS.get(feature) ?? 'Task';
}

// An unknown status is reported as such rather than guessed to be working or done.
export function statusLabel(status: string): string {
  return STATUS_LABELS.get(status) ?? 'Unknown';
}

export function isActiveStatus(status: string): boolean {
  return status === 'queued' || status === 'processing';
}

export function progressPercent(task: Pick<TaskRecord, 'progress'>): number {
  if (!Number.isFinite(task.progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(task.progress)));
}

export function parseTaskMetadata(metadata?: string | null): Record<string, unknown> {
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

// Where tapping a task goes. Only chat tasks have a screen on mobile so far; the others open
// nothing until their feature screens exist, rather than leading to a placeholder.
export function taskDestination(task: Pick<TaskRecord, 'feature' | 'metadata'>): string | null {
  if (task.feature !== 'chat_response') return null;
  const chatId = parseTaskMetadata(task.metadata).chatId;
  if (typeof chatId !== 'string' || chatId === '') return null;
  return `/features/chats/${encodeURIComponent(chatId)}`;
}

// Plain-language age ("2 min ago"). Tasks are recent by definition, so days are the largest unit.
export function timeAgo(isoDate: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
