# Story 1.4: Surface Shell Readiness, Support, and Update Status

Status: done

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

- [x] Implement release-manifest and support-matrix loading through shared schemas and shell boot orchestration. (AC: 1, 2, 3)
- [x] Implement compatibility evaluation and unsupported-environment routing before import or reopen work begins. (AC: 2)
- [x] Implement shell-owned status plumbing for support, cache, offline-ready, and update state without pushing ownership into feature modules. (AC: 1, 3)
- [x] Add shell-level tests for support-matrix decisions, unsupported redirects, offline-ready timing hooks, and update-status plumbing. (AC: 1, 2, 3)

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

### Implementation Notes

- Added shared release and support-matrix schemas plus shell boot loaders that validate the hosted manifest and support payloads before the app renders.
- Introduced shell environment evaluation for browser support, workspace compatibility, secure-context gating, and `/unsupported` routing.
- Added a shell-owned Zustand store for lifecycle, cache, offline-ready, and update state, then wired the app shell and router to consume it.
- Registered a shell service worker with offline-ready timing and update prompt callbacks, keeping feature modules out of the operational boundary.
- Resolved review findings by normalizing UAD browser-family detection, bypassing cache for shell metadata API requests, and wiring update-available callbacks back into shell status.
- Resolved the remaining review findings by holding `/workspace` and `/review` behind a compatibility-pending shell gate and by persisting late update release-note/update-mode payloads into shell status.
- Resolved the latest review findings by deriving workspace compatibility from persisted protected-route records, preserving fresher waiting-update metadata across bootstrap completion, and enforcing the manifest-pinned support-matrix version.
- Resolved the latest review findings by prioritizing persisted compatibility snapshots over canonical-route query hints and by surfacing `not-available` offline readiness when service workers cannot run.

### Debug Log References

- Epic 1 story artifact normalized to the approved 2026-04-16 plan.
- Verified the updated code path with `tsc -b` on 2026-04-17.
- Verified the final follow-up patch with `./scripts/with-node.sh npm test -- src/stores/shell-status/store.spec.ts src/app/router/shell-routes.spec.tsx`, `./scripts/with-node.sh npx vitest run --config .tmp-vitest-shell-routes.config.ts`, `./scripts/with-node.sh npm run typecheck`, and `./scripts/with-node.sh npx eslint src/app/App.tsx src/app/router/shell-routes.tsx src/stores/shell-status/store.ts src/stores/shell-status/store.spec.ts src/app/router/shell-routes.spec.tsx` on 2026-04-17.
- Verified the final review-follow-up patch with `./scripts/with-node.sh npx vitest run src/services/release/detect-environment.spec.ts src/services/release/register-service-worker.spec.ts src/app/router/shell-routes.spec.tsx src/app/boot/resolve-workspace-compatibility.spec.ts src/services/release/bootstrap-shell.spec.ts`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run build` on 2026-04-17.
- Verified the latest review-follow-up patch with `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts src/app/App.spec.ts src/services/release/bootstrap-shell.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npx eslint src/app/App.tsx src/app/App.spec.ts src/app/boot/resolve-workspace-compatibility.ts src/app/boot/resolve-workspace-compatibility.spec.ts src/services/release/bootstrap-shell.ts src/services/release/bootstrap-shell.spec.ts`, and `./scripts/with-node.sh npm run build` on 2026-04-17.
- Verified the shell-readiness follow-up patch with `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts src/app/router/shell-routes.spec.tsx`, `./scripts/with-node.sh npm run typecheck`, and `./scripts/with-node.sh npx eslint src/services/release/detect-environment.ts src/app/boot/resolve-workspace-compatibility.ts src/app/router/shell-routes.tsx src/app/boot/resolve-workspace-compatibility.spec.ts src/app/router/shell-routes.spec.tsx` on 2026-04-17.
- Verified the final story 1.4 follow-up patch with `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts`, `./scripts/with-node.sh npx vitest run --config .tmp-vitest-shell-routes.config.ts`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run build` on 2026-04-17.
- Verified the service-worker bootstrap follow-up patch with `./scripts/with-node.sh npx vitest run src/services/release/bootstrap-shell.spec.ts`, `./scripts/with-node.sh npm run typecheck`, and `./scripts/with-node.sh npx eslint src/services/release/bootstrap-shell.ts src/services/release/bootstrap-shell.spec.ts` on 2026-04-17.

### Completion Notes List

