"""flowsh: generate OpenCode Bash harness scripts from workflow YAML."""

from flowsh.models import Workflow, WorkflowParseError, parse_workflows
from flowsh.render import harness_path, render_harness

__version__ = "0.1.0"

__all__ = [
    "Workflow",
    "WorkflowParseError",
    "__version__",
    "harness_path",
    "parse_workflows",
    "render_harness",
]
