---
failed_layers: '' # set at runtime: comma-separated list of layers that failed or returned empty
orchestration_mode: '' # set at workflow entry; step files must preserve caller-provided "story-loop"
---

# Step 2: Review

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- The Blind Hunter subagent receives NO project context — diff only.
- The Edge Case Hunter subagent receives diff and project read access.
- The Runtime Integration Auditor subagent receives diff and project read access. When available, it also receives the spec and context docs.
- The Runtime Integration Auditor MUST perform targeted live validation when the diff touches runtime-sensitive surfaces and the current environment allows it. If live validation cannot be performed, it must say that explicitly and treat the missing probe as part of the review risk.
- The Acceptance Auditor subagent receives diff, spec, and context docs.
- In `story-loop` orchestration mode, these reviewer lanes must be nested under the review worker. If nested subagents are unavailable, report a blocker rather than generating manual prompt files.
- Every reviewer lane should assign each finding a P0/P1/P2/P3 priority with a concise rationale.

## INSTRUCTIONS

1. If `{review_mode}` = `"no-spec"`, note to the user: "Acceptance Auditor skipped — no spec file provided. Runtime Integration Auditor still runs."

2. Launch parallel subagents without conversation context. If subagents are not available and `{orchestration_mode}` = `"story-loop"`, return a schema-valid terminal `ORCHESTRATOR_REPORT` with `result: blocked`, `summary: "Nested reviewer fan-out unavailable"`, every required fanout layer set to `blocked`, and no findings. If subagents are not available in interactive mode, generate prompt files in `{implementation_artifacts}` — one per reviewer role below — and HALT. Ask the user to run each in a separate session (ideally a different LLM) and paste back the findings. When findings are pasted, resume from this point and proceed to step 3.

   - **Blind Hunter** — receives `{diff_output}` only. No spec, no context docs, no project access. Invoke via the `bmad-review-adversarial-general` skill. Require P0/P1/P2/P3 priority on every finding.

   - **Edge Case Hunter** — receives `{diff_output}` and read access to the project. Invoke via the `bmad-review-edge-case-hunter` skill. Require P0/P1/P2/P3 priority on every finding.

   - **Runtime Integration Auditor** — receives `{diff_output}`, read access to the project, and if available the content of `{spec_file}` plus any loaded context docs. Invoke via the `bmad-review-runtime-integration-auditor` skill. Its job includes targeted live probes for runtime-sensitive changes, not just source inspection. Require P0/P1/P2/P3 priority on every finding.

   - **Acceptance Auditor** (only if `{review_mode}` = `"full"`) — receives `{diff_output}`, the content of the file at `{spec_file}`, and any loaded context docs. Its prompt:
     > You are an Acceptance Auditor. Review this diff against the spec and context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code. Output findings as a Markdown list. Each finding: one-line title, P0/P1/P2/P3 priority with rationale, which AC/constraint it violates, and evidence from the diff.

3. **Subagent failure handling**: If any required subagent fails, times out, or returns empty results, append the layer name to `{failed_layers}` (comma-separated). In `story-loop` mode, required lane failure is a gating blocker: do not return `clean`, `p3_only`, or `done`; set the failed lane status to `failed` or `blocked` and return `result: blocked` or `failed` unless a stricter decision-needed or P0/P1/P2 outcome is already present.

4. Collect all findings from the completed layers.


## NEXT

Read fully and follow `./step-03-triage.md`
