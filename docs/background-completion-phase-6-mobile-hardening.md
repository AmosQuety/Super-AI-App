# Phase 6 Mobile Hardening and Platform Gaps

## Scope Delivered

- iOS and PWA behavior constraints documented.
- Android vendor/background policy scenarios documented.
- Optional fallback channel decision documented (recommended: email for high-value tasks).
- Known limitations now communicated in-app via notification settings.

## Support Matrix

| Platform | Browser/App Context | Push Reliability | Notes |
| --- | --- | --- | --- |
| iOS Safari (tab) | Non-installed browser tab | Limited/Best-effort | Background delivery constraints are browser- and OS-policy dependent. |
| iOS Installed PWA | Added to Home Screen, standalone mode | Supported where OS/browser version allows | Recommended iOS path for reliable background push. |
| Android Chrome | Browser tab + PWA | Supported | Subject to battery/data saver and OEM background restrictions. |
| Android Installed PWA | Standalone app mode | Supported (best practical path) | Validate vendor-specific battery optimization behavior. |
| Desktop Chrome/Edge/Firefox | Browser tab/PWA | Supported | Baseline reference behavior. |

## iOS Validation Notes

- Safari tab path can be constrained for background push and notification behavior.
- Installed PWA path should be the preferred iOS guidance for users requiring reliable alerts.
- In-app messaging now clarifies that task recovery does not depend on push delivery.

## Android Vendor Validation Notes

Validate the following scenarios on at least one Samsung, Xiaomi/Redmi, and OnePlus device profile:

1. Default battery policy.
2. Battery saver enabled.
3. App set to optimized background.
4. App set to unrestricted background.
5. Data saver enabled.

Expected outcome across all scenarios:

- Push may vary by policy, but completed results remain recoverable from Recent AI Tasks.

## Fallback Channel Decision (Recommended)

### Decision

- Use email as the first fallback channel for high-value tasks when push is unavailable.
- Reserve SMS for strict urgency workflows due to cost and regional compliance complexity.

### High-value task definition (initial)

- Long-running tasks with user-visible deliverables and high completion latency.
- Tasks explicitly flagged as critical in product logic.

### Trigger policy

- Push unavailable or repeatedly failed for a user endpoint.
- Task reaches terminal state (completed/failed) and is marked high-value.

## In-app Communication Requirements

Delivered:

- Platform constraints shown in notification settings.
- Explicit guidance that users can always recover results even without push.
- Fallback recommendation surfaced as product guidance.

## Exit Criteria Mapping

- Clear support matrix published: completed in this document.
- Known limitations communicated in-app: completed in settings notification panel copy.
