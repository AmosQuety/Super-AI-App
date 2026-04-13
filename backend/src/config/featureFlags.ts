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
  pushEnabled: parseBoolean(process.env.FEATURE_PUSH_ENABLED, true),
  pushRolloutPercent: parsePercent(process.env.FEATURE_PUSH_ROLLOUT_PERCENT, 100),
  pushInternalUsers: new Set(
    (process.env.FEATURE_PUSH_INTERNAL_USERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
};

export function isPushEnabledForUser(userId: string): boolean {
  if (!featureFlags.pushEnabled) {
    return false;
  }

  if (featureFlags.pushInternalUsers.has(userId)) {
    return true;
  }

  if (featureFlags.pushRolloutPercent >= 100) {
    return true;
  }

  const bucket = hashToPercent(userId);
  return bucket < featureFlags.pushRolloutPercent;
}