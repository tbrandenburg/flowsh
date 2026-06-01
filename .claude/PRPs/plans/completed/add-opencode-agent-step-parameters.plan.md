# Feature: Add OpenCode Agent Step Parameters

## Summary

Add first-class flowsh YAML support for the currently unsupported OpenCode `opencode run` parameters `--model`, `--command`, and `--dangerously-skip-permissions` on existing `agent` steps. The implementation should extend the current strict Pydantic `AgentStep` model, preserve the generated Bash array command pattern, keep prompt handling unchanged, and update tests and README to document the new harness contract.

## User Story

As a flowsh workflow author
I want agent steps to pass OpenCode model, custom command, and dangerous permission-skip options
So that generated harnesses can express the same non-interactive OpenCode execution controls I would use manually.

## Problem Statement

Flowsh currently renders `agent` steps as `opencode run --format json [--agent <agent>] -- <prompt>`. Workflows cannot select a model, invoke an OpenCode custom command, or opt into OpenCode's documented dangerous permission auto-approval flag from YAML. Because the YAML models are strict, adding `model`, `command`, or dangerous permission fields today fails validation instead of producing the intended OpenCode invocation.

## Solution Statement

Extend only the existing `agent` step surface. Add strict optional fields to `AgentStep`, validate them with the same non-empty/control-character rules already used for prompt-like strings, support both `dangerouslySkipPermissions` and `dangerously-skip-permissions` as input spellings for one boolean, and render the new OpenCode flags in the existing Bash array before the `--` prompt sentinel.

## Metadata

| Field | Value |
| --- | --- |
| Type | ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | YAML schema/parsing, harness rendering, tests, README |
| Dependencies | Existing only: PyYAML>=6,<7, pydantic>=2,<3, typer>=0.20,<0.21, pytest>=8,<9, ruff>=0.14,<0.15 |
| Estimated Tasks | 6 |
| **Research Timestamp** | **2026-05-31T12:40:00Z** |

---

## UX Design

### Before State

```text
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │ Workflow    │ ──────► │ flowsh      │ ──────► │ Harness     │            ║
║   │ agent step  │         │ generate    │         │ opencode    │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║          │                                                 │                 ║
║          │ agent + prompt only                             ▼                 ║
║          └──────────────────────────────────────► opencode run --format json ║
║                                                      [--agent A] -- prompt    ║
║                                                                               ║
║   USER_FLOW: Author can choose an OpenCode agent and prompt only.             ║
║   PAIN_POINT: model, command, and permission-skip options are rejected.        ║
║   DATA_FLOW: YAML -> strict AgentStep -> render_step -> run_agent Bash array. ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```text
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │ Workflow    │ ──────► │ flowsh      │ ──────► │ Harness     │            ║
║   │ agent step  │         │ generate    │         │ opencode    │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║          │                                                 │                 ║
║          │ agent + model + command + dangerous flag        ▼                 ║
║          └──────────────────────────────────────► opencode run --format json ║
║                                                      [--agent A]             ║
║                                                      [--model P/M]           ║
║                                                      [--command C]           ║
║                                                      [--dangerously-...]     ║
║                                                      -- prompt               ║
║                                                                               ║
║   USER_FLOW: Author expresses OpenCode run controls directly in YAML.         ║
║   VALUE_ADD: Generated harnesses match documented OpenCode non-interactive    ║
║   usage without requiring manual Bash wrapper edits.                          ║
║   DATA_FLOW: YAML -> strict AgentStep fields -> render_step locals ->         ║
║   run_agent Bash array flags before prompt sentinel.                          ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
| --- | --- | --- | --- |
| `.made/workflows.yml` agent step | Supports `agent`, `prompt`, `expandPrompt` | Also supports `model`, `command`, `dangerouslySkipPermissions` and `dangerously-skip-permissions` | Workflow authors can control OpenCode model, command, and permission bypass per step. |
| Generated `.harness/*.sh` | Emits `opencode run --format json [--agent] -- prompt` | Emits optional new flags before `-- prompt` | Harness behavior matches documented OpenCode CLI options. |
| `flowsh-cli --schema` | New fields absent | New fields appear in JSON Schema | Users can discover supported YAML from schema output. |
| README supported YAML | Documents only `agent` and `expandPrompt` | Documents new options and safety warning | Users understand normal and dangerous usage. |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
| --- | --- | --- | --- |
| P0 | `src/flowsh_cli/models.py` | 35-86 | Strict model pattern and current `AgentStep` validation to mirror. |
| P0 | `src/flowsh_cli/render.py` | 173-194, 246-262 | Exact OpenCode command composition and agent step rendering to extend. |
| P0 | `tests/test_workflow_to_harness.py` | 68-106, 1137-1169 | Existing parse and fake-OpenCode argv test patterns to mirror. |
| P1 | `README.md` | 5-45, 113-117 | Supported YAML and generated harness contract to update. |
| P1 | `Makefile` | 32-44 | Governed validation commands. |
| P2 | `pyproject.toml` | 17-34, 39-44 | Dependency and lint/test configuration. |

