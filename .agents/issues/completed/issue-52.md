# Issue 52 Archive

**Issue**: #52 - `test: _strip_ansi regex covers only a subset of CSI escape sequences`

**Type**: BUG

**Investigation Summary**

The `_strip_ansi` helper in `tests/test_workflow_to_harness.py` used a narrow regex that only stripped a small set of CSI escape-sequence final bytes. That made the test suite fragile if Rich emitted other valid ANSI sequences.

**Implementation Plan**

1. Broaden `_strip_ansi` in `tests/test_workflow_to_harness.py` to match the full CSI range.
2. Add a regression test for a cursor-movement CSI sequence.
3. Keep the existing help-output contract assertions unchanged.

**Validation**

```bash
make qa
uv run --locked pytest tests/test_workflow_to_harness.py -k strip_ansi
```

**Result**

Implemented on branch `fix/issue-52-strip-ansi-regex` and verified with `make qa` and the targeted pytest invocation.
