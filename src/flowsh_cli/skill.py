from __future__ import annotations

SKILL_MARKDOWN = """\
---
name: flowsh-cli
description: Generate executable shell harness scripts from workflow definitions, optionally with readable native Dagu v1 Bash and OpenCode harness steps. Use when creating, modifying, validating, reviewing, troubleshooting, or generating workflow-to-shell automation, especially for orchestrating bash and agent calls.
---

# Workflow-to-Shell Generation with flowsh-cli

Use this skill whenever working with workflow definitions that produce executable Bash or shell scripts.

## Purpose

flowsh-cli converts workflow definitions into executable shell harness scripts.

Workflow definitions are the source of truth.

Generated shell scripts are build artifacts derived from those workflow definitions.

The CLI parses, validates, and generates in a single operation. Validation is therefore an essential part of workflow generation.

A workflow is considered correct when:

* It conforms to the current schema.
* Validation succeeds.
* Generated shell output matches the intended behavior.

---

# Mandatory Operating Procedure

## Rule 1: Always Consult the Current Schema First

Before creating, modifying, reviewing, troubleshooting, or generating workflows:

```bash
uvx flowsh-cli --schema
```

The schema is the authoritative specification.

Do not rely on:

* Memory
* Existing workflow files
* Previous examples
* Assumptions about supported fields

If a workflow conflicts with the schema, the schema is authoritative.

---

## Rule 2: Validate Through Generation

flowsh-cli validates workflows as part of generation.

Use:

```bash
uvx flowsh-cli [workflow-name].yml
```

Validation failures must be resolved before reasoning about generated shell output.

Do not assume a workflow is valid simply because it appears similar to previous examples.

---

## Rule 3: Always Verify After Changes

After modifying a workflow:

1. Retrieve the current schema.
2. Run a dry-run generation.
3. Review any validation errors or warnings.
4. Review the generated output.
5. Confirm generated shell behavior matches intent.

Example:

```bash
uvx flowsh-cli [workflow-name].yml --dry-run
```

A workflow modification is not complete until a successful dry-run has been reviewed.

---

## Rule 4: Make Minimal Changes

When modifying workflows:

* Prefer the smallest possible change.
* Avoid unrelated refactoring.
* Preserve existing behavior unless explicitly requested.
* Keep workflow structure stable.

---

# Workflow Review Priorities

When reviewing workflows:

1. Schema compliance.
2. Successful validation.
3. Workflow correctness.
4. Generated shell correctness.
5. Shell safety.
6. Maintainability.

Generated shell behavior should only be reviewed after validation succeeds.

---

# Common Commands

Display help:

```bash
uvx flowsh-cli --help
```

Display the current schema:

```bash
uvx flowsh-cli --schema
```

Generate all workflows:

```bash
uvx flowsh-cli [workflow-name].yml
```

Generate a specific workflow:

```bash
uvx flowsh-cli [workflow-name].yml --workflow wf_example
```

Preview generation without writing files:

```bash
uvx flowsh-cli [workflow-name].yml --dry-run
```

Overwrite existing generated files:

```bash
uvx flowsh-cli [workflow-name].yml --force
```

Optionally emit a native Dagu v1 sidecar alongside the unchanged Bash harness:

```bash
uvx flowsh-cli [workflow-name].yml --sidecar dagu
```

The sidecar emits one separate Dagu node per supported source operation: readable Bash `run: |` blocks and native `action: harness.run` OpenCode steps. Every generated agent step sets `with.managed: false`, forcing one-shot OpenCode CLI mode in every supported Dagu topology; generated sidecars never use managed sessions. Native v1 supports flat, unconditional `bash` and `agent` steps only, with explicit sequential dependencies, zero retries, and no active schedule. Dagu resolves supported `${...}` references in executable fields, so a braced-dollar expression in Bash, prompt, or agent selection rejects that sidecar rather than risking altered payloads. Stateful/control-flow steps, workflow parameters, nonempty `when`, and unsupported agent options also skip that workflow's sidecar nonfatally; ordinary `.sh` output remains available. Sidecars from flowsh 0.12.0/0.12.1 are old whole-harness wrappers and should be regenerated. Dagu 2.25.1 is the minimum supported version; Dagu 2.25.1 and newer are supported. See the README's Dagu sidecar section for the support matrix, `project_dir`, managed-vs-CLI behavior, migration, and runtime limitations.

---

# Folder Structure & File Management

By convention, organize workflow files and generated harness scripts under a `.harness/` folder:

```
project/
└── .harness/
    ├── [workflow-name].yml        # Workflow file
    └── [harness-name].sh          # Generated harness script
```

**Convention:**
- Store workflow definitions under `[workflow-name].yml` files
- Generated harness scripts are produced in `.harness/` directory with names matching `[harness-name].sh`
- Generated artifacts are build products—regenerate them as needed from source workflows
- Use `.gitignore` to exclude generated `.sh` files if desired, or commit them for reproducibility

**Generation command:**

```bash
uvx flowsh-cli .harness/[workflow-name].yml
```

This generates harnesses in `.harness/` alongside the source workflow definitions.

---

# Example Workflow

Always verify against the current schema before creating production workflows.

```yaml
workflows:
  - id: wf_example
    name: Example Workflow

    steps:
      - type: vars
        values:
          TODAY: date -u +%F

      - type: bash
        run: |
          echo "$TODAY"

      - type: agent
        prompt: |
          Summarize the output.
```

---

# Troubleshooting Procedure

If generation fails:

1. Retrieve the latest schema.
2. Review validation errors.
3. Correct the workflow definition.
4. Run a dry-run.
5. Review generated output.
6. Apply the smallest possible fix.
7. Repeat until validation and generation succeed.

---

# Expected Behavior

Always:

* Consult the latest schema first.
* Treat the schema as authoritative.
* Use flowsh-cli validation before evaluating generated output.
* Run a dry-run after workflow modifications.
* Review generated shell behavior before declaring success.
* Prefer minimal changes.

Never:

* Assume schema details from memory.
* Skip schema inspection.
* Ignore validation errors.
* Skip dry-run verification after changes.
* Declare success without reviewing generated output.
"""


def skill_text() -> str:
    return SKILL_MARKDOWN
