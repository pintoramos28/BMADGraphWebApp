# Story 1.6: Complete Reopen Validation for Transforms and Graph Compositions

Status: done

## Story

As a user,
I want reopened workspaces to localize stale transforms and incompatible graph compositions precisely,
so that I can trust which analytical elements are still valid before I continue or hand off the workspace.

## Acceptance Criteria

1. Given reopen validation needs transform semantics beyond a bare saved expression, when a workspace is saved and reopened, then the snapshot and validation contract preserve enough transform dependency metadata to detect and localize stale or invalid saved transform steps.
2. Given a reopened workspace contains a saved graph layer or overlay that violates the locked graph catalog or current analytical context, when reopen validation runs, then each incompatible composition is surfaced as a localized issue record attached to the affected graph scope while the last valid graph remains usable.
3. Given an older or partially valid workspace is reopened, when the expanded validation rules run, then migrations and compatibility handling avoid false positives and preserve unaffected valid state, repair actions, and readiness summaries.
4. Given transform or graph-composition reopen issues are deferred or resolved, when repair selectors and readiness surfaces update, then those issue states persist or clear consistently across reopen, continued work, and later handoff checks.

## Dependencies

- Story 1.2: Author Canonical Workspace and Trust Contracts
- Story 1.3: Create, Open, and Reopen Local Workspaces
- Story 1.4: Surface Shell Readiness, Support, and Update Status
- Story 1.5: Localize Reopen Errors and Provide Repair Entry Points

## Contract Boundaries

- In scope: transform dependency metadata needed for reopen-time validation, graph layer and overlay compatibility checks during reopen, localized issue-record emission for those failures, repair-entry scope and readiness persistence for the new issue kinds, and reopen-focused compatibility coverage for older snapshots.
- Out of scope: full transform or formula repair execution UX, broad graph-authoring editing UX, new overlay families beyond the locked MVP catalog, and later review/export gating behavior that only consumes these issue records.
- Owning paths: `src/schemas/workspace/**`, `src/features/workspace-persistence/**`, `src/domain/trust/**`, `src/features/workspace-repair/**`, graph-catalog validation helpers, and `tests/integration/workspace-reopen.test.ts`.
- Downstream consumers after completion: transform repair flows in Epic 3, layer and overlay authoring in Epic 4, and trust and handoff surfaces in Epic 5.

## Tasks / Subtasks

- [x] Extend the persisted workspace contract and compatibility handling so reopen validation has stable transform dependency metadata instead of guessing from free-form expressions alone. (AC: 1, 3)
- [x] Add reopen validation for graph layer and overlay compatibility against the locked core graph catalog and current analytical context. (AC: 2, 3)
- [x] Emit localized issue records, repair actions, and readiness-selector coverage for transform and graph-composition reopen failures without dropping unaffected valid state. (AC: 1, 2, 4)
- [x] Add unit and integration coverage for legacy snapshot reopening, deferred issue persistence, resolve-in-place behavior, and unaffected-state preservation for the new reopen issue kinds. (AC: 1, 2, 3, 4)

### Review Findings

- [x] [Review][Patch] Reopen formula validation drops formulas that depend on retained transform outputs [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:811]
- [x] [Review][Patch] Legacy histogram graphs with `binned-bar` marks are misclassified as incompatible during catalog inference [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/graph-catalog.ts:83]
- [x] [Review][Patch] Incompatible graph repair entries point to graph ids that reopen immediately removes [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:971]
- [x] [Review][Patch] Graph catalog validation trusts contradictory `catalogOverlayId` metadata over overlay semantics [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/graph-catalog.ts:46]
- [x] [Review][Patch] Reopen transform validation never adds retained upstream outputs back into the available-column set, so any later transform that depends on a prior transform's `producesColumnIds` is misreported as a missing dependency even when the upstream step survived reopen. [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:730]
- [x] [Review][Patch] Graph catalog validation still accepts unsupported overlay semantics whenever a persisted `catalogOverlayId` is present, so a saved `regression` overlay with a non-`linear` method can reopen as if it were the locked `regression_linear` overlay instead of being localized as incompatible. [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/graph-catalog.ts:46]
- [x] [Review][Patch] Histogram reopen validation never checks `facetRow` or `facetColumn`, so faceted histograms currently slip past the locked MVP catalog even though that family only permits a single quantitative axis plus optional color. [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/graph-catalog.ts:204]
- [x] [Review][Patch] Reopen drops every saved transform as soon as any dataset entry fails validation, so partially valid workspaces lose unrelated transforms that still target surviving datasets instead of preserving unaffected transform state. [/home/pinto/repo/BMADGraphWebApp/src/features/workspace-persistence/reopen-workspace.ts:765]

