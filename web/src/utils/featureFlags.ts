function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parsePercent(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function hashToPercent(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash % 100);
}

export const featureFlags = {
  taskCenterEnabled: parseBoolean(import.meta.env.VITE_TASK_CENTER_ENABLED, true),
  taskCenterRolloutPercent: parsePercent(import.meta.env.VITE_TASK_CENTER_ROLLOUT_PERCENT, 100),
};

export function isTaskCenterEnabledForUser(userId: string | null | undefined): boolean {
  if (!featureFlags.taskCenterEnabled) {
    return false;
  }

  if (!userId) {
    return featureFlags.taskCenterRolloutPercent >= 100;
  }

  if (featureFlags.taskCenterRolloutPercent >= 100) {
    return true;
  }

  const bucket = hashToPercent(userId);
  return bucket < featureFlags.taskCenterRolloutPercent;
}