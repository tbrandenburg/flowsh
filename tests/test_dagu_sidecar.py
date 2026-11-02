from __future__ import annotations

import hashlib
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner

import flowsh_cli.cli as cli_module
from flowsh_cli.cli import app
from flowsh_cli.dagu import (
    DAGU_MINIMUM_VERSION,
    dagu_sidecar_path,
    default_project_dir,
    render_bash_step,
    render_dagu_sidecar,
    unsupported_dagu_reasons,
)
from flowsh_cli.models import Workflow, WorkflowFile, WorkflowParseError, parse_workflows
from flowsh_cli.render import render_harness

runner = CliRunner()
BASELINE_SHA256 = "de284d1e0ce05d9bf3319c90ebf3111a618dcf3f23df7d168b2fe6d1d42e363c"
SOFATHEK_SOURCE = """workflows:
- id: wf_mmozh3te_a0828
  name: Continuous Issue Resolution
  enabled: true
  schedule: 0 * * * *
  steps:
  - type: bash
    run: gh issue list --limit 1 --state open | grep -q . || return 42
  - type: bash
    run: git restore --staged . 2>/dev/null && git restore . && git switch main &&
      git pull --rebase --autostash
  - type: agent
    prompt: Follow the instructions in @.opencode/commands/prp-issue-fix.md for the
      latest open issue on Github and take its investigation comment as the implementation
      plan, but also check if there is already a linked PR to continue.
    agent: build
  - type: agent
    prompt: Follow the instructions in @.opencode/commands/commit-push.md
    agent: build
  - type: agent
    prompt: 'Get the latest open Github issue and its linked PR: Only the PR shows
      merge issues follow the instructions in @.opencode/commands/resolve-ci-errors.md'
    agent: build
  - type: agent
    prompt: 'Get the latest open Github issue and its linked PR: Follow the instructions
      in @.opencode/commands/prp-review.md for the linked PR'
    agent: build
  - type: agent
    prompt: 'Get the latest open Github issue and its linked PR: Raise new Github
      issues (and check against present ones) with `gh` CLI if the PR review comments
      came up with high or critical priority findings, failing CI or merge blockers.
      Then, try to merge it. If any PR was processed, send a telegram message on the
      outcome.'
    agent: build
  - type: bash
    run: git restore --staged . 2>/dev/null && git restore . && git switch main &&
      git pull --rebase --autostash
  shellScriptPath: .harness/continuous-issue-resolution.sh
"""


def write_workflow(path: Path) -> None:
    path.write_text(
        """workflows:
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
""",
        encoding="utf-8",
    )


def write_supported_workflow(path: Path, *, include_agent: bool = True) -> None:
    steps = ["      - type: bash\n        run: printf 'first\\n'\n"]
    if include_agent:
        steps.append(
            "      - type: agent\n        agent: build\n        prompt: Read this literal prompt.\n"
        )
    steps.append("      - type: bash\n        run: printf 'last\\n'\n")
    path.write_text(
        "workflows:\n  - id: wf_native\n    name: Native fixture\n    steps:\n" + "".join(steps),
        encoding="utf-8",
    )


def parse_fixture(text: str) -> Workflow:
    return WorkflowFile.model_validate(yaml.safe_load(text)).workflows[0]


def test_pinned_sofathek_source_maps_to_exact_native_linear_graph(tmp_path: Path) -> None:
    source_path = tmp_path / "sofathek.yml"
    source_path.write_text(SOFATHEK_SOURCE, encoding="utf-8")
    workflow = parse_workflows(source_path)[0]
    document = yaml.safe_load(render_dagu_sidecar(workflow, project_dir=str(tmp_path)))
    nodes = document["steps"]

    assert [node["id"] for node in nodes] == [
        "step_01_bash",
        "step_02_bash",
        "step_03_agent",
        "step_04_agent",
        "step_05_agent",
        "step_06_agent",
        "step_07_agent",
        "step_08_bash",
    ]
    assert [node.get("depends") for node in nodes] == [
        None,
        ["step_01_bash"],
        ["step_02_bash"],
        ["step_03_agent"],
        ["step_04_agent"],
        ["step_05_agent"],
        ["step_06_agent"],
        ["step_07_agent"],
    ]
    assert (
        "gh issue list --limit 1 --state open | grep -q . || return 42" in nodes[0]["description"]
    )
    assert "git restore --staged ." in nodes[1]["description"]
    assert "@.opencode/commands/prp-issue-fix.md" in nodes[2]["description"]
    assert "@.opencode/commands/commit-push.md" in nodes[3]["description"]
    assert "@.opencode/commands/resolve-ci-errors.md" in nodes[4]["description"]
    assert "@.opencode/commands/prp-review.md" in nodes[5]["description"]
    assert "send a telegram message" in nodes[6]["description"]
    assert "git restore --staged ." in nodes[7]["description"]
    assert nodes[2]["run"].endswith('exec opencode run --agent "$agent" -- "$prompt"\n')
    assert ["bash" if node["id"].endswith("_bash") else "agent" for node in nodes] == [
        "bash",
        "bash",
        "agent",
        "agent",
        "agent",
        "agent",
        "agent",
        "bash",
    ]
    assert all(node["retry_policy"] == {"limit": 0, "interval_sec": 1} for node in nodes)
    assert all(node["continue_on"] == {"failure": False} for node in nodes)
    assert document["retry_policy"] == {"limit": 0, "interval_sec": 1}
    assert "schedule" not in document
    assert all("outputs" not in node and "output" not in node for node in nodes)
    assert "js.run" not in str(document)
    assert "file.write" not in str(document)
    assert "continuous-issue-resolution.sh" not in str(document)
    for node in nodes:
        subprocess.run(["bash", "-n"], input=node["run"], text=True, check=True)


