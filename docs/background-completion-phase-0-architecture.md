# Background Completion Notifications + Persistent Task State

## Phase 0 Scope

This document defines the signed-off architecture and the signed-off event/state model for production-grade background completion notifications and cross-session task recovery.

This phase is design-only. No runtime behavior changes are introduced in Phase 0.

## Goals

1. Users can leave during long-running AI operations and return later.
2. Task outcomes are always recoverable in-app from backend state.
3. Push notifications improve immediacy but are not a reliability dependency.
4. Completion side effects are idempotent and privacy-safe.

## Launch Platform Support

### Desktop

- Chrome: full Web Push support
- Edge: full Web Push support
- Firefox: full Web Push support
- Safari (macOS): supported with APNs-backed Web Push in modern versions; best-effort where browser/version constraints apply

### Mobile

- Android Chrome: baseline supported path for launch
- iOS Safari:
  - Best-effort browser behavior for non-installed pages
  - Reliable push path is installed PWA on supported iOS versions

## Product Policy

### Notification Policy

Emit at most one terminal completion notification per task.

Supported terminal notification categories:

- Success
- Failure
- Timeout
- Partial completion

Non-terminal updates (queued/processing/progress) are stored server-side and shown in-app, but are not push-notified by default.

### Dedup + Rate Limits

- One terminal push per taskId + terminalState.
- Retry delivery using bounded retry policy for transient push provider/network failures.
- Do not send repeated notifications for duplicate completion events.
- Optional user-level burst control: max N terminal notifications in rolling 60 seconds (final value set in implementation phase).

### Privacy Policy for Notification Payloads

Push payload must avoid sensitive content.

Allowed payload fields:

- taskId
- taskType (chat, image, voice, document)
- terminalState
- createdAt/completedAt
- shallow route target (for in-app deep link)
- optional display metadata that is non-sensitive (short generic title/status)

Disallowed fields:

- Prompt text
- Message body content
- Uploaded file content
- Raw AI outputs
- Access tokens

## Reliability Model

Push notification delivery is best-effort only.

Source of truth is persistent backend task state:

- If push succeeds: user gets immediate completion signal.
- If push fails or device is offline: user still sees terminal result on return via task queries/subscriptions.

## System Architecture

## Components

### Backend

1. Task lifecycle service
   - Creates and updates task records
   - Owns state transitions and transition validation
   - Enforces idempotent terminal updates
2. Task storage (PostgreSQL via Prisma)
   - Persistent lifecycle + timestamps + progress + ownership
3. Push subscription service
   - Register/unregister/list device subscriptions per user
4. Push sender service (VAPID)
   - Sends privacy-safe terminal notifications
   - Records delivery attempts/outcomes for observability
5. Operation publishers
   - Existing long-running flows (chat/image/voice/document) emit task events

### Web Frontend

1. Service worker push handler
   - Receives push and displays notification
   - Handles click to route into app context
2. Push subscription manager
   - Requests permission with user action
   - Registers and syncs subscription with backend
3. Task center data layer
   - Fetches active/recent tasks on load
   - Reconciles server truth after reload/return
4. UX messaging
   - Explicitly informs users they can leave and return

## Data Contracts

## Canonical Task States

- queued
- processing
- completed
- failed
- canceled
- timeout
- partial_completed

Notes:

- timeout and partial_completed are terminal states for policy/reporting.
- Frontend grouping may map timeout/partial_completed to warning-style presentation.

## Task State Machine

Allowed transitions:

- queued -> processing
- queued -> canceled
- queued -> failed
- processing -> completed
- processing -> failed
- processing -> canceled
- processing -> timeout
- processing -> partial_completed

No transitions allowed out of terminal states.

## Core Task Record (logical)

- id
- userId
- taskType
- status
- progressPercent (0-100, nullable)
- createdAt
- updatedAt
- startedAt (nullable)
- completedAt (nullable)
- failedAt (nullable)
- canceledAt (nullable)
- timeoutAt (nullable)
- summaryCode (enum-like non-sensitive outcome code)
- errorCode (nullable)
- errorMessageSafe (nullable, redacted)
- idempotencyKey (operation-scoped)
- notificationState (none, pending, sent, failed, skipped)
- notificationSentAt (nullable)

