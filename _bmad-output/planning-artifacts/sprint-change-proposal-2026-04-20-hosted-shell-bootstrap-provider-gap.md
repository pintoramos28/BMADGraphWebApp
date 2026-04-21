---
date: 2026-04-20
project: BMADGraphWebApp
mode: batch
change_trigger: Epic 1 shell bootstrap currently depends on an external manual mock/bootstrap server, but no approved story owns the thin hosted-shell metadata provider required for fresh-clone startup or deployable shell delivery.
scope_classification: Minor
status: proposed
---

# Sprint Change Proposal

## 1. Issue Summary

The hosted-shell model is documented clearly, but the current story set leaves one implementation gap unowned:

- The client shell is expected to load release metadata and support facts during bootstrap.
- The architecture says those endpoints come from a thin operational shell service outside the analytical runtime.
- Epic 1 Story 1.1 says a fresh clone should install and start successfully.
- No existing story explicitly implements the thin bootstrap metadata provider needed to make that true in local development or in a real hosted shell deployment.

As a result, the current frontend shell only reaches its healthy Epic 1 readiness state when a separate manual helper or equivalent external service provides the required operational endpoints.

## 2. Evidence

- The PRD requires a centrally hosted shell and shell-owned environment/update surfaces:
  - [prd.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md:412)
  - [prd.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/prd.md:455)
- The architecture requires a thin operational API surface outside the analytical runtime:
  - [architecture.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md:114)
  - [architecture.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md:197)
  - [architecture.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md:243)
- Epic 1 owns hosted-shell bootstrap and shell readiness outcomes:
  - [epics.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:44)
  - [epics.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:56)
- Story 1.1 still promises successful fresh-clone startup:
  - [epic-1-stories.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md:18)
- Story 1.4 assumes support/update metadata is available, but only covers the client-side shell surfaces:
  - [epic-1-stories.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md:53)
- Epic 6 hardens release/support delivery later, but does not close the initial delivery-provider ownership gap for Epic 1:
  - [epic-6-stories.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-6-stories.md:22)
- The implemented client boot path already requires the operational endpoints:
  - [load-release-manifest.ts](/home/pinto/repo/BMADGraphWebApp/src/services/release/load-release-manifest.ts:20)
  - [bootstrap-shell.ts](/home/pinto/repo/BMADGraphWebApp/src/services/release/bootstrap-shell.ts:47)

## 3. Checklist Status

| ID | Status | Notes |
| --- | --- | --- |
| 1.1 | [x] Done | Triggering gap is implementation-side shell bootstrap behavior. |
| 1.2 | [x] Done | Problem is story ownership, not product-direction ambiguity. |
| 1.3 | [x] Done | Evidence exists in PRD, architecture, epic/story artifacts, and current shell boot code. |
| 2.1 | [x] Done | Epic 1 remains the correct ownership area for first-load shell viability. |
| 2.2 | [x] Done | Epic 6 still owns later operational hardening and release confidence work. |
| 2.3 | [x] Done | No epic reorder is required. |
| 2.4 | [x] Done | One new story is required. |
| 2.5 | [x] Done | Story should land after Story 1.4 client-shell work and before Epic 1 is treated as complete. |
| 3.1 | [N/A] | PRD scope does not change. |
| 3.2 | [N/A] | Architecture already allows the thin operational component. |
| 3.3 | [N/A] | UX is unaffected except that the shell can actually enter the documented healthy state without ad hoc setup. |
| 3.4 | [x] Done | This proposal introduces only a backlog/story correction. |

## 4. Impact Analysis

### Epic Impact

- **Epic 1 needs one additional implementation story.**
- **Epic 6 remains unchanged.** It should still own telemetry queue behavior, release confidence gates, and shell hardening after the bootstrap provider exists.

### Why This Belongs In Epic 1

- Epic 1 owns FR59, FR60, and FR62: hosted-shell entry, offline-ready trust, and environment/update/readiness signals.
- Story 1.1 explicitly promises a successful fresh-clone startup path.
- Without the thin bootstrap provider, the current shell cannot satisfy that promise except through ad hoc manual setup.

### Why This Is Not Sufficiently Covered By Epic 6

- Epic 6 Story 6.2 hardens support-matrix publication, update state, and offline guarantees after the shell trust surfaces already exist.
- The current gap is earlier and narrower: there is no owned deliverable that makes the shell bootstrap inputs available in local dev/preview and in the initial hosted-shell deployment shape.

## 5. Detailed Change Proposal

### Proposed New Story

**Epic placement:** Epic 1  
**Recommended sequence:** after Story 1.4  
**Proposed title:** `Story 1.7: Provide Hosted-Shell Bootstrap Metadata For Local And Static Delivery`

**Story**

As a developer and release owner,  
I want the hosted shell to obtain its bootstrap metadata from an owned thin delivery path,  
so that a fresh clone can load the shell locally and deployed builds can reach a healthy shell state without ad hoc manual servers.

**Dependencies**

- Story 1.1: Bootstrap Hosted Shell Baseline
- Story 1.2: Author Canonical Workspace and Trust Contracts
- Story 1.4: Surface Shell Readiness, Support, and Update Status

**Requirements**

- FR59
- FR60
- FR62
- NFR15
- NFR16
- NFR18
- NFR22
- NFR24

**Acceptance Criteria**

1. Given a fresh clone, when the documented local start flow runs, then the hosted shell loads successfully without requiring an ad hoc manual mock server because valid `GET /api/release-manifest` and `GET /api/support-matrix` responses are available to the shell.
2. Given the shell is deployed as static assets, when the thin operational delivery path is provisioned, then `GET /api/release-manifest`, `GET /api/support-matrix`, and `GET /api/health` are served independently of the analytical runtime and without adding any dataset or workspace CRUD API.
3. Given shell metadata is version-sensitive, when release metadata or support facts change, then local-dev and hosted-delivery sources read from one canonical checked-in source or generation step so manifest/support-matrix drift is detected before release.
4. Given route-owned shell screens are part of the hosted-shell entry contract, when the local and hosted shell are exercised, then SPA fallback works for `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`.
5. Given shell delivery fails or becomes inconsistent, when bootstrap validation or smoke checks run, then the failure is surfaced as a delivery/setup error before users encounter an unexplained shell-error state in normal startup.

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

### Recommended Story Notes

- The story may be implemented as a lightweight local/dev server, dev middleware, generated static JSON + thin host wrapper, or an equivalent deployment-safe bootstrap path.
- The story should not move shell bootstrap ownership into the analytical client bundle.
- The story should not be treated as permission to add a backend for workspace or dataset persistence.

## 6. Handoff

- Route this as a **new Epic 1 story**.
- Keep Epic 6 Story 6.2 focused on publication hardening, trust-surface behavior, and production release confidence once this bootstrap provider exists.
- If the team wants artifact parity, the next planning step is to add the story above into [epic-1-stories.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md:1) and note in [epics.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md:152) that Epic 1 is not complete until the thin shell delivery path exists.
