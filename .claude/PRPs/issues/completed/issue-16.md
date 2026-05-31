# Investigation: Support explicit runtime variable expansion in agent prompts

**Issue**: #16 (https://github.com/tbrandenburg/flowsh/issues/16)
**Type**: ENHANCEMENT
**Investigated**: 2026-05-31T09:00:35Z

### Assessment

| Metric     | Value  | Reasoning |
| ---------- | ------ | --------- |
| Priority   | MEDIUM | The enhancement enables workflows to pass values captured by existing `vars` steps into later `agent` prompts, but current safe literal prompt behavior still provides a workaround by moving dynamic shell usage into `bash` steps or writing explicit prompts manually. |
| Complexity | LOW    | The implementation is isolated to one schema field in `src/flowsh_cli/models.py`, one heredoc rendering branch in `src/flowsh_cli/render.py`, targeted tests in `tests/test_workflow_to_harness.py`, and README documentation. |
| Confidence | HIGH   | The root behavior is directly evidenced by `render.py:251` always using a quoted heredoc delimiter and `models.py:35-36` rejecting unknown fields, with existing tests already covering generated agent invocation patterns. |

---

## Problem Statement

Flowsh currently preserves agent prompts literally by rendering them through a single-quoted Bash heredoc delimiter. That keeps prompts safe by default, but it prevents opted-in workflows from expanding runtime shell variables captured by earlier `vars` steps, such as `$ISSUE_NUMBER`, inside `agent.prompt` content. Add an explicit `expandPrompt: true` field for `agent` steps so only opted-in prompts use an unquoted heredoc delimiter and therefore receive normal Bash expansion at harness runtime.

---

## Analysis

### Root Cause / Change Rationale

This is an enhancement, not a regression. The current implementation intentionally quotes prompt heredoc delimiters to prevent Bash from expanding `$HOME`, `${VAR}`, backticks, and `$(...)` before OpenCode receives the prompt. The requested change should preserve that default while adding a narrow opt-in field because runtime values from `vars` are exported for later steps, but `agent.prompt` construction currently prevents those exported variables from being expanded.

### Evidence Chain

WHY: `agent.prompt` receives literal `$ISSUE_NUMBER` instead of a value captured by a previous `vars` step.
↓ BECAUSE: Agent prompt heredocs are always rendered with a single-quoted delimiter.
Evidence: `src/flowsh_cli/render.py:246-256`

```python
elif isinstance(step, AgentStep):
    delimiter = heredoc_delimiter("PROMPT", step.prompt)
    lines.extend(
        [
            "  local prompt",
            f"  prompt=$(cat <<'{delimiter}'",
            *step.prompt.splitlines(),
            delimiter,
            "  )",
        ]
    )
```

↓ BECAUSE: Bash does not perform parameter expansion or command substitution inside `<<'PROMPT_EOF'` heredocs.
Evidence: The generated line above is the exact quoted heredoc form; the issue body also shows the current generated shell as `prompt=$(cat <<'PROMPT_EOF' ... )`.

↓ BECAUSE: There is no schema field that lets an agent step choose a different prompt heredoc mode.
Evidence: `src/flowsh_cli/models.py:66-85`

```python
class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None

    @field_validator("prompt", "agent")
    @classmethod
    def validate_strings(cls, value: str | None) -> str | None:
        if value is not None and value.strip() == "":
            raise ValueError("must not be empty")
        if value is not None and has_unsafe_control_characters(value):
            raise ValueError("must not contain unsafe control characters")
        return value
```

↓ ROOT CAUSE: `AgentStep` has no optional `expandPrompt` boolean, and `render_step()` has no conditional path to render unquoted prompt heredocs for opted-in agent steps.
Evidence: `src/flowsh_cli/models.py:35-36` forbids unknown fields, so `expandPrompt` is currently rejected instead of parsed.

```python
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
```

### Affected Files

| File | Lines | Action | Description |
| ---- | ----- | ------ | ----------- |
| `src/flowsh_cli/models.py` | 66-70 | UPDATE | Add `expandPrompt: bool = False` to `AgentStep` so the field is optional and safe by default. |
| `src/flowsh_cli/render.py` | 246-256 | UPDATE | Render unquoted prompt heredoc delimiter only when `step.expandPrompt` is true; keep existing quoted delimiter otherwise. |
| `tests/test_workflow_to_harness.py` | 56-64, 1025-1083 | UPDATE | Add parse/render/runtime tests mirroring existing workflow and fake `opencode` patterns. |
| `README.md` | 29-31, 95-99 | UPDATE | Document the optional field, default behavior, and shell expansion security warning. |

