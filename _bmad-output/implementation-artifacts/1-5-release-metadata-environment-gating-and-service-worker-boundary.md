# Story 1.5: Release Metadata, Environment Gating, and Service-Worker Boundary

Status: ready-for-dev

## Story

As a shell engineer,
I want release metadata, support-matrix enforcement, environment gating, and service-worker ownership wired into the hosted shell,
so that users enter only supported environments and the shell becomes offline-ready without moving analytical state into operational infrastructure.

## Acceptance Criteria

1. Given the hosted shell is compatibility-aware, when `services/release/` and `src/app/boot/` are implemented, then the shell loads and validates the release manifest and support matrix through shared schemas before meaningful analytical work begins.
2. Given IK-ADR-10 and the PRD support-matrix requirements, when environment gating runs, then unsupported browsers, unsupported workspace configurations, Safari, tablets, and mobile authoring environments are blocked before import or reopen begins and are routed to `/unsupported` with support-matrix and release-note context.
3. Given the service worker is shell infrastructure only, when `registerServiceWorker.ts` and related shell assets are implemented, then service-worker ownership is limited to shell-asset caching, release-manifest caching, support-matrix caching, and update detection, and it does not read or write datasets, workspace snapshots, formulas, telemetry queue state, IndexedDB records, or graph persistence.
4. Given the shell must remain calm and non-intrusive, when offline-ready and update state are surfaced, then they are exposed through shell-level status plumbing and manifest configuration rather than feature-local code, with the offline-ready timeout aligned to the release manifest contract.
5. Given operational boundaries are release-shaping, when tests run, then they validate release-manifest parsing, support-matrix gating decisions, unsupported-environment redirects, service-worker ownership boundaries, and the prohibition on moving telemetry queue ownership into the service worker.

## Dependencies

- Story 1.1: Shell Scaffold and Shared Contract Baselines
- Story 1.4: Canonical Routes and Shell Bootstrap Composition

## Contract Boundaries

- In scope: release-manifest loading, support-matrix fetch/integration, environment detection and gating, service-worker registration wiring, offline/update status plumbing, and shell operational tests.
- Out of scope: telemetry queue transport implementation, workspace persistence repositories, feature-specific offline recovery flows, import/graph UI, and any backend expansion beyond the thin release/telemetry shell contract.
- Owning paths: `src/services/release/**`, `src/app/boot/loadReleaseManifest.ts`, `src/app/boot/detectEnvironment.ts`, `src/app/boot/registerServiceWorker.ts`, `public/manifest.webmanifest`, `public/offline/shell-fallback.html`, `scripts/support-matrix.mjs`, and shell-level operational tests.
- Downstream consumers after completion: workspace resume flows, telemetry queue services, shell status surfaces, update prompts, and later release-hardening work in Epic 6.

## Tasks / Subtasks

- [ ] Implement release-manifest and support-matrix loading through shared schemas and shell boot orchestration. (AC: 1)
- [ ] Implement environment detection and gating rules that route unsupported environments to `/unsupported` before meaningful work starts. (AC: 2)
- [ ] Implement service-worker registration and cache ownership boundaries strictly as shell infrastructure. (AC: 3, 4)
- [ ] Add shell-level tests for manifest parsing, support gating, unsupported redirects, and service-worker ownership constraints. (AC: 5)

## Dev Notes

### Architecture Alignment

- `services/release` is the only path to release/support fetches.
- The service worker is not a feature runtime and must not become a second application store.
- Update prompts and offline-ready state belong to shell status surfaces, not to individual feature modules.

### Project Structure Notes

- Follow the architecture-approved shell files: `src/app/boot/loadReleaseManifest.ts`, `src/app/boot/detectEnvironment.ts`, `src/app/boot/registerServiceWorker.ts`, `public/manifest.webmanifest`, and `scripts/support-matrix.mjs`.
- Keep telemetry queue ownership in application/service code even if the service worker broadcasts update/offline signals.
- Support-matrix publication may be static JSON or a thin operational endpoint, but the client contract must remain the small release-manifest plus support-matrix boundary defined in IK-ADR-09.

### Testing

- Add gating tests that explicitly cover Safari as unsupported for MVP.
- Add boundary tests proving the service worker does not own workspace or telemetry queue storage concerns.
- Add an offline-ready timing test tied to the manifest configuration rather than hard-coded feature logic.

### Residual Assumptions

- Firefox remains best-effort compatibility unless a later decision promotes it. This story should expose that distinction in the support matrix without treating Firefox as release-blocking.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR59 through FR62, NFR15 through NFR24
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Hosted Shell Delivery & Offline Strategy, Validation Refinements from Critical Review, ADR-Style Validation Decisions, Integration Points
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - Hosted shell transparency, Platform Strategy, David Mercer - First Report-Ready Graph
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - Section 4.3 Service worker ownership model, Section 4.8 Release manifest example shape, Immediate next actions before epics/stories
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-10-browser-support-matrix-and-safari-stance.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.

### Completion Notes List

- This story keeps operational shell concerns narrow: manifest, support matrix, environment gating, and service-worker ownership only.
- Telemetry queueing remains deliberately outside the service worker boundary.

### File List

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-release-metadata-environment-gating-and-service-worker-boundary.md`
