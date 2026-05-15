from pathlib import Path
import subprocess
import sys

import pytest

from scripts.workflow_to_harness import WorkflowParseError, parse_workflows, render_harness


def write_workflow(path: Path) -> None:
    path.write_text(
        """
workflows:
  - id: wf_example
    name: Example Harness
    enabled: true
    schedule: manual
    shellScriptPath: .harness/example.sh
    steps:
      - type: vars
        name: Capture value
        values:
          VALUE: printf 'hello'
      - type: bash
        name: Print value
        run: |
          printf '%s\\n' "$VALUE"
      - type: agent
        name: Ask agent
        agent: general
        prompt: |
          Say hello from the harness.
""".lstrip(),
        encoding="utf-8",
    )


def test_parse_workflows_accepts_blueprint_shape(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    workflows = parse_workflows(workflow_file)

    assert len(workflows) == 1
    assert workflows[0].id == "wf_example"
    assert workflows[0].shell_script_path == ".harness/example.sh"


def test_parse_workflows_rejects_unknown_step_type(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_extra
    name: Extra Feature
    enabled: true
    schedule: manual
    shellScriptPath: .harness/extra.sh
    steps:
      - type: llm
        prompt: Do not support this.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_render_harness_uses_only_opencode_agent_invocation(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    workflow = parse_workflows(workflow_file)[0]

    script = render_harness(workflow)

    assert "opencode run --format json" in script
    assert "--agent" in script
    assert "Say hello from the harness." in script
    assert "curl" not in script


def test_cli_writes_executable_harness_and_refuses_overwrite(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "workflow_to_harness.py"

    first = subprocess.run(
        [sys.executable, str(script_path), str(workflow_file), "--output-root", str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert first.returncode == 0, first.stderr
    output = tmp_path / ".harness" / "example.sh"
    assert output.exists()
    assert output.stat().st_mode & 0o111

    syntax = subprocess.run(
        ["bash", "-n", str(output)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert syntax.returncode == 0, syntax.stderr

    second = subprocess.run(
        [sys.executable, str(script_path), str(workflow_file), "--output-root", str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert second.returncode != 0
    assert "Refusing to overwrite" in second.stderr
