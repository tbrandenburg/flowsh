from __future__ import annotations

import re
from pathlib import Path

from flowsh_cli.models import AgentStep, BashStep, Step, VarsStep, Workflow


def harness_path(workflow: Workflow) -> Path:
    return Path(".harness") / f"{workflow.id.removeprefix('wf_')}.sh"


def render_harness(workflow: Workflow) -> str:
    script_name = harness_path(workflow).name
    lines: list[str] = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "umask 077",
        "",
        f"SCRIPT_NAME={bash_quote(script_name)}",
        'WORKFLOW_NAME="${SCRIPT_NAME%.sh}"',
        "WORKFLOW_SLUG=$(printf '%s' \"$WORKFLOW_NAME\" \\",
        "  | tr '[:upper:]' '[:lower:]' \\",
        "  | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')",
        "LOG_TIMESTAMP=\"$(date -u +'%Y%m%dT%H%M%SZ')\"",
        'LOG_BASENAME="flowsh-${WORKFLOW_SLUG}-${LOG_TIMESTAMP}-$$.log"',
        "",
        section("Argument handling"),
        "DRY_RUN=false",
        'if [[ $# -eq 1 && "$1" == "--dry-run" ]]; then',
        "  DRY_RUN=true",
        "elif [[ $# -gt 0 ]]; then",
        '  printf "Usage: %s [--dry-run]\\n" "$0" >&2',
        "  exit 2",
        "fi",
        "",
        section("refuse_symlink_path() - keep generated logs inside plain relative paths"),
        "refuse_symlink_path() {",
        '  local target="$1"',
        "",
        '  if [[ -z "$target" ]]; then',
        '    printf "ERROR: Log directory must not be empty\\n" >&2',
        "    return 1",
        "  fi",
        '  if [[ "$target" == /* ]]; then',
        '    printf "ERROR: Log directory must be relative: %s\\n" "$target" >&2',
        "    return 1",
        "  fi",
        "",
        "  local current=",
        "  local part",
        '  IFS=/ read -r -a path_parts <<< "$target"',
        '  for part in "${path_parts[@]}"; do',
        '    if [[ -z "$part" || "$part" == "." ]]; then',
        "      continue",
        "    fi",
        '    if [[ "$part" == ".." ]]; then',
        "      printf '%s: %s\\n' "
        '"ERROR: Log directory must not contain .. path segments" "$target" >&2',
        "      return 1",
        "    fi",
        '    current="${current:+${current}/}${part}"',
        '    if [[ -L "$current" ]]; then',
        '      printf "ERROR: Refusing to write logs through symlinked path: %s\\n" "$current" >&2',
        "      return 1",
        "    fi",
        "  done",
        "}",
        "",
        section("Log file setup - local by default, override with FLOWSH_LOG_DIR"),
        'LOG_DIR="${FLOWSH_LOG_DIR:-.flowsh/logs}"',
        "LOG_FILE=",
        'if [[ "$DRY_RUN" == false ]]; then',
        '  refuse_symlink_path "$LOG_DIR" || exit 1',
        '  if [[ -e "$LOG_DIR" && ! -d "$LOG_DIR" ]]; then',
        '    printf "ERROR: Log path exists but is not a directory: %s\\n" "$LOG_DIR" >&2',
        "    exit 1",
        "  fi",
        '  if ! mkdir -p "$LOG_DIR"; then',
        '    printf "ERROR: Cannot create log directory: %s\\n" "$LOG_DIR" >&2',
        "    exit 1",
        "  fi",
        '  refuse_symlink_path "$LOG_DIR" || exit 1',
        '  if [[ ! -d "$LOG_DIR" ]]; then',
        '    printf "ERROR: Log path exists but is not a directory: %s\\n" "$LOG_DIR" >&2',
        "    exit 1",
        "  fi",
        '  if ! chmod 700 "$LOG_DIR"; then',
        '    printf "ERROR: Cannot set log directory permissions: %s\\n" "$LOG_DIR" >&2',
        "    exit 1",
        "  fi",
        '  LOG_FILE="${LOG_DIR}/${LOG_BASENAME}"',
        '  if ! : > "$LOG_FILE"; then',
        '    printf "ERROR: Cannot create log file: %s\\n" "$LOG_FILE" >&2',
        "    exit 1",
        "  fi",
        '  if ! chmod 600 "$LOG_FILE"; then',
        '    printf "ERROR: Cannot set log file permissions: %s\\n" "$LOG_FILE" >&2',
        "    exit 1",
        "  fi",
        "fi",
        "",
        section("log() - ISO-8601 UTC timestamps, INFO/ERROR, stderr + log file"),
        "log() {",
        '  local level="$1"; shift',
        "  local message",
        "  message=\"$(date -u +'%Y-%m-%dT%H:%M:%SZ') [${level}] $*\"",
        "  printf '%s\\n' \"$message\" >&2",
        '  if [[ -n "$LOG_FILE" ]]; then',
        '    if ! printf \'%s\\n\' "$message" >> "$LOG_FILE"; then',
        '      printf "ERROR: Cannot write log file: %s\\n" "$LOG_FILE" >&2',
        "      exit 1",
        "    fi",
        "  fi",
        "}",
        "",
        section("catch() - centralized step failure hook"),
        "catch() {",
        '  local step_name="$1"',
        '  local exit_code="$2"',
        '  log ERROR "Step failed: ${step_name} (exit=${exit_code})"',
        "}",
        "",
        section("run_step() - dry-run and failure handling; streams output via tee"),
        "run_step() {",
        '  local step_name="$1"',
        "",
        '  if [[ "$DRY_RUN" == true ]]; then',
        '    log INFO "[DRY-RUN] would run: ${step_name}"',
        "    return 0",
        "  fi",
        "",
        '  log INFO "Running step: ${step_name}"',
        "",
        "  set +e",
        '  if ( : >> "$LOG_FILE" ) 2>/dev/null; then',
        '    "$step_name" > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2)',
        "    local status=$?",
        "  else",
        '    "$step_name"',
        "    local status=$?",
        "  fi",
        "  set -e",
        "",
        "  if [[ $status -ne 0 ]]; then",
        '    catch "$step_name" "$status"',
        "  fi",
        '  return "$status"',
        "}",
        "",
        section("run_stateful_step() - dry-run and failure handling without subshells"),
        "run_stateful_step() {",
        '  local step_name="$1"',
        "",
        '  if [[ "$DRY_RUN" == true ]]; then',
        '    log INFO "[DRY-RUN] would run: ${step_name}"',
        "    return 0",
        "  fi",
        "",
        '  log INFO "Running step: ${step_name}"',
        "",
        "  set +e",
        '  "$step_name"',
        "  local status=$?",
        "  set -e",
        "",
        "  if [[ $status -ne 0 ]]; then",
        '    catch "$step_name" "$status"',
        "  fi",
        '  return "$status"',
        "}",
        "",
        section("run_agent() - prompt handling and OpenCode CLI invocation"),
        "run_agent() {",
        '  local prompt="$1"',
        '  local agent="${2:-}"',
        '  local model="${3:-}"',
        '  local command="${4:-}"',
        '  local dangerously_skip_permissions="${5:-false}"',
        "",
        "  local cmd=(opencode run --format json)",
        '  if [[ -n "$agent" ]]; then',
        '    cmd+=(--agent "$agent")',
        "  fi",
        '  if [[ -n "$model" ]]; then',
        '    cmd+=(--model "$model")',
        "  fi",
        '  if [[ -n "$command" ]]; then',
        '    cmd+=(--command "$command")',
        "  fi",
        '  if [[ "$dangerously_skip_permissions" == true ]]; then',
        "    cmd+=(--dangerously-skip-permissions)",
        "  fi",
        "",
        '  if [[ "$DRY_RUN" == true ]]; then',
        '    log INFO "[DRY-RUN] would run: $(printf \'%q \' "${cmd[@]}") (with prompt)"',
        "    return 0",
        "  fi",
        "",
        "  if ! command -v opencode >/dev/null 2>&1; then",
        '    log ERROR "opencode CLI not found in PATH"',
        "    return 127",
        "  fi",
        "",
        '  "${cmd[@]}" -- "$prompt"',
        "}",
        "",
        section(f"Starting workflow: {workflow.name}"),
        f"log INFO {bash_quote(f'Starting workflow: {workflow.name}')}",
        "",
    ]

    used_function_names: set[str] = set()
    for index, step in enumerate(workflow.steps, start=1):
        lines.extend(render_step(index, step, used_function_names))

    lines.extend(
        [
            section(f"Workflow finished: {workflow.name}"),
            f"log INFO {bash_quote(f'Workflow finished: {workflow.name}')}",
            "",
        ]
    )
    return "\n".join(lines)


