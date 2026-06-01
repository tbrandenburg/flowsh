"""flowsh-cli: generate OpenCode Bash harness scripts from workflow YAML."""

from flowsh_cli.models import Workflow, WorkflowParseError, parse_workflows
from flowsh_cli.render import harness_path, render_harness

__version__ = "0.4.0"

__all__ = [
    "Workflow",
    "WorkflowParseError",
    "__version__",
    "harness_path",
    "parse_workflows",
    "render_harness",
]
