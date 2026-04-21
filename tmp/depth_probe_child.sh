#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/home/pin81845/repo/BMADGraphWebApp"
SCHEMA="$WORKDIR/tmp/depth_probe_schema.json"
SCRIPT="$WORKDIR/tmp/depth_probe_child.sh"

depth="${1:?depth required}"

make_chain() {
  seq 1 "$1" | jq -s '.'
}

make_result() {
  local result_depth="$1"
  local child_spawned="$2"
  local stop_reason="$3"
  local failure_message="$4"
  local chain_json="$5"

  jq -cn \
    --argjson depth "$result_depth" \
    --argjson child_spawned "$child_spawned" \
    --arg stop_reason "$stop_reason" \
    --arg failure_message "$failure_message" \
    --argjson chain "$chain_json" \
    '{depth:$depth,child_spawned:$child_spawned,stop_reason:$stop_reason,failure_message:$failure_message,chain:$chain}'
}

if [[ "$depth" -ge 20 ]]; then
  make_result "$depth" false "cap_reached" "" "$(make_chain "$depth")"
  exit 0
fi

next_depth=$((depth + 1))
outfile="$(mktemp)"
stderrfile="$(mktemp)"
promptfile="$(mktemp)"

cat >"$promptfile" <<EOF
You are running a nested sub-agent depth probe inside the Codex app.

Your current depth is $depth.

Protocol:
1. If your depth is 20, do not spawn a child and return strict JSON:
{"depth":$depth,"child_spawned":false,"stop_reason":"cap_reached","failure_message":"","chain":[1]}
2. Otherwise, immediately attempt to spawn exactly one child agent at depth $next_depth by executing this exact shell command:
\`$SCRIPT $next_depth\`
3. Wait only for that direct child command to finish.
4. If the command fails or its stdout is not valid JSON matching the schema at \`$SCHEMA\`, return:
{"depth":$depth,"child_spawned":false,"stop_reason":"spawn_failed","failure_message":"<actual error>","chain":[1]}
5. If the command succeeds and returns valid JSON, return:
{"depth":$depth,"child_spawned":true,"stop_reason":"child_reported_stop","failure_message":"","chain":child.chain}

Rules:
- Do not do unrelated exploration.
- Do not inspect files other than using the given shell command.
- Return JSON only.
EOF

if ! codex exec \
  --ephemeral \
  --dangerously-bypass-approvals-and-sandbox \
  -C "$WORKDIR" \
  --output-schema "$SCHEMA" \
  -o "$outfile" \
  - <"$promptfile" 2>"$stderrfile"
then
  failure_message="$(cat "$stderrfile")"
  if [[ -z "$failure_message" ]]; then
    failure_message="codex exec exited non-zero"
  fi
  make_result "$depth" false "spawn_failed" "$failure_message" "$(make_chain "$depth")"
  exit 0
fi

if [[ ! -s "$outfile" ]]; then
  failure_message="child produced no output"
  stderr_text="$(cat "$stderrfile")"
  if [[ -n "$stderr_text" ]]; then
    failure_message="$failure_message: $stderr_text"
  fi
  make_result "$depth" false "spawn_failed" "$failure_message" "$(make_chain "$depth")"
  exit 0
fi

if ! child_json="$(jq -c . "$outfile" 2>"$stderrfile")"; then
  failure_message="$(cat "$stderrfile")"
  raw_output="$(cat "$outfile")"
  if [[ -n "$raw_output" ]]; then
    failure_message="invalid child JSON: $failure_message; raw: $raw_output"
  fi
  make_result "$depth" false "spawn_failed" "$failure_message" "$(make_chain "$depth")"
  exit 0
fi

chain_json="$(jq -c '.chain' "$outfile" 2>"$stderrfile" || true)"
if [[ -z "$chain_json" ]]; then
  failure_message="$(cat "$stderrfile")"
  make_result "$depth" false "spawn_failed" "child JSON missing chain: $failure_message" "$(make_chain "$depth")"
  exit 0
fi

make_result "$depth" true "child_reported_stop" "" "$chain_json"