## Dev Notes

### Architecture Alignment

- Reopen must run migrations, validation, and drift analysis before surfacing invalid elements as repairable issues instead of discarding them.
- Broken transforms and incompatible graph layers are explicitly called out by the architecture as elements that must remain attached to the workspace as flagged issues during reopen.
- The issue-record contract remains the only recovery surface for reopen validation, repair, readiness, and later export or handoff blocking.
- Graph composition compatibility must come from the locked BMAD graph catalog, not from ad hoc renderer-specific heuristics.

### Project Structure Notes

- Keep contract evolution at the schema and persistence-validation boundary first; do not bury reopen-only rules in UI components or graph-renderer adapters.
- Reuse the existing reopen issue-record plumbing and readiness selectors from Story 1.5 rather than inventing a second reopen-warning path.
- If additional transform metadata is required, evolve the snapshot contract and compatibility path explicitly so older workspaces can still reopen safely.

### Testing

- Add coverage for workspaces reopened from older snapshots that lack any newly added transform dependency metadata and verify migration or fallback behavior is explicit rather than silent.
- Add targeted reopen tests for schema-valid but semantically stale transforms, blocked graph layer or overlay compositions, and preservation of unaffected valid graphs or data.
- Extend integration coverage so deferred and resolved issue states for the new reopen issue kinds remain visible or clear correctly in repair entry points and readiness summaries.

### Previous Story Intelligence

- Story 1.5 already established localized reopen issues, repair-entry selectors, and readiness persistence for the currently detectable reopen failures.
- The follow-up review on Story 1.5 exposed that schema-valid stale transforms and incompatible graph compositions are still underspecified at the contract level, so this story should close the missing validation-definition gap rather than expanding UI repair scope.
- The readiness plumbing fixed in Story 1.5 should be reused here; regressions that drop explicit readiness-owned state would undermine the same trust surfaces this story depends on.

### Residual Assumptions

- This story formalizes detection and localization only. Rich transform editing, undo-heavy repair UX, and broad graph-authoring remediation remain owned by later feature epics.
- The locked MVP graph catalog remains the authority for allowed overlays and blocked combinations until a later planning change updates it explicitly.

### References

- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md` - Story 1.5 scope and Epic 1 trust goals
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR46, FR47, FR52, NFR7 through NFR10
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - reopen, migration, and drift handling; graph-definition catalog boundary
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - workspace continuity, inline repair cards, drift warnings before render
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/core-graph-catalog.md` - allowed overlays, blocked combinations, and locked graph composition rules
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-05-workspace-snapshot-schema-v1.md`
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md` - prior reopen-localization behavior and follow-up review context

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Follow-up story created from Story 1.5 review findings on 2026-04-19.
- Added transform dependency metadata and locked graph-catalog metadata to the canonical workspace snapshot contract on 2026-04-20.
- Implemented reopen-time transform dependency checks, graph catalog validation, and durable issue reconciliation for deferred reopen issues on 2026-04-20.
- Validation run on 2026-04-20: `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run typecheck`.
- Review pass 2 on 2026-04-20 fixed retained-transform formula dependency seeding and legacy `binned-bar` histogram inference, then re-ran targeted reopen specs plus the full validation suite.
- Review pass 3 on 2026-04-20 retained incompatible graphs as stale reopen repair scopes, normalized contradictory overlay catalog ids from overlay semantics, and re-ran targeted reopen specs plus the full validation suite.
- Review pass 4 on 2026-04-20 seeded retained transform outputs back into reopen-time dataset availability, sanitized unsupported overlay semantics away from persisted catalog ids, blocked histogram faceting in the locked catalog, and re-ran targeted reopen specs plus the full validation suite.
- Review pass 5 on 2026-04-20 changed partial dataset-loss handling to validate transforms per surviving dataset, limited `workspace.reopen.transform.dataset-loss` to ambiguous legacy transforms or zero-valid-dataset cases, and re-ran targeted reopen specs plus the full validation suite.

