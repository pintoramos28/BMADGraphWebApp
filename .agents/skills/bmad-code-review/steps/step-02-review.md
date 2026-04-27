---
failed_layers: '' # set at runtime: comma-separated list of layers that failed or returned empty
---

# Step 2: Review

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- The Blind Hunter subagent receives NO project context — diff only.
- The Edge Case Hunter subagent receives diff and project read access.
- The Runtime Integration Auditor receives diff, story/spec context, project read access, and permission for targeted runtime probes when available.
- The Acceptance Auditor subagent receives diff, spec, and context docs.
- All review subagents must run at the same model capability as the current session.
- In story-loop mode, require every reviewer lane to assign P0/P1/P2/P3 priority with a concise rationale for each finding.

## INSTRUCTIONS

1. If `{review_mode}` = `"no-spec"`, note to the user: "Acceptance Auditor skipped — no spec file provided." If story-loop mode is active and `workflow.story_loop.missing_spec_context = "blocked"`, do not skip; STOP with a blocker and prepare a review `ORCHESTRATOR_REPORT` with `result = "blocked"`, `fanout_layers.acceptance = "blocked"`, and a summary explaining missing story/spec context.

2. Launch parallel subagents without conversation context. If subagents are not available and story-loop mode is active or `workflow.story_loop.missing_nested_delegation = "blocked"`, STOP with a blocker and prepare a review `ORCHESTRATOR_REPORT` with `result = "blocked"`. If subagents are not available outside story-loop mode, generate prompt files in `{implementation_artifacts}` — one per reviewer role below — and HALT. Ask the user to run each in a separate session (ideally a different LLM) and paste back the findings. When findings are pasted, resume from this point and proceed to step 3.

   - **Blind Hunter** — receives `{diff_output}` only. No spec, no context docs, no project access. Invoke via the `bmad-review-adversarial-general` skill. In story-loop mode, require P0/P1/P2/P3 priority on every finding.

   - **Edge Case Hunter** — receives `{diff_output}` and read access to the project. Invoke via the `bmad-review-edge-case-hunter` skill. In story-loop mode, require P0/P1/P2/P3 priority on every finding.

   - **Runtime Integration Auditor** (required when story-loop mode is active or `runtime` is listed in `workflow.story_loop.required_lanes`) — receives `{diff_output}`, the file at `{spec_file}` when present, loaded context docs, project read access, and permission to run targeted live probes when the environment supports them. Invoke via the `bmad-review-runtime-integration-auditor` skill. Its job includes targeted live probes for runtime-sensitive changes, not just source inspection. Tell it to use Chrome DevTools for route/console/network/storage probes when a browser target is available, or load `playwright-cli` and use Playwright CLI when scripted hostile-state, file input, persisted profile, storage seeding, or repeated interaction probes are needed. If live probes cannot run, the lane may still complete with static/runtime-risk analysis, but it must report that limitation. In story-loop mode, require P0/P1/P2/P3 priority on every finding.

   - **Acceptance Auditor** (only if `{review_mode}` = `"full"`) — receives `{diff_output}`, the content of the file at `{spec_file}`, and any loaded context docs. Its prompt:
      > You are an Acceptance Auditor. Review this diff against the spec and context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code. Output findings as a Markdown list. Each finding: one-line title, P0/P1/P2/P3 priority with rationale when story-loop mode is active, which AC/constraint it violates, and evidence from the diff.

3. **Subagent failure handling**: If any subagent fails, times out, or returns empty results, append the layer name to `{failed_layers}` (comma-separated). In normal interactive mode, proceed with findings from the remaining layers. In story-loop mode, proceed only when the failed lane is non-required; if any lane in `workflow.story_loop.required_lanes` fails and cannot produce findings, report that lane as `failed` or `blocked` in `fanout_layers` and prepare a terminal `ORCHESTRATOR_REPORT` with `result = "blocked"` unless the orchestrator explicitly allowed degraded review.

4. Collect all findings from the completed layers.


## NEXT

Read fully and follow `./step-03-triage.md`
