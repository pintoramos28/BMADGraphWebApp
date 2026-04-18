# Story 1.5: Localize Reopen Errors and Provide Repair Entry Points

Status: in-progress

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

- [x] Extend reopen validation to emit structured issue records for stale formulas, broken transforms, incompatible graph layers, and similar localized failures. (AC: 1)
- [x] Keep valid unaffected state available after reopen while attaching repair entry points to the flagged elements and selectors that summarize scope/impact. (AC: 1, 2)
- [x] Persist unresolved issue state in trust/readiness selectors so deferred repairs remain visible through continued work and later handoff flows. (AC: 2, 3)
- [x] Add integration tests for partially valid reopened workspaces, explicit scope/impact reporting, and deferred-repair persistence. (AC: 1, 2, 3)

### Review Findings

- [x] [Review][Patch] Sanitize localized entity ids before writing issue records [/home/pin81845/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:198]
- [ ] [Review][Patch] Sanitize invalid saved graph selection ids before emitting reopen issues [/home/pin81845/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:700]
- [ ] [Review][Patch] Add explicit repair scope labels for ledger and saved issue-record failures [/home/pin81845/repo/BMADGraphWebApp/src/domain/trust/selectors.ts:43]
- [ ] [Review][Patch] Normalize `sprint-status.yaml` line endings to avoid trailing-whitespace churn [/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/sprint-status.yaml:1]

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
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts`
- `./scripts/with-node.sh npm test -- src/features/workspace-persistence/reopen-workspace.spec.ts src/domain/trust/selectors.spec.ts src/stores/workspace-kernel/workspace-kernel.spec.ts tests/integration/workspace-reopen.test.ts`
- `./scripts/with-node.sh npm test`
- `./scripts/with-node.sh npm run lint`
- `./scripts/with-node.sh npm run typecheck`

### Implementation Plan

- Add failing reopen and selector tests for localized repair entry points, scope/impact summaries, and deferred issue persistence.
- Extend reopen issue construction to populate stable repair actions and entity-linked diagnostics without dropping unaffected workspace state.
- Expose reopen repair summaries through shared trust/readiness selectors so deferred issues remain visible after reopen and later issue updates.

### Completion Notes List

- This story converts reopen drift handling into explicit localized issue records plus first repair-entry hooks.
- Unresolved issues remain visible in trust/readiness state so later review and handoff flows inherit the same problem signals.
- Reopen issue creation now localizes dataset, transform, formula, graph, evidence, and ledger failures to the affected entity ids and assigns stable repair commands for repair-card entry points.
- Shared trust and kernel selectors now expose repair-entry summaries with scope and impact labels so deferred reopen issues remain visible without dropping unaffected workspace state.
- Added unit and integration coverage for localized reopen repair actions, selector summaries, and deferred-issue persistence after reopen.
- Resolved the reopen review follow-up by sanitizing invalid persisted entity ids before issue-record parsing and covering the regression with a focused reopen spec.

### File List

- `_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/domain/trust/selectors.spec.ts`
- `src/domain/trust/selectors.ts`
- `src/features/workspace-persistence/reopen-workspace.spec.ts`
- `src/features/workspace-persistence/reopen-workspace.ts`
- `src/stores/workspace-kernel/selectors.ts`
- `src/stores/workspace-kernel/store.ts`
- `src/stores/workspace-kernel/types.ts`
- `src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `tests/integration/workspace-reopen.test.ts`

### Change Log

- 2026-04-17: Story moved to in-progress for implementation.
- 2026-04-17: Added localized reopen repair actions, trust/kernel repair-entry selectors, and deferred-repair persistence coverage; validated with targeted tests, full Vitest, lint, and typecheck.
- 2026-04-17: Addressed code review findings - 1 item resolved; sanitized localized entity ids before writing reopen issue records and revalidated with reopen spec, full Vitest, lint, and typecheck.
