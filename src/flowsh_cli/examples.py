from __future__ import annotations

EXAMPLES: dict[str, tuple[str, str, str]] = {
    # name -> (short_description, step_types, yaml)
    "simple": (
        "Vars + sequential bash steps",
        "vars, bash",
        """\
workflows:
  - id: wf_simple
    name: Simple example — vars and bash

    steps:
      - type: vars
        name: Capture date
        values:
          TODAY: date -u +%F       # shell command; stdout becomes the variable

      - type: bash
        name: Greet
        run: echo "Hello, today is $TODAY"

      - type: bash
        name: Done
        run: echo "Workflow complete"
""",
    ),
    "medium": (
        "Params + vars + bash + agent with prompt expansion",
        "vars, bash, agent",
        """\
workflows:
  - id: wf_medium
    name: Medium example — params, vars, agent
    params:
      - name: TOPIC
        description: Subject to summarise
        required: true
    steps:
      - type: vars
        values:
          TODAY: date -u +%F
      - type: bash
        run: 'echo "Running on $TODAY for topic: $TOPIC"'
      - type: agent
        expandPrompt: true
        prompt: |
          Today is ${TODAY}. Write a one-paragraph summary about ${TOPIC}.
""",
    ),
    "sophisticated": (
        "Params + vars + bash + agent + for + parallel + file handoff",
        "vars, bash, agent, for, parallel",
        """\
workflows:
  - id: wf_sophisticated
    name: Sophisticated example — for, parallel, file handoff
    params:
      - name: ITEMS
        description: Newline-delimited list of items to process
        required: true
    steps:
      - type: vars
        values:
          OUTFILE: mktemp
      - type: parallel
        steps:
          - type: bash
            run: echo "worker A started"
          - type: bash
            run: echo "worker B started"
      - type: for
        in: ITEMS
        item: ITEM
        steps:
          - type: bash
            run: echo "$ITEM" >> "$OUTFILE"
      - type: agent
        expandPrompt: true
        prompt: |
          The file ${OUTFILE} contains one processed item per line.
          Summarise the results.
""",
    ),
}


def examples_index() -> str:
    lines = ["Available examples (use --example <name> to print runnable YAML):\n"]
    for name, (desc, step_types, _) in EXAMPLES.items():
        lines.append(f"  {name:<14}{desc}")
        lines.append(f"  {'':14}Step types: {step_types}\n")
    return "\n".join(lines)


def example_yaml(name: str) -> str:
    if name not in EXAMPLES:
        known = ", ".join(EXAMPLES)
        raise ValueError(f"unknown example {name!r}. Available: {known}")
    return EXAMPLES[name][2]
