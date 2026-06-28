# Investigation: Remove some specific brandings

**Issue**: #24 (https://github.com/tbrandenburg/flowsh/issues/24)
**Type**: REFACTOR
**Investigated**: 2026-06-28T00:00:00Z

### Assessment

| Metric     | Value   | Reasoning |
| ---------- | ------- | --------- |
| Priority   | HIGH    | The requested branding cleanup and optional workflow path directly affect the CLI contract users see first, and the issue author explicitly asked for it. |
| Complexity | MEDIUM  | The change spans CLI help text, package docs, renderer comments, and contract tests, with one real behavior change for an optional positional argument. |
| Confidence | HIGH    | The current code still contains the exact branded strings and the required argument behavior, and the affected lines are already identified with matching test coverage. |

## Problem Statement

The CLI still describes itself as generating "OpenCode Bash harness scripts" from "MADE workflow YAML", and the package docs repeat the same branding. The `WORKFLOW_YAML` positional argument is still required, but the issue asks for it to be optional with a neutral default path and updated help text.

## Analysis

### Root Cause / Change Rationale

The issue is not a bug in parsing or rendering logic; it is a contract/branding mismatch in the user-facing CLI surface. The fix is to update the help strings and docs to neutral wording, then change the command signature so Typer treats the workflow path as optional and the command can run with no positional argument.

### Evidence Chain

WHY: The issue report shows branded help text and a required path argument that no longer matches the desired UX.
↓ BECAUSE: `src/flowsh_cli/cli.py` still hardcodes the branded help text and declares `workflow_yaml` as required.
Evidence: `src/flowsh_cli/cli.py:18-37` -
```python
app = typer.Typer(
    add_completion=False,
    context_settings={"terminal_width": 120, "max_content_width": 120},
    help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.",
    pretty_exceptions_enable=False,
)

@app.command(help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.")
def generate(
    workflow_yaml: Annotated[Path, typer.Argument(help="Path to workflow YAML")],
```

↓ BECAUSE: The command body always passes the positional path straight into `parse_workflows(...)`, so there is no default-path fallback.
Evidence: `src/flowsh_cli/cli.py:109-120` -
```python
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
    write_harnesses(selected, dry_run=dry_run, force=force, output_path=output)
```

↓ BECAUSE: The package docstring and generated harness section comment still repeat the old branding.
Evidence: `src/flowsh_cli/__init__.py:1` -
```python
"""flowsh-cli: generate OpenCode Bash harness scripts from workflow YAML."""
```

Evidence: `src/flowsh_cli/render.py:177-205` -
```python
section("run_agent() - prompt handling and OpenCode CLI invocation"),
...
local cmd=(opencode run --format json)
...
log ERROR "opencode CLI not found in PATH"
```

↓ ROOT CAUSE: User-facing text and the Typer argument declaration are still the pre-cleanup versions, so the CLI continues to advertise the old brand and requires a workflow path.
Evidence: `tests/test_workflow_to_harness.py:50-69, 1076-1115` -
```python
EXPECTED_HELP = """\
Usage: flowsh-cli [OPTIONS] WORKFLOW_YAML

  Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.

Arguments:
  WORKFLOW_YAML  Path to workflow YAML [required]
```

```python
result = subprocess.run(
    [sys.executable, "-m", "flowsh_cli"],
    check=False,
    capture_output=True,
    text=True,
)

assert result.returncode == 2
assert "Missing argument" in result.stderr
assert "'WORKFLOW_YAML'" in result.stderr
```

### Affected Files

| File | Lines | Action | Description |
| --------------- | ----- | ------ | -------------- |
| `src/flowsh_cli/cli.py` | 18-37, 101-120 | UPDATE | Remove branded help text, make `workflow_yaml` optional, and add a default fallback path before parsing. |
| `src/flowsh_cli/__init__.py` | 1 | UPDATE | Replace the module docstring with neutral wording. |
| `src/flowsh_cli/render.py` | 177-205 | UPDATE | Replace the section comment wording while keeping the functional `opencode` invocation intact. |
| `README.md` | 3-15, 78-93 | UPDATE | Remove OpenCode/MADE branding from prose and examples, and align the usage/help excerpt with the new CLI contract. |
| `tests/test_workflow_to_harness.py` | 50-69, 1076-1115 | UPDATE | Update help-text contract expectations and change the missing-argument test to cover the optional-argument behavior. |

