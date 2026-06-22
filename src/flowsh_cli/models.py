from __future__ import annotations

import re
from collections import Counter
from collections.abc import Mapping
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

MAX_WORKFLOW_YAML_BYTES = 1_048_576


class WorkflowParseError(ValueError):
    """Raised when the input YAML cannot be parsed or validated."""


class UniqueKeySafeLoader(yaml.SafeLoader):
    """YAML loader that rejects duplicate mapping keys instead of overwriting them."""

    def compose_node(self, parent: object, index: object) -> yaml.nodes.Node:
        if self.check_event(yaml.AliasEvent):
            event = self.get_event()
            raise yaml.constructor.ConstructorError(
                "while composing a node",
                event.start_mark,
                "YAML aliases are not supported",
                event.start_mark,
            )

        return super().compose_node(parent, index)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class BaseStep(StrictModel):
    name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_optional_string(cls, value: str | None) -> str | None:
        if value is not None and value.strip() == "":
            raise ValueError("must not be empty")
        if value is not None and has_control_characters(value):
            raise ValueError("must not contain control characters")
        return value


class BashStep(BaseStep):
    type: Literal["bash"]
    run: str

    @field_validator("run")
    @classmethod
    def validate_run(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("must not be empty")
        if has_unsafe_control_characters(value):
            raise ValueError("must not contain unsafe control characters")
        return value


class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str = Field(
        description=(
            "The prompt text sent to the agent. "
            "May contain markdown, code fences, backticks, $(...), and other shell syntax freely — "
            "the prompt is never passed through a shell. "
            "Use expandPrompt: true to substitute ${VAR} / $VAR tokens from vars steps."
        )
    )
    agent: str | None = None
    model: str | None = None
    command: str | None = None
    dangerouslySkipPermissions: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "dangerouslySkipPermissions",
            "dangerously-skip-permissions",
        ),
    )
    expandPrompt: bool = Field(
        default=False,
        description=(
            "When true, substitutes ${VAR} and $VAR tokens from vars steps into the prompt "
            "at runtime using safe plain-text replacement. "
            "Shell expressions such as $(cmd), `cmd`, $((expr)), and globs are NOT evaluated — "
            "they pass through to the agent literally. "
            "Only uppercase variable names matching [A-Z_][A-Z0-9_]* found in the prompt text "
            "are replaced. All other shell syntax in the prompt is safe to use."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def reject_ambiguous_dangerous_aliases(cls, data: object) -> object:
        if (
            isinstance(data, Mapping)
            and "dangerouslySkipPermissions" in data
            and "dangerously-skip-permissions" in data
        ):
            raise ValueError(
                "dangerouslySkipPermissions and dangerously-skip-permissions must not both be set"
            )
        return data

    @field_validator("prompt", "agent", "model", "command")
    @classmethod
    def validate_strings(cls, value: str | None) -> str | None:
        if value is not None and value.strip() == "":
            raise ValueError("must not be empty")
        if value is not None and has_unsafe_control_characters(value):
            raise ValueError("must not contain unsafe control characters")
        return value

    @field_validator("agent")
    @classmethod
    def validate_agent(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise ValueError("must match ^[A-Za-z0-9_-]+$")
        return value


class VarsStep(BaseStep):
    type: Literal["vars"]
    values: dict[str, str]

    @field_validator("values")
    @classmethod
    def validate_values(cls, value: dict[str, str]) -> dict[str, str]:
        if not value:
            raise ValueError("must contain at least one variable")

        for name, command in value.items():
            if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", name):
                raise ValueError(f"invalid variable name: {name}")
            if command.strip() == "":
                raise ValueError(f"empty command for variable: {name}")
            if has_unsafe_control_characters(command):
                raise ValueError(f"unsafe control character in command for variable: {name}")

        return value


class ForStep(BaseStep):
    type: Literal["for"]
    in_: str = Field(..., validation_alias="in")
    item: str = Field(...)
    steps: list[Step] = Field(min_length=1)

    @field_validator("in_", "item")
    @classmethod
    def validate_var_name(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", value):
            raise ValueError("must match ^[A-Z_][A-Z0-9_]*$")
        return value


class ParallelStep(BaseStep):
    type: Literal["parallel"]
    steps: list[Step] = Field(min_length=1)


Step = Annotated[
    VarsStep | BashStep | AgentStep | ForStep | ParallelStep,
    Field(discriminator="type"),
]


ForStep.model_rebuild()
ParallelStep.model_rebuild()


class WorkflowParam(StrictModel):
    name: str
    description: str | None = None
    required: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", value):
            raise ValueError("must match ^[A-Z_][A-Z0-9_]*$")
        return value


class Workflow(StrictModel):
    id: str
    name: str
    description: str | None = None
    params: list[WorkflowParam] = []
    enabled: bool = True
    schedule: str | None = None
    shellScriptPath: str | None = None
    steps: list[Step]

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not re.fullmatch(r"wf_[A-Za-z0-9_-]+", value):
            raise ValueError("must match ^wf_[A-Za-z0-9_-]+$")
        return value

    @field_validator("name")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("must not be empty")
        if has_control_characters(value):
            raise ValueError("must not contain control characters")
        return value

    @field_validator("steps")
    @classmethod
    def validate_steps(cls, value: list[Step]) -> list[Step]:
        if not value:
            raise ValueError("must contain at least one step")
        return value


class WorkflowFile(StrictModel):
    description: str | None = None
    workflows: list[Workflow]

    @field_validator("workflows")
    @classmethod
    def validate_workflows(cls, value: list[Workflow]) -> list[Workflow]:
        if not value:
            raise ValueError("must contain at least one workflow")

        id_counts = Counter(workflow.id for workflow in value)
        duplicate_ids = sorted(workflow_id for workflow_id, count in id_counts.items() if count > 1)
        if duplicate_ids:
            raise ValueError(f"duplicate workflow ids: {', '.join(duplicate_ids)}")

        return value


def parse_workflows(path: Path) -> list[Workflow]:
    validate_workflow_file_path(path)
    content = read_workflow_text(path)

    try:
        data = yaml.load(content, Loader=UniqueKeySafeLoader)
    except yaml.YAMLError as error:
        raise WorkflowParseError(f"Invalid YAML: {error}") from error

    if data is None:
        raise WorkflowParseError("Workflow YAML must not be empty")
    if not isinstance(data, Mapping):
        raise WorkflowParseError("Workflow YAML root must be a mapping with a 'workflows' key")

    try:
        return WorkflowFile.model_validate(data).workflows
    except ValidationError as error:
        raise WorkflowParseError(format_validation_error(error)) from error


def workflow_schema_yaml() -> str:
    return yaml.safe_dump(
        WorkflowFile.model_json_schema(),
        sort_keys=False,
        allow_unicode=False,
    )


def format_validation_error(error: ValidationError) -> str:
    messages: list[str] = []
    for item in error.errors(include_url=False, include_input=False, include_context=False):
        location = ".".join(str(part) for part in item["loc"])
        message = str(item["msg"])
        if location:
            messages.append(f"{location}: {message}")
            continue

        messages.append(message)

    return "Invalid workflow YAML: " + "; ".join(messages)


def construct_unique_mapping(
    loader: UniqueKeySafeLoader,
    node: yaml.nodes.MappingNode,
    deep: bool = False,
) -> object:
    seen: set[object] = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in seen
        except TypeError as error:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "found unhashable mapping key",
                key_node.start_mark,
            ) from error
        if duplicate:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"found duplicate key: {key}",
                key_node.start_mark,
            )
        seen.add(key)

    return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)


UniqueKeySafeLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    construct_unique_mapping,
)


