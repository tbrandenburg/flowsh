from __future__ import annotations

from pathlib import Path
from typing import cast

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

DAGU_MINIMUM_VERSION = "2.25.1"


class LiteralString(str):
    """A string that should be emitted as a readable YAML block scalar."""


def represent_literal_string(dumper: yaml.SafeDumper, value: LiteralString) -> yaml.ScalarNode:
    node = dumper.represent_scalar("tag:yaml.org,2002:str", value, style="|")
    return cast(yaml.ScalarNode, node)


yaml.SafeDumper.add_representer(LiteralString, represent_literal_string)


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
            if "${" in step.run:
                reasons.append(
                    f"{path}.run contains a braced dollar expression; Dagu resolves supported "
                    "${...} references in run fields, so native export rejects it"
                )
            return

        if isinstance(step, AgentStep):
            if "${" in step.prompt:
                reasons.append(
                    f"{path}.prompt contains a braced dollar expression; Dagu resolves "
                    "supported ${...} references in harness inputs, so native export rejects it"
                )
            if step.agent is not None and "${" in step.agent:
                reasons.append(
                    f"{path}.agent contains a braced dollar expression; Dagu resolves "
                    "supported ${...} references in harness inputs, so native export rejects it"
                )
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
        node: dict[str, object] = {"id": step_id}
        if step.name is not None:
            node["name"] = step.name
        if isinstance(step, BashStep):
            node["run"] = LiteralString(render_bash_step(step.run))
        else:
            node["action"] = "harness.run"
            harness_with: dict[str, object] = {
                "prompt": LiteralString(step.prompt),
                "managed": False,
            }
            if step.agent is not None:
                harness_with["agent"] = step.agent
            node["with"] = harness_with
        if previous_id is not None:
            node["depends"] = [previous_id]
        steps.append(node)
        previous_id = step_id

    document = {
        "description": workflow.name,
        "type": "graph",
        "params": [
            {"name": "project_dir", "type": "string", "default": project_dir},
        ],
        "working_dir": "${params.project_dir}",
        "harness": {"provider": "opencode"},
        "retry_policy": {"limit": 0},
        "steps": steps,
    }
    return yaml.safe_dump(document, sort_keys=False, allow_unicode=True)


def default_project_dir(_sidecar_path: Path) -> str:
    return str(Path.cwd().resolve())


def render_bash_step(source: str) -> str:
    return "#!/usr/bin/env bash\nset -euo pipefail\n" + source
