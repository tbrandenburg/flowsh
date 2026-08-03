import os
import re
import subprocess
import sys
import time
from pathlib import Path

import pytest
from typer.testing import CliRunner

from flowsh_cli import WorkflowParseError, harness_path, parse_workflows, render_harness
from flowsh_cli.cli import app
from flowsh_cli.models import (
    MAX_WORKFLOW_YAML_BYTES,
    AgentStep,
    BashStep,
    ForStep,
    ParallelStep,
    VarsStep,
    WhileStep,
    Workflow,
    WorkflowFile,
    WorkflowParam,
)

runner = CliRunner()

# Strip FORCE_COLOR so that subprocess help output is plain text (no ANSI codes)
# regardless of what the CI environment sets.  GitHub Actions sets FORCE_COLOR=1
# which causes Rich to emit ANSI escape sequences even in non-TTY subprocesses,
# making the output differ from the no-color EXPECTED_HELP literal.
_BASE_ENV = {k: v for k, v in os.environ.items() if k != "FORCE_COLOR"}


def _strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences for environment-agnostic output comparison.

    GitHub Actions and some CI systems set FORCE_COLOR=1 or GITHUB_ACTIONS=true,
    causing Rich to emit ANSI codes even in non-TTY subprocesses.  Stripping
    sequences here keeps assertions deterministic regardless of the host env.
    """
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)


def test_strip_ansi_removes_common_csi_sequences() -> None:
    assert _strip_ansi("before\x1b[2Cafter") == "beforeafter"
    assert _strip_ansi("before\x1b[1Aafter") == "beforeafter"
    assert _strip_ansi("before\x1b[?25lafter") == "beforeafter"


EXPECTED_HELP = """\
                                                                                                                        
 Usage: flowsh-cli [OPTIONS] [WORKFLOW_YAML]                                                                            
                                                                                                                        
 Generate reproducible shell scripts from workflow YAML files.                                                          
                                                                                                                        
╭─ Arguments ──────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│   workflow_yaml      [WORKFLOW_YAML]  Path to workflow.yml [default: workflows.yml]                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭─ Options ────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ --workflow        TEXT  Optional workflow id to generate. Defaults to all workflows.                                 │
│ --dry-run               Print planned output paths without writing scripts.                                          │
│ --force                 Overwrite existing files. Without this, existing files cause a failure.                      │
│ --version               Show the flowsh-cli version and exit.                                                        │
│ --schema                Show the workflow YAML schema and exit.                                                      │
│ --examples              List available workflow examples and exit.                                                   │
│ --example         NAME  Print a named example workflow YAML to stdout and exit.                                      │
│ --skill                 Show the flowsh-cli skill description and exit.                                              │
│ --output          PATH  Write generated script to PATH. Only valid when generating a single workflow.                │
│ --help                  Show this message and exit.                                                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

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
    assert harness_path(workflows[0]) == Path("example.sh")


def test_parse_workflows_accepts_agent_expand_prompt_boolean(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_expand_prompt
    name: Expand Prompt
    steps:
      - type: agent
        expandPrompt: true
        prompt: Work on issue $ISSUE_NUMBER.
""".lstrip(),
        encoding="utf-8",
    )

    workflows = parse_workflows(workflow_file)

    assert workflows[0].steps[0].expandPrompt is True


def test_parse_workflows_accepts_agent_opencode_options(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_options
    name: Agent Options
    steps:
      - type: agent
        agent: general
        model: openai/gpt-5
        command: review
        dangerouslySkipPermissions: true
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    step = parse_workflows(workflow_file)[0].steps[0]

    assert isinstance(step, AgentStep)
    assert step.agent == "general"
    assert step.model == "openai/gpt-5"
    assert step.command == "review"
    assert step.dangerouslySkipPermissions is True


def test_parse_workflows_accepts_agent_capture(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_capture
    name: Agent Capture
    steps:
      - type: agent
        capture: IMPLEMENT_OUTPUT
        prompt: Save the output.
""".lstrip(),
        encoding="utf-8",
    )

    step = parse_workflows(workflow_file)[0].steps[0]

    assert isinstance(step, AgentStep)
    assert step.capture == "IMPLEMENT_OUTPUT"


@pytest.mark.parametrize("value", ["implement_output", "1OUTPUT", "OUTPUT-NAME"])
def test_parse_workflows_rejects_invalid_agent_capture(tmp_path: Path, value: str) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        f"""
workflows:
  - id: wf_agent_capture_invalid
    name: Agent Capture Invalid
    steps:
      - type: agent
        capture: {value}
        prompt: Save the output.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="capture"):
        parse_workflows(workflow_file)


def test_render_harness_exports_agent_capture_variable() -> None:
    workflow = Workflow(
        id="wf_agent_capture_export",
        name="Agent Capture Export",
        steps=[
            AgentStep(
                type="agent",
                name="implement",
                capture="IMPLEMENT_OUTPUT",
                prompt="Save the output.",
            ),
            BashStep(
                type="bash",
                name="use-capture",
                run='echo "$IMPLEMENT_OUTPUT"',
            ),
        ],
    )

    script = render_harness(workflow)

    printf_index = script.index('printf -v "$capture"')
    export_index = script.index('export "$capture"')
    assert export_index > printf_index
    assert script[printf_index:export_index].count("\n") == 1


def test_parse_workflows_accepts_dangerous_skip_flag_alias(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_dangerous_alias
    name: Dangerous Alias
    steps:
      - type: agent
        dangerously-skip-permissions: true
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    step = parse_workflows(workflow_file)[0].steps[0]

    assert isinstance(step, AgentStep)
    assert step.dangerouslySkipPermissions is True


def test_parse_workflows_defaults_agent_opencode_options(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_defaults
    name: Agent Defaults
    steps:
      - type: agent
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    step = parse_workflows(workflow_file)[0].steps[0]

    assert isinstance(step, AgentStep)
    assert step.model is None
    assert step.command is None
    assert step.dangerouslySkipPermissions is False


def test_parse_workflows_rejects_agent_expand_prompt_string(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_expand_prompt
    name: Expand Prompt
    steps:
      - type: agent
        expandPrompt: "true"
        prompt: Work on issue $ISSUE_NUMBER.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError) as error:
        parse_workflows(workflow_file)

    assert "expandPrompt" in str(error.value)


def test_parse_workflows_rejects_dangerous_skip_string(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_dangerous_string
    name: Dangerous String
    steps:
      - type: agent
        dangerouslySkipPermissions: "true"
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError) as error:
        parse_workflows(workflow_file)

    assert "dangerouslySkipPermissions" in str(error.value)


def test_parse_workflows_rejects_ambiguous_dangerous_skip_aliases(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_dangerous_ambiguous
    name: Dangerous Ambiguous
    steps:
      - type: agent
        dangerouslySkipPermissions: true
        dangerously-skip-permissions: false
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="must not both be set"):
        parse_workflows(workflow_file)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("model", '""'),
        ("command", '""'),
        ("model", '"openai/bad\\x01model"'),
        ("command", '"bad\\x01command"'),
    ],
)
def test_parse_workflows_rejects_invalid_agent_opencode_strings(
    tmp_path: Path,
    field: str,
    value: str,
) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        f"""
workflows:
  - id: wf_invalid_agent_option
    name: Invalid Agent Option
    steps:
      - type: agent
        {field}: {value}
        prompt: Review the repository.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError) as error:
        parse_workflows(workflow_file)

    assert field in str(error.value)


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


