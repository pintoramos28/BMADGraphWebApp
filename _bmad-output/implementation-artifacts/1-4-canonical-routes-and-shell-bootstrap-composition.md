# Story 1.4: Canonical Routes and Shell Bootstrap Composition

Status: ready-for-dev

## Story

As a shell engineer,
I want the canonical route inventory and bootstrap composition locked before feature screens diverge,
so that deep links, unsupported-environment handling, and later trust surfaces all build on one stable route policy.

## Acceptance Criteria

1. Given the locked implementation baseline, when route modules are authored, then exactly five canonical routes exist: `/`, `/workspace`, `/workspace/:workspaceId`, `/review/:workspaceId`, and `/unsupported`, with one constants module exposing the fixed route keys and one helper module exposing `routePath.workspace(workspaceId)` and `routePath.review(workspaceId)`.
2. Given multi-agent drift is a known risk, when route helpers and router composition are implemented, then the param name remains `workspaceId`, no additional convenience routes are introduced, and deep-link generation for workspace and review flows comes only from the shared route helpers.
3. Given the shell is static-first, when bootstrap composition is implemented under `src/app/boot/` and `src/app/router/`, then the shell starts through explicit boot modules and route-owned screens without introducing SSR assumptions or feature-owned routing logic.
4. Given `/review/:workspaceId` has a locked boundary, when the route placeholder is defined, then it is documented and scaffolded as an inspection-first route rather than a second authoring surface.
5. Given route drift should be caught early, when tests run, then they validate the fixed route inventory, helper outputs, and route-module ownership boundaries.

## Dependencies

- Story 1.1: Shell Scaffold and Shared Contract Baselines

## Contract Boundaries

- In scope: route constants, helper functions, router composition, shell bootstrap entrypoints, and route-policy tests.
- Out of scope: release-manifest fetches, support-matrix enforcement, service-worker registration, workspace persistence repositories, and feature UI breadth beyond route placeholders.
- Owning paths: `src/app/router/**`, `src/app/boot/bootstrapApp.ts`, and any route-policy tests under `tests/integration/**` or colocated shell tests.
- Downstream consumers after completion: environment gating, release-metadata boot logic, workspace persistence resume flows, review-mode trust surfaces, and Repair Card/readiness deep links.

## Tasks / Subtasks

- [ ] Create the canonical route constants module and helper module using the locked route keys and helper names. (AC: 1, 2)
- [ ] Compose the shell router and bootstrap entrypoints around route-owned modules rather than feature-local routing. (AC: 3)
- [ ] Scaffold the review and unsupported routes with the correct boundary notes so later stories do not repurpose them incorrectly. (AC: 4)
- [ ] Add route-policy tests that prevent unapproved route drift and verify helper output. (AC: 5)

## Dev Notes

### Architecture Alignment

- The architecture and kickoff decisions both lock the route inventory and warn against opportunistic route expansion.
- Route helpers are specifically needed for Repair Card, Mission Log, Handoff Readiness, and environment-gating deep links.
- The shell remains a hosted static-first application using explicit React Router ownership.

### Project Structure Notes

- Keep route policy in shared shell modules, not scattered across feature folders.
- Use route placeholders only where needed to preserve ownership boundaries; avoid building substantive workspace or review UI in this story.
- Review route behavior must already respect IK-ADR-13 even if the route only contains scaffolding at this stage.

### Testing

- Add route inventory tests that fail if new unapproved paths appear.
- Add helper tests for `routePath.workspace` and `routePath.review`.

### Residual Assumptions

- Query-string conventions and nested shell-layout details may remain flexible as long as the route inventory, route keys, helper names, and `workspaceId` param stay frozen.

### References

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/architecture.md` - Validation Refinements from Critical Review, ADR-Style Validation Decisions, Complete Project Directory Structure
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epics.md` - Canonical routes are fixed, Epic 1 implementation emphasis
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-kickoff-decisions.md` - Section 4.2 Canonical route constants, Immediate next actions before epics/stories
- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/implementation-adrs/IK-ADR-13-review-route-behavior.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Locked Epic 1 planning baseline reviewed before story creation.

### Completion Notes List

- This story deliberately freezes the route policy before release metadata, environment gating, or review features expand.
- Review is kept inspection-first from the first route stub to avoid early authoring drift.

### File List

- `/home/pin81845/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-4-canonical-routes-and-shell-bootstrap-composition.md`
