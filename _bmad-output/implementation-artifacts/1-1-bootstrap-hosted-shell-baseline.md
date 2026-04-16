# Story 1.1: Bootstrap Hosted Shell Baseline

Status: done

## Story

As a developer,
I want a thin hosted-shell baseline created from the approved starter,
so that later stories land on a working client scaffold instead of ad hoc setup.

## Acceptance Criteria

1. Given the repository does not yet contain the application shell, when this story is complete, then the repo includes the Vite 8 React + TypeScript shell baseline and the root config/files expected by the architecture, without introducing SSR or React Query as a default dependency.
2. Given the locked contract-first baseline, when shared schemas are authored, then `src/schemas/workspace/`, `src/schemas/worker/`, `src/schemas/api/`, and `src/schemas/validation/` define versioned BMAD-native contracts for graph definitions, workspace snapshots, ledger entries, issue records, telemetry batches, release manifests, common error envelopes, and worker message envelopes.
3. Given IK-ADR-02 and IK-ADR-05, when the graph and workspace contracts are modeled, then persisted workspace state remains BMAD-owned, `activeGraphId` and `referenceGraphId` remain separate, and no raw Vega-Lite, Vega, or ECharts persistence types are introduced into the canonical workspace schema.
4. Given later stories will consume these contracts, when contract tests run, then the locked example payloads validate successfully and invariant checks cover version fields, issue severity/status enums, telemetry redaction flags, release compatibility fields, and correlation/workspace-version worker message metadata.
5. Given Epic 1 is foundation-first, when this story is complete, then the contract docs in `docs/workspace-format.md` and `docs/telemetry-schema.md` summarize the locked schemas and explicitly defer route policy, service-worker ownership, and runtime benchmarking to later Epic 1 stories.

## Dependencies

- None. This is the Epic 1 entry story and the contract baseline for all later stories.

## Contract Boundaries

