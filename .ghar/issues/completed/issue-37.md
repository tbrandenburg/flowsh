# Investigation: feat: support optional workflow metadata parameters (enabled, schedule, shellScriptPath)

**Issue**: #37 (https://github.com/tbrandenburg/flowsh/issues/37)
**Type**: ENHANCEMENT
**Investigated**: 2026-06-22T20:30:00Z

### Assessment

| Metric     | Value  | Reasoning                                                                                              |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Priority   | MEDIUM | Enables external tooling annotation (schedulers, CI runners) but does not block current workflow use   |
| Complexity | LOW    | Single model class change (3 optional fields), 1 existing test inverted, 3 new tests added             |
| Confidence | HIGH   | Root cause fully identified: `StrictModel(extra="forbid")` at `models.py:44` rejects unknown fields   |

## Problem Statement

External tooling (schedulers, CI runners, orchestrators) needs to annotate workflows with operational metadata (`enabled`, `schedule`, `shellScriptPath`) co-located in the workflow YAML. Currently `Workflow` inherits `StrictModel` which sets `extra="forbid"`, so any YAML containing these fields raises a `WorkflowParseError` at parse time. These three fields must be accepted by the schema and parser but produce **no change** in generated shell scripts.

## Analysis

### Change Rationale

Adding three optional fields to `Workflow` at `models.py:199-203` will:

1. Allow the fields in YAML without validation errors (Pydantic simply populates them)
2. Auto-expose them in `--schema` output via `WorkflowFile.model_json_schema()` — no CLI change needed
3. Leave the generated shell script **identical** — `render_harness()` only touches `workflow.id`, `workflow.name`, `workflow.params`, and `workflow.steps`; the new fields are never read by the renderer

### Evidence Chain

WHY: YAML with `enabled`, `schedule`, or `shellScriptPath` fields raises `WorkflowParseError`
↓ BECAUSE: `parse_workflows()` calls `WorkflowFile.model_validate(data)`, which propagates Pydantic's `ValidationError`
Evidence: `models.py:261-263` — `return WorkflowFile.model_validate(data).workflows` inside `try/except ValidationError as error: raise WorkflowParseError(...)`

↓ BECAUSE: Pydantic raises a `ValidationError` for extra fields on any model inheriting `StrictModel`
Evidence: `models.py:43-44` — `class StrictModel(BaseModel): model_config = ConfigDict(extra="forbid", strict=True)`

↓ BECAUSE: `Workflow` inherits `StrictModel` and declares none of the three fields
Evidence: `models.py:199-203` —
```python
class Workflow(StrictModel):
    id: str
    name: str
    params: list[WorkflowParam] = []
    steps: list[Step]
```

↓ ROOT CAUSE: The three metadata fields are absent from `Workflow`; adding them as optional fields resolves the rejection without touching any other code path.

### Affected Files

| File                                      | Lines     | Action | Description                                               |
| ----------------------------------------- | --------- | ------ | --------------------------------------------------------- |
| `src/flowsh_cli/models.py`                | 199-203   | UPDATE | Add 3 optional fields to `Workflow` class                 |
| `tests/test_workflow_to_harness.py`       | 1161-1179 | UPDATE | Invert rejection test to acceptance test                  |
| `tests/test_workflow_to_harness.py`       | after 1179| CREATE | Add 3 new tests (partial, absent defaults, script identity) |
| `tests/test_workflow_to_harness.py`       | 633-645   | UPDATE | Add 3 schema assertions for new fields                    |

### Integration Points

- `src/flowsh_cli/render.py:22-227` — `render_harness()`: uses only `workflow.id`, `workflow.name`, `workflow.params`, `workflow.steps` — **no change needed**
- `src/flowsh_cli/render.py:18-19` — `harness_path()`: uses only `workflow.id` — **no change needed**
- `src/flowsh_cli/cli.py` — `--schema` already calls `workflow_schema_yaml()` → `WorkflowFile.model_json_schema()` — auto-updates, **no change needed**
- `src/flowsh_cli/models.py:266-271` — `workflow_schema_yaml()`: calls `WorkflowFile.model_json_schema()` — schema auto-updates, **no change needed**

### Git History

- **Rejection test introduced**: `ee97fb5` — 2026-06-02 — "feat: support named positional parameters in workflow harness (#19)"
- **Last `models.py` modification**: `e8d67fb` — "feat: add parallel step type for concurrent workflow execution (#25) (#27)"
- **Implication**: The `test_cli_rejects_removed_metadata_and_path_fields` test was added to guard against old schema fields leaking back in. This issue reverses that guard intentionally: the fields are now declared as supported optional metadata.

## Implementation Plan

### Step 1: Add optional metadata fields to `Workflow` model

**File**: `src/flowsh_cli/models.py`
**Lines**: 199-203
**Action**: UPDATE

**Current code:**

```python
class Workflow(StrictModel):
    id: str
    name: str
    params: list[WorkflowParam] = []
    steps: list[Step]
```

**Required change:**

```python
class Workflow(StrictModel):
    id: str
    name: str
    params: list[WorkflowParam] = []
    enabled: bool = True
    schedule: str | None = None
    shellScriptPath: str | None = None
    steps: list[Step]
```

