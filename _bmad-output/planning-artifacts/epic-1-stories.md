# Epic 1 Stories

Epic 1: Hosted Workspace Entry, Save/Reopen Trust, and Shell Readiness

Goal: Deliver the first trustworthy BMADGraphWebApp entry flow so users can open the hosted shell, create or reopen a local workspace, understand readiness/support state, and preserve valid work when issues are found.

## Story 1.1: Bootstrap Hosted Shell Baseline

As a developer,
I want a thin hosted-shell baseline created from the approved starter,
so that later stories land on a working client scaffold instead of ad hoc setup.

Dependencies: None
Requirements: FR59, FR62, NFR15, NFR16, architecture starter and route baseline

**Acceptance Criteria**

1. Given a fresh clone, when the app is installed and started, then the Vite React TypeScript shell loads successfully and exposes placeholder routes for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`.
2. Given shell navigation is implemented, when route definitions are imported, then they come from canonical route constants rather than duplicated string literals.
3. Given the shell bootstraps, when service worker support is present, then registration ownership is kept in the shell layer rather than feature modules.
4. Given baseline quality checks run, when lint, typecheck, build, and a smoke test execute, then the starter baseline passes.

## Story 1.2: Author Canonical Workspace and Trust Contracts

As a developer,
I want versioned workspace, issue, provenance, and telemetry contracts defined early,
so that feature stories share one source of truth for persistence and trust state.

Dependencies: Story 1.1
Requirements: FR43-FR49, FR61, FR62, NFR6-NFR10, architecture contract-first baseline

**Acceptance Criteria**

1. Given the shared schemas are authored, when workspace snapshots, ledger entries, issue records, provenance events, release metadata, and telemetry payloads are validated, then they all conform to versioned runtime schemas.
2. Given provenance records are created, when an event is logged, then it uses the MVP origin labels `user_action`, `system_inference`, `repair_action`, `workspace_import`, or `migration_or_version_check`.
3. Given contract examples are needed for later implementation, when developers inspect the planning and architecture artifacts, then example payloads exist for workspace snapshot, ledger entry, issue record, release manifest, and telemetry event.

## Story 1.3: Create, Open, and Reopen Local Workspaces

As a user,
I want to start a new workspace or reopen a saved one,
so that BMADGraphWebApp preserves my analytical session as a local system of record.

Dependencies: Story 1.2
Requirements: FR7, FR43-FR49, NFR4, NFR6-NFR10

**Acceptance Criteria**

1. Given the shell is ready, when a user creates a workspace, then a contract-valid local workspace is initialized without requiring network storage.
2. Given a saved workspace exists, when the user reopens it, then dataset semantics, transforms, graph state, and reference-graph state are restored to a usable analytical state within the reopen budget for benchmark workspaces.
3. Given a reopened workspace contains invalid elements, when validation runs, then valid portions stay available and flagged elements are preserved as repairable issues instead of being dropped silently.

## Story 1.4: Surface Shell Readiness, Support, and Update Status

As a user,
I want BMADGraphWebApp to tell me whether the shell is supported, cached, and up to date,
so that I can trust it before I begin serious analytical work.

Dependencies: Stories 1.1-1.2
Requirements: FR59, FR60, FR62, NFR15-NFR24

**Acceptance Criteria**

1. Given a supported environment, when the hosted shell loads once, then the app shows clear readiness state including support, cache, and offline-ready status.
2. Given an unsupported browser or workspace configuration, when the app starts, then the user is warned before import or reopen work begins and can reach the `/unsupported` route.
3. Given release metadata changes, when the shell detects an update, then the update prompt and release-note state are surfaced through shell status surfaces rather than feature-specific UI.

## Story 1.5: Localize Reopen Errors and Provide Repair Entry Points

As a user,
I want reopen problems to be isolated and repairable,
so that one broken element does not invalidate the whole workspace.

Dependencies: Stories 1.2-1.4
Requirements: FR46, FR47, FR52, NFR7-NFR10

**Acceptance Criteria**

1. Given a reopened workspace contains a stale formula, invalid saved graph selection, saved issue-record or ledger drift, missing file handle, or another currently deterministically detectable localized reopen failure, when validation completes, then each broken element or failure surface is listed explicitly with scope and impact.
2. Given at least one issue is detected, when the user continues into the workspace, then valid data, graphs, and controls remain available while repair entry points stay attached to the broken items.
3. Given a repair is deferred, when the workspace remains open, then the unresolved issue persists in trust state and handoff readiness rather than disappearing from view.

Scope note: Story 1.5 is narrowed to currently deterministically detectable reopen failures. Semantic transform reopen validation and incompatible graph-composition or layer reopen validation are deferred to Story 1.6.

## Story 1.6: Complete Reopen Validation for Transforms and Graph Compositions

As a user,
I want reopened workspaces to localize stale transforms and incompatible graph compositions precisely,
so that I can trust which analytical elements are still valid before I continue or hand off the workspace.

Dependencies: Stories 1.2-1.5
Requirements: FR46, FR47, FR52, NFR7-NFR10, core graph catalog, reopen validation architecture

**Acceptance Criteria**

1. Given reopen validation needs transform semantics beyond a bare saved expression, when a workspace is saved and reopened, then the snapshot and validation contract preserve enough transform dependency metadata to detect and localize stale or invalid saved transform steps.
2. Given a reopened workspace contains a saved graph layer or overlay that violates the locked graph catalog or current analytical context, when reopen validation runs, then each incompatible composition is surfaced as a localized issue record attached to the affected graph scope while the last valid graph remains usable.
3. Given an older or partially valid workspace is reopened, when the expanded validation rules run, then migrations and compatibility handling avoid false positives and preserve unaffected valid state, repair actions, and readiness summaries.
4. Given transform or graph-composition reopen issues are deferred or resolved, when repair selectors and readiness surfaces update, then those issue states persist or clear consistently across reopen, continued work, and later handoff checks.

## Story 1.7: Provide Hosted-Shell Bootstrap Metadata For Local And Static Delivery

As a developer and release owner,
I want the hosted shell to obtain its bootstrap metadata from an owned thin delivery path,
so that a fresh clone can load the shell locally and deployed builds can reach a healthy shell state without ad hoc manual servers.

Dependencies: Stories 1.1, 1.2, and 1.4
Requirements: FR59, FR60, FR62, NFR15, NFR16, NFR18, NFR22, NFR24

**Acceptance Criteria**

1. Given a fresh clone, when the documented local start flow runs, then the hosted shell loads successfully without requiring an ad hoc manual mock server because schema-valid `GET /api/release-manifest` and `GET /api/support-matrix` responses are available to the shell and are sourced from the canonical Story 1.2 release/support contracts.
2. Given the shell is deployed as static assets, when the thin operational delivery path is provisioned, then `GET /api/release-manifest`, `GET /api/support-matrix`, and `GET /api/health` are served independently of the analytical runtime and without adding any dataset or workspace CRUD API.
3. Given shell metadata is version-sensitive, when release metadata or support facts change, then local-dev and hosted-delivery sources read from one canonical checked-in source or generation step so manifest/support-matrix drift is detected before release.
4. Given route-owned shell screens are part of the hosted-shell entry contract, when the local and hosted shell are exercised, then SPA fallback works for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported` while preserving readable workspace-format routing and fail-closed protected-route behavior.
5. Given shell delivery fails or becomes inconsistent, when bootstrap validation or smoke checks run, then the failure is surfaced as a delivery/setup error before users encounter an unexplained shell-error state in normal startup, including healthy shell home, readable workspace-format route, blocked unreadable workspace-format route, and canonical fail-closed protected-route coverage.

**In Scope**

- Thin bootstrap metadata provider for local dev/preview and hosted-shell delivery
- Canonical source or generation path for release manifest and support matrix payloads
- Health endpoint for the thin operational surface
- SPA fallback validation for shell routes
- Smoke coverage for healthy shell home, readable workspace-format route, blocked unreadable workspace-format route, and canonical fail-closed protected-route behavior

**Out Of Scope**

- Telemetry queue implementation and flush/retry behavior
- Release-shaping regression gates
- Production monitoring dashboards and alerting
- Shared auth, remote workspace storage, or any dataset/workspace network API

**Implementation Notes**

- The story may be implemented as a lightweight local/dev server, dev middleware, generated static JSON plus thin host wrapper, or an equivalent deployment-safe bootstrap path.
- The story should not move shell bootstrap ownership into the analytical client bundle.
- The story should not be treated as permission to add a backend for workspace or dataset persistence.

Epic 1 completion note: Stories 1.1-1.6 establish the client shell, persistence, and reopen trust behavior, but Epic 1 is not complete until Story 1.7 provides the thin hosted-shell delivery path needed for healthy local startup and deployable shell bootstrap.
