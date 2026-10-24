// Lets non-React code (the Apollo error link) tell the auth provider that the
// server rejected the session, without a global navigation singleton.

type SessionEndedListener = () => void;

const sessionEndedListeners = new Set<SessionEndedListener>();

// Returns an unsubscribe function, suitable as a useEffect cleanup.
export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
  };
}

export function notifySessionEnded(): void {
  sessionEndedListeners.forEach((listener) => listener());
}
