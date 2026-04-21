# Story 1.7: Provide Hosted-Shell Bootstrap Metadata For Local And Static Delivery

Status: review

## Story

As a developer and release owner,
I want the hosted shell to obtain its bootstrap metadata from an owned thin delivery path,
so that a fresh clone can load the shell locally and deployed builds can reach a healthy shell state without ad hoc manual servers.

## Acceptance Criteria

1. Given a fresh clone, when the documented local start flow runs, then the hosted shell loads successfully without requiring an ad hoc manual mock server because schema-valid `GET /api/release-manifest` and `GET /api/support-matrix` responses are available to the shell and are sourced from the canonical Story 1.2 release/support contracts.
2. Given the shell is deployed as static assets, when the thin operational delivery path is provisioned, then `GET /api/release-manifest`, `GET /api/support-matrix`, and `GET /api/health` are served independently of the analytical runtime and without adding any dataset or workspace CRUD API.
3. Given shell metadata is version-sensitive, when release metadata or support facts change, then local-dev and hosted-delivery sources read from one canonical checked-in source or generation step so manifest/support-matrix drift is detected before release.
4. Given route-owned shell screens are part of the hosted-shell entry contract, when the local and hosted shell are exercised, then SPA fallback works for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported` while preserving readable workspace-format routing and fail-closed protected-route behavior.
5. Given shell delivery fails or becomes inconsistent, when bootstrap validation or smoke checks run, then the failure is surfaced as a delivery/setup error before users encounter an unexplained shell-error state in normal startup, including healthy shell home, readable workspace-format route, blocked unreadable workspace-format route, and canonical fail-closed protected-route coverage.

## Dependencies

- Story 1.1: Bootstrap Hosted Shell Baseline
- Story 1.2: Author Canonical Workspace and Trust Contracts
- Story 1.4: Surface Shell Readiness, Support, and Update Status

## Contract Boundaries

- In scope: thin bootstrap metadata delivery for local dev/preview and static-hosted shell deployment, canonical checked-in or generated release/support payload sources, `GET /api/release-manifest`, `GET /api/support-matrix`, `GET /api/health`, SPA fallback for the shell route inventory, and shell-delivery smoke validation.
- Out of scope: telemetry queue implementation, telemetry ingestion durability, production monitoring dashboards, release-shaping regression gates, auth, remote workspace storage, dataset/workspace CRUD APIs, or moving shell bootstrap ownership into the analytical client bundle.
- Owning paths: thin delivery implementation under `scripts/**` or equivalent host-safe server glue, canonical metadata sources under `src/test/fixtures/api/**` and/or generated assets, shell bootstrap consumers under `src/services/release/**`, route verification under `src/app/router/**`, and delivery smoke coverage under `tests/e2e/**` or equivalent shell-level verification.
- Downstream consumers after completion: local `npm run dev` or preview-adjacent shell startup, deployed static-host shell bootstrap, Story 1.4 shell readiness surfaces, Epic 2+ protected-route entry, and Epic 6 operational hardening.

## Tasks / Subtasks

- [x] Establish one canonical checked-in source or generation path for release manifest and support matrix payloads so the thin delivery path and shell tests reuse the same data and schema expectations. (AC: 1, 3)
- [x] Replace the current ad hoc bootstrap helper with an owned thin delivery path that serves `GET /api/release-manifest`, `GET /api/support-matrix`, and `GET /api/health` independently of analytical runtime code and without adding dataset/workspace APIs. (AC: 1, 2)
- [x] Ensure the thin delivery path serves or fronts the built static shell with SPA fallback for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported` without weakening protected-route fail-closed behavior. (AC: 2, 4)
- [x] Add shell-delivery validation and smoke coverage for healthy shell startup, readable workspace-format route access, blocked unreadable workspace-format route handling, fail-closed protected routes, and explicit delivery/setup error surfacing. (AC: 4, 5)
- [x] Document the supported local start and verification flow so a fresh clone can reproduce the hosted-shell bootstrap path without relying on hidden manual setup. (AC: 1, 5)

### Review Findings

- [x] [Review][Patch] Make the thin delivery server self-contained instead of reading live bootstrap metadata from `src/test/fixtures/**` at runtime [scripts/shell-delivery-server.mjs:13]
- [x] [Review][Patch] Limit hosted-shell SPA fallback to the route-owned shell paths so missing asset requests still fail with `404` instead of returning `index.html` [scripts/shell-delivery-server.mjs:214]
- [x] [Review][Patch] Restore the runtime guard for `preview:shell` so the documented flow and Playwright web server cannot bypass the Linux Node enforcement [package.json:14]
- [x] [Review][Patch] Align the Vite dev metadata loader with the preview server invariants so local `/api/health` fails closed on manifest/support drift [vite.config.ts:25]
- [x] [Review][Patch] Replace the shared fixed-port failure server in the hosted-shell Playwright suite because `fullyParallel` can run `beforeAll` in multiple workers and race on `127.0.0.1:4174` [tests/e2e/shell-delivery.spec.ts:30]
- [x] [Review][Patch] Validate the full release-manifest and support-matrix schemas before `/api/health` can report `ok` [src/services/release/shell-bootstrap-metadata.ts:16]
- [x] [Review][Patch] Preserve SPA fallback for slash-terminated shell routes that React Router accepts [scripts/shell-bootstrap-metadata.mjs:93]
- [x] [Review][Patch] Treat malformed percent-encoded request paths as client errors instead of generic server failures [scripts/shell-delivery-server.mjs:84]
- [x] [Review][Patch] Add acceptance coverage for the documented `npm run dev` hosted-shell bootstrap flow [playwright.config.ts:10]
- [x] [Review][Patch] Reserve the `/api/*` namespace in the Vite dev server so unknown shell API requests fail closed instead of returning the app shell [vite.config.ts:47]
- [x] [Review][Patch] Align `/api/health` probe method handling between `npm run dev` and `preview:shell` so `HEAD` requests cannot report a false-positive HTML success in local validation [vite.config.ts:48]
- [x] [Review][Patch] Remove the standalone preview server's runtime dependency on `src/**/*.ts` schema modules so the thin delivery path stays deployable without the repo source tree [scripts/shell-bootstrap-metadata.mjs:3]
- [x] [Review][Patch] Stop returning raw exception messages from the hosted delivery server on `500` responses [scripts/shell-delivery-server.mjs:203]
- [x] [Review][Patch] Replace checkout-specific absolute paths in the hosted-shell documentation so the verification links resolve in the current workspace [docs/dev-environment.md:21]
- [x] [Review][Patch] Correct the sprint tracker `story_location` path for this checkout so workflow sync points at the active workspace [sprint-status.yaml:42]
- [x] [Review][Patch] Make preview `/api/health` fail closed when the deployed manifest or support matrix assets are missing, stale, or schema-invalid instead of trusting `dist/api/health.json` alone [scripts/shell-bootstrap-metadata.mjs:136]
- [x] [Review][Patch] Restore full release-manifest and support-matrix schema validation in the standalone preview helper so `/api/release-manifest` and `/api/support-matrix` cannot serve contract-invalid payloads [scripts/shell-bootstrap-metadata.mjs:28]
- [x] [Review][Patch] Reserve the bare `/api` path in the Vite dev server so mistyped shell API requests fail closed instead of serving the app shell [vite.config.ts:70]
- [x] [Review][Patch] Add direct hosted-shell acceptance coverage for `/unsupported` so AC4 proves SPA fallback for the full route inventory [tests/e2e/shell-delivery.spec.ts:181]
- [x] [Review][Defer] Clarify and enforce the `releaseManifest.integrity.manifestSha256` verification contract before treating it as a bootstrap invariant [src/test/fixtures/api/release-manifest.fixture.json:28] — deferred, pre-existing
- [x] [Review][Patch] Avoid hard-coding the published support-matrix version in the `/unsupported` hosted-shell assertion so canonical metadata refreshes do not fail E2E without a behavior regression [tests/e2e/shell-delivery.spec.ts:214]
- [x] [Review][Patch] Replace the remaining checkout-specific `/home/pinto/...` links in the hosted-shell documentation so the fresh-clone verification flow resolves in this workspace [docs/dev-environment.md:21]
- [x] [Review][Patch] Refresh the Story 1.7 artifact references and File List so they match this checkout and include `scripts/manual-epic1-shell-server.mjs` from the scoped diff [_bmad-output/implementation-artifacts/1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md:111]
- [x] [Review][Patch] Replace checkout-specific absolute paths in the hosted-shell documentation with repo-portable references so the fresh-clone flow works from any workspace location [docs/dev-environment.md:21]
- [x] [Review][Patch] Replace checkout-specific absolute paths in the Story 1.7 references with repo-portable paths so the artifact remains valid across workspaces [_bmad-output/implementation-artifacts/1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md:114]
- [x] [Review][Patch] Restore a repo-portable `story_location` instead of an author-specific absolute checkout path so sprint-status sync does not drift across machines [_bmad-output/implementation-artifacts/sprint-status.yaml:42]
- [x] [Review][Patch] Make preview `/api/health` fail closed when `/api/support-matrix` is unavailable so readiness probes cannot report `ok` while shell bootstrap is broken [scripts/shell-delivery-server.mjs:172]
- [x] [Review][Patch] Treat malformed percent-encoded preview `/api/*` paths as `400` client errors instead of generic API `404` responses [scripts/shell-delivery-server.mjs:190]
- [x] [Review][Patch] Fail closed on percent-encoded dev-server `/api` paths so requests like `/api%2Fhealth` cannot bypass the shell API guard and fall through to HTML [vite.config.ts:70]
- [x] [Review][Patch] Remove or quarantine the obsolete manual Epic 1 shell server so Story 1.7 owns a single thin bootstrap delivery path without duplicate inline metadata, extra endpoints, or broad SPA fallback [scripts/manual-epic1-shell-server.mjs:16]
- [x] [Review][Patch] Reject dot-segment aliases before the Vite dev server normalizes them into reserved `/api/*` routes so requests like `/foo/%2e%2e/api/health` fail closed instead of returning bootstrap metadata [vite.config.ts:70]
- [x] [Review][Patch] Reject dot-segment aliases in preview delivery before pathname normalization can expose `/api/*` routes or the app shell through paths like `/foo/%2e%2e/api/health` and `/assets/%2e%2e/index.html` [scripts/shell-delivery-server.mjs:156]
- [x] [Review][Patch] Reject slash-encoded separator aliases before the Vite dev server falls through to the app shell for requests like `/foo%2F..%2Fapi%2Fhealth` and `/assets%2F..%2Findex.html` [vite.config.ts:72]
- [x] [Review][Patch] Reject slash-encoded separator aliases in preview delivery so aliased asset paths like `/assets%2F..%2Findex.html` cannot normalize to and serve `index.html` [scripts/shell-delivery-server.mjs:157]
- [x] [Review][Patch] Add `%2F`-encoded separator alias coverage for both preview and dev delivery so the raw-path bypass cannot regress silently [tests/e2e/shell-delivery.spec.ts:208]
- [x] [Review][Patch] Reject percent-encoded slash aliases before preview delivery serves the shell for non-canonical protected-route paths like `/workspace%2Fdemo` and `/review%2Fdemo` [scripts/shell-delivery-server.mjs:226]
- [x] [Review][Patch] Add hosted-shell outage coverage for the `release-manifest-unavailable` preview failure mode so both bootstrap-unavailable branches stay exercised [tests/e2e/shell-delivery.spec.ts:329]
- [x] [Review][Patch] Add documented `npm run dev` coverage for the raw `%2e%2e` asset alias case so `/assets/%2e%2e/index.html` cannot silently regress to SPA HTML [tests/e2e/shell-delivery.spec.ts:355]
- [x] [Review][Patch] Check `release-manifest-unavailable` and `support-matrix-unavailable` before loading deployed metadata so preview `/api/release-manifest` and `/api/support-matrix` still return their intended `503` outage responses when deployed metadata assets are missing or invalid [scripts/shell-delivery-server.mjs:174]
- [x] [Review][Patch] Reserve absolute-form `/api/*` request targets in the Vite dev middleware so proxied requests like `GET http://127.0.0.1:43174/api/health` fail closed instead of returning SPA HTML with `200` [vite.config.ts:72]
- [x] [Review][Patch] Reconcile the Story 1.7 review checklist and completion notes with the current review state so the artifact does not claim closure while unresolved review items remain [_bmad-output/implementation-artifacts/1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md:77]
- [x] [Review][Patch] Exercise `/api/release-manifest` and `/api/support-matrix` directly in the documented `npm run dev` acceptance flow so AC1 proves both owned bootstrap endpoints are available, not only `/api/health` plus indirect page startup [tests/e2e/shell-delivery.spec.ts:390]
- [x] [Review][Patch] Extend the documented local-flow hosted-shell acceptance coverage beyond `/workspace/` to also exercise `/`, `/review/:workspaceId`, and `/unsupported` so AC4 proves local SPA fallback parity for the full route inventory [tests/e2e/shell-delivery.spec.ts:390]
- [x] [Review][Patch] Catch malformed absolute-form request targets before `resolveRequestPathname()` can throw out of the Vite dev middleware and terminate the documented `npm run dev` flow [vite.config.ts:73]
- [x] [Review][Patch] Preserve the deprecated manual shell server's compatibility-only `/api/telemetry` and `/release-notes/0.1.0` routes instead of forwarding callers to a thinner server that drops endpoints still advertised by the canonical manifest [scripts/manual-epic1-shell-server.mjs:11]
- [x] [Review][Patch] Replace the preview helper's duplicated release-manifest and support-matrix schemas with a canonical deployable contract artifact so hosted validation cannot drift from the Story 1.2 contracts [scripts/shell-bootstrap-metadata.mjs:85]
- [x] [Review][Patch] Add direct preview success-path assertions for `/api/release-manifest`, `/api/support-matrix`, and `/api/health` so hosted-shell acceptance proves the delivery contract directly instead of only through UI startup [tests/e2e/shell-delivery.spec.ts:250]
- [x] [Review][Patch] Add direct preview outage assertions for `/api/release-manifest` and `/api/support-matrix` so the branch-specific `503` responses stay covered alongside the existing `/api/health` checks [tests/e2e/shell-delivery.spec.ts:337]

## Dev Notes

### Architecture Alignment

- The architecture explicitly separates the hosted shell from the analytical runtime: static assets and the UI bundle stay portable, while any bootstrap or telemetry service remains a thin operational component rather than a backend for analytical state.
- Operational endpoints are intentionally narrow and noun-based: `GET /api/release-manifest`, `GET /api/support-matrix`, and `GET /api/health` are allowed here; dataset or workspace network APIs are not.
- HTTPS, secure-context assumptions, service-worker ownership, and support-matrix enforcement remain shell concerns. This story must not move compatibility logic or bootstrap ownership into feature modules.

### Existing Code Intelligence

- `src/services/release/load-release-manifest.ts` and `src/services/release/load-support-matrix.ts` already parse payloads through strict Zod schemas. The provider created here must serve payloads that satisfy those exact contracts, not loosely similar JSON.
- `src/services/release/bootstrap-shell.ts` already expects a manifest first, then follows `supportMatrixUrl`, pins the support-matrix version, and degrades service-worker readiness safely. Reuse that client path; do not create a second shell bootstrap client.
- `src/test/fixtures/api/release-manifest.fixture.ts` and `src/test/fixtures/api/support-matrix.fixture.ts` already encode the expected shell metadata shape. They are the strongest existing canonical source candidates unless a generation step replaces them deliberately.
- `scripts/manual-epic1-shell-server.mjs` is currently a hard-coded manual helper with inline manifest/support payloads and SPA fallback. This story should replace or formalize that path rather than entrenching duplicated inline metadata.
- `tests/e2e/import.spec.ts` currently mocks `/api/release-manifest` and `/api/support-matrix` inside Playwright because the default preview server does not provide them. Story 1.7 should make shell-delivery smoke checks possible without those bootstrap mocks for the shell startup path being validated.

### Project Structure Notes

- Keep `src/services/release/**` as the only client-side path for release/support fetches and validation.
- Prefer a thin operational seam under `scripts/**`, Vite middleware, generated static JSON plus host wrapper, or another deployment-safe delivery adapter that can serve the operational endpoints next to the built shell.
- If generation scripts are added, keep them aligned with the architecture naming hints for release/support metadata and avoid scattering duplicate manifest/support JSON across server glue, tests, and docs.
- Preserve `src/app/router/routes.ts` and `src/app/router/shell-routes.tsx` as the route-policy authority. The delivery layer should respect those routes, not redefine them.

### Testing

- Add or update unit/integration checks proving the delivered manifest and support matrix remain schema-valid and version-aligned with the Story 1.2 contracts.
- Add shell-delivery smoke coverage that exercises the real thin delivery path for:
  - healthy shell home startup
  - readable workspace-format route access
  - blocked unreadable workspace-format route behavior
  - fail-closed `/workspace/:workspaceId` and `/review/:workspaceId` behavior when compatibility cannot be confirmed
  - delivery/setup error surfacing when metadata delivery is unavailable or inconsistent
- Keep the normal repo validation path in scope: `npm run build`, the targeted smoke or Playwright suite, plus `npm run typecheck`, `npm run lint`, and relevant Vitest coverage.

### Previous Story Intelligence

- Story 1.4 already locked shell-owned release-manifest loading, support-matrix fetch/integration, unsupported-environment routing, and shell status surfaces. Story 1.7 must provide the delivery source for that behavior, not re-implement those concerns in the client.
- Story 1.4 review history already fixed several fail-closed and bootstrap-error regressions around protected routes and shell status. This story must preserve those protections when introducing the thin delivery path.
- Story 1.2 established shared runtime contracts early so later stories reuse them. Any provider added here that duplicates or drifts from those contracts would directly violate the intended Epic 1 foundation pattern.

### Residual Assumptions

- This story can be implemented with a lightweight server, middleware, generated static JSON plus host wrapper, or another deployment-safe thin delivery option, provided the result remains operationally narrow and deployable with the static shell.
- Production monitoring, alerting, and broader release hardening remain Epic 6 work even if this story adds a minimal `/api/health` response and local smoke validation.
- The delivery path may still expose `/api/telemetry` later, but that endpoint is not required scope for Story 1.7 and should not be expanded here beyond what is needed to keep shell bootstrap healthy.

### References

- `_bmad-output/planning-artifacts/epic-1-stories.md` - Story 1.7 scope, acceptance criteria, and Epic 1 completion note
- `_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis and thin delivery-path ownership
- `_bmad-output/planning-artifacts/prd.md` - FR59, FR60, FR62, NFR15, NFR16, NFR18, NFR22, NFR24
- `_bmad-output/planning-artifacts/architecture.md` - hosted shell delivery topology, minimal API surface, HTTPS/security boundary, and deployment separation
- `_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - release manifest example shape, route constants, and shell-only service-worker ownership
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`
- `_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-10-browser-support-matrix-and-safari-stance.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-20-hosted-shell-bootstrap-provider-gap.md` - approved scope rationale and anti-drift guardrails
- `_bmad-output/implementation-artifacts/1-4-surface-shell-readiness-support-and-update-status.md` - existing shell bootstrap/readiness behavior and protected-route review learnings

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Reviewed the Story 1.7 planning entry, Epic 1 implementation emphasis, PRD hosted-shell requirements, and architecture hosted-shell topology on 2026-04-20.
- Reviewed Story 1.2 and Story 1.4 implementation artifacts to capture the existing contract boundary and shell-readiness learnings on 2026-04-20.
- Reviewed `scripts/manual-epic1-shell-server.mjs`, `src/services/release/bootstrap-shell.ts`, `src/test/fixtures/api/release-manifest.fixture.ts`, `src/test/fixtures/api/support-matrix.fixture.ts`, `package.json`, and `playwright.config.ts` to anchor Story 1.7 to the current repo seams on 2026-04-20.
- Added canonical JSON bootstrap fixtures and rewired the typed fixture wrappers plus contract coverage to validate schema and manifest/support-matrix alignment on 2026-04-20.
- Added Vite dev bootstrap endpoint middleware, a thin static shell delivery server, hosted-shell Playwright smoke coverage, and local-flow documentation on 2026-04-20.
- Validated live `/api/release-manifest`, `/api/support-matrix`, and `/api/health` responses from both `npm run dev` and `npm run preview:shell`, then ran `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` on 2026-04-20.
- Addressed the Story 1.7 review findings by generating deployment-ready bootstrap metadata assets during build, tightening standalone fallback routing, restoring `preview:shell` runtime enforcement, aligning Vite health validation with the hosted preview invariants, and replacing the fixed-port failure server with per-test ephemeral instances on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after the review-finding patch set on 2026-04-21.
- Added schema-level bootstrap metadata validation for both dev and preview delivery, normalized slash-terminated shell route fallback matching, hardened malformed request-path handling to return `400`, and added Playwright coverage for the documented `npm run dev` flow on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after the final review-finding patch set on 2026-04-21.
- Reserved the Vite dev `/api/*` namespace, aligned dev and preview `HEAD /api/health` handling, removed the preview server dependency on `src/**/*.ts` schema modules by emitting deployment-ready health metadata, sanitized hosted-shell `500` bodies, and corrected checkout-specific workspace paths on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the final Story 1.7 review findings on 2026-04-21.
- Added preview-health drift coverage for missing, stale, and schema-invalid deployed metadata assets, then updated the generated health payload contract to carry deployment asset digests so `preview:shell` fails closed when `dist/api/*.json` drifts on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after the final preview `/api/health` fail-closed patch on 2026-04-21.
- Restored full standalone preview schema validation by parsing release-manifest and support-matrix payloads through deployable Zod schemas inside `scripts/shell-bootstrap-metadata.mjs`, then added parity coverage that proves preview delivery rejects contract-invalid bootstrap assets on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after restoring full standalone preview schema validation on 2026-04-21.
- Verified the remaining bare `/api` and direct `/unsupported` review findings against the current working tree on 2026-04-21, then corrected the new `/unsupported` Playwright expectation to match the route’s actual stable copy after the full `npm run test:e2e` gate exposed the stale assertion.
- Re-ran `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the last two Story 1.7 review findings on 2026-04-21.
- Replaced the last hard-coded `/unsupported` support-matrix assertion with the canonical fixture version, updated the remaining workspace-local documentation and Story 1.7 reference paths for this checkout, and prepared the final artifact record refresh on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the final Story 1.7 artifact/documentation review findings on 2026-04-21.
- Closed the remaining repo-portability and shell-delivery review findings by switching hosted-shell docs and Story 1.7 references to repo-portable paths, restoring a portable sprint `story_location`, failing preview `/api/health` closed when bootstrap support metadata is unavailable, returning `400` for malformed preview API paths, rejecting encoded dev `/api` variants, and quarantining the legacy Epic 1 manual server behind the owned thin delivery path on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the final Story 1.7 repo-portability and API-guard review findings on 2026-04-21.
- Closed the remaining dot-segment alias review findings by decoding raw request path segments before any URL/path normalization, rejecting `.` and `..` aliases in both Vite dev and standalone preview delivery, and adding raw-path hosted-shell acceptance coverage for aliased API and shell paths on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the final dot-segment alias review findings on 2026-04-21.
- Closed the remaining slash-encoded separator alias review findings by expanding raw-path alias detection across decoded `%2F` separators before normalization in both Vite dev and standalone preview delivery, then adding helper parity coverage plus hosted-shell acceptance assertions for the documented preview and `npm run dev` flows on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after closing the final slash-encoded separator alias review findings on 2026-04-21.
- Closed the remaining implementation-of-findings pass by rejecting `%2F`-aliased protected shell routes from preview SPA fallback, adding the missing `release-manifest-unavailable` hosted-shell outage coverage, and extending `npm run dev` parity coverage to the raw `/assets/%2e%2e/index.html` alias on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint` after the implementation-of-findings pass on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm run build` and `bash ./scripts/with-node.sh npm run test:e2e` as the final Story 1.7 completion gate after updating the implementation artifact and sprint status on 2026-04-21.
- Closed the remaining implementation-of-findings review defects by short-circuiting preview outage modes before deployed metadata loads, rejecting absolute-form `/api/*` request targets in the Vite dev middleware, and reconciling the Story 1.7 checklist/completion record with the actual resolved review state on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e` after the final implementation-of-findings review-close pass on 2026-04-21.
- Closed the remaining implementation-of-findings review defects by catching malformed absolute-form request targets inside the Vite dev middleware, restoring the deprecated manual server's compatibility-only telemetry and release-notes routes via a proxy shim, extracting deployable preview schemas into a canonical contract artifact, and adding direct preview success/outage assertions for the owned bootstrap endpoints on 2026-04-21.
- Re-ran `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build` after the final Story 1.7 implementation-of-findings closeout on 2026-04-21.

### Completion Notes List

- Story created from the approved Story 1.7 planning entry and aligned to the shell-delivery gap identified after Epic 1’s earlier completion.
- The story is intentionally narrow: it owns thin release/support metadata delivery and shell-route fallback behavior, not telemetry hardening or any analytical backend.
- Existing shell bootstrap consumers, strict API schemas, fixtures, and fail-closed route behavior are called out explicitly so implementation reuses them instead of inventing parallel paths.
- Promoted the release manifest and support matrix into canonical checked-in JSON payloads and kept the typed fixtures reading from those files so schema checks, shell tests, Vite dev delivery, and the thin static server share one source.
- Added owned thin delivery for local and static-hosted shell bootstrap through Vite `/api/*` middleware and `scripts/shell-delivery-server.mjs`, including `/api/health`, explicit API narrowing, and SPA fallback over the shell route inventory.
- Added hosted-shell smoke coverage for healthy startup, readable workspace access, blocked unreadable workspace routes, fail-closed protected detail routes, and explicit delivery/setup error surfacing, then documented the supported local verification flow in `docs/dev-environment.md`.
- Validation passed with live HTTP checks plus `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- Resolved the hosted-shell review pass by moving preview bootstrap payload loading onto generated `dist/api/*.json` assets, which keeps the standalone delivery server self-contained while preserving one canonical metadata source.
- Resolved the fallback and runtime review findings by narrowing standalone SPA fallback to the owned shell routes, restoring `prepreview:shell`, and making the Playwright hosted-shell web server use the Linux Node wrapper path.
- Added typed shell-bootstrap helper coverage plus a `404` missing-asset smoke assertion, and replaced the shared `4174` failure server with per-test ephemeral server instances so the hosted-shell suite stays stable under `fullyParallel`.
- Resolved the remaining hosted-shell review findings by validating full manifest/support schemas before health checks report `ok`, preserving slash-terminated shell-route fallback, returning `400` for malformed percent-encoded paths, and proving the documented `npm run dev` bootstrap path through Playwright acceptance coverage.
- Validation passed again with `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- Closed the last Story 1.7 review findings by failing closed on unknown dev `/api/*` requests and `HEAD /api/health`, emitting deployment-ready `dist/api/health.json` so the standalone preview server no longer depends on `src/**/*.ts` at runtime, sanitizing hosted-shell `500` responses, and correcting workspace-local documentation and sprint-tracker paths.
- Validation passed for the final review pass with `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: preview `/api/health` now cross-checks the deployed release-manifest and support-matrix assets against schema/consistency validation plus generated SHA-256 digests, so missing, stale, or drifted metadata fails closed instead of returning a false `ok`.
- Validation passed for the preview health fail-closed review pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: standalone preview delivery now enforces the full release-manifest and support-matrix schemas before serving `/api/release-manifest`, `/api/support-matrix`, or reporting healthy bootstrap metadata.
- Validation passed for the standalone preview schema-validation review pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: Vite dev now reserves the bare `/api` path alongside `/api/*`, and the hosted-shell acceptance suite proves the documented `npm run dev` flow returns a fail-closed `404` for that mistyped API root.
- ✅ Resolved review finding [P1]: hosted-shell SPA fallback coverage now exercises `/unsupported` directly with stable unsupported-route assertions, after correcting a stale expectation the full Playwright regression surfaced during this pass.
- Validation passed for the final Story 1.7 review-close pass with `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P2]: the direct `/unsupported` hosted-shell Playwright assertion now reads the published support-matrix version from the canonical fixture instead of hard-coding a dated string, so metadata refreshes do not cause a false regression.
- ✅ Resolved review finding [P2]: the hosted-shell documentation and Story 1.7 artifact references now use repo-portable paths, and the sprint tracker now points at the portable implementation-artifacts root instead of a machine-specific checkout.
- Validation passed for the final Story 1.7 documentation/artifact review-close pass with `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: preview `/api/health` now fails closed when the support-matrix delivery path is unavailable, so readiness probes cannot report `ok` while shell bootstrap is broken.
- ✅ Resolved review finding [P1]: preview delivery now returns `400` for malformed percent-encoded `/api/*` requests, and the Vite dev server rejects encoded `/api` variants like `/api%2Fhealth` with a fail-closed `404` instead of falling through to the app shell.
- ✅ Resolved review finding [P2]: `scripts/manual-epic1-shell-server.mjs` is now a quarantined compatibility shim that forwards to `scripts/shell-delivery-server.mjs`, removing the duplicate inline bootstrap metadata and extra legacy endpoints from Story 1.7 ownership.
- Validation passed for the final Story 1.7 repo-portability and API-guard review-close pass with `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: Vite dev and standalone preview delivery now reject dot-segment request-path aliases before URL normalization can expose reserved `/api/*` routes or shell assets through paths like `/foo/%2e%2e/api/health` and `/assets/%2e%2e/index.html`.
- Validation passed for the final Story 1.7 dot-segment alias review-close pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P1]: Vite dev now rejects `%2F`-encoded separator aliases that decode into dot-segment traversal before the request can fall through to the app shell or reserved shell API routes.
- ✅ Resolved review finding [P1]: standalone preview delivery now rejects `%2F`-encoded separator aliases before aliased asset paths can normalize to `index.html` or other deployed files.
- ✅ Resolved review finding [P1]: Story 1.7 helper and hosted-shell acceptance coverage now proves `%2F`-encoded separator aliases fail closed in both preview delivery and the documented `npm run dev` flow.
- Validation passed for the final Story 1.7 slash-encoded separator alias review-close pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P2]: standalone preview delivery now requires canonical slash separators before protected `/workspace/:workspaceId` and `/review/:workspaceId` routes qualify for SPA fallback, so `%2F`-aliased requests like `/workspace%2Fdemo` and `/review%2Fdemo` fail closed with `404`.
- ✅ Resolved review finding [P3]: hosted-shell E2E coverage now exercises the `release-manifest-unavailable` outage branch for both bootstrap UI failure surfacing and preview `/api/health` fail-closed behavior.
- ✅ Resolved review finding [P3]: the documented `npm run dev` hosted-shell parity coverage now includes the raw `%2e%2e` asset alias `/assets/%2e%2e/index.html` and verifies the request fails closed.
- Validation passed for the final Story 1.7 implementation-of-findings pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, and `bash ./scripts/with-node.sh npm run lint`.
- Final Story 1.7 completion gate also passed with `bash ./scripts/with-node.sh npm run build` and `bash ./scripts/with-node.sh npm run test:e2e`, so the story is ready for review with full regression coverage.
- ✅ Resolved review finding [P2]: preview `/api/release-manifest`, `/api/support-matrix`, and `/api/health` now short-circuit outage modes before deployed metadata loads, so branch-specific `503` responses survive even when `dist/api/*.json` is missing or invalid.
- ✅ Resolved review finding [P2]: Vite dev now treats absolute-form `/api/*` request targets as reserved but non-canonical, so proxied requests like `GET http://127.0.0.1:43174/api/health` fail closed with the shell API `404` instead of falling through to SPA HTML.
- ✅ Resolved review finding [P3]: the Story 1.7 review checklist, completion notes, and sprint status are back in sync with the resolved review state, so the artifact no longer claims closure while leaving unchecked findings behind.
- Validation passed for the final Story 1.7 review-close pass with `bash ./scripts/with-node.sh npm test -- src/services/release/shell-bootstrap-metadata.spec.ts`, `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, `bash ./scripts/with-node.sh npm run build`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P3]: the documented `npm run dev` acceptance proof now hits `GET /api/release-manifest` and `GET /api/support-matrix` directly and compares both responses with the canonical checked-in bootstrap fixtures, so AC1 no longer depends on `/api/health` or indirect page startup.
- ✅ Resolved review finding [P3]: the documented local-flow hosted-shell parity coverage now exercises `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`, so AC4 is proven against the full local route inventory.
- Validation passed for the final Story 1.7 local acceptance-proof closeout with `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run test:e2e`.
- ✅ Resolved review finding [P2]: malformed absolute-form request targets are now caught inside the Vite dev middleware, so bad proxy-style request targets return the intended `400` client error instead of escaping the middleware.
- ✅ Resolved review finding [P2]: the deprecated manual shell server now proxies the owned thin delivery path while preserving its compatibility-only `/api/telemetry` and `/release-notes/0.1.0` routes.
- ✅ Resolved review finding [P2]: hosted preview validation now consumes `scripts/shell-bootstrap-contracts.mjs` as the canonical deployable bootstrap contract artifact instead of duplicating the release/support schemas inline.
- ✅ Resolved review finding [P3]: hosted-shell acceptance now asserts direct preview success responses for `/api/release-manifest`, `/api/support-matrix`, and `/api/health`.
- ✅ Resolved review finding [P3]: hosted-shell outage coverage now asserts the branch-specific `503` responses from preview `/api/release-manifest` and `/api/support-matrix` alongside the existing `/api/health` checks.
- Validation passed for the final Story 1.7 implementation-of-findings closeout with `bash ./scripts/with-node.sh npx playwright test tests/e2e/shell-delivery.spec.ts`, `bash ./scripts/with-node.sh npm run typecheck`, `bash ./scripts/with-node.sh npm test`, `bash ./scripts/with-node.sh npm run lint`, and `bash ./scripts/with-node.sh npm run build`.

### File List

- _bmad-output/implementation-artifacts/1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docs/dev-environment.md
- package.json
- playwright.config.ts
- scripts/manual-epic1-shell-server.mjs
- scripts/shell-bootstrap-contracts.mjs
- scripts/shell-delivery-server.mjs
- scripts/shell-bootstrap-metadata.mjs
- src/schemas/api/release-manifest.ts
- src/schemas/api/support-matrix.ts
- src/schemas/contracts.spec.ts
- src/schemas/validation/index.ts
- src/services/release/shell-bootstrap-metadata.spec.ts
- src/services/release/shell-bootstrap-metadata.ts
- src/test/fixtures/api/release-manifest.fixture.json
- src/test/fixtures/api/release-manifest.fixture.ts
- src/test/fixtures/api/support-matrix.fixture.json
- src/test/fixtures/api/support-matrix.fixture.ts
- tests/e2e/shell-delivery.spec.ts
- vite.config.ts

## Change Log

- 2026-04-20: Added canonical shell bootstrap JSON fixtures, Vite dev bootstrap metadata delivery, a thin static shell delivery server, hosted-shell smoke coverage, and documented local verification flow; validated with typecheck, unit tests, lint, build, and full Playwright coverage.
- 2026-04-21: Resolved the Story 1.7 review findings by making preview delivery self-contained from built metadata assets, aligning dev and preview bootstrap validation, tightening standalone fallback behavior, and de-flaking the hosted-shell failure-path smoke test; revalidated with typecheck, full Vitest, lint, build, and full Playwright coverage.
- 2026-04-21: Closed the remaining review findings by enforcing full schema validation before shell health reports `ok`, preserving slash-terminated shell-route fallback, returning `400` for malformed request paths, and adding Playwright acceptance coverage for the documented `npm run dev` hosted-shell bootstrap flow; revalidated with typecheck, full Vitest, lint, build, and full Playwright coverage.
- 2026-04-21: Closed the final Story 1.7 review findings by reserving Vite dev `/api/*`, aligning preview and dev `HEAD /api/health` handling, emitting deployment-ready health metadata so `preview:shell` no longer depends on `src/**/*.ts` at runtime, sanitizing hosted-shell `500` responses, and correcting workspace-local documentation and sprint-tracker paths; revalidated with targeted Story 1.7 checks plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the remaining preview `/api/health` fail-closed review finding by embedding manifest/support asset digests into generated health metadata and verifying the deployed JSON assets during preview health checks; revalidated with targeted Story 1.7 helper coverage plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the remaining standalone preview schema-validation review finding by restoring full deployable release-manifest and support-matrix schema parsing in `scripts/shell-bootstrap-metadata.mjs` and adding parity coverage for contract-invalid deployed assets; revalidated with targeted Story 1.7 helper coverage plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the last two Story 1.7 review findings by verifying bare `/api` fail-closed coverage, fixing the direct `/unsupported` hosted-shell acceptance assertion to match stable route copy, and revalidating with targeted shell-delivery coverage plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the final Story 1.7 artifact/documentation review findings by deriving the `/unsupported` support-matrix assertion from the canonical fixture, updating remaining workspace-local checkout paths in the hosted-shell documentation and story references, and refreshing the artifact File List to include `scripts/manual-epic1-shell-server.mjs`; revalidated with targeted shell-delivery coverage plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the final implementation-of-findings review items by catching malformed absolute-form dev request targets inside the Vite middleware, restoring the deprecated manual server's compatibility-only telemetry and release-notes routes via a proxy shim, extracting a canonical deployable preview contract artifact, and adding direct preview success/outage assertions for the owned bootstrap endpoints; revalidated with targeted shell-delivery coverage plus full typecheck, Vitest, lint, and build coverage.
- 2026-04-21: Closed the final Story 1.7 repo-portability and API-guard review findings by switching hosted-shell docs/story/sprint references to portable repo paths, failing preview `/api/health` closed when support metadata is unavailable, returning `400` for malformed preview `/api/*` paths, rejecting encoded dev `/api` variants, and quarantining the legacy manual Epic 1 shell server behind the owned thin delivery path; revalidated with targeted shell-delivery coverage plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the final dot-segment alias review findings by decoding raw request path segments before normalization in both Vite dev and preview delivery, rejecting `.`/`..` aliases with fail-closed responses, and adding raw-path hosted-shell coverage for aliased API and shell paths; revalidated with targeted helper/Playwright checks plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the final slash-encoded separator alias review findings by expanding raw-path alias detection across decoded `%2F` separators in both Vite dev and preview delivery, adding helper parity coverage plus preview/dev hosted-shell assertions, and revalidating with targeted helper/Playwright checks plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the remaining implementation-of-findings pass by requiring canonical protected-route separators for preview SPA fallback, adding the `release-manifest-unavailable` hosted-shell outage branch to E2E coverage, extending `npm run dev` parity to `/assets/%2e%2e/index.html`, and revalidating with targeted helper/Playwright checks plus the required typecheck, Vitest, and lint gates.
- 2026-04-21: Completed the Story 1.7 review handoff by re-running `npm run build` and the full `npm run test:e2e` suite after the implementation artifact and sprint status moved to `review`.
- 2026-04-21: Closed the final implementation-of-findings review defects by short-circuiting preview outage modes before deployed metadata loads, rejecting absolute-form dev `/api/*` request targets, reconciling the Story 1.7 checklist with the actual resolved findings, and revalidating with targeted helper/Playwright checks plus full typecheck, Vitest, lint, build, and Playwright coverage.
- 2026-04-21: Closed the final local acceptance-proof review findings by expanding the documented `npm run dev` Playwright proof to fetch `/api/release-manifest` and `/api/support-matrix` directly from the owned thin delivery path and by exercising `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported` in the local route-parity flow; revalidated with targeted shell-delivery coverage plus full typecheck, Vitest, lint, and Playwright coverage.