### Integration Points

- `src/flowsh_cli/models.py:158-175` parses YAML into strict Pydantic models before rendering.
- `src/flowsh_cli/render.py:215-267` dispatches step rendering based on `VarsStep`, `BashStep`, and `AgentStep`.
- `src/flowsh_cli/render.py:220-235` exports values from `vars` steps for later harness steps.
- `src/flowsh_cli/render.py:173-194` invokes OpenCode as `opencode run --format json ... -- "$prompt"`, so prompt expansion only affects prompt construction, not CLI flag parsing.
- `src/flowsh_cli/cli.py:70-76` converts parse failures into deterministic CLI errors.
- `pyproject.toml:27-28` exposes the package CLI as `flowsh-cli = "flowsh_cli.cli:main"`.

### Git History

- **Introduced**: `b832c19` - 2026-05-16 19:04:37 +0200 - "feat: use Typer for flowsh CLI"
- **Hardened**: `e761f8a` - 2026-05-16 23:28:56 +0200 - "feat: harden flowsh harness generation"
- **Last package rename**: `63a2757` - 2026-05-30 11:40:57 +0200 - "chore: rename package to flowsh-cli for PyPI publishing"
- **Implication**: The quoted prompt heredoc appears to be original behavior from the Python CLI implementation and should be treated as a deliberate safe default, not a bug to globally remove.

---

## Implementation Plan

### Step 1: Add `expandPrompt` to the agent step schema

**File**: `src/flowsh_cli/models.py`
**Lines**: 66-70
**Action**: UPDATE

**Current code:**

```python
class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None
```

**Required change:**

```python
class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None
    expandPrompt: bool = False
```

**Why**: This preserves existing behavior for workflows that omit the field while allowing strict YAML validation to accept `expandPrompt: true` as an explicit opt-in.

**Important details:**

- Do not add compatibility aliases such as `expand_prompt`; the issue requests `expandPrompt` and the repo uses strict schema validation.
- Do not relax `StrictModel`; unknown fields should remain rejected.
- Because `ConfigDict(strict=True)` is enabled at `models.py:35-36`, non-boolean YAML values such as `expandPrompt: "true"` should remain invalid.

---

### Step 2: Conditionally render the agent prompt heredoc delimiter

**File**: `src/flowsh_cli/render.py`
**Lines**: 246-256
**Action**: UPDATE

**Current code:**

```python
elif isinstance(step, AgentStep):
    delimiter = heredoc_delimiter("PROMPT", step.prompt)
    lines.extend(
        [
            "  local prompt",
            f"  prompt=$(cat <<'{delimiter}'",
            *step.prompt.splitlines(),
            delimiter,
            "  )",
        ]
    )
```

**Required change:**

```python
elif isinstance(step, AgentStep):
    delimiter = heredoc_delimiter("PROMPT", step.prompt)
    heredoc = f"<<{delimiter}" if step.expandPrompt else f"<<'{delimiter}'"
    lines.extend(
        [
            "  local prompt",
            f"  prompt=$(cat {heredoc}",
            *step.prompt.splitlines(),
            delimiter,
            "  )",
        ]
    )
```

**Why**: An unquoted heredoc delimiter enables Bash runtime parameter expansion for opted-in prompts, while the quoted delimiter remains the unchanged default for safe literal prompts.

**Important details:**

- Do not change `vars` or `bash` heredoc rendering.
- Do not change `run_agent()` argument passing at `render.py:173-194`; it already safely passes the final prompt as one argument after `--`.
- Keep using `heredoc_delimiter("PROMPT", step.prompt)` so delimiter collision avoidance remains unchanged.

---

### Step 3: Add parse and render regression tests

**File**: `tests/test_workflow_to_harness.py`
**Action**: UPDATE

**Test cases to add:**

```python
def test_parse_workflows_accepts_agent_expand_prompt_boolean(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_expand_prompt
    name: Expand Prompt
    steps:
      - type: agent
        expandPrompt: true
        prompt: Work on issue $ISSUE_NUMBER.
""".lstrip(),
        encoding="utf-8",
    )

    workflows = parse_workflows(workflow_file)

    assert workflows[0].steps[0].expandPrompt is True
```

