#!/usr/bin/env python3
"""Direct script entrypoint for the flowsh CLI."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from flowsh import WorkflowParseError, harness_path, parse_workflows, render_harness  # noqa: E402
from flowsh.cli import main, select_workflows  # noqa: E402

__all__ = [
    "WorkflowParseError",
    "harness_path",
    "main",
    "parse_workflows",
    "render_harness",
    "select_workflows",
]


if __name__ == "__main__":
    raise SystemExit(main())
