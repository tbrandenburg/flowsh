# Investigation: Feature: support named positional parameters in workflow harness

**Issue**: #19 (https://github.com/tbrandenburg/flowsh/issues/19)
**Type**: ENHANCEMENT
**Investigated**: 2026-06-02T00:00:00Z

### Assessment

| Metric     | Value  | Reasoning                                                                                              |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Priority   | MEDIUM | Convenience improvement for single-purpose workflows; env-var workaround exists but is user-unfriendly |
| Complexity | MEDIUM | Touches 3 files (models, render, tests), self-contained — no downstream integrations to break          |
| Confidence | HIGH   | The issue contains the exact proposed YAML schema and bash output; root cause is a missing feature     |

---

## Problem Statement

The generated harness only accepts `--dry-run` as an argument and rejects everything else with `exit 2`. Runtime values must be passed via environment variables (`ISSUE_NUMBER=42 bash .harness/foo.sh`), which makes generated harnesses feel like internal implementation details rather than first-class CLI tools. The fix is to add an optional `params` list to the `Workflow` schema so positional arguments can be declared and the harness generator wires them up automatically.

---

## Analysis

### Change Rationale

The `Workflow` Pydantic model in `models.py` has no `params` field. The harness generator in `render.py` hard-codes a simple if/elif block that only recognises `--dry-run`. Adding `params` support requires:

1. A new `WorkflowParam` Pydantic model and a `params` field on `Workflow`.
2. A new argument-parsing code path in `render_harness()` that emits the while-loop parser from the issue when params are declared.
3. New tests: schema validation for `params`, and end-to-end harness execution tests.

### Evidence Chain

WHY: Callers cannot pass positional args to a generated harness  
↓ BECAUSE: The argument block hard-codes `--dry-run`-only logic  
Evidence: `render.py:29-35`
```python
"DRY_RUN=false",
'if [[ $# -eq 1 && "$1" == "--dry-run" ]]; then',
"  DRY_RUN=true",
"elif [[ $# -gt 0 ]]; then",
'  printf "Usage: %s [--dry-run]\\n" "$0" >&2',
"  exit 2",
```

↓ BECAUSE: The `Workflow` schema carries no `params` metadata  
Evidence: `models.py:160-163`
```python
class Workflow(StrictModel):
    id: str
    name: str
    steps: list[Step]
```

↓ ROOT CAUSE: Both the schema and the generator need to be extended

### Affected Files

| File                                     | Lines    | Action | Description                              |
| ---------------------------------------- | -------- | ------ | ---------------------------------------- |
| `src/flowsh_cli/models.py`               | 157–186  | UPDATE | Add `WorkflowParam` model + `params` field on `Workflow` |
| `src/flowsh_cli/render.py`               | 28–35    | UPDATE | Replace hard-coded arg block with params-aware generator |
| `tests/test_workflow_to_harness.py`      | 1575+    | UPDATE | Add tests for param binding, required validation, usage output |

### Integration Points

- `render_harness(workflow: Workflow)` in `render.py:13` — consumes `Workflow`; needs to read `workflow.params`
- `parse_workflows()` in `models.py:206` — uses `WorkflowFile.model_validate`; new field will be validated automatically
- `test_generated_harness_rejects_unexpected_arguments` in `tests/test_workflow_to_harness.py:1575` — will need updating because the usage line will change when params are declared

### Git History

- **Last models.py change**: `d8133ba` – fix(agent): safe variable-only interpolation for expandPrompt
- **Last render.py change**: `d8133ba` – same commit
- **Implication**: New feature addition, not a regression fix

---

## Implementation Plan

### Step 1: Add `WorkflowParam` model and `params` field to `Workflow`

**File**: `src/flowsh_cli/models.py`  
**Lines**: 157–186  
**Action**: UPDATE

**Current code (`models.py:157-163`):**
```python
Step = Annotated[VarsStep | BashStep | AgentStep, Field(discriminator="type")]


class Workflow(StrictModel):
    id: str
    name: str
    steps: list[Step]
```

**Required change:**
```python
Step = Annotated[VarsStep | BashStep | AgentStep, Field(discriminator="type")]


class WorkflowParam(StrictModel):
    name: str
    description: str | None = None
    required: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", value):
            raise ValueError("must match ^[A-Z_][A-Z0-9_]*$")
        return value


class Workflow(StrictModel):
    id: str
    name: str
    params: list[WorkflowParam] = []
    steps: list[Step]
```

**Why**: Pydantic `extra="forbid"` is inherited from `StrictModel`, so unknown YAML keys are rejected. The name validator mirrors the pattern already used for `VarsStep` variable names (uppercase env-var style). Default `[]` keeps all existing YAML files valid.

---

### Step 2: Replace hard-coded arg block in `render_harness()`

**File**: `src/flowsh_cli/render.py`  
**Lines**: 28–35  
**Action**: UPDATE

