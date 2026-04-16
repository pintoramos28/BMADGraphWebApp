# Story 1.4: Surface Shell Readiness, Support, and Update Status

Status: ready-for-dev

## Story

As a user,
I want BMADGraphWebApp to tell me whether the shell is supported, cached, and up to date,
so that I can trust it before I begin serious analytical work.

## Acceptance Criteria

1. Given a supported environment, when the hosted shell loads once, then the app shows clear readiness state including support, cache, and offline-ready status.
2. Given an unsupported browser or workspace configuration, when the app starts, then the user is warned before import or reopen work begins and can reach the `/unsupported` route.
3. Given release metadata changes, when the shell detects an update, then the update prompt and release-note state are surfaced through shell status surfaces rather than feature-specific UI.

## Dependencies

- Story 1.1: Bootstrap Hosted Shell Baseline
- Story 1.2: Author Canonical Workspace and Trust Contracts

## Contract Boundaries

- In scope: release-manifest loading, support-matrix fetch/integration, environment detection and gating, shell status surfaces for support/cache/offline-ready/update state, and the route wiring needed to reach `/unsupported`.
- Out of scope: workspace persistence repositories, telemetry transport/flush behavior, graph-authoring UI, feature-specific offline recovery flows, and any remote workspace storage.
- Owning paths: `src/services/release/**`, `src/app/boot/loadReleaseManifest.ts`, `src/app/boot/detectEnvironment.ts`, `src/app/boot/registerServiceWorker.ts`, `src/app/router/**`, `public/manifest.webmanifest`, `public/offline/shell-fallback.html`, and shell-level operational tests.
- Downstream consumers after completion: workspace resume flows, import/reopen entry gating, shell status surfaces, update prompts, and later operational hardening in Epic 6.

## Tasks / Subtasks

- [ ] Implement release-manifest and support-matrix loading through shared schemas and shell boot orchestration. (AC: 1, 2, 3)
- [ ] Implement compatibility evaluation and unsupported-environment routing before import or reopen work begins. (AC: 2)
- [ ] Implement shell-owned status plumbing for support, cache, offline-ready, and update state without pushing ownership into feature modules. (AC: 1, 3)
- [ ] Add shell-level tests for support-matrix decisions, unsupported redirects, offline-ready timing hooks, and update-status plumbing. (AC: 1, 2, 3)

## Dev Notes

### Architecture Alignment

- The hosted shell may deliver assets, release metadata, and support facts, but it must not become the system of record for user analytical state.
- Update prompts and offline-ready UI belong to shell status surfaces, not individual feature modules.
- Unsupported browsers and unsupported workspace configurations must be blocked before meaningful work begins.

### Project Structure Notes

- Use `src/services/release/**` as the only path to release/support fetches and validation.
- Keep service-worker ownership limited to shell infrastructure needed for cache/update readiness; telemetry queue ownership stays out of the service worker.
- The unsupported route is a shell-policy boundary, not a feature-owned fallback page.

### Testing

- Add support-matrix coverage for Chrome/Edge supported configurations and explicit unsupported-path coverage before import/reopen entry.
- Add status-surface tests for offline-ready and update-prompt state driven by shell metadata rather than feature-local code.
- Validate that release metadata and support facts are parsed through the shared schemas instead of ad hoc JSON access.

### Residual Assumptions

- Query-string conventions and final status-surface presentation details may evolve, but the shell must keep support, cache, and update state visible before analytical work starts.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR59 through FR62, NFR15 through NFR24
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Hosted shell delivery, offline-ready boundary, release/support matrix, unsupported route policy
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md` - Hosted shell transparency, offline-ready and update status cues
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - Canonical route constants, service-worker ownership model, release manifest example shape
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-10-browser-support-matrix-and-safari-stance.md`
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-13-review-route-behavior.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Epic 1 story artifact normalized to the approved 2026-04-16 plan.

### Completion Notes List

- This story consolidates shell readiness, support visibility, and update state into one approved Epic 1 slice.
- Route access to `/unsupported` remains part of shell policy, while deeper analytical workflows stay deferred.

### File List

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-4-surface-shell-readiness-support-and-update-status.md`