def test_parse_workflows_accepts_when_on_supported_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_when_steps
    name: When Steps
    steps:
      - type: vars
        when: '[ "${SKIP:-false}" = false ]'
        values:
          GREETING: printf 'hello'
      - type: bash
        when: '[ -n "${GOAL:-}" ]'
        run: echo goal
      - type: agent
        when: '[ -z "${RESUME:-}" ]'
        prompt: Split the plan
      - type: for
        when: '[ -n "${ITEMS:-}" ]'
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            run: echo "$ITEM"
      - type: parallel
        when: '[ "${ENABLE_PARALLEL:-false}" = true ]'
        steps:
          - type: bash
            run: echo child1
          - type: bash
            run: echo child2
""".lstrip(),
        encoding="utf-8",
    )

    workflow = parse_workflows(workflow_file)[0]

    assert [step.when for step in workflow.steps] == [
        '[ "${SKIP:-false}" = false ]',
        '[ -n "${GOAL:-}" ]',
        '[ -z "${RESUME:-}" ]',
        '[ -n "${ITEMS:-}" ]',
        '[ "${ENABLE_PARALLEL:-false}" = true ]',
    ]


def test_parse_workflows_rejects_empty_when(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_empty_when
    name: Empty When
    steps:
      - type: bash
        when: ""
        run: echo nope
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="when"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_when_with_unsafe_control_chars(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_bad_when
    name: Bad When
    steps:
      - type: bash
        when: "echo \\x1f"
        run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="when"):
        parse_workflows(workflow_file)


def test_render_harness_emits_when_guard_for_supported_steps() -> None:
    workflow = Workflow(
        id="wf_conditional_render",
        name="Conditional Render",
        steps=[
            VarsStep(
                type="vars",
                name="conditional-vars",
                when='[ "${SKIP:-false}" = false ]',
                values={"GREETING": "printf hi"},
            ),
            BashStep(
                type="bash",
                name="conditional-bash",
                when='[ -n "${GOAL:-}" ]',
                run="echo goal is set",
            ),
            AgentStep(
                type="agent",
                name="plan-feature",
                when='[ -z "${RESUME:-}" ]',
                prompt="Plan the feature.",
            ),
            ForStep(
                type="for",
                name="Process items",
                **{"in": "ITEMS"},
                item="ITEM",
                when='[ -n "${ITEMS:-}" ]',
                steps=[BashStep(type="bash", run='echo "$ITEM"')],
            ),
            ParallelStep(
                type="parallel",
                name="Fan out",
                when='[ "${ENABLE_PARALLEL:-false}" = true ]',
                steps=[BashStep(type="bash", run="echo child")],
            ),
        ],
    )

    script = render_harness(workflow)

    assert 'if ! ([ "${SKIP:-false}" = false ]); then' in script
    assert "log INFO 'Step skipped (when): conditional-vars'" in script
    assert 'if ! ([ -n "${GOAL:-}" ]); then' in script
    assert "log INFO 'Step skipped (when): conditional-bash'" in script
    assert 'if ! ([ -z "${RESUME:-}" ]); then' in script
    assert "log INFO 'Step skipped (when): plan-feature'" in script
    assert "return 0" in script
    assert "echo goal is set" in script


def test_render_harness_emits_when_guard_for_nested_steps() -> None:
    workflow = Workflow(
        id="wf_nested_when",
        name="Nested When",
        steps=[
            ForStep(
                type="for",
                name="Process items",
                **{"in": "ITEMS"},
                item="ITEM",
                steps=[
                    BashStep(
                        type="bash",
                        name="child-bash",
                        when='[ -n "${ITEM:-}" ]',
                        run='echo "$ITEM"',
                    )
                ],
            ),
            ParallelStep(
                type="parallel",
                name="Fan out",
                steps=[
                    BashStep(
                        type="bash",
                        name="child-parallel",
                        when='[ -n "${GOAL:-}" ]',
                        run="echo child",
                    )
                ],
            ),
        ],
    )

    script = render_harness(workflow)

    assert 'if ! ([ -n "${ITEM:-}" ]); then' in script
    assert "Step skipped (when): child-bash" in script
    assert 'if ! ([ -n "${GOAL:-}" ]); then' in script
    assert "Step skipped (when): child-parallel" in script


def test_render_harness_does_not_emit_when_guard_for_unconditional_step() -> None:
    workflow = Workflow(
        id="wf_no_when",
        name="No When",
        steps=[BashStep(type="bash", run="echo unconditional")],
    )

    script = render_harness(workflow)

    assert "Step skipped (when)" not in script
    assert "if ! (" not in script


def test_generated_harness_skips_step_when_when_condition_false(tmp_path: Path) -> None:
    workflow = Workflow(
        id="wf_skip_when",
        name="Skip When",
        steps=[
            BashStep(
                type="bash",
                name="should-skip",
                when="false",
                run="echo should-not-run",
            ),
            BashStep(type="bash", name="should-run", run="echo ran-after-skip"),
        ],
    )
    harness = tmp_path / ".harness" / "skip_when.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))

    result = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert result.returncode == 0, result.stderr
    assert "should-not-run" not in result.stdout
    assert "ran-after-skip" in result.stdout
    assert "Step skipped (when): should-skip" in result.stderr


def test_generated_harness_runs_step_when_when_condition_true(tmp_path: Path) -> None:
    workflow = Workflow(
        id="wf_run_when",
        name="Run When",
        steps=[
            BashStep(
                type="bash",
                name="conditional-run",
                when="true",
                run="echo ran-when-true",
            ),
        ],
    )
    harness = tmp_path / ".harness" / "run_when.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))

    result = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert result.returncode == 0, result.stderr
    assert "ran-when-true" in result.stdout
    assert "Step skipped (when)" not in result.stderr


def test_generated_harness_skips_nested_child_steps_when_conditions_fail(tmp_path: Path) -> None:
    workflow = Workflow(
        id="wf_nested_skip_when",
        name="Nested Skip When",
        steps=[
            ForStep(
                type="for",
                name="Process items",
                **{"in": "ITEMS"},
                item="ITEM",
                steps=[
                    BashStep(
                        type="bash",
                        name="child-bash",
                        when="false",
                        run='printf "child:%s\n" "$ITEM"',
                    )
                ],
            ),
            ParallelStep(
                type="parallel",
                name="Fan out",
                steps=[
                    BashStep(
                        type="bash",
                        name="child-parallel",
                        when="false",
                        run="echo child-parallel",
                    )
                ],
            ),
        ],
    )
    harness = tmp_path / ".harness" / "nested_skip_when.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))

    result = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs", "ITEMS": "alpha\nbeta"},
    )

    assert result.returncode == 0, result.stderr
    assert "child:alpha" not in result.stdout
    assert "child:beta" not in result.stdout
    assert "child-parallel" not in result.stdout
    assert "Step skipped (when): child-bash" in result.stderr
    assert "Step skipped (when): child-parallel" in result.stderr


@pytest.mark.parametrize(
    ("expr", "goal", "expect_ran"),
    [
        ('[ -n "${GOAL:-}" ]', "my-goal", True),
        ('[ -z "${GOAL:-}" ]', "my-goal", False),
        ('[ -n "${GOAL:-}" ]', "", False),
        ('[ -z "${GOAL:-}" ]', "", True),
    ],
)
def test_generated_harness_when_with_workflow_param(
    tmp_path: Path,
    expr: str,
    goal: str,
    expect_ran: bool,
) -> None:
    workflow = Workflow(
        id="wf_when_param",
        name="When Param",
        params=[WorkflowParam(name="GOAL")],
        steps=[
            BashStep(
                type="bash",
                name="conditional",
                when=expr,
                run="echo RAN",
            ),
        ],
    )
    harness = tmp_path / ".harness" / "when_param.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))

    env = {**os.environ, "FLOWSH_LOG_DIR": "logs"}
    args = [goal] if goal else []
    result = subprocess.run(
        ["bash", str(harness)] + args,
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env=env,
    )

    assert result.returncode == 0, result.stderr
    if expect_ran:
        assert "RAN" in result.stdout
    else:
        assert "RAN" not in result.stdout


def test_optional_param_defaults_to_empty_string_when_omitted(tmp_path: Path) -> None:
    workflow = Workflow(
        id="wf_optional_param",
        name="Optional Param",
        params=[
            WorkflowParam(name="GOAL", required=True),
            WorkflowParam(name="MODEL", required=False),
        ],
        steps=[
            BashStep(
                type="bash",
                name="use-model",
                run='printf "MODEL=[%s]\\n" "$MODEL"',
            ),
        ],
    )
    rendered = render_harness(workflow)
    assert 'MODEL="${MODEL:-}"' in rendered.splitlines()

    harness = tmp_path / ".harness" / "optional_param.sh"
    harness.parent.mkdir()
    harness.write_text(rendered)

    env = {**os.environ, "FLOWSH_LOG_DIR": "logs"}
    result = subprocess.run(
        ["bash", str(harness), "my-goal"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env=env,
    )

    assert result.returncode == 0, result.stderr
    assert "unbound variable" not in result.stderr
    assert "MODEL=[]" in result.stdout


def test_render_harness_quotes_agent_prompt_heredoc_by_default() -> None:
    workflow = Workflow(
        id="wf_prompt_default",
        name="Prompt Default",
        steps=[AgentStep(type="agent", prompt="Work on issue $ISSUE_NUMBER.")],
    )

    script = render_harness(workflow)

    assert "prompt=$(cat <<'PROMPT_EOF'" in script
    assert "prompt=$(cat <<PROMPT_EOF" not in script


def test_render_harness_safe_variable_substitution_when_expand_prompt_enabled() -> None:
    workflow = Workflow(
        id="wf_prompt_expand",
        name="Prompt Expand",
        steps=[
            AgentStep(
                type="agent",
                prompt="Work on issue ${ISSUE_NUMBER}.",
                expandPrompt=True,
            )
        ],
    )

    script = render_harness(workflow)

    # Always uses quoted heredoc - no shell expansion of the raw prompt
    assert "prompt=$(cat <<'PROMPT_EOF'" in script
    assert "prompt=$(cat <<PROMPT_EOF" not in script
    # Safe substitution lines emitted for the declared variable
    assert '_p=\'${ISSUE_NUMBER}\'; prompt="${prompt//"$_p"/"$ISSUE_NUMBER"}"' in script
    assert '_p=\'$ISSUE_NUMBER\'; prompt="${prompt//"$_p"/"$ISSUE_NUMBER"}"' in script


def test_render_harness_expand_prompt_ignores_braced_vars_inside_fenced_code_blocks() -> None:
    workflow = Workflow(
        id="wf_prompt_expand_code_fence",
        name="Prompt Expand Code Fence",
        steps=[
            AgentStep(
                type="agent",
                prompt=(
                    "Work on issue ${ISSUE_NUMBER}.\n"
                    "\n"
                    "Check for an existing PR:\n"
                    "\n"
                    "```bash\n"
                    "CURRENT_BRANCH=$(git branch --show-current)\n"
                    'EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH")\n'
                    "```\n"
                    "\n"
                    "If [EXISTING_PR] is set, skip PR creation."
                ),
                expandPrompt=True,
            )
        ],
    )

    script = render_harness(workflow)

    # ISSUE_NUMBER appears outside the code block — must still be expanded
    assert '_p=\'${ISSUE_NUMBER}\'; prompt="${prompt//"$_p"/"$ISSUE_NUMBER"}"' in script
    assert '_p=\'$ISSUE_NUMBER\'; prompt="${prompt//"$_p"/"$ISSUE_NUMBER"}"' in script
    # CURRENT_BRANCH and EXISTING_PR are inside the code block — must NOT be expanded
    assert "_p='${CURRENT_BRANCH}'" not in script
    assert "_p='$CURRENT_BRANCH'" not in script
    assert "_p='${EXISTING_PR}'" not in script
    assert "_p='$EXISTING_PR'" not in script


def test_render_harness_expand_prompt_ignores_bare_vars_inside_fenced_code_blocks() -> None:
    workflow = Workflow(
        id="wf_prompt_expand_bare_code_fence",
        name="Prompt Expand Bare Code Fence",
        steps=[
            AgentStep(
                type="agent",
                prompt=("Run the build for $TARGET_ENV.\n\n```bash\n./build.sh $BUILD_FLAGS\n```"),
                expandPrompt=True,
            )
        ],
    )

    script = render_harness(workflow)

    # TARGET_ENV is outside the code block — must be expanded
    assert '_p=\'${TARGET_ENV}\'; prompt="${prompt//"$_p"/"$TARGET_ENV"}"' in script
    assert '_p=\'$TARGET_ENV\'; prompt="${prompt//"$_p"/"$TARGET_ENV"}"' in script
    # BUILD_FLAGS is inside the code block — must NOT be expanded
    assert "_p='${BUILD_FLAGS}'" not in script
    assert "_p='$BUILD_FLAGS'" not in script


def test_render_harness_expand_fields_expands_model_agent_command() -> None:
    workflow = Workflow(
        id="wf_expand_fields",
        name="Expand Fields",
        steps=[
            AgentStep(
                type="agent",
                prompt="Do the thing.",
                agent="$AGENT_NAME",
                model="$MODEL",
                command="${COMMAND_NAME}",
                expandFields=True,
            )
        ],
    )

    script = render_harness(workflow)

    assert '_p=\'$AGENT_NAME\'; agent="${agent//"$_p"/"$AGENT_NAME"}"' in script
    assert '_p=\'$MODEL\'; model="${model//"$_p"/"$MODEL"}"' in script
    assert '_p=\'${COMMAND_NAME}\'; command="${command//"$_p"/"$COMMAND_NAME"}"' in script


def test_render_harness_expand_fields_also_expands_prompt() -> None:
    workflow = Workflow(
        id="wf_expand_fields_prompt",
        name="Expand Fields Prompt",
        steps=[
            AgentStep(
                type="agent",
                prompt="Work on issue ${ISSUE_NUMBER}.",
                expandFields=True,
            )
        ],
    )

    script = render_harness(workflow)

    assert '_p=\'${ISSUE_NUMBER}\'; prompt="${prompt//"$_p"/"$ISSUE_NUMBER"}"' in script


def test_render_harness_expand_fields_false_by_default_no_substitution() -> None:
    workflow = Workflow(
        id="wf_expand_fields_default",
        name="Expand Fields Default",
        steps=[
            AgentStep(
                type="agent",
                prompt="Do the thing.",
                model="$MODEL",
            )
        ],
    )

    script = render_harness(workflow)

    assert "local model='$MODEL'" in script
    assert "_p=" not in script


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
    assert "run_step step_build bash\n" in script
    assert "run_step step_build_2 bash\n" in script
    assert "run_step step_build_3 bash\n" in script


def test_cli_exposes_version_without_workflow_argument() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0, result.output
    assert result.output.strip().startswith("flowsh-cli ")


def test_cli_exposes_schema_without_workflow_argument() -> None:
    result = runner.invoke(app, ["--schema"])

    assert result.exit_code == 0, result.output
    assert result.stderr == ""
    assert "title: WorkflowFile" in result.output
    assert "const: vars" in result.output
    assert "const: bash" in result.output
    assert "const: agent" in result.output
    assert "model:" in result.output
    assert "command:" in result.output
    assert "dangerouslySkipPermissions:" in result.output
    assert "capture:" in result.output
    assert "Each value is a shell command." in result.output
    assert "Name of a variable (defined by a preceding vars step)" in result.output
    assert "Name of the shell variable exported into each iteration body." in result.output
    assert "enabled:" in result.output
    assert "schedule:" in result.output
    assert "shellScriptPath:" in result.output


def test_cli_uses_default_workflow_path_when_argument_is_omitted() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "Cannot stat workflow YAML" in result.stderr
    assert "workflows.yml" in result.stderr


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
    output = tmp_path / "example.sh"
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
    first_content = (tmp_path / "example.sh").read_text(encoding="utf-8")
    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    second_content = (tmp_path / "example.sh").read_text(encoding="utf-8")

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first_content == second_content


def test_cli_force_overwrites_regular_file_atomically(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    output = tmp_path / "example.sh"
    output.write_text("old content\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "Wrote example.sh\n"
    assert output.read_text(encoding="utf-8").startswith("#!/usr/bin/env bash\n")
    assert output.stat().st_mode & 0o777 == 0o700


def test_cli_force_replaces_output_symlink_without_following_it(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    target = tmp_path / "external-target.sh"
    target.write_text("external\n", encoding="utf-8")
    (tmp_path / "example.sh").symlink_to(target)

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    output = tmp_path / "example.sh"
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
    existing = tmp_path / "second.sh"
    existing.write_text("existing\n", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Refusing to overwrite existing file(s): second.sh" in result.stderr
    assert not (tmp_path / "first.sh").exists()
    assert existing.read_text(encoding="utf-8") == "existing\n"


def test_cli_refuses_to_overwrite_broken_symlink(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    (tmp_path / "example.sh").symlink_to("missing-target.sh")

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode != 0
    assert "Refusing to overwrite" in result.stderr
    assert (tmp_path / "example.sh").is_symlink()


def test_cli_force_refuses_directory_at_harness_file_path(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    output = tmp_path / "example.sh"
    output.mkdir()

    result = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", str(workflow_file), "--force"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "ERROR: Output path exists but is a directory: example.sh" in result.stderr
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
        ["bash", str(tmp_path / "shell_labels.sh")],
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
    assert "Generate reproducible shell scripts from workflow YAML files" in normalized_help
    assert "Options" in normalized_help

    dry_run = runner.invoke(app, [str(workflow_file), "--dry-run"])

    assert dry_run.exit_code == 0, dry_run.output
    assert "DRY-RUN would write example.sh" in dry_run.output
    assert not (tmp_path / "example.sh").exists()


def test_cli_help_is_deterministic_across_repeated_runs() -> None:
    first = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**_BASE_ENV, "COLUMNS": "120"},
    )
    second = subprocess.run(
        [sys.executable, "-m", "flowsh_cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**_BASE_ENV, "COLUMNS": "120"},
    )

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first.stdout == second.stdout
    assert first.stderr == second.stderr == ""
    assert _strip_ansi(first.stdout) == EXPECTED_HELP


def test_uv_console_entrypoint_help_matches_contract() -> None:
    result = subprocess.run(
        ["uv", "run", "flowsh-cli", "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**_BASE_ENV, "COLUMNS": "200"},
    )

    assert result.returncode == 0, result.stderr
    plain = _strip_ansi(result.stdout)
    assert "Usage: flowsh-cli [OPTIONS] [WORKFLOW_YAML]" in plain
    assert "Path to workflow.yml" in plain
    assert "--dry-run" in plain
    assert "--force" in plain
    assert "--version" in plain
    assert "--schema" in plain


def test_direct_script_entrypoint_help_matches_contract() -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "workflow_to_harness.py"

    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        check=False,
        capture_output=True,
        text=True,
        env={**_BASE_ENV, "COLUMNS": "120"},
    )

    assert result.returncode == 0, result.stderr
    assert _strip_ansi(result.stdout) == EXPECTED_HELP
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
        == ("DRY-RUN would write example.sh for workflow 'Example Harness'\n")
    )
    assert first.stderr == second.stderr == ""
    assert not (tmp_path / "example.sh").exists()


def test_parse_workflows_accepts_all_optional_metadata_fields(tmp_path: Path) -> None:
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

    workflows = parse_workflows(workflow_file)
    assert len(workflows) == 1
    wf = workflows[0]
    assert wf.enabled is True
    assert wf.schedule == "manual"
    assert wf.shellScriptPath == ".harness/legacy.sh"


def test_parse_workflows_accepts_partial_metadata_fields(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_partial
    name: Partial Metadata
    enabled: false
    steps:
      - type: bash
        run: echo partial
""".lstrip(),
        encoding="utf-8",
    )
    workflows = parse_workflows(workflow_file)
    assert len(workflows) == 1
    wf = workflows[0]
    assert wf.enabled is False
    assert wf.schedule is None
    assert wf.shellScriptPath is None