**Why**: Declares the three metadata fields as optional with sensible defaults. `enabled` defaults to `True` (active by default). `schedule` and `shellScriptPath` default to `None` (not configured). No validators are needed — these fields are passive metadata consumed only by external tooling, never by the parser or renderer. Field order keeps `steps` last to maintain YAML readability.

---

### Step 2: Invert the existing rejection test to an acceptance test

**File**: `tests/test_workflow_to_harness.py`
**Lines**: 1161-1179
**Action**: UPDATE

**Current code:**

```python
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
```

**Required change:**

```python
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
```

**Why**: The YAML that was explicitly rejected must now parse successfully. The assertions verify the fields are populated with the values supplied.

---

### Step 3: Add tests for partial presence and default values

**File**: `tests/test_workflow_to_harness.py`
**Lines**: after 1179 (insert after the test updated in Step 2)
**Action**: CREATE (new test functions)

```python
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
```

**Why**: These three tests cover the acceptance criteria in full — partial presence, complete absence (defaults), and script identity preservation. The identity test is the most critical: it must fail immediately if anyone accidentally wires the metadata fields into the renderer.

---

### Step 4: Assert new fields appear in `--schema` output

**File**: `tests/test_workflow_to_harness.py`
**Lines**: 633-645
**Action**: UPDATE (add 3 assertions to existing test)

**Current code (lines 638-644):**

```python
    assert "title: WorkflowFile" in result.output
    assert "const: vars" in result.output
    assert "const: bash" in result.output
    assert "const: agent" in result.output
    assert "model:" in result.output
    assert "command:" in result.output
    assert "dangerouslySkipPermissions:" in result.output
```

**Required change:**

```python
    assert "title: WorkflowFile" in result.output
    assert "const: vars" in result.output
    assert "const: bash" in result.output
    assert "const: agent" in result.output
    assert "model:" in result.output
    assert "command:" in result.output
    assert "dangerouslySkipPermissions:" in result.output
    assert "enabled:" in result.output
    assert "schedule:" in result.output
    assert "shellScriptPath:" in result.output
```

**Why**: The `--schema` acceptance criterion requires the three fields to be visible in YAML schema output. Pydantic auto-generates them once the fields are declared; these assertions lock that behavior.

---

## Patterns to Follow

**From codebase — mirror these exactly:**

```python
# SOURCE: models.py:48
# Pattern for optional string field with None default
name: str | None = None

# SOURCE: models.py:84-85
# Pattern for optional string fields on AgentStep
agent: str | None = None
model: str | None = None

# SOURCE: models.py:87-90
# Pattern for boolean field with explicit default (no Field() needed for simple case)
dangerouslySkipPermissions: bool = Field(default=False, ...)
# Simplified for metadata (no alias or description needed):
enabled: bool = True
```

Use `bool = True` directly (no `Field()` wrapper) since `enabled` needs no alias, description, or validators. Use `str | None = None` directly for `schedule` and `shellScriptPath` — same rationale.

---

## Edge Cases & Risks

| Risk / Edge Case                                                   | Mitigation                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Renderer accidentally reads `shellScriptPath` in a future refactor | The identity test (`test_generated_harness_is_identical_with_and_without_metadata_fields`) will immediately catch any such regression |
| `schedule` accepts arbitrary strings, not only valid cron          | By design — flowsh does not interpret `schedule`; external schedulers own validation    |
| `enabled: false` does not suppress harness generation              | By design — `enabled` is metadata for external tooling; suppression is out of scope     |
| `shellScriptPath` does not control actual output path              | By design — output path is derived from `workflow.id` via `harness_path()`; path hint is metadata only |
| Test name `test_cli_rejects_removed_metadata_and_path_fields` remains in git history | Rename fully resolves confusion; no runtime impact |

---

## Validation

### Automated Checks

```bash
make qa
```

This runs `uv run ruff check`, `uv run mypy`, and `uv run pytest` — all three must pass.

### Manual Verification

1. Create `test.yml` with all three metadata fields and run `uv run flowsh-cli test.yml --dry-run` — must succeed with exit 0
2. Run `uv run flowsh-cli --schema` — verify `enabled:`, `schedule:`, and `shellScriptPath:` appear in the output
3. Generate harness with and without metadata fields, diff the outputs — must be byte-for-byte identical

---

## Scope Boundaries

**IN SCOPE:**

- Adding `enabled: bool = True`, `schedule: str | None = None`, `shellScriptPath: str | None = None` to `Workflow` at `models.py:199-203`
- Renaming and inverting `test_cli_rejects_removed_metadata_and_path_fields` → `test_parse_workflows_accepts_all_optional_metadata_fields`
- Adding 3 new test functions for partial presence, default values, and script identity
- Adding 3 schema assertions to `test_cli_exposes_schema_without_workflow_argument`

**OUT OF SCOPE (do not touch):**

- `render.py` — must not be changed; generated scripts must remain identical
- `cli.py` — must not be changed; `--schema` already auto-updates
- `StrictModel`, `WorkflowFile`, `WorkflowParam`, any step model
- Making `enabled: false` suppress harness generation (future enhancement)
- Making `shellScriptPath` control the actual output path (future enhancement)
- Adding validators on the three new fields
- Adding any metadata fields beyond the three proposed in the issue

---

## Metadata

- **Investigated by**: GHAR
- **Timestamp**: 2026-06-22T20:30:00Z
- **Artifact**: `.ghar/issues/issue-37.md`
