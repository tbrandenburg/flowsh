import os
import subprocess
import sys
from pathlib import Path

import pytest
from typer.testing import CliRunner

from flowsh import WorkflowParseError, harness_path, parse_workflows, render_harness
from flowsh.cli import app

runner = CliRunner()


def write_workflow(path: Path) -> None:
    path.write_text(
        """
workflows:
  - id: wf_example
    name: Example Harness
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
    assert harness_path(workflows[0]) == Path(".harness/example.sh")


def test_parse_workflows_rejects_unknown_step_type(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_extra
    name: Extra Feature
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
    first = subprocess.run(
        [sys.executable, "-m", "flowsh", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
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
        [sys.executable, "-m", "flowsh", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert second.returncode != 0
    assert "Refusing to overwrite" in second.stderr


def test_typer_cli_exposes_help_and_dry_run(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    help_result = runner.invoke(app, ["--help"], terminal_width=120)
    normalized_help = " ".join(help_result.output.split())

    assert help_result.exit_code == 0, help_result.output
    assert "Generate reproducible OpenCode Bash harness scripts" in normalized_help
    assert "Options" in normalized_help

    dry_run = runner.invoke(app, [str(workflow_file), "--dry-run"])

    assert dry_run.exit_code == 0, dry_run.output
    assert "DRY-RUN would write .harness/example.sh" in dry_run.output
    assert not (tmp_path / ".harness" / "example.sh").exists()


def test_cli_rejects_removed_metadata_and_path_fields(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_legacy
    name: Legacy Shape
    enabled: true
    schedule: manual
    shellScriptPath: .harness/legacy.sh
    steps:
      - type: bash
        run: echo legacy
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_generated_harness_runs_vars_and_bash_steps_for_real(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_bash_features
    name: Bash Features
    steps:
      - type: vars
        name: Capture greeting
        values:
          GREETING: printf 'hello'
          TARGET: printf 'flowsh'
      - type: bash
        name: Persist output
        run: |
          mkdir -p output
          printf '%s %s\\n' "$GREETING" "$TARGET" > output/result.txt
      - type: bash
        name: Print output
        run: |
          echo "stdout:${GREETING}-${TARGET}"
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    harness = tmp_path / ".harness" / "bash_features.sh"
    assert harness.exists()

    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert executed.returncode == 0, executed.stderr
    assert "stdout:hello-flowsh" in executed.stdout
    assert (tmp_path / "output" / "result.txt").read_text(encoding="utf-8") == "hello flowsh\n"
    assert list((tmp_path / "logs").glob("flowsh-bash-features-*.log"))


def test_generated_harness_dry_runs_agent_without_opencode(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_features
    name: Agent Features
    steps:
      - type: agent
        name: Ask OpenCode
        agent: general
        prompt: |
          Say hello without executing in tests.
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh", str(workflow_file), "--workflow", "wf_agent_features"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    harness = tmp_path / ".harness" / "agent_features.sh"
    executed = subprocess.run(
        ["bash", str(harness), "--dry-run"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode == 0, executed.stderr
    assert "[DRY-RUN] would run: step_ask_opencode" in executed.stderr
    assert "Workflow finished: Agent Features" in executed.stderr
