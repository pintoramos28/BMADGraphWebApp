# IK-ADR-05: Workspace Snapshot Schema V1

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The architecture defines a versioned `WorkspaceSnapshot` as the canonical source of truth for datasets, semantics, transforms, formulas, graph views, evidence, trust signals, and export readiness. That contract is still missing as a first-class implementation artifact.

Without a locked snapshot shape:

- save/reopen behavior will drift between features
- migration and validation code will fork
- trust surfaces will reconstruct state differently

## Decision

Adopt a **single versioned `WorkspaceSnapshot` contract** as the canonical persisted workspace shape.

Required top-level fields:

- `workspaceId`
- `workspaceFormatVersion`
- `appBuildVersion`
- `schemaVersion`
- `createdAt`
- `updatedAt`
- `compatibility`
- `datasets`
- `transformPipeline`
- `formulaColumns`
- `graphDefinitions`
- `activeGraphId`
- `referenceGraphId`
- `evidence`
- `issues`
- `readiness`
- `telemetrySnapshot`
- `exportSummary`

## Rationale

- This is the persistence anchor for save/reopen and patch-line compatibility.
- The product treats the workspace as the system of record for an analytical session.
- Review, export, and drift handling require the same canonical state, not UI-specific fragments.

## Consequences

Positive:

- Schema validation can happen once at the contract boundary.
- Reopen and migration logic can target one stable object shape.
- Feature modules get one coherent source of truth.

Negative:

- Schema discipline must be enforced early.
- New feature fields require explicit schema evolution rather than casual addition.

## Hard Invariants

- version fields and compatibility envelope
- separate `activeGraphId` and `referenceGraphId`
- domain-owned `graphDefinitions`
- issue, readiness, and export sections

## Recommended Defaults

- Start from the top-level sections listed above.
- Keep one versioned snapshot object as the canonical persisted workspace shape.

## Deferred Details

- field ordering
- optional metadata additions that do not change meaning
- exact nested sub-shapes for derived stats and non-critical presentation details

## Example

See the v1 example in [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md).

## References

- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