## Push Subscription Record (logical)

- id
- userId
- endpoint (unique)
- p256dh
- auth
- userAgent (nullable)
- deviceLabel (nullable)
- createdAt
- updatedAt
- lastSuccessAt (nullable)
- lastFailureAt (nullable)
- isActive

## Event Model (Signed-Off Contract)

## Domain Events

1. task.created
2. task.processing.started
3. task.progress.updated
4. task.completed
5. task.failed
6. task.canceled
7. task.timeout
8. task.partial_completed
9. task.notification.sent
10. task.notification.failed

## Event Envelope

- eventId (unique)
- eventType
- taskId
- userId
- occurredAt
- source (chat, image, voice, document)
- version
- payload (non-sensitive)

## Idempotency Rules

- Terminal events are idempotent by taskId + terminalState.
- Replayed terminal event must not trigger duplicate side effects.
- Notification side effect keyed by taskId + terminalState + channel(push).

## Major Flow Coverage

## Chat (long responses)

- Create task at request accept
- Mark processing when orchestrator starts
- Emit terminal event on success/failure/timeout

## Image generation

- Create task when accepted
- Update progress if provider supports it
- Emit terminal event on completion/failure

## Voice operations

- Create task for registration/clone/verification jobs where async applies
- Consume webhook or polling results into canonical task transitions
- Emit terminal event after final state determined

## Document ingestion (if user-visible async)

- Map existing ingestion states to canonical states
- Emit terminal event only once

## Frontend Recovery Behavior

On app load, tab refocus, or reconnect:

1. Query active + recent tasks for current user.
2. Reconcile local in-flight UI state with backend truth.
3. Surface newly terminal tasks that were not acknowledged in current session.
4. Mark as seen/acknowledged in UI state (separate from immutable task history).

This guarantees recovery even when push is denied, unsupported, or dropped.

## Browser Interaction Model

### Service Worker Push Handling

- Parse validated payload
- Show notification with generic, non-sensitive message
- Attach taskId + route target in notification data

### Notification Click Handling

- Focus existing app client if present
- Else open app URL
- Route to task context view (task center, chat thread, image job, voice job details)

## Observability + Logging

- Structured logs only
- No raw prompts/messages/audio text in push/task logs
- Metrics:
  - task terminal counts by type/state
  - terminal latency (createdAt -> terminalAt)
  - push attempt/success/failure rates
  - dedup suppression counts

## Backward Compatibility

- Existing in-app status and browser Notification API flows remain functional during migration.
- New task lifecycle service becomes source of truth incrementally by operation type.
- Existing UI components should read unified task queries while preserving current UX.

## Testing Strategy (Phase 0 Definition for Future Phases)

Critical tests required in implementation phases:

1. Backend lifecycle transition validation
2. Backend idempotent terminal event handling
3. Backend push dedup behavior
4. Frontend reload/reconnect task recovery
5. Service worker push click routing

## Security and Compliance

- AuthZ: users can only query own tasks/subscriptions.
- Data minimization: store safe summaries only.
- Redaction: sanitize provider errors before persistence.
- Revocation: unsubscribe endpoint on 404/410 push responses.

## Implementation Sequencing (Strict)

1. Schema + migration for Task and PushSubscription entities
2. Backend task lifecycle service + idempotency guards
3. Backend push sender (VAPID) + subscription APIs
4. Service worker push/click handling and frontend subscription flow
5. Integrate chat/image/voice/document publishers
6. Frontend task center recovery wiring
7. Tests + docs + rollout checklist

## Exit Criteria for Phase 0

- Architecture document complete and approved
- Event/state model complete and approved
- Platform support policy explicitly defined
- Notification/fallback/dedup/privacy policies explicitly defined

## Sign-Off

- Product: Pending
- Backend: Pending
- Frontend: Pending
- Security: Pending
- QA: Pending
