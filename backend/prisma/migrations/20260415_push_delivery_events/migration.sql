CREATE TABLE "push_delivery_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT,
  "subscriptionId" TEXT,
  "endpointHash" TEXT,
  "eventType" TEXT NOT NULL,
  "deliveryClass" TEXT,
  "providerStatusCode" INTEGER,
  "attemptCount" INTEGER,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "push_delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_delivery_events_createdAt_idx" ON "push_delivery_events"("createdAt" DESC);
CREATE INDEX "push_delivery_events_userId_createdAt_idx" ON "push_delivery_events"("userId", "createdAt" DESC);
CREATE INDEX "push_delivery_events_eventType_createdAt_idx" ON "push_delivery_events"("eventType", "createdAt" DESC);
CREATE INDEX "push_delivery_events_deliveryClass_createdAt_idx" ON "push_delivery_events"("deliveryClass", "createdAt" DESC);

ALTER TABLE "push_delivery_events"
ADD CONSTRAINT "push_delivery_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_delivery_events"
ADD CONSTRAINT "push_delivery_events_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_delivery_events"
ADD CONSTRAINT "push_delivery_events_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;