**Current code (`render.py:28-35`):**
```python
section("Argument handling"),
"DRY_RUN=false",
'if [[ $# -eq 1 && "$1" == "--dry-run" ]]; then',
"  DRY_RUN=true",
"elif [[ $# -gt 0 ]]; then",
'  printf "Usage: %s [--dry-run]\\n" "$0" >&2',
"  exit 2",
"fi",
```

**Required change** — replace those 8 lines with a call to a new helper and insert the helper below `render_harness`:

```python
# In render_harness(), lines 28-35 become:
section("Argument handling"),
*_render_arg_block(workflow.params),
```

New helper (add after `render_harness` or at end of file, before `bash_quote`):

```python
def _render_arg_block(params: list) -> list[str]:
    if not params:
        # Original simple block — no params declared
        return [
            "DRY_RUN=false",
            'if [[ $# -eq 1 && "$1" == "--dry-run" ]]; then',
            "  DRY_RUN=true",
            "elif [[ $# -gt 0 ]]; then",
            '  printf "Usage: %s [--dry-run]\\n" "$0" >&2',
            "  exit 2",
            "fi",
        ]

    # Build usage string: [--dry-run] <REQUIRED> [OPTIONAL]
    usage_parts: list[str] = ["[--dry-run]"]
    for p in params:
        usage_parts.append(f"<{p.name}>" if p.required else f"[{p.name}]")
    usage_str = " ".join(usage_parts)

    lines: list[str] = [
        "DRY_RUN=false",
        "POSITIONAL_ARGS=()",
        "",
        "while [[ $# -gt 0 ]]; do",
        '  case "$1" in',
        "    --dry-run)",
        "      DRY_RUN=true",
        "      shift",
        "      ;;",
        "    --*)",
        '      printf "Unknown option: %s\\n" "$1" >&2',
        "      exit 2",
        "      ;;",
        "    *)",
        '      POSITIONAL_ARGS+=("$1")',
        "      shift",
        "      ;;",
        "  esac",
        "done",
        "",
    ]

    # Bind positional args to named params
    for idx, param in enumerate(params):
        lines += [
            f'if [[ ${{#POSITIONAL_ARGS[@]}} -gt {idx} ]]; then',
            f'  {param.name}="${{POSITIONAL_ARGS[{idx}]}}"',
            f'  export {param.name}',
            "fi",
        ]

    lines.append("")

    # Validate required params (env var takes precedence — checked after binding)
    required = [p for p in params if p.required]
    if required:
        for param in required:
            lines += [
                f'if [[ -z "${{{param.name}:-}}" ]]; then',
                f'  printf "Usage: %s {usage_str}\\n" "$0" >&2',
                "  exit 2",
                "fi",
            ]

    return lines
```

**Why**: The `_render_arg_block` helper keeps `render_harness` readable, produces the exact bash pattern from the issue spec, and falls back to the original two-liner when no params are declared (zero-regression on existing YAML files). Env var overrides work naturally because the `if [[ -z "${VAR:-}" ]]` check runs after positional binding — a pre-set env var skips the binding assignment but still satisfies the required check.

---

### Step 3: Update the import in `render.py`

**File**: `src/flowsh_cli/render.py`  
**Lines**: 6  
**Action**: UPDATE

**Current:**
```python
from flowsh_cli.models import AgentStep, BashStep, Step, VarsStep, Workflow
```

**Required:**
```python
from flowsh_cli.models import AgentStep, BashStep, Step, VarsStep, Workflow, WorkflowParam
```

