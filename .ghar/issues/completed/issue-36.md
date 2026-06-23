# Investigation: Change default output path from `.harness/[name].sh` to `[name].sh`

**Issue**: #36 (https://github.com/tbrandenburg/flowsh/issues/36)
**Type**: ENHANCEMENT
**Investigated**: 2026-06-23T00:00:00Z

### Assessment

| Metric     | Value  | Reasoning                                                                                                             |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Priority   | MEDIUM | Improves default DX and removes forced directory convention, but does not block any existing workflow execution.      |
| Complexity | MEDIUM | 5 files changed; the source fix is one line, but 49 test assertions require mechanical path updates and 2 tests must be removed. |
| Confidence | HIGH   | Single root cause fully identified in `render.py:18-19`; all downstream effects are fully understood and bounded.    |

## Problem Statement

`harness_path()` in `render.py` hard-codes a `.harness/` subdirectory prefix, forcing every project using `flowsh-cli` to adopt this directory convention. A flat default (`example.sh` in the current working directory) is simpler, requires no directory creation on first use, and matches typical shell-script conventions. Projects that want a subdirectory can place their YAML inside one, or use the forthcoming `--output` flag (issue #35).

## Analysis

### Root Cause / Change Rationale

This is a targeted default path simplification. `harness_path()` is the single source of truth for all output paths. Changing it to emit flat paths cascades cleanly: (1) `ensure_output_directory(Path("."))` becomes a harmless no-op since CWD always exists, (2) two tests that guard against a symlinked/non-dir `.harness` directory become inapplicable and must be removed, and (3) ~49 test assertions need mechanical path updates.

### Evidence Chain

WHY: Generated scripts land in `.harness/[name].sh` instead of `[name].sh`
↓ BECAUSE: `harness_path` hard-codes the `.harness/` prefix
Evidence: `src/flowsh_cli/render.py:18-19` - `return Path(".harness") / f"{workflow.id.removeprefix('wf_')}.sh"`

↓ BECAUSE: `render_harness` and `write_harnesses` both consume `harness_path()` output directly without transformation
Evidence: `src/flowsh_cli/render.py:23` - `script_name = harness_path(workflow).name`
Evidence: `src/flowsh_cli/cli.py:163` - `output_paths = [(workflow, harness_path(workflow)) for workflow in workflows]`

↓ ROOT CAUSE: The prefix `Path(".harness")` at `render.py:18` needs to be dropped entirely
Fix: `return Path(f"{workflow.id.removeprefix('wf_')}.sh")`

### Affected Files

| File                                        | Lines          | Action | Description                                                       |
| ------------------------------------------- | -------------- | ------ | ----------------------------------------------------------------- |
| `src/flowsh_cli/render.py`                  | 18-19          | UPDATE | Drop `.harness/` prefix in `harness_path`                        |
| `src/flowsh_cli/cli.py`                     | 191            | NO-OP  | `ensure_output_directory(output_path.parent)` stays; no-op on `.` |
| `.gitignore`                                | 18             | UPDATE | Remove `.harness/` entry                                          |
| `Makefile`                                  | 55             | UPDATE | Remove `.harness` from `clean` target                             |
| `README.md`                                 | 13, 69         | UPDATE | Update two documentation lines                                    |
| `tests/test_workflow_to_harness.py`         | multiple       | UPDATE | 49 path assertions; remove 2 obsolete tests; update 1 test        |

### Integration Points

- `src/flowsh_cli/__init__.py:4` exports `harness_path` — no change needed
- `scripts/workflow_to_harness.py:11` imports `harness_path` by name — no change needed
- `src/flowsh_cli/cli.py:162-193` `write_harnesses` is the sole call site for `harness_path` — transparent to loop logic
- `src/flowsh_cli/cli.py:196-202` `ensure_output_directory` — with flat paths, parent is `Path(".")`, which exists and is a real directory; `mkdir(parents=True, exist_ok=True)` is a silent no-op
- `src/flowsh_cli/cli.py:209-229` `write_executable` uses `output_path.parent` for the tempfile `dir=` argument — `Path(".")` resolves to CWD, which is valid
- `src/flowsh_cli/cli.py:232-240` `fsync_directory` called with `output_path.parent` — `Path(".")` is a valid directory descriptor target

### Git History

- **Introduced**: `63a2757` — original commit (`.harness/` convention from initial blueprint)
- **Never modified**: `harness_path` has not been changed since introduction
- **Implication**: Long-standing design; no regression concern, no deprecation period needed (not documented as stable API)

## Implementation Plan

### Step 1: Change `harness_path` in `render.py`

**File**: `src/flowsh_cli/render.py`
**Lines**: 18-19
**Action**: UPDATE

**Current code:**
```python
def harness_path(workflow: Workflow) -> Path:
    return Path(".harness") / f"{workflow.id.removeprefix('wf_')}.sh"
```

**Required change:**
```python
def harness_path(workflow: Workflow) -> Path:
    return Path(f"{workflow.id.removeprefix('wf_')}.sh")
```

**Why**: Removes the hard-coded `.harness/` subdirectory, producing flat paths like `example.sh`.

---

### Step 2: Remove `.harness/` from `.gitignore`

**File**: `.gitignore`
**Line**: 18
**Action**: DELETE the line `.harness/`

**Current file excerpt (lines 17-19):**
```
.env.*

.harness/
.flowsh/
```

**Required change** — delete line 18 so it becomes:
```
.env.*

.flowsh/
```

**Why**: The `.harness/` directory is no longer created. Generated scripts land flat in CWD; projects should be free to track them in VCS.

---

### Step 3: Remove `.harness` from `Makefile` clean target

**File**: `Makefile`
**Line**: 55
**Action**: UPDATE

**Current code:**
```makefile
	rm -rf .pytest_cache .ruff_cache .harness .flowsh src/flowsh_cli/__pycache__ scripts/__pycache__ tests/__pycache__ dist build
```

**Required change:**
```makefile
	rm -rf .pytest_cache .ruff_cache .flowsh src/flowsh_cli/__pycache__ scripts/__pycache__ tests/__pycache__ dist build
```

**Why**: `.harness` is no longer a default output directory.

---

### Step 4: Update `README.md` documentation

**File**: `README.md`
**Action**: UPDATE two lines

**Line 13 — current:**
```
That reads the workflow YAML at the path you provide and writes harnesses under `.harness/`.
```
**Line 13 — required:**
```
That reads the workflow YAML at the path you provide and writes harness scripts to the current working directory.
```

**Line 69 — current:**
```
Harness paths are derived from workflow ids. `wf_example` becomes `.harness/example.sh`.
```
**Line 69 — required:**
```
Harness paths are derived from workflow ids. `wf_example` becomes `example.sh` in the current working directory.
```

**Why**: Update user-facing documentation to reflect the new flat output behavior.

---

### Step 5: Update tests — mechanical path replacements

**File**: `tests/test_workflow_to_harness.py`
**Action**: UPDATE (bulk search-replace, then targeted fixes)

The implementation agent should make these changes using the exact line numbers below. Every `tmp_path / ".harness" / "NAME.sh"` becomes `tmp_path / "NAME.sh"`. Every `".harness/NAME.sh"` in string assertions becomes `"NAME.sh"`.

**5a. Line 76 — path assertion in `test_parse_workflows_accepts_blueprint_shape`:**
```python
# BEFORE:
    assert harness_path(workflows[0]) == Path(".harness/example.sh")
# AFTER:
    assert harness_path(workflows[0]) == Path("example.sh")
```

**5b. Line 810 — existence check in `test_cli_generates_and_refuses_overwrite`:**
```python
# BEFORE:
    output = tmp_path / ".harness" / "example.sh"
# AFTER:
    output = tmp_path / "example.sh"
```

**5c. Lines 845, 853 — read-back in `test_cli_generates_deterministic_harness_content`:**
```python
# BEFORE (line 845):
    first_content = (tmp_path / ".harness" / "example.sh").read_text(encoding="utf-8")
# AFTER:
    first_content = (tmp_path / "example.sh").read_text(encoding="utf-8")

# BEFORE (line 853):
    second_content = (tmp_path / ".harness" / "example.sh").read_text(encoding="utf-8")
# AFTER:
    second_content = (tmp_path / "example.sh").read_text(encoding="utf-8")
```

**5d. Lines 863-866 and 877 — `test_cli_force_overwrites_regular_file_atomically`:**
```python
# BEFORE:
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    output = harness_dir / "example.sh"
    output.write_text("old content\n", encoding="utf-8")
# AFTER:
    output = tmp_path / "example.sh"
    output.write_text("old content\n", encoding="utf-8")

# BEFORE (line 877):
    assert result.stdout == "Wrote .harness/example.sh\n"
# AFTER:
    assert result.stdout == "Wrote example.sh\n"
```

**5e. Lines 885-886, 889, 899 — `test_cli_force_replaces_output_symlink_without_following_it`:**
```python
# BEFORE:
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    target = tmp_path / "external-target.sh"
    target.write_text("external\n", encoding="utf-8")
    (harness_dir / "example.sh").symlink_to(target)
    ...
    output = harness_dir / "example.sh"
# AFTER:
    target = tmp_path / "external-target.sh"
    target.write_text("external\n", encoding="utf-8")
    (tmp_path / "example.sh").symlink_to(target)
    ...
    output = tmp_path / "example.sh"
```

**5f. Lines 924-927, 938-939 — `test_cli_preflights_overwrite_conflicts_before_writing_any_harness`:**
```python
# BEFORE:
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    existing = harness_dir / "second.sh"
    existing.write_text("existing\n", encoding="utf-8")
    ...
    assert "Refusing to overwrite existing file(s): .harness/second.sh" in result.stderr
    assert not (harness_dir / "first.sh").exists()
# AFTER:
    existing = tmp_path / "second.sh"
    existing.write_text("existing\n", encoding="utf-8")
    ...
    assert "Refusing to overwrite existing file(s): second.sh" in result.stderr
    assert not (tmp_path / "first.sh").exists()
```

**5g. Lines 946-948, 960 — `test_cli_refuses_to_overwrite_broken_symlink`:**
```python
# BEFORE:
    harness_dir = tmp_path / ".harness"
    harness_dir.mkdir()
    (harness_dir / "example.sh").symlink_to("missing-target.sh")
    ...
    assert (harness_dir / "example.sh").is_symlink()
# AFTER:
    (tmp_path / "example.sh").symlink_to("missing-target.sh")
    ...
    assert (tmp_path / "example.sh").is_symlink()
```

**5h. Lines 963-980 — REMOVE `test_cli_refuses_symlinked_harness_directory` entirely:**

This test creates a symlink at `.harness/` and verifies `ensure_output_directory` rejects it. With flat paths, `output_path.parent` is `Path(".")` (CWD), which is never a symlink in the test context. The guard is irrelevant and the test must be deleted.

**5i. Lines 983-997 — REMOVE `test_cli_refuses_file_at_harness_directory_path` entirely:**

This test creates a regular file named `.harness` and expects rejection of `ensure_output_directory`. With flat paths, no `.harness` directory is created; this scenario is impossible. The test must be deleted.

**5j. Lines 1000-1018 — UPDATE `test_cli_force_refuses_directory_at_harness_file_path`:**
```python
# BEFORE:
    output = tmp_path / ".harness" / "example.sh"
    output.mkdir(parents=True)
    ...
    assert "ERROR: Output path exists but is a directory: .harness/example.sh" in result.stderr
    ...
    assert output.is_dir()
# AFTER:
    output = tmp_path / "example.sh"
    output.mkdir()
    ...
    assert "ERROR: Output path exists but is a directory: example.sh" in result.stderr
    ...
    assert output.is_dir()
```

**5k. Line 1045 — `test_generated_harness_quotes_shell_relevant_labels`:**
```python
# BEFORE:
        ["bash", str(tmp_path / ".harness" / "shell_labels.sh")],
# AFTER:
        ["bash", str(tmp_path / "shell_labels.sh")],
```

**5l. Lines 1072-1073 — `test_typer_cli_exposes_help_and_dry_run`:**
```python
# BEFORE:
    assert "DRY-RUN would write .harness/example.sh" in dry_run.output
    assert not (tmp_path / ".harness" / "example.sh").exists()
# AFTER:
    assert "DRY-RUN would write example.sh" in dry_run.output
    assert not (tmp_path / "example.sh").exists()
```

**5m. Lines 1158, 1161 — `test_cli_dry_run_is_deterministic_across_repeated_runs`:**
```python
# BEFORE:
        == ("DRY-RUN would write .harness/example.sh for workflow 'Example Harness'\n")
    ...
    assert not (tmp_path / ".harness").exists()
# AFTER:
        == ("DRY-RUN would write example.sh for workflow 'Example Harness'\n")
    ...
    assert not (tmp_path / "example.sh").exists()
```

**5n. Lines 1173, 1186, 1254 — DO NOT CHANGE:**

These reference `shellScriptPath: .harness/legacy.sh` and `wf.shellScriptPath == ".harness/legacy.sh"`. The `shellScriptPath` field is an optional model attribute that the parser stores verbatim from the YAML (for compatibility). It is NOT consumed by `harness_path()` and does not affect the output path. These test cases validate model parsing and must remain unchanged.

**5o. Bulk replacements — lines 1304, 1347, 1402, 1466, 1542, 1603, 1656, 1697, 1737, 1772, 1814, 1853, 1888, 1923, 1959, 1994, 2032, 2073, 2147, 2163, 2180, 2199, 2215, 2377, 2428, 2615, 2666:**

All occurrences of `tmp_path / ".harness" / "NAME.sh"` → `tmp_path / "NAME.sh"` (where NAME is the script name at each location). These are all test harness execution paths where the CLI generates the file to `cwd=tmp_path` and the test then runs it directly.

Complete mapping:
| Line  | Before                                      | After                            |
| ----- | ------------------------------------------- | -------------------------------- |
| 1304  | `tmp_path / ".harness" / "bash_features.sh"` | `tmp_path / "bash_features.sh"` |
| 1347  | `tmp_path / ".harness" / "agent_features.sh"` | `tmp_path / "agent_features.sh"` |
| 1402  | `tmp_path / ".harness" / "agent_invocation.sh"` | `tmp_path / "agent_invocation.sh"` |
| 1466  | `tmp_path / ".harness" / "agent_options.sh"` | `tmp_path / "agent_options.sh"` |
| 1542  | `tmp_path / ".harness" / "agent_prompt_expand.sh"` | `tmp_path / "agent_prompt_expand.sh"` |
| 1603  | `tmp_path / ".harness" / "agent_prompt_literal.sh"` | `tmp_path / "agent_prompt_literal.sh"` |
| 1656  | `tmp_path / ".harness" / "dash_prompt.sh"` | `tmp_path / "dash_prompt.sh"` |
| 1697  | `tmp_path / ".harness" / "agent_missing.sh"` | `tmp_path / "agent_missing.sh"` |
| 1737  | `tmp_path / ".harness" / "agent_missing.sh"` | `tmp_path / "agent_missing.sh"` |
| 1772  | `tmp_path / ".harness" / "private_logs.sh"` | `tmp_path / "private_logs.sh"` |
| 1814  | `tmp_path / ".harness" / "log_symlink.sh"` | `tmp_path / "log_symlink.sh"` |
| 1853  | `tmp_path / ".harness" / "log_parent_symlink.sh"` | `tmp_path / "log_parent_symlink.sh"` |
| 1888  | `tmp_path / ".harness" / "absolute_log.sh"` | `tmp_path / "absolute_log.sh"` |
| 1923  | `tmp_path / ".harness" / "parent_log.sh"` | `tmp_path / "parent_log.sh"` |
| 1959  | `tmp_path / ".harness" / "log_create_failure.sh"` | `tmp_path / "log_create_failure.sh"` |
| 1994  | `tmp_path / ".harness" / "log_write_failure.sh"` | `tmp_path / "log_write_failure.sh"` |
| 2032  | `tmp_path / ".harness" / "fail_fast.sh"` | `tmp_path / "fail_fast.sh"` |
| 2073  | `tmp_path / ".harness" / "vars_fail_fast.sh"` | `tmp_path / "vars_fail_fast.sh"` |
| 2147  | `tmp_path / ".harness" / "test_param.sh"` | `tmp_path / "test_param.sh"` |
| 2163  | `tmp_path / ".harness" / "test_env.sh"` | `tmp_path / "test_env.sh"` |
| 2180  | `tmp_path / ".harness" / "test_required.sh"` | `tmp_path / "test_required.sh"` |
| 2199  | `tmp_path / ".harness" / "test_optional.sh"` | `tmp_path / "test_optional.sh"` |
| 2215  | `tmp_path / ".harness" / "test_dryrun_param.sh"` | `tmp_path / "test_dryrun_param.sh"` |
| 2377  | `tmp_path / ".harness" / "for_e2e.sh"` | `tmp_path / "for_e2e.sh"` |
| 2428  | `tmp_path / ".harness" / "for_dry.sh"` | `tmp_path / "for_dry.sh"` |
| 2615  | `tmp_path / ".harness" / "parallel_exec.sh"` | `tmp_path / "parallel_exec.sh"` |
| 2666  | `tmp_path / ".harness" / "parallel_fail.sh"` | `tmp_path / "parallel_fail.sh"` |

---

## Patterns to Follow

**From codebase — mirror these exactly:**

```python
# SOURCE: src/flowsh_cli/render.py:22-23
# Pattern: harness_path().name gives just the filename (unchanged after fix)
def render_harness(workflow: Workflow) -> str:
    script_name = harness_path(workflow).name
```

```python
# SOURCE: src/flowsh_cli/cli.py:162-163
# Pattern: write_harnesses iterates over harness_path() output
def write_harnesses(workflows: list[Workflow], *, dry_run: bool, force: bool) -> None:
    output_paths = [(workflow, harness_path(workflow)) for workflow in workflows]
```

```python
# SOURCE: src/flowsh_cli/cli.py:196-202
# Pattern: ensure_output_directory on Path(".") is a no-op (keep unchanged)
def ensure_output_directory(path: Path) -> None:
    if path.is_symlink():
        raise WorkflowParseError(f"Refusing to write through symlinked directory: {path}")
    if path.exists() and not path.is_dir():
        raise WorkflowParseError(f"Output path exists but is not a directory: {path}")
    path.mkdir(parents=True, exist_ok=True)
```

## Edge Cases & Risks

| Risk/Edge Case | Mitigation |
| --- | --- |
| Script name collision with pre-existing files in CWD | Existing overwrite guards in `write_harnesses` already handle this; `--force` flag required |
| `.gitignore` still silently ignores generated scripts | Removed in Step 2; scripts are now trackable by VCS |
| `make clean` no longer removes generated scripts | Removed in Step 3; users manage output scripts themselves |
| `ensure_output_directory(Path("."))` encounters a non-dir `.` | Impossible: CWD is always a real directory |
| `ensure_output_directory(Path("."))` encounters a symlinked `.` | Theoretically possible but extremely exotic; the guard still applies and will protect correctly |
| `write_executable` uses `dir=output_path.parent` = `dir=Path(".")` for tempfile | Resolves to CWD, which is valid for `NamedTemporaryFile` |
| Two tests removed weaken overall coverage | The guards they tested (`ensure_output_directory` on symlink/file) are still present in `cli.py`; coverage of those guards becomes indirect via the parent-path no-op, but the guards themselves are not removed and would fire for the forthcoming `--output` flag (#35) |

## Validation

### Automated Checks

```bash
make qa
```

This runs `ruff check`, `ruff format --check`, `py_compile`, `pytest`, and `uv build`. All must pass.

### Manual Verification

1. Run `python -m flowsh_cli path/to/workflows.yml` and confirm `example.sh` appears in CWD (not `.harness/example.sh`).
2. Run with `--dry-run` and confirm output reads `DRY-RUN would write example.sh` (not `.harness/example.sh`).
3. Run twice without `--force` and confirm overwrite-guard message uses `example.sh` (not `.harness/example.sh`).
4. Confirm `.harness/` directory is NOT created anywhere.

## Scope Boundaries

**IN SCOPE:**
- Change `harness_path` default from `.harness/[name].sh` to `[name].sh`
- Remove `.harness/` from `.gitignore`
- Remove `.harness` from `Makefile` clean target
- Update two `README.md` documentation lines
- Update all 49 test path assertions
- Remove 2 tests made obsolete by the change (`test_cli_refuses_symlinked_harness_directory`, `test_cli_refuses_file_at_harness_directory_path`)
- Update 1 test with new path (`test_cli_force_refuses_directory_at_harness_file_path`)

**OUT OF SCOPE (do not touch):**
- Issue #35 `--output` flag — do not implement here
- `src/flowsh_cli/cli.py` `ensure_output_directory` call — leave as-is (no-op for flat paths; needed for `--output`)
- `scripts/workflow_to_harness.py` — only imports `harness_path` by name; no changes needed
- `src/flowsh_cli/__init__.py` — exports unchanged
- `src/flowsh_cli/models.py` — `shellScriptPath` model field unrelated to `harness_path`
- Test assertions for `shellScriptPath` (lines 1173, 1186, 1254) — model parsing tests, not path generation
- Any deprecation period or migration notice

## Metadata

- **Investigated by**: issue-resolution-workflow
- **Timestamp**: 2026-06-23T00:00:00Z
- **Artifact**: `.agents/issues/issue-36.md`
