# Issue 33 Archive

## Issue

- #33: `[Important] when: conditional field on steps for param-driven branching`
- Type: ENHANCEMENT

## Investigation Summary

The workflow model had no step-level conditional guard, so users had to duplicate whole workflows for entry-point variants like `--resume` and `--from-scratch`.

## Implementation Plan

- Add `when: str | None = None` to `BaseStep` in `src/flowsh_cli/models.py`
- Validate `when` as a non-empty Bash expression string
- Render a conditional skip guard in `src/flowsh_cli/render.py`
- Add parser, render, and end-to-end tests in `tests/test_workflow_to_harness.py`

## Validation

- `make qa`

## Notes

The fix was implemented on branch `fix/issue-33-when-conditional-field`.
