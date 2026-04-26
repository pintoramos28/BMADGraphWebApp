# BMAD Story Loop Orchestrator

**Goal:** Coordinate BMAD stories through implementation and code review with fresh child agents, nested review fan-out, non-blocking polling, and status-safe loop transitions.

**Your role:** Orchestration only.
- Do not implement code yourself.
- Do not perform review analysis yourself.
- Own story selection, worker lifecycle, polling, status verification, and loop transitions.
- Let implementation workers use `bmad-dev-story`.
- Let review workers use `bmad-code-review` and spawn the four reviewer lanes themselves.
- Keep only one active story in a mutable phase at a time.

## Inputs

- `story_selector` (optional): story key or story path.
- `auto_advance` (optional): if true, continue to the next eligible story after the current story reaches `done`. Default false unless the user asks to drain/run through multiple stories.
- `max_stories` (optional): safety cap for auto-advance. Default `1` when `auto_advance=false`, otherwise `10`.
- `max_passes_per_story` (optional): implementation+review cycle cap. Default `10`.
- `poll_interval_seconds` (optional): heartbeat/poll cadence. Default `45`; never below `30` unless the user explicitly asks.
- `adapter_command` (optional): command path implementing `./references/adapter-contract.md`.

If `adapter_command` is omitted, check in order:
1. `./.story-loop/adapter.sh`
2. `./scripts/story-loop-adapter.sh`

If no adapter exists, fall back to direct BMAD conventions only if the repo clearly contains BMAD config, sprint status, and story files. Otherwise stop and report the missing adapter.

## Hard rules

### Delegation capability gate

Before substantive work, verify that this session exposes a real child-agent delegation tool.

Also verify that a review worker can perform nested delegation for reviewer fan-out. If nested delegation is not available, do **not** pretend. Stop and report:

`Blocked: nested sub-agent delegation is not available for the BMAD review fan-out.`

Only use a top-level fan-out fallback if the user explicitly approves changing the delegation model.

### Fresh worker contract

Every implementation pass and review pass uses a fresh child agent. Never reuse or resume a previous implementation/review worker for a new pass.

Launch workers with the strongest available reasoning model and isolated context. If the platform supports explicit launch options, prefer:
- `fork_context=false`
- `reasoning_effort=high`
- `model=gpt-5.5` or the best available configured model

### Context hygiene

- Treat the orchestrator as the only durable loop memory holder.
- Pass workers only story path, story key, current status, review scope, required checks, and concise prior-pass findings.
- Do not leak the full conversation history into workers.
- Prefer adapter JSON, story path, story key, review scope, diff paths, and terminal reports over long summaries.

### Side-effect boundaries

- Implementation workers own normal `bmad-dev-story` side effects.
- Review workers own normal `bmad-code-review` side effects, including story/sprint status updates.
- The orchestrator may perform only narrow status reconciliation after a terminal worker report and a fresh re-read prove the expected state is unambiguous.
- Never edit application code or review findings directly from the orchestrator.

### Loop safety

- One active mutable story at a time.
- One implementation or review phase owner at a time for that story.
- Stop when `max_passes_per_story` or `max_stories` is reached.
- Stop on `decision_needed`, worker blocker, platform failure, unclear status sync, or user interruption.

## Artifact validation script

Use the bundled deterministic validator for worker reports and run-ledger artifacts. It mirrors the schemas in `./references/` and uses only the Python standard library.

```bash
python3 .agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py report <worker-output-file> --extract-fence
python3 .agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py event <event-json-file>
python3 .agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py ledger <ledger-jsonl-file>
python3 .agents/skills/bmad-story-loop-orchestrator/scripts/validate_story_loop_json.py active-run <active-run-json-file>
```

Do not accept invalid worker reports. Do not append malformed ledger events. If validation fails, correct the artifact structure or stop with a blocker.

## Status discovery

Use the adapter first when available.

Adapter sequence:
1. `describe`
2. `list-stories`
3. `resolve-story <selector>` if `story_selector` is provided
4. `stage-checks --stage implementation|review --story-path <path>` before launching each worker
5. `review-scope <story_path> [baseline]` before launching a review worker