def validate_workflow_file_path(path: Path) -> None:
    try:
        metadata = path.stat()
    except OSError as error:
        raise WorkflowParseError(f"Cannot stat workflow YAML: {error}") from error

    if not path.is_file():
        raise WorkflowParseError(f"Workflow YAML must be a regular file: {path}")
    if metadata.st_size > MAX_WORKFLOW_YAML_BYTES:
        raise WorkflowParseError(
            f"Workflow YAML is too large: {metadata.st_size} bytes "
            f"(max {MAX_WORKFLOW_YAML_BYTES} bytes)"
        )


def read_workflow_text(path: Path) -> str:
    try:
        with path.open("rb") as workflow_file:
            content = workflow_file.read(MAX_WORKFLOW_YAML_BYTES + 1)
    except OSError as error:
        raise WorkflowParseError(f"Cannot read workflow YAML: {error}") from error

    if len(content) > MAX_WORKFLOW_YAML_BYTES:
        raise WorkflowParseError(
            f"Workflow YAML is too large: more than {MAX_WORKFLOW_YAML_BYTES} bytes"
        )

    try:
        return content.decode("utf-8")
    except UnicodeError as error:
        raise WorkflowParseError(f"Workflow YAML must be valid UTF-8: {error}") from error


def has_control_characters(value: str) -> bool:
    return any(ord(character) < 32 or ord(character) == 127 for character in value)


def has_unsafe_control_characters(value: str) -> bool:
    allowed = {"\n", "\t"}
    return any(
        character not in allowed and (ord(character) < 32 or ord(character) == 127)
        for character in value
    )