- In scope: shell scaffold, shared schema modules, validation helpers, example payload fixtures, contract documentation, and contract tests.
- Out of scope: persistence repositories, kernel command handling, routing, environment gating, service-worker registration, feature UI breadth, and renderer execution.
- Owning paths: `package.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `public/`, `src/main.tsx`, `src/app/App.tsx`, `src/schemas/**`, `src/test/fixtures/**`, `docs/workspace-format.md`, `docs/telemetry-schema.md`.
- Downstream consumers after completion: `src/stores/workspace-kernel/**`, `src/services/persistence/**`, `src/services/release/**`, `src/app/boot/**`, `src/workers/**`, and `src/graph-runtime/**` or the architecture-approved equivalent.

## Tasks / Subtasks

- [x] Initialize the Vite 8 React + TypeScript shell skeleton and root build/test/lint config expected by the architecture. (AC: 1)
- [x] Author shared contracts and validators for workspace, worker, API, and validation boundaries, using the locked example shapes as the baseline. (AC: 2, 3)
- [x] Add example fixtures and contract tests that prove the schemas accept the locked examples and reject invariant violations. (AC: 4)
- [x] Publish the companion docs that explain the schema boundaries and what later stories still need to wire. (AC: 5)

### Review Findings

- [x] [Review][Patch] Canonical graph definitions persist renderer-specific metadata [src/schemas/workspace/graph-definition.ts:34]
- [x] [Review][Patch] Contract tests never exercise invalid issue status values [src/schemas/contracts.spec.ts:63]
- [x] [Review][Patch] UTC timestamp validation accepts non-UTC and non-ISO strings [src/schemas/validation/primitives.ts:11]
- [x] [Review][Patch] Release integrity tokens are not validated as SHA-256 digests [src/schemas/validation/primitives.ts:18]

## Dev Notes

### Architecture Alignment

- Use the architecture's client-first hosted shell baseline: Vite 8, React 19.2, React Router 7, and a browser-local analytical runtime.
- Keep React Query out of the initial scaffold unless a later decision explicitly reintroduces it.
- Worker contracts must carry explicit versioning, `correlationId`, and `workspaceVersion` so stale replies cannot overwrite newer canonical state.
- The single shared error-envelope baseline must include `code`, `title`, `detail`, `severity`, `retryable`, and `contextRef`.

### Project Structure Notes

- The architecture-approved homes are `src/schemas/workspace/`, `src/schemas/worker/`, `src/schemas/api/`, and `src/schemas/validation/`.
- Keep BMAD graph definitions as the canonical graph contract. Renderer specs remain derived artifacts and must not appear in the persisted workspace schema.
- Do not broaden this story into shell-status UI, route modules, persistence repositories, or worker implementations.

### Testing

- Add schema/fixture validation tests under the Vitest stack.
- Include at least one negative test for each invariant-heavy contract: workspace snapshot, ledger entry, issue record, telemetry batch, release manifest, and worker envelope.

### Residual Assumptions

- Use a TypeScript-first validation approach that produces runtime validation and strong exported types. The architecture does not freeze a specific validation library, so the implementation may choose one as long as it stays shared across these contract modules.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture, Project Structure & Boundaries, Validation Refinements from Critical Review, Implementation Handoff
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - Sections 4.4 through 4.8 and Immediate next actions before epics/stories
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-01-graph-runtime-selection.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-02-graph-definition-and-renderer-adapter-boundary.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-05-workspace-snapshot-schema-v1.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-06-workspace-ledger-event-taxonomy.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-07-issue-record-contract.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-08-telemetry-privacy-boundary-and-batch-contract.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.
- Local Linux Node 24 runtime used for validation because the workstation PATH resolves `npm` through a Windows shim under WSL.

### Completion Notes List

- Epic 1 story sequence begins with repo scaffold plus contract baselines to reduce parallel schema drift.
- Route, service-worker, release-metadata, and benchmark work are intentionally deferred to later Epic 1 stories.
- Added the hosted-shell scaffold with Vite 8, React 19.2, TypeScript project references, Vitest, Playwright, and ESLint root config without introducing SSR or React Query defaults.
- Authored shared Zod contracts for workspace snapshots, BMAD graph definitions, ledger entries, issue records, telemetry batches, release manifests, shared error envelopes, and worker message envelopes.
- Added locked example fixtures plus Vitest coverage for accepted payloads and invariant failures around renderer persistence drift, graph references, issue enums, telemetry redaction, release compatibility, and worker causality metadata.
- Published `docs/workspace-format.md` and `docs/telemetry-schema.md` to summarize the baseline contracts and explicitly defer route policy, service-worker ownership, and runtime benchmarking.
- Validation completed with local Node 24 using TypeScript build, Vitest, ESLint, and Vite production build.

### File List

- _bmad-output/implementation-artifacts/1-1-bootstrap-hosted-shell-baseline.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docs/telemetry-schema.md
- docs/workspace-format.md
- eslint.config.js
- index.html
- package-lock.json
- package.json
- playwright.config.ts
- public/manifest.webmanifest
- public/offline/shell-fallback.html
- src/app/App.tsx
- src/main.tsx
- src/schemas/api/error-envelope.ts
- src/schemas/api/index.ts
- src/schemas/api/release-manifest.ts
- src/schemas/api/telemetry-batch.ts
- src/schemas/contracts.spec.ts
- src/schemas/index.ts
- src/schemas/validation/helpers.ts
- src/schemas/validation/index.ts
- src/schemas/validation/primitives.ts
- src/schemas/worker/index.ts
- src/schemas/worker/message-envelope.ts
- src/schemas/workspace/graph-definition.ts
- src/schemas/workspace/index.ts
- src/schemas/workspace/issue-record.ts
- src/schemas/workspace/workspace-ledger.ts
- src/schemas/workspace/workspace-snapshot.ts
- src/test/fixtures/api/error-envelope.fixture.ts
- src/test/fixtures/api/release-manifest.fixture.ts
- src/test/fixtures/api/telemetry-batch.fixture.ts
- src/test/fixtures/worker/message-envelope.fixture.ts
- src/test/fixtures/workspace/graph-definition.fixture.ts
- src/test/fixtures/workspace/issue-record.fixture.ts
- src/test/fixtures/workspace/workspace-ledger.fixture.ts
- src/test/fixtures/workspace/workspace-snapshot.fixture.ts
- tsconfig.app.json
- tsconfig.json
- tsconfig.node.json
- vite.config.ts
- vitest.config.ts

### Change Log

- 2026-04-16: Bootstrapped the hosted-shell baseline, added shared contract schemas and fixtures, added contract tests, and published workspace/telemetry schema docs.