**Current External Documentation (Verified Live):**

| Source | Section | Why Needed | Last Verified |
| --- | --- | --- | --- |
| [OpenCode CLI](https://opencode.ai/docs/cli/#run-1) ✓ Current | `opencode run` flags | Confirms `--command`, `--model`, `--agent`, `--format`, and `--dangerously-skip-permissions` are valid run flags. | 2026-05-31 |
| [OpenCode Models](https://opencode.ai/docs/models/#loading-models) ✓ Current | Loading models | Confirms `--model` uses `provider/model` format and has highest model priority. | 2026-05-31 |
| [OpenCode Commands](https://opencode.ai/docs/commands/#options) ✓ Current | Command options | Confirms command-level model/agent behavior and command semantics. | 2026-05-31 |
| [OpenCode Permissions](https://opencode.ai/docs/permissions/) ✓ Current | Actions and defaults | Confirms permission semantics and why dangerous skip must be explicit. | 2026-05-31 |
| [Pydantic v2 AliasChoices](https://docs.pydantic.dev/latest/concepts/alias/) ✓ Context7 | `AliasChoices`, `validation_alias` | Confirms multiple input aliases can map to one field. | 2026-05-31 |
| [PyPI JSON API](https://pypi.org/pypi/pydantic/json) ✓ Current | Package info/vulnerabilities | Confirms latest pydantic 2.13.4 and zero PyPI-reported vulnerabilities at check time. | 2026-05-31 |

---

## Patterns to Mirror

**NAMING_CONVENTION:**

```python
# SOURCE: src/flowsh_cli/models.py:66-70
# COPY THIS PATTERN:
class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None
    expandPrompt: bool = False
```

Use Python `snake_case` for internal functions, PascalCase for Pydantic classes, and existing YAML field style for user-facing fields. New user-facing fields should be `model`, `command`, and `dangerouslySkipPermissions`, with `dangerously-skip-permissions` accepted as an alias for the OpenCode flag spelling.

**ERROR_HANDLING:**

```python
# SOURCE: src/flowsh_cli/models.py:173-176
# COPY THIS PATTERN:
try:
    return WorkflowFile.model_validate(data).workflows
except ValidationError as error:
    raise WorkflowParseError(format_validation_error(error)) from error
```

```python
# SOURCE: src/flowsh_cli/models.py:187-198
# COPY THIS PATTERN:
def format_validation_error(error: ValidationError) -> str:
    messages: list[str] = []
    for item in error.errors(include_url=False, include_input=False, include_context=False):
        location = ".".join(str(part) for part in item["loc"])
        message = str(item["msg"])
        if location:
            messages.append(f"{location}: {message}")
            continue

        messages.append(message)

    return "Invalid workflow YAML: " + "; ".join(messages)
```

Keep validation failures sanitized with `include_input=False` so prompts, model names, or command args are not echoed into error messages.

**LOGGING_PATTERN:**

```python
# SOURCE: src/flowsh_cli/render.py:183-185
# COPY THIS PATTERN:
'  if [[ "$DRY_RUN" == true ]]; then',
'    log INFO "[DRY-RUN] would run: $(printf \'%q \' "${cmd[@]}") (with prompt)"',
'    return 0',
```

Do not log prompt contents. The dry run should continue logging only the shell-quoted command array plus `(with prompt)`.

**REPOSITORY_PATTERN:**

```python
# SOURCE: AGENTS.md:5-10
# COPY THIS SCOPE LIMIT:
- Keep the product surface limited to the existing Python blueprint.
- Do not reintroduce the TypeScript implementation, workflow templates, DSL explorer, plugin registry, or extra workflow node types.
- Supported step types are only `vars`, `bash`, and `agent`.
- Generated agent steps must continue to target the OpenCode CLI only.
```

No repository/database layer exists. The equivalent architecture pattern is to extend the current Python blueprint in place and avoid adding step types or legacy systems.

**SERVICE_PATTERN:**

```python
# SOURCE: src/flowsh_cli/render.py:178-193
# COPY THIS PATTERN:
"  local cmd=(opencode run --format json)",
'  if [[ -n "$agent" ]]; then',
'    cmd+=(--agent "$agent")',
"  fi",
...
'  "${cmd[@]}" -- "$prompt"',
```

Append new flags to the Bash array before the `--` sentinel. Never construct a single command string.

**TEST_STRUCTURE:**

```python
# SOURCE: tests/test_workflow_to_harness.py:68-85
# COPY THIS PATTERN:
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
# SOURCE: tests/test_workflow_to_harness.py:1137-1145
# COPY THIS FAKE OPENCODE PATTERN:
fake_opencode.write_text(
    """#!/usr/bin/env bash
printf '%s\n' "$@" > "$OPENCODE_ARGS_CAPTURE"
printf '%s' "${@: -1}" > "$OPENCODE_PROMPT_CAPTURE"
printf '{"ok":true}\n'
""",
    encoding="utf-8",
)
```

---

## Current Best Practices Validation

**Security (Context7 MCP and Live Docs Verified):**

- [x] Dangerous permission bypass remains opt-in and is not inferred from `permission` config.
- [x] Prompt content remains after `--`, preventing dash-prefixed prompts from becoming OpenCode flags.
- [x] Bash array composition and `bash_quote` usage avoid shell string interpolation vulnerabilities.
- [x] Pydantic validation errors remain sanitized with no input echo.

**Performance (Web Intelligence Verified):**

- [x] No runtime dependency or data structure change that affects scaling.
- [x] Bash array appends are constant-time and negligible compared with OpenCode execution.
- [x] No database, network, caching, or UI performance path exists in this CLI blueprint.

**Community Intelligence:**

- [x] OpenCode docs last updated May 31, 2026 confirm current flags.
- [x] Pydantic v2 docs confirm `AliasChoices` for multiple accepted input keys.
- [x] PyPI package metadata checked for existing dependencies; no new package needed.
- [x] No deprecated flowsh pattern identified; legacy `tools` permission config is irrelevant because flowsh only passes OpenCode CLI flags.

---

## Files to Change

| File | Action | Justification |
| --- | --- | --- |
| `src/flowsh_cli/models.py` | UPDATE | Add strict `AgentStep` fields and validation for `model`, `command`, and dangerous permission alias. |
| `src/flowsh_cli/render.py` | UPDATE | Render new OpenCode flags in generated Bash array before the prompt sentinel. |
| `tests/test_workflow_to_harness.py` | UPDATE | Add parser, schema, rendering, and harness execution tests for new flags and safety edge cases. |
| `README.md` | UPDATE | Document supported YAML fields and security-sensitive dangerous permission behavior. |

---

## NOT Building (Scope Limits)

Explicit exclusions to prevent scope creep:

- No new step type. `vars`, `bash`, and `agent` remain the only supported step types per `AGENTS.md`.
- No TypeScript implementation, workflow template system, DSL explorer, plugin registry, or extra node types.
- No validation that an OpenCode model ID or command file exists locally; flowsh should pass values through to OpenCode, as it currently does for `agent`.
- No OpenCode permission configuration generation. The dangerous field only emits the documented `opencode run --dangerously-skip-permissions` flag.
- No prompt templating beyond existing `expandPrompt` behavior.
- No dependency additions.

---

## Architecture Invariants

- Workflow YAML remains strictly validated before rendering; unknown fields continue to fail.
- Supported step types remain `vars`, `bash`, and `agent` only.
- Generated agent steps continue to target `opencode run` only.
- All OpenCode flags are rendered before `--`; prompt content is always rendered after `--`.
- Omitted optional fields do not alter the generated command.
- Boolean fields remain strict booleans; strings such as `"true"` must fail.
- Dangerous permission skipping is false by default and only emitted when explicitly true.
- Harness dry-runs must not expose prompt content.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

After each task: run at least the listed validation command. After code changes are complete, run `make qa`.

### Task 1: UPDATE `src/flowsh_cli/models.py` with new `AgentStep` fields

- **ACTION**: ADD optional fields to `AgentStep`.
- **IMPLEMENT**: Add `model: str | None = None`, `command: str | None = None`, and a boolean field that accepts `dangerouslySkipPermissions` and `dangerously-skip-permissions` input spellings.
- **MIRROR**: `src/flowsh_cli/models.py:66-86` for field placement and validators.
- **IMPORTS**: Use existing Pydantic imports plus `AliasChoices` if implementing via `Field(validation_alias=AliasChoices(...))`; use a model-level validator only if needed to reject ambiguous dual spelling.
- **GOTCHA**: `model` values commonly contain `/`, so do not reuse the `agent` regex validator for `model`.
- **GOTCHA**: If both dangerous aliases are present, prefer explicit rejection over silent priority because duplicate semantic keys are ambiguous. Pydantic `AliasChoices` alone prioritizes earlier aliases.
- **CURRENT**: Pydantic v2 `AliasChoices` and `validation_alias` verified through Context7.
- **VALIDATE**: `make lint`
- **FUNCTIONAL**: `uv run --locked python -m py_compile src/flowsh_cli/*.py scripts/*.py tests/test_workflow_to_harness.py`
- **TEST_PYRAMID**: Unit parser tests will be added in Task 3.

### Task 2: UPDATE `src/flowsh_cli/render.py` command composition

- **ACTION**: EXTEND generated `run_agent()` and `render_step()` agent branch.
- **IMPLEMENT**: Accept optional `agent`, `model`, `command`, and dangerous flag in generated Bash. Append `--agent`, `--model`, `--command`, and `--dangerously-skip-permissions` to `cmd` before `-- "$prompt"`.
- **MIRROR**: `src/flowsh_cli/render.py:173-194` and `src/flowsh_cli/render.py:246-262`.
- **IMPORTS**: No new Python import should be needed unless a helper is introduced; prefer no helper unless it reduces repeated argument plumbing clearly.
- **GOTCHA**: Keep `"${cmd[@]}" -- "$prompt"` unchanged in spirit so prompts beginning with `--help` remain message content.
- **GOTCHA**: Use `bash_quote` for emitted string locals; do not write raw YAML values into shell source.
- **CURRENT**: OpenCode CLI `opencode run` flags verified live.
- **VALIDATE**: `make lint`
- **FUNCTIONAL**: Generate a sample harness in a temporary test via pytest in Task 4; do not manually run untracked harnesses unless needed.
- **TEST_PYRAMID**: Rendering and harness argv tests will be added in Task 4.

### Task 3: UPDATE parser and schema tests in `tests/test_workflow_to_harness.py`

- **ACTION**: ADD tests for parsing and validation.
- **IMPLEMENT**: Test `model`, `command`, `dangerouslySkipPermissions: true`, `dangerously-skip-permissions: true`, omitted defaults, string boolean rejection, empty string rejection, unsafe control character rejection, and ambiguous dual dangerous aliases if implemented.
- **MIRROR**: `tests/test_workflow_to_harness.py:68-106` for accepted/rejected bool patterns.
- **GOTCHA**: Because `StrictModel` has `strict=True`, `dangerouslySkipPermissions: "true"` must remain invalid.
- **CURRENT**: Pydantic `extra_forbidden` behavior verified; unknown fields should remain rejected.
- **VALIDATE**: `uv run --locked pytest tests/test_workflow_to_harness.py -q`
- **FUNCTIONAL**: `uv run --locked flowsh-cli --schema` should include the new supported fields.
- **TEST_PYRAMID**: Unit tests for parser validation and schema exposure.

### Task 4: UPDATE rendering and fake-OpenCode harness execution tests

- **ACTION**: ADD exact argv tests for generated harnesses.
- **IMPLEMENT**: Use fake `opencode` script to capture args and assert exact ordering:
  `run`, `--format`, `json`, `--agent`, `general`, `--model`, `provider/model`, `--command`, `review`, `--dangerously-skip-permissions`, `--`, `prompt`.
- **MIRROR**: `tests/test_workflow_to_harness.py:1137-1169` fake executable and capture assertions.
- **GOTCHA**: Also assert omitted fields preserve the current existing argv to prevent regressions.
- **CURRENT**: OpenCode docs specify `--command` uses message as args, so keeping prompt after `--` is correct.
- **VALIDATE**: `uv run --locked pytest tests/test_workflow_to_harness.py -q`
- **FUNCTIONAL**: The fake executable test is the functional validation for generated Bash without requiring real OpenCode credentials.
- **TEST_PYRAMID**: Integration-style harness execution test covering generated script behavior.

### Task 5: UPDATE `README.md`

- **ACTION**: DOCUMENT new YAML fields and generated command contract.
- **IMPLEMENT**: Add `model`, `command`, and dangerous permission examples to Supported YAML; update line describing generated `agent` invocations.
- **MIRROR**: `README.md:5-45` for YAML examples and `README.md:113-117` for generated harness behavior.
- **GOTCHA**: Clearly label `dangerouslySkipPermissions` as security-sensitive and false by default.
- **CURRENT**: OpenCode docs describe dangerous skip as “Auto-approve permissions that are not explicitly denied (dangerous!)”.
- **VALIDATE**: `make lint`
- **FUNCTIONAL**: `uv run --locked flowsh-cli --help` should remain unchanged unless tests intentionally update help contract, which this feature should not require.
- **TEST_PYRAMID**: Documentation-only; covered by full test suite for CLI contract.

### Task 6: RUN full validation

- **ACTION**: RUN governed QA.
- **IMPLEMENT**: Execute `make qa`.
- **MIRROR**: `AGENTS.md:12-16` and `Makefile:43-44`.
- **GOTCHA**: Do not report completion without command evidence. If `make qa` fails, fix root cause before reporting success.
- **CURRENT**: No dependency versions need to be changed; PyPI advisories for current dependency families returned zero vulnerabilities at check time.
- **VALIDATE**: `make qa`
- **FUNCTIONAL**: `uv run --locked pytest tests/test_workflow_to_harness.py -q` plus generated fake-OpenCode tests from Task 4.
- **TEST_PYRAMID**: Full unit/integration suite for the Python CLI blueprint.

---

## Testing Strategy

### Unit Tests to Write

| Test File | Test Cases | Validates |
| --- | --- | --- |
| `tests/test_workflow_to_harness.py` | accepts `model` and `command` | New string fields parse correctly. |
| `tests/test_workflow_to_harness.py` | rejects empty/unsafe `model` and `command` | Existing validation style applies to new fields. |
| `tests/test_workflow_to_harness.py` | accepts `dangerouslySkipPermissions: true` | Camel-case YAML field works. |
| `tests/test_workflow_to_harness.py` | accepts `dangerously-skip-permissions: true` | CLI-flag-style alias works. |
| `tests/test_workflow_to_harness.py` | rejects `dangerouslySkipPermissions: "true"` | Strict boolean behavior preserved. |
| `tests/test_workflow_to_harness.py` | schema includes new fields | `flowsh-cli --schema` remains useful. |

### Integration Tests to Write

| Test File | Test Cases | Validates |
| --- | --- | --- |
| `tests/test_workflow_to_harness.py` | fake OpenCode captures full argv with all new options | Generated Bash passes flags in correct order. |
| `tests/test_workflow_to_harness.py` | dash-prefixed prompt still follows `--` | Prompt safety regression prevention. |
| `tests/test_workflow_to_harness.py` | omitted fields preserve current argv | Backward compatibility for existing workflows. |

### Edge Cases Checklist

- [ ] `model: openai/gpt-5` containing `/` is accepted.
- [ ] `model: ""` is rejected.
- [ ] `command: ""` is rejected.
- [ ] Unsafe control characters in `model` and `command` are rejected.
- [ ] `dangerouslySkipPermissions: false` emits no flag.
- [ ] Omitted dangerous field emits no flag.
- [ ] `dangerouslySkipPermissions: "true"` is rejected.
- [ ] `dangerously-skip-permissions: true` is accepted.
- [ ] Both dangerous spellings together are rejected, if ambiguity validation is implemented.
- [ ] Prompt beginning with `--help` remains message content.
- [ ] `command` does not replace prompt; prompt remains message/arguments after `--`.

---

## Validation Commands

**IMPORTANT**: Use governed commands from `Makefile`.

### Level 1: STATIC_ANALYSIS

```bash
make lint
```

**EXPECT**: Exit 0, Ruff check passes, Ruff format check passes, Python compile checks pass.

### Level 2: BUILD_AND_FUNCTIONAL

```bash
make build && uv run --locked flowsh-cli --schema
```

**EXPECT**: Build succeeds; schema prints YAML-formatted JSON Schema including the new agent-step fields.

### Level 3: UNIT_TESTS

```bash
uv run --locked pytest tests/test_workflow_to_harness.py -q
```

**EXPECT**: All targeted tests pass. Coverage is not currently configured in the project; do not add coverage tooling for this feature unless requested.

### Level 4: FULL_SUITE

```bash
make qa
```

**EXPECT**: `make lint`, `make test`, and `make build` pass; output ends with `QA passed`.

### Level 4: DATABASE_VALIDATION

Not applicable. This Python CLI has no database.

### Level 5: BROWSER_VALIDATION

Not applicable. This Python CLI has no browser UI.

### Level 6: CURRENT_STANDARDS_VALIDATION

```bash
python3 - <<'PY'
import json, urllib.request
for package in ['pydantic','PyYAML','typer','pytest','ruff']:
    with urllib.request.urlopen(f'https://pypi.org/pypi/{package}/json', timeout=20) as response:
        data = json.load(response)
    print(package, data['info']['version'], len(data.get('vulnerabilities', [])))
PY
```

**EXPECT**: No PyPI-reported vulnerabilities for the existing dependency families. Re-check OpenCode CLI docs if implementation happens after this plan timestamp.

### Level 7: MANUAL_VALIDATION

1. Create a temporary workflow YAML with an agent step using `agent`, `model`, `command`, and `dangerouslySkipPermissions`.
2. Run `uv run --locked flowsh-cli <tmp-workflow.yml> --force`.
3. Inspect generated harness dry-run output with `.harness/<name>.sh --dry-run`.
4. Confirm dry-run logs the command shape and does not print prompt contents.
5. Use a fake `opencode` on `PATH` to confirm exact argv if not already covered by pytest.

---

## Acceptance Criteria

- [ ] Existing workflows using only `prompt`, `agent`, and `expandPrompt` still parse and render the same OpenCode argv.
- [ ] `model` is accepted on `agent` steps and renders `--model <value>` before `--`.
- [ ] `command` is accepted on `agent` steps and renders `--command <value>` before `--`.
- [ ] `dangerouslySkipPermissions: true` renders `--dangerously-skip-permissions` before `--`.
- [ ] `dangerously-skip-permissions: true` is accepted as an alias for the same behavior.
- [ ] Dangerous permission skip defaults to false and emits no flag when omitted or false.
- [ ] String booleans for dangerous skip are rejected.
- [ ] Empty or unsafe-control-character `model` and `command` values are rejected.
- [ ] Prompt remains after `--` so dash-prefixed prompt text cannot become a flag.
- [ ] README and schema document the new fields.
- [ ] `make qa` passes with exit 0.
- [ ] Implementation follows current OpenCode and Pydantic documented behavior.

---

## Completion Checklist

- [ ] All tasks completed in dependency order.
- [ ] Each task validated immediately after completion.
- [ ] Level 1: Static analysis passes.
- [ ] Level 2: Build and functional validation passes.
- [ ] Level 3: Unit tests pass.
- [ ] Level 4: Full test suite and build succeed.
- [ ] Level 4: Database validation marked not applicable.
- [ ] Level 5: Browser validation marked not applicable.
- [ ] Level 6: Current standards validation re-checked if implementation date changes materially.
- [ ] All acceptance criteria met.

---

## Real-time Intelligence Summary

**Context7 MCP Queries Made**: 1
**Web Intelligence Sources**: 6
**Last Verification**: 2026-05-31T12:40:00Z
**Security Advisories Checked**: 5 package families via PyPI JSON vulnerability metadata
**Deprecated Patterns Avoided**: OpenCode legacy `tools` permission config is not used; no new dependency or legacy flowsh surface introduced.

PyPI check output at plan time:

```text
pydantic: latest=2.13.4 vulnerabilities=0
PyYAML: latest=6.0.3 vulnerabilities=0
typer: latest=0.26.4 vulnerabilities=0
pytest: latest=9.0.3 vulnerabilities=0
ruff: latest=0.15.15 vulnerabilities=0
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `dangerously-skip-permissions` alias support weakens strict unknown-field behavior | MEDIUM | MEDIUM | Accept only the documented alias for one field; keep all other extra fields forbidden; test misspellings. |
| `AliasChoices` silently prioritizes one alias if both spellings are present | MEDIUM | LOW | Add a model-level pre-validation check to reject both spellings together, or explicitly document and test chosen priority. Prefer rejection. |
| `model` validation accidentally reuses `agent` regex and rejects `provider/model` | MEDIUM | HIGH | Add tests using `openai/gpt-5`; validate with generic non-empty/control-char validator only. |
| `command` is mistaken for replacing prompt content | MEDIUM | MEDIUM | Keep prompt/message after `--`; document that `command` maps to `--command` and prompt becomes command args. |
| Dangerous permission flag is overused | MEDIUM | HIGH | README warning, false default, explicit boolean only, no config shortcuts. |
| OpenCode CLI changes after plan timestamp | LOW | MEDIUM | Re-fetch `https://opencode.ai/docs/cli/#run-1` before implementation if delayed. |

---

## Notes

### Current Intelligence Considerations

- OpenCode CLI docs verified on 2026-05-31 list `--dangerously-skip-permissions` under `opencode run` and describe it as auto-approving permissions not explicitly denied.
- OpenCode model docs verified on 2026-05-31 confirm `--model` is highest-priority model selection and uses `provider/model` format.
- OpenCode command docs verified on 2026-05-31 confirm custom command execution and model/agent command options.
- Pydantic v2 docs via Context7 confirm `AliasChoices` for multiple input aliases; if exact generated JSON schema output matters, inspect it after implementation because aliases can affect schema presentation.
- This repo intentionally reduced scope. The correct implementation is a minimal extension to `AgentStep`, not a broader workflow DSL expansion.

### No-Prior-Knowledge Test

An implementation agent unfamiliar with this codebase should be able to complete the feature using only this plan by reading the mandatory files, applying the field/render/test/doc updates in order, and running the listed validation commands.
