# Adapter Contract

The orchestrator skill is portable because repo-specific behavior lives behind an adapter command.

## Why the adapter exists

Different repos vary on:
- where sprint status lives
- how stories are named
- how review scope should be collected
- which validation commands are required
- which runtime wrapper must be used

The adapter hides those differences and returns compact JSON.

## Required subcommands

Assume the adapter command is executable as:

```bash
./.story-loop/adapter.sh <subcommand> [args...]
```

### `describe`

Return JSON with repo-level orchestration metadata.

Example shape:

```json
{
  "project_name": "BMADGraphWebApp",
  "config_path": "/abs/path/_bmad/bmm/config.yaml",
  "sprint_status_path": "/abs/path/_bmad-output/implementation-artifacts/sprint-status.yaml",
  "implementation_skill": "bmad-dev-story",
  "review_skill": "bmad-code-review",
  "statuses": {
    "ready": "ready-for-dev",
    "in_progress": "in-progress",
    "review": "review",
    "done": "done"
  },
  "checks": {
    "implementation": ["bash ./scripts/with-node.sh npm run typecheck"],
    "review": ["bash ./scripts/with-node.sh npm run lint"]
  }
}
```

### `list-stories`

Return ordered story metadata from the sprint tracker. Do not pre-filter out `review` or `in-progress` stories; the orchestrator needs the full ordered set so it can present all loop-eligible targets.

Example shape:

```json
{
  "stories": [
    {
      "key": "2-1-import-csv",
      "status": "review",
      "path": "/abs/path/_bmad-output/implementation-artifacts/2-1-import-csv.md"
    }
  ]
}
```

### `resolve-story <selector>`

Accept either a story key or an absolute/relative story path.

Example shape:

```json
{
  "story_key": "2-1-import-csv",
  "story_path": "/abs/path/_bmad-output/implementation-artifacts/2-1-import-csv.md",
  "story_status": "review",
  "exists": true
}
```

### `review-scope <story_path> [baseline]`

Return the union of:
- files listed in the story `File List`
- tracked files changed relative to the baseline
- untracked files created for the story
- deleted files in scope

Example shape:

```json
{
  "baseline": "HEAD",
  "file_list": ["src/foo.ts"],
  "tracked_changed": ["src/foo.ts"],
  "untracked": ["src/bar.ts"],
  "deleted": [],
  "scope": ["src/bar.ts", "src/foo.ts"]
}
```

### `stage-checks --stage implementation|review [--story-path <path>]`

Return a JSON array of shell commands that workers should run or reference for environment-aware validation.

Example shape:

```json
{
  "stage": "implementation",
  "commands": [
    "bash ./scripts/with-node.sh npm run typecheck",
    "bash ./scripts/with-node.sh npm test"
  ]
}
```

## Design constraints

- Output JSON only.
- Use absolute paths where possible.
- Do not mutate story status or sprint status.
- Keep adapter logic deterministic and side-effect free.
- Prefer standard shell plus `python3` from the stdlib over extra dependencies.

## Repo customization guidance

For a new repo, keep the orchestrator unchanged and replace only:
- status file discovery
- story resolution rules
- review-scope construction
- validation command selection
- runtime wrappers such as `nvm`, `uv`, `poetry`, `cargo`, `just`, or container entrypoints
