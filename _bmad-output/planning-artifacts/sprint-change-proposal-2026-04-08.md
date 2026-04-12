---
date: 2026-04-08
change_scope: Moderate
mode: Batch
issue_trigger: "Shift from local-only installs to a centrally hosted shell that still keeps workspaces/datasets local and offline-capable"
---

# Sprint Change Proposal – Hosted Shell + Local Workspace

## Section 1: Issue Summary
- **Problem statement:** Existing planning artifacts assume every user installs a standalone local app. We now need a centrally hosted shell (served via browser) that precaches assets, works offline once loaded, and reports telemetry, while still keeping datasets, transformations, and workspaces entirely on the local machine.
- **Discovery context:** Follow-up discussions on 2026-04-08 concluded that requiring per-user installs is too heavy; instead we need a hosted delivery surface with offline capability but without syncing user data.
- **Evidence:**
  - PRD explicitly states “scope is local-first, single-user” with no hosted deployment (`_bmad-output/planning-artifacts/prd.md:158`) and NFR19 bans any “external network transmission” during standard operations (`_bmad-output/planning-artifacts/prd.md:411`).
  - Architecture document forbids “always-on cloud backend” and only references embedded SQLite (`_bmad-output/planning-artifacts/architecture.md:48,68`).
  - UX spec is designed for local filesystem prompts and has no flows for hosted shell bootstrapping or offline caching states (`_bmad-output/planning-artifacts/ux-design-specification.md:65`).

## Section 2: Impact Analysis
### Epic Impact
- **No epics have been authored yet.** The backlog is still in definition, so this change targets upstream artifacts only (Checklist 2.1–2.5 = `[N/A]`).

### Story Impact
- Future stories covering distribution, updates, telemetry, and offline behavior must now include hosted shell requirements (service worker caching, telemetry buffering) while explicitly excluding server-side workspace storage.

### Artifact Conflicts
- **PRD:** Needs new functional and non-functional requirements for hosted delivery, offline caching, telemetry buffering, and local-data boundaries.
- **Architecture:** Must describe hosted shell deployment (static hosting + telemetry endpoint), service-worker strategy, and clear “no data storage” boundary.
- **UX:** Requires flows for initial load, cache-ready/offline banners, telemetry consent, and failure/reconnect states.
- **Other artifacts:** Need release/ops plan for serving the shell, telemetry ingestion, monitoring of cache-refresh success, and documentation updates explaining user control of local workspaces.

### Technical Impact
- Introduce service worker + manifest for offline caching, asset versioning, telemetry buffering queue, and environment checks. Need lightweight hosting (e.g., CDN + telemetry API) plus monitoring of shell availability. No authentication or server-side data storage is added.

## Section 3: Recommended Approach
| Option | Summary | Effort | Risk | Viability |
| --- | --- | --- | --- | --- |
| **1. Keep pure local installs** | Do nothing | Low | High (distribution & update friction remain) | Not viable – fails new convenience goal.
| **2. Fully hosted workspaces** | Move data + compute server-side | High | High (violates local-control requirement) | Not viable – contradicts stated boundaries.
| **3. Hosted shell + local workspace** | Serve UI + telemetry centrally, keep data local, add offline caching | Medium | Medium-Low | **Recommended** – satisfies convenience goal without compromising data locality or offline behavior.

## Section 4: Detailed Change Proposals
### 4.1 PRD Updates
1. **Journey Summary & Scope (`_bmad-output/planning-artifacts/prd.md:158`)**
   - Update to state that the analytical workflow runs in a browser-delivered shell that precaches assets, works offline post-load, and keeps workspaces/datasets local.
2. **Functional Requirements (add FR59–FR62)**
   - FR59: The application shell is served from a central host so users can run BMADGraphWebApp via browser without installing binaries.
   - FR60: The shell precaches required assets via service worker so the analytical experience continues offline once loaded.
   - FR61: Telemetry metrics (performance timings, errors) are sent to the host when connectivity exists; metrics queue locally when offline and flush automatically later.
   - FR62: The shell exposes environment checks and update prompts without transmitting user datasets, transformations, or workspaces.
3. **Non-Functional Requirements**
   - Revise NFR19 to allow network use for shell delivery/telemetry while guaranteeing user datasets never leave the local environment.
   - Add NFR22 (offline readiness within 5 seconds after initial load), NFR23 (telemetry buffering does not block user workflows), and NFR24 (shell hosting availability ≥99.5% during business hours).

### 4.2 Architecture Adjustments (`_bmad-output/planning-artifacts/architecture.md:48,68`)
- Define hosted shell topology: CDN/static host serving Next.js bundle + service worker; telemetry API endpoint with buffering support; no persistent storage of workspaces.
- Document service-worker strategy (asset versioning, cache busting, offline routing) and local workspace boundary (all dataset I/O handled via browser APIs on the client machine).
- Specify telemetry pipeline stack (e.g., edge collector → queue) and note that payloads exclude user data.
- Add operational considerations: release automation, rollback signals, monitoring of cache hit/miss rates, and error budgeting for telemetry endpoint.

### 4.3 UX Specification Updates (`_bmad-output/planning-artifacts/ux-design-specification.md:65`)
- Introduce onboarding flow showing “Ready for offline use” status once assets are cached.
- Add states for offline mode (banner + guidance), telemetry backlog indicator, and update-available prompts.
- Document environmental check UI (browser/storage warnings) and service worker refresh UX.
- Ensure accessibility guidance covers offline banners, update modals, and telemetry consent messaging.

### 4.4 Operational & Documentation Work
- Create release checklist for hosting (build → upload → invalidate cache → announce update).
- Define telemetry ingestion/monitoring dashboards and alerting (especially for queue flush failures).
- Update end-user docs explaining hosted shell behavior, offline usage, telemetry privacy, and manual sharing of templates/configs.

## Section 5: Implementation Handoff
- **Scope classification:** Moderate – affects planning artifacts and introduces a lightweight hosted component, but preserves local analytical engine.
- **Handoff recipients:**
  1. **Product/Architecture:** Update PRD, architecture, and UX docs with hosted shell requirements.
  2. **Ops/Docs:** Draft release pipeline, monitoring approach, and user-facing documentation for offline/telemetry behavior ahead of implementation.
- **Success criteria:** Updated artifacts merged plus release checklist and telemetry monitoring plan in place before backlog stories are carved out.
