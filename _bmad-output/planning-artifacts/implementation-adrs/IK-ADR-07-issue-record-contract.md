# IK-ADR-07: Issue Record Contract

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

Repair Card, Handoff Readiness, reopen validation, and graph validation all depend on structured issue records. The architecture already requires structured issue records, but the implementation contract is not yet isolated as an ADR.

Without one issue shape:

- feature modules will invent incompatible error objects
- readiness blockers will need translation layers
- repair actions will not deep-link consistently

## Decision

Use **one issue-record contract** across workers, validation, repair, readiness, and export blocking.

Required fields:

- `issueId`
- `kind`
- `severity`
- `status`
- `detectedAt`
- `source`
- `title`
- `detail`
- `userMessage`
- `contextRef`
- `repairActions`
- `diagnostics`

Severity values:

- `info`
- `warning`
- `blocking`

Status values:

- `open`
- `deferred`
- `resolved`

## Rationale

- Trust-critical failures must be localized and recoverable.
- Repair Card and readiness summaries should consume the same source records.
- A stable issue schema lowers agent drift and keeps recovery actions machine-addressable.

## Consequences

Positive:

- one issue system can serve graphing, transforms, formulas, reopen, and export
- repair actions can be routed consistently

Negative:

- issue kinds need governance to avoid duplicate semantic categories
- diagnostics payloads can sprawl if not curated

## Hard Invariants

- severity and status enums
- machine-readable `contextRef`
- repair action contract with stable command identifiers

## Recommended Defaults

- Use the required fields in this ADR as the initial shared issue baseline.
- Keep one issue schema across validation, repair, readiness, and export blocking.

## Deferred Details

- command arguments per issue kind
- extra diagnostics fields
- localized user-facing copy variants

## Example

See the issue record example in [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md).

## References

- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
