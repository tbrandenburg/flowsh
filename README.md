# flowsh-cli

`flowsh-cli` turns workflow YAML into executable shell scripts.

Use it when you want a small, reproducible way to encode a workflow once and rerun it locally or in CI.

## Quick Start

```bash
uvx flowsh-cli path/to/workflows.yml
```

That reads the workflow YAML at the path you provide and writes harness scripts to the current working directory.

In this repository, the example workflow file lives at `workflows.yml`.

Useful flags:

```bash
uvx flowsh-cli path/to/workflows.yml --dry-run
uvx flowsh-cli path/to/workflows.yml --workflow wf_example
uvx flowsh-cli path/to/workflows.yml --force
uvx flowsh-cli path/to/workflows.yml --schema
uvx flowsh-cli --examples
uvx flowsh-cli --example simple
```

You can also run it locally with `uv run flowsh-cli`.

## Workflow Shape

The input file is a single mapping with a `workflows` list:

```yaml
workflows:
  - id: wf_example
    name: Example
    params:
      - name: ISSUE_NUMBER
        description: Issue to inspect
        required: true
    steps:
      - type: vars
        values:
          TODAY: date -u +%F
      - type: bash
        run: printf 'today=%s\n' "$TODAY"
      - type: agent
        agent: general
        model: openai/gpt-5
        command: review
        expandPrompt: true
        prompt: |
          Review issue ${ISSUE_NUMBER} and summarize the repository state.
       - type: parallel
         steps:
           - type: bash
             run: echo "worker A"
           - type: bash
             run: echo "worker B"
       - type: for
         in: ITEMS
         item: ITEM
         steps:
           - type: bash
             run: echo "$ITEM"
       - type: while
         condition: '[ -n "$(ls doc/plan/steps/planned/ 2>/dev/null)" ]'
         steps:
           - type: bash
             run: echo "keep looping until the queue is empty"
```

Harness paths are derived from workflow ids. `wf_example` becomes `example.sh` in the current working directory.

## Step Types

| Type | Purpose | Notes |
|---|---|---|
| `vars` | Execute shell commands and export their stdout into shell variables | Variable names must be uppercase shell identifiers. |
| `bash` | Run shell commands | Runs with `bash -euo pipefail`. |
| `agent` | Call the agent runtime | Supports `agent`, `model`, `command`, `capture`, `expandPrompt`, and `dangerouslySkipPermissions`. |
| `for` | Iterate over newline-delimited values from a previous `vars` step | Flat iteration only; nested `for` steps are not supported. |
| `while` | Re-evaluate a Bash condition before each iteration | Use for dynamic queues or other stateful loops that must keep discovering new work. |
| `parallel` | Run child steps concurrently | Children run as separate branches and the parent waits for all of them. |

## Agent Behavior

`agent` prompts are literal by default. Use `expandPrompt: true` only when you want `$VAR` or `${VAR}` tokens from earlier `vars` steps substituted at runtime.

`expandPrompt: true` does plain text replacement only. It does not evaluate shell expressions like `$(...)`, backticks, or globs.

Set `capture: VARIABLE_NAME` on an `agent` step when you want the agent's final plain-text answer stored in a shell variable for later `vars` or `bash` steps. The captured value is the answer text (extracted from the underlying `--format json` event stream via `jq`), not the raw JSON stream — requires `jq` to be installed.

Set `dangerouslySkipPermissions: true` only when you want the generated harness to pass `--dangerously-skip-permissions` to the agent runtime. The YAML alias `dangerously-skip-permissions` is also accepted.

## Validation And Safety

The parser is strict:

- workflow YAML must be UTF-8, non-empty, and under 1 MiB
- the root must be a mapping with a `workflows` key
- duplicate mapping keys and YAML aliases are rejected
- workflow ids must match `wf_[A-Za-z0-9_-]+`
- workflow and step names must be non-empty single-line labels
- unsafe control characters are rejected in executable fields
- `agent` names may contain only letters, digits, `_`, and `-`

Generated harnesses are non-interactive, owner-executable, and refuse to overwrite existing outputs unless `--force` is set.

Logs go to `.flowsh/logs` by default. Set `FLOWSH_LOG_DIR` to use another relative log directory.

## Development

```bash
uv sync
make install
make qa
make clean
```

`make qa` runs linting, tests, and a local build.

## Release

```bash
make bump-patch
```

That bumps the patch version, runs QA, and publishes the package.

## Limits

This repository intentionally stays focused on the Python CLI blueprint. It does not include the old TypeScript implementation, workflow templates, DSL explorer, plugin registry, or extra workflow node types.
