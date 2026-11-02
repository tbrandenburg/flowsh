from __future__ import annotations

import os
import sys
import tempfile
from collections.abc import Sequence
from enum import Enum
from pathlib import Path
from typing import Annotated

import typer

from flowsh_cli import __version__
from flowsh_cli.dagu import (
    dagu_sidecar_path,
    default_project_dir,
    render_dagu_sidecar,
    unsupported_dagu_reasons,
)
from flowsh_cli.examples import example_yaml, examples_index
from flowsh_cli.models import Workflow, WorkflowParseError, parse_workflows, workflow_schema_yaml
from flowsh_cli.render import harness_path, render_harness
from flowsh_cli.skill import skill_text

DEFAULT_WORKFLOW_YAML = Path("workflows.yml")
WORKFLOW_YAML_ARGUMENT = typer.Argument(DEFAULT_WORKFLOW_YAML, help="Path to workflow.yml")


class SidecarFormat(str, Enum):
    dagu = "dagu"


app = typer.Typer(
    add_completion=False,
    context_settings={"terminal_width": 120, "max_content_width": 120},
    help="Generate reproducible shell scripts from workflow YAML files.",
    pretty_exceptions_enable=False,
)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        app(args=list(argv) if argv is not None else None, prog_name="flowsh-cli")
    except SystemExit as error:
        return error.code if isinstance(error.code, int) else 1

    return 0


@app.command(help="Generate reproducible shell scripts from workflow YAML files.")
def generate(
    workflow_yaml: Path = WORKFLOW_YAML_ARGUMENT,
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
    skill: Annotated[
        bool,
        typer.Option(
            "--skill",
            callback=lambda value: print_skill(value),
            help="Show the flowsh-cli skill description and exit.",
            is_eager=True,
        ),
    ] = False,
    output: Annotated[
        Path | None,
        typer.Option(
            "--output",
            metavar="PATH",
            help="Write generated script to PATH. Only valid when generating a single workflow.",
        ),
    ] = None,
    sidecar: Annotated[
        SidecarFormat | None,
        typer.Option(
            "--sidecar",
            help="Also generate a native Dagu v1 sidecar (supported: flat bash and agent).",
        ),
    ] = None,
) -> None:
    """Generate shell scripts from workflow YAML."""

    _ = version
    _ = schema
    _ = examples
    _ = example
    _ = skill

    try:
        workflows = parse_workflows(workflow_yaml)
        selected = select_workflows(workflows, workflow)
        if output is not None and len(selected) != 1:
            print(
                "ERROR: --output requires exactly one workflow "
                "(use --workflow or ensure the file contains only one workflow)",
                file=sys.stderr,
            )
            raise typer.Exit(1)
        write_harnesses(
            selected,
            dry_run=dry_run,
            force=force,
            output_path=output,
            sidecar=sidecar,
            source_path=workflow_yaml,
        )
    except WorkflowParseError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise typer.Exit(1) from error
    except OSError as error:
        output_label = "generated outputs" if sidecar is not None else "harness"
        print(f"ERROR: Cannot write {output_label}: {error}", file=sys.stderr)
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


def print_skill(value: bool) -> None:
    if not value:
        return

    print(skill_text(), end="")
    raise typer.Exit


