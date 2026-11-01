from __future__ import annotations

import base64
import hashlib
import re
import stat
from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner

import flowsh_cli.cli as cli_module
from flowsh_cli.cli import app
from flowsh_cli.dagu import dagu_sidecar_path, render_dagu_sidecar
from flowsh_cli.models import parse_workflows
from flowsh_cli.render import render_harness

runner = CliRunner()
BASELINE_SHA256 = "de284d1e0ce05d9bf3319c90ebf3111a618dcf3f23df7d168b2fe6d1d42e363c"
COMPLEX_BASELINE_SHA256 = "6f56f2e9e01e6796a734fbd37521f1b03e97edf196d6455fb2cccaacabe9916c"


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


def test_sidecar_embeds_exact_prechange_harness_bytes_and_default_argv() -> None:
    script = """#!/usr/bin/env bash
printf '%s' "$VAR ${VAR} ${params.X} $(touch marker) `touch marker2` 'quote' \"double\" vår 漢字 𐐀"
cat <<'END'
literal ${params.X} and $() stay unchanged
END
"""
    sidecar = render_dagu_sidecar(script, project_dir=".")
    document = yaml.safe_load(sidecar)
    decoder = document["steps"][0]["with"]["script"]
    payload = re.search(r"const scriptEncoded = '([A-Za-z0-9+/=]+)';", decoder)

    assert payload is not None
    assert base64.b64decode(payload.group(1), validate=True) == (script + "\n").encode()
    assert "script: toOctal(script)" in decoder
    launcher = document["steps"][3]["run"]
    assert "printf '%b' \"$encoded\"" in launcher
    assert "${env.HARNESS_PATH}" in launcher
    assert "${env.ARGV_PATH}" in launcher
    assert "$HARNESS_PATH" not in launcher
    assert "$ARGV_PATH" not in launcher
    assert document["params"][1]["default"] == "W10="
    assert "schedule" not in document
    assert "name" not in document


