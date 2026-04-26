#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config_path="$repo_root/_bmad/bmm/config.yaml"
sprint_status_path="$repo_root/_bmad-output/implementation-artifacts/sprint-status.yaml"
implementation_artifacts="$repo_root/_bmad-output/implementation-artifacts"

cmd="${1:-}"
shift || true

json_escape() {
  python3 - "$1" <<'PY'
import json
import sys
print(json.dumps(sys.argv[1]))
PY
}

describe() {
  cat <<EOF
{
  "project_name": "BMADGraphWebApp",
  "config_path": $(json_escape "$config_path"),
  "sprint_status_path": $(json_escape "$sprint_status_path"),
  "implementation_skill": "bmad-dev-story",
  "review_skill": "bmad-code-review",
  "statuses": {
    "ready": "ready-for-dev",
    "in_progress": "in-progress",
    "review": "review",
    "done": "done"
  },
  "checks": {
    "implementation": [
      "bash ./scripts/with-node.sh npm run typecheck",
      "bash ./scripts/with-node.sh npm test",
      "bash ./scripts/with-node.sh npm run lint"
    ],
    "review": [
      "bash ./scripts/with-node.sh npm run typecheck",
      "bash ./scripts/with-node.sh npm test",
      "bash ./scripts/with-node.sh npm run lint",
      "bash ./scripts/with-node.sh npm run build"
    ]
  }
}
EOF
}

list_stories() {
  python3 - "$sprint_status_path" "$implementation_artifacts" <<'PY'
import json
import pathlib
import re
import sys

sprint_status = pathlib.Path(sys.argv[1])
story_root = pathlib.Path(sys.argv[2])
stories = []
in_dev = False

if not sprint_status.exists():
    print(json.dumps({"stories": []}, indent=2))
    raise SystemExit(0)

for raw_line in sprint_status.read_text(encoding="utf-8").splitlines():
    if raw_line.startswith("development_status:"):
        in_dev = True
        continue
    if not in_dev:
        continue
    if raw_line and not raw_line.startswith("  "):
        break
    match = re.match(r"^\s{2}([a-z0-9-]+):\s+([a-z-]+)\s*$", raw_line)
    if not match:
        continue
    key, status = match.groups()
    if key.startswith("epic-") or key.endswith("-retrospective"):
        continue
    stories.append(
        {
            "key": key,
            "status": status,
            "path": str((story_root / f"{key}.md").resolve()),
        }
    )

print(json.dumps({"stories": stories}, indent=2))
PY
}

resolve_story() {
  selector="${1:-}"
  if [[ -z "$selector" ]]; then
    echo '{"exists": false, "error": "story selector is required"}'
    exit 1
  fi

  python3 - "$selector" "$sprint_status_path" "$implementation_artifacts" <<'PY'
import json
import pathlib
import re
import sys

selector = sys.argv[1]
sprint_status = pathlib.Path(sys.argv[2])
story_root = pathlib.Path(sys.argv[3])

status_by_key = {}
if sprint_status.exists():
    in_dev = False
    for raw_line in sprint_status.read_text(encoding="utf-8").splitlines():
        if raw_line.startswith("development_status:"):
            in_dev = True
            continue
        if not in_dev:
            continue
        if raw_line and not raw_line.startswith("  "):
            break
        match = re.match(r"^\s{2}([a-z0-9-]+):\s+([a-z-]+)\s*$", raw_line)
        if match:
            key, status = match.groups()
            status_by_key[key] = status

selector_path = pathlib.Path(selector)
if selector_path.suffix == ".md" or selector_path.exists():
    story_path = selector_path if selector_path.is_absolute() else (pathlib.Path.cwd() / selector_path)
    story_path = story_path.resolve()
    story_key = story_path.stem
else:
    story_key = selector
    story_path = (story_root / f"{story_key}.md").resolve()

result = {
    "story_key": story_key,
    "story_path": str(story_path),
    "story_status": status_by_key.get(story_key),
    "exists": story_path.exists(),
}
print(json.dumps(result, indent=2))
PY
}