def test_parse_workflows_applies_default_metadata_when_fields_absent(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_no_meta
    name: No Metadata
    steps:
      - type: bash
        run: echo no-meta
""".lstrip(),
        encoding="utf-8",
    )
    workflows = parse_workflows(workflow_file)
    assert len(workflows) == 1
    wf = workflows[0]
    assert wf.enabled is True
    assert wf.schedule is None
    assert wf.shellScriptPath is None


def test_generated_harness_is_identical_with_and_without_metadata_fields(tmp_path: Path) -> None:
    base_file = tmp_path / "base.yml"
    base_file.write_text(
        """
workflows:
  - id: wf_meta_test
    name: Meta Test
    steps:
      - type: bash
        run: echo hello
""".lstrip(),
        encoding="utf-8",
    )

    meta_file = tmp_path / "meta.yml"
    meta_file.write_text(
        """
workflows:
  - id: wf_meta_test
    name: Meta Test
    enabled: true
    schedule: "0 * * * *"
    shellScriptPath: .harness/wf_meta_test.sh
    steps:
      - type: bash
        run: echo hello
""".lstrip(),
        encoding="utf-8",
    )

    base_workflows = parse_workflows(base_file)
    meta_workflows = parse_workflows(meta_file)

    from flowsh_cli.render import render_harness

    assert render_harness(base_workflows[0]) == render_harness(meta_workflows[0])


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
    harness = tmp_path / "bash_features.sh"
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
    harness = tmp_path / "agent_features.sh"
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
        ["bash", str(tmp_path / "agent_invocation.sh")],
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


def test_generated_harness_invokes_opencode_with_all_agent_options(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_options
    name: Agent Options
    steps:
      - type: agent
        name: Ask OpenCode
        agent: general
        model: provider/model
        command: review
        dangerouslySkipPermissions: true
        prompt: |
          --help
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
        ["bash", str(tmp_path / "agent_options.sh")],
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
        "run\n"
        "--format\n"
        "json\n"
        "--agent\n"
        "general\n"
        "--model\n"
        "provider/model\n"
        "--command\n"
        "review\n"
        "--dangerously-skip-permissions\n"
        "--\n"
        "--help\n"
    )
    assert prompt_capture.read_text(encoding="utf-8") == "--help"
    assert '{"ok":true}' in executed.stdout


def test_generated_harness_captures_agent_output_for_later_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_capture
    name: Agent Capture
    steps:
      - type: agent
        capture: IMPLEMENT_OUTPUT
        prompt: |
          Print a sentinel.
      - type: bash
        run: |
          if echo "$IMPLEMENT_OUTPUT" | grep -qF '<implement-status>blocked</implement-status>'; then
            printf 'blocked\\n'
          fi
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
printf '<implement-status>blocked</implement-status>\\n'
""",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / "agent_capture.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}"},
    )

    assert executed.returncode == 0, executed.stderr
    assert "blocked" in executed.stdout