### Integration Points

- `src/flowsh_cli/cli.py:26-32` is the CLI entrypoint used by `python -m flowsh_cli` and the package console script.
- `src/flowsh_cli/models.py:303-390` is the parser boundary; `parse_workflows(path)` already validates file existence, size, and YAML shape.
- `src/flowsh_cli/render.py:177-205` generates the runtime `opencode` invocation and PATH check that should remain functional.
- `tests/test_workflow_to_harness.py:50-69` locks the exact help output for subprocess-based CLI behavior.

### Git History

- **Introduced**: `b832c19c` - initial CLI help wording and required positional argument.
- **Last modified**: `d6646d1`, `3b1effa`, `74a561a`, `3f31253` - later CLI features changed nearby code but not this branding/help contract.
- **Implication**: The issue is a long-standing contract cleanup rather than a regression from a recent feature.

## Implementation Plan

### Step 1: Make the CLI help text neutral and make the workflow path optional

**File**: `src/flowsh_cli/cli.py`
**Lines**: 18-37, 101-120
**Action**: UPDATE

**Current code:**

```python
app = typer.Typer(
    add_completion=False,
    context_settings={"terminal_width": 120, "max_content_width": 120},
    help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.",
    pretty_exceptions_enable=False,
)


@app.command(help="Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.")
def generate(
    workflow_yaml: Annotated[Path, typer.Argument(help="Path to workflow YAML")],
```

**Required change:**

```python
app = typer.Typer(
    add_completion=False,
    context_settings={"terminal_width": 120, "max_content_width": 120},
    help="Generate reproducible shell scripts from workflow YAML files.",
    pretty_exceptions_enable=False,
)


@app.command(help="Generate reproducible shell scripts from workflow YAML files.")
def generate(
    workflow_yaml: Annotated[Path | None, typer.Argument(help="Path to workflow.yml")] = None,
```

**Then update the command body:**

```python
    try:
        workflows = parse_workflows(workflow_yaml or Path("workflows.yml"))
```

**Why**: This removes the branded wording from the primary CLI surface and makes `WORKFLOW_YAML` optional while preserving existing parser validation when a file is actually read.

### Step 2: Replace the package docstring

**File**: `src/flowsh_cli/__init__.py`
**Lines**: 1
**Action**: UPDATE

**Current code:**

```python
"""flowsh-cli: generate OpenCode Bash harness scripts from workflow YAML."""
```

**Required change:**

```python
"""flowsh-cli: generate shell scripts from workflow YAML files."""
```

**Why**: The package docstring appears in introspection and documentation contexts, so it should match the neutral product description.

### Step 3: Update the renderer comment only, not the runtime dependency

**File**: `src/flowsh_cli/render.py`
**Lines**: 177-205
**Action**: UPDATE

**Current code:**

```python
section("run_agent() - prompt handling and OpenCode CLI invocation"),
```

**Required change:**

```python
section("run_agent() - prompt handling and CLI invocation"),
```

**Do not change:**

```python
local cmd=(opencode run --format json)
...
log ERROR "opencode CLI not found in PATH"
```

**Why**: The issue asks for brand cleanup, not removal of the actual `opencode` runtime dependency used by generated scripts.

### Step 4: Rewrite README prose and the help excerpt

**File**: `README.md`
**Lines**: 3-15, 78-93
**Action**: UPDATE

**Required changes:**

```md
`flowsh-cli` turns workflow YAML into executable Bash harnesses for OpenCode.
```

Change to neutral wording, and update the quick-start examples from `path/to/workflows.yml` to `path/to/workflow.yml` or another neutral example path consistent with the new CLI help.

Update the help excerpt so it reflects optional positional syntax and the new default-path wording:

```md
Usage: flowsh-cli [OPTIONS] [WORKFLOW_YAML]

  Generate reproducible shell scripts from workflow YAML files.

Arguments:
  WORKFLOW_YAML  Path to workflow.yml
```

