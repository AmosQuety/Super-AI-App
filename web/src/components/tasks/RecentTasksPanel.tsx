import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, ListChecks, RefreshCcw, XCircle } from "lucide-react";
import { GET_MY_TASKS } from "../../graphql/tasks";
import { useToast } from "../ui/toastContext";

interface TaskRecord {
  id: string;
  feature: string;
  status: string;
  progress: number;
  metadata?: string | null;
  resultReference?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  canceledAt?: string | null;
}

interface TaskQueryData {
  myTasks: TaskRecord[];
}

const LAST_SEEN_KEY = "xemora.tasks.lastSeenTerminalAt";

function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

function getFeatureLabel(feature: string): string {
  switch (feature) {
    case "chat_response":
      return "Chat";
    case "image_generation":
      return "Image";
    case "voice_processing":
      return "Voice";
    case "voice_clone":
      return "Voice clone";
    case "voice_registration":
      return "Voice profile";
    case "document_ingestion":
      return "Document";
    default:
      return "Task";
  }
}

function parseTaskMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function getTaskLink(task: TaskRecord): string {
  const metadata = parseTaskMetadata(task.metadata);
  const chatId = typeof metadata.chatId === "string" ? metadata.chatId : null;

  switch (task.feature) {
    case "chat_response":
      return chatId ? `/chat?chatId=${encodeURIComponent(chatId)}&taskId=${encodeURIComponent(task.id)}` : `/chat?taskId=${encodeURIComponent(task.id)}`;
    case "image_generation":
      return `/image?taskId=${encodeURIComponent(task.id)}`;
    case "voice_processing":
    case "voice_clone":
    case "voice_registration":
      return `/voice?taskId=${encodeURIComponent(task.id)}`;
    case "document_ingestion":
      return `/chat?taskId=${encodeURIComponent(task.id)}`;
    default:
      return `/dashboard?taskId=${encodeURIComponent(task.id)}`;
  }
}

export default function RecentTasksPanel() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const hiddenAtRef = useRef<number | null>(null);
  const [lastSeenTerminalAt, setLastSeenTerminalAt] = useState<number>(() => {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const { data, loading, refetch } = useQuery<TaskQueryData>(GET_MY_TASKS, {
    variables: { limit: 12, includeArchived: false },
    fetchPolicy: "cache-and-network",
    pollInterval: 15000,
  });

  const tasks = data?.myTasks ?? [];

  const unreadCompletedCount = useMemo(() => {
    return tasks.filter((task) => {
      return task.status === "completed" && new Date(task.updatedAt).getTime() > lastSeenTerminalAt;
    }).length;
  }, [lastSeenTerminalAt, tasks]);

  const lastSeenLabel = useMemo(() => {
    if (!lastSeenTerminalAt) {
      return "Never";
    }

    return new Date(lastSeenTerminalAt).toLocaleString();
  }, [lastSeenTerminalAt]);

  const markSeen = () => {
    const newestTerminalUpdate = tasks
      .filter((task) => isTerminal(task.status))
      .map((task) => new Date(task.updatedAt).getTime())
      .reduce((max, value) => Math.max(max, value), 0);

    const next = newestTerminalUpdate || Date.now();
    setLastSeenTerminalAt(next);
    localStorage.setItem(LAST_SEEN_KEY, String(next));
  };

  useEffect(() => {
    const refreshAndNotify = async () => {
      const result = await refetch();
      const freshTasks = result.data?.myTasks ?? [];
      const hiddenAt = hiddenAtRef.current;

      if (!hiddenAt) {
        return;
      }

      const finishedWhileAway = freshTasks.filter((task) => {
        return task.status === "completed" && new Date(task.updatedAt).getTime() > hiddenAt;
      });

      hiddenAtRef.current = null;

      if (finishedWhileAway.length > 0) {
        addToast({
          type: "success",
          title: "Tasks finished while you were away",
          message: `${finishedWhileAway.length} recent AI task${finishedWhileAway.length === 1 ? "" : "s"} just completed. Open Recent AI Tasks to resume quickly.`,
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState === "visible") {
        void refreshAndNotify();
      }
    };

    const onFocus = () => {
      void refreshAndNotify();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [addToast, refetch]);

  return (
    <section className="mt-10 rounded-3xl border border-theme-light bg-theme-secondary p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-cyan-400" />
            Recent AI Tasks
          </h2>
          <p className="text-sm text-theme-secondary mt-1">
            You can leave anytime. Results always recover here even if push delivery is unavailable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-theme-tertiary">
            Last Seen: {lastSeenLabel}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {unreadCompletedCount} unread completed
          </span>
          <button
            onClick={markSeen}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-theme-tertiary text-theme-primary border border-theme-light hover:bg-theme-light transition"
          >
            Mark Seen
          </button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="text-theme-secondary flex items-center gap-2 text-sm">
          <RefreshCcw className="w-4 h-4 animate-spin" /> Refreshing recent tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-theme-secondary text-sm">No recent AI tasks yet.</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const taskLink = getTaskLink(task);
            const status = task.status.toLowerCase();

            return (
              <button
                key={task.id}
                onClick={() => navigate(taskLink)}
                className="w-full text-left rounded-2xl border border-theme-light bg-theme-primary/40 hover:bg-theme-tertiary/50 transition px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-theme-primary truncate">
                      {getFeatureLabel(task.feature)} task
                    </div>
                    <div className="text-xs text-theme-tertiary mt-1 truncate">
                      Updated {new Date(task.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {status === "completed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    )}
                    {status === "failed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/20">
                        <XCircle size={12} /> Failed
                      </span>
                    )}
                    {status === "processing" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        <Clock3 size={12} /> {Math.max(0, Math.min(100, task.progress))}%
                      </span>
                    )}
                    {status === "queued" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
                        <Clock3 size={12} /> Queued
                      </span>
                    )}
                    {status === "canceled" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <XCircle size={12} /> Canceled
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-theme-tertiary" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}