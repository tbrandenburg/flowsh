from __future__ import annotations

import stat
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Annotated

import typer

from flowsh.models import Workflow, WorkflowParseError, parse_workflows
from flowsh.render import harness_path, render_harness

app = typer.Typer(
    add_completion=False,
    help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.",
)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        app(args=list(argv) if argv is not None else None, prog_name="flowsh")
    except SystemExit as error:
        return error.code if isinstance(error.code, int) else 1

    return 0


@app.command(help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.")
def generate(
    workflow_yaml: Annotated[Path, typer.Argument(help="Path to .made/workflows.yml")],
    workflow: Annotated[
        str | None,
        typer.Option(
            "--workflow",
            help="Optional workflow id to generate. Defaults to all workflows.",
        ),
    ] = None,
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", help="Print planned output paths without writing scripts."),
    ] = False,
    force: Annotated[
        bool,
        typer.Option(
            "--force",
            help="Overwrite existing files. Without this, existing files cause a failure.",
        ),
    ] = False,
) -> None:
    """Generate Bash harnesses from workflow YAML."""

    try:
        workflows = parse_workflows(workflow_yaml)
        selected = select_workflows(workflows, workflow)
        write_harnesses(selected, dry_run=dry_run, force=force)
    except WorkflowParseError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise typer.Exit(1) from error


def select_workflows(workflows: list[Workflow], selector: str | None) -> list[Workflow]:
    if selector is None:
        return workflows

    matches = [workflow for workflow in workflows if workflow.id == selector]
    if matches:
        return matches

    known = ", ".join(f"{workflow.name} ({workflow.id})" for workflow in workflows)
    raise WorkflowParseError(f"No workflow id matched {selector!r}. Known workflows: {known}")


def write_harnesses(workflows: list[Workflow], *, dry_run: bool, force: bool) -> None:
    for workflow in workflows:
        output_path = harness_path(workflow)
        if dry_run:
            print(f"DRY-RUN would write {output_path} for workflow {workflow.name!r}")
            continue

        if output_path.exists() and not force:
            message = f"Refusing to overwrite existing file: {output_path} (use --force)"
            raise WorkflowParseError(message)

        script = render_harness(workflow)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(script, encoding="utf-8")
        mode = output_path.stat().st_mode
        output_path.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        print(f"Wrote {output_path}")
