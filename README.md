# flowsh-cli

`flowsh-cli` is a small `uv` Python CLI that reads workflow YAML and writes executable Bash harness scripts for OpenCode.

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

The input path must be a regular file no larger than 1 MiB. The input file must be valid UTF-8, non-empty YAML with a mapping root, no duplicate mapping keys, and no YAML aliases. Workflow and step names are single-line labels. Executable fields reject unsafe control bytes while allowing normal newlines and tabs. `vars` keys must be uppercase shell variable names, and `agent` names may contain only letters, digits, `_`, and `-`.

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

Harness paths are derived from workflow ids. `wf_example` writes `.harness/example.sh`.

## Commands

```bash
# Generate every workflow harness
uvx flowsh-cli .made/workflows.yml

# Generate one workflow by id
uvx flowsh-cli .made/workflows.yml --workflow wf_example

# Show planned outputs without writing files
uvx flowsh-cli .made/workflows.yml --dry-run

# Overwrite existing harness files
uvx flowsh-cli .made/workflows.yml --force

# Show version
uvx flowsh-cli --version

# Show the workflow YAML schema
uvx flowsh-cli --schema
```

You can also run it via `uv run flowsh-cli` if installed locally.

## CLI Contract

`flowsh-cli` is non-interactive. It never prompts for missing information.

Current help output is plain text and deterministic across repeated runs:

```text
Usage: flowsh-cli [OPTIONS] WORKFLOW_YAML

  Generate reproducible OpenCode Bash harness scripts from MADE workflow YAML.

Arguments:
  WORKFLOW_YAML  Path to .made/workflows.yml  \[required]

Options:
  --workflow TEXT  Optional workflow id to generate. Defaults to all workflows.
  --dry-run        Print planned output paths without writing scripts.
  --force          Overwrite existing files. Without this, existing files cause a failure.
  --version        Show the flowsh-cli version and exit.
  --schema         Show the workflow YAML schema and exit.
  --help           Show this message and exit.
```

The CLI pins its help formatter width so this contract does not vary with the
caller terminal size or `COLUMNS` environment value.

Exit codes:

| Case | Exit | stdout | stderr |
|---|---:|---|---|
| `--help` | `0` | Help text | Empty |
| `--version` | `0` | `flowsh-cli <version>` | Empty |
| `--schema` | `0` | Workflow schema as YAML-formatted JSON Schema | Empty |
| Valid generation | `0` | One `Wrote <path>` line per harness | Empty |
| Valid `--dry-run` | `0` | One `DRY-RUN would write <path>` line per selected workflow | Empty |
| Missing required CLI argument | `2` | Empty | Typer usage error |
| Malformed or unsupported workflow YAML | `1` | Empty | `ERROR: <reason>` |
| Unknown `--workflow` id | `1` | Empty | `ERROR: No workflow id matched ...` with known workflow ids |
| Existing harness without `--force` | `1` | Empty | `ERROR: Refusing to overwrite ...` |
| Output directory/path safety failure | `1` | Empty | `ERROR: <path safety reason>` |

Generated harnesses are also non-interactive. `harness.sh --dry-run` exits `0` after logging planned steps to stderr and creating no log directory. A real harness run exits `0` only after every step succeeds. Failed `bash`, `vars`, or `agent` steps return the failing command status, log `Step failed: <step> (exit=<code>)` to stderr, and stop before later steps run. If an `agent` step runs without `opencode` on `PATH`, the harness exits `127` and prints `opencode CLI not found in PATH` to stderr.

Generated harnesses are written with owner-only executable permissions and refuse to overwrite existing paths unless `--force` is passed. Multi-workflow generation preflights overwrite conflicts before writing any harness. `--force` replaces regular harness files and harness-file symlinks, but never replaces a directory at a harness file path. The `.harness` output directory must be a real directory, not a symlink or file. Harness dry runs do not create log files or directories. Real harness logs go to `.flowsh/logs` by default with owner-private directory and file permissions. Set `FLOWSH_LOG_DIR` when running a harness to use another local relative log directory; absolute paths, `..` path segments, symlinked path components, and non-directory log paths are refused. Logging setup and write failures fail the harness instead of being silently ignored.

Generated `bash` and `vars` bodies run with `bash -euo pipefail`, so command failures stop the workflow instead of being masked by later successful commands. Captured `vars` values are exported for later `bash` steps. `agent` prompt heredocs are quoted by default and unquoted only when `expandPrompt: true` is set. `agent` steps invoke only `opencode run --format json -- <prompt>` with optional `--agent <agent>` before `--`, so dash-prefixed prompts are message content rather than OpenCode flags. Agent steps fail with a clear error if `opencode` is not on `PATH`.

## Development

```bash
uv sync
make install
make build
make qa
make hygiene
make clean
```

`make install` installs `flowsh-cli` into the user PATH with `uv tool install --force .`.
`make build` creates reproducible source and wheel distributions under ignored `dist/`.

`make qa` runs Ruff, Python compile checks, and pytest with locked dependencies, then builds packages locally and in CI.
The pytest suite also verifies `python -m flowsh_cli`, `uvx flowsh-cli`, and the direct
`scripts/workflow_to_harness.py` entrypoint against the same help contract.
`make hygiene` prints tracked, untracked, and ignored files with
`git status --short --ignored`; review it before release to confirm only intended
source changes are present and generated artifacts remain ignored. `make clean`
removes local caches, build outputs, generated harnesses, and generated logs.

There is no TypeScript compiler, template system, DSL explorer, legacy node
registry, or archived legacy workflow spec in this repository.