(Only needed if `_render_arg_block` type-hints its parameter as `list[WorkflowParam]`; if using bare `list` it's not required. Recommended for type safety.)

---

### Step 4: Add/Update Tests

**File**: `tests/test_workflow_to_harness.py`  
**Action**: UPDATE

**Test cases to add (end-to-end style, mirroring existing patterns at lines 1171–1260):**

```python
def test_generated_harness_binds_required_positional_param(tmp_path):
    """Positional arg $1 is exported as the declared param name."""
    workflow = Workflow(
        id="wf_test_param",
        name="test_param",
        params=[WorkflowParam(name="ISSUE_NUMBER", required=True)],
        steps=[BashStep(type="bash", run="printf '%s\\n' \"$ISSUE_NUMBER\"")],
    )
    # generate and run harness
    harness = tmp_path / ".harness" / "test_param.sh"
    harness.parent.mkdir()
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
    harness = tmp_path / ".harness" / "test_env.sh"
    harness.parent.mkdir()
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
    harness = tmp_path / ".harness" / "test_required.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))
    result = subprocess.run(["bash", str(harness)], capture_output=True, text=True)
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
    harness = tmp_path / ".harness" / "test_optional.sh"
    harness.parent.mkdir()
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
    harness = tmp_path / ".harness" / "test_dryrun_param.sh"
    harness.parent.mkdir()
    harness.write_text(render_harness(workflow))
    result = subprocess.run(["bash", str(harness), "42", "--dry-run"], capture_output=True, text=True)
    # dry-run just skips agent steps; bash step still runs
    assert result.returncode == 0


def test_workflow_param_name_must_be_uppercase_env_var_style():
    """WorkflowParam rejects lowercase names."""
    with pytest.raises(ValidationError):
        WorkflowParam(name="issue_number")


def test_workflow_param_name_rejects_starting_digit():
    with pytest.raises(ValidationError):
        WorkflowParam(name="1BAD")


def test_workflow_with_params_parses_from_yaml():
    """params field is accepted in YAML workflow."""
    data = {
        "workflows": [{
            "id": "wf_example",
            "name": "Example",
            "params": [{"name": "ISSUE_NUMBER", "required": True}],
            "steps": [{"type": "bash", "run": "echo $ISSUE_NUMBER"}],
        }]
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert len(workflows[0].params) == 1
    assert workflows[0].params[0].name == "ISSUE_NUMBER"
    assert workflows[0].params[0].required is True


def test_workflow_without_params_field_still_valid():
    """Existing YAML without params key is unchanged (default empty list)."""
    data = {
        "workflows": [{
            "id": "wf_example",
            "name": "Example",
            "steps": [{"type": "bash", "run": "echo hi"}],
        }]
    }
    workflows = WorkflowFile.model_validate(data).workflows
    assert workflows[0].params == []
```

---

## Patterns to Follow

**From codebase — VarsStep variable name validator to mirror for WorkflowParam.name:**

```python
# SOURCE: src/flowsh_cli/models.py:136-154 (VarsStep)
class VarsStep(BaseStep):
    type: Literal["vars"]
    values: dict[str, str]

    @field_validator("values")
    @classmethod
    def validate_values(cls, values: dict[str, str]) -> dict[str, str]:
        for key in values:
            if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", key):
                raise ValueError(f"variable name {key!r} must match ^[A-Z_][A-Z0-9_]*$")
        return values
```

Use the same regex `r"[A-Z_][A-Z0-9_]*"` for `WorkflowParam.name`.

**From codebase — `_render_arg_block` should use `bash_quote` helper:**

```python
# SOURCE: src/flowsh_cli/render.py:352-353
def bash_quote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"
```

Not needed for param names (validated to be `[A-Z_][A-Z0-9_]*`) but available for usage strings if needed.

---

## Edge Cases & Risks

| Risk / Edge Case                                   | Mitigation                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Env var set AND positional arg provided             | Binding only writes if `POSITIONAL_ARGS` index exists; env var pre-set takes precedence because required check uses `${VAR:-}` |
| `--dry-run` before positional (`./foo.sh --dry-run 42`) | While-loop case statement handles any order; flags consumed before positionals  |
| Param name clashes with internal vars (`DRY_RUN`, etc.) | `WorkflowParam.name` validator uses `[A-Z_][A-Z0-9_]*`; document convention; could add explicit denylist if needed |
| More positional args than declared params           | Extra args go into `POSITIONAL_ARGS` but are never bound — silently ignored. Acceptable per spec |
| `extra="forbid"` on `StrictModel`                  | `WorkflowParam` inherits `StrictModel` so unknown YAML keys are rejected automatically |

---

## Validation

```bash
make qa
```

Or individually:
```bash
# type check
uv run mypy src/

# unit + integration tests
uv run pytest tests/test_workflow_to_harness.py -k "param"

# full suite
uv run pytest
```

### Manual Verification

1. Create a workflow YAML with `params: [{name: ISSUE_NUMBER, required: true}]`
2. Run `flowsh generate` (or equivalent CLI command)
3. Confirm `.harness/foo.sh 42` runs correctly and exports `ISSUE_NUMBER=42`
4. Confirm `.harness/foo.sh` (no arg, no env) exits 2 with a usage line containing `<ISSUE_NUMBER>`
5. Confirm `ISSUE_NUMBER=99 .harness/foo.sh` exits 0
6. Confirm existing harnesses (no `params` key) are byte-for-byte unchanged

---

## Scope Boundaries

**IN SCOPE:**
- `WorkflowParam` Pydantic model with `name`, `description`, `required`
- `params: list[WorkflowParam] = []` field on `Workflow`
- New `_render_arg_block()` helper in `render.py` replacing the hard-coded 8-line block
- Tests: schema validation + end-to-end harness execution

**OUT OF SCOPE (do not touch):**
- Named flags (`--issue-number=42`) — positional only per issue spec
- Default values for params — not mentioned in issue
- Changing `--dry-run` semantics
- CLI `flowsh` command interface beyond harness generation

---

## Metadata

- **Investigated by**: Claude
- **Timestamp**: 2026-06-02T00:00:00Z
- **Artifact**: `.claude/PRPs/issues/issue-19.md`
