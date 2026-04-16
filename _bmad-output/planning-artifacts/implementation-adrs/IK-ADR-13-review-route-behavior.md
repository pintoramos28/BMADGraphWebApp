# IK-ADR-13: Review Route Behavior

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The architecture locks the canonical `/review/:workspaceId` route, but the planning baseline had not yet defined whether that route is an authoring surface or an inspection surface. The PRD, UX specification, and architecture all position review primarily as trust validation, provenance inspection, drift/readiness checking, and handoff assessment.

The same planning baseline also explicitly keeps multi-user collaboration and shared server-side review state out of MVP.

Without a locked review-route behavior:

- story authors may turn review into a second graph-editing surface
- review-specific UI may begin mutating canonical analytical state in ways that blur handoff and authoring flows
- Evidence Rail, Mission Log, Handoff Readiness, and review actions may diverge from the reference-graph trust model

## Decision

`/review/:workspaceId` is an **inspection-first route**, not a full authoring route.

Allowed in MVP review route:

- inspect the imported workspace package and reference graph
- inspect provenance, evidence, drift state, telemetry snapshot, readiness state, and integrity status
- add limited review metadata or clarification markers that do **not** mutate the canonical analytical workspace state
- trigger resend-request or clarification workflows as review outcomes
- export or archive review-facing derivative artifacts such as validation receipts if implemented

Not allowed in MVP review route:

- editing datasets, semantics, transforms, formulas, or graph definitions
- promoting review into a second full authoring surface
- mutating the canonical workspace package as part of review
- introducing collaboration or shared review state through backend services

## Rationale

- The UX consistently frames Elena's flow as review-first, with integrity and provenance checks happening before visual trust.
- The product's trust model centers on the promoted reference graph and exported handoff package, not on post-export collaborative editing.
- Keeping review inspection-first preserves a clear boundary between analytical authoring and downstream validation.

## Consequences

Positive:

- route-owned screens can keep review focused on trust inspection and handoff outcomes
- story slicing for review stays narrower and less drift-prone
- exported workspaces remain the source artifact, while review outputs remain derivative

Negative:

- reviewers cannot perform direct canonical corrections in place during MVP
- some note-taking or clarification behavior must remain local/derivative rather than becoming shared workspace state

## Hard Invariants

- `/review/:workspaceId` does not mutate canonical analytical state in MVP
- review is centered on the reference graph and handoff package, not exploratory authoring
- any review notes or validation artifacts are derivative of the workspace, not replacements for it

## Recommended Defaults

- Reuse shared trust surfaces in review mode: Evidence Rail, Mission Log, Handoff Readiness, and integrity status.
- Keep review actions focused on inspect, clarify, approve, block, and export validation outcomes.
- Treat resend or clarification requests as workflow outcomes rather than inline workspace repair.

## Deferred Details

- the exact shape of review metadata or validation receipt artifacts
- whether limited local annotations are persisted separately from the imported workspace package
- whether future post-MVP review flows warrant a broader route contract

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md)