def render_step(index: int, step: Step, used_function_names: set[str] | None = None) -> list[str]:
    function_name = step_function_name(index, step.name, used_function_names)
    title = step.name or default_step_title(index, step)
    lines = [section(f"Step {index} ({step.type}): {title}"), f"{function_name}() {{"]

    if isinstance(step, VarsStep):
        lines.append("  local status=0")
        for name, command in step.values.items():
            delimiter = heredoc_delimiter(f"VARS_{name}", command)
            lines.append(f"  {name}=$(bash -euo pipefail <<'{delimiter}'")
            lines.extend(script_lines(command))
            lines.extend(
                [
                    delimiter,
                    "  )",
                    "  status=$?",
                    "  if [[ $status -ne 0 ]]; then",
                    '    return "$status"',
                    "  fi",
                    f"  export {name}",
                ]
            )
    elif isinstance(step, BashStep):
        delimiter = heredoc_delimiter("BASH", step.run)
        lines.extend(
            [
                f"  bash -euo pipefail <<'{delimiter}'",
                *step.run.strip().splitlines(),
                delimiter,
            ]
        )
    elif isinstance(step, AgentStep):
        delimiter = heredoc_delimiter("PROMPT", step.prompt)
        lines.extend(
            [
                "  local prompt",
                f"  prompt=$(cat <<'{delimiter}'",
                *step.prompt.splitlines(),
                delimiter,
                "  )",
            ]
        )
        if step.expandPrompt:
            braced = re.findall(r"\$\{([A-Z_][A-Z0-9_]*)\}", step.prompt)
            bare = re.findall(r"\$([A-Z_][A-Z0-9_]*)(?!\w)", step.prompt)
            seen: dict[str, None] = {}
            for var in braced + bare:
                seen[var] = None
            for var in seen:
                lines.append(f'  _p=\'${{{var}}}\'; prompt="${{prompt//"$_p"/"${var}"}}"')
                lines.append(f'  _p=\'${var}\'; prompt="${{prompt//"$_p"/"${var}"}}"')

        lines.append(f"  local agent={bash_quote(step.agent or '')}")
        lines.append(f"  local model={bash_quote(step.model or '')}")
        lines.append(f"  local command={bash_quote(step.command or '')}")
        dangerous_skip_permissions = "true" if step.dangerouslySkipPermissions else "false"
        lines.append(f"  local dangerously_skip_permissions={dangerous_skip_permissions}")
        lines.append(
            '  run_agent "$prompt" "$agent" "$model" "$command" "$dangerously_skip_permissions"'
        )
    else:
        raise AssertionError(f"Unsupported step type: {step}")

    runner = "run_stateful_step" if isinstance(step, VarsStep) else "run_step"
    lines.extend(["}", f"{runner} {function_name}", ""])
    return lines


