---
deferred_work_file: '{implementation_artifacts}/deferred-work.md'
---

# Step 4: Present and Act

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- When `{spec_file}` is set, always write findings to the story file before offering action choices.
- `decision-needed` findings must be resolved before handling `patch` findings.

## STORY-LOOP MODE

If story-loop mode is active, replace the normal interactive presentation flow with this non-interactive branch:

1. Do not implement fixes and do not ask whether to apply patches.
2. If unresolved `decision_needed` findings exist:
   - Persist them to the story file when possible.
   - Do not change application code.
   - Leave story/sprint status unchanged unless already clearly in `review`.
   - End with `ORCHESTRATOR_REPORT.result = "decision_needed"` and include all decision items.
3. If `gating_findings` contains any unresolved P0/P1/P2 item:
   - Write all P0/P1/P2 findings as unchecked story action items.
   - Write all P3 findings from the same round as unchecked story action items too (`action_state = "action_item"`).
   - Use the dev-story-compatible locations and labels:
     - Under `Tasks/Subtasks`, create or update `### Review Follow-ups (AI)` and add unchecked `- [ ] [AI-Review][P#] <title> — <location> — <summary>` entries.
     - Create or update `## Senior Developer Review (AI)` with review outcome, date, severity counts, reviewer-lane summary, and an `### Action Items` checklist containing the same unresolved items.
   - Update story file Status to `in-progress`.
   - Update `development_status[{story_key}]` in sprint-status.yaml to `in-progress` when available.
   - End with `ORCHESTRATOR_REPORT.result = "changes_requested"`.
4. If there are no P0/P1/P2 findings and P3 findings exist:
   - Record P3 findings in `{deferred_work_file}` with rationale and disposition reason.
   - Mark P3 entries as deferred/non-gating, not implementation action items.
   - Add a `## Senior Developer Review (AI)` summary showing P3-only outcome and the deferred-work location; do not create unchecked implementation follow-up tasks for deferred P3-only items.
   - Update story file Status to `done`.
   - Update `development_status[{story_key}]` in sprint-status.yaml to `done` when available.
   - End with `ORCHESTRATOR_REPORT.result = "p3_only"`.
5. If there are no unresolved findings:
   - Update story file Status to `done`.
   - Update `development_status[{story_key}]` in sprint-status.yaml to `done` when available.
   - End with `ORCHESTRATOR_REPORT.result = "clean"`.
6. The final response must end with a fenced `ORCHESTRATOR_REPORT` block containing only strict JSON matching the review_report schema:

```ORCHESTRATOR_REPORT
{
  "schema_version": "1.0",
  "worker_type": "review",
  "result": "clean|p3_only|changes_requested|decision_needed|blocked|failed",
  "story_key": "...",
  "story_path": "...",
  "story_status_after": "done|in-progress|review|unknown",
  "sprint_status_after": "done|in-progress|review|no-sprint-tracking|unknown",
  "fanout_layers": {"blind": "completed|failed|skipped|blocked", "edge": "completed|failed|skipped|blocked", "runtime": "completed|failed|skipped|blocked", "acceptance": "completed|failed|skipped|blocked"},
  "gating_findings": [],
  "p3_findings": [],
  "decision_needed": [],
  "deferred_work_location": null,
  "summary": "..."
}
```

Do not include comments, trailing commas, extra fields, or prose after the fenced block.

After completing the STORY-LOOP MODE branch, do not continue into the normal sections below.

## INSTRUCTIONS

### 1. Clean review shortcut

If zero findings remain after triage (all dismissed or none raised): state that and proceed to section 6 (Sprint Status Update).

### 2. Write findings to the story file

If `{spec_file}` exists and contains a Tasks/Subtasks section, append a `### Review Findings` subsection. Write all findings in this order:

1. **`decision-needed`** findings (unchecked):
   `- [ ] [Review][Decision] <Title> — <Detail>`

