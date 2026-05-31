import os
import subprocess
import sys
from pathlib import Path

import pytest
from typer.testing import CliRunner

from flowsh_cli import WorkflowParseError, harness_path, parse_workflows, render_harness
from flowsh_cli.cli import app
from flowsh_cli.models import MAX_WORKFLOW_YAML_BYTES

runner = CliRunner()

EXPECTED_HELP = """Usage: flowsh-cli [OPTIONS] WORKFLOW_YAML

  Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.

Arguments:
  WORKFLOW_YAML  Path to .made/workflows.yml  \\[required]

Options:
  --workflow TEXT  Optional workflow id to generate. Defaults to all workflows.
  --dry-run        Print planned output paths without writing scripts.
  --force          Overwrite existing files. Without this, existing files cause a failure.
  --version        Show the flowsh-cli version and exit.
  --help           Show this message and exit.
"""


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


def test_parse_workflows_rejects_duplicate_yaml_keys(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_duplicate_keys
    name: Original Name
    name: Overwritten Name
    steps:
      - type: bash
        run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="duplicate key"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_yaml_aliases(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
shared_step: &shared_step
  type: bash
  run: printf 'ok\\n'
workflows:
  - id: wf_alias
    name: Alias
    steps:
      - *shared_step
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="aliases are not supported"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_ambiguous_non_string_values(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_strict
    name: Strict Input
    steps:
      - type: vars
        values:
          VALUE: 123
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_missing_workflows_key(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text("not_workflows: []\n", encoding="utf-8")

    with pytest.raises(WorkflowParseError, match="workflows"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_empty_workflows_and_steps(tmp_path: Path) -> None:
    empty_workflows = tmp_path / "empty-workflows.yml"
    empty_workflows.write_text("workflows: []\n", encoding="utf-8")
    empty_steps = tmp_path / "empty-steps.yml"
    empty_steps.write_text(
        """
workflows:
  - id: wf_empty_steps
    name: Empty Steps
    steps: []
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="at least one workflow"):
        parse_workflows(empty_workflows)
    with pytest.raises(WorkflowParseError, match="at least one step"):
        parse_workflows(empty_steps)


def test_parse_workflows_rejects_missing_required_step_fields(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_missing_run
    name: Missing Run
    steps:
      - type: bash
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="run"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_invalid_variable_names(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_bad_var
    name: Bad Var
    steps:
      - type: vars
        values:
          bad-name: printf 'bad'
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="invalid variable name"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_duplicate_workflow_ids(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_duplicate
    name: First
    steps:
      - type: bash
        run: printf 'first\\n'
  - id: wf_duplicate
    name: Second
    steps:
      - type: bash
        run: printf 'second\\n'
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="duplicate workflow ids"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_control_characters_in_titles(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_title_injection
    name: |
      Safe
      printf 'not safe'
    steps:
      - type: bash
        run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_shell_like_agent_names(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_name
    name: Agent Name
    steps:
      - type: agent
        agent: ../general
        prompt: Say hello.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_invalid_utf8(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_bytes(b"workflows:\n  - \xff\n")

    with pytest.raises(WorkflowParseError, match="valid UTF-8"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_non_file_input(tmp_path: Path) -> None:
    with pytest.raises(WorkflowParseError, match="regular file"):
        parse_workflows(tmp_path)


def test_parse_workflows_rejects_oversized_input(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_bytes(b" " * (MAX_WORKFLOW_YAML_BYTES + 1))

    with pytest.raises(WorkflowParseError, match="too large"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_empty_or_non_mapping_yaml(tmp_path: Path) -> None:
    empty_file = tmp_path / "empty.yml"
    empty_file.write_text("", encoding="utf-8")
    list_file = tmp_path / "list.yml"
    list_file.write_text("- not-a-workflow-file\n", encoding="utf-8")

    with pytest.raises(WorkflowParseError, match="must not be empty"):
        parse_workflows(empty_file)
    with pytest.raises(WorkflowParseError, match="root must be a mapping"):
        parse_workflows(list_file)


def test_parse_workflows_rejects_unsafe_control_bytes_in_executable_content(
    tmp_path: Path,
) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_control_byte
    name: Control Byte
    steps:
      - type: bash
        run: "printf 'bad\\rcontent'"
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="unsafe control"):
        parse_workflows(workflow_file)


def test_parse_workflows_does_not_echo_rejected_input_values(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_secret
    name: Secret
    steps:
      - type: agent
        prompt: Keep this prompt private.
        secret: SUPER_SECRET_TOKEN
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError) as error:
        parse_workflows(workflow_file)

    message = str(error.value)
    assert "extra" in message.lower()
    assert "SUPER_SECRET_TOKEN" not in message
    assert "Keep this prompt private" not in message


def test_render_harness_uses_only_opencode_agent_invocation(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    workflow = parse_workflows(workflow_file)[0]

    script = render_harness(workflow)

    assert "opencode run --format json" in script
    assert "--agent" in script
    assert '"${cmd[@]}" -- "$prompt"' in script
    assert "Say hello from the harness." in script
    assert "curl" not in script


def test_render_harness_disambiguates_duplicate_step_function_names(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_duplicate_names
    name: Duplicate Names
    steps:
      - type: bash
        name: Build
        run: printf 'first\\n'
      - type: bash
        name: build
        run: printf 'second\\n'
      - type: bash
        name: build!
        run: printf 'third\\n'
""".lstrip(),
        encoding="utf-8",
    )
    workflow = parse_workflows(workflow_file)[0]

    script = render_harness(workflow)

    assert "step_build()" in script
    assert "step_build_2()" in script
    assert "step_build_3()" in script
    assert "run_step step_build\n" in script
    assert "run_step step_build_2\n" in script
    assert "run_step step_build_3\n" in script


def test_cli_exposes_version_without_workflow_argument() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0, result.output
    assert result.output.strip().startswith("flowsh-cli ")


def test_cli_reports_missing_required_workflow_argument() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert result.stdout == ""
    assert "Missing argument" in result.stderr
    assert "'WORKFLOW_YAML'" in result.stderr


def test_cli_reports_unknown_workflow_selector(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--workflow", "wf_missing"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: No workflow id matched 'wf_missing'" in result.stderr
    assert "Example Harness (wf_example)" in result.stderr


def test_cli_reports_missing_workflow_file_without_traceback(tmp_path: Path) -> None:
    missing_file = tmp_path / "missing.yml"

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(missing_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Cannot stat workflow YAML" in result.stderr
    assert "Traceback" not in result.stderr


def test_cli_reports_malformed_yaml_without_traceback(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text("workflows: [\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Invalid YAML" in result.stderr
    assert "Traceback" not in result.stderr


def test_cli_reports_unsupported_step_without_traceback(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_bad_step
    name: Bad Step
    steps:
      - type: http
        url: https://example.test
""".lstrip(),
        encoding="utf-8",
    )

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Invalid workflow YAML" in result.stderr
    assert "vars" in result.stderr
    assert "bash" in result.stderr
    assert "agent" in result.stderr
    assert "Traceback" not in result.stderr


@pytest.mark.parametrize(
    ("yaml_text", "expected"),
    [
        (
            """
workflows:
  - id: wf_missing_run
    name: Missing Run
    steps:
      - type: bash
""",
            "run",
        ),
        (
            """
workflows:
  - id: wf_bad_type
    name: Bad Type
    steps:
      - type: vars
        values:
          VALUE: 123
""",
            "Input should be a valid string",
        ),
    ],
)
def test_cli_reports_invalid_required_fields_without_traceback(
    tmp_path: Path,
    yaml_text: str,
    expected: str,
) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(yaml_text.lstrip(), encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Invalid workflow YAML" in result.stderr
    assert expected in result.stderr
    assert "Traceback" not in result.stderr


def test_cli_writes_executable_harness_and_refuses_overwrite(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    first = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert first.returncode == 0, first.stderr
    output = tmp_path / ".harness" / "example.sh"
    assert output.exists()
    assert output.stat().st_mode & 0o777 == 0o700

    syntax = subprocess.run(
        ["bash", "-n", str(output)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert syntax.returncode == 0, syntax.stderr

    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert second.returncode != 0
    assert "Refusing to overwrite" in second.stderr


def test_cli_generates_deterministic_harness_content(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    first = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    first_content = (tmp_path / ".harness" / "example.sh").read_text(encoding="utf-8")
    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    second_content = (tmp_path / ".harness" / "example.sh").read_text(encoding="utf-8")

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first_content == second_content


def test_cli_force_overwrites_regular_file_atomically(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    output = harness_dir / "example.sh"
    output.write_text("old content\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "Wrote .harness/example.sh\n"
    assert output.read_text(encoding="utf-8").startswith("#!/usr/bin/env bash\n")
    assert output.stat().st_mode & 0o777 == 0o700


def test_cli_force_replaces_output_symlink_without_following_it(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    target = tmp_path / "external-target.sh"
    target.write_text("external\n", encoding="utf-8")
    (harness_dir / "example.sh").symlink_to(target)

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    output = harness_dir / "example.sh"
    assert result.returncode == 0, result.stderr
    assert not output.is_symlink()
    assert output.read_text(encoding="utf-8").startswith("#!/usr/bin/env bash\n")
    assert target.read_text(encoding="utf-8") == "external\n"


def test_cli_preflights_overwrite_conflicts_before_writing_any_harness(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_first
    name: First
    steps:
      - type: bash
        run: printf 'first\\n'
  - id: wf_second
    name: Second
    steps:
      - type: bash
        run: printf 'second\\n'
""".lstrip(),
        encoding="utf-8",
    )
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    existing = harness_dir / "second.sh"
    existing.write_text("existing\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Refusing to overwrite existing file(s): .harness/second.sh" in result.stderr
    assert not (harness_dir / "first.sh").exists()
    assert existing.read_text(encoding="utf-8") == "existing\n"


def test_cli_refuses_to_overwrite_broken_symlink(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    (harness_dir / "example.sh").symlink_to("missing-target.sh")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Refusing to overwrite" in result.stderr
    assert (harness_dir / "example.sh").is_symlink()


def test_cli_refuses_symlinked_harness_directory(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    external_dir = tmp_path / "external"
    external_dir.mkdir()
    (tmp_path / ".harness").symlink_to(external_dir, target_is_directory=True)

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Refusing to write through symlinked directory" in result.stderr
    assert not (external_dir / "example.sh").exists()


def test_cli_refuses_file_at_harness_directory_path(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    (tmp_path / ".harness").write_text("not a directory\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Output path exists but is not a directory" in result.stderr


def test_cli_force_refuses_directory_at_harness_file_path(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    output = tmp_path / ".harness" / "example.sh"
    output.mkdir(parents=True)

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Output path exists but is a directory: .harness/example.sh" in result.stderr
    assert "Traceback" not in result.stderr
    assert output.is_dir()


def test_generated_harness_quotes_shell_relevant_labels(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_shell_labels
    name: Workflow $(touch workflow-pwned)
    steps:
      - type: bash
        name: Step $(touch step-pwned)
        run: printf 'safe\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "shell_labels.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode == 0, executed.stderr
    assert "safe" in executed.stdout
    assert not (tmp_path / "workflow-pwned").exists()
    assert not (tmp_path / "step-pwned").exists()


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


def test_cli_help_is_deterministic_across_repeated_runs() -> None:
    first = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "COLUMNS": "40"},
    )
    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "COLUMNS": "200"},
    )

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first.stdout == second.stdout
    assert first.stderr == second.stderr == ""
    assert first.stdout == EXPECTED_HELP
    assert "╭" not in first.stdout


def test_uv_console_entrypoint_help_matches_contract() -> None:
    result = subprocess.run(
        ["uv", "run", "flowsh-cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "COLUMNS": "200"},
    )

    assert result.returncode == 0, result.stderr
    assert "Usage: flowsh-cli [OPTIONS] WORKFLOW_YAML" in result.stdout
    assert "Path to .made/workflows.yml" in result.stdout
    assert "--dry-run" in result.stdout
    assert "--force" in result.stdout
    assert "--version" in result.stdout


def test_direct_script_entrypoint_help_matches_contract() -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "workflow_to_harness.py"

    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "COLUMNS": "40"},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == EXPECTED_HELP
    assert result.stderr == ""


def test_cli_dry_run_is_deterministic_across_repeated_runs(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    first = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--dry-run"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--dry-run"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert (
        first.stdout
        == second.stdout
        == ("DRY-RUN would write .harness/example.sh for workflow 'Example Harness'\n")
    )
    assert first.stderr == second.stderr == ""
    assert not (tmp_path / ".harness").exists()


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
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
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
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--workflow", "wf_agent_features"],
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
    assert not (tmp_path / ".flowsh").exists()


def test_generated_harness_invokes_opencode_with_agent_and_prompt(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_invocation
    name: Agent Invocation
    steps:
      - type: agent
        name: Ask OpenCode
        agent: general
        prompt: |
          Inspect the current repository.
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake_opencode = bin_dir / "opencode"
    fake_opencode.write_text(
        """#!/usr/bin/env bash
printf '%s\n' "$@" > "$OPENCODE_ARGS_CAPTURE"
printf '%s' "${@: -1}" > "$OPENCODE_PROMPT_CAPTURE"
printf '{"ok":true}\n'
""",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)
    args_capture = tmp_path / "opencode-args.txt"
    prompt_capture = tmp_path / "opencode-prompt.txt"

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "agent_invocation.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "OPENCODE_ARGS_CAPTURE": str(args_capture),
            "OPENCODE_PROMPT_CAPTURE": str(prompt_capture),
        },
    )

    assert executed.returncode == 0, executed.stderr
    assert args_capture.read_text(encoding="utf-8") == (
        "run\n--format\njson\n--agent\ngeneral\n--\nInspect the current repository.\n"
    )
    assert prompt_capture.read_text(encoding="utf-8") == "Inspect the current repository."
    assert '{"ok":true}' in executed.stdout


def test_generated_harness_passes_dash_prefixed_agent_prompt_as_message(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_dash_prompt
    name: Dash Prompt
    steps:
      - type: agent
        prompt: --help is content, not a flag.
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    fake_opencode = bin_dir / "opencode"
    fake_opencode.write_text(
        """#!/usr/bin/env bash
printf '%s\n' "$@" > "$OPENCODE_ARGS_CAPTURE"
printf '{"ok":true}\n'
""",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)
    args_capture = tmp_path / "opencode-args.txt"

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "dash_prompt.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "OPENCODE_ARGS_CAPTURE": str(args_capture),
        },
    )

    assert executed.returncode == 0, executed.stderr
    assert args_capture.read_text(encoding="utf-8") == (
        "run\n--format\njson\n--\n--help is content, not a flag.\n"
    )


def test_generated_harness_rejects_unexpected_arguments(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_args
    name: Args
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "args.sh"), "--unknown"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode == 2
    assert executed.stdout == ""
    assert "Usage:" in executed.stderr
    assert "[--dry-run]" in executed.stderr
    assert not (tmp_path / ".flowsh").exists()


def test_generated_harness_fails_agent_run_when_opencode_is_missing(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_missing
    name: Agent Missing
    steps:
      - type: agent
        name: Ask Missing OpenCode
        agent: general
        prompt: |
          This prompt should not run without opencode.
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["/bin/bash", str(tmp_path / ".harness" / "agent_missing.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "PATH": "/usr/bin:/bin"},
    )

    assert executed.returncode == 127
    assert "opencode CLI not found in PATH" in executed.stderr
    assert "Step failed: step_ask_missing_opencode (exit=127)" in executed.stderr


def test_generated_harness_creates_private_logs_for_real_runs(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_private_logs
    name: Private Logs
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    harness = tmp_path / ".harness" / "private_logs.sh"
    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    log_files = list((tmp_path / ".flowsh" / "logs").glob("flowsh-private-logs-*.log"))
    assert executed.returncode == 0, executed.stderr
    assert len(log_files) == 1
    assert (tmp_path / ".flowsh" / "logs").stat().st_mode & 0o777 == 0o700
    assert log_files[0].stat().st_mode & 0o777 == 0o600


def test_generated_harness_refuses_symlinked_log_directory(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_log_symlink
    name: Log Symlink
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    external_dir = tmp_path / "external-logs"
    external_dir.mkdir()
    (tmp_path / "logs").symlink_to(external_dir, target_is_directory=True)

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "log_symlink.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert executed.returncode != 0
    assert "Refusing to write logs through symlinked path: logs" in executed.stderr
    assert list(external_dir.iterdir()) == []


def test_generated_harness_refuses_symlinked_log_parent(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_log_parent_symlink
    name: Log Parent Symlink
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    external_dir = tmp_path / "external-flowsh"
    external_dir.mkdir()
    (tmp_path / ".flowsh").symlink_to(external_dir, target_is_directory=True)

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "log_parent_symlink.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Refusing to write logs through symlinked path: .flowsh" in executed.stderr
    assert list(external_dir.iterdir()) == []


def test_generated_harness_refuses_non_local_log_directory(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_absolute_log
    name: Absolute Log
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "absolute_log.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": str(tmp_path / "logs")},
    )

    assert executed.returncode != 0
    assert "Log directory must be relative" in executed.stderr


def test_generated_harness_refuses_parent_traversal_log_directory(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_parent_log
    name: Parent Log
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "parent_log.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "../logs"},
    )

    assert executed.returncode != 0
    assert "Log directory must not contain .. path segments" in executed.stderr


def test_generated_harness_reports_log_directory_creation_failure(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_log_create_failure
    name: Log Create Failure
    steps:
      - type: bash
        run: printf 'ok\\n'
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    (tmp_path / "blocked").write_text("not a directory\n", encoding="utf-8")

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "log_create_failure.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "blocked/logs"},
    )

    assert executed.returncode != 0
    assert "ERROR: Cannot create log directory: blocked/logs" in executed.stderr


def test_generated_harness_reports_log_write_failure(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_log_write_failure
    name: Log Write Failure
    steps:
      - type: bash
        run: rm -rf logs
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "log_write_failure.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert executed.returncode != 0
    assert "ERROR: Cannot write log file: logs/flowsh-log-write-failure-" in executed.stderr


def test_generated_harness_fails_fast_for_bash_step_errors(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_fail_fast
    name: Fail Fast
    steps:
      - type: bash
        name: Must Fail
        run: |
          false
          touch should-not-exist
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "fail_fast.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_must_fail" in executed.stderr
    assert not (tmp_path / "should-not-exist").exists()


def test_generated_harness_fails_fast_for_vars_step_errors(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_vars_fail_fast
    name: Vars Fail Fast
    steps:
      - type: vars
        name: Capture Variables
        values:
          FIRST: |
            false
            touch should-not-exist
      - type: bash
        run: touch should-not-exist-either
""".lstrip(),
        encoding="utf-8",
    )
    generated = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / ".harness" / "vars_fail_fast.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_capture_variables" in executed.stderr
    assert not (tmp_path / "should-not-exist").exists()
    assert not (tmp_path / "should-not-exist-either").exists()