def write_harnesses(
    workflows: list[Workflow],
    *,
    dry_run: bool,
    force: bool,
    output_path: Path | None = None,
    sidecar: SidecarFormat | None = None,
    source_path: Path | None = None,
) -> None:
    output_paths = [
        (workflow, output_path if output_path is not None else harness_path(workflow))
        for workflow in workflows
    ]

    planned = [
        (workflow, script_path, dagu_sidecar_path(script_path) if sidecar is not None else None)
        for workflow, script_path in output_paths
    ]
    skipped_sidecars = {
        workflow.id: reasons
        for workflow, _, sidecar_path in planned
        if sidecar_path is not None
        if (reasons := unsupported_dagu_reasons(workflow))
    }
    active_paths = [
        path
        for workflow, script_path, sidecar_path in planned
        for path in (script_path, sidecar_path if workflow.id not in skipped_sidecars else None)
        if path is not None
    ]
    resolved_paths = [path.resolve() for path in active_paths]
    if len(set(resolved_paths)) != len(resolved_paths):
        raise WorkflowParseError("Planned output paths must be unique")
    if source_path is not None and source_path.resolve() in resolved_paths:
        raise WorkflowParseError("Refusing to overwrite the input workflow YAML")

    for workflow, _, sidecar_path in planned:
        if sidecar_path is None or workflow.id not in skipped_sidecars:
            continue
        reason = "; ".join(skipped_sidecars[workflow.id])
        existing = (
            " (existing sidecar left unchanged)"
            if sidecar_path.exists() or sidecar_path.is_symlink()
            else ""
        )
        print(
            f"ERROR: Dagu sidecar skipped for {workflow.id}: {reason}; "
            f"{sidecar_path}{existing} (unsupported Dagu capability alone is nonfatal)",
            file=sys.stderr,
        )

    if dry_run:
        for workflow, script_path, sidecar_path in planned:
            print(f"DRY-RUN would write {script_path} for workflow {workflow.name!r}")
            if sidecar_path is not None:
                if workflow.id in skipped_sidecars:
                    print(f"DRY-RUN would skip {sidecar_path} for workflow {workflow.name!r}")
                else:
                    print(f"DRY-RUN would write {sidecar_path} for workflow {workflow.name!r}")
        return

    directory_conflicts = [path for path in active_paths if path.exists() and path.is_dir()]
    if directory_conflicts:
        conflict_list = ", ".join(str(path) for path in directory_conflicts)
        raise WorkflowParseError(f"Output path exists but is a directory: {conflict_list}")

    if not force:
        conflicts = [path for path in active_paths if path.exists() or path.is_symlink()]
        if conflicts:
            conflict_list = ", ".join(str(path) for path in conflicts)
            message = f"Refusing to overwrite existing file(s): {conflict_list} (use --force)"
            raise WorkflowParseError(message)

    rendered_harnesses = []
    for workflow, script_path, sidecar_path in planned:
        script = render_harness(workflow)
        if workflow.id in skipped_sidecars:
            rendered_harnesses.append((script_path, script, None, None))
            continue
        sidecar_content = (
            render_dagu_sidecar(workflow, project_dir=default_project_dir(sidecar_path))
            if sidecar_path is not None
            else None
        )
        rendered_harnesses.append((script_path, script, sidecar_path, sidecar_content))

    staged: list[tuple[Path, Path]] = []
    published: list[Path] = []
    try:
        for script_path, script, sidecar_path, sidecar_content in rendered_harnesses:
            ensure_output_directory(script_path.parent)
            staged.append((stage_output(script_path, script, 0o700), script_path))
            if sidecar_path is not None and sidecar_content is not None:
                ensure_output_directory(sidecar_path.parent)
                staged.append((stage_output(sidecar_path, sidecar_content, 0o600), sidecar_path))
        for temporary_path, output_path in staged:
            temporary_path.replace(output_path)
            published.append(output_path)
            fsync_directory(output_path.parent)
    except (OSError, WorkflowParseError) as error:
        for temporary_path, _ in staged:
            temporary_path.unlink(missing_ok=True)
        if isinstance(error, OSError):
            published_paths = ", ".join(map(str, published)) or "none"
            pending_paths = (
                ", ".join(
                    str(output_path) for output_path in active_paths if output_path not in published
                )
                or "none"
            )
            raise OSError(
                f"Cannot publish generated output; published: {published_paths}; "
                f"not published: {pending_paths}: {error}"
            ) from error
        pending_paths = ", ".join(map(str, active_paths)) or "none"
        raise WorkflowParseError(
            f"Cannot stage generated outputs; published: none; "
            f"not published: {pending_paths}: {error}"
        ) from error

    for script_path, _, sidecar_path, _ in rendered_harnesses:
        print(f"Wrote {script_path}")
        if sidecar_path is not None:
            print(f"Wrote {sidecar_path}")


def ensure_output_directory(path: Path) -> None:
    if path.is_symlink():
        raise WorkflowParseError(f"Refusing to write through symlinked directory: {path}")
    if path.exists() and not path.is_dir():
        raise WorkflowParseError(f"Output path exists but is not a directory: {path}")

    path.mkdir(parents=True, exist_ok=True)


def stage_output(output_path: Path, content: str, mode: int) -> Path:
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
        temporary_path.chmod(mode)
        return temporary_path
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
