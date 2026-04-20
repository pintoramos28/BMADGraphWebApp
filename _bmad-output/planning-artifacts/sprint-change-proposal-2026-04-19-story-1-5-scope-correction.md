---
date: 2026-04-19
project: BMADGraphWebApp
mode: batch
change_trigger: Story 1.5 review exposed a contract-definition gap for semantic transform reopen validation and incompatible graph-composition or layer reopen validation.
scope_classification: Minor
status: approved
approval_date: 2026-04-19
approval_note: User approved narrowing Story 1.5 to currently deterministically detectable reopen failures and moving the deferred contract gap to Story 1.6.
---

# Sprint Change Proposal

## 1. Issue Summary

Story 1.5 currently over-claims reopen validation scope. Its acceptance and scope text still imply ownership of semantically broken saved transforms and incompatible graph-composition or layer reopen failures, but the review pass established that those cases are not yet contract-defined in a deterministic way.

### Evidence

- Story 1.5 still names broken transforms and incompatible graph layers in the current acceptance text: [1-5-localize-reopen-errors-and-provide-repair-entry-points.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md:13)
- Story 1.5 review findings already isolate the missing contract decisions: [1-5-localize-reopen-errors-and-provide-repair-entry-points.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md:49)
- Story 1.6 already exists to own the missing validation-definition work: [1-6-complete-reopen-validation-for-transforms-and-graph-compositions.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-6-complete-reopen-validation-for-transforms-and-graph-compositions.md:1)

## 2. Checklist Status

| ID | Status | Notes |
| --- | --- | --- |
| 1.1 | [x] Done | Triggering story is Story 1.5. |
| 1.2 | [x] Done | Problem is a requirement-boundary mismatch discovered during review, not a product-direction change. |
| 1.3 | [x] Done | Evidence is present in Story 1.5 review notes and in existing Story 1.6 scope text. |
| 2.1 | [x] Done | Epic 1 remains viable with a narrower Story 1.5 and unchanged sequencing. |
| 2.2 | [x] Done | No epic-level rewrite is needed; only Story 1.5 wording is corrected. |
| 2.3 | [x] Done | The only dependent future story impacted is Story 1.6, which already owns the deferred work. |
| 2.4 | [x] Done | No new epic or story is required. |
| 2.5 | [x] Done | Epic order and priority remain unchanged. |
| 3.1 | [N/A] | PRD scope is unchanged; this is a story-boundary clarification. |
| 3.2 | [N/A] | Architecture is not edited in this correction; Story 1.6 already carries the contract-gap follow-up. |
| 3.3 | [N/A] | UX is not changed by this correction. |
| 3.4 | [x] Done | Only the Story 1.5 implementation artifact, Epic 1 stories artifact, and this proposal are updated. |
| 4.1 | [x] Viable | Direct adjustment is the minimal, lowest-risk path. |
| 4.2 | [x] Not viable | No rollback is justified for an artifact-only correction. |
| 4.3 | [x] Not viable | MVP scope does not need reduction; ownership just needs clarification. |
| 4.4 | [x] Done | Recommended path is Option 1: direct adjustment. |
| 5.1 | [x] Done | Issue summary documented above. |
| 5.2 | [x] Done | Story and planning artifact adjustments are documented below. |
| 5.3 | [x] Done | Recommended approach and rationale are documented below. |
| 5.4 | [x] Done | MVP impact is none; action plan is artifact-only. |
| 5.5 | [x] Done | Handoff remains Developer review for Story 1.5 and later implementation under Story 1.6. |
| 6.1 | [x] Done | Applicable checklist items are covered. |
| 6.2 | [x] Done | Proposal is narrow and internally consistent. |
| 6.3 | [x] Done | User approval was provided in-chat before execution. |
| 6.4 | [N/A] | `sprint-status.yaml` must not change for this correction. |

## 3. Impact Analysis

### Epic Impact

- Epic 1 remains intact.
- Story 1.5 narrows to currently deterministically detectable reopen failures.
- Story 1.6 continues to own semantic transform reopen validation and incompatible graph-composition or layer reopen validation.

### Artifact Impact

- Update Story 1.5 acceptance, contract boundaries, task wording, and review notes so they no longer imply Story 1.5 owns the deferred contract gap.
- Update the Epic 1 planning artifact only enough to keep Story 1.5 and Story 1.6 definitions consistent.
- Do not modify `sprint-status.yaml`.

### Technical Impact

- No code changes.
- No implementation rollback.
- Fresh review of Story 1.5 should evaluate only the narrowed, deterministic reopen-failure scope.

## 4. Recommended Approach

### Selected Path

Direct adjustment.

### Rationale

- The change is a story-boundary correction, not a redesign.
- Story 1.6 already provides the correct destination for the deferred contract gap.
- Narrowing Story 1.5 avoids forcing review to adjudicate undefined reopen semantics.

## 5. Detailed Change Proposals

### A. Story 1.5 Implementation Artifact

**Artifact:** [1-5-localize-reopen-errors-and-provide-repair-entry-points.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/implementation-artifacts/1-5-localize-reopen-errors-and-provide-repair-entry-points.md:1)

**OLD**

- Acceptance and task text referred to stale formulas, broken transforms, and incompatible graph layers.
- Open review decisions left the semantic-transform and incompatible graph-layer contract gap unresolved inside Story 1.5.

**NEW**

- Acceptance and task text refer to stale formulas, invalid saved graph selections, saved issue-record or ledger drift, missing file handles, and other currently deterministically detectable localized reopen failures.
- Review decisions explicitly defer semantic transform reopen validation and incompatible graph-composition or layer reopen validation to Story 1.6.

**Rationale:** This keeps Story 1.5 reviewable against the work it can deterministically own today.

### B. Epic 1 Stories Planning Artifact

**Artifact:** [epic-1-stories.md](/home/pinto/repo/BMADGraphWebApp/_bmad-output/planning-artifacts/epic-1-stories.md:68)

**OLD**

- Story 1.5 acceptance still named broken transforms and incompatible graph layers.

**NEW**

- Story 1.5 acceptance is narrowed to currently deterministically detectable reopen failures, with an explicit scope note that Story 1.6 owns semantic transform and incompatible graph-composition or layer reopen validation.

**Rationale:** The planning artifact must match the implementation artifact so the story set remains dependency-safe and review-safe.

## 6. Implementation Handoff

- Scope classification: Minor
- Route Story 1.5 to a fresh review pass using the narrowed scope.
- Route semantic transform and incompatible graph-composition or layer reopen validation work to Story 1.6 as already planned.
