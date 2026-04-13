# Phase 5 Reliability and Observability

## Delivered Scope

- Push delivery retries with exponential backoff for transient failures.
- No retry for permanent push subscription errors.
- Persistent push telemetry for sent, failed, clicked, and opened-app events.
- Spike alert checks for push failures and task failure events.
- Privacy-safe push payloads with minimal data only.
- Access-controlled operational metrics query (admin-only).

## Reliability Rules

### Retry and backoff

- Retry only for transient failures:
  - network/no status code
  - 408, 425, 429, 500, 502, 503, 504
- No retry for permanent failures:
  - all other status codes
- Retry parameters (env):
  - PUSH_MAX_SEND_ATTEMPTS (default 3)
  - PUSH_INITIAL_BACKOFF_MS (default 300)

### Subscription cleanup

- 404 and 410 deactivate the subscription immediately.

## Telemetry Model

Stored in push_delivery_events:

- eventType:
  - sent
  - failed
  - clicked
  - opened_app
- deliveryClass:
  - transient
  - permanent
  - engagement
- providerStatusCode
- attemptCount
- endpointHash (privacy-preserving hash)
- taskId/userId linkage for trend analysis

## Operational Metrics

GraphQL query (admin-only):

- pushDeliveryMetrics(windowMinutes: Int = 60)

Returns:

- sent
- failed
- clicked
- openedApp
- transientFailures
- permanentFailures
- failureRate

This query can be scraped/polled by your ops dashboard tool.

## Alerting

### Alert channels

- Structured error logs with [ops-alert] markers.
- Optional webhook notifications via OPS_ALERT_WEBHOOK_URL.

### Spike thresholds (env)

- ALERT_WINDOW_MINUTES (default 15)
- ALERT_PUSH_FAILURE_SPIKE_THRESHOLD (default 20)
- ALERT_TASK_FAILURE_SPIKE_THRESHOLD (default 15)
- ALERT_COOLDOWN_MS (default 600000)

### Trigger conditions

- Push failure spike: failed push delivery events exceed threshold in the active window.
- Task failure spike: task.failed events exceed threshold in the active window.

## Security and Privacy Checks

### Minimal payload

Push payload intentionally excludes:

- raw prompts
- chat message content
- uploaded document text
- provider error text

Payload includes only:

- taskId
- feature
- status
- progress
- route target

### Access control

- Task queries are user-scoped by authenticated user id.
- Push subscription list/register/unregister requires authentication.
- pushDeliveryMetrics is admin-only.
- Engagement telemetry mutation requires authentication.

## Deployment Checklist

1. Apply migrations.
2. Regenerate Prisma client.
3. Ensure VAPID env vars are set.
4. Set alert threshold env vars.
5. Set OPS_ALERT_WEBHOOK_URL for incident paging (optional but recommended).
6. Point dashboard poller to pushDeliveryMetrics query.
7. Validate with staged push success/failure/click/open tests.

## Exit Criteria Mapping

- Operational dashboards and alerts are live:
  - enabled through pushDeliveryMetrics + alert webhook/log triggers.
- Security review passed:
  - minimal payload and scoped access controls are implemented.