2. **`patch`** findings (unchecked):
   `- [ ] [Review][Patch] <Title> [<file>:<line>]`

3. **`defer`** findings (checked off, marked deferred):
   `- [x] [Review][Defer] <Title> [<file>:<line>] — deferred, pre-existing`

Also append each `defer` finding to `{deferred_work_file}` under a heading `## Deferred from: code review ({date})`. If `{spec_file}` is set, include its basename in the heading (e.g., `code review of story-3.3 (2026-03-18)`). One bullet per finding with description.

### 3. Present summary

Announce what was written:

> **Code review complete.** <D> `decision-needed`, <P> `patch`, <W> `defer`, <R> dismissed as noise.

If `{spec_file}` is set, add: `Findings written to the review findings section in {spec_file}.`
Otherwise add: `Findings are listed above. No story file was provided, so nothing was persisted.`

### 4. Resolve decision-needed findings

If `decision_needed` findings exist, present each one with its detail and the options available. The user must decide — the correct fix is ambiguous without their input. Walk through each finding (or batch related ones) and get the user's call. Once resolved, each becomes a `patch`, `defer`, or is dismissed.

If the user chooses to defer, ask: Quick one-line reason for deferring this item? (helps future reviews): — then append that reason to both the story file bullet and the `{deferred_work_file}` entry.

**HALT** — I am waiting for your numbered choice. Reply with only the number. Do not proceed until you select an option.

### 5. Handle `patch` findings

If `patch` findings exist (including any resolved from step 4), HALT. Ask the user:

If `{spec_file}` is set, present all three options:

> **How would you like to handle the `<P>` `patch` findings?**
> 1. **Apply every patch** — fix all of them now, no per-finding confirmation. Defer and decision-needed items are not touched.
> 2. **Leave as action items** — they are already in the story file
> 3. **Walk through each patch** — show details for each before deciding

If `{spec_file}` is **not** set, present only options 1 and 2 (omit "Leave as action items" — findings were not written to a file):

> **How would you like to handle the `<P>` `patch` findings?**
> 1. **Apply every patch** — fix all of them now, no per-finding confirmation. Defer and decision-needed items are not touched.
> 2. **Walk through each patch** — show details for each before deciding

**HALT** — I am waiting for your numbered choice. Reply with only the number. Do not proceed until you select an option.

- **Apply every patch**: Apply every patch finding without per-finding confirmation. Do not modify defer or decision-needed items. After all patches are applied, present a summary of changes made. If `{spec_file}` is set, check off the patch items in the story file (leave defer items as-is).
- **Leave as action items** (only when `{spec_file}` is set): Done — findings are already written to the story.
- **Walk through each patch**: Present each finding with full detail, diff context, and suggested fix. After walkthrough, re-offer the applicable options above.

  **HALT** — I am waiting for your numbered choice. Do not proceed until you select an option.

**✅ Code review actions complete**

- Decision-needed resolved: <D>
- Patches handled: <P>
- Deferred: <W>
- Dismissed: <R>

### 6. Update story status and sync sprint tracking

Skip this section if `{spec_file}` is not set.

#### Determine new status based on review outcome

- If all `decision-needed` and `patch` findings were resolved (fixed or dismissed) AND no unresolved HIGH/MEDIUM issues remain: set `{new_status}` = `done`. Update the story file Status section to `done`.
- If `patch` findings were left as action items, or unresolved issues remain: set `{new_status}` = `in-progress`. Update the story file Status section to `in-progress`.

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

### 7. Next steps

Present the user with follow-up options:

> **What would you like to do next?**
> 1. **Start the next story** — run `dev-story` to pick up the next `ready-for-dev` story
> 2. **Re-run code review** — address findings and review again
> 3. **Done** — end the workflow

**HALT** — I am waiting for your choice. Do not proceed until the user selects an option.

## On Complete

Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow.on_complete`

If the resolved `workflow.on_complete` is non-empty, follow it as the final terminal instruction before exiting.
