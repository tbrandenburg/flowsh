from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class WorkflowParseError(ValueError):
    """Raised when the input YAML cannot be parsed or validated."""


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BaseStep(StrictModel):
    name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_optional_string(cls, value: str | None) -> str | None:
        if value is not None and value.strip() == "":
            raise ValueError("must not be empty")
        return value


class BashStep(BaseStep):
    type: Literal["bash"]
    run: str

    @field_validator("run")
    @classmethod
    def validate_run(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("must not be empty")
        return value


class AgentStep(BaseStep):
    type: Literal["agent"]
    prompt: str
    agent: str | None = None

    @field_validator("prompt", "agent")
    @classmethod
    def validate_strings(cls, value: str | None) -> str | None:
        if value is not None and value.strip() == "":
            raise ValueError("must not be empty")
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

        return value


Step = Annotated[VarsStep | BashStep | AgentStep, Field(discriminator="type")]


class Workflow(StrictModel):
    id: str
    name: str
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
        return value

    @field_validator("steps")
    @classmethod
    def validate_steps(cls, value: list[Step]) -> list[Step]:
        if not value:
            raise ValueError("must contain at least one step")
        return value


class WorkflowFile(StrictModel):
    workflows: list[Workflow]

    @field_validator("workflows")
    @classmethod
    def validate_workflows(cls, value: list[Workflow]) -> list[Workflow]:
        if not value:
            raise ValueError("must contain at least one workflow")

        ids = [workflow.id for workflow in value]
        duplicate_ids = sorted({workflow_id for workflow_id in ids if ids.count(workflow_id) > 1})
        if duplicate_ids:
            raise ValueError(f"duplicate workflow ids: {', '.join(duplicate_ids)}")

        return value


def parse_workflows(path: Path) -> list[Workflow]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise WorkflowParseError(f"Cannot read workflow YAML: {error}") from error
    except yaml.YAMLError as error:
        raise WorkflowParseError(f"Invalid YAML: {error}") from error

    try:
        return WorkflowFile.model_validate(data).workflows
    except ValidationError as error:
        raise WorkflowParseError(error) from error