def test_literal_bash_data_round_trips_without_outer_shell_execution(tmp_path: Path) -> None:
    marker = tmp_path / "should-not-exist"
    marker_backtick = tmp_path / "should-not-exist-backtick"
    source = (
        'printf \'%s\\n\' "${VALUE:-fallback}" "$HOME"\n'
        f"printf '%s\\n' '$(touch {marker})' "
        f"'`touch {marker_backtick}`' '\\\\' '$' 'single' \"double\" 'café 漢字' "
        "'${x:-${HOME}}' '\\${HOME}' '\\\\${HOME}'\n"
        "cat <<'FLOWSH_PROMPT_END'\n${HOME}\nFLOWSH_PROMPT_END\n"
    )
    workflow = parse_fixture(
        yaml.safe_dump(
            {
                "workflows": [
                    {
                        "id": "wf_literal",
                        "name": "Literal",
                        "steps": [{"type": "bash", "run": source}],
                    }
                ]
            },
            allow_unicode=True,
        )
    )
    dag = yaml.safe_load(render_dagu_sidecar(workflow, project_dir=str(tmp_path)))
    result = subprocess.run(
        ["bash"],
        input=dag["steps"][0]["run"],
        text=True,
        capture_output=True,
        env={"HOME": "literal-home", "PATH": "/usr/bin:/bin"},
        check=True,
    )

    assert result.stdout.splitlines() == [
        "fallback",
        "literal-home",
        f"$(touch {marker})",
        f"`touch {marker_backtick}`",
        "\\\\",
        "$",
        "single",
        "double",
        "café 漢字",
        "${x:-${HOME}}",
        "\\${HOME}",
        "\\\\${HOME}",
        "${HOME}",
    ]
    assert not marker.exists()
    assert not marker_backtick.exists()
    assert source in dag["steps"][0]["description"]


def test_bash_step_preserves_caller_stdin_while_running_literal_source() -> None:
    source = 'read -r value; printf "value=%s\\n" "$value"'
    rendered = render_bash_step(source)
    payload = "payload from caller stdin\n"
    result = subprocess.run(
        ["bash", "-c", rendered],
        input=payload,
        capture_output=True,
        text=True,
        env={"PATH": os.defpath},
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "value=payload from caller stdin\n"
    assert "printf '%b'" in rendered
    assert source not in rendered


def test_agent_prompt_is_exact_argv_data_and_agent_option_is_supported(
    tmp_path: Path,
) -> None:
    capture = tmp_path / "argv.bin"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_opencode = fake_bin / "opencode"
    fake_opencode.write_text(
        '#!/usr/bin/env bash\nset -euo pipefail\nprintf \'%s\\0\' "$@" > "$CAPTURE_ARGS"\n',
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)
    prompt = (
        "--looks-like-a-flag ${HOME} $(touch never) `touch never2`\n"
        "'single' \"double\"\\\\\n"
        "FLOWSH_PROMPT_END\n"
        "café 漢字 𐐀\n\n"
    )
    workflow = parse_fixture(
        yaml.safe_dump(
            {
                "workflows": [
                    {
                        "id": "wf_prompt",
                        "name": "Prompt",
                        "steps": [{"type": "agent", "agent": "build", "prompt": prompt}],
                    }
                ]
            },
            allow_unicode=True,
        )
    )
    dag = yaml.safe_load(render_dagu_sidecar(workflow, project_dir=str(tmp_path)))
    run = subprocess.run(
        ["bash"],
        input=dag["steps"][0]["run"],
        text=True,
        capture_output=True,
        env={
            "CAPTURE_ARGS": str(capture),
            "PATH": f"{fake_bin}{os.pathsep}/usr/bin:/bin",
        },
        check=True,
    )

    assert run.stdout == ""
    assert capture.read_bytes().split(b"\0") == [
        b"run",
        b"--agent",
        b"build",
        b"--",
        prompt.encode(),
        b"",
    ]
    assert not (tmp_path / "never").exists()
    assert not (tmp_path / "never2").exists()
    assert prompt in dag["steps"][0]["description"]


def test_dagu_v1_skips_unsupported_options_and_nested_constructs() -> None:
    workflow = parse_fixture(
        "workflows:\n  - id: wf_unsupported\n    name: Unsupported\n    steps:\n"
        "      - type: parallel\n        steps:\n"
        "          - type: agent\n            capture: ANSWER\n            prompt: hello\n"
        "          - type: bash\n            when: 'true'\n"
        "            run: 'for x in a; do echo $x; done'\n",
    )
    reasons = unsupported_dagu_reasons(workflow)

    assert reasons == [
        "steps[0].type=parallel unsupported for native Dagu v1",
        "steps[0].steps[0].capture unsupported for native Dagu v1",
        "steps[0].steps[1].when unsupported for native Dagu v1",
    ]
    with pytest.raises(ValueError, match="native Dagu v1"):
        render_dagu_sidecar(workflow, project_dir=".")


def test_source_workflow_params_are_skipped() -> None:
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_params",
                    "name": "Params",
                    "params": [{"name": "ISSUE_NUMBER"}],
                    "steps": [{"type": "bash", "run": "echo safe"}],
                }
            ]
        }
    ).workflows[0]

    assert unsupported_dagu_reasons(workflow) == ["params unsupported for native Dagu v1"]


def test_shell_control_keywords_in_bash_body_are_not_native_capability_checks() -> None:
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_shell_control",
                    "name": "Shell control",
                    "steps": [
                        {
                            "type": "bash",
                            "run": "for item in a; do while false; do echo if; done; done",
                        }
                    ],
                }
            ]
        }
    ).workflows[0]

    assert unsupported_dagu_reasons(workflow) == []


