import "./support/testEnvironment";
import assert from "node:assert/strict";
import { logger } from "../src/utils/logger";
import { PushNotificationService } from "../src/services/pushNotificationService";

// Request-scoped code builds services on every request, and a push service is created inside
// them. A missing push configuration is a fact about the process, not about a request, so it must
// be reported once, not once per request (it was filling production logs every few seconds).
function aMissingPushConfigurationIsReportedOncePerProcess() {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;

  const messages: string[] = [];
  const original = logger.warn.bind(logger);
  (logger as any).warn = (message: string) => void messages.push(String(message));
  try {
    for (let request = 0; request < 25; request++) new PushNotificationService({} as any);
  } finally {
    (logger as any).warn = original;
  }

  assert.equal(
    messages.filter((message) => /VAPID not configured/.test(message)).length,
    1,
    "25 requests, one warning",
  );
}

aMissingPushConfigurationIsReportedOncePerProcess();
console.log("pushWarning tests passed");
