# Issue 31

**Title**: [Critical] while loop step type for dynamic iteration
**Type**: BUG
**Investigated**: 2026-06-27T19:16:56Z

## Summary

`for` loops snapshot their input before iteration, so workflows that create new work during the loop do not pick it up in the same run.

## Implementation Plan

- Add a `while` step model with `condition` and nested `steps`.
- Render `while` as a Bash loop that re-evaluates the condition each iteration.
- Add parser, render, and end-to-end tests.
- Document `while` in the README.

## Validation

- `make qa`

## Notes

This archive reflects the investigation comment used as the implementation plan.
