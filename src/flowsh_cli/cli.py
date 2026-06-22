from __future__ import annotations

import os
import stat
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Annotated

import typer

from flowsh_cli import __version__
from flowsh_cli.examples import example_yaml, examples_index
from flowsh_cli.models import Workflow, WorkflowParseError, parse_workflows, workflow_schema_yaml
from flowsh_cli.render import harness_path, render_harness

app = typer.Typer(
    add_completion=False,
    context_settings={"terminal_width": 120, "max_content_width": 120},
    help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.",
    pretty_exceptions_enable=False,
    rich_markup_mode=None,
)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        app(args=list(argv) if argv is not None else None, prog_name="flowsh-cli")
    except SystemExit as error:
        return error.code if isinstance(error.code, int) else 1

    return 0


@app.command(help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.")
def generate(
    workflow_yaml: Annotated[Path, typer.Argument(help="Path to workflow YAML")],
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
    output: Annotated[
        Path | None,
        typer.Option(
            "--output",
            help="Output path for the generated script. Requires exactly one workflow.",
        ),
    ] = None,
    version: Annotated[
        bool,
        typer.Option(
            "--version",
            callback=lambda value: print_version(value),
            help="Show the flowsh-cli version and exit.",
            is_eager=True,
        ),
    ] = False,
    schema: Annotated[
        bool,
        typer.Option(
            "--schema",
            callback=lambda value: print_schema(value),
            help="Show the workflow YAML schema and exit.",
            is_eager=True,
        ),
    ] = False,
    examples: Annotated[
        bool,
        typer.Option(
            "--examples",
            callback=lambda value: print_examples_index(value),
            help="List available workflow examples and exit.",
            is_eager=True,
        ),
    ] = False,
    example: Annotated[
        str | None,
        typer.Option(
            "--example",
            metavar="NAME",
            callback=lambda value: print_example(value),
            help="Print a named example workflow YAML to stdout and exit.",
            is_eager=True,
        ),
    ] = None,
) -> None:
    """Generate Bash harnesses from workflow YAML."""

    _ = version
    _ = schema
    _ = examples
    _ = example

    try:
        workflows = parse_workflows(workflow_yaml)
        selected = select_workflows(workflows, workflow)
        write_harnesses(selected, dry_run=dry_run, force=force, output=output)
    except WorkflowParseError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise typer.Exit(1) from error
    except OSError as error:
        print(f"ERROR: Cannot write harness: {error}", file=sys.stderr)
        raise typer.Exit(1) from error


def select_workflows(workflows: list[Workflow], selector: str | None) -> list[Workflow]:
    if selector is None:
        return workflows

    matches = [workflow for workflow in workflows if workflow.id == selector]
    if matches:
        return matches

    known = ", ".join(f"{workflow.name} ({workflow.id})" for workflow in workflows)
    raise WorkflowParseError(f"No workflow id matched {selector!r}. Known workflows: {known}")


def print_version(value: bool) -> None:
    if not value:
        return

    print(f"flowsh-cli {__version__}")
    raise typer.Exit


def print_schema(value: bool) -> None:
    if not value:
        return

    print(workflow_schema_yaml(), end="")
    raise typer.Exit


def print_examples_index(value: bool) -> None:
    if not value:
        return

    print(examples_index())
    raise typer.Exit


def print_example(value: str | None) -> None:
    if value is None:
        return

    try:
        print(example_yaml(value), end="")
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        raise typer.Exit(1) from error
    raise typer.Exit


def write_harnesses(
    workflows: list[Workflow],
    *,
    dry_run: bool,
    force: bool,
    output: Path | None = None,
) -> None:
    if output is not None and len(workflows) != 1:
        message = (
            "--output requires exactly one workflow to be selected "
            "(use --workflow to select a single workflow)"
        )
        raise WorkflowParseError(message)

    output_paths = (
        [(workflows[0], output)]
        if output is not None
        else [(workflow, harness_path(workflow)) for workflow in workflows]
    )

    if dry_run:
        for workflow, output_path in output_paths:
            print(f"DRY-RUN would write {output_path} for workflow {workflow.name!r}")
        return

    directory_conflicts = [path for _, path in output_paths if path.exists() and path.is_dir()]
    if directory_conflicts:
        conflict_list = ", ".join(str(path) for path in directory_conflicts)
        raise WorkflowParseError(f"Output path exists but is a directory: {conflict_list}")

    if not force:
        conflicts = [path for _, path in output_paths if path.exists() or path.is_symlink()]
        if conflicts:
            conflict_list = ", ".join(str(path) for path in conflicts)
            message = f"Refusing to overwrite existing file(s): {conflict_list} (use --force)"
            raise WorkflowParseError(message)

    rendered_harnesses = [
        (output_path, render_harness(workflow)) for workflow, output_path in output_paths
    ]

    for output_path, script in rendered_harnesses:
        if (output_path.exists() or output_path.is_symlink()) and not force:
            message = f"Refusing to overwrite existing file: {output_path} (use --force)"
            raise WorkflowParseError(message)

        ensure_output_directory(output_path.parent)
        write_executable(output_path, script)
        print(f"Wrote {output_path}")


def ensure_output_directory(path: Path) -> None:
    if path.is_symlink():
        raise WorkflowParseError(f"Refusing to write through symlinked directory: {path}")
    if path.exists() and not path.is_dir():
        raise WorkflowParseError(f"Output path exists but is not a directory: {path}")

    path.mkdir(parents=True, exist_ok=True)


def write_executable(output_path: Path, content: str) -> None:
    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(content)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())

        temporary_path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        temporary_path.replace(output_path)
        fsync_directory(output_path.parent)
    except OSError:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def fsync_directory(path: Path) -> None:
    try:
        descriptor = os.open(path, os.O_RDONLY)
    except OSError:
        return

    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