Without an adapter, use `bmad-sprint-status` in data/validate mode or directly apply its logic:
- Load `{implementation_artifacts}/sprint-status.yaml` from `_bmad/bmm/config.yaml`.
- Normalize legacy `drafted` to `ready-for-dev`.
- Valid loop statuses: `ready-for-dev`, `in-progress`, `review`.
- Terminal status: `done`.

Re-read sprint status at the start of every outer iteration and after every worker terminal report. Do not rely on cached status.

## Story selection

If `story_selector` is provided, resolve it and validate that its status is loop-eligible.

If no selector is provided, choose the next eligible story using the sprint-status recommendation order:
1. First `in-progress` story in sprint order → implementation worker.
2. First `review` story in sprint order → review worker.
3. First `ready-for-dev` story in sprint order → implementation worker.

Before the first worker starts, report:
- selected story key
- selected story path
- current story status
- entry phase (`implementation` or `review`)
- whether `auto_advance` is enabled
- worker/pass caps
- delegation and nested delegation capability status

If multiple eligible stories exist and the user did not clearly request autonomous/default operation, recommend the next story and ask for confirmation.

## Worker launch prompts

Use the prompt skeletons in `./agents/` and fill every placeholder.

### Implementation worker

Use `./agents/implementation-worker.md` and provide:
- story path
- story key
- current story status
- pass objective: `normal-implementation` or `implementation-of-review-findings`
- unresolved gating findings from the previous review pass, if any
- repo-specific implementation checks from the adapter or BMAD convention

Expected terminal state:
- completed implementation sets story and sprint status to `review`
- blocker/failure reports a clear stop reason

### Review worker

Use `./agents/review-worker.md` and provide:
- story path
- story key
- current story status
- review scope from adapter/direct discovery
- repo-specific review checks
- instruction to run `bmad-code-review` in orchestrated story-loop mode

The review worker must spawn these four nested reviewer lanes fresh and in parallel when the platform allows it:
1. Blind Hunter (`bmad-review-adversarial-general`) — scoped diff only.
2. Edge Case Hunter (`bmad-review-edge-case-hunter`) — scoped diff plus repo read access.
3. Runtime Integration Auditor (`bmad-review-runtime-integration-auditor`) — scoped diff, repo read access, story/spec context, and targeted live probes when possible.
4. Acceptance Auditor — scoped diff plus story/spec/context docs.

For BMAD stories, a missing story/spec context is a blocker for Acceptance Auditor, not a reason to silently skip it.

Expected terminal state:
- `clean` or `p3_only` sets story and sprint status to `done`
- any review round with unresolved P0/P1/P2 findings sets story and sprint status to `in-progress`; in that mixed-priority round, P3 findings remain unchecked action items alongside the P0/P1/P2 findings
- unresolved `decision_needed` stops the loop for user input
- review worker never implements fixes

## Non-blocking polling and heartbeats

When the platform supports asynchronous child handles:
1. Spawn the worker and store its handle.
2. Return immediately to orchestration control.
3. Poll the handle no more frequently than `poll_interval_seconds`.
4. Send the user a short heartbeat every 30-60 seconds with known state only.
5. Do not start another worker for the same story while a worker is active.

If the platform exposes only blocking delegation, use the longest supported wait and state that true non-blocking polling is unavailable. Do not simulate asynchronous polling.

If a wait times out or a worker replies before terminal completion, send at most one continuation probe to the same active worker:

`Continue your current assigned workflow from your current state. Do not restart from scratch. Do not change scope. Complete the remaining required steps and report only when you reach terminal completion or a true blocker.`

A worker remains active until it reports terminal completion, a true blocker, platform failure, or the user interrupts.

## Terminal report contract

Require every worker to end with a fenced `ORCHESTRATOR_REPORT` block containing **only JSON**. Validate the JSON with `scripts/validate_story_loop_json.py` before using it. Treat missing reports, malformed JSON, schema validation failures, missing required fields, enum mismatches, or unexpected extra properties as non-terminal and ask once for a corrected report.

The fenced block format must be:

```ORCHESTRATOR_REPORT
{ ...valid JSON... }
```

Do not infer missing fields from prose. Do not accept YAML, Markdown lists, or comments inside the block.

