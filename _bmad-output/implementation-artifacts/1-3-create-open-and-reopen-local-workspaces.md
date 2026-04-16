# Story 1.3: Create, Open, and Reopen Local Workspaces

Status: review

## Story

As a user,
I want to start a new workspace or reopen a saved one,
so that BMADGraphWebApp preserves my analytical session as a local system of record.

## Acceptance Criteria

1. Given Stories 1.1 and 1.2 are complete, when persistence infrastructure is implemented, then `src/services/persistence/` becomes the only path to IndexedDB, OPFS, and File System Access APIs, with repository interfaces that store canonical workspace snapshots plus ledger data rather than feature-local fragments.
2. Given FR43 through FR49 and NFR6 through NFR10, when a workspace is saved or reopened through the repository boundary, then dataset semantics, transforms, formula metadata, graph definitions, issue state, readiness state, and telemetry snapshot fields are loaded from the canonical contracts without collapsing `activeGraphId` and `referenceGraphId`.
3. Given reopen can encounter incompatible or broken analytical elements, when validation runs on load, then the system localizes failures into shared issue records, preserves valid unaffected workspace state, and applies the release-compatibility envelope rather than silently corrupting or discarding the workspace.
4. Given the hosted shell must stay operationally thin, when persistence is implemented, then no service-worker storage ownership, no remote persistence API, and no telemetry transport logic are added to the persistence path.
5. Given reopen fidelity is release-shaping, when integration tests run, then they cover save/reopen round trips, compatibility-envelope enforcement, localized issue creation on invalid content, and benchmark-ready reopen hooks without requiring later export packaging work.

## Dependencies

- Story 1.1: Bootstrap Hosted Shell Baseline
- Story 1.2: Author Canonical Workspace and Trust Contracts

## Contract Boundaries

- In scope: persistence repositories, browser-local storage boundaries, reopen validation, compatibility checks, and integration tests for local workspace round trips.
- Out of scope: export-manifest packaging, review-route behavior, service-worker caching, telemetry queue flush behavior, and graph-authoring UI.
- Owning paths: `src/services/persistence/**`, `src/features/workspace-persistence/**`, `tests/integration/workspace-reopen.test.ts`, and any supporting benchmark-ready fixtures under `src/test/benchmark-workspaces/**`.
- Downstream consumers after completion: shell bootstrap resume flows, Repair Card/readiness surfaces, review/export work in later epics, and performance validation stories.

## Tasks / Subtasks

- [x] Implement repository interfaces and concrete browser-local persistence services for canonical snapshot-plus-ledger storage. (AC: 1, 2)
- [x] Add reopen validation that applies compatibility rules, emits shared issue records, and preserves unaffected valid state. (AC: 2, 3)
- [x] Wire persistence hydration back into `WorkspaceKernel` without moving ownership into the service worker or operational shell services. (AC: 3, 4)
- [x] Add integration tests for round-trip persistence, reopen validation, and compatibility enforcement. (AC: 5)

## Dev Notes

### Architecture Alignment

- The architecture explicitly says browser-local persistence repositories and migration/reopen validation come before feature breadth.
- `services/persistence` is the only allowed path to IndexedDB, OPFS, and File System Access.
- Reopen failures must stay localized and machine-readable through the shared issue-record contract.

### Project Structure Notes

- Keep the persisted source of truth as one workspace snapshot plus ordered ledger data.
- Do not use this story to define the later export package. Export integrity and portable package breadth are deferred to Epic 5 and IK-ADR-12.
- Feature modules may consume persistence services later, but they should not define their own workspace serialization formats.

### Testing

- Add round-trip integration coverage under `tests/integration/workspace-reopen.test.ts`.
- Include a failure-path test where a workspace partially validates and produces issue records while preserving unrelated valid state.

### Residual Assumptions

- This story establishes browser-local save/reopen foundations. If a user-facing "save as portable artifact" UI is needed later, it must still reuse the same canonical snapshot-plus-ledger contracts instead of inventing an export-specific persistence shape.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR43 through FR49, NFR4 through NFR10, Hosted shell delivery & offline guarantees
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Decision Impact Analysis, Service Boundaries, Integration Points, Requirements to Structure Mapping
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-05-workspace-snapshot-schema-v1.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-06-workspace-ledger-event-taxonomy.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.
- Added repository, browser-local storage, and reopen orchestration seams under `src/services/persistence` and `src/features/workspace-persistence`.
- Verified story-specific specs with `./scripts/with-node.sh npm test -- src/services/persistence/repositories/workspace-repository.spec.ts src/features/workspace-persistence/reopen-workspace.spec.ts tests/integration/workspace-reopen.test.ts`.
- Verified repo gates with `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run typecheck`.

### Completion Notes List

- This story captures the local-workspace continuity baseline for Epic 1 without drifting into export-package scope.
- Compatibility enforcement is intentionally tied to the release manifest envelope rather than ad hoc feature checks.
- Implemented canonical snapshot-plus-ledger repositories with in-memory and IndexedDB-backed storage plus OPFS and File System Access boundary wrappers under `src/services/persistence`.
- Added tolerant reopen validation that localizes invalid collections, graph references, and ledger ordering into shared issue records while preserving valid workspace state.
- Added feature-layer save/reopen entrypoints that round-trip `WorkspaceKernel` state without moving persistence ownership into the shell or service worker.
- Added benchmark-ready reopen fixtures and integration coverage for round trips, compatibility blocking, and localized recovery paths.

### File List

- _bmad-output/implementation-artifacts/1-3-create-open-and-reopen-local-workspaces.md
- src/features/workspace-persistence/index.ts
- src/features/workspace-persistence/reopen-workspace.spec.ts
- src/features/workspace-persistence/reopen-workspace.ts
- src/features/workspace-persistence/save-workspace.ts
- src/schemas/workspace/workspace-snapshot.ts
- src/services/persistence/fs-access/portable-workspace-files.ts
- src/services/persistence/index.ts
- src/services/persistence/indexed-db/workspace-storage.ts
- src/services/persistence/opfs/opfs-binary-store.ts
- src/services/persistence/repositories/workspace-repository.spec.ts
- src/services/persistence/repositories/workspace-repository.ts
- src/test/benchmark-workspaces/benchmark-workspace-local.fixture.ts
- tests/integration/workspace-reopen.test.ts
- tsconfig.app.json
- vitest.config.ts

### Change Log

- 2026-04-16: Added browser-local persistence repositories, reopen validation, `WorkspaceKernel` save/reopen orchestration, benchmark fixtures, and integration coverage for local workspace round trips.