```python
def test_parse_workflows_rejects_agent_expand_prompt_string(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_expand_prompt
    name: Expand Prompt
    steps:
      - type: agent
        expandPrompt: "true"
        prompt: Work on issue $ISSUE_NUMBER.
""".lstrip(),
        encoding="utf-8",
    )

    with pytest.raises(WorkflowParseError) as error:
        parse_workflows(workflow_file)

    assert "expandPrompt" in str(error.value)
```

```python
def test_render_harness_quotes_agent_prompt_heredoc_by_default() -> None:
    workflow = Workflow(
        id="wf_prompt_default",
        name="Prompt Default",
        steps=[AgentStep(type="agent", prompt="Work on issue $ISSUE_NUMBER.")],
    )

    script = render_harness(workflow)

    assert "prompt=$(cat <<'PROMPT_EOF'" in script
    assert "prompt=$(cat <<PROMPT_EOF" not in script
```

```python
def test_render_harness_unquotes_agent_prompt_heredoc_when_expand_prompt_enabled() -> None:
    workflow = Workflow(
        id="wf_prompt_expand",
        name="Prompt Expand",
        steps=[
            AgentStep(
                type="agent",
                prompt="Work on issue $ISSUE_NUMBER.",
                expandPrompt=True,
            )
        ],
    )

    script = render_harness(workflow)

    assert "prompt=$(cat <<PROMPT_EOF" in script
    assert "prompt=$(cat <<'PROMPT_EOF'" not in script
```

**Why**: These tests lock down both the schema default and the generated shell difference that implements the feature.

---

### Step 4: Add runtime harness tests using fake `opencode`

**File**: `tests/test_workflow_to_harness.py`
**Action**: UPDATE

**Pattern to mirror:**

```python
# SOURCE: tests/test_workflow_to_harness.py:1025-1083
def test_generated_harness_invokes_opencode_with_agent_and_prompt(tmp_path: Path) -> None:
    workflow_file = tmp_path / "workflows.yml"
    workflow_file.write_text(
        """
workflows:
  - id: wf_agent_invocation
    name: Agent Invocation
    steps:
      - type: agent
        name: Ask OpenCode
        agent: general
        prompt: |
          Inspect the current repository.
""".lstrip(),
        encoding="utf-8",
    )
```

**Test cases to add:**

```python
def test_generated_harness_expands_agent_prompt_when_expand_prompt_enabled(tmp_path: Path) -> None:
    # Build a workflow with vars -> agent, generate harness, run with fake opencode,
    # and assert the captured prompt is "Work on issue 16.".
```

Workflow YAML for the test:

```yaml
workflows:
  - id: wf_agent_prompt_expand
    name: Agent Prompt Expand
    steps:
      - type: vars
        name: Capture issue
        values:
          ISSUE_NUMBER: printf '16'
      - type: agent
        name: Ask OpenCode
        expandPrompt: true
        prompt: |
          Work on issue $ISSUE_NUMBER.
```

Expected captured prompt:

```text
Work on issue 16.
```

```python
def test_generated_harness_keeps_agent_prompt_literal_by_default(tmp_path: Path) -> None:
    # Same workflow shape without expandPrompt, assert captured prompt is
    # "Work on issue $ISSUE_NUMBER.".
```

Expected captured prompt:

```text
Work on issue $ISSUE_NUMBER.
```

**Why**: Render-only tests prove the shell text changed, but runtime tests prove the generated harness actually expands exported values only when opted in.

---

### Step 5: Update README documentation and warning

**File**: `README.md`
**Lines**: 29-31, 95-99
**Action**: UPDATE

**Current code:**

```markdown
Supported step types are only `vars`, `bash`, and `agent`.

The input path must be a regular file no larger than 1 MiB. The input file must be valid UTF-8, non-empty YAML with a mapping root, no duplicate mapping keys, and no YAML aliases. Workflow and step names are single-line labels. Executable fields reject unsafe control bytes while allowing normal newlines and tabs. `vars` keys must be uppercase shell variable names, and `agent` names may contain only letters, digits, `_`, and `-`.
```

**Required change:**

Add a short subsection after the supported YAML example or after the validation paragraph:

````markdown
Agent prompts are literal by default. Set `expandPrompt: true` on an `agent` step only when the prompt should be expanded by Bash at harness runtime, for example to insert values exported by earlier `vars` steps:

```yaml
- type: agent
  name: Fix captured issue
  agent: general
  expandPrompt: true
  prompt: |
    Follow issue #$ISSUE_NUMBER.
```

`expandPrompt: true` is a security-sensitive opt-in: Bash also performs command substitution such as `$(...)` and backticks in the prompt body before OpenCode receives it. Keep it disabled for prompts that contain shell examples or untrusted content.
````

