---
deferred_work_file: '{implementation_artifacts}/deferred-work.md'
orchestration_mode: '' # set at workflow entry; step files must preserve caller-provided "story-loop"
---

# Step 4: Present and Act

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- When `{spec_file}` is set, always write findings to the story file before offering action choices.
- `decision-needed` findings must be resolved before handling `patch` findings.
- In `story-loop` orchestration mode, do not wait for routine human patch-action choices. If any P0/P1/P2 finding exists in the review round, leave all findings from that round, including P3s, as unchecked action items. Defer P3s only when the review round is P3-only. Update status and return `ORCHESTRATOR_REPORT`.
- P0/P1/P2 findings are gating and must never be deferred, checked off as deferred work, or converted into a `done`, `clean`, or `p3_only` story-loop outcome. They remain unchecked action items and keep story/sprint status `in-progress` until fixed or dismissed by a later review.

## INSTRUCTIONS

### 1. Clean review shortcut

If zero findings remain after triage (all dismissed or none raised): state that and proceed to section 6 (Sprint Status Update).

### 2. Write findings to the story file

If `{spec_file}` exists and contains a Tasks/Subtasks section, append a `### Review Findings` subsection. Write all findings in this order:

1. **`decision-needed`** findings (unchecked):
   `- [ ] [Review][Decision] <Title> — <Detail>`

2. **`patch`** findings (unchecked for P0/P1/P2 and also unchecked for P3 when the same review round contains any P0/P1/P2; checked/deferred only for P3-only story-loop rounds):
    `- [ ] [Review][Patch][P#] <Title> [<file>:<line>] — <priority rationale>`

3. **`defer`** findings (checked off, marked deferred):
    `- [x] [Review][Defer][P#] <Title> [<file>:<line>] — deferred, <reason>`

Also append each `defer` finding to `{deferred_work_file}` under a heading `## Deferred from: code review ({date})`. If `{spec_file}` is set, include its basename in the heading (e.g., `code review of story-3.3 (2026-03-18)`). One bullet per finding with description.

### 3. Present summary

Announce what was written:

> **Code review complete.** <D> `decision-needed`, <P> `patch`, <W> `defer`, <R> dismissed as noise. Priority counts: P0=<P0>, P1=<P1>, P2=<P2>, P3=<P3>.

If `{spec_file}` is set, add: `Findings written to the review findings section in {spec_file}.`
Otherwise add: `Findings are listed above. No story file was provided, so nothing was persisted.`

### 4. Resolve decision-needed findings

If `decision_needed` findings exist, present each one with its detail and the options available. The user must decide — the correct fix is ambiguous without their input. Walk through each finding (or batch related ones) and get the user's call. Once resolved, each becomes a `patch`, `defer`, or is dismissed.

If `{orchestration_mode}` = `"story-loop"`, do not ask the user inside the review worker. Persist the decision-needed findings, set terminal report `result: decision_needed`, and continue to status sync/reporting.

If the user chooses to defer, ask: Quick one-line reason for deferring this item? (helps future reviews): — then append that reason to both the story file bullet and the `{deferred_work_file}` entry.

If `{orchestration_mode}` != `"story-loop"`: **HALT** — I am waiting for your numbered choice. Reply with only the number (or "0" for batch). Do not proceed until you select an option.

### 5. Handle `patch` findings

If `patch` findings exist (including any resolved from step 4) and `{orchestration_mode}` = `"story-loop"`:
- Split patch findings into P0/P1/P2 and P3.
- If any P0/P1/P2 patch finding exists, leave **all** patch findings from this review round, including P3 findings, as unchecked story action items for the next implementation pass.
- If no P0/P1/P2 or `decision_needed` finding exists and the round is P3-only, convert P3 findings to deferred/non-gating work, check them off in the story review section, and append them to `{deferred_work_file}` with the P3 rationale.
- Do not apply fixes and do not ask for a patch-action choice.
- Proceed to section 6.

If `patch` findings exist (including any resolved from step 4) and `{orchestration_mode}` != `"story-loop"`, HALT. Ask the user:

If `{spec_file}` is set, present all three options (if >3 `patch` findings exist, also show option 0):

> **How would you like to handle the <Z> `patch` findings?**
> 0. **Batch-apply all** — automatically fix every non-controversial patch (recommended when there are many)
> 1. **Fix them automatically** — I will apply fixes now
> 2. **Leave as action items** — they are already in the story file
> 3. **Walk through each** — let me show details before deciding

If `{spec_file}` is **not** set, present only options 1 and 3 (omit option 2 — findings were not written to a file). If >3 `patch` findings exist, also show option 0:

> **How would you like to handle the <Z> `patch` findings?**
> 0. **Batch-apply all** — automatically fix every non-controversial patch (recommended when there are many)
> 1. **Fix them automatically** — I will apply fixes now
> 2. **Walk through each** — let me show details before deciding

**HALT** — I am waiting for your numbered choice. Reply with only the number (or "0" for batch). Do not proceed until you select an option.