@pytest.mark.parametrize(
    ("agent_options", "expected"),
    [
        ("capture: ANSWER", "capture"),
        ("expandPrompt: true", "expandPrompt"),
        ("expandFields: true", "expandFields"),
        ("model: openai/example", "model"),
        ("command: review", "command"),
        ("dangerouslySkipPermissions: true", "dangerouslySkipPermissions"),
    ],
)
def test_agent_options_outside_v1_are_skipped(agent_options: str, expected: str) -> None:
    workflow = parse_fixture(
        "workflows:\n  - id: wf_option\n    name: Option\n    steps:\n"
        "      - type: agent\n        "
        + agent_options.replace("\n", "\n        ")
        + "\n        prompt: hello\n",
    )

    assert len(unsupported_dagu_reasons(workflow)) == 1
    assert expected in unsupported_dagu_reasons(workflow)[0]


@pytest.mark.parametrize("step_type", ["vars", "for", "while", "parallel"])
def test_control_and_stateful_steps_are_skipped(step_type: str) -> None:
    step: dict[str, object] = {"type": step_type}
    if step_type == "vars":
        step["values"] = {"VALUE": "printf hello"}
    if step_type == "for":
        step.update(
            {
                "in": "ITEMS",
                "item": "ITEM",
                "steps": [{"type": "bash", "run": "echo $ITEM"}],
            }
        )
    if step_type == "while":
        step.update({"condition": "false", "steps": [{"type": "bash", "run": "echo loop"}]})
    if step_type == "parallel":
        step["steps"] = [{"type": "bash", "run": "echo branch"}]
    workflow = WorkflowFile.model_validate(
        {"workflows": [{"id": "wf_step", "name": "Step", "steps": [step]}]}
    ).workflows[0]

    assert unsupported_dagu_reasons(workflow)[0] == (
        f"steps[0].type={step_type} unsupported for native Dagu v1"
    )


@pytest.mark.parametrize(
    ("workflow_fields", "reason"),
    [
        (
            {
                "params": [{"name": "ISSUE_NUMBER"}],
                "steps": [{"type": "bash", "run": "echo safe"}],
            },
            "params unsupported for native Dagu v1",
        ),
        (
            {"steps": [{"type": "vars", "values": {"VALUE": "printf value"}}]},
            "steps[0].type=vars unsupported for native Dagu v1",
        ),
        (
            {
                "steps": [
                    {
                        "type": "for",
                        "in": "ITEMS",
                        "item": "ITEM",
                        "steps": [{"type": "bash", "run": "echo $ITEM"}],
                    }
                ]
            },
            "steps[0].type=for unsupported for native Dagu v1",
        ),
        (
            {
                "steps": [
                    {
                        "type": "while",
                        "condition": "false",
                        "steps": [{"type": "bash", "run": "echo loop"}],
                    }
                ]
            },
            "steps[0].type=while unsupported for native Dagu v1",
        ),
        (
            {
                "steps": [
                    {
                        "type": "parallel",
                        "steps": [{"type": "bash", "run": "echo branch"}],
                    }
                ]
            },
            "steps[0].type=parallel unsupported for native Dagu v1",
        ),
        (
            {"steps": [{"type": "bash", "when": "true", "run": "echo safe"}]},
            "steps[0].when unsupported for native Dagu v1",
        ),
        *[
            (
                {"steps": [{"type": "agent", option: value, "prompt": "safe prompt"}]},
                f"steps[0].{option} unsupported for native Dagu v1",
            )
            for option, value in (
                ("capture", "ANSWER"),
                ("expandPrompt", True),
                ("expandFields", True),
                ("model", "openai/example"),
                ("command", "review"),
                ("dangerouslySkipPermissions", True),
            )
        ],
        (
            {
                "steps": [
                    {
                        "type": "parallel",
                        "steps": [
                            {
                                "type": "agent",
                                "capture": "ANSWER",
                                "prompt": "safe prompt",
                            }
                        ],
                    }
                ]
            },
            "steps[0].steps[0].capture unsupported for native Dagu v1",
        ),
    ],
)
@pytest.mark.parametrize("dry_run", [False, True])
def test_cli_nonfatally_skips_each_unsupported_native_capability(
    tmp_path: Path,
    workflow_fields: dict[str, object],
    reason: str,
    dry_run: bool,
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "unsupported.sh"
    source.write_text(
        yaml.safe_dump(
            {"workflows": [{"id": "wf_unsupported", "name": "Unsupported", **workflow_fields}]},
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    arguments = [
        str(source),
        "--output",
        str(script),
        "--sidecar",
        "dagu",
    ]
    if dry_run:
        arguments.append("--dry-run")

    result = runner.invoke(app, arguments)

    assert result.exit_code == 0, result.output
    assert reason in result.output
    assert "Dagu sidecar skipped for wf_unsupported" in result.output
    assert "unsupported Dagu capability alone is nonfatal" in result.output
    assert ("DRY-RUN would skip" in result.output) is dry_run
    assert script.exists() is not dry_run
    assert not dagu_sidecar_path(script).exists()


def test_cli_writes_unchanged_harness_and_native_private_sidecar(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_supported_workflow(source)
    monkeypatch.chdir(tmp_path)

    result = runner.invoke(
        app,
        [str(source), "--workflow", "wf_native", "--output", str(script), "--sidecar", "dagu"],
    )

    assert result.exit_code == 0, result.output
    sidecar = dagu_sidecar_path(script)
    document = yaml.safe_load(sidecar.read_text(encoding="utf-8"))
    assert [step["id"] for step in document["steps"]] == [
        "step_01_bash",
        "step_02_agent",
        "step_03_bash",
    ]
    assert stat.S_IMODE(script.stat().st_mode) == 0o700
    assert stat.S_IMODE(sidecar.stat().st_mode) == 0o600
    assert "Wrote" in result.output and str(sidecar) in result.output
    assert str(tmp_path.resolve()) == document["params"][0]["default"]
    assert render_harness(parse_workflows(source)[0]) in script.read_text(encoding="utf-8")


def test_default_project_dir_is_generation_cwd(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_dir = tmp_path / "project"
    output_dir = project_dir / ".harness"
    output_dir.mkdir(parents=True)
    monkeypatch.chdir(project_dir)

    assert default_project_dir(output_dir / "example.dagu.yml") == str(project_dir.resolve())

    workflow = parse_fixture(
        "workflows:\n  - id: wf_project\n    name: Project\n    steps:\n"
        "      - type: bash\n        run: pwd\n"
    )
    document = yaml.safe_load(
        render_dagu_sidecar(
            workflow,
            project_dir=default_project_dir(output_dir / "example.dagu.yml"),
        )
    )

    assert document["params"][0]["default"] == str(project_dir.resolve())
    assert document["working_dir"] == "${params.project_dir}"


def test_default_project_dir_runs_from_a_different_dagu_launch_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dagu = shutil.which("dagu")
    if dagu is None:
        pytest.skip("Dagu is required for the native runtime regression")

    version = subprocess.run([dagu, "version"], check=True, capture_output=True, text=True)
    version_match = re.search(r"(\d+)\.(\d+)\.(\d+)", version.stdout + version.stderr)
    assert version_match is not None, version.stdout + version.stderr
    if tuple(map(int, version_match.groups())) < tuple(map(int, DAGU_MINIMUM_VERSION.split("."))):
        pytest.skip(f"Dagu {DAGU_MINIMUM_VERSION}+ is required")

    project_dir = tmp_path / "project"
    output_dir = project_dir / ".harness"
    launch_dir = tmp_path / "different-launch-directory"
    home = tmp_path / "dagu-home"
    user_home = tmp_path / "home"
    for directory in (output_dir, launch_dir, home, user_home):
        directory.mkdir(parents=True)
    monkeypatch.chdir(project_dir)
    workflow = parse_fixture(
        "workflows:\n  - id: wf_project_default\n    name: Project default\n    steps:\n"
        "      - type: bash\n        run: printf '%s' \"$PWD\" > observed.cwd\n"
    )
    sidecar = output_dir / "example.dagu.yml"
    sidecar.write_text(
        render_dagu_sidecar(workflow, project_dir=default_project_dir(sidecar)),
        encoding="utf-8",
    )
    environment = {
        "PATH": os.defpath,
        "HOME": str(user_home),
        "DAGU_HOME": str(home),
    }

    validation = subprocess.run(
        [dagu, "--dagu-home", str(home), "validate", str(sidecar)],
        cwd=launch_dir,
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert validation.returncode == 0, validation.stdout + validation.stderr
    run = subprocess.run(
        [dagu, "--dagu-home", str(home), "start", "--run-id", "project-default", str(sidecar)],
        cwd=launch_dir,
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert (project_dir / "observed.cwd").read_text(encoding="utf-8") == str(project_dir.resolve())


def test_project_dir_is_a_yaml_parameter_and_not_shell_text(tmp_path: Path) -> None:
    project_dir = '/tmp/project with spaces/and "quotes"'
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_path",
                    "name": "Path",
                    "steps": [{"type": "bash", "run": "printf '%s' safe"}],
                }
            ]
        }
    ).workflows[0]
    document = yaml.safe_load(render_dagu_sidecar(workflow, project_dir=project_dir))

    assert document["working_dir"] == "${params.project_dir}"
    assert document["params"][0] == {
        "name": "project_dir",
        "type": "string",
        "default": project_dir,
    }


def test_dagu_owned_reference_is_transported_outside_the_run_field() -> None:
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_dagu_reference",
                    "name": "Dagu reference",
                    "steps": [{"type": "bash", "run": "printf '%s' '${params.input}'"}],
                }
            ]
        }
    ).workflows[0]
    node = yaml.safe_load(render_dagu_sidecar(workflow, project_dir="."))["steps"][0]

    assert "${params.input}" not in node["run"]
    assert "${params.input}" in node["description"]