- This story now loads the release manifest and support matrix through shared schemas, evaluates browser/workspace compatibility, and routes unsupported environments to `/unsupported` before analytical work starts.
- Shell status surfaces now expose support, cache, offline-ready, and update state without moving ownership into feature modules.
- The implementation is covered by shell-level tests for support-matrix validation, unsupported routing policy, offline-ready timing hooks, and update-status plumbing.
- Resolved the three review findings by fixing `userAgentData` family detection for Chrome and Edge, preventing shell metadata API caching in the service worker, and refreshing update prompt state from service-worker callbacks.
- Protected shell routes now stay pending until compatibility is known, preventing `/workspace` and `/review` from mounting before an unsupported redirect can be enforced.
- Late service-worker update callbacks now refresh the shell-owned release-note and update-prompt-mode state instead of only toggling the update prompt visibility.
- Resolved the final four review findings by enforcing desktop-only and known-version browser gating, deriving workspace compatibility from protected-route URLs before bootstrap, refreshing update metadata from the latest release manifest when service-worker updates are detected, and surfacing shell bootstrap errors instead of leaving protected routes in a perpetual pending state.
- Verification passed: `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run build`.
- Protected-route compatibility now falls back to persisted workspace records for canonical `/workspace/:workspaceId` and `/review/:workspaceId` URLs, so unsupported workspace formats are evaluated even without query hints.
- First-load waiting service-worker updates now retain their fresher release-note and prompt-mode metadata when bootstrap resolves instead of being overwritten by the initial manifest snapshot.
- Shell bootstrap now rejects support matrices whose fetched version does not match the manifest's pinned `supportMatrixVersion`.
- Verification passed for the latest follow-up patch: `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts src/app/App.spec.ts src/services/release/bootstrap-shell.spec.ts`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npx eslint src/app/App.tsx src/app/App.spec.ts src/app/boot/resolve-workspace-compatibility.ts src/app/boot/resolve-workspace-compatibility.spec.ts src/services/release/bootstrap-shell.ts src/services/release/bootstrap-shell.spec.ts`, and `./scripts/with-node.sh npm run build`.
- The shell readiness surface now reports blocked workspace, secure-context, and bootstrap-error states directly instead of falling back to browser-only support or a false "no blocking issues" message.
- Canonical `/workspace/:workspaceId` and `/review/:workspaceId` reopen routes now fail closed when the saved workspace compatibility snapshot is missing or unreadable, preventing protected routes from opening before compatibility is verified.
- Verification passed for the latest shell-readiness follow-up patch: `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts src/app/router/shell-routes.spec.tsx`, `./scripts/with-node.sh npm run typecheck`, and `./scripts/with-node.sh npx eslint src/services/release/detect-environment.ts src/app/boot/resolve-workspace-compatibility.ts src/app/router/shell-routes.tsx src/app/boot/resolve-workspace-compatibility.spec.ts src/app/router/shell-routes.spec.tsx`.
- Canonical `/workspace/:workspaceId` and `/review/:workspaceId` reopen routes now ignore `workspaceFormatVersion` query overrides and always trust the persisted workspace snapshot for compatibility gating.
- The shell readiness surface now reports offline readiness as `not-available` when service workers cannot run instead of implying readiness is still pending.
- Verification passed for the final story 1.4 follow-up patch: `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts`, `./scripts/with-node.sh npx vitest run --config .tmp-vitest-shell-routes.config.ts`, `./scripts/with-node.sh npm test`, `./scripts/with-node.sh npm run typecheck`, `./scripts/with-node.sh npm run lint`, and `./scripts/with-node.sh npm run build`.
- Code review passed the scoped verification suite on 2026-04-17: `./scripts/with-node.sh npx vitest run src/app/boot/resolve-workspace-compatibility.spec.ts src/app/router/shell-routes.spec.tsx src/app/App.spec.ts src/services/release/bootstrap-shell.spec.ts src/services/release/detect-environment.spec.ts src/services/release/register-service-worker.spec.ts src/schemas/api/support-matrix.spec.ts src/schemas/contracts.spec.ts`.
- Shell bootstrap now degrades cache and offline-ready status when service-worker registration fails instead of surfacing a fatal shell bootstrap error on otherwise supported environments.

### File List

- `_bmad-output/implementation-artifacts/1-4-surface-shell-readiness-support-and-update-status.md`
- `public/service-worker.js`
- `src/app/App.tsx`
- `src/app/App.spec.ts`
- `src/app/boot/bootstrapShell.ts`
- `src/app/boot/detectEnvironment.ts`
- `src/app/boot/index.ts`
- `src/app/boot/loadReleaseManifest.ts`
- `src/app/boot/loadSupportMatrix.ts`
- `src/app/boot/resolve-workspace-compatibility.spec.ts`
- `src/app/boot/resolve-workspace-compatibility.ts`
- `src/app/boot/registerServiceWorker.ts`
- `src/app/router/index.ts`
- `src/app/router/routes.ts`
- `src/app/router/shell-routes.spec.tsx`
- `src/app/router/shell-routes.tsx`
- `src/schemas/api/index.ts`
- `src/schemas/api/support-matrix.spec.ts`
- `src/schemas/api/support-matrix.ts`
- `src/schemas/contracts.spec.ts`
- `src/services/release/bootstrap-shell.ts`
- `src/services/release/bootstrap-shell.spec.ts`
- `src/services/release/detect-environment.spec.ts`
- `src/services/release/detect-environment.ts`
- `src/services/release/index.ts`
- `src/services/release/load-release-manifest.ts`
- `src/services/release/load-support-matrix.ts`
- `src/services/release/register-service-worker.spec.ts`
- `src/services/release/register-service-worker.ts`
- `src/services/release/service-worker-script.spec.ts`
- `src/stores/shell-status/index.ts`
- `src/stores/shell-status/store.ts`
- `src/stores/shell-status/store.spec.ts`
- `src/test/fixtures/api/release-manifest.fixture.ts`
- `src/test/fixtures/api/support-matrix.fixture.ts`

### Change Log

- 2026-04-17: Implemented shell readiness orchestration, support-matrix validation, unsupported-environment routing, shell-owned status plumbing, service-worker registration, and shell-level verification.
- 2026-04-17: Addressed review findings for UAD browser detection, shell metadata service-worker caching, and live update-prompt refresh wiring.
- 2026-04-17: Addressed follow-up review findings for compatibility-pending protected routes and late update release-note state refresh.
- 2026-04-17: Addressed final review findings for desktop-only and known-version support gating, protected-route workspace compatibility bootstrap, live update-metadata refresh, and protected-route bootstrap error surfacing.
- 2026-04-17: Addressed the latest review findings for persisted protected-route workspace compatibility, first-load update metadata precedence, and support-matrix pin validation.
- 2026-04-17: Addressed the latest shell-readiness review findings for combined support/error messaging and fail-closed canonical reopen route compatibility resolution.
- 2026-04-17: Addressed the final story 1.4 review findings for canonical-route compatibility-source trust and explicit offline-ready unavailability messaging.
- 2026-04-17: Review found that service-worker registration failures still collapse the shell into a fatal bootstrap error instead of surfacing a degraded cache/offline-ready state.
- 2026-04-17: Addressed the final service-worker bootstrap review finding by degrading cache/offline-ready status when registration fails instead of failing shell bootstrap.

### Review Findings

- [x] [Review][Patch] UAData family detection leaves Chrome/Edge unsupported when `userAgentData` is present [src/services/release/detect-environment.ts:158]
- [x] [Review][Patch] Service worker caches release and support API responses, freezing shell metadata after the first load [public/service-worker.js:24]
- [x] [Review][Patch] Update prompt state never refreshes after bootstrap because the service-worker update callbacks are not wired into shell status [src/services/release/bootstrap-shell.ts:47]
- [x] [Review][Patch] Unsupported routes mount before compatibility is known, so `/workspace` and `/review` can render before the shell redirects [src/app/router/shell-routes.tsx:234]
- [x] [Review][Patch] Service-worker update callbacks only flip a boolean, leaving the shell's release-note state stale after a late update is detected [src/app/App.tsx:28]
- [x] [Review][Patch] Browser support evaluation ignores the support matrix's desktop-only and known-version requirements, so unsupported clients can pass shell gating [src/services/release/detect-environment.ts:66]
- [x] [Review][Patch] The live bootstrap path never supplies workspace compatibility, so unsupported workspace formats cannot trigger `/unsupported` before work begins [src/app/App.tsx:25]
- [x] [Review][Patch] Service-worker update prompts continue using bootstrap metadata, so detected updates can surface stale release notes and prompt mode [src/services/release/register-service-worker.ts:51]
- [x] [Review][Patch] Bootstrap failures leave protected routes stuck in the compatibility-pending state instead of surfacing the shell error [src/app/router/shell-routes.tsx:255]
- [x] [Review][Patch] Protected-route workspace gating depends on a query parameter that the shipped route helpers never supply [src/app/boot/resolve-workspace-compatibility.ts:20]
- [x] [Review][Patch] Waiting service-worker updates still get their refreshed release metadata overwritten by the bootstrap result on first load [src/app/App.tsx:26]
- [x] [Review][Patch] Shell bootstrap never verifies that the fetched support matrix matches the manifest's pinned `supportMatrixVersion` [src/services/release/bootstrap-shell.ts:38]
- [x] [Review][Patch] Shell readiness shows browser-only support even when workspace or secure-context checks block the shell [src/app/router/shell-routes.tsx:96]
- [x] [Review][Patch] Bootstrap failures still surface a "No blocking environment issues detected." status message [src/app/router/shell-routes.tsx:84]
- [x] [Review][Patch] Protected reopen routes fail open when the workspace record cannot be loaded or parsed [src/app/boot/resolve-workspace-compatibility.ts:67]
- [x] [Review][Patch] Canonical reopen routes still trust `?workspaceFormatVersion=` over the saved workspace snapshot, so a crafted query can bypass unreadable-workspace gating [src/app/boot/resolve-workspace-compatibility.ts:119]
- [x] [Review][Patch] The shell readiness surface reports offline status as `waiting` even when service workers are unavailable, so blocked environments never get a clear not-available readiness state [src/app/router/shell-routes.tsx:158]
- [x] [Review][Patch] Service-worker registration failures still bubble out of shell bootstrap and drive `App` into the fatal error state, so supported browsers lose protected-route access instead of surfacing cache/offline-ready as unavailable or degraded [src/services/release/bootstrap-shell.ts:61]