- **Option 0** (only when >3 findings): Apply all non-controversial patches without per-finding confirmation. Skip any finding that requires judgment. Present a summary of changes made and any skipped findings.
- **Option 1**: Apply each fix. After all patches are applied, present a summary of changes made. If `{spec_file}` is set, check off the items in the story file.
- **Option 2** (only when `{spec_file}` is set): Done — findings are already written to the story.
- **Walk through each**: Present each finding with full detail, diff context, and suggested fix. After walkthrough, re-offer the applicable options above.

  **HALT** — I am waiting for your numbered choice. Reply with only the number (or "0" for batch). Do not proceed until you select an option.

**✅ Code review actions complete**

- Decision-needed resolved: <D>
- Patches handled: <P>
- Deferred: <W>
- Dismissed: <R>

### 6. Update story status and sync sprint tracking

Skip this section if `{spec_file}` is not set.

#### Determine new status based on review outcome

- If `{orchestration_mode}` = `"story-loop"` and unresolved `decision_needed` findings exist: set `{new_status}` = `in-progress` and set terminal report `result: decision_needed`.
- If `{orchestration_mode}` = `"story-loop"` and unresolved P0/P1/P2 findings exist: set `{new_status}` = `in-progress`. P3 findings from that same review round remain action items too.
- If `{orchestration_mode}` = `"story-loop"` and no unresolved P0/P1/P2 or `decision_needed` findings remain (including clean or P3-only outcomes): set `{new_status}` = `done`; defer any P3-only findings.
- If `{orchestration_mode}` != `"story-loop"` and all `decision-needed` and `patch` findings were resolved (fixed or dismissed) AND no unresolved P0/P1/P2 issues remain: set `{new_status}` = `done`. Update the story file Status section to `done`.
- If `{orchestration_mode}` != `"story-loop"` and `patch` findings were left as action items, or unresolved issues remain: set `{new_status}` = `in-progress`. Update the story file Status section to `in-progress`.

Update the story file Status section to `{new_status}`.

Save the story file.

#### Sync sprint-status.yaml

If `{story_key}` is not set, skip this subsection and note that sprint status was not synced because no story key was available.

If `{sprint_status}` file exists:

1. Load the FULL `{sprint_status}` file.
2. Find the `development_status` entry matching `{story_key}`.
3. If found: update `development_status[{story_key}]` to `{new_status}`. Update `last_updated` to current date. Save the file, preserving ALL comments and structure including STATUS DEFINITIONS.
4. If `{story_key}` not found in sprint status: warn the user that the story file was updated but sprint-status sync failed.

If `{sprint_status}` file does not exist, note that story status was updated in the story file only.

#### Completion summary

> **Review Complete!**
>
> **Story Status:** `{new_status}`
> **Issues Fixed:** <fixed_count>
> **Action Items Created:** <action_count>
> **Deferred:** <W>
> **Dismissed:** <R>

If `{orchestration_mode}` = `"story-loop"`, return a terminal fenced `ORCHESTRATOR_REPORT` block containing only strict JSON matching `bmad-story-loop-orchestrator/references/orchestrator-report.schema.json` definition `review_report`, and do not offer interactive next steps. The orchestrator will validate it with `bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py report --extract-fence`. The schema file and validator are the source of truth for nested shapes, required fields, and enum values; if there is any mismatch, follow the schema/validator contract. Include exactly:
- `schema_version: "1.0"`
- `worker_type: review`
- `result: clean|p3_only|changes_requested|decision_needed|blocked|failed`
- `story_key`, `story_path`, `story_status_after`, `sprint_status_after`
- `fanout_layers` with status for blind, edge, runtime, and acceptance
- `gating_findings` containing unresolved P0/P1/P2 findings
- `p3_findings` containing P3 findings, rationales, and whether each was left as an action item or deferred
- `decision_needed` containing unresolved decisions
- `deferred_work_location`
- `summary`

Nested shape requirements from the schema contract:
- `fanout_layers`: object with `blind`, `edge`, `runtime`, `acceptance`; each is `completed`, `failed`, `skipped`, or `blocked`.
- `gating_findings[]`: `id`, `priority` (`P0|P1|P2`), `title`, `detail`, `source` (array of `blind|edge|runtime|acceptance|review-worker`), `location` (string or null), and `action_state: "action_item"`.
- `p3_findings[]`: `id`, `priority: "P3"`, `title`, `detail`, `source`, `location`, `action_state` (`action_item|deferred`), `p3_rationale`, and `disposition_reason`.
- `decision_needed[]`: `id`, `title`, `detail`, `options` (non-empty string array), and `location` (string or null).

### 7. Next steps

Present the user with follow-up options:

> **What would you like to do next?**
> 1. **Start the next story** — run `dev-story` to pick up the next `ready-for-dev` story
> 2. **Re-run code review** — address findings and review again
> 3. **Done** — end the workflow

**HALT** — I am waiting for your choice. Do not proceed until the user selects an option.