def test_dagu_runtime_preserves_source_references_and_backslashes_byte_for_byte() -> None:
    dagu = shutil.which("dagu")
    if dagu is None:
        pytest.skip("Dagu is required for the native runtime regression")

    version = subprocess.run([dagu, "version"], check=True, capture_output=True, text=True)
    version_match = re.search(r"(\d+)\.(\d+)\.(\d+)", version.stdout + version.stderr)
    assert version_match is not None, version.stdout + version.stderr
    if tuple(map(int, version_match.groups())) < tuple(map(int, DAGU_MINIMUM_VERSION.split("."))):
        pytest.skip(f"Dagu {DAGU_MINIMUM_VERSION}+ is required")

    scratch_base = Path(__file__).resolve().parents[1] / ".flowsh"
    scratch_base.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="issue-78-", dir=scratch_base))
    home = scratch / "dagu-home"
    user_home = scratch / "home"
    direct_dir = scratch / "direct"
    native_dir = scratch / "native"
    fake_bin = scratch / "bin"
    for directory in (home, user_home, direct_dir, native_dir, fake_bin):
        directory.mkdir()

    references = (
        "${step_01_bash.stdout}|${step_01_bash.stderr}|${step_01_bash.exit_code}|"
        "${params.project_dir}|${unknown.reference}|"
        r"\${step_01_bash.stdout}|\\${step_01_bash.stderr}"
    )
    bash_source = f"printf '%s' '{references}' > actual.txt"
    prompt = (
        "Literal agent prompt: ${step_01_bash.stdout} | ${step_01_bash.stderr} | "
        "${params.project_dir}\n"
        + r"Backslashes: \${step_01_bash.stdout} | \\${step_01_bash.stderr}"
        + "\n"
    )
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_literal_refs",
                    "name": "Literal references",
                    "steps": [
                        {"type": "bash", "run": "printf upstream"},
                        {"type": "bash", "run": bash_source},
                        {"type": "agent", "agent": "build", "prompt": prompt},
                    ],
                }
            ]
        }
    ).workflows[0]
    dag = scratch / "literal_refs.dagu.yml"
    dag.write_text(render_dagu_sidecar(workflow, project_dir=str(native_dir)), encoding="utf-8")
    fake_opencode = fake_bin / "opencode"
    fake_opencode.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        'while [[ "$#" -gt 0 && "$1" != -- ]]; do shift; done\n'
        '[[ "$#" -ge 2 ]] || exit 2\n'
        "shift\n"
        "printf '%s' \"$1\" > captured-prompt.txt\n",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)
    environment = {
        "PATH": f"{fake_bin}{os.pathsep}{os.defpath}",
        "HOME": str(user_home),
        "DAGU_HOME": str(home),
    }

    try:
        direct_run = subprocess.run(
            ["bash"],
            input=render_harness(workflow),
            cwd=direct_dir,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert direct_run.returncode == 0, direct_run.stdout + direct_run.stderr
        validation = subprocess.run(
            [dagu, "--dagu-home", str(home), "validate", str(dag)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert validation.returncode == 0, validation.stdout + validation.stderr

        run = subprocess.run(
            [dagu, "--dagu-home", str(home), "start", "--run-id", "native-literal-test", str(dag)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert run.returncode == 0, run.stdout + run.stderr
        assert (native_dir / "actual.txt").read_bytes() == (direct_dir / "actual.txt").read_bytes()
        assert (native_dir / "actual.txt").read_bytes() == references.encode()
        assert (native_dir / "captured-prompt.txt").read_bytes() == prompt.encode()
    finally:
        proc = Path("/proc")
        if proc.is_dir():
            working_directories: list[str] = []
            for entry in proc.iterdir():
                try:
                    cwd = (entry / "cwd").resolve()
                except (OSError, RuntimeError):
                    continue
                if cwd == scratch or scratch in cwd.parents:
                    working_directories.append(str(cwd))
            assert working_directories == [], working_directories
        shutil.rmtree(scratch)


def test_dagu_runtime_preserves_configured_step_stdin() -> None:
    dagu = shutil.which("dagu")
    if dagu is None:
        pytest.skip("Dagu is required for the native runtime regression")

    version = subprocess.run([dagu, "version"], check=True, capture_output=True, text=True)
    version_match = re.search(r"(\d+)\.(\d+)\.(\d+)", version.stdout + version.stderr)
    assert version_match is not None, version.stdout + version.stderr
    if tuple(map(int, version_match.groups())) < tuple(map(int, DAGU_MINIMUM_VERSION.split("."))):
        pytest.skip(f"Dagu {DAGU_MINIMUM_VERSION}+ is required")

    scratch_base = Path("/tmp/opencode")
    scratch_base.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="flowsh-78-stdin-", dir=scratch_base))
    home = scratch / "dagu-home"
    user_home = scratch / "home"
    direct_dir = scratch / "direct"
    native_dir = scratch / "native"
    for directory in (home, user_home, direct_dir, native_dir):
        directory.mkdir()

    payload = "payload from Dagu stdin\n"
    source = 'read -r value; printf "value=%s\\n" "$value" > actual.txt'
    workflow = parse_fixture(
        yaml.safe_dump(
            {
                "workflows": [
                    {
                        "id": "wf_stdin",
                        "name": "Stdin",
                        "steps": [{"type": "bash", "run": source}],
                    }
                ]
            }
        )
    )
    dag = scratch / "stdin.dagu.yml"
    document = yaml.safe_load(render_dagu_sidecar(workflow, project_dir=str(native_dir)))
    document["steps"][0]["stdin"] = "stdin.txt"
    (native_dir / "stdin.txt").write_text(payload, encoding="utf-8")
    dag.write_text(yaml.safe_dump(document, sort_keys=False), encoding="utf-8")
    environment = {
        "PATH": os.defpath,
        "HOME": str(user_home),
        "DAGU_HOME": str(home),
    }

    try:
        direct = subprocess.run(
            ["bash", "-euo", "pipefail", "-c", source],
            cwd=direct_dir,
            env=environment,
            input=payload,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert direct.returncode == 0, direct.stdout + direct.stderr

        validation = subprocess.run(
            [dagu, "--dagu-home", str(home), "validate", str(dag)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert validation.returncode == 0, validation.stdout + validation.stderr

        run = subprocess.run(
            [dagu, "--dagu-home", str(home), "start", "--run-id", "stdin-test", str(dag)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert run.returncode == 0, run.stdout + run.stderr
        assert (native_dir / "actual.txt").read_bytes() == (direct_dir / "actual.txt").read_bytes()
        assert (native_dir / "actual.txt").read_bytes() == b"value=payload from Dagu stdin\n"
    finally:
        proc = Path("/proc")
        if proc.is_dir():
            working_directories: list[str] = []
            for entry in proc.iterdir():
                try:
                    cwd = (entry / "cwd").resolve()
                except (OSError, RuntimeError):
                    continue
                if cwd == scratch or scratch in cwd.parents:
                    working_directories.append(str(cwd))
            assert working_directories == [], working_directories
        shutil.rmtree(scratch)


def test_standalone_return_42_caveat_is_preserved_in_native_dagu() -> None:
    dagu = shutil.which("dagu")
    if dagu is None:
        pytest.skip("Dagu is required for the native runtime regression")

    scratch_base = Path("/tmp/opencode")
    scratch_base.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="flowsh-78-return-", dir=scratch_base))
    home = scratch / "dagu-home"
    user_home = scratch / "home"
    direct_dir = scratch / "direct"
    native_dir = scratch / "native"
    for directory in (home, user_home, direct_dir, native_dir):
        directory.mkdir()

    workflow = parse_fixture(
        "workflows:\n"
        "  - id: wf_return\n"
        "    name: Standalone return caveat\n"
        "    steps:\n"
        "      - type: bash\n"
        "        run: false || return 42\n"
        "      - type: bash\n"
        "        run: touch must-not-run.marker\n"
    )
    harness = direct_dir / "return.sh"
    harness.write_text(render_harness(workflow), encoding="utf-8")
    sidecar = scratch / "return.dagu.yml"
    sidecar.write_text(render_dagu_sidecar(workflow, project_dir=str(native_dir)), encoding="utf-8")
    environment = {
        "PATH": os.defpath,
        "HOME": str(user_home),
        "DAGU_HOME": str(home),
    }

    try:
        direct = subprocess.run(
            ["bash", str(harness)],
            cwd=direct_dir,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert direct.returncode == 2, direct.stdout + direct.stderr
        assert "return: can only `return' from a function" in direct.stderr
        assert not (direct_dir / "must-not-run.marker").exists()

        validation = subprocess.run(
            [dagu, "--dagu-home", str(home), "validate", str(sidecar)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert validation.returncode == 0, validation.stdout + validation.stderr

        run = subprocess.run(
            [dagu, "--dagu-home", str(home), "start", "--run-id", "return-caveat", str(sidecar)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert run.returncode == 1, run.stdout + run.stderr
        assert "exit status 2" in run.stdout + run.stderr
        assert not (native_dir / "must-not-run.marker").exists()
    finally:
        proc = Path("/proc")
        if proc.is_dir():
            working_directories: list[str] = []
            for entry in proc.iterdir():
                try:
                    cwd = (entry / "cwd").resolve()
                except (OSError, RuntimeError):
                    continue
                if cwd == scratch or scratch in cwd.parents:
                    working_directories.append(str(cwd))
            assert working_directories == [], working_directories
        shutil.rmtree(scratch)


def test_dagu_executes_eight_native_nodes_in_order_with_isolated_stand_ins() -> None:
    dagu = shutil.which("dagu")
    if dagu is None:
        pytest.skip("Dagu is required for the native graph integration test")

    version = subprocess.run([dagu, "version"], check=True, capture_output=True, text=True)
    version_match = re.search(r"(\d+)\.(\d+)\.(\d+)", version.stdout + version.stderr)
    assert version_match is not None, version.stdout + version.stderr
    if tuple(map(int, version_match.groups())) < tuple(map(int, DAGU_MINIMUM_VERSION.split("."))):
        pytest.skip(f"Dagu {DAGU_MINIMUM_VERSION}+ is required")

    scratch_base = Path("/tmp/opencode")
    scratch_base.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="flowsh-78-eight-node-", dir=scratch_base))
    home = scratch / "dagu-home"
    user_home = scratch / "home"
    project_dir = scratch / "project"
    fake_bin = scratch / "bin"
    for directory in (home, user_home, project_dir, fake_bin):
        directory.mkdir()

    fake_opencode = fake_bin / "opencode"
    fake_opencode.write_text(
        "#!/usr/bin/env python3\n"
        "import json, pathlib, sys\n"
        "prompt = sys.argv[-1]\n"
        "marker = prompt.split('FIXTURE_RESULT_', 1)[1][:2]\n"
        "pathlib.Path(f'agent_{marker}.marker').write_text(prompt, encoding='utf-8')\n"
        "with pathlib.Path('agent-calls.txt').open('a', encoding='utf-8') as calls:\n"
        "    calls.write(prompt + '\\n')\n"
        "print(json.dumps({'type': 'text', 'part': {'text': f'FIXTURE_RESULT_{marker}'}}))\n",
        encoding="utf-8",
    )
    fake_opencode.chmod(0o700)
    workflow = parse_fixture(
        "workflows:\n"
        "  - id: wf_native_eight\n"
        "    name: Safe native eight-step fixture\n"
        "    steps:\n"
        "      - type: bash\n"
        "        name: Create start marker\n"
        "        run: printf 'START\\n' > start.marker\n"
        "      - type: bash\n"
        "        name: Verify start marker\n"
        "        run: |\n"
        '          test "$(cat start.marker)" = START\n'
        "          printf 'READY\\n' > ready.marker\n"
        + "".join(
            "      - type: agent\n"
            f"        name: Stand-in agent {index:02d}\n"
            "        agent: build\n"
            f"        prompt: Return FIXTURE_RESULT_{index:02d} exactly.\n"
            for index in range(3, 8)
        )
        + "      - type: bash\n"
        "        name: Verify all agents and finish\n"
        "        run: |\n"
        '          test "$(cat ready.marker)" = READY\n'
        + "\n".join(
            f'          test "$(cat agent_{index:02d}.marker)" = '
            f'"Return FIXTURE_RESULT_{index:02d} exactly."'
            for index in range(3, 8)
        )
        + "\n          printf 'DONE\\n' > done.marker\n"
    )
    sidecar = scratch / "safe-eight.dagu.yml"
    sidecar.write_text(
        render_dagu_sidecar(workflow, project_dir=str(project_dir)), encoding="utf-8"
    )
    environment = {
        "PATH": f"{fake_bin}{os.pathsep}{os.defpath}",
        "HOME": str(user_home),
        "DAGU_HOME": str(home),
    }

    try:
        validation = subprocess.run(
            [dagu, "--dagu-home", str(home), "validate", str(sidecar)],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert validation.returncode == 0, validation.stdout + validation.stderr

        run = subprocess.run(
            [
                dagu,
                "--dagu-home",
                str(home),
                "start",
                "--run-id",
                "native-eight-stand-ins",
                str(sidecar),
            ],
            cwd=scratch,
            env=environment,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert run.returncode == 0, run.stdout + run.stderr
        assert "Result: Succeeded" in run.stdout
        assert (project_dir / "start.marker").read_text(encoding="utf-8") == "START\n"
        assert (project_dir / "ready.marker").read_text(encoding="utf-8") == "READY\n"
        assert (project_dir / "done.marker").read_text(encoding="utf-8") == "DONE\n"
        assert [
            (project_dir / f"agent_{index:02d}.marker").read_text(encoding="utf-8")
            for index in range(3, 8)
        ] == [f"Return FIXTURE_RESULT_{index:02d} exactly." for index in range(3, 8)]
        step_logs = list((home / "logs").rglob("*.out"))
        assert len(step_logs) == 8
        names = [
            "Create start marker",
            "Verify start marker",
            *(f"Stand-in agent {index:02d}" for index in range(3, 8)),
            "Verify all agents and finish",
        ]
        assert all(f"{index:02d}: {name} (" in run.stdout for index, name in enumerate(names, 1))
        assert (project_dir / "agent-calls.txt").read_text(encoding="utf-8").splitlines() == [
            f"Return FIXTURE_RESULT_{index:02d} exactly." for index in range(3, 8)
        ]

        for exit_code in (17, 42):
            failed_project = scratch / f"project-failure-{exit_code}"
            failed_project.mkdir()
            failed_document = yaml.safe_load(sidecar.read_text(encoding="utf-8"))
            failed_step = next(
                step for step in failed_document["steps"] if step["id"] == "step_05_agent"
            )
            failed_step["run"] = f"#!/usr/bin/env bash\nset -euo pipefail\nexit {exit_code}\n"
            failed_sidecar = scratch / f"failed-{exit_code}.dagu.yml"
            failed_sidecar.write_text(
                yaml.safe_dump(failed_document, sort_keys=False), encoding="utf-8"
            )
            failed_validation = subprocess.run(
                [dagu, "--dagu-home", str(home), "validate", str(failed_sidecar)],
                cwd=scratch,
                env=environment,
                capture_output=True,
                text=True,
                timeout=60,
            )
            assert failed_validation.returncode == 0, (
                failed_validation.stdout + failed_validation.stderr
            )
            failed_run = subprocess.run(
                [
                    dagu,
                    "--dagu-home",
                    str(home),
                    "start",
                    "--run-id",
                    f"native-eight-failure-{exit_code}",
                    str(failed_sidecar),
                    "--",
                    f"project_dir={failed_project}",
                ],
                cwd=scratch,
                env=environment,
                capture_output=True,
                text=True,
                timeout=120,
            )
            failure_output = failed_run.stdout + failed_run.stderr
            assert failed_run.returncode == 1, failure_output
            assert f"exit status {exit_code}" in failure_output
            assert (failed_project / "start.marker").read_text(encoding="utf-8") == "START\n"
            assert (failed_project / "ready.marker").read_text(encoding="utf-8") == "READY\n"
            assert [
                (failed_project / f"agent_{index:02d}.marker").read_text(encoding="utf-8")
                for index in (3, 4)
            ] == [f"Return FIXTURE_RESULT_{index:02d} exactly." for index in (3, 4)]
            assert (failed_project / "agent-calls.txt").read_text(
                encoding="utf-8"
            ).splitlines() == [f"Return FIXTURE_RESULT_{index:02d} exactly." for index in (3, 4)]
            assert not (failed_project / "agent_06.marker").exists()
            assert not (failed_project / "agent_07.marker").exists()
            assert not (failed_project / "done.marker").exists()
    finally:
        proc = Path("/proc")
        if proc.is_dir():
            working_directories: list[str] = []
            for entry in proc.iterdir():
                try:
                    cwd = (entry / "cwd").resolve()
                except (OSError, RuntimeError):
                    continue
                if cwd == scratch or scratch in cwd.parents:
                    working_directories.append(str(cwd))
            assert working_directories == [], working_directories
        shutil.rmtree(scratch)


def test_agent_selector_is_passed_as_bash_quoted_argv_data() -> None:
    workflow = WorkflowFile.model_validate(
        {
            "workflows": [
                {
                    "id": "wf_agent_selector",
                    "name": "Agent selector",
                    "steps": [
                        {
                            "type": "agent",
                            "agent": "build$",
                            "prompt": "safe prompt",
                        }
                    ],
                }
            ]
        }
    ).workflows[0]
    node = yaml.safe_load(render_dagu_sidecar(workflow, project_dir="."))["steps"][0]

    assert unsupported_dagu_reasons(workflow) == []
    assert '--agent "$agent"' in node["run"]
    assert "printf '%b'" in node["run"]


def test_sh_only_output_remains_prechange_bytes(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "baseline.sh"
    write_workflow(source)

    result = runner.invoke(app, [str(source), "--workflow", "wf_example", "--output", str(script)])

    assert result.exit_code == 0, result.output
    assert hashlib.sha256(script.read_bytes()).hexdigest() == BASELINE_SHA256
    assert stat.S_IMODE(script.stat().st_mode) == 0o700
    assert not dagu_sidecar_path(script).exists()


def test_unsupported_workflow_generates_only_sh_and_leaves_stale_sidecar(
    tmp_path: Path,
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    sidecar = dagu_sidecar_path(script)
    sidecar.write_text("old wrapper", encoding="utf-8")
    write_workflow(source)

    result = runner.invoke(
        app,
        [
            str(source),
            "--workflow",
            "wf_example",
            "--output",
            str(script),
            "--sidecar",
            "dagu",
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "Dagu sidecar skipped for wf_example" in result.output
    assert "steps[0].type=vars" in result.output
    assert "existing sidecar left unchanged" in result.output
    assert script.exists()
    assert sidecar.read_text(encoding="utf-8") == "old wrapper"


def test_unsupported_dry_run_reports_skip_and_writes_neither_file(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_workflow(source)

    result = runner.invoke(
        app,
        [str(source), "--output", str(script), "--sidecar", "dagu", "--dry-run"],
    )

    assert result.exit_code == 0, result.output
    assert "would write" in result.output and str(script) in result.output
    assert "would skip" in result.output and str(dagu_sidecar_path(script)) in result.output
    assert "unsupported Dagu capability alone is nonfatal" in result.output
    assert not script.exists()
    assert not dagu_sidecar_path(script).exists()


def test_unsupported_skipped_sidecar_does_not_conflict_with_workflow_input(
    tmp_path: Path,
) -> None:
    source = tmp_path / "example.dagu.yml"
    script = tmp_path / "example.sh"
    source.write_text(
        "workflows:\n  - id: wf_unsupported\n    name: Unsupported\n"
        "    steps:\n      - type: vars\n        values: {VALUE: echo value}\n",
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        [str(source), "--output", str(script), "--sidecar", "dagu", "--dry-run"],
    )

    assert result.exit_code == 0, result.output
    assert "would write" in result.output and str(script) in result.output
    assert "would skip" in result.output and str(source) in result.output
    assert "input workflow YAML" not in result.output
    assert not script.exists()
    assert source.read_text(encoding="utf-8").startswith("workflows:")


def test_unsupported_sidecar_does_not_allow_sh_output_to_overwrite_input(
    tmp_path: Path,
) -> None:
    source = tmp_path / "example.sh"
    source.write_text(
        "workflows:\n  - id: wf_unsupported\n    name: Unsupported\n"
        "    steps:\n      - type: vars\n        values: {VALUE: echo value}\n",
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        [str(source), "--output", str(source), "--sidecar", "dagu", "--dry-run"],
    )

    assert result.exit_code == 1
    assert "input workflow YAML" in result.output
    assert source.read_text(encoding="utf-8").startswith("workflows:")


def test_unsupported_sidecar_diagnostic_does_not_claim_sh_was_generated(
    tmp_path: Path,
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "example.sh"
    source.write_text(
        "workflows:\n  - id: wf_unsupported\n    name: Unsupported\n"
        "    steps:\n      - type: vars\n        values: {VALUE: echo value}\n",
        encoding="utf-8",
    )
    script.write_text("keep existing output", encoding="utf-8")

    result = runner.invoke(
        app,
        [str(source), "--output", str(script), "--sidecar", "dagu"],
    )

    assert result.exit_code == 1
    assert "unsupported Dagu capability alone is nonfatal" in result.output
    assert "Refusing to overwrite existing file" in result.output
    assert "SH generated; exit 0" not in result.output
    assert script.read_text(encoding="utf-8") == "keep existing output"


def test_multi_workflow_skips_one_sidecar_without_suppressing_supported_outputs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "workflows.yml"
    source.write_text(
        "workflows:\n"
        "  - id: wf_supported\n    name: Supported\n    steps:\n"
        "      - type: bash\n        run: echo supported\n"
        "  - id: wf_unsupported\n    name: Unsupported\n    steps:\n"
        "      - type: vars\n        values:\n          VALUE: echo value\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)

    result = runner.invoke(app, [str(source), "--sidecar", "dagu"])

    assert result.exit_code == 0, result.output
    assert (tmp_path / "supported.sh").exists()
    assert (tmp_path / "supported.dagu.yml").exists()
    assert (tmp_path / "unsupported.sh").exists()
    assert not (tmp_path / "unsupported.dagu.yml").exists()


def test_supported_sidecar_conflict_blocks_both_outputs_until_force(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    sidecar = dagu_sidecar_path(script)
    sidecar.write_text("keep sidecar", encoding="utf-8")
    write_supported_workflow(source)

    blocked = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])
    assert blocked.exit_code == 1
    assert "Refusing to overwrite" in blocked.output
    assert not script.exists()
    assert sidecar.read_text(encoding="utf-8") == "keep sidecar"

    replaced = runner.invoke(
        app, [str(source), "--output", str(script), "--sidecar", "dagu", "--force"]
    )
    assert replaced.exit_code == 0, replaced.output
    assert yaml.safe_load(sidecar.read_text(encoding="utf-8"))["steps"][0]["id"] == "step_01_bash"


def test_sidecar_directory_conflict_does_not_publish_script(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    dagu_sidecar_path(script).mkdir()
    write_supported_workflow(source)

    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "exists but is a directory" in result.output
    assert not script.exists()


def test_staging_failure_cleans_temporary_script(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_supported_workflow(source)
    stage = cli_module.stage_output
    calls = 0

    def fail_sidecar(path: Path, content: str, mode: int) -> Path:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("simulated sidecar staging failure")
        return stage(path, content, mode)

    monkeypatch.setattr(cli_module, "stage_output", fail_sidecar)
    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "published: none" in result.output
    assert "not published:" in result.output
    assert not script.exists()
    assert not dagu_sidecar_path(script).exists()
    assert list(tmp_path.glob(".custom.sh.*.tmp")) == []


def test_sidecar_refuses_symlink_target_without_force(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    target = tmp_path / "target.yml"
    sidecar = dagu_sidecar_path(script)
    target.write_text("do not replace", encoding="utf-8")
    sidecar.symlink_to(target)
    write_supported_workflow(source)

    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "Refusing to overwrite" in result.output
    assert not script.exists()
    assert target.read_text(encoding="utf-8") == "do not replace"


def test_sidecar_path_cannot_overwrite_input_even_with_force(tmp_path: Path) -> None:
    source = tmp_path / "custom.dagu.yml"
    script = tmp_path / "custom.sh"
    write_supported_workflow(source)

    result = runner.invoke(
        app,
        [str(source), "--output", str(script), "--sidecar", "dagu", "--force"],
    )

    assert result.exit_code == 1
    assert "input workflow YAML" in result.output
    assert source.read_text(encoding="utf-8").startswith("workflows:")
    assert not script.exists()


def test_invalid_source_yaml_remains_nonzero(tmp_path: Path) -> None:
    source = tmp_path / "invalid.yml"
    source.write_text("workflows: []\n", encoding="utf-8")

    result = runner.invoke(app, [str(source), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "Invalid workflow YAML" in result.output
    assert not (tmp_path / "invalid.sh").exists()


def test_native_output_path_and_input_protection() -> None:
    assert dagu_sidecar_path(Path("nested/example.sh")) == Path("nested/example.dagu.yml")
    with pytest.raises(WorkflowParseError, match="Cannot stat workflow YAML"):
        parse_workflows(Path("missing-workflows.yml"))
