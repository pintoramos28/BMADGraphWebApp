# IK-ADR-06: Workspace Ledger Event Taxonomy

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The architecture requires an append-only domain ledger beside the snapshot so Mission Log, provenance history, drift replay, and repair suggestions all work off the same event stream.

Without a locked ledger contract:

- event naming will fragment across modules
- Mission Log becomes a UI-only timeline instead of a durable domain record
- drift and replay logic will not share causality context

## Decision

Adopt an **append-only ordered workspace ledger** with durable sequence numbers and explicit causality fields.

Required fields per ledger entry:

- `ledgerEntryId`
- `sequence`
- `occurredAt`
- `type`
- `actor`
- `workspaceVersion`
- `entityRefs`
- `payload`
- `correlationId`

Optional but recommended:

- `trustImpact`

Event naming policy:

- use dotted lowercase domain facts
- events are past-tense facts, not commands
- examples: `graph.created`, `graph.promoted`, `formula.repaired`, `workspace.saved`

## Rationale

- Mission Log needs stable event facts rather than ad hoc UI messages.
- Repair and readiness flows need causality context to route users back to the right source.
- Append-only sequencing supports replay and auditability.

## Consequences

Positive:

- one event language can power history, drift, repair, and export summaries
- domain events remain testable independently of UI

Negative:

- teams must resist turning ledger entries into mini snapshots
- event taxonomy changes require deliberate governance

## Hard Invariants

- event naming policy
- append-only semantics
- sequence ordering per workspace

## Recommended Defaults

- Use the required fields list in this ADR as the initial ledger baseline.
- Keep events as compact facts rather than embedding snapshot-scale payloads.

## Deferred Details

- payload richness by event type
- actor subfields beyond the minimum identity shape
- whether some low-value events are omitted from the ledger and kept as telemetry only

## Example

See the ledger examples in [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md).

## References

- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
