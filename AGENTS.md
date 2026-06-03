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
