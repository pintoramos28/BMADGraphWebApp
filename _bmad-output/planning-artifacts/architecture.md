---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/product-brief-BMADGraphWebApp-2026-03-24.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/ux-design-specification.md
  - /home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd-validation-report-2026-04-06.md
  - /home/pin81845/repo/BMADGraphWebApp/docs/essential-graphing.parsed.txt
  - /home/pin81845/repo/BMADGraphWebApp/docs/essential-graphing.pdf
workflowType: 'architecture'
project_name: 'BMADGraphWebApp'
user_name: 'Pinto'
date: '2026-04-07T16:35:10-04:00'
lastStep: 8
status: 'complete'
completedAt: '2026-04-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- FR1–FR26 (import, semantic interpretation, lightweight prep) demand a local file/paste ingestion pipeline, schema inference service, and transformation engine that keep semantic metadata synced with the active dataset, previews, and downstream graphs.
- FR27–FR38 (graph building & visual analysis) require a role-aware visualization composer that supports multi-layer graphs, guarded combinations, and immediate feedback within 1 s, implying a client-side rendering engine with performant state diffing.
- FR39–FR42 (statistical insight) layer descriptive stats and at least one regression/fitting capability tied to the graph state, so the architecture needs a shared analytical context accessible to both charts and stats modules.
- FR43–FR49 (workspace persistence) emphasize durable, replayable analytical sessions: saved artifacts must capture datasets, semantic overrides, transforms, graphs, and warnings for reliable reopen/repair flows.
- FR50–FR58 (guidance, review, export) introduce contextual help, reviewer inspection, and export channels, meaning guidance/provenance services must plug into every stage without duplicating logic.

**Non-Functional Requirements:**
- Performance gates (NFR1–NFR5) enforce tight SLAs on import preview, graph edits, transformations, and reopen latency, shaping decisions around incremental computation, worker offloading, and optimistic UI.
- Reliability & data integrity (NFR6–NFR10) mandate isolation of failures, no unsignaled data loss, and compatibility across patch releases, so persistence formats and migration strategies need early definition.
- Accessibility (NFR11–NFR14) requires WCAG 2.1 AA compliance, keyboard parity, and textual alternatives for visual meaning, affecting component libraries, focus management, and graph annotation strategies.
- Browser compatibility (NFR15–NFR18) constrains us to desktop Chrome/Edge (plus stretch) with graceful unsupported-browser messaging.
- Security & data handling (NFR19–NFR21) insist on local-first processing and explicit user-initiated data transfers, limiting backend dependencies and telemetry content.

**Scale & Complexity:**
- Primary domain: scientific data visualization web application
- Complexity level: medium-high (rich client features plus strict NFRs)
- Estimated architectural components: 6 (data import/preview service, semantic/transform engine, visualization/stats engine, workspace persistence layer, guidance/provenance subsystem, telemetry/accessibility infrastructure)

### Technical Constraints & Dependencies

- Local-first, single-user workflow delivered through a centrally hosted shell: the server only serves static assets/config and ingests telemetry, while the client manages all datasets, semantics, and persistence locally to honor privacy requirements.
- Reproducibility and provenance: evidence overlays, drift detection, and reviewer trust cues require shared metadata services spanning data, transforms, and visual outputs.
- Telemetry without leaking data: instrumentation must capture timing/adoption metrics without transmitting raw datasets or formulas, aligning with PRD telemetry plan.
- Accessibility-first UX: every control (including drag/drop graph roles) needs keyboard access, screen-reader labels, and high-contrast themes informed by the UX spec.
- Essential Graphing parity: the JMP reference implies advanced chart types, multi-axis support, and analytical overlays that influence visualization component design choices.
- Offline-friendly storage: save/reopen artifacts must work locally while supporting versioned compatibility (per NFR10), influencing serialization format decisions.

### Cross-Cutting Concerns Identified

- Semantic state propagation: column roles, units, and transformations must stay consistent across tables, graphs, stats, exports, and provenance logs.
- Performance instrumentation & feedback: tight SLAs plus UX telemetry cues require a shared metrics bus feeding UI toasts and measurement storage.
- Accessibility & responsive layouts: Calm versus Investigative modes, evidence rail behavior, and mobile triage views demand a layout system that adapts without duplicating business logic.
- Workspace persistence & drift repair: save files must capture enough context to detect and isolate broken elements on reopen, with repair workflows spanning multiple components.
- Guidance and reviewer trust: contextual help, evidence overlays, and audit trails rely on shared descriptive metadata and rule engines across import, transforms, and visualization.
- Security boundaries: strict control over data egress and offline storage affects plugin strategy, telemetry sinks, and any future integration points.

## Starter Template Evaluation

### Primary Technology Domain

Hosted-shell analytical web application built with TypeScript + React, prioritizing browser-local execution, worker-heavy computation, offline durability, and static or thin-host deployment over server-rendered application logic.

### Starter Options Considered

1. **Vite 8 React + TS template (`create-vite`)** — Ships a minimal React/TypeScript scaffold on top of the current Vite toolchain, keeps the product aligned with browser-local execution, and avoids carrying a server runtime we do not need for the analytical workspace.
2. **Next.js 16.x App Router (`create-next-app`)** — Still offers an excellent hosted-shell framework when the shell itself needs deep server behavior, but it adds framework gravity around SSR, server routes, and deployment shape that no longer matches BMADGraphWebApp’s finalized local-first boundary.

### Selected Starter: Vite 8 React + TypeScript

**Rationale for Selection:**
- Aligns with the finalized product boundary: the shell is hosted, but the analytical workspace is browser-native and local-first. Vite gives us the fastest path to that shape without implying server ownership of workspace state.
- Vite 8’s unified Rolldown-based pipeline improves consistency between dev and production builds and keeps the toolchain focused on the client app, service worker, workers, and static asset graph.
- The starter stays intentionally thin, which is a benefit here. We need explicit control over routing, persistence, trust-state orchestration, and worker boundaries rather than inheriting server-framework conventions we intend not to use.
- Static-first output simplifies hosting, cache invalidation, offline support, and future separation between the UI artifact and any thin telemetry/bootstrap service.

**Initialization Command:**

