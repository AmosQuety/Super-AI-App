# Phase 7 Rollout Plan

## Staged Rollout

### Stage 0: Internal users

- Enable push only for internal allowlist users.
- Keep Task Center enabled for all internal users.
- Validate end-to-end telemetry and alerting behavior.

### Stage 1: 10% production

- Set push rollout to 10%.
- Keep Task Center at 100% (recommended) or stage it independently if needed.
- Track error budget and KPI trends daily.

### Stage 2: 50% production

- Increase push rollout to 50%.
- Confirm no regression in failure rate, completion latency, and user recovery behavior.

### Stage 3: 100% production

- Set rollout to 100%.
- Keep monitoring window active for at least 3 days, ideally 7 days.

## Feature Flag Controls

### Backend flags (push)

- FEATURE_PUSH_ENABLED=true|false
- FEATURE_PUSH_ROLLOUT_PERCENT=0..100
- FEATURE_PUSH_INTERNAL_USERS=userId1,userId2

### Frontend flags (Task Center)

- VITE_TASK_CENTER_ENABLED=true|false
- VITE_TASK_CENTER_ROLLOUT_PERCENT=0..100

## Post-launch Monitoring Window (3-7 days)

Run daily checks for:

1. Push delivery failure rate and transient/permanent mix.
2. Task failure spike alerts.
3. Completion-to-open engagement ratio (clicked/opened-app).
4. Recovery behavior: users can open completed results from Task Center.

## Acceptance KPIs

- Push failure rate stays within agreed threshold.
- Duplicate push events remain suppressed.
- Unrecovered completed tasks trend remains below threshold.
- No critical security/privacy incidents.

## Error Budget Guardrails

- If failure budget is exceeded at any stage:
  - Freeze rollout.
  - Reduce rollout percent.
  - Investigate telemetry and alert traces.

## Runbook Sequence

1. Deploy with FEATURE_PUSH_ENABLED=true and FEATURE_PUSH_ROLLOUT_PERCENT=0.
2. Populate FEATURE_PUSH_INTERNAL_USERS and validate.
3. Promote to 10%, then 50%, then 100%.
4. Execute daily monitoring checklist during 3-7 day window.

## Definition of Done Mapping

1. Every async operation has persistent task lifecycle: completed in earlier phases.
2. Supported browsers receive completion push when user is away: implemented and rollout-gated.
3. Missed notifications still recover in Task Center: implemented and rollout-gated.
4. Duplicate notifications prevented: implemented via idempotency.
5. Observability, alerting, cleanup in place: implemented in Phase 5.
6. Mobile support behavior documented and communicated in UX: implemented in Phase 6.