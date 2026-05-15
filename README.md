# flowsh

`flowsh` is now deliberately reduced to one tool:

```bash
uv run flowsh .made/workflows.yml --output-root .
```

It reads MADE workflow YAML and writes executable Bash harness scripts for OpenCode.

## Supported YAML

Only this top-level shape is supported:

```yaml
workflows:
  - id: wf_example
    name: Example
    enabled: true
    schedule: manual
    shellScriptPath: .harness/example.sh
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

## Commands

```bash
# Generate every workflow harness
uv run flowsh .made/workflows.yml --output-root .

# Generate one workflow by id or name
uv run flowsh .made/workflows.yml --workflow wf_example

# Show planned outputs without writing files
uv run flowsh .made/workflows.yml --dry-run

# Overwrite existing harness files
uv run flowsh .made/workflows.yml --force

# Print JSON Schema for the supported workflow file
uv run flowsh .made/workflows.yml --print-schema
```

## Development

```bash
make install
make qa
```

`make qa` only validates the Python blueprint and its tests. There is no TypeScript compiler, template system, DSL explorer, or legacy node registry.