def test_generated_harness_preserves_agent_capture_failure_status(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_capture_failure
    name: Agent Capture Failure
    steps:
      - type: agent
        name: Ask OpenCode
        capture: IMPLEMENT_OUTPUT
        prompt: |
          Print a sentinel and fail.
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
printf '<implement-status>blocked</implement-status>\n'
exit 17
""",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / "agent_capture_failure.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}"},
    )

    assert executed.returncode == 17, executed.stderr
    assert "blocked" in executed.stdout


def test_generated_harness_agent_without_capture_still_streams_output(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_stream
    name: Agent Stream
    steps:
      - type: agent
        prompt: |
          Stream the output.
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
printf '<streamed-output>\\n'
""",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)

    assert generated.returncode == 0, generated.stderr
    executed = subprocess.run(
        ["bash", str(tmp_path / "agent_stream.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}"},
    )

    assert executed.returncode == 0, executed.stderr
    assert "<streamed-output>" in executed.stdout


def test_generated_harness_expands_agent_prompt_when_expand_prompt_enabled(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_prompt_expand
    name: Agent Prompt Expand
    steps:
      - type: vars
        name: Capture issue
        values:
          ISSUE_NUMBER: printf '16'
      - type: agent
        name: Ask OpenCode
        expandPrompt: true
        prompt: |
          Work on issue $ISSUE_NUMBER.
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
        ["bash", str(tmp_path / "agent_prompt_expand.sh")],
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
    assert prompt_capture.read_text(encoding="utf-8") == "Work on issue 16."
    assert '{"ok":true}' in executed.stdout


def test_generated_harness_keeps_agent_prompt_literal_by_default(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_prompt_literal
    name: Agent Prompt Literal
    steps:
      - type: vars
        name: Capture issue
        values:
          ISSUE_NUMBER: printf '16'
      - type: agent
        name: Ask OpenCode
        prompt: |
          Work on issue $ISSUE_NUMBER.
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
        ["bash", str(tmp_path / "agent_prompt_literal.sh")],
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
    assert prompt_capture.read_text(encoding="utf-8") == "Work on issue $ISSUE_NUMBER."
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
        ["bash", str(tmp_path / "dash_prompt.sh")],
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
        ["bash", str(tmp_path / "args.sh"), "--unknown"],
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
        ["/bin/bash", str(tmp_path / "agent_missing.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "PATH": "/usr/bin:/bin"},
    )

    assert executed.returncode == 127
    assert "opencode CLI not found in PATH" in executed.stderr
    assert "Step failed: step_ask_missing_opencode [agent] (exit=127)" in executed.stderr


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
    harness = tmp_path / "private_logs.sh"
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
        ["bash", str(tmp_path / "log_symlink.sh")],
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
        ["bash", str(tmp_path / "log_parent_symlink.sh")],
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
        ["bash", str(tmp_path / "absolute_log.sh")],
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
        ["bash", str(tmp_path / "parent_log.sh")],
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
        ["bash", str(tmp_path / "log_create_failure.sh")],
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
        ["bash", str(tmp_path / "log_write_failure.sh")],
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
        ["bash", str(tmp_path / "fail_fast.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_must_fail [bash]" in executed.stderr
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
        ["bash", str(tmp_path / "vars_fail_fast.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_capture_variables [vars]" in executed.stderr
    assert not (tmp_path / "should-not-exist").exists()
    assert not (tmp_path / "should-not-exist-either").exists()


def test_generated_harness_vars_step_command_not_found_includes_hint(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_vars_command_not_found
    name: Vars Command Not Found
    steps:
      - type: vars
        name: Setup Fruits
        values:
          FRUITS: |
            apple
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
        ["bash", str(tmp_path / "vars_command_not_found.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_setup_fruits [vars] (exit=127)" in executed.stderr
    assert "vars values are shell commands" in executed.stderr


def test_generated_harness_bash_step_failure_omits_vars_hint(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_bash_fail_fast
    name: Bash Fail Fast
    steps:
      - type: bash
        name: Not A Command
        run: apple
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
        ["bash", str(tmp_path / "bash_fail_fast.sh")],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode != 0
    assert "Step failed: step_not_a_command [bash] (exit=127)" in executed.stderr
    assert "vars values are shell commands" not in executed.stderr


# ---------------------------------------------------------------------------
# WorkflowParam tests (issue #19)
# ---------------------------------------------------------------------------


def test_workflow_param_name_must_be_uppercase_env_var_style():
    """WorkflowParam rejects lowercase names."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        WorkflowParam(name="issue_number")


def test_workflow_param_name_rejects_starting_digit():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        WorkflowParam(name="1BAD")


def test_workflow_with_params_parses_from_yaml():
    """params field is accepted in YAML workflow."""
    data = {
        "workflows": [
            {
                "id": "wf_example",
                "name": "Example",
                "params": [{"name": "ISSUE_NUMBER", "required": True}],
                "steps": [{"type": "bash", "run": "echo $ISSUE_NUMBER"}],
            }
        ]
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert len(workflows[0].params) == 1
    assert workflows[0].params[0].name == "ISSUE_NUMBER"
    assert workflows[0].params[0].required is True


def test_workflow_without_params_field_still_valid():
    """Existing YAML without params key is unchanged (default empty list)."""
    data = {
        "workflows": [
            {
                "id": "wf_example",
                "name": "Example",
                "steps": [{"type": "bash", "run": "echo hi"}],
            }
        ]
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert workflows[0].params == []


def test_generated_harness_binds_required_positional_param(tmp_path):
    """Positional arg $1 is exported as the declared param name."""
    workflow = Workflow(
        id="wf_test_param",
        name="test_param",
        params=[WorkflowParam(name="ISSUE_NUMBER", required=True)],
        steps=[BashStep(type="bash", run="printf '%s\\n' \"$ISSUE_NUMBER\"")],
    )
    harness = tmp_path / "test_param.sh"
    harness.write_text(render_harness(workflow))
    result = subprocess.run(["bash", str(harness), "42"], capture_output=True, text=True)
    assert result.returncode == 0
    assert result.stdout.strip() == "42"


def test_generated_harness_accepts_env_var_override_for_required_param(tmp_path):
    """Pre-set env var satisfies required check without positional arg."""
    workflow = Workflow(
        id="wf_test_env",
        name="test_env",
        params=[WorkflowParam(name="ISSUE_NUMBER", required=True)],
        steps=[BashStep(type="bash", run="printf '%s\\n' \"$ISSUE_NUMBER\"")],
    )
    harness = tmp_path / "test_env.sh"
    harness.write_text(render_harness(workflow))
    env = {**os.environ, "ISSUE_NUMBER": "99"}
    result = subprocess.run(["bash", str(harness)], capture_output=True, text=True, env=env)
    assert result.returncode == 0
    assert result.stdout.strip() == "99"


def test_generated_harness_exits_2_when_required_param_missing(tmp_path):
    """Missing required param without env var prints usage and exits 2."""
    workflow = Workflow(
        id="wf_test_required",
        name="test_required",
        params=[WorkflowParam(name="ISSUE_NUMBER", required=True)],
        steps=[BashStep(type="bash", run="true")],
    )
    harness = tmp_path / "test_required.sh"
    harness.write_text(render_harness(workflow))
    result = subprocess.run(
        ["bash", str(harness)], capture_output=True, text=True, env={"PATH": os.environ["PATH"]}
    )
    assert result.returncode == 2
    assert "Usage:" in result.stderr
    assert "ISSUE_NUMBER" in result.stderr


def test_generated_harness_optional_param_unset_when_not_provided(tmp_path):
    """Optional param without positional arg stays unset (no exit 2)."""
    workflow = Workflow(
        id="wf_test_optional",
        name="test_optional",
        params=[WorkflowParam(name="TAG", required=False)],
        steps=[BashStep(type="bash", run="printf '%s\\n' \"${TAG:-default}\"")],
    )
    harness = tmp_path / "test_optional.sh"
    harness.write_text(render_harness(workflow))
    result = subprocess.run(["bash", str(harness)], capture_output=True, text=True)
    assert result.returncode == 0
    assert result.stdout.strip() == "default"


def test_generated_harness_param_with_dry_run_flag(tmp_path):
    """--dry-run works alongside a positional param."""
    workflow = Workflow(
        id="wf_test_dryrun_param",
        name="test_dryrun_param",
        params=[WorkflowParam(name="ISSUE_NUMBER", required=True)],
        steps=[BashStep(type="bash", run="printf '%s\\n' \"$ISSUE_NUMBER\"")],
    )
    harness = tmp_path / "test_dryrun_param.sh"
    harness.write_text(render_harness(workflow))
    result = subprocess.run(
        ["bash", str(harness), "42", "--dry-run"], capture_output=True, text=True
    )
    assert result.returncode == 0


# ---------------------------------------------------------------------------
# ForStep model parsing
# ---------------------------------------------------------------------------


def test_parse_workflows_accepts_for_step(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_for_basic
    name: For Basic
    steps:
      - type: vars
        name: Collect items
        values:
          ITEMS: printf 'file-a\\nfile-b'
      - type: for
        name: Process each item
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            name: Process
            run: |
              echo "Processing $ITEM"
""".lstrip(),
        encoding="utf-8",
    )
    from flowsh_cli.models import ForStep

    workflows = parse_workflows(workflow_file)
    for_step = workflows[0].steps[1]

    assert isinstance(for_step, ForStep)
    assert for_step.in_ == "ITEMS"
    assert for_step.item == "ITEM"
    assert len(for_step.steps) == 1
    assert isinstance(for_step.steps[0], BashStep)


def test_parse_workflows_rejects_for_step_with_invalid_item_name(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_for_bad_item
    name: For Bad Item
    steps:
      - type: for
        in: ITEMS
        item: bad-item
        steps:
          - type: bash
            run: echo "$bad_item"
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="item"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_for_step_with_empty_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_for_empty
    name: For Empty
    steps:
      - type: for
        in: ITEMS
        item: ITEM
        steps: []
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_accepts_while_step(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_while_basic
    name: While Basic
    steps:
      - type: while
        name: Process queue
        condition: '[ -n "$(ls queue 2>/dev/null)" ]'
        steps:
          - type: bash
            name: Consume
            run: echo "working"
""".lstrip(),
        encoding="utf-8",
    )

    workflow = parse_workflows(workflow_file)[0]
    step = workflow.steps[0]

    assert isinstance(step, WhileStep)
    assert step.condition == '[ -n "$(ls queue 2>/dev/null)" ]'
    assert len(step.steps) == 1
    assert isinstance(step.steps[0], BashStep)


def test_parse_workflows_rejects_empty_while_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_while_empty
    name: While Empty
    steps:
      - type: while
        condition: '[ -n "$(ls queue 2>/dev/null)" ]'
        steps: []
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_nested_while_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_nested_while
    name: Nested While
    steps:
      - type: while
        condition: '[ -n "$(ls queue 2>/dev/null)" ]'
        steps:
          - type: while
            condition: '[ -n "$(ls nested 2>/dev/null)" ]'
            steps:
              - type: bash
                run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="nested while steps"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_nested_for_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_nested_for
    name: Nested For
    steps:
      - type: for
        in: ITEMS
        item: ITEM
        steps:
          - type: for
            in: NESTED_ITEMS
            item: NESTED_ITEM
            steps:
              - type: bash
                run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="nested for steps"):
        parse_workflows(workflow_file)


def test_parse_workflows_rejects_while_step_with_unsafe_control_chars(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_while_unsafe
    name: While Unsafe
    steps:
      - type: while
        condition: ""
        steps:
          - type: bash
            run: echo ok
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError, match="condition"):
        parse_workflows(workflow_file)


def test_while_step_validator_rejects_unsafe_control_chars() -> None:
    with pytest.raises(ValueError, match="unsafe control characters"):
        WhileStep.model_validate(
            {
                "type": "while",
                "condition": "echo \x1f",
                "steps": [{"type": "bash", "run": "echo ok"}],
            }
        )


# ---------------------------------------------------------------------------
# ForStep render
# ---------------------------------------------------------------------------


def test_render_harness_for_step_emits_inner_functions_and_loop() -> None:
    from flowsh_cli.models import ForStep

    workflow = Workflow(
        id="wf_for_render",
        name="For Render",
        steps=[
            ForStep(
                type="for",
                name="Process items",
                **{"in": "ITEMS"},
                item="ITEM",
                steps=[BashStep(type="bash", name="Process", run='echo "$ITEM"')],
            )
        ],
    )

    script = render_harness(workflow)

    assert "for_1_process() {" in script
    assert "while IFS= read -r ITEM; do" in script
    assert "export ITEM" in script
    assert "run_step for_1_process bash" in script
    assert 'done <<< "${ITEMS}"' in script
    assert "run_stateful_step step_process_items for" in script


# ---------------------------------------------------------------------------
# ForStep end-to-end execution
# ---------------------------------------------------------------------------


def test_generated_harness_runs_for_step_over_vars_items(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_for_e2e
    name: For E2E
    steps:
      - type: vars
        name: Collect items
        values:
          ITEMS: printf 'alpha\\nbeta\\ngamma'
      - type: for
        name: Process each item
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            name: Emit item
            run: |
              printf 'item:%s\\n' "$ITEM"
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
    harness = tmp_path / "for_e2e.sh"
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
    assert "item:alpha" in executed.stdout
    assert "item:beta" in executed.stdout
    assert "item:gamma" in executed.stdout


def test_generated_harness_for_step_dry_run_skips_inner_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_for_dry
    name: For Dry
    steps:
      - type: vars
        name: Collect items
        values:
          ITEMS: printf 'x\\ny'
      - type: for
        name: Process each item
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            name: Emit
            run: printf 'should-not-appear\\n'
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
        ["bash", str(tmp_path / "for_dry.sh"), "--dry-run"],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert executed.returncode == 0, executed.stderr
    assert "should-not-appear" not in executed.stdout
    assert "[DRY-RUN]" in executed.stderr


# ---------------------------------------------------------------------------
# WhileStep render
# ---------------------------------------------------------------------------


def test_render_harness_while_step_emits_re_evaluated_loop() -> None:
    workflow = Workflow(
        id="wf_while_render",
        name="While Render",
        steps=[
            WhileStep(
                type="while",
                name="Process queue",
                condition='[ -n "$(ls queue 2>/dev/null)" ]',
                steps=[BashStep(type="bash", name="Consume", run='echo "working"')],
            )
        ],
    )

    script = render_harness(workflow)

    assert 'while ([ -n "$(ls queue 2>/dev/null)" ]); do' in script
    assert "while IFS= read -r" not in script
    assert "run_step step_consume" in script
    assert "run_stateful_step step_process_queue" in script


# ---------------------------------------------------------------------------
# WhileStep end-to-end execution
# ---------------------------------------------------------------------------


def test_generated_harness_runs_while_step_until_queue_is_empty(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_while_e2e
    name: While E2E
    steps:
      - type: bash
        name: Seed queue
        run: |
          mkdir -p queue
          printf 'alpha\\n' > queue/alpha
      - type: while
        name: Drain queue
        condition: '[ -n "$(ls queue 2>/dev/null)" ]'
        steps:
          - type: bash
            name: Process one item
            run: |
              item=$(ls queue | sort | head -1)
              printf 'item:%s\\n' "$item"
              rm "queue/$item"
              if [ "$item" = alpha ]; then
                printf 'beta\\n' > queue/beta
              fi
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
    harness = tmp_path / "while_e2e.sh"
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
    assert "item:alpha" in executed.stdout
    assert "item:beta" in executed.stdout
    assert not (tmp_path / "queue").exists() or not any((tmp_path / "queue").iterdir())


def test_generated_harness_fails_while_step_on_child_error(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_while_fail
    name: While Fail
    steps:
      - type: bash
        name: Seed queue
        run: |
          mkdir -p queue
          printf 'alpha\\n' > queue/alpha
      - type: while
        name: Drain queue
        condition: '[ -n "$(ls queue 2>/dev/null)" ]'
        steps:
          - type: bash
            name: Process one item
            run: |
              item=$(ls queue | sort | head -1)
              rm "queue/$item"
              exit 1
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
    harness = tmp_path / "while_fail.sh"
    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )

    assert executed.returncode != 0


# ---------------------------------------------------------------------------
# ParallelStep tests (issue #25)
# ---------------------------------------------------------------------------


def test_parse_workflows_accepts_parallel_step(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_parallel
    name: Parallel Workflow
    steps:
      - type: parallel
        name: Fan out
        steps:
          - type: bash
            name: Build
            run: printf 'build\\n'
          - type: bash
            name: Test
            run: printf 'test\\n'
""",
        encoding="utf-8",
    )

    workflows = parse_workflows(workflow_file)

    assert len(workflows) == 1
    assert len(workflows[0].steps) == 1
    step = workflows[0].steps[0]
    assert isinstance(step, ParallelStep)
    assert step.name == "Fan out"
    assert len(step.steps) == 2
    assert isinstance(step.steps[0], BashStep)
    assert isinstance(step.steps[1], BashStep)


def test_parse_workflows_rejects_empty_parallel_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_empty_parallel
    name: Empty Parallel
    steps:
      - type: parallel
        name: Empty
        steps: []
""",
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError):
        parse_workflows(workflow_file)


def test_parse_workflows_accepts_parallel_step_with_vars_and_agent(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_parallel_mixed
    name: Parallel Mixed
    steps:
      - type: parallel
        name: Mixed
        steps:
          - type: vars
            name: Capture value
            values:
              VALUE: printf 'hello'
          - type: agent
            name: Ask
            prompt: Say hello.
""",
        encoding="utf-8",
    )

    workflows = parse_workflows(workflow_file)
    step = workflows[0].steps[0]
    assert isinstance(step, ParallelStep)
    assert isinstance(step.steps[0], VarsStep)
    assert isinstance(step.steps[1], AgentStep)


def test_render_harness_parallel_step_generates_fork_join_bash() -> None:
    workflow = Workflow(
        id="wf_parallel_render",
        name="Parallel Render",
        steps=[
            ParallelStep(
                type="parallel",
                name="Fan out",
                steps=[
                    BashStep(type="bash", name="Build", run="printf 'build\\n'"),
                    BashStep(type="bash", name="Test", run="printf 'test\\n'"),
                ],
            )
        ],
    )

    script = render_harness(workflow)

    # Child functions are emitted
    assert "step_build()" in script
    assert "step_test()" in script
    # Fork-join pattern present
    assert '"step_build" &' in script
    assert '"step_test" &' in script
    assert "pid_step_build=$!" in script
    assert "pid_step_test=$!" in script
    assert 'wait "$pid_step_build"' in script
    assert 'wait "$pid_step_test"' in script
    # Wrapper function emitted
    assert "step_fan_out()" in script
    # Wrapper is called via run_stateful_step (no process-substitution fd hang risk)
    assert "run_stateful_step step_fan_out parallel" in script
    # Children are NOT directly called via run_step at top level
    assert "run_step step_build" not in script
    assert "run_step step_test" not in script


def test_render_harness_parallel_step_section_comment() -> None:
    workflow = Workflow(
        id="wf_par_comment",
        name="Par Comment",
        steps=[
            ParallelStep(
                type="parallel",
                steps=[
                    BashStep(type="bash", run="echo a"),
                    BashStep(type="bash", run="echo b"),
                ],
            )
        ],
    )

    script = render_harness(workflow)

    assert "Parallel child 1" in script
    assert "Parallel child 2" in script
    assert "parallel (2 steps)" in script


def test_generated_harness_runs_parallel_steps(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_parallel_exec
    name: Parallel Exec
    steps:
      - type: parallel
        name: Fan out
        steps:
          - type: bash
            name: Write A
            run: printf 'output_a\\n'
          - type: bash
            name: Write B
            run: printf 'output_b\\n'
""",
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

    harness = tmp_path / "parallel_exec.sh"
    assert harness.exists()

    syntax = subprocess.run(
        ["bash", "-n", str(harness)], check=False, capture_output=True, text=True
    )
    assert syntax.returncode == 0, syntax.stderr

    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )
    assert executed.returncode == 0, executed.stderr
    assert "output_a" in executed.stdout
    assert "output_b" in executed.stdout


def test_generated_harness_parallel_step_propagates_child_failure(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_parallel_fail
    name: Parallel Fail
    steps:
      - type: parallel
        name: Fan out
        steps:
          - type: bash
            name: Success
            run: printf 'ok\\n'
          - type: bash
            name: Failure
            run: "false"
""",
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

    harness = tmp_path / "parallel_fail.sh"

    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
    )
    assert executed.returncode != 0
    assert "Step failed: step_fan_out [parallel]" in executed.stderr


def test_generated_harness_parallel_step_exits_promptly_with_lingering_grandchild(
    tmp_path: Path,
) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
workflows:
  - id: wf_parallel_grandchild
    name: Parallel Grandchild
    steps:
      - type: parallel
        name: Fan out
        steps:
          - type: bash
            name: Spawn detached grandchild
            run: "printf 'done\\n'; ( sleep 5 & ) >/dev/null 2>&1 &"
""",
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

    harness = tmp_path / "parallel_grandchild.sh"
    assert harness.exists()

    start = time.monotonic()
    executed = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
        env={**os.environ, "FLOWSH_LOG_DIR": "logs"},
        timeout=5,
    )
    duration = time.monotonic() - start

    assert executed.returncode == 0, executed.stderr
    assert "done" in executed.stdout
    assert duration < 5, (
        f"harness took {duration:.2f}s to exit; expected prompt exit despite lingering "
        "grandchild process holding stdout/stderr open"
    )


def test_render_harness_parallel_coexists_with_sequential_steps() -> None:
    workflow = Workflow(
        id="wf_mixed_seq_par",
        name="Mixed Seq Par",
        steps=[
            BashStep(type="bash", name="Setup", run="echo setup"),
            ParallelStep(
                type="parallel",
                steps=[
                    BashStep(type="bash", name="Build", run="echo build"),
                    BashStep(type="bash", name="Test", run="echo test"),
                ],
            ),
            BashStep(type="bash", name="Teardown", run="echo done"),
        ],
    )

    script = render_harness(workflow)

    # Sequential steps called at top level
    assert "run_step step_setup bash" in script
    assert "run_step step_teardown bash" in script
    # Children backgrounded inside wrapper, not at top level
    assert '"step_build" &' in script
    assert '"step_test" &' in script
    # Children not individually called at top level
    assert "run_step step_build" not in script
    assert "run_step step_test" not in script


# ---------------------------------------------------------------------------
# --examples / --example tests (issue #23)
# ---------------------------------------------------------------------------


def test_cli_lists_examples_without_workflow_argument() -> None:
    result = runner.invoke(app, ["--examples"])

    assert result.exit_code == 0, result.output
    assert "simple" in result.output
    assert "medium" in result.output
    assert "sophisticated" in result.output
    assert "vars, bash" in result.output


def test_cli_prints_named_example_yaml_simple() -> None:
    result = runner.invoke(app, ["--example", "simple"])

    assert result.exit_code == 0, result.output
    assert "wf_simple" in result.output
    assert "workflows:" in result.output


def test_cli_named_example_is_valid_workflow(tmp_path: Path) -> None:
    result = runner.invoke(app, ["--example", "simple"])
    assert result.exit_code == 0

    workflow_file = tmp_path / "simple.yml"
    workflow_file.write_text(result.output, encoding="utf-8")

    workflows = parse_workflows(workflow_file)
    assert len(workflows) == 1
    assert workflows[0].id == "wf_simple"


def test_cli_named_example_dry_run(tmp_path: Path) -> None:
    for name in ("simple", "medium", "sophisticated"):
        result = runner.invoke(app, ["--example", name])
        assert result.exit_code == 0, f"--example {name} failed: {result.output}"

        workflow_file = tmp_path / f"{name}.yml"
        workflow_file.write_text(result.output, encoding="utf-8")

        dry = runner.invoke(app, [str(workflow_file), "--dry-run"])
        assert dry.exit_code == 0, f"dry-run for {name} failed: {dry.output}"


def test_cli_rejects_unknown_example_name() -> None:
    result = runner.invoke(app, ["--example", "typo"])

    assert result.exit_code == 1
    combined = result.output + (result.stderr or "")
    assert "unknown example" in combined
    assert "simple" in combined


# ---------------------------------------------------------------------------
# description field tests (issue #40)
# ---------------------------------------------------------------------------


def test_workflow_file_accepts_optional_description() -> None:
    """WorkflowFile accepts a description string at root level."""
    data = {
        "description": "Top-level file documentation",
        "workflows": [
            {
                "id": "wf_doc",
                "name": "Documented",
                "steps": [{"type": "bash", "run": "echo hi"}],
            }
        ],
    }
    wf = WorkflowFile.model_validate(data)
    assert wf.description == "Top-level file documentation"


def test_workflow_accepts_optional_description() -> None:
    """Workflow accepts a description string per workflow entry."""
    data = {
        "workflows": [
            {
                "id": "wf_doc",
                "name": "Documented",
                "description": "Does something useful",
                "steps": [{"type": "bash", "run": "echo hi"}],
            }
        ],
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert workflows[0].description == "Does something useful"


def test_workflow_without_description_defaults_to_none() -> None:
    """Existing YAML without workflow-level description defaults to None (no regression)."""
    data = {
        "workflows": [
            {
                "id": "wf_plain",
                "name": "Plain",
                "steps": [{"type": "bash", "run": "echo hi"}],
            }
        ],
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert workflows[0].description is None


def test_workflow_file_without_description_defaults_to_none() -> None:
    """Existing YAML without root-level description defaults to None (no regression)."""
    data = {
        "workflows": [
            {
                "id": "wf_plain",
                "name": "Plain",
                "steps": [{"type": "bash", "run": "echo hi"}],
            }
        ],
    }
    wf = WorkflowFile.model_validate(data)
    assert wf.description is None


# ---------------------------------------------------------------------------
# --output tests (issue #35)
# ---------------------------------------------------------------------------


def test_cli_output_writes_harness_to_explicit_path(tmp_path: Path) -> None:
    """--output writes the script to the given path, not the default harness_path."""
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    custom_output = tmp_path / "scripts" / "run.sh"

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flowsh_cli",
            str(workflow_file),
            "--workflow",
            "wf_example",
            "--output",
            str(custom_output),
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert custom_output.exists()
    assert custom_output.read_text(encoding="utf-8").startswith("#!/usr/bin/env bash\n")
    assert custom_output.stat().st_mode & 0o777 == 0o700
    # Default path must NOT have been created
    assert not (tmp_path / "example.sh").exists()


def test_cli_output_creates_parent_directories(tmp_path: Path) -> None:
    """--output creates intermediate parent directories when they do not exist."""
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    nested_output = tmp_path / "a" / "b" / "c" / "run.sh"

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flowsh_cli",
            str(workflow_file),
            "--workflow",
            "wf_example",
            "--output",
            str(nested_output),
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert nested_output.exists()


def test_cli_output_rejects_multi_workflow_without_selector(tmp_path: Path) -> None:
    """--output aborts with an error when multiple workflows would be generated."""
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """\
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
""",
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flowsh_cli",
            str(workflow_file),
            "--output",
            str(tmp_path / "out.sh"),
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 1
    assert result.stdout == ""
    assert "--output requires exactly one workflow" in result.stderr
    assert not (tmp_path / "out.sh").exists()
    assert not (tmp_path / "first.sh").exists()


def test_cli_output_dry_run_prints_resolved_path(tmp_path: Path) -> None:
    """--dry-run with --output prints the --output path, not the default path."""
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)
    custom_output = tmp_path / "scripts" / "run.sh"

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flowsh_cli",
            str(workflow_file),
            "--workflow",
            "wf_example",
            "--output",
            str(custom_output),
            "--dry-run",
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert str(custom_output) in result.stdout
    assert "DRY-RUN" in result.stdout
    assert not custom_output.exists()


def test_cli_output_with_workflow_selector_for_single_workflow_file(tmp_path: Path) -> None:
    """--output combined with --workflow works when file has a single workflow."""
    workflow_file = tmp_path / "workflows.yml"
    write_workflow(workflow_file)

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "flowsh_cli",
            str(workflow_file),
            "--workflow",
            "wf_example",
            "--output",
            "out.sh",
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert (tmp_path / "out.sh").exists()
    assert not (tmp_path / "example.sh").exists()


def test_cli_exposes_skill_without_workflow_argument() -> None:
    result = runner.invoke(app, ["--skill"])

    assert result.exit_code == 0, result.output
    assert result.stderr == ""
    assert result.output.startswith("---\nname: flowsh-cli\n")
    assert "uvx flowsh-cli --schema" in result.output
    assert "uvx flowsh-cli --help" in result.output