Also update the generated harness behavior paragraph to mention that `agent` prompt heredocs are quoted by default and unquoted only when `expandPrompt: true` is set.

**Why**: The feature is intentionally security-sensitive; the warning is part of the acceptance criteria.

---

## Patterns to Follow

**Strict optional schema field:**

```python
# SOURCE: src/flowsh_cli/models.py:39-40
class BaseStep(StrictModel):
    name: str | None = None
```

```python
# SOURCE: src/flowsh_cli/models.py:66-69
class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None
```

**Heredoc delimiter collision handling:**

```python
# SOURCE: src/flowsh_cli/render.py:314-320
def heredoc_delimiter(base: str, text: str) -> str:
    delimiter = f"{base}_EOF"
    counter = 1
    while delimiter in text:
        counter += 1
        delimiter = f"{base}_EOF_{counter}"
    return delimiter
```

**Runtime fake `opencode` test pattern:**

```python
# SOURCE: tests/test_workflow_to_harness.py:1050-1059
fake_opencode = bin_dir / "opencode"
fake_opencode.write_text(
    """#!/usr/bin/env bash
printf '%s\n' "$@" > "$OPENCODE_ARGS_CAPTURE"
printf '%s' "${@: -1}" > "$OPENCODE_PROMPT_CAPTURE"
printf '{"ok":true}\n'
""",
    encoding="utf-8",
)
fake_opencode.chmod(0o700)
```

---

## Edge Cases & Risks

| Risk/Edge Case | Mitigation |
| -------------- | ---------- |
| Existing prompts containing `$HOME`, `${VAR}`, `$(...)`, or backticks could change behavior if expansion were global. | Keep the default quoted heredoc unchanged and require explicit `expandPrompt: true`. |
| `expandPrompt: true` can execute command substitutions in prompt text before OpenCode receives it. | Document the risk prominently in README and keep the field opt-in. |
| Users may write `expandPrompt: "true"` as a string. | Preserve strict boolean validation and add a rejection test. |
| Heredoc delimiter appears in prompt content. | Continue using `heredoc_delimiter("PROMPT", step.prompt)` unchanged. |
| Expanded prompt starts with `--` after variable expansion. | Keep `run_agent()` passing the prompt after `--` as one quoted argument. |
| Values from `vars` may contain newlines or spaces. | Rely on Bash heredoc expansion into the `prompt` variable and existing quoted `run_agent "$prompt"` call; add runtime tests for basic captured variable expansion. |

---

## Validation

### Automated Checks

```bash
make qa
```

For faster local iteration before the full QA run:

```bash
uv run pytest tests/test_workflow_to_harness.py
uv run ruff check .
uv run python -m compileall src scripts tests
```

### Manual Verification

1. Create a workflow with `vars` setting `ISSUE_NUMBER: printf '16'` and an `agent` step using `expandPrompt: true` with `prompt: Work on issue $ISSUE_NUMBER.`.
2. Generate the harness and inspect that the agent prompt uses `prompt=$(cat <<PROMPT_EOF` without quotes.
3. Run the harness with a fake `opencode` and verify the captured prompt is `Work on issue 16.`.
4. Remove `expandPrompt: true`, regenerate, and verify the prompt heredoc returns to `prompt=$(cat <<'PROMPT_EOF'` and the captured prompt remains `Work on issue $ISSUE_NUMBER.`.

---

## Scope Boundaries

**IN SCOPE:**

- Add optional `expandPrompt: bool = False` to `agent` steps.
- Use an unquoted prompt heredoc delimiter only for `agent` steps with `expandPrompt: true`.
- Add tests for schema acceptance/rejection, default literal behavior, and opted-in runtime expansion.
- Update README with default behavior and security warning.

**OUT OF SCOPE (do not touch):**

- Do not reintroduce TypeScript implementation, templates, DSL explorer, plugin registry, or extra workflow node types.
- Do not change supported step types beyond `vars`, `bash`, and `agent`.
- Do not alter `bash` or `vars` heredoc behavior.
- Do not add alternative templating syntax such as `${{ vars.ISSUE_NUMBER }}`.
- Do not add backward-compatible aliases like `expand_prompt` unless a future issue explicitly requests them.
- Do not change OpenCode invocation away from `opencode run --format json`.

---

## Metadata

- **Investigated by**: Claude
- **Timestamp**: 2026-05-31T09:00:35Z
- **Artifact**: `.claude/PRPs/issues/issue-16.md`
