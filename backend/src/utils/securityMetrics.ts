import * as Sentry from "@sentry/node";
import { logger } from "./logger";

// Counts security events (failed sign-ins, lockouts) so a spike shows up on a dashboard even
// when no single account is involved, for example credential stuffing against unknown emails.
// Attributes must stay low-cardinality and free of personal data: a fixed reason or scope,
// never an email, address or user id. Counted through Sentry, which is already configured; with
// no SENTRY_DSN it does nothing.
type MetricSink = (name: string, attributes: Record<string, string>) => void;

const sentrySink: MetricSink = (name, attributes) =>
  Sentry.metrics.count(name, 1, { attributes });

let sink: MetricSink = sentrySink;

// For tests: replace where counts go, or pass undefined to restore the default.
export function setSecurityMetricSink(replacement: MetricSink | undefined): void {
  sink = replacement ?? sentrySink;
}

// Metrics must never break the request they describe.
export function countSecurityEvent(
  name: string,
  attributes: Record<string, string>,
): void {
  try {
    sink(name, attributes);
  } catch (error: any) {
    logger.warn("[metrics] could not count a security event", {
      name,
      message: error.message,
    });
  }
}
