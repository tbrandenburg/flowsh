# AGENTS.md

This repository has been intentionally reduced to the Python CLI blueprint.

## Scope

- Keep the product surface limited to the existing Python blueprint.
- Do not reintroduce the TypeScript implementation, workflow templates, DSL explorer, plugin registry, or extra workflow node types.
- Supported step types are `vars`, `bash`, `agent`, `for` (flat, non-nested iteration over newline-delimited variables), and `parallel` (concurrent fork-join wrapper over child steps).
- Generated agent steps must continue to target the OpenCode CLI only.

## Development

- Use `make qa` after code changes.
- Keep tests focused on the current blueprint behavior.
- Prefer deletion over compatibility layers when reducing legacy project remnants.

## Publishing

- Published on PyPI as `flowsh-cli`. Run with `uvx flowsh-cli` (no install needed).
- Bump: `make bump-patch` (or `bump-minor`/`bump-major`) — runs qa then publishes.

## Lessons Learned

- 2026-08-03: A README library-usage example (`parse_workflows`/`render_harness` signatures) was written from memory and was wrong (`parse_workflows` takes a `Path`, not text; `render_harness` returns a string, it doesn't write files). `make qa`/pytest never caught it because no test imports the README snippet. Prevention: any code example added to README.md or docs must be executed against a real install (built wheel or `uv run python -c ...`) before being committed, not just visually checked against the source.
