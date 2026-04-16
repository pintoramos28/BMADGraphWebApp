# IK-ADR-12: Export Manifest And Integrity Policy

Status: Proposed
Date: 2026-04-15
Decision owners: Implementation kickoff

## Context

The PRD requires users to export graph outputs, transformed data, or active analytical subsets for use outside the application. The architecture and UX specification both treat export as a trust-critical handoff surface centered on the promoted reference graph, workspace reproducibility, and reviewer confidence. The kickoff baseline also requires an integrity manifest over the exported payload inventory.

Without a locked MVP export boundary:

- export stories will drift into format sprawl
- handoff readiness rules will become inconsistent
- review expectations will diverge from what the exported package actually contains

## Decision

MVP export supports exactly three explicit output types:

1. **Portable workspace package**
   - canonical workspace snapshot
   - review-relevant evidence and mission-log payloads needed for handoff
   - integrity manifest covering the included payload inventory
2. **Reference-graph static export**
   - one report-ready static export of the current reference graph
   - implementation may choose SVG-first or PNG-first for MVP, but only one primary static format is required
3. **Tabular export**
   - CSV export of the transformed active dataset or active analytical subset

Out of MVP scope:

- multi-format chart export breadth at launch
- Excel export
- PDF report assembly
- signed or encrypted export packages
- arbitrary export-bundle customization
- automatic export of every exploratory graph by default

## Rationale

- The promoted reference graph is the trust anchor for review and handoff, so export should center on it rather than every exploratory artifact.
- A narrow export set satisfies FR55 and FR56 without letting export become a second product.
- The integrity manifest preserves reviewer trust without widening the operational boundary or forcing premature packaging breadth.
- CSV is the lowest-friction tabular export that matches the local-first analytical workflow.

## Consequences

Positive:

- export stories can focus on one clear handoff package and one clear report-ready graph path
- Handoff Readiness and Workspace Snapshot Export Card can present precise included-content rules
- review flows stay aligned to the reference graph and evidence actually carried in the package

Negative:

- users wanting Excel, PDF, or multiple chart image formats will need post-MVP expansion
- implementation must be explicit about which evidence and mission-log payloads are included rather than relying on vague "export context" wording

## Hard Invariants

- export is always explicit and user-initiated
- the portable workspace package includes an integrity manifest
- static graph export uses the current reference graph, not the frontmost exploratory graph by default
- exported payloads remain local artifacts; no server-side export packaging is introduced for MVP

## Recommended Defaults

- Keep the workspace package centered on the canonical snapshot plus review-relevant evidence/history payloads.
- Treat the static graph export as a report-ready derivative of the current reference graph.
- Use CSV as the only required tabular export format in MVP.
- Keep export readiness tied to provenance completeness, issue state, telemetry snapshot, and reference-graph identity.

## Deferred Details

- whether the primary static export format is SVG or PNG
- the exact payload inventory inside the workspace-package evidence/history bundle
- whether validation receipts are embedded in the package or emitted as a separate derivative artifact

## References

- [prd.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md)
- [architecture.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md)
- [ux-design-specification.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-kickoff-decisions.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md)
