# infrastructure/

This directory will be populated in **Phase 2+**.

Each sub-directory here will contain a concrete adapter that implements one of the ports defined in `core/ports/`.

## Conventions

- **One adapter per file** — each file implements exactly one `core/` interface.
- **No business logic** — adapters translate between the SDK's API and domain types only.
- **No SDK types leak into core** — all return types must use entities from `core/entities/`.
- **Dependency injection** — adapters receive their SDK client via constructor injection; no singletons.

## Planned Adapters (Phase 2+)

| Port              | Planned Adapter(s)                              |
|-------------------|-------------------------------------------------|
| `IProvider`       | `OpenAIProvider`, `GeminiProvider`, `HuggingFaceProvider` |
| `IRouter`         | `CapabilityRouter`, `CostRouter`               |
| `IMemoryStore`    | `InMemoryStore`, `RedisMemoryStore`            |
| `IContextBuilder` | `SlidingWindowContextBuilder`                  |
| `ICircuitBreaker` | `OpossumCircuitBreaker`                        |
| `ITelemetry`      | `OpenTelemetryAdapter`, `NoopTelemetry`        |
