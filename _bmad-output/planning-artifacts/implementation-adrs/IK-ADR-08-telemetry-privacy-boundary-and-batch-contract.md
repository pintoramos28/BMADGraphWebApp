# IK-ADR-08: Telemetry Privacy Boundary And Batch Contract

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The PRD and architecture are explicit that BMADGraphWebApp is locally authoritative for datasets and workspaces. Telemetry is allowed only for anonymized timing, error, and readiness-style events, and it must queue offline and flush later without exposing user analytical content.

Without a locked telemetry boundary:

- privacy scope will drift through convenience fields
- offline queue behavior will fragment
- KPI instrumentation will be inconsistent

## Decision

Adopt a **redacted telemetry batch envelope** with event-level metrics only.

Never send:

- dataset rows
- formulas
- workspace blobs
- evidence text
- imported file contents

Required batch fields:

- `schemaVersion`
- `batchId`
- `sentAt`
- `appBuildVersion`
- `sessionId`
- `queueState`
- `environment`
- `privacy`
- `events`

## Rationale

- The hosted shell model depends on a strict local-only analytical boundary.
- KPI instrumentation still needs stable event payloads for timing and readiness tracking.
- Explicit redaction fields make the privacy promise testable.

## Consequences

Positive:

- the telemetry boundary becomes auditable
- queueing and flushing can be implemented consistently
- shell telemetry remains clearly separate from analytical persistence

Negative:

- teams may need secondary operational metrics if they want richer diagnostics
- some tempting debug data will be intentionally unavailable

## Hard Invariants

- disallowed data categories
- offline queue ownership remains in app/service code, not the service worker

## Recommended Defaults

- Use the required batch fields in this ADR as the initial telemetry envelope.
- Start with the first KPI loop events for import, first graph, render timing, and reopen timing.

## Deferred Details

- event dimension names that do not widen privacy scope
- additional non-sensitive event types
- the queue implementation details

## Example

See the telemetry payload example in [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md).

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
