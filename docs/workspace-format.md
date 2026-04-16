# Workspace Format Baseline

This document summarizes the locked contract baseline introduced by Story 1.1. The canonical persisted workspace remains BMAD-owned and versioned under `src/schemas/workspace/`.

## Canonical Contracts

- `graph-definition.ts`: BMAD-native graph definitions with graph identity, lifecycle status, dataset references, role assignments, overlays, presentation hints, issue references, and evidence references.
- `workspace-snapshot.ts`: the persisted `WorkspaceSnapshot` contract with version fields, dataset catalog, transform pipeline, formula columns, graph definitions, evidence, issues, readiness state, telemetry snapshot, and export summary.
- `workspace-ledger.ts`: append-only ledger entries with sequence numbers, event type, actor, workspace version, entity refs, payload, correlation ID, and optional trust impact.
- `issue-record.ts`: shared issue records for repair, readiness, reopen validation, and export blocking.

## Locked Invariants

- `workspaceFormatVersion`, `appBuildVersion`, and release-facing versions use explicit versioned fields rather than implicit migrations.
- `activeGraphId` and `referenceGraphId` are separate top-level fields. They may point at the same graph, but each must resolve to a canonical `graphDefinitions` entry.
- Persisted graph state is BMAD-owned. The schema rejects renderer persistence fields such as `renderer`, `vegaLiteSpec`, `vegaSpec`, or `echartsOption`.
- Ledger entries are append-only facts, not commands, and must include both `correlationId` and `workspaceVersion`.
- Issue severity is locked to `info | warning | blocking`, and status is locked to `open | deferred | resolved`.

## Example Coverage

The locked example fixtures live under `src/test/fixtures/workspace/` and are exercised by `src/schemas/contracts.spec.ts`. The contract tests validate:

- the approved workspace snapshot example
- the approved ledger examples
- the shared issue-record example
- negative cases for unresolved graph references and renderer persistence drift

## Deliberate Deferrals

This story does not define route constants or route policy.
This story does not assign service-worker ownership beyond the schema references already locked in planning artifacts.
This story does not benchmark renderer/runtime choices; graph-runtime spikes remain a later Epic 1 responsibility.
