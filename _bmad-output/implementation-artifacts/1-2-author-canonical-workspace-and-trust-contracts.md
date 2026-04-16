# Story 1.2: Author Canonical Workspace and Trust Contracts

Status: review

## Story

As a developer,
I want versioned workspace, issue, provenance, and telemetry contracts defined early,
so that feature stories share one source of truth for persistence and trust state.

## Acceptance Criteria

1. Given the shared contracts from Story 1.1, when the state layer is implemented, then `src/stores/workspace-kernel/` owns canonical persisted analytical state, command handling, reducers, selectors, and event application, while `src/stores/view-state/` owns only ephemeral shell and panel state.
2. Given the locked workspace and ledger contracts, when the kernel initializes or mutates state, then it preserves `activeGraphId` and `referenceGraphId` as separate selectors, appends ledger facts using the ordered taxonomy, and tracks a workspace version that can reject stale worker results.
3. Given trust surfaces depend on shared selectors, when baseline selectors are added, then issue state, readiness summary, telemetry snapshot, and compatibility state are derived from canonical kernel state rather than duplicated feature-local caches.
4. Given Epic 1 is still foundation work, when this story is complete, then the store surface exposes stable command and selector interfaces without importing renderer packages, feature-specific UI components, or persistence infrastructure directly.
5. Given multi-agent implementation will build on this seam, when tests run, then they prove canonical state does not leak into `ViewState`, stale worker replies are ignored using `correlationId` and `workspaceVersion`, and trust selectors remain deterministic across snapshot + ledger updates.

## Dependencies

- Story 1.1: Bootstrap Hosted Shell Baseline

## Contract Boundaries

- In scope: `WorkspaceKernel`, `ViewState`, store interfaces, command/reducer organization, selector baselines, and state-layer tests.
- Out of scope: browser persistence repositories, file handles, service-worker behavior, route wiring, environment-gating UI, graph feature UI, and renderer execution.
- Owning paths: `src/stores/workspace-kernel/**`, `src/stores/view-state/**`, `src/domain/trust/**`, `src/domain/readiness/**`, and any shared state-specific helpers under `src/lib/**`.
- Downstream consumers after completion: `features/workspace-persistence`, `features/telemetry`, `features/repair`, `features/handoff`, `features/mission-log`, and later graph-authoring modules.

## Tasks / Subtasks

- [x] Implement the `WorkspaceKernel` baseline with canonical state slices, command entrypoints, reducer/event organization, and workspace-version tracking. (AC: 1, 2)
- [x] Implement the separate `ViewState` store for panel openness, transient shell state, and other non-persisted UI concerns only. (AC: 1, 5)
- [x] Add shared trust/readiness selectors that compute from canonical state instead of feature-local copies. (AC: 3)
- [x] Add state-layer tests that exercise stale worker reply rejection, ledger ordering expectations, and ViewState isolation. (AC: 4, 5)

## Dev Notes

### Architecture Alignment

- The architecture explicitly chooses a two-layer state model with a vanilla Zustand 5 `WorkspaceKernel` and a lightweight UI-only `ViewState`.
- Features dispatch named actions into `WorkspaceKernel`; long-running operations reply through typed worker envelopes rather than mutating state directly.
- `activeGraphId` and `referenceGraphId` must remain separate even before full graph-authoring flows exist.

### Project Structure Notes

- Keep canonical domain state in `src/stores/workspace-kernel/`; do not let feature folders create competing workspace sources of truth.
- The trust selectors created here should be the inputs for later Telemetry Status Rail, Repair Card, Mission Log, Handoff Readiness, and export readiness surfaces.
- Keep state-layer code free from persistence adapters. Persistence comes in Story 1.3 through service/repository boundaries.

### Testing

- Favor direct store tests for command behavior, selector determinism, and stale reply protection.
- Add explicit tests proving `ViewState` data is not serialized into canonical workspace snapshots.

### Residual Assumptions

- Story 1.2 may introduce placeholder graph/reference selectors and commands as long as they respect the locked graph-definition contract and do not expand into graph-workspace UI or renderer work.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture, Decision Impact Analysis, Integration Points, Project Structure & Boundaries
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR43 through FR49, NFR6 through NFR10
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-05-workspace-snapshot-schema-v1.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-06-workspace-ledger-event-taxonomy.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.
- Added a vanilla Zustand `WorkspaceKernel` with reducer-backed commands, ledger event appends, selector baselines, and stale worker reply gating.
- Added a separate `ViewState` store plus direct state-layer tests for reference graph promotion, stale worker reply rejection, trust selector determinism, and persistence isolation.
- Validation commands: `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`.

### Completion Notes List

- This story exists to freeze the kernel/view-state separation before persistence, routing, or shell-status work expands.
- Graph-authoring UI remains out of scope even though graph/reference selectors must already honor the locked contract split.
- `WorkspaceKernel` now owns canonical snapshot state, ordered ledger appends, worker-correlation gating, and stable selector/command seams under `src/stores/workspace-kernel/`.
- Shared trust/readiness selectors now derive issue, readiness, telemetry, and compatibility state from canonical kernel state without feature-local caches.
- `ViewState` remains UI-only and direct store tests now prove canonical workspace persistence excludes panel and shell state.
- Repo validation passed with `npm test`, `npm run typecheck`, and `npm run lint` through `scripts/with-node.sh`.

### File List

- `_bmad-output/implementation-artifacts/1-2-author-canonical-workspace-and-trust-contracts.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `package.json`
- `package-lock.json`
- `src/lib/semver.ts`
- `src/domain/readiness/index.ts`
- `src/domain/readiness/selectors.ts`
- `src/domain/trust/index.ts`
- `src/domain/trust/selectors.ts`
- `src/stores/view-state/index.ts`
- `src/stores/view-state/store.ts`
- `src/stores/workspace-kernel/events.ts`
- `src/stores/workspace-kernel/index.ts`
- `src/stores/workspace-kernel/reducers.ts`
- `src/stores/workspace-kernel/selectors.ts`
- `src/stores/workspace-kernel/store.ts`
- `src/stores/workspace-kernel/types.ts`
- `src/stores/workspace-kernel/workspace-kernel.spec.ts`
- `src/test/fixtures/workspace/graph-definition.fixture.ts`
- `src/test/fixtures/workspace/issue-record.fixture.ts`
- `src/test/fixtures/workspace/workspace-ledger.fixture.ts`
- `src/test/fixtures/workspace/workspace-snapshot.fixture.ts`

### Change Log

- 2026-04-16: Added the canonical `WorkspaceKernel` and separate `ViewState` store, introduced shared trust/readiness selectors, typed the locked workspace fixtures, added direct store tests, and recorded the story as ready for review.
