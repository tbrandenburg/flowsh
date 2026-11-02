from __future__ import annotations

import re
import shlex
from pathlib import Path

import yaml

from flowsh_cli.models import (
    AgentStep,
    BashStep,
    ForStep,
    ParallelStep,
    Step,
    VarsStep,
    WhileStep,
    Workflow,
)

DAGU_MINIMUM_VERSION = "2.24.0"
DAGU_REFERENCE = re.compile(
    r"\$\{(?:"
    r"(?:consts|params)\.[A-Za-z][A-Za-z0-9_]*"
    r"|env\.[A-Za-z_][A-Za-z0-9_]*"
    r"|steps\.[A-Za-z][A-Za-z0-9_]*\.outputs\.[A-Za-z][A-Za-z0-9_]*"
    r"|foreach\.[^{}]+"
    r"|context\.(?:dag|run|attempt|step|trigger|paths|profile|pushback)\.[^{}]+"
    r"|dag\.name"
    r"|run\.(?:id|status|started_at|scheduled_at|root_name|root_id)"
    r"|attempt\.id"
    r"|step\.(?:id|name)"
    r"|trigger\.(?:type|actor)"
    r"|paths\.(?:log_file|work_dir|artifacts_dir|step_stdout_file|step_stderr_file|step_output_file)"
    r"|profile\.(?:name|resolved_at)"
    r"|pushback\.(?:iteration|previous_stdout_file)"
    r")\}"
)


def dagu_sidecar_path(script_path: Path) -> Path:
    return script_path.with_suffix(".dagu.yml")


def unsupported_dagu_reasons(workflow: Workflow) -> list[str]:
    reasons: list[str] = []
    if workflow.params:
        reasons.append("params unsupported for native Dagu v1")

    def inspect(step: Step, path: str) -> None:
        if step.when is not None:
            reasons.append(f"{path}.when unsupported for native Dagu v1")

        if isinstance(step, BashStep):
            return

        if isinstance(step, AgentStep):
            for option, value in (
                ("capture", step.capture),
                ("expandPrompt", step.expandPrompt),
                ("expandFields", step.expandFields),
                ("model", step.model),
                ("command", step.command),
                ("dangerouslySkipPermissions", step.dangerouslySkipPermissions),
            ):
                is_enabled = value is not None and value is not False
                if is_enabled:
                    reasons.append(f"{path}.{option} unsupported for native Dagu v1")
            return

        if isinstance(step, VarsStep):
            reasons.append(f"{path}.type=vars unsupported for native Dagu v1")
            return

        if isinstance(step, (ForStep, WhileStep, ParallelStep)):
            reasons.append(f"{path}.type={step.type} unsupported for native Dagu v1")
            for child_index, child in enumerate(step.steps):
                inspect(child, f"{path}.steps[{child_index}]")

    for index, step in enumerate(workflow.steps):
        inspect(step, f"steps[{index}]")

    return reasons


def render_dagu_sidecar(workflow: Workflow, *, project_dir: str) -> str:
    reasons = unsupported_dagu_reasons(workflow)
    if reasons:
        raise ValueError("Cannot render native Dagu v1 sidecar: " + "; ".join(reasons))

    steps: list[dict[str, object]] = []
    previous_id: str | None = None
    for index, step in enumerate(workflow.steps, start=1):
        step_id = f"step_{index:02d}_{step.type}"
        source = step.run if isinstance(step, BashStep) else step.prompt
        step_body = (
            render_bash_step(step.run)
            if isinstance(step, BashStep)
            else render_agent_step(step.prompt, agent=step.agent)
        )
        label = step.name if step.name is not None else source_summary(step, source)
        node: dict[str, object] = {
            "id": step_id,
            "name": f"{index:02d}: {label}",
            "description": f"Source flowsh step {index}; literal source follows:\n{source}",
            "run": step_body,
            "retry_policy": {"limit": 0, "interval_sec": 1},
            "continue_on": {"failure": False},
        }
        if previous_id is not None:
            node["depends"] = [previous_id]
        steps.append(node)
        previous_id = step_id

    document = {
        "params": [
            {"name": "project_dir", "type": "string", "default": project_dir},
        ],
        "working_dir": "${params.project_dir}",
        "retry_policy": {"limit": 0, "interval_sec": 1},
        "steps": steps,
    }
    return yaml.safe_dump(document, sort_keys=False, allow_unicode=True)


def default_project_dir(_sidecar_path: Path) -> str:
    return str(Path.cwd().resolve())


def render_bash_step(source: str) -> str:
    return "\n".join(
        [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            f"printf '%s' {bash_data_literal(source)} | bash -euo pipefail",
            "",
        ]
    )


def render_agent_step(prompt: str, *, agent: str | None) -> str:
    sentinel = unique_marker("FLOWSH_PROMPT_END", prompt)
    lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'prompt="$(',
        f"  printf '%s' {bash_data_literal(prompt)}",
        f"  printf '%s' {shlex.quote(sentinel)}",
        ')"',
        f'prompt="${{prompt%{sentinel}}}"',
    ]
    command = ["exec opencode run"]
    if agent is not None:
        command.append(f"--agent {bash_data_literal(agent)}")
    command.extend(["--", '"$prompt"'])
    lines.extend([" ".join(command), ""])
    return "\n".join(lines)


def bash_data_literal(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    escaped = DAGU_REFERENCE.sub(lambda match: "\\" + match.group(0), escaped)
    return "$'" + escaped + "'"


def source_summary(step: Step, source: str) -> str:
    first_line = next((line.strip() for line in source.splitlines() if line.strip()), "")
    preview = re.sub(r"\s+", " ", first_line)
    if len(preview) > 72:
        preview = preview[:71] + "…"
    return f"{step.type}: {preview}"


def unique_marker(prefix: str, source: str) -> str:
    marker = prefix
    suffix = 1
    while marker in source:
        marker = f"{prefix}_{suffix}"
        suffix += 1
    return marker
