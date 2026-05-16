# flowsh

`flowsh` is a small `uv` Python CLI deliberately reduced to one tool:

```bash
uv run flowsh .made/workflows.yml
```

It reads MADE workflow YAML and writes executable Bash harness scripts for OpenCode.

## Supported YAML

Only this top-level shape is supported:

```yaml
workflows:
  - id: wf_example
    name: Example
    steps:
      - type: vars
        name: Capture date
        values:
          TODAY: date -u +%F
      - type: bash
        name: Print date
        run: |
          printf 'today=%s\n' "$TODAY"
      - type: agent
        name: Ask OpenCode
        agent: general
        prompt: |
          Summarize the current repository state.
```

Supported step types are only `vars`, `bash`, and `agent`.

Harness paths are derived from workflow ids. `wf_example` writes `.harness/example.sh`.

## Commands

```bash
# Generate every workflow harness
uv run flowsh .made/workflows.yml

# Generate one workflow by id
uv run flowsh .made/workflows.yml --workflow wf_example

# Show planned outputs without writing files
uv run flowsh .made/workflows.yml --dry-run

# Overwrite existing harness files
uv run flowsh .made/workflows.yml --force
```

Generated harness logs go to `.flowsh/logs` by default. Set `FLOWSH_LOG_DIR` when running a harness to use another local log directory.

## Development

```bash
uv sync
make install
make qa
```

`make install` installs `flowsh` into the user PATH with `uv tool install --force .`.

`make qa` runs Ruff, Python compile checks, and pytest. There is no TypeScript compiler, template system, DSL explorer, or legacy node registry.
