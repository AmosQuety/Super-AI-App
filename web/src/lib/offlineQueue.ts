/**
 * offlineQueue.ts
 *
 * Module-level persistent offline message queue.
 *
 * Survives component remounts and React re-renders because state lives at
 * module scope, not inside a React component. This matches the spec requirement:
 * "queue must survive component remounts — use context or module-level store."
 *
 * Scope (Phase 4 — scoped down per approval):
 *   ✅ Persistent module-level queue store
 *   ✅ "Queued — will send when reconnected" UI state helpers
 *   ✅ Automatic flush on the window 'online' event
 *   ✗ Retry logic on flush failure (follow-up)
 *   ✗ Conflict resolution (follow-up)
 *   ✗ Sync progress indicators (follow-up)
 */

export interface QueuedMessage {
  id: string;
  text: string;
  attachment?: File;
  queuedAt: number; // epoch ms
}

type FlushListener = (messages: QueuedMessage[]) => void;

// ── Module-level state (survives React remounts) ────────────────────────────
let queue: QueuedMessage[] = [];
let flushListeners: FlushListener[] = [];

// ── Public API ───────────────────────────────────────────────────────────────

/** Add a message to the offline queue. Returns the assigned queue ID. */
export function enqueue(text: string, attachment?: File): string {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  queue = [...queue, { id, text, attachment, queuedAt: Date.now() }];
  return id;
}

/** Remove a specific message by ID (e.g., after it has been sent). */
export function dequeue(id: string): void {
  queue = queue.filter(m => m.id !== id);
}

/** Return a snapshot of the current queue (read-only). */
export function getQueue(): readonly QueuedMessage[] {
  return queue;
}

/** Return the number of pending messages. */
export function queueSize(): number {
  return queue.length;
}

/**
 * Register a flush listener. Called automatically when the 'online' event fires.
 * The listener receives the full pending queue snapshot.
 * Returns an unsubscribe function.
 */
export function onFlush(listener: FlushListener): () => void {
  flushListeners = [...flushListeners, listener];
  return () => {
    flushListeners = flushListeners.filter(l => l !== listener);
  };
}

/**
 * Manually trigger flush (also called automatically on window 'online').
 * Clears the queue before calling listeners so that messages added during
 * the flush do not accidentally get sent twice.
 */
export function flush(): void {
  if (queue.length === 0) return;
  const snapshot = queue;
  queue = []; // clear before dispatching
  flushListeners.forEach(l => {
    try { l(snapshot); } catch { /* individual listener errors must not break flush */ }
  });
}

// ── Auto-flush wiring ────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush());
}
