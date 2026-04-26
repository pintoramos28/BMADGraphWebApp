#!/usr/bin/env python3
"""Validate BMAD story-loop JSON artifacts without external dependencies.

Usage:
  validate_story_loop_json.py report <file|-> [--extract-fence]
  validate_story_loop_json.py ledger <file>
  validate_story_loop_json.py event <file|->
  validate_story_loop_json.py active-run <file>

The validator intentionally mirrors the bundled JSON schema files while using only
the Python standard library, so orchestrator sessions can enforce report and
ledger contracts without installing jsonschema.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


STATUS = {
    "backlog",
    "ready-for-dev",
    "in-progress",
    "review",
    "done",
    "no-sprint-tracking",
    "unknown",
}
IMPLEMENTATION_RESULTS = {"completed", "blocked", "failed"}
REVIEW_RESULTS = {"clean", "p3_only", "changes_requested", "decision_needed", "blocked", "failed"}
FANOUT_STATUS = {"completed", "failed", "skipped", "blocked"}
SOURCES = {"blind", "edge", "runtime", "acceptance", "review-worker"}
PHASES = {None, "startup", "selection", "implementation", "review", "transition", "complete", "blocked"}
RUN_STATES = {"starting", "running", "waiting", "blocked", "completed", "abandoned", "failed"}
EVENT_TYPES = {
    "run_started",
    "story_selected",
    "phase_started",
    "worker_spawned",
    "heartbeat",
    "worker_report_received",
    "status_reread",
    "transition_decided",
    "story_completed",
    "worker_lost",
    "run_blocked",
    "run_completed",
    "run_abandoned",
}


class ValidationError(Exception):
    """Raised when an artifact fails validation."""


def fail(path: str, message: str) -> None:
    raise ValidationError(f"{path}: {message}")


def read_text(path_arg: str) -> str:
    if path_arg == "-":
        return sys.stdin.read()
    return Path(path_arg).read_text(encoding="utf-8")


def parse_json_text(text: str, path: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        fail(path, f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")


def parse_report_text(text: str, extract_fence: bool, path: str) -> Any:
    if extract_fence:
        matches = re.findall(r"```ORCHESTRATOR_REPORT\s*(.*?)```", text, flags=re.DOTALL)
        if not matches:
            fail(path, "missing fenced ORCHESTRATOR_REPORT block")
        if len(matches) > 1:
            fail(path, "multiple ORCHESTRATOR_REPORT blocks found")
        text = matches[0].strip()
    return parse_json_text(text, path)


def expect_object(value: Any, path: str, required: Iterable[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(path, f"expected object, got {type(value).__name__}")
    required_set = set(required)
    keys = set(value.keys())
    missing = sorted(required_set - keys)
    extra = sorted(keys - required_set)
    if missing:
        fail(path, f"missing required field(s): {', '.join(missing)}")
    if extra:
        fail(path, f"unexpected field(s): {', '.join(extra)}")
    return value


def expect_string(value: Any, path: str, *, non_empty: bool = False) -> str:
    if not isinstance(value, str):
        fail(path, f"expected string, got {type(value).__name__}")
    if non_empty and not value:
        fail(path, "expected non-empty string")
    return value


def expect_nullable_string(value: Any, path: str) -> str | None:
    if value is None:
        return None
    return expect_string(value, path)


def expect_enum(value: Any, allowed: set[Any], path: str) -> Any:
    if value not in allowed:
        shown = ", ".join(repr(item) for item in sorted(allowed, key=lambda item: str(item)))
        fail(path, f"expected one of {shown}, got {value!r}")
    return value


def expect_string_array(value: Any, path: str) -> list[str]:
    if not isinstance(value, list):
        fail(path, f"expected array, got {type(value).__name__}")
    for index, item in enumerate(value):
        expect_string(item, f"{path}[{index}]")
    return value


def expect_nonempty_string_array(value: Any, path: str) -> list[str]:
    array = expect_string_array(value, path)
    if not array:
        fail(path, "expected at least one item")
    for index, item in enumerate(array):
        if not item:
            fail(f"{path}[{index}]", "expected non-empty string")
    return array


def expect_datetime(value: Any, path: str) -> None:
    text = expect_string(value, path, non_empty=True)
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        fail(path, "expected ISO-8601 date-time string")


def validate_fanout_layers(value: Any, path: str) -> None:
    obj = expect_object(value, path, ["blind", "edge", "runtime", "acceptance"])
    for key in ["blind", "edge", "runtime", "acceptance"]:
        expect_enum(obj[key], FANOUT_STATUS, f"{path}.{key}")


def validate_gating_finding(value: Any, path: str) -> None:
    obj = expect_object(value, path, ["id", "priority", "title", "detail", "source", "location", "action_state"])
    expect_string(obj["id"], f"{path}.id", non_empty=True)
    expect_enum(obj["priority"], {"P0", "P1", "P2"}, f"{path}.priority")
    expect_string(obj["title"], f"{path}.title", non_empty=True)
    expect_string(obj["detail"], f"{path}.detail", non_empty=True)
    sources = expect_nonempty_string_array(obj["source"], f"{path}.source")
    for index, source in enumerate(sources):
        expect_enum(source, SOURCES, f"{path}.source[{index}]")
    expect_nullable_string(obj["location"], f"{path}.location")
    expect_enum(obj["action_state"], {"action_item"}, f"{path}.action_state")


def validate_p3_finding(value: Any, path: str) -> None:
    obj = expect_object(
        value,
        path,
        [
            "id",
            "priority",
            "title",
            "detail",
            "source",
            "location",
            "action_state",
            "p3_rationale",
            "disposition_reason",
        ],
    )
    expect_string(obj["id"], f"{path}.id", non_empty=True)
    expect_enum(obj["priority"], {"P3"}, f"{path}.priority")
    expect_string(obj["title"], f"{path}.title", non_empty=True)
    expect_string(obj["detail"], f"{path}.detail", non_empty=True)
    sources = expect_nonempty_string_array(obj["source"], f"{path}.source")
    for index, source in enumerate(sources):
        expect_enum(source, SOURCES, f"{path}.source[{index}]")
    expect_nullable_string(obj["location"], f"{path}.location")
    expect_enum(obj["action_state"], {"action_item", "deferred"}, f"{path}.action_state")
    expect_string(obj["p3_rationale"], f"{path}.p3_rationale", non_empty=True)
    expect_string(obj["disposition_reason"], f"{path}.disposition_reason", non_empty=True)


def validate_decision_item(value: Any, path: str) -> None:
    obj = expect_object(value, path, ["id", "title", "detail", "options", "location"])
    expect_string(obj["id"], f"{path}.id", non_empty=True)
    expect_string(obj["title"], f"{path}.title", non_empty=True)
    expect_string(obj["detail"], f"{path}.detail", non_empty=True)
    expect_nonempty_string_array(obj["options"], f"{path}.options")
    expect_nullable_string(obj["location"], f"{path}.location")


def validate_implementation_report(obj: dict[str, Any], path: str) -> None:
    obj = expect_object(
        obj,
        path,
        [
            "schema_version",
            "worker_type",
            "result",
            "story_key",
            "story_path",
            "story_status_after",
            "sprint_status_after",
            "validation_commands_run",
            "changed_files",
            "blocker",
            "summary",
        ],
    )
    expect_enum(obj["schema_version"], {"1.0"}, f"{path}.schema_version")
    expect_enum(obj["worker_type"], {"implementation"}, f"{path}.worker_type")
    result = expect_enum(obj["result"], IMPLEMENTATION_RESULTS, f"{path}.result")
    expect_string(obj["story_key"], f"{path}.story_key", non_empty=True)
    expect_string(obj["story_path"], f"{path}.story_path", non_empty=True)
    expect_enum(obj["story_status_after"], STATUS, f"{path}.story_status_after")
    expect_enum(obj["sprint_status_after"], STATUS, f"{path}.sprint_status_after")
    expect_string_array(obj["validation_commands_run"], f"{path}.validation_commands_run")
    expect_string_array(obj["changed_files"], f"{path}.changed_files")
    blocker = expect_nullable_string(obj["blocker"], f"{path}.blocker")
    expect_string(obj["summary"], f"{path}.summary", non_empty=True)
    if result == "completed" and blocker:
        fail(f"{path}.blocker", "must be null or empty when result is completed")
    if result in {"blocked", "failed"} and not blocker:
        fail(f"{path}.blocker", "must describe the blocker/failure")


def validate_review_report(obj: dict[str, Any], path: str) -> None:
    obj = expect_object(
        obj,
        path,
        [
            "schema_version",
            "worker_type",
            "result",
            "story_key",
            "story_path",
            "story_status_after",
            "sprint_status_after",
            "fanout_layers",
            "gating_findings",
            "p3_findings",
            "decision_needed",
            "deferred_work_location",
            "summary",
        ],
    )
    expect_enum(obj["schema_version"], {"1.0"}, f"{path}.schema_version")
    expect_enum(obj["worker_type"], {"review"}, f"{path}.worker_type")
    result = expect_enum(obj["result"], REVIEW_RESULTS, f"{path}.result")
    expect_string(obj["story_key"], f"{path}.story_key", non_empty=True)
    expect_string(obj["story_path"], f"{path}.story_path", non_empty=True)
    story_status = expect_enum(obj["story_status_after"], STATUS, f"{path}.story_status_after")
    sprint_status = expect_enum(obj["sprint_status_after"], STATUS, f"{path}.sprint_status_after")
    fanout_layers = obj["fanout_layers"]
    validate_fanout_layers(fanout_layers, f"{path}.fanout_layers")

    gating = obj["gating_findings"]
    if not isinstance(gating, list):
        fail(f"{path}.gating_findings", f"expected array, got {type(gating).__name__}")
    for index, item in enumerate(gating):
        validate_gating_finding(item, f"{path}.gating_findings[{index}]")

    p3 = obj["p3_findings"]
    if not isinstance(p3, list):
        fail(f"{path}.p3_findings", f"expected array, got {type(p3).__name__}")
    for index, item in enumerate(p3):
        validate_p3_finding(item, f"{path}.p3_findings[{index}]")

    decisions = obj["decision_needed"]
    if not isinstance(decisions, list):
        fail(f"{path}.decision_needed", f"expected array, got {type(decisions).__name__}")
    for index, item in enumerate(decisions):
        validate_decision_item(item, f"{path}.decision_needed[{index}]")

    expect_nullable_string(obj["deferred_work_location"], f"{path}.deferred_work_location")
    expect_string(obj["summary"], f"{path}.summary", non_empty=True)

    if result == "clean":
        if gating or p3 or decisions:
            fail(path, "clean review cannot include gating, P3, or decision findings")
    elif result == "p3_only":
        if gating or decisions:
            fail(path, "p3_only review cannot include gating or decision findings")
        if not p3:
            fail(f"{path}.p3_findings", "p3_only review requires at least one P3 finding")
        if any(item["action_state"] != "deferred" for item in p3):
            fail(f"{path}.p3_findings", "p3_only findings must be deferred")
    elif result == "changes_requested":
        if not gating:
            fail(f"{path}.gating_findings", "changes_requested requires at least one P0/P1/P2 finding")
        if story_status != "in-progress" or sprint_status not in {"in-progress", "no-sprint-tracking"}:
            fail(path, "changes_requested must leave story/sprint status in-progress")
    elif result == "decision_needed":
        if not decisions:
            fail(f"{path}.decision_needed", "decision_needed result requires at least one decision item")
        if story_status != "in-progress" or sprint_status not in {"in-progress", "no-sprint-tracking"}:
            fail(path, "decision_needed must leave story/sprint status in-progress")
    elif result in {"blocked", "failed"}:
        if story_status == "done" or sprint_status == "done":
            fail(path, "blocked or failed review cannot leave story/sprint status done")

    if result in {"clean", "p3_only"}:
        if story_status != "done" or sprint_status not in {"done", "no-sprint-tracking"}:
            fail(path, "clean or p3_only review must leave story/sprint status done")
        incomplete_layers = {
            layer: status
            for layer, status in fanout_layers.items()
            if status != "completed"
        }
        if incomplete_layers:
            fail(
                f"{path}.fanout_layers",
                "clean or p3_only review requires all fanout layers completed; incomplete layers: "
                + ", ".join(f"{layer}={status}" for layer, status in sorted(incomplete_layers.items())),
            )

    if not gating:
        action_p3 = [item for item in p3 if item["action_state"] == "action_item"]
        if action_p3:
            fail(f"{path}.p3_findings", "P3 findings may be action items only when gating findings are present")


def validate_report(value: Any, path: str) -> str:
    if not isinstance(value, dict):
        fail(path, f"expected report object, got {type(value).__name__}")
    worker_type = value.get("worker_type")
    if worker_type == "implementation":
        validate_implementation_report(value, path)
        return "implementation"
    if worker_type == "review":
        validate_review_report(value, path)
        return "review"
    fail(f"{path}.worker_type", "expected 'implementation' or 'review'")


def validate_ledger_event(value: Any, path: str) -> tuple[str, int]:
    obj = expect_object(value, path, ["schema_version", "run_id", "timestamp", "sequence", "event_type", "story_key", "phase", "data"])
    expect_enum(obj["schema_version"], {"1.0"}, f"{path}.schema_version")
    run_id = expect_string(obj["run_id"], f"{path}.run_id", non_empty=True)
    expect_datetime(obj["timestamp"], f"{path}.timestamp")
    sequence = obj["sequence"]
    if not isinstance(sequence, int) or sequence < 1:
        fail(f"{path}.sequence", "expected integer >= 1")
    expect_enum(obj["event_type"], EVENT_TYPES, f"{path}.event_type")
    expect_nullable_string(obj["story_key"], f"{path}.story_key")
    expect_enum(obj["phase"], PHASES, f"{path}.phase")
    if not isinstance(obj["data"], dict):
        fail(f"{path}.data", f"expected object, got {type(obj['data']).__name__}")
    return run_id, sequence


def validate_active_run(value: Any, path: str) -> None:
    obj = expect_object(
        value,
        path,
        [
            "schema_version",
            "run_id",
            "ledger_file",
            "current_story_key",
            "phase",
            "worker_handle",
            "state",
            "updated_at",
            "last_sequence",
        ],
    )
    expect_enum(obj["schema_version"], {"1.0"}, f"{path}.schema_version")
    expect_string(obj["run_id"], f"{path}.run_id", non_empty=True)
    expect_string(obj["ledger_file"], f"{path}.ledger_file", non_empty=True)
    expect_nullable_string(obj["current_story_key"], f"{path}.current_story_key")
    expect_enum(obj["phase"], PHASES, f"{path}.phase")
    expect_nullable_string(obj["worker_handle"], f"{path}.worker_handle")
    expect_enum(obj["state"], RUN_STATES, f"{path}.state")
    expect_datetime(obj["updated_at"], f"{path}.updated_at")
    if not isinstance(obj["last_sequence"], int) or obj["last_sequence"] < 0:
        fail(f"{path}.last_sequence", "expected integer >= 0")


def validate_ledger_file(path_arg: str) -> tuple[str, int]:
    path = Path(path_arg)
    if not path.exists():
        fail(path_arg, "file does not exist")
    run_id: str | None = None
    last_sequence = 0
    count = 0
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        event = parse_json_text(line, f"{path_arg}:{lineno}")
        event_run_id, sequence = validate_ledger_event(event, f"{path_arg}:{lineno}")
        if run_id is None:
            run_id = event_run_id
        elif event_run_id != run_id:
            fail(f"{path_arg}:{lineno}.run_id", f"expected run_id {run_id!r}")
        if sequence <= last_sequence:
            fail(f"{path_arg}:{lineno}.sequence", f"expected sequence > {last_sequence}")
        last_sequence = sequence
        count += 1
    if count == 0:
        fail(path_arg, "ledger contains no events")
    return run_id or "", count


def usage() -> None:
    print(__doc__.strip(), file=sys.stderr)


def main(argv: list[str]) -> int:
    if len(argv) < 3 or argv[1] in {"-h", "--help"}:
        usage()
        return 2

    command = argv[1]
    target = argv[2]
    try:
        if command == "report":
            extract_fence = "--extract-fence" in argv[3:]
            report = parse_report_text(read_text(target), extract_fence, target)
            report_type = validate_report(report, target)
            print(f"valid report: {report_type}")
        elif command == "event":
            event = parse_json_text(read_text(target), target)
            run_id, sequence = validate_ledger_event(event, target)
            print(f"valid ledger event: run_id={run_id} sequence={sequence}")
        elif command == "ledger":
            run_id, count = validate_ledger_file(target)
            print(f"valid ledger: run_id={run_id} events={count}")
        elif command == "active-run":
            snapshot = parse_json_text(read_text(target), target)
            validate_active_run(snapshot, target)
            print("valid active-run snapshot")
        else:
            usage()
            return 2
    except OSError as exc:
        print(f"invalid: {exc}", file=sys.stderr)
        return 1
    except ValidationError as exc:
        print(f"invalid: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