review_scope() {
  story_path="${1:-}"
  baseline="${2:-HEAD}"
  if [[ -z "$story_path" ]]; then
    echo '{"error": "story_path is required"}'
    exit 1
  fi

  python3 - "$repo_root" "$story_path" "$baseline" <<'PY'
import json
import pathlib
import re
import subprocess
import sys

repo_root = pathlib.Path(sys.argv[1]).resolve()
story_path = pathlib.Path(sys.argv[2]).resolve()
baseline = sys.argv[3]
story_key = story_path.stem
story_prefix = "-".join(story_key.split("-")[:2])

file_list = []
in_file_list = False
story_rel = str(story_path.relative_to(repo_root)) if story_path.is_relative_to(repo_root) else str(story_path)
if story_path.exists():
    for raw_line in story_path.read_text(encoding="utf-8").splitlines():
        if raw_line.strip() == "### File List":
            in_file_list = True
            continue
        if in_file_list and raw_line.startswith("#"):
            break
        if in_file_list and raw_line.startswith("- "):
            value = raw_line[2:].strip()
            match = re.match(r"^`([^`]+)`$", value)
            if match:
                value = match.group(1).strip()
            if value and not value.startswith("[") and " " not in value:
                file_list.append(value)

file_list_set = set(file_list)

def in_story_scratch_scope(path: str) -> bool:
    return path.startswith(f"tmp/story-{story_prefix}-") or path.startswith(f"tmp/{story_key}/")

def keep_path(path: str) -> bool:
    return path in file_list_set or path == story_rel or in_story_scratch_scope(path)

status_lines = subprocess.run(
    ["git", "status", "--short"],
    cwd=repo_root,
    text=True,
    capture_output=True,
    check=True,
).stdout.splitlines()

tracked_changed = []
untracked = []
deleted = []
all_tracked_changed = []
all_untracked = []
all_deleted = []
for line in status_lines:
    code = line[:2]
    path = line[3:].strip()
    if not path:
        continue
    if code == "??":
        all_untracked.append(path)
        if keep_path(path):
            untracked.append(path)
        continue
    if "D" in code:
        all_deleted.append(path)
        if keep_path(path):
            deleted.append(path)
    else:
        all_tracked_changed.append(path)
        if keep_path(path):
            tracked_changed.append(path)

scope = sorted(set(file_list + tracked_changed + untracked + deleted))

print(
    json.dumps(
        {
            "baseline": baseline,
            "file_list": file_list,
            "tracked_changed": sorted(set(tracked_changed)),
            "untracked": sorted(set(untracked)),
            "deleted": sorted(set(deleted)),
            "all_tracked_changed": sorted(set(all_tracked_changed)),
            "all_untracked": sorted(set(all_untracked)),
            "all_deleted": sorted(set(all_deleted)),
            "scope": scope,
        },
        indent=2,
    )
)
PY
}

stage_checks() {
  stage=""
  story_path=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --stage)
        stage="${2:-}"
        shift 2
        ;;
      --story-path)
        story_path="${2:-}"
        shift 2
        ;;
      *)
        echo "{\"error\":\"unknown arg $1\"}"
        exit 1
        ;;
    esac
  done

  if [[ -z "$stage" ]]; then
    echo '{"error":"--stage is required"}'
    exit 1
  fi

  case "$stage" in
    implementation)
      cat <<EOF
{
  "stage": "implementation",
  "story_path": $(json_escape "$story_path"),
  "commands": [
    "bash ./scripts/with-node.sh npm run typecheck",
    "bash ./scripts/with-node.sh npm test",
    "bash ./scripts/with-node.sh npm run lint"
  ]
}
EOF
      ;;
    review)
      cat <<EOF
{
  "stage": "review",
  "story_path": $(json_escape "$story_path"),
  "commands": [
    "bash ./scripts/with-node.sh npm run typecheck",
    "bash ./scripts/with-node.sh npm test",
    "bash ./scripts/with-node.sh npm run lint",
    "bash ./scripts/with-node.sh npm run build"
  ]
}
EOF
      ;;
    *)
      echo "{\"error\":\"unknown stage $stage\"}"
      exit 1
      ;;
  esac
}

case "$cmd" in
  describe)
    describe
    ;;
  list-stories)
    list_stories
    ;;
  resolve-story)
    resolve_story "$@"
    ;;
  review-scope)
    review_scope "$@"
    ;;
  stage-checks)
    stage_checks "$@"
    ;;
  *)
    echo '{"error":"expected one of: describe, list-stories, resolve-story, review-scope, stage-checks"}'
    exit 1
    ;;
esac