Implementation report required fields:
- `schema_version: "1.0"`
- `worker_type: implementation`
- `result: completed|blocked|failed`
- `story_key`
- `story_path`
- `story_status_after`
- `sprint_status_after`
- `validation_commands_run`
- `changed_files`
- `blocker` (empty when not blocked)
- `summary`

Review report required fields:
- `schema_version: "1.0"`
- `worker_type: review`
- `result: clean|p3_only|changes_requested|decision_needed|blocked|failed`
- `story_key`
- `story_path`
- `story_status_after`
- `sprint_status_after`
- `fanout_layers: blind|edge|runtime|acceptance` with `completed|failed|skipped` per lane
- `gating_findings`: unresolved P0/P1/P2 findings
- `p3_findings`: P3 findings with `action_item` or `deferred` disposition
- `decision_needed`: unresolved decisions requiring user input
- `deferred_work_location` if P3/deferred items were persisted
- `summary`

After accepting a schema-valid report, append `worker_report_received` to the run ledger with the full parsed report.

## Priority and gating policy

Use this priority mapping for review outcomes:
- **P0:** catastrophic correctness, security, data-loss, deployment, or system-wide failure. Always gating.
- **P1:** major accepted flow broken, important regression, or high-confidence runtime failure. Always gating.
- **P2:** correctness, edge-case, test, or integration issue likely to affect users or acceptance criteria. Gating.
- **P3:** low-risk polish, maintainability, minor coverage, documentation, or pre-existing/deferred work that does not violate acceptance criteria and does not create security, data-integrity, or runtime-failure risk. Non-gating.

Promote any P3 to P2 if it threatens an acceptance criterion, security, data integrity, critical accessibility, or user-visible runtime correctness.

P3 deferral rule:
- If a review round contains any unresolved P0/P1/P2 finding, write **all** findings from that round, including P3 findings, as unchecked story action items for the next implementation pass.
- Defer P3 findings only when the review round has **no** unresolved P0/P1/P2 or `decision_needed` findings.
- Do not let P3-only deferral hide the findings; still report each P3 and its deferral location.

## Loop transitions

After every terminal worker report, re-read the story status and sprint status before deciding.

### Implementation phase

- `completed` and status is `review` → launch a fresh review worker.
- `completed` but status is still `in-progress`/`ready-for-dev` → ask the implementation worker once for completion/status sync; if still unresolved, stop.
- `blocked`/`failed` → summarize blocker and stop.

### Review phase

- `clean` with status `done` → story complete.
- `p3_only` with status `done` → story complete; present P3 findings as non-gating.
- `changes_requested` with any unresolved P0/P1/P2 → ensure status is `in-progress`, then launch a fresh implementation worker with `implementation-of-review-findings`; include P3 action items from the same review round in the implementation scope.
- `decision_needed` → stop and present required decisions.
- `blocked`/`failed` → summarize blocker and stop.
- Report says clean/P3-only but status remains `review` → perform status-only reconciliation only if the report is explicit and no P0-P2/decision findings exist; otherwise launch a fresh review worker or stop for user input.

### Auto-advance

When a story reaches `done`:
1. Present a concise completion summary.
2. Present any P3 findings with why they are non-gating and where they were persisted.
3. If `auto_advance=true`, re-read sprint status and select the next eligible story.
4. If no eligible stories remain, stop.

## P3 presentation requirement

When unresolved P3 findings remain, show:
- title and source reviewer lane
- file/location if known
- why it is P3
- whether it is an unchecked action item because the same review round had P0/P1/P2 findings, or deferred because the round was P3-only
- if deferred, why it does not gate completion and where it was recorded for future work

Never hide P3 findings behind a generic “clean” message.

## End-of-run report

Report:
- stories processed
- final status for each story
- implementation pass count and review pass count per story
- unresolved P0/P1/P2 findings, if any
- unresolved decisions, if any
- P3 action items from mixed-priority review rounds, if any
- deferred P3-only findings and deferral locations, if any
- blockers or cap reached reasons

## Adapting this skill to a new repo

Do not hard-code repo-specific paths into this workflow. Add or update an adapter that implements `./references/adapter-contract.md` for story discovery, review scope, validation commands, and runtime wrappers.
