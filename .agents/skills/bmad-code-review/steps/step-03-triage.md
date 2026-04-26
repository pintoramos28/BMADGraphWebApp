---
---

# Step 3: Triage

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- Be precise. When uncertain between categories, prefer the more conservative classification.

## INSTRUCTIONS

1. **Normalize** findings into a common format. Expected input formats:
   - Adversarial (Blind Hunter): markdown list of descriptions, ideally with P0/P1/P2/P3 priority
   - Edge Case Hunter: JSON array with `location`, `trigger_condition`, `guard_snippet`, `potential_consequence`, and optional `priority` fields
   - Runtime Integration Auditor: JSON array with `location`, `runtime_surface`, `failure_mode`, `required_probe`, `potential_user_effect`, and optional `priority` fields
   - Acceptance Auditor: markdown list with title, priority, AC/constraint reference, and evidence

   If a layer's output does not match its expected format, attempt best-effort parsing. Note any parsing issues for the user.

   Convert all to a unified list where each finding has:
   - `id` -- sequential integer
   - `source` -- `blind`, `edge`, `runtime`, `acceptance`, or merged sources (e.g., `blind+runtime`); normalize Acceptance Auditor findings to `acceptance` for the story-loop report schema.
   - `title` -- one-line summary
   - `detail` -- full description
   - `location` -- file and line reference (if available)
   - `priority` -- P0, P1, P2, or P3
   - `priority_rationale` -- one-line reason. If a reviewer lane omitted the rationale, synthesize the shortest conservative rationale from impact, acceptance-criteria risk, data-integrity risk, or runtime evidence before persisting the finding.

2. **Deduplicate.** If two or more findings describe the same issue, merge them into one:
   - Use the most specific finding as the base (prefer structured JSON with location and concrete runtime or guard detail over adversarial prose).
   - Append any unique detail, reasoning, or location references from the other finding(s) into the surviving `detail` field.
   - Set `source` to the merged sources (e.g., `blind+edge`).

3. **Classify** each finding into exactly one bucket:
   - **decision_needed** -- There is an ambiguous choice that requires human input. The code cannot be correctly patched without knowing the user's intent. Only possible if `{review_mode}` = `"full"`.
   - **patch** -- Code issue that is fixable without human input. The correct fix is unambiguous.
   - **defer** -- Pre-existing issue not caused by the current change. Real but not actionable now.
   - **dismiss** -- Noise, false positive, or handled elsewhere.

   If `{review_mode}` = `"no-spec"` and a finding would otherwise be `decision_needed`, reclassify it as `patch` (if the fix is unambiguous) or `defer` (if not).

   Also assign or verify priority:
   - **P0:** catastrophic correctness, security, data-loss, deployment, or system-wide failure.
   - **P1:** major accepted flow broken, important regression, or high-confidence runtime failure.
   - **P2:** correctness, edge-case, test, or integration issue likely to affect users or acceptance criteria.
   - **P3:** low-risk polish, maintainability, minor coverage, documentation, or pre-existing/deferred work that does not violate acceptance criteria and does not create security, data-integrity, or runtime-failure risk.

   Promote any P3 to P2 if it threatens an acceptance criterion, security, data integrity, critical accessibility, or user-visible runtime correctness. When unsure, prefer the higher priority.

4. **Drop** all `dismiss` findings. Record the dismiss count for the summary.

5. If `{failed_layers}` is non-empty, report which layers failed before announcing results. If zero findings remain after dropping dismissed AND `{failed_layers}` is non-empty, warn the user that the review may be incomplete rather than announcing a clean review.

6. If zero findings remain after triage (all rejected or none raised): state "✅ Clean review — all layers passed." (Step 3 already warned if any review layers failed via `{failed_layers}`.)


## NEXT

Read fully and follow `./step-04-present.md`
