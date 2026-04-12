---
stepsCompleted:
  - 1
  - 2
  - 3
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

Local-first analytical web application built with TypeScript + React, requiring SSR for fast import/graph loops, Docker-based self-hosting, and headroom for embedded persistence engines.

### Starter Options Considered

1. **Next.js 16.2 App Router (`create-next-app`)** — Ships Server Components, Route Handlers, 400% faster `next dev`, Server Fast Refresh, SRI, browser log forwarding, and agent-aware scaffolding in the default TypeScript template, making it a strong fit for SSR-heavy, AI-assisted workflows.
2. **Vite 8 React + TS template** — Gains Rolldown (Rust) bundler for 10–30× faster production builds and unified dev/prod behavior, but leaves routing, SSR, and persistence decisions entirely manual, increasing lift for BMADGraphWebApp’s guided workflow.

### Selected Starter: Next.js 16.2 App Router + SQLite/LibSQL

**Rationale for Selection:**
- Aligns with the mandated TypeScript + React stack while providing built-in SSR, streaming, Route Handlers, Subresource Integrity, and AI-ready tooling we can leverage for telemetry and provenance features.
- Turbopack + Server Fast Refresh accelerate developer feedback loops, keeping the architecture responsive during the long import→semantic→graph workflow.
- Official CLI flags scaffold Tailwind, ESLint, `/src` structure, and import aliases out of the box, shrinking boilerplate and mirroring our UX token/spacing system.
- Choosing SQLite/LibSQL keeps transactional persistence lightweight, ACID-safe, and Docker-friendly; we will revisit embedded DuckDB once telemetry shows >500 ms median analytical queries or >5 s import previews on benchmarks.

**Initialization Command:**

```bash
npx create-next-app@latest bmad-graph-web \
  --typescript --app --src-dir --tailwind --eslint \
  --turbopack --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript-first App Router with Server Components and Route Handlers, enabling SSR of semantic previews plus server-side access to the embedded SQLite/LibSQL layer.
- **Styling Solution:** Tailwind integrated by the CLI flag, matching the UX design system’s tokenized palette and breakpoint requirements without extra setup.
- **Build Tooling:** Turbopack default for dev (fast refresh, SRI, dev-server logging) with stable production builds via `next build`; `--inspect` support simplifies performance debugging in Docker.
- **Testing/Linting:** ESLint + TypeScript configs scaffolded automatically; we will extend with Playwright/axe for WCAG coverage in later steps.
- **Code Organization:** `/src/app` layouts, Route Handlers, and server actions give clear seams for import pipelines, provenance APIs, and reviewer evidence rails.
- **Development Experience:** Browser log forwarding, Agent DevTools, and Server Fast Refresh shorten feedback loops for data-heavy changes.citeturn0search1turn0search2

**Performance & Monitoring Notes (from Profiler Panel):**
- Enable WAL mode + targeted indexes in SQLite/LibSQL; log query durations/row counts so we trigger the “add DuckDB” playbook if analytical queries exceed SLA.
- Stream import/semantic previews through Route Handlers to keep SSR render time <1 s and capture metrics in the evidence rail.
- Package Docker image on `node:20-slim` with `libsqlite3-dev`; CI should run 1 M-row seed benchmarks and open an action item if median group-by >500 ms or import preview >5 s.
- Document the revisit point explicitly so future engineers can introduce embedded DuckDB (native or WASM) when telemetry justifies the extra complexity.

## Hosted Shell Delivery & Offline Strategy

- **Topology:** CDN/static host (e.g., CloudFront/Vercel) serves the Next.js bundle, service worker, manifest, and release metadata. A lightweight telemetry endpoint (edge collector → queue/storage) accepts performance metrics but never stores user datasets.
- **Service worker responsibilities:** Precache the shell bundle, fonts, and critical workers; advertise “offline ready” within 5 s; handle asset versioning with cache-busting and soft prompts (“Refresh to update”) when a new release is published.
- **Local workspace boundary:** All dataset I/O, transformations, and saved workspaces stay inside IndexedDB/File System Access API on the user’s machine. Shell APIs expose environment checks and update notices without uploading user files.
- **Telemetry buffering:** Client collects render timings/error events, writes them to an in-browser queue when offline, and flushes on reconnect via the telemetry endpoint. Payload schema excludes dataset rows, formulas, and workspace blobs.
- **Monitoring hooks:** CDN + telemetry endpoint emit availability metrics (target ≥99.5%), cache hit/miss ratios, and queue drain latency. Alerts fire when offline-ready time exceeds 5 s or telemetry backlog ages beyond an acceptable window.