def default_step_title(index: int, step: Step) -> str:
    if isinstance(step, VarsStep):
        return ", ".join(step.values.keys())
    if isinstance(step, BashStep):
        return truncate_one_line(step.run)
    if isinstance(step, AgentStep):
        return truncate_one_line(step.prompt)
    return f"step {index}"


def truncate_one_line(text: str, limit: int = 80) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "..."


def step_function_name(
    index: int,
    name: str | None,
    used_function_names: set[str] | None = None,
) -> str:
    source = name or f"step_{index}"
    slug = re.sub(r"[^A-Za-z0-9_]+", "_", source).strip("_")
    if not slug:
        slug = f"step_{index}"
    if slug[0].isdigit():
        slug = f"step_{slug}"
    if not slug.startswith("step_"):
        slug = f"step_{slug}"
    base = slug.lower()
    if used_function_names is None:
        return base

    function_name = base
    suffix = 2
    while function_name in used_function_names:
        function_name = f"{base}_{suffix}"
        suffix += 1

    used_function_names.add(function_name)
    return function_name


def heredoc_delimiter(base: str, text: str) -> str:
    delimiter = f"{base}_EOF"
    counter = 1
    while delimiter in text:
        counter += 1
        delimiter = f"{base}_EOF_{counter}"
    return delimiter


def script_lines(script: str) -> list[str]:
    return script.strip().splitlines()


def bash_quote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def section(title: str) -> str:
    safe_title = truncate_one_line(title, limit=120)
    return "\n".join(
        [
            "# ---------------------------------------------------------------------------",
            f"# {safe_title}",
            "# ---------------------------------------------------------------------------",
        ]
    )