Update the step-type table and agent-behavior prose to describe the agent runtime generically, while keeping the functional `opencode` command references only where they are needed to describe the runtime behavior.

**Why**: README is part of the public contract; it must match the CLI output and stop referring to the old project branding.

### Step 5: Update CLI contract tests

**File**: `tests/test_workflow_to_harness.py`
**Lines**: 50-69, 1076-1115
**Action**: UPDATE

**Required changes:**

```python
EXPECTED_HELP = """\
Usage: flowsh-cli [OPTIONS] [WORKFLOW_YAML]

  Generate reproducible shell scripts from workflow YAML files.

Arguments:
  WORKFLOW_YAML  Path to workflow.yml
```

Replace the current missing-argument failure test with one that proves the command no longer exits with Typer's missing-argument error when invoked with no positional argument. The new assertion should verify the command reaches the parser and fails only if the default path is absent, not because the argument was required.

**Why**: The tests currently encode the old CLI contract, so they need to describe the new optional-argument behavior explicitly.

## Patterns to Follow

**From codebase - mirror these exactly:**

```python
# SOURCE: src/flowsh_cli/cli.py:56-73
# Pattern for eager callbacks (--version, --schema)
version: Annotated[
    bool,
    typer.Option(
        "--version",
        callback=lambda value: print_version(value),
        help="Show the flowsh-cli version and exit.",
        is_eager=True,
    ),
] = False,
```

```python
# SOURCE: src/flowsh_cli/models.py:303-320
# Pattern for parser validation after a path is chosen
def parse_workflows(path: Path) -> list[Workflow]:
    validate_workflow_file_path(path)
    content = read_workflow_text(path)
```

```python
# SOURCE: tests/test_workflow_to_harness.py:1076-1115
# Pattern for subprocess CLI contract testing
result = subprocess.run(
    [sys.executable, "-m", "flowsh_cli"],
    check=False,
    capture_output=True,
    text=True,
)
```

## Edge Cases & Risks

| Risk/Edge Case | Mitigation |
| -------------- | ---------- |
| Optional positional argument changes help output formatting | Update the exact help snapshot in tests and verify with `pytest` and `uvx flowsh-cli --help`. |
| Defaulting to `workflows.yml` may surprise callers who previously relied on an explicit path | Document the default path in help/README and keep parser errors explicit when the file is absent. |
| Over-cleaning branding could accidentally remove the functional `opencode` dependency from generated scripts | Restrict text changes to prose, comments, and docs; leave runtime command generation unchanged. |
| README examples can drift from the actual CLI contract | Keep the usage snippet and quick-start examples aligned with the tested help output. |

## Validation

### Automated Checks

```bash
make qa
```

### Manual Verification

1. Run `uvx flowsh-cli --help` and confirm the help output no longer mentions OpenCode/MADE branding in the CLI description.
2. Run `uvx flowsh-cli` in a directory without `workflows.yml` and confirm the command now reaches the parser and fails with the normal file-not-found error path, not a missing-argument error.
3. Run `uvx flowsh-cli path/to/workflows.yml --dry-run` and confirm the normal generation flow still works.

## Scope Boundaries

**IN SCOPE:**

- CLI help text, argument optionality, and parser fallback in `src/flowsh_cli/cli.py`
- Neutral package docstring in `src/flowsh_cli/__init__.py`
- Comment-only wording cleanup in `src/flowsh_cli/render.py`
- README prose and usage examples
- CLI contract tests that lock help output and no-argument behavior

**OUT OF SCOPE (do not touch):**

- Functional `opencode` command invocations in generated harnesses
- PATH checks and runtime error handling for missing `opencode`
- Workflow parser validation logic in `src/flowsh_cli/models.py`
- Any changes to `.github/workflows/*`
- Any renaming of existing test fixtures or example step names

## Metadata

- **Investigated by**: issue-resolution-workflow
- **Timestamp**: 2026-06-28T00:00:00Z
- **Artifact**: `.agents/issues/issue-24.md`
