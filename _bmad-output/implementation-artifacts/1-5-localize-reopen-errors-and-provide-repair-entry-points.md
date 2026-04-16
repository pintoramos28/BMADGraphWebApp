# Story 1.5: Localize Reopen Errors and Provide Repair Entry Points

Status: ready-for-dev

## Story

As a user,
I want reopen problems to be isolated and repairable,
so that one broken element does not invalidate the whole workspace.

## Acceptance Criteria

1. Given a reopened workspace contains a stale formula, broken transform, or incompatible graph layer, when validation completes, then each broken element is listed explicitly with scope and impact.
2. Given at least one issue is detected, when the user continues into the workspace, then valid data, graphs, and controls remain available while repair entry points stay attached to the broken items.
3. Given a repair is deferred, when the workspace remains open, then the unresolved issue persists in trust state and handoff readiness rather than disappearing from view.

## Dependencies

- Story 1.2: Author Canonical Workspace and Trust Contracts
- Story 1.3: Create, Open, and Reopen Local Workspaces
- Story 1.4: Surface Shell Readiness, Support, and Update Status

## Contract Boundaries

- In scope: reopen-time drift analysis, issue-record localization for broken elements, repair-entry selectors and UI hooks, unresolved-issue persistence in trust/readiness state, and reopen-focused integration coverage.
- Out of scope: full transform/formula repair execution flows, review-mode evidence tooling, export gating, and broad graph-authoring remediation UX beyond the first repair entry points.
- Owning paths: `src/services/persistence/**`, `src/features/workspace-persistence/**`, `src/features/workspace-repair/**`, `src/domain/trust/**`, `src/domain/readiness/**`, and `tests/integration/workspace-reopen.test.ts`.
- Downstream consumers after completion: Repair Card surfaces, review-mode unresolved issue callouts, handoff readiness checks, and later export gating in Epic 5.

## Tasks / Subtasks

- [ ] Extend reopen validation to emit structured issue records for stale formulas, broken transforms, incompatible graph layers, and similar localized failures. (AC: 1)
- [ ] Keep valid unaffected state available after reopen while attaching repair entry points to the flagged elements and selectors that summarize scope/impact. (AC: 1, 2)
- [ ] Persist unresolved issue state in trust/readiness selectors so deferred repairs remain visible through continued work and later handoff flows. (AC: 2, 3)
- [ ] Add integration tests for partially valid reopened workspaces, explicit scope/impact reporting, and deferred-repair persistence. (AC: 1, 2, 3)

## Dev Notes

### Architecture Alignment

- Save/reopen fidelity depends on the snapshot-plus-ledger model preserving valid state while surfacing invalid elements as repairable issue records.
- Broken transforms, stale formulas, missing file handles, and incompatible graph layers must stay attached to the reopened workspace rather than being dropped silently.
- Trust surfaces, readiness, and unresolved issue state must be shared selectors over canonical state, not feature-local warnings.

### Project Structure Notes

- Reuse the shared issue-record contract and trust selectors introduced earlier in Epic 1; do not invent a second reopen-error format.
- Keep reopen repair concerns connected to the persistence/reopen path rather than scattering them into feature-local graph or transform modules.
- This story establishes the first repair-entry points only; later epics can deepen repair UX and downstream readiness rules.

### Testing

- Add a failure-path reopen test where only one analytical element is broken and unrelated valid state remains usable.
- Verify that unresolved issues survive continued workspace activity until a repair or explicit dismissal path updates canonical state.
- Include scope/impact assertions so reopened failures are understandable rather than generic error banners.

### Residual Assumptions

- Repair entry points may begin as focused callouts or links into the relevant panel as long as they remain attached to the broken analytical elements and preserve valid workspace access.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR46, FR47, FR52, NFR7 through NFR10
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Snapshot-plus-ledger reopen model, issue records, trust/readiness selectors, workspace reopen integration tests
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - Workspace continuity, drift warnings, repair cards, trust-critical reopen behavior
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Epic 1 story artifact normalized to the approved 2026-04-16 plan.

### Completion Notes List

- This story converts reopen drift handling into explicit localized issue records plus first repair-entry hooks.
- Unresolved issues remain visible in trust/readiness state so later review and handoff flows inherit the same problem signals.

### File List

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md`