### Completion Notes List

- Story created to close the remaining reopen-validation contract gap for schema-valid stale transforms and incompatible graph compositions.
- Story is positioned as an Epic 1 follow-up so later transform, graph-authoring, and handoff stories can consume stable reopen issue records instead of inventing their own drift heuristics.
- Extended `WorkspaceSnapshot` and `GraphDefinition` with backward-compatible transform dependency, graph family/template, and catalog-overlay metadata so saved workspaces preserve reopen validation inputs explicitly.
- Added locked-catalog reopen validation for graph compositions plus precise transform reopen failures for missing datasets, missing dependencies, and missing upstream steps without dropping unaffected valid state.
- Preserved deferred transform and graph-composition reopen issues across save and reopen while allowing them to clear once the saved workspace state and issue list are repaired.
- Added contract, unit, and integration coverage for legacy snapshot reopening, catalog metadata inference, durable reopen issue persistence, and unaffected-state preservation.
- Resolved review finding: retained transform output columns now seed formula reopen dependency availability before formula validation runs.
- Resolved review finding: legacy graphs that persist only `marks: ['binned-bar']` now infer the histogram family and remain reopen-compatible through catalog validation.
- Resolved review finding: incompatible graphs now remain in reopened snapshots as stale repair scopes so graph-focused repair entry points target existing graph ids while active/reference selection stays on recoverable graphs.
- Resolved review finding: contradictory persisted `catalogOverlayId` metadata no longer bypasses reopen validation because overlay `kind` and `method` semantics now drive catalog overlay normalization first.
- Resolved review finding: retained transform outputs now re-seed reopen-time dataset availability so downstream saved transforms validate against surviving upstream outputs instead of being misreported as missing dependencies.
- Resolved review finding: unsupported or contradictory overlay semantics now lose persisted catalog ids during normalization, so locked-catalog validation correctly localizes those overlays as incompatible.
- Resolved review finding: histogram reopen validation now blocks `facetRow` and `facetColumn` assignments, matching the locked catalog's non-faceted histogram constraint.
- Resolved review finding: partially valid workspaces now preserve metadata-backed transforms on surviving datasets during reopen, while ambiguous transform recovery still localizes through `workspace.reopen.transform.dataset-loss` only when reopen lacks enough dataset context to validate safely.
- Re-verified story 1.6 with targeted reopen regressions, full `npm test`, `npm run lint`, and `npm run typecheck` via `./scripts/with-node.sh`.

### File List
- _bmad-output/implementation-artifacts/1-6-complete-reopen-validation-for-transforms-and-graph-compositions.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/features/workspace-persistence/graph-catalog.ts
- src/features/workspace-persistence/reopen-workspace.spec.ts
- src/features/workspace-persistence/reopen-workspace.ts
- src/schemas/contracts.spec.ts
- src/schemas/workspace/graph-definition.ts
- src/schemas/workspace/workspace-snapshot.ts
- src/test/fixtures/workspace/graph-definition.fixture.ts
- src/test/fixtures/workspace/workspace-snapshot.fixture.ts
- tests/integration/workspace-reopen.test.ts

## Change Log

- 2026-04-20: Added durable transform dependency and graph catalog reopen validation, persisted issue reconciliation for deferred reopen issues, and expanded contract/unit/integration coverage for legacy and repaired snapshots.
- 2026-04-20: Addressed pass-2 review findings for retained-transform formula dependency availability and legacy `binned-bar` histogram inference; added focused reopen regressions and re-ran full validation.
- 2026-04-20: Addressed pass-3 review findings by retaining incompatible graphs as stale repair scopes, deriving overlay catalog ids from overlay semantics before trusting persisted metadata, and extending reopen regression coverage.
- 2026-04-20: Addressed pass-4 review findings by re-seeding retained transform outputs into reopen-time column availability, rejecting unsupported overlay semantics even when persisted catalog ids exist, blocking histogram faceting, and re-running targeted plus full validation.
- 2026-04-20: Addressed pass-5 review findings by preserving transforms on surviving datasets during partial dataset validation failures, keeping dataset-loss localization only for ambiguous transform recovery, and re-running targeted plus full validation.
