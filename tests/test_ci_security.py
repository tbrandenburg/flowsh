import json
import os
import re
import subprocess
from pathlib import Path

import pytest
import yaml

WORKFLOWS = Path(__file__).resolve().parents[1] / ".github" / "workflows"
CORE = "core-opencode-run.yml"
COMMENTS = "ghar-issue-command-executor.yml"
COMMANDS_LIST = "ghar-issue-commands-list.yml"
PAYLOAD = '$(touch injected); `touch injected` "quoted"\nEOF\nhas_command=false'


def step(file: str, name: str) -> dict[str, str]:
    document = yaml.safe_load((WORKFLOWS / file).read_text())
    return next(
        step
        for job in document["jobs"].values()
        for step in job.get("steps", [])
        if step.get("name") == name or step.get("id") == name
    )


def execute(
    directory: Path, file: str, name: str, variables: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    environment = {
        "PATH": os.defpath,
        "HOME": str(directory),
        "GH_TOKEN": "synthetic-test-token",
        "GITHUB_OUTPUT": str(directory / "outputs"),
        **variables,
    }
    return subprocess.run(
        ["bash", "--noprofile", "--norc", "-euo", "pipefail", "-c", step(file, name)["run"]],
        cwd=directory,
        env=environment,
        input="",
        capture_output=True,
        text=True,
        timeout=10,
    )


def outputs(directory: Path) -> dict[str, str]:
    lines = iter((directory / "outputs").read_text().splitlines())
    result: dict[str, str] = {}
    for line in lines:
        if "<<" not in line:
            key, value = line.split("=", 1)
            result[key] = value
            continue
        key, delimiter = line.split("<<", 1)
        value = []
        for line in lines:
            if line == delimiter:
                break
            value.append(line)
        result[key] = "\n".join(value)
    return result


@pytest.mark.parametrize(
    ("prefix", "agent", "command"),
    [
        ("/review", None, "review"),
        ("*general /review", "general", "review"),
        ("*general", "general", None),
        ("*agent /review", "", "review"),
    ],
)
def test_comment_is_data(
    tmp_path: Path, prefix: str, agent: str | None, command: str | None
) -> None:
    result = execute(tmp_path, COMMENTS, "parse-comment", {"COMMENT": f"{prefix} {PAYLOAD}"})
    parsed = outputs(tmp_path)
    assert result.returncode == 0, result.stderr
    assert parsed["prompt"] == PAYLOAD
    assert parsed.get("agent") == agent
    assert parsed.get("command") == command
    assert parsed["has_command"] == str(command is not None).lower()
    assert not (tmp_path / "injected").exists()


@pytest.mark.parametrize("comment", ["ordinary comment", PAYLOAD])
def test_noncommands_do_not_execute(tmp_path: Path, comment: str) -> None:
    result = execute(tmp_path, COMMENTS, "parse-comment", {"COMMENT": comment})
    assert result.returncode == 0, result.stderr
    assert outputs(tmp_path) == {"has_command": "false", "has_agent": "false"}
    assert not (tmp_path / "injected").exists()


def test_command_list_outputs_are_passed_as_data(tmp_path: Path) -> None:
    commands = tmp_path / ".opencode" / "commands"
    agents = tmp_path / ".opencode" / "agents"
    commands.mkdir(parents=True)
    agents.mkdir(parents=True)
    (commands / "review.md").touch()
    (commands / "$(touch-injected).md").touch()
    (agents / "general.md").touch()

    result = execute(tmp_path, COMMANDS_LIST, "List available commands and agents", {})
    parsed = outputs(tmp_path)
    comment_step = step(COMMANDS_LIST, "Comment on issue")
    script = comment_step["with"]["script"]

    assert result.returncode == 0, result.stderr
    assert parsed["commands"] == "/$(touch-injected)\n/review"
    assert parsed["agents"] == "*general"
    assert not (tmp_path / "injected").exists()
    assert comment_step["env"] == {
        "COMMANDS": "${{ steps.list-tools.outputs.commands }}",
        "AGENTS": "${{ steps.list-tools.outputs.agents }}",
    }
    assert "process.env.COMMANDS" in script
    assert "process.env.AGENTS" in script


def runtime(directory: Path) -> dict[str, str]:
    binary = directory / ".opencode" / "bin" / "opencode"
    binary.parent.mkdir(parents=True)
    binary.write_text("#!/usr/bin/python3\nimport json, sys\nprint(json.dumps(sys.argv[1:]))\n")
    binary.chmod(0o755)
    return {
        "RUN_NAME": "test-run",
        "PROMPT": "",
        "PROMPT_FILE": "",
        "COMMAND": "",
        "MODEL": "provider/model",
        "AGENT": "build",
    }


@pytest.mark.parametrize("source", ["prompt", "file", "command", "command-prompt", "command-file"])
def test_runner_preserves_arguments(tmp_path: Path, source: str) -> None:
    variables = runtime(tmp_path)
    if "command" in source:
        variables["COMMAND"] = "review"
    if "prompt" in source:
        variables["PROMPT"] = PAYLOAD
    if "file" in source:
        prompt = tmp_path / "prompt with spaces.md"
        prompt.write_text(PAYLOAD)
        variables["PROMPT_FILE"] = str(prompt)
    result = execute(tmp_path, CORE, "Run OpenCode ${{ inputs.run-name }}", variables)
    expected = ["run", "--model", "provider/model", "--agent", "build"]
    if "command" in source:
        expected += ["--command", "review"]
    if source != "command":
        expected += ["--", PAYLOAD]
    assert result.returncode == 0, result.stderr
    assert json.loads((tmp_path / "test-run-results.txt").read_text()) == expected
    assert not (tmp_path / "injected").exists()


@pytest.mark.parametrize(
    "changes",
    [
        {},
        {"RUN_NAME": "../escape"},
        {"RUN_NAME": "-n"},
        {"RUN_NAME": "$(touch injected)"},
        {"PROMPT": "hello", "PROMPT_FILE": "missing"},
        {"PROMPT_FILE": "missing"},
    ],
)
def test_runner_rejects_invalid_input(tmp_path: Path, changes: dict[str, str]) -> None:
    variables = runtime(tmp_path) | changes
    result = execute(tmp_path, CORE, "Run OpenCode ${{ inputs.run-name }}", variables)
    assert result.returncode != 0
    assert result.stderr
    assert not (tmp_path / "test-run-results.txt").exists()
    assert not (tmp_path / "injected").exists()


@pytest.mark.parametrize("content", [None, PAYLOAD, "a" * 66000, "€" * 22000])
def test_results_cannot_inject_outputs(tmp_path: Path, content: str | None) -> None:
    if content is not None:
        (tmp_path / "test-run-results.txt").write_text(content)
    result = execute(tmp_path, CORE, "process-results", {"RUN_NAME": "test-run"})
    parsed = outputs(tmp_path)
    assert result.returncode == 0, result.stderr
    assert set(parsed) == {"artifact-name", "results-truncated", "results"}
    assert parsed["artifact-name"] == "test-run-results"
    if content is None:
        assert "No results file generated" in parsed["results"]
    elif len(content.encode()) > 65000:
        assert parsed["results-truncated"] == "true"
        assert len(parsed["results"].encode()) < 65000
    else:
        assert parsed["results"] == content
        assert parsed["results-truncated"] == "false"


def test_workflow_security_boundaries() -> None:
    for file in WORKFLOWS.glob("*.yml"):
        document = yaml.safe_load(file.read_text())
        for job in document["jobs"].values():
            for action in job.get("steps", []):
                assert "${{" not in action.get("run", ""), file
                reference = action.get("uses", "")
                if reference:
                    assert re.fullmatch(r"[\w-]+/[\w-]+@[0-9a-f]{40}", reference), reference
                if reference.startswith("actions/checkout@"):
                    assert action["with"]["persist-credentials"] is False
    assert step(COMMENTS, "parse-comment")["env"] == {"COMMENT": "${{ github.event.comment.body }}"}
    assert step(CORE, "Run OpenCode ${{ inputs.run-name }}")["env"] == {
        key: "${{ inputs." + value + " }}"
        for key, value in {
            "RUN_NAME": "run-name",
            "PROMPT": "prompt",
            "PROMPT_FILE": "prompt-file",
            "COMMAND": "command",
            "MODEL": "model",
            "AGENT": "agent",
        }.items()
    }
    comments = yaml.safe_load((WORKFLOWS / COMMENTS).read_text())
    assert comments["jobs"]["parse-and-check"]["if"] == (
        "github.event.comment.author_association == 'OWNER'"
    )
    assert comments["jobs"]["parse-and-check"]["permissions"]["contents"] == "read"
    comment_results = step(COMMENTS, "Comment execution results")
    assert comment_results["env"] == {
        "HAS_COMMAND": "${{ needs.parse-and-check.outputs.has-command }}",
        "HAS_AGENT": "${{ needs.parse-and-check.outputs.has-agent }}",
        "COMMAND": "${{ needs.parse-and-check.outputs.command }}",
        "AGENT": "${{ needs.parse-and-check.outputs.agent }}",
        "RESULTS": "${{ needs.execute-opencode.outputs.results }}",
        "RESULTS_TRUNCATED": "${{ needs.execute-opencode.outputs.results-truncated }}",
        "ARTIFACT_NAME": "${{ needs.execute-opencode.outputs.artifact-name }}",
    }
    assert "${{" not in comment_results["with"]["script"]


def test_installer_rejects_tampered_archive(tmp_path: Path) -> None:
    for architecture in ("x64", "arm64"):
        (tmp_path / f"opencode-linux-{architecture}.tar.gz").write_text("tampered archive")
    script = step(CORE, "Setup and Install OpenCode")["run"].replace(
        "https://github.com/anomalyco/opencode/releases/download/v1.14.40/$asset",
        f"{tmp_path.as_uri()}/$asset",
    )
    result = subprocess.run(
        ["bash", "-euo", "pipefail", "-c", script],
        cwd=tmp_path,
        env={"PATH": os.defpath, "HOME": str(tmp_path)},
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode != 0
    assert "FAILED" in result.stdout
    assert "checksum did NOT match" in result.stderr
    assert not (tmp_path / ".opencode").exists()
