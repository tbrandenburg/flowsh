# Issue 32 Archive

## Issue

- #32: `[Important] capture: field on agent steps to expose output to subsequent steps`
- Type: ENHANCEMENT

## Investigation Summary

Agent steps streamed their output to the terminal and discarded it, so later workflow steps could not inspect sentinel values such as blocked-status tags.

## Implementation Plan

- Add `capture: str | None = None` to `AgentStep` in `src/flowsh_cli/models.py`
- Validate `capture` as an uppercase shell variable name
- Render captured agent output into a shell variable in `src/flowsh_cli/render.py`
- Add parser, schema, and end-to-end tests in `tests/test_workflow_to_harness.py`
- Document `capture` in `README.md`

## Validation

- `make qa`

## Notes

The fix was implemented on branch `fix/issue-32-agent-capture`.