def test_cli_writes_baseline_compatible_harness_and_private_sidecar(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_workflow(source)

    result = runner.invoke(
        app,
        [str(source), "--workflow", "wf_example", "--output", str(script), "--sidecar", "dagu"],
    )

    assert result.exit_code == 0, result.output
    sidecar = dagu_sidecar_path(script)
    assert hashlib.sha256(script.read_bytes()).hexdigest() == BASELINE_SHA256
    assert stat.S_IMODE(script.stat().st_mode) == 0o700
    assert stat.S_IMODE(sidecar.stat().st_mode) == 0o600
    assert "Wrote" in result.output and str(sidecar) in result.output


def test_flag_off_harness_matches_prechange_bytes(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "baseline.sh"
    write_workflow(source)

    result = runner.invoke(app, [str(source), "--workflow", "wf_example", "--output", str(script)])

    assert result.exit_code == 0, result.output
    assert hashlib.sha256(script.read_bytes()).hexdigest() == BASELINE_SHA256
    assert stat.S_IMODE(script.stat().st_mode) == 0o700
    assert not dagu_sidecar_path(script).exists()


def test_complex_flag_off_and_sidecar_harness_match_prechange_golden(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    source.write_text(
        """workflows:
  - id: wf_golden
    name: golden complex flow
    params:
      - name: ISSUE_NUMBER
        required: true
    steps:
      - type: vars
        name: Prepare state
        values:
          ITEMS: printf 'one\\ntwo\\n'
          SUMMARY: printf '%s' \"$ISSUE_NUMBER\"
      - type: agent
        name: Capture response
        agent: build
        model: openai/gpt-5.6-luna
        capture: RESULT
        expandPrompt: true
        prompt: Review issue ${ISSUE_NUMBER}; preserve literal $(date) text.
      - type: for
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            name: Handle item
            run: printf '%s\\n' \"$ITEM\"
      - type: parallel
        steps:
          - type: bash
            name: Branch one
            run: printf 'one\\n'
          - type: bash
            name: Branch two
            run: printf 'two\\n'
      - type: bash
        name: Failure boundary
        run: exit 17
""",
        encoding="utf-8",
    )
    flag_off = tmp_path / "flag-off.sh"
    with_sidecar = tmp_path / "with-sidecar.sh"

    plain_result = runner.invoke(
        app,
        [str(source), "--workflow", "wf_golden", "--output", str(flag_off)],
    )
    sidecar_result = runner.invoke(
        app,
        [
            str(source),
            "--workflow",
            "wf_golden",
            "--output",
            str(with_sidecar),
            "--sidecar",
            "dagu",
        ],
    )

    assert plain_result.exit_code == 0, plain_result.output
    assert sidecar_result.exit_code == 0, sidecar_result.output
    assert hashlib.sha256(flag_off.read_bytes()).hexdigest() == COMPLEX_BASELINE_SHA256
    assert with_sidecar.read_bytes() == flag_off.read_bytes()
    assert stat.S_IMODE(flag_off.stat().st_mode) == 0o700
    assert stat.S_IMODE(with_sidecar.stat().st_mode) == 0o700


def test_cli_sidecar_dry_run_lists_both_artifacts_without_writing(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
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
            "--dry-run",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "custom.sh" in result.output
    assert "custom.dagu.yml" in result.output
    assert not script.exists()
    assert not dagu_sidecar_path(script).exists()


def test_cli_unknown_sidecar_format_does_not_write_any_artifact(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_workflow(source)

    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "unknown"])

    assert result.exit_code != 0
    assert "dagu" in result.output
    assert not script.exists()
    assert not dagu_sidecar_path(script).exists()


def test_sidecar_name_and_input_workflow_protection(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    write_workflow(source)
    workflow = parse_workflows(source)[0]
    assert render_harness(workflow).startswith("#!/usr/bin/env bash")
    assert dagu_sidecar_path(Path("nested/example.sh")) == Path("nested/example.dagu.yml")

    result = runner.invoke(
        app, [str(source), "--output", str(source), "--sidecar", "dagu", "--force"]
    )

    assert result.exit_code == 1
    assert "input workflow YAML" in result.stderr
    assert source.read_text(encoding="utf-8").startswith("workflows:")


def test_sidecar_conflict_blocks_both_outputs_until_force(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    sidecar = dagu_sidecar_path(script)
    sidecar.write_text("keep sidecar", encoding="utf-8")
    write_workflow(source)

    blocked = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])
    assert blocked.exit_code == 1
    assert "Refusing to overwrite" in blocked.stderr
    assert not script.exists()
    assert sidecar.read_text(encoding="utf-8") == "keep sidecar"

    replaced = runner.invoke(
        app, [str(source), "--output", str(script), "--sidecar", "dagu", "--force"]
    )
    assert replaced.exit_code == 0, replaced.output
    assert script.exists()
    assert yaml.safe_load(sidecar.read_text(encoding="utf-8"))["steps"][0]["id"] == "decode_payload"


def test_sidecar_directory_conflict_does_not_publish_script(tmp_path: Path) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    dagu_sidecar_path(script).mkdir()
    write_workflow(source)

    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "exists but is a directory" in result.stderr
    assert not script.exists()


def test_sidecar_staging_failure_cleans_temporary_script(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "workflows.yml"
    script = tmp_path / "custom.sh"
    write_workflow(source)
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
    assert "published: none" in result.stderr
    assert "not published:" in result.stderr
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
    write_workflow(source)

    result = runner.invoke(app, [str(source), "--output", str(script), "--sidecar", "dagu"])

    assert result.exit_code == 1
    assert "Refusing to overwrite" in result.stderr
    assert not script.exists()
    assert target.read_text(encoding="utf-8") == "do not replace"


def test_sidecar_path_cannot_overwrite_input_even_with_force(tmp_path: Path) -> None:
    source = tmp_path / "custom.dagu.yml"
    script = tmp_path / "custom.sh"
    write_workflow(source)

    result = runner.invoke(
        app,
        [str(source), "--output", str(script), "--sidecar", "dagu", "--force"],
    )

    assert result.exit_code == 1
    assert "input workflow YAML" in result.stderr
    assert source.read_text(encoding="utf-8").startswith("workflows:")
    assert not script.exists()


def test_multiple_workflows_write_default_sidecar_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "workflows.yml"
    write_workflow(source)
    with source.open("a", encoding="utf-8") as workflow_file:
        workflow_file.write(
            """  - id: wf_second
    name: Second
    steps:
      - type: bash
        run: echo second
"""
        )
    monkeypatch.chdir(tmp_path)

    result = runner.invoke(app, [str(source), "--sidecar", "dagu"])

    assert result.exit_code == 0, result.output
    assert {path.name for path in tmp_path.glob("*.sh")} == {"example.sh", "second.sh"}
    assert {path.name for path in tmp_path.glob("*.dagu.yml")} == {
        "example.dagu.yml",
        "second.dagu.yml",
    }
