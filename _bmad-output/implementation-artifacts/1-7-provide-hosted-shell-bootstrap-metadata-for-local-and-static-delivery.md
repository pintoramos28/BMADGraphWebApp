# Story 1.7: Provide Hosted-Shell Bootstrap Metadata For Local And Static Delivery

Status: in-progress

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
- [ ] [Review][Patch] Reserve the bare `/api` path in the Vite dev server so mistyped shell API requests fail closed instead of serving the app shell [vite.config.ts:70]
- [ ] [Review][Patch] Add direct hosted-shell acceptance coverage for `/unsupported` so AC4 proves SPA fallback for the full route inventory [tests/e2e/shell-delivery.spec.ts:181]
- [x] [Review][Defer] Clarify and enforce the `releaseManifest.integrity.manifestSha256` verification contract before treating it as a bootstrap invariant [src/test/fixtures/api/release-manifest.fixture.json:28] — deferred, pre-existing

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

- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md` - Story 1.7 scope, acceptance criteria, and Epic 1 completion note
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Epic 1 implementation emphasis and thin delivery-path ownership
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md` - FR59, FR60, FR62, NFR15, NFR16, NFR18, NFR22, NFR24
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - hosted shell delivery topology, minimal API surface, HTTPS/security boundary, and deployment separation
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - release manifest example shape, route constants, and shell-only service-worker ownership
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-09-release-manifest-and-compatibility-envelope.md`
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-10-browser-support-matrix-and-safari-stance.md`
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-20-hosted-shell-bootstrap-provider-gap.md` - approved scope rationale and anti-drift guardrails
- `/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-4-surface-shell-readiness-support-and-update-status.md` - existing shell bootstrap/readiness behavior and protected-route review learnings

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

### File List

- _bmad-output/implementation-artifacts/1-7-provide-hosted-shell-bootstrap-metadata-for-local-and-static-delivery.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docs/dev-environment.md
- package.json
- playwright.config.ts
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