```bash
npm create vite@latest bmad-graph-web -- --template react-ts
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript + React client application with an explicit browser-first execution model; no server-rendered application runtime is assumed by default.
- **Styling Solution:** The starter does not impose a design system. BMAD Mission Control tokens and Base UI wrappers remain first-class architectural choices rather than framework defaults.
- **Build Tooling:** Vite 8 handles development, production build, worker bundling, and preview in one toolchain, which matches our worker-heavy analytical client.
- **Testing/Linting:** The scaffold is intentionally minimal, so Vitest, Playwright, axe, and linting rules remain explicit follow-on decisions instead of hidden starter assumptions.
- **Code Organization:** Simple `/src` entry structure with explicit routing and feature boundaries added by the project, which fits our domain-driven module plan better than a framework-prescribed server/client split.
- **Development Experience:** Fast local startup, React Fast Refresh, first-class worker handling, and simple static preview reduce friction while keeping the hosted shell thin.

**Performance & Monitoring Notes (from Profiler Panel):**
- Use dedicated workers for import parsing, semantic inference, transforms, formulas, stats, and export packaging; Vite’s worker support keeps those bundles explicit and testable.
- Keep the shell static and aggressively cacheable so “offline ready” stays inside the 5-second UX target.
- Add React Router, Vitest, Playwright, Storybook, and PWA/service-worker support as explicit first implementation decisions rather than assuming them from the starter.
- Revisit embedded DuckDB only if browser-worker telemetry shows IndexedDB-backed analytical execution cannot meet benchmark targets.

## Hosted Shell Delivery & Offline Strategy

- **Topology:** CDN/static host serves the Vite-built shell bundle, service worker, manifest, and release metadata. A lightweight telemetry/bootstrap service may exist separately (edge function, worker, or thin API), but it is operational infrastructure rather than part of the analytical app runtime.
- **Service worker responsibilities:** Precache the shell bundle, fonts, and critical workers; advertise “offline ready” within 5 s; handle asset versioning with cache-busting and soft prompts (“Refresh to update”) when a new release is published.
- **Local workspace boundary:** All dataset I/O, transformations, and saved workspaces stay inside IndexedDB/File System Access API on the user’s machine. Shell APIs expose environment checks and update notices without uploading user files.
- **Telemetry buffering:** Client collects render timings/error events, writes them to an in-browser queue when offline, and flushes on reconnect via the telemetry endpoint. Payload schema excludes dataset rows, formulas, and workspace blobs.
- **Monitoring hooks:** CDN + telemetry endpoint emit availability metrics (target ≥99.5%), cache hit/miss ratios, and queue drain latency. Alerts fire when offline-ready time exceeds 5 s or telemetry backlog ages beyond an acceptable window.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- The canonical analytical workspace lives entirely in the browser. The hosted shell may deliver assets, release metadata, and telemetry ingestion, but it must never become the system of record for datasets, formulas, transforms, graph state, or saved workspaces.
- The reference graph is a first-class domain entity with explicit identity and lifecycle (`candidate`, `reference`, `stale`, `superseded`), separate from the currently active exploratory tab.
- Trust surfaces are domain-backed product modules, not local UI conveniences. Evidence Rail, Mission Log Panel, Repair Card, Handoff Readiness Panel, Telemetry Status Rail, and Workspace Snapshot Export Card all consume the same shared trust/state contracts.
- Save/reopen fidelity requires a snapshot-plus-ledger persistence model that preserves valid state, flags invalid state, and never silently drops broken analytical elements.
- Import parsing, semantic inference, transform recompute, formula validation, drift analysis, and export packaging must run off the main thread to protect the desktop interaction budgets.

**Important Decisions (Shape Architecture):**
- Verified runtime baseline: Vite 8.x with React 19.2, React Router 7.x, and Base UI v1.2.x as the supported hosted-shell foundation; Node.js 24 Active LTS is the preferred build/runtime baseline for CI and any thin operational services.
- Base UI is used only for primitives, focus management, and interaction behavior; BMAD Mission Control owns all application-facing styling, analytical semantics, and trust-specific components.
- MVP access control is perimeter-based (internal hosting and/or corporate SSO). There is no in-product multi-user auth, RBAC, or shared workspace authority model in the analytical client.
- Server APIs remain intentionally narrow: telemetry ingestion, release manifest/support matrix, health/status, and shell bootstrap config. No network API exists for user datasets or workspaces in MVP.
- Review mode is local and in-app. `/review/:workspaceId` represents the review presentation of a workspace that has been imported or reopened on the current machine; it does not imply shared remote review state.
- The locked MVP graph-family inventory, template IDs, overlay set, and major blocked combinations are defined in [core-graph-catalog.md](/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/core-graph-catalog.md) and must validate BMAD graph definitions before renderer compilation.
- Desktop authoring at `1200px+` is the required target. Tablet/mobile remain reduced-scope adaptations only when they reuse the desktop model without weakening it.

**Deferred Decisions (Post-MVP):**
- Multi-user collaboration, cloud workspace sync, or shared server-side review state
- Server-hosted analytical compute or DuckDB promotion beyond local-worker execution
- Signed or encrypted portable workspace packages beyond checksum/integrity validation
- External scientific system integrations (LIMS, ELN, remote compute, connected data sources)

### UX Reconciliation

- **Hosted shell with strict local-only boundary:** The starter now matches the intended delivery model directly. Browser-local storage is authoritative for analytical state; any server-side persistence is strictly operational and kept outside the analytical app.
- **Base UI only + BMAD Mission Control:** All user-visible meaning stays in BMAD wrappers and custom components. `@base-ui/react` is the only primitive layer.
- **Desktop is required:** Layout, interaction density, and performance budgets are optimized for `1200px+` and especially `1440px+`. Smaller breakpoints reduce capability instead of forcing shared lowest-common-denominator solutions.
- **Reference graph is first-class:** Architecture separates `activeGraphId` from `referenceGraphId`, preserves graph lineage, and routes evidence, handoff, and export context through the promoted reference graph rather than the frontmost tab.
- **Core product surfaces:** Evidence Rail, Mission Log, Repair Card, Handoff Readiness Panel, and Telemetry Status Rail each map to dedicated domain modules and persisted state, not ephemeral component state.
- **Trust, provenance, drift, and export readiness:** These concerns span state, persistence, worker computation, and interaction rules. They are implemented as shared contracts and validation pipelines, not post-hoc UI badges.

### Data Architecture

**Canonical workspace model**
- Define a versioned `WorkspaceSnapshot` as the single source of truth for dataset catalog, semantic schema, transform pipeline, formula dependency graph, graph views, `referenceGraphId`, evidence payloads, trust signals, mission-log summary, and export manifest.
- Store graph views as normalized entities (`graphId`, config, derived stats, overlays, provenance refs, trust refs) so exploratory tabs remain disposable while the reference graph remains stable and addressable.
- Treat provenance, repair state, and readiness state as domain data attached to workspace entities, not as UI annotations recomputed ad hoc.
- Mission Log and provenance records must use MVP origin labels rather than multi-user presence semantics. The baseline origin vocabulary is `user_action`, `system_inference`, `repair_action`, `workspace_import`, and `migration_or_version_check`.
- Each graph view must validate its `family`, `templateId`, role assignments, and overlays against the locked catalog before the `graph-runtime/*` adapter compiles a renderer-specific spec.

**Primary persistence strategy**
- Use IndexedDB as the primary structured store for snapshots, entities, queues, and indexes. The preferred implementation adapter is Dexie 4.2.x, but persistence APIs stay behind a repository boundary so the storage adapter can change without changing the domain model.
- Use the Origin Private File System for large imported-file copies, staged exports, parsed workbook fragments, and other large binary artifacts that benefit from in-place writes and worker access.
- Use the File System Access API only when the user explicitly opens or saves portable workspace files or source files from the local machine.

**Reopen, migration, and drift handling**
- Persist both a materialized snapshot and an append-only domain ledger. Snapshot hydration gives fast reopen; the ledger powers Mission Log, provenance history, drift replay, and repair suggestions.
- Every saved workspace carries a `workspace_format_version`, `app_build_version`, and compatibility envelope. Reopen first runs migrations, then validation, then drift analysis, and finally surfaces invalid elements as repairable issues instead of discarding them.
- Broken transforms, stale formulas, missing file handles, and incompatible graph layers remain attached to the workspace as flagged issue records so valid analytical state stays available.

**Validation and caching**
- Validate import payloads, workspace files, telemetry payloads, and worker contracts with shared runtime schemas before they mutate canonical state.
- Cache semantic inference, transform previews, role compatibility results, and statistical summaries in worker-local indexes keyed by dataset fingerprint + semantic version + graph config hash.
- Server-side caching is limited to shell assets, release metadata, and support-matrix responses. There is no server cache for user analytical data.

### Authentication & Security

**Access model**
- Enforce shell access outside the analytical domain model via corporate SSO, trusted network boundaries, or reverse-proxy policy. MVP does not introduce per-workspace users, collaboration roles, or server-backed ownership rules.
- Apply access checks, release gating, and cache-safe routing at the CDN, edge, or reverse-proxy layer rather than inside the client application bundle. That layer must not inspect or persist user workspace contents.

**Data protection rules**
- All outbound data transfer is allow-listed and explicit. Telemetry payloads may include timings, counts, readiness states, queue depth, browser/support-matrix facts, and anonymized error codes, but never raw dataset rows, formulas, workspaces, or evidence text.
- Portable exports include an integrity manifest (checksums over workspace snapshot + evidence ledger + export payload inventory) so reviewers can detect tampering or partial export corruption before trusting content.
- Reviewer notes and evidence text are stored as sanitized structured text/markdown subsets; imported workspace content is never rendered as arbitrary HTML.

**Browser/runtime hardening**
- Serve the hosted shell only over HTTPS, with strict CSP, Subresource Integrity, same-origin service worker scope, and explicit allowed origins for telemetry.
- Prefer secure-context-only browser capabilities (service worker, File System API) and publish a support matrix that blocks unsupported environments before meaningful work begins.
- Keep secrets server-side only. Client configuration exposes only public endpoint URLs, release metadata, and support-matrix facts.

### API & Communication Patterns

**Hosted-shell API surface**
- Use a minimal JSON-over-HTTPS operational surface, implemented independently of the UI bundler:
  - `POST /api/telemetry`
  - `GET /api/release-manifest`
  - `GET /api/support-matrix`
  - `GET /api/health`
- Do not introduce GraphQL, general-purpose BFF endpoints, or dataset/workspace CRUD APIs in MVP because they directly conflict with the local-only workspace boundary.

**Contract and error standards**
- Version every network payload and every worker message envelope explicitly.
- Use a single error envelope for server APIs and worker replies with `code`, `title`, `detail`, `severity`, `retryable`, and `contextRef` fields so Repair Cards can deep-link back to the failing graph, transform, or evidence item.
- Separate user-actionable errors from operational diagnostics. UI copy stays plain-language while diagnostic detail remains available for logs and expanded panels.

**Client-worker communication**
- Analytical subsystems communicate through typed command/event channels rather than direct shared mutable state.
- Dedicated workers own import parsing, semantic inference, transform execution, formula recompute, stats generation, drift analysis, and export packaging.
- Each worker command includes correlation IDs and workspace version stamps so stale replies cannot overwrite newer state.

### Frontend Architecture

**Application split**
- Use Vite to build a client-first hosted shell and analytical workspace. The initial shell is served as static assets; architecture does not depend on SSR.
- Use React Router 7 for shell/workspace navigation, keeping route concerns explicit and decoupled from the bundler.
- The analytical workspace is a browser-local application bootstrapped after shell load, with persistence and workers handling all data-heavy execution.

**State management**
- Implement a two-layer client state model:
  - `WorkspaceKernel`: a vanilla Zustand 5 store containing canonical workspace entities, command handlers, derived selectors, and optimistic state transitions
  - `ViewState`: lightweight UI-only state for panel openness, transient selections, focus return targets, and non-persisted inspection affordances
- `activeGraphId` and `referenceGraphId` are separate selectors with explicit promotion commands. Promotion emits a structural event that updates Evidence Rail, Mission Log, Handoff Readiness, and export summary together.
- Telemetry, provenance completeness, unresolved issues, and drift status are computed selectors over canonical state so every trust surface stays synchronized.

**Component and module boundaries**
- Organize the client by domain feature modules, not by primitive type: `import`, `semantics`, `graph-workspace`, `reference-graph`, `evidence`, `mission-log`, `repair`, `handoff`, `telemetry`, `export`, `workspace-persistence`.
- Build BMAD Mission Control wrappers for shared controls first, then implement custom domain components for Semantic Role Dock, Evidence Rail, Repair Card, Mission Log Panel, Handoff Readiness Panel, Telemetry Status Rail, and Workspace Snapshot Export Card.
- Keep all rich analytical semantics out of generic design-system wrappers. Product-specific meaning lives only in feature/domain modules.

**Performance strategy**
- Move all high-cost analytical work into dedicated workers and stream progress back as structured status events.
- Use React 19.2 concurrency features deliberately: `startTransition` for graph promotion/view swaps, `useDeferredValue` for search/filter surfaces, and `useEffectEvent` for worker and telemetry listeners that should not retrigger subscriptions.
- Virtualize large field lists, tables, mission-log timelines, and evidence streams. Lazy-load heavy parsers and stretch-only layouts so they do not burden the primary desktop path.

### Infrastructure & Deployment

**Hosting strategy**
- Deploy the hosted shell as static `dist` assets behind HTTPS and CDN caching.
- Treat any telemetry/bootstrap service as a separate operational component so the UI artifact can remain portable across static hosts and internal delivery platforms.
- If operational persistence is required for telemetry ingestion durability, use a small purpose-built store behind the telemetry collector only; keep it outside the analytical workspace boundary.

**CI/CD and quality gates**
- Build immutable assets, publish cache-busted bundles, and validate service-worker upgrade paths on every release candidate.
- Require CI coverage for:
  - workspace save/reopen fidelity on benchmark artifacts
  - worker contract validation and migration tests
  - Playwright desktop flows for import, graph authoring, graph promotion, evidence review, handoff readiness, and export
  - axe accessibility scans and keyboard-only walkthrough coverage on trust-critical flows
  - offline-ready, update-prompt, and telemetry-queue regression checks

**Operational monitoring**
- Monitor CDN availability, shell bootstrap timing, offline-ready timing, telemetry queue age, service-worker activation failures, worker crash rates, and reopen latency on benchmark workspaces.
- Separate operational metrics from product telemetry. Operational metrics describe shell health; product telemetry describes anonymous workflow timing and readiness states.
- Treat queue growth, cache invalidation failures, and reopen regression on benchmark workspaces as release-blocking signals, not observability nice-to-haves.

### Decision Impact Analysis

**Implementation Sequence**
1. Define the versioned workspace schema, domain event taxonomy, and trust/readiness contracts.
2. Build browser-local persistence repositories (IndexedDB + OPFS) and migration/reopen validation.
3. Implement worker contracts for import, transforms, formulas, stats, drift, and export packaging.
4. Stand up the `WorkspaceKernel` store with separate `activeGraphId` and `referenceGraphId`.
5. Build graph workspace and reference-graph promotion flow.
6. Build trust surfaces on top of shared selectors: Telemetry Status Rail, Evidence Rail, Repair Card, Mission Log, Handoff Readiness, Export Card.
7. Add hosted-shell routing, service worker lifecycle, release metadata, and telemetry ingestion.
8. Harden desktop performance, accessibility, and support-matrix enforcement before any serious tablet/mobile adaptation.

**Cross-Component Dependencies**
- Reference graph promotion is the pivot event that synchronizes graph workspace, Evidence Rail, Mission Log, Handoff Readiness, and export summary.
- Drift analysis depends on persistence metadata, formula graph validity, source-file handle availability, and transform lineage; it cannot be implemented as a graph-only concern.
- Repair flows depend on shared error envelopes from workers, persistence validation, and readiness rules so users can recover in place without losing unrelated state.
- Export readiness depends on provenance completeness, unresolved issue state, telemetry health snapshot, and reference graph identity; it is not a final-screen-only check.

## Decision Review After Vite Revision

### Decisions Changed

- **Starter platform:** Changed from Next.js App Router to Vite 8 React + TypeScript.
- **Routing ownership:** Routing is now an explicit application decision via React Router 7, not a framework-provided file-system convention.
- **Shell deployment shape:** The shell is now static-first by default, with optional thin operational services separated from the UI artifact.
- **Operational boundary:** Any server component is now framed as infrastructure for telemetry, release metadata, and access control, not part of the analytical application runtime.

### Decisions Confirmed

- **Browser-local workspace kernel stays authoritative.**
- **Reference graph remains a first-class domain entity.**
- **Evidence Rail, Mission Log, Repair Card, Handoff Readiness, and Telemetry Status Rail remain core product surfaces backed by shared state contracts.**
- **Snapshot-plus-ledger persistence remains the correct save/reopen model.**
- **Worker-first execution remains necessary for import, transform, stats, drift, and export workloads.**
- **Base UI plus a custom BMAD Mission Control layer remains the right component strategy.**
- **Desktop-first, reduced-capability smaller breakpoints remain the correct responsive strategy.**
- **No server-side dataset/workspace APIs remain in scope for MVP.**

### Decisions Refined

- **Telemetry ingestion:** keep it minimal and operationally separate so Vite remains a true shell choice, not the start of a new backend.
- **Support-matrix enforcement:** publish and enforce it at shell bootstrap, before users begin meaningful local work.
- **Testing stack:** pair Vitest for unit/store/worker testing with Playwright for full desktop workflow validation.
- **Future server features:** if later phases require collaboration or hosted compute, they should be added as new architecture decisions rather than quietly reintroducing server ownership into the MVP shell.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
12 areas where AI agents could make incompatible choices unless patterns are fixed up front: workspace naming, route naming, file naming, module boundaries, test placement, worker contracts, event taxonomy, error envelopes, persistence schema shape, telemetry payload shape, loading-state semantics, and trust/readiness state handling.

### Naming Patterns

**Persistence / schema naming conventions:**
- Workspace snapshot fields use `camelCase` in TypeScript and persisted JSON.
- Version fields use explicit names: `workspaceFormatVersion`, `appBuildVersion`, `schemaVersion`.
- Entity IDs use `<entityType>Id` naming, e.g. `graphId`, `referenceGraphId`, `workspaceId`.
- Enum-like status values use lowercase string literals, e.g. `reference`, `candidate`, `stale`, `blocked`.
- Integrity/hash fields use `sha256`-prefixed names where relevant, e.g. `sha256Digest`.

**API naming conventions:**
- Operational endpoints remain noun-based and kebab-free: `/api/telemetry`, `/api/release-manifest`, `/api/support-matrix`, `/api/health`.
- Route params use `:paramName` in router definitions and `camelCase` names in code.
- Query params use `camelCase`.
- HTTP headers use standard header casing; custom headers use `X-Bmad-*` only when unavoidable.

**Code naming conventions:**
- React components: `PascalCase`.
- Hooks: `useCamelCase`.
- Store actions/selectors/functions/variables: `camelCase`.
- File names:
  - React components and hooks: `PascalCase.tsx` or `useThing.ts`
  - Non-component modules: `kebab-case.ts`
  - Worker entry files: `thing.worker.ts`
  - Test files: `*.test.ts` / `*.test.tsx`
- Event names use dotted lowercase domains, e.g. `workspace.loaded`, `graph.promoted`, `repair.resolved`.

### Structure Patterns

**Project organization:**
- Organize by feature/domain, not by technical type.
- Top-level feature modules:
  `import`, `semantics`, `graph-workspace`, `reference-graph`, `evidence`, `mission-log`, `repair`, `handoff`, `telemetry`, `export`, `workspace-persistence`.
- Shared cross-feature code belongs only in explicit shared areas such as `ui`, `lib`, `schemas`, `workers`, `stores`, `router`.
- Base UI wrappers live in shared UI layers; BMAD-specific components live in feature modules.

**File structure patterns:**
- Co-locate tests with the module they validate unless they are full workflow/e2e tests.
- Worker message schemas live beside the worker contract, not duplicated in callers.
- Route definitions live in a single router area, while route-owned screens live in feature modules.
- Static assets live under a single assets/public strategy; generated/export artifacts never live beside source code.
- Architecture and workflow docs remain under planning artifacts, not mixed into app source.

### Format Patterns

**API response formats:**
- Success responses from operational APIs use:
  `{ ok: true, data, meta? }`
- Error responses use:
  `{ ok: false, error: { code, title, detail, severity, retryable, contextRef? } }`
- Never mix success and error fields in the same shape.
- All timestamps in network payloads use ISO 8601 UTC strings.

**Data exchange formats:**
- Persisted workspace JSON uses `camelCase`.
- Booleans remain `true` / `false`, never `1` / `0`.
- Missing optional values use `null` only when semantically meaningful; otherwise omit.
- Single entities stay objects, not single-item arrays.
- Worker message envelopes use:
  `{ messageId, correlationId, workspaceVersion, type, payload }`

### Communication Patterns

**Event system patterns:**
- Domain events are facts, not commands: `graph.promoted`, not `promoteGraph`.
- Commands are imperative function/action names; events are past-tense domain records.
- Events must include entity refs and causality context when relevant.
- Worker events must be versioned through the message schema, not ad hoc string changes.

**State management patterns:**
- `WorkspaceKernel` owns canonical persisted analytical state.
- `ViewState` owns ephemeral UI state only.
- No feature may duplicate canonical graph, evidence, readiness, or telemetry state in local component state.
- Selectors derive trust/readiness status from canonical state instead of storing duplicate booleans.
- State updates are immutable and flow through named actions/commands.

### Process Patterns

**Error handling patterns:**
- All recoverable analytical failures produce structured issue records that can feed a Repair Card.
- User-facing copy stays plain-language; diagnostic detail is expandable and machine-readable.
- Trust-critical failures must preserve valid unaffected state.
- Error boundaries protect route/surface shells, but domain validation still happens before persistence or promotion.
- Logging and telemetry must never include raw dataset values, formulas, or workspace payloads.

**Loading state patterns:**
- Loading states distinguish `notStarted`, `loading`, `ready`, `degraded`, `blocked`, and `error`.
- Long-running analytical operations report progress through worker status events.
- Loading UI must preserve surrounding context; do not replace the whole workspace for a local recompute.
- Reference-graph loading and no-reference state are distinct and must never share copy or visuals.
- Persist only meaningful queued/offline operational state, not transient spinners.

### Enforcement Guidelines

**All AI Agents MUST:**
- Treat browser-local workspace state as authoritative.
- Keep `activeGraphId` and `referenceGraphId` separate.
- Use shared schemas for persistence, worker messages, telemetry payloads, and operational API envelopes.
- Build new trust-facing UI only on top of shared selectors and issue records.
- Add tests when changing schema, worker contracts, promotion logic, repair logic, or export readiness logic.

**Pattern enforcement:**
- Shared schemas and types are the source of truth for contracts.
- CI should fail on schema drift, type drift, broken worker contracts, and trust-surface regressions.
- Pattern changes require updating the architecture document first, then shared schemas/utilities, then feature code.
- Violations are fixed by consolidation, not by introducing another local convention.

### Pattern Examples

**Good examples:**
- `workspace-persistence/saveWorkspace.ts`
- `reference-graph/actions/promoteReferenceGraph.ts`
- `workers/drift-analysis.worker.ts`
- `schemas/worker/DriftAnalysisMessage.ts`
- `mission-log/selectors/selectMissionLogEntries.ts`

**Anti-patterns:**
- Duplicating readiness booleans in multiple components.
- Letting Evidence Rail follow the active tab instead of the reference graph.
- Mixing worker error shapes across modules.
- Adding dataset/workspace CRUD APIs to the server for convenience.
- Storing trust-critical domain state only inside component-local state.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
BMADGraphWebApp/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── .gitignore
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── e2e.yml
│       └── release-shell.yml
├── public/
│   ├── manifest.webmanifest
│   ├── favicon.ico
│   ├── icons/
│   └── offline/
│       └── shell-fallback.html
├── scripts/
│   ├── support-matrix.mjs
│   ├── benchmark-workspaces.mjs
│   ├── validate-workspace-schema.mjs
│   └── release-manifest.mjs
├── docs/
│   ├── essential-graphing.pdf
│   ├── essential-graphing.parsed.txt
│   ├── support-matrix.md
│   ├── telemetry-schema.md
│   └── workspace-format.md
├── _bmad/
│   └── ...
├── _bmad-output/
│   └── ...
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── providers/
│   │   │   ├── RouterProvider.tsx
│   │   │   ├── QueryProvider.tsx
│   │   │   └── AccessibilityProvider.tsx
│   │   ├── router/
│   │   │   ├── routes.tsx
│   │   │   ├── ShellLayout.tsx
│   │   │   ├── WorkspaceRoute.tsx
│   │   │   ├── ReviewRoute.tsx
│   │   │   └── UnsupportedEnvironmentRoute.tsx
│   │   └── boot/
│   │       ├── bootstrapApp.ts
│   │       ├── loadReleaseManifest.ts
│   │       ├── detectEnvironment.ts
│   │       └── registerServiceWorker.ts
│   ├── ui/
│   │   ├── base/
│   │   ├── mission-control/
│   │   └── shared/
│   ├── domain/
│   │   ├── entities/
│   │   ├── events/
│   │   ├── provenance/
│   │   ├── issues/
│   │   ├── readiness/
│   │   ├── reference-graph/
│   │   └── trust/
│   ├── lib/
│   │   ├── env/
│   │   ├── formatting/
│   │   ├── integrity/
│   │   ├── logging/
│   │   └── browser/
│   ├── schemas/
│   │   ├── workspace/
│   │   ├── worker/
│   │   ├── api/
│   │   └── validation/
│   ├── stores/
│   │   ├── workspace-kernel/
│   │   │   ├── store.ts
│   │   │   ├── actions/
│   │   │   ├── selectors/
│   │   │   │   └── trust/
│   │   │   ├── reducers/
│   │   │   └── events/
│   │   └── view-state/
│   │       ├── store.ts
│   │       ├── actions/
│   │       └── selectors/
│   ├── workers/
│   │   ├── import.worker.ts
│   │   ├── semantics.worker.ts
│   │   ├── transforms.worker.ts
│   │   ├── formulas.worker.ts
│   │   ├── stats.worker.ts
│   │   ├── drift-analysis.worker.ts
│   │   ├── export.worker.ts
│   │   └── shared/
│   │       ├── postWorkerMessage.ts
│   │       ├── workerError.ts
│   │       └── workerProgress.ts
│   ├── features/
│   │   ├── import/
│   │   ├── semantics/
│   │   ├── graph-workspace/
│   │   ├── reference-graph/
│   │   ├── evidence/
│   │   ├── mission-log/
│   │   ├── repair/
│   │   ├── handoff/
│   │   ├── telemetry/
│   │   ├── export/
│   │   └── workspace-persistence/
│   ├── services/
│   │   ├── telemetry/
│   │   ├── release/
│   │   └── persistence/
│   ├── styles/
│   │   ├── globals.css
│   │   ├── tokens.css
│   │   └── motion.css
│   └── test/
│       ├── fixtures/
│       ├── mocks/
│       ├── benchmark-workspaces/
│       └── accessibility/
├── tests/
│   ├── e2e/
│   │   ├── import.spec.ts
│   │   ├── graph-promotion.spec.ts
│   │   ├── evidence-rail.spec.ts
│   │   ├── handoff-readiness.spec.ts
│   │   └── export.spec.ts
│   └── integration/
│       ├── workspace-reopen.test.ts
│       ├── telemetry-queue.test.ts
│       └── worker-contracts.test.ts
└── operational/
    ├── telemetry-service/
    │   ├── README.md
    │   ├── package.json
    │   └── src/
    └── release-metadata/
        └── manifest.json
```

### Architectural Boundaries

**API Boundaries:**
- The browser app owns analytical workflows, local persistence, graph state, and trust-state rendering.
- Operational APIs are limited to telemetry, release manifest, support matrix, and health checks.
- No API may accept uploaded datasets, workspace snapshots, formulas, evidence text, or graph payloads in MVP.

**Component Boundaries:**
- `ui/base` wraps Base UI primitives only.
- `ui/mission-control` owns BMAD visual language and layout primitives.
- `features/*` own product semantics and user workflows.
- `stores/workspace-kernel` owns canonical analytical state.
- `stores/view-state` owns ephemeral shell/panel state only.
- Trust surfaces must read from shared selectors and domain trust rules, not from local component copies.

**Service Boundaries:**
- `services/persistence` is the only path to IndexedDB, OPFS, and File System Access.
- `services/telemetry` is the only path to outbound telemetry transport.
- `services/release` is the only path to release/support-matrix fetches.
- Worker entrypoints own heavy computation; features do not implement analytical computation directly in components.

**Data Boundaries:**
- `domain/` owns pure analytical meaning, issue logic, provenance rules, readiness rules, reference-graph rules, and trust rules.
- `schemas/workspace` defines persisted workspace shape.
- `schemas/worker` defines all worker message contracts.
- `schemas/api` defines operational network contracts.
- `schemas/validation` defines shared validators where needed.
- Features consume schemas and domain rules; they do not invent parallel local payload types.

### Requirements to Structure Mapping

**FR1–FR14 Import & data ingestion:**
- `features/import/`
- `workers/import.worker.ts`
- `services/persistence/fs-access/`
- `schemas/worker/ImportMessages.ts`
- `tests/e2e/import.spec.ts`

**FR15–FR26 Semantics, prep, formulas, repairable transforms:**
- `features/semantics/`
- `features/repair/`
- `workers/semantics.worker.ts`
- `workers/transforms.worker.ts`
- `workers/formulas.worker.ts`
- `domain/issues/`

**FR27–FR38 Graph building & visual analysis:**
- `features/graph-workspace/`
- `features/reference-graph/`
- `stores/workspace-kernel/`
- `schemas/workspace/GraphView.ts`
- `tests/e2e/graph-promotion.spec.ts`

**FR39–FR42 Statistical insight:**
- `workers/stats.worker.ts`
- `features/graph-workspace/`
- `features/evidence/`

**FR43–FR49 Save/reopen, drift, resilience:**
- `features/workspace-persistence/`
- `services/persistence/repositories/`
- `workers/drift-analysis.worker.ts`
- `domain/readiness/`
- `domain/trust/`
- `tests/integration/workspace-reopen.test.ts`

**FR50–FR58 Guidance, provenance, review, export:**
- `features/evidence/`
- `features/mission-log/`
- `features/handoff/`
- `features/export/`
- `workers/export.worker.ts`
- `domain/provenance/`
- `domain/trust/`
- `tests/e2e/evidence-rail.spec.ts`
- `tests/e2e/handoff-readiness.spec.ts`
- `tests/e2e/export.spec.ts`

**FR59–FR62 Hosted shell, offline readiness, update behavior:**
- `src/app/boot/`
- `services/release/`
- `services/telemetry/`
- `public/manifest.webmanifest`
- `scripts/support-matrix.mjs`
- `tests/integration/telemetry-queue.test.ts`

### Integration Points

**Internal Communication:**
- Features dispatch named actions into `WorkspaceKernel`.
- Long-running actions hand work to dedicated workers through typed message schemas.
- Workers return structured success, progress, and error envelopes.
- Trust surfaces subscribe through selectors backed by shared trust rules.

**External Integrations:**
- Telemetry service receives anonymized operational events only.
- Release metadata endpoint provides support matrix and update metadata.
- Browser APIs used directly: IndexedDB, OPFS, File System Access API, Service Worker API.

**Data Flow:**
- Import data enters through `features/import` → worker parsing → validation → domain normalization → `WorkspaceKernel`.
- Analytical changes update canonical state → trust/readiness selectors recompute → affected features rerender.
- Save/export flows snapshot canonical state + ledger → persistence/export workers → local file output.
- Telemetry flows from local event queue → `services/telemetry` → operational endpoint when online.

### File Organization Patterns

**Configuration Files:**
- Root-level tool configs only: Vite, TypeScript, Vitest, Playwright, ESLint.
- Environment examples are committed; real secrets/config stay outside source control.
- Operational-service config stays inside `operational/`, not mixed into app config.

**Source Organization:**
- `src/app` for shell bootstrap and routing.
- `src/features` for domain workflows.
- `src/domain` for product meaning and trust/readiness rules.
- `src/stores` for canonical and view state.
- `src/workers` for compute execution.
- `src/schemas` for cross-boundary contracts.
- `src/services` for external/browser infrastructure access.
- `src/ui` for primitives and presentation layers.

**Test Organization:**
- Co-located unit tests inside feature/service/store folders where helpful.
- Cross-feature integration tests under `tests/integration/`.
- Full workflow desktop tests under `tests/e2e/`.
- Benchmark and reopen fixtures under `src/test/fixtures/` and `src/test/benchmark-workspaces/`.

**Asset Organization:**
- Static shell assets in `public/`.
- Product icons and manifest assets under `public/icons/`.
- No analytical user artifacts are stored in repo directories.
- Export output is runtime-only and local-machine only.

### Development Workflow Integration

**Development Server Structure:**
- Vite serves the client app.
- Optional operational telemetry/bootstrap service runs independently when needed.
- Workers, service worker, and browser-local persistence are exercised in dev without requiring a full backend.

**Build Process Structure:**
- Vite builds the client shell into `dist/`.
- Static assets and service worker are emitted with the client build.
- Operational service, if present, is built and deployed separately.
- Contract validation scripts run before build promotion.

**Deployment Structure:**
- `dist/` deploys to CDN/static hosting.
- `operational/telemetry-service` deploys independently if enabled.
- Release metadata can be published as static JSON or via thin operational service without changing the client architecture.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- The Vite 8 + React 19.2 + React Router 7 + Base UI v1.2.x stack is internally coherent for a hosted-shell, browser-local analytical workspace.
- The local-first boundary is consistent across storage, API, telemetry, and deployment decisions: datasets, formulas, transformations, and workspace artifacts stay local unless explicitly exported.
- Worker-first execution aligns with the performance requirements and trust/recovery model because expensive analytical operations are isolated from the main UI thread.
- The Vite revision removed earlier server-runtime ambiguity. The architecture no longer depends on SSR, server routes, or framework-owned persistence assumptions.
- Security, telemetry, and deployment decisions are compatible with the hosted shell model: static shell delivery plus thin operational capabilities is consistent with FR59–FR62 and NFR19–NFR24.

**Pattern Consistency:**
- Naming, schema, API, worker, and state patterns reinforce the core architecture instead of contradicting it.
- The split between `WorkspaceKernel` and `ViewState` supports the requirement that trust-critical analytical state not drift into ephemeral UI state.
- Event naming, worker message envelopes, and error envelope rules are compatible with the feature/module and trust-surface decisions.
- The advanced elicitation refinements improved consistency by clarifying `domain/`, tightening `schemas/`, making trust aggregation explicit, and turning remaining ambiguity points into explicit mini-decisions.

**Structure Alignment:**
- The project structure supports the architecture’s major seams: feature workflows, worker computation, browser-local persistence, trust aggregation, and operational shell concerns.
- Boundaries are explicit enough to guide multiple AI agents without encouraging parallel local conventions.
- Requirements mapping, store ownership, worker boundaries, and trust-surface dependencies all align with the chosen structure.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
- Import, semantic correction, lightweight prep, graph authoring, statistical support, persistence/reopen, trust/review, export, and hosted-shell concerns all have explicit architectural homes.
- Cross-feature dependencies are handled through shared schemas, worker contracts, canonical state ownership, and trust selectors rather than implicit coupling.

**Functional Requirements Coverage:**
- FR1–FR14 are supported by import flows, semantic structures, and dataset/workspace visibility decisions.
- FR15–FR26 are supported by transform/formula workers, repair flows, ordered transformations, and undo-friendly state ownership.
- FR27–FR38 are supported by graph-workspace and reference-graph modules, role assignment patterns, guarded combinations, and graph-layer architecture.
- FR39–FR42 are supported by dedicated stats execution and graph-tied analytical context.
- FR43–FR49 are strongly supported by the snapshot-plus-ledger persistence model, migrations, drift analysis, and reopen repair behavior.
- FR50–FR58 are supported by Evidence Rail, Mission Log, Repair Card, Handoff Readiness, export, provenance, units/metadata handling, and trust rules.
- FR59–FR62 are supported by the hosted shell, service worker, release/support matrix, telemetry queue, and strict local-only workspace boundary.

**Non-Functional Requirements Coverage:**
- NFR1–NFR5 are addressed through worker isolation, benchmark validation, virtualization, and explicit progress/degradation behavior.
- NFR6–NFR10 are addressed through snapshot-plus-ledger persistence, migration/versioning, localized failure handling, and explicit drift/repair states.
- NFR11–NFR14 are addressed through desktop-first accessibility rules, Base UI primitive strategy, keyboard parity requirements, and trust-state text alternatives.
- NFR15–NFR18 are addressed through the support-matrix publication and bootstrap gating decisions.
- NFR19–NFR24 are directly addressed through the local-only boundary, explicit outbound transfer rules, offline-ready shell architecture, and operational monitoring plan.

### Implementation Readiness Validation ✅

**Decision Completeness:**
- Critical architectural decisions are documented with concrete technologies and rationale.
- The Vite revision is fully integrated through starter choice, shell topology, API boundary, frontend structure, and deployment model.
- Trust, provenance, drift handling, reference-graph ownership, and export readiness are documented as architectural concerns rather than left to implementation interpretation.

**Structure Completeness:**
- The proposed project tree is specific enough to start implementation.
- Module ownership is clear for features, workers, stores, domain rules, schemas, UI, and operational concerns.
- Internal and external integration points are defined with sufficient clarity for agent implementation.

**Pattern Completeness:**
- Major conflict points for multiple AI agents are covered: naming, file structure, schemas, worker contracts, events, error handling, loading semantics, and trust-state ownership.
- The addition of `domain/` and trust aggregation reduces ambiguity materially.
- Pattern enforcement expectations are clear enough for CI and implementation review.

### Gap Analysis Results

**Critical Gaps:**
- None identified that block implementation kickoff.

**Important Gaps:**
- Canonical route constants still need to be authored in implementation, but the architecture now fixes the route inventory.
- Service worker ownership is architecturally resolved, but implementation still needs explicit code-level lifecycle boundaries and payload examples.
- Workspace snapshot, ledger, issue record, release manifest, and telemetry payload examples should be authored early to lock down contracts.

**Nice-to-Have Gaps:**
- A dedicated workspace-format companion document would help future migrations and reviewer confidence.
- A small ADR set for route policy, telemetry policy, and service-worker ownership could be extracted from this validation section into standalone artifacts later.
- Example operational payloads would further speed implementation.

### Validation Issues Addressed

- The earlier Next.js/server-runtime assumptions were removed and replaced with a Vite-aligned shell model.
- Project structure ambiguity around domain logic versus schema contracts was addressed by introducing `src/domain/`.
- Trust-surface consistency risk was addressed by making trust aggregation explicit rather than implied.
- Remaining implementation ambiguity around client data-fetching, routing, service-worker ownership, and operational capability shape was converted into explicit validation decisions rather than left as informal guidance.
- No unresolved contradictions remain between the starter choice, delivery model, implementation patterns, and project structure.

### Validation Refinements from Critical Review

**React Query downgraded from baseline**
- `QueryProvider` should not be treated as mandatory architecture by default.
- The MVP operational API surface is small enough that direct service calls plus local store coordination are the baseline.
- React Query should be introduced only if implementation demonstrates real need for caching, retries, or request lifecycle coordination beyond simple shell metadata fetches.

**Canonical route inventory required**
- Define the canonical route set as:
  - `/`
  - `/workspace`
  - `/workspace/:workspaceId`
  - `/review/:workspaceId`
  - `/unsupported`
- Additional routes should require explicit architectural review rather than appearing opportunistically in feature work.

**Service worker ownership clarified**
- Shell bootstrap owns service worker registration.
- The service worker owns precache strategy, runtime asset caching, and update detection hooks.
- Telemetry queue ownership remains in the application/service layer unless explicitly moved later.
- Update prompts and offline-ready UI belong to shell status surfaces, not individual feature modules.

**Operational capability shape downgraded**
- The architecture requires operational telemetry/release capability.
- It does not require a first-party `operational/telemetry-service/` subtree or a fixed implementation shape at this stage.
- Static-host delivery plus separately chosen operational plumbing remains valid.

**Contract-first emphasis**
- The most important architectural assets are:
  - `schemas/workspace/`
  - `schemas/worker/`
  - `domain/issues/`
  - `domain/trust/`
  - `domain/provenance/`
  - `stores/workspace-kernel/selectors/trust/`
- The directory tree supports those decisions, but does not replace them.
- If there is tension between preserving the tree and preserving contract consistency, contract consistency wins.

**Readiness interpretation tightened**
- `READY FOR IMPLEMENTATION` means ready for structured implementation kickoff.
- It does not mean every low-level contract example or constant has already been authored.
- Early implementation must still lock down:
  - example workspace snapshot
  - example workspace ledger entries
  - example issue record payloads
  - example release manifest payload
  - example telemetry payload
  - canonical route constants

### ADR-Style Validation Decisions

**ADR-01: Client data-fetching baseline**
- Baseline architecture uses direct service calls + local store coordination.
- React Query is optional and must be introduced only by explicit follow-up decision.

**ADR-02: Canonical route inventory**
- Canonical routes are:
  - `/`
  - `/workspace`
  - `/workspace/:workspaceId`
  - `/review/:workspaceId`
  - `/unsupported`
- `/review/:workspaceId` is a local review-mode route for reopened or imported workspaces on the current machine.

**ADR-03: Service worker ownership**
- Shell bootstrap owns registration.
- Service worker owns precache strategy, runtime asset caching, and update detection hooks.
- Telemetry queue remains in application/service code unless later architecture changes that boundary.
- Offline-ready and update UX belongs to shell status surfaces.

**ADR-04: Operational capability shape**
- The architecture requires operational telemetry/release capability.
- It does not require a first-party repo subtree or service implementation shape at this stage.

**ADR-05: Readiness interpretation**
- Keep status as `READY FOR IMPLEMENTATION`.
- Explicitly define it as ready for implementation kickoff with contract-first sequencing.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Strong alignment between UX requirements and architectural decisions
- Clear local-first boundary with minimal server ambiguity
- First-class trust/provenance/drift/reference-graph treatment
- Good multi-agent implementation discipline through patterns and structure
- Coherent hosted-shell + offline-ready delivery model

**Areas for Future Enhancement:**
- Author example contract payloads and workspace-format companion docs
- Extract standalone ADRs if implementation introduces meaningful route or service-worker complexity
- Reassess React Query only if the operational API surface grows meaningfully

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
- Initialize the application using:
  `npm create vite@latest bmad-graph-web -- --template react-ts`
- Then establish the workspace schema, worker contracts, canonical route constants, service worker lifecycle ownership, and `WorkspaceKernel` before feature UI expansion
