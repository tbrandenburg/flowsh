# flowsh Legacy TypeScript CLI And Node Spec

This document preserves the former TypeScript implementation's CLI and workflow/node surface for historical comparison only.

Source commit: `05f399a` (`Merge pull request #15 from tbrandenburg/codex/identify-redundant-templates-for-removal`), the last pre-reduction commit before the Python blueprint rewrite.

The former implementation did not have one single canonical document containing the whole CLI plus node spec. This consolidation was extracted from:

- `05f399a:src/cli/index.ts`
- `05f399a:src/templates/init-command.ts`
- `05f399a:src/dsl/types.ts`
- `05f399a:src/generation/generators/index.ts`
- `05f399a:README.md`
- `05f399a:docs/CLAUDE.md`
- `05f399a:PRPs/flowsh-dsl-basic-command-prp-20250108.md`
- `05f399a:PRPs/flowsh-dsl-detailed-node-exploration-prp-20250108.md`

## Package Entry Point

The npm package exposed one binary:

```json
{
  "bin": {
    "flowsh": "./dist/cli/index.js"
  }
}
```

The CLI itself declared:

```text
flowsh 2.0.0-simple
```

## CLI Overview

When invoked without arguments, the TypeScript CLI printed:

```text
flowsh - The jq of Workflows

Usage:
  flowsh compile workflow.yaml > script.sh
  flowsh compile workflow.yaml -o script.sh
  flowsh validate workflow.yaml
  flowsh init [template] [target.yaml]
  flowsh dsl [--format json]

Run --help for more options
```

Unknown commands failed with:

```text
Unknown command. Available commands: compile, validate, init, dsl
```

## `flowsh compile`

```text
flowsh compile [options] <workflow-file>
```

Purpose: convert workflow YAML to a shell script.

Options:

```text
-v, --verbose        Show detailed progress and performance information
-d, --debug          Enable debug mode with enhanced tracing and variable inspection
--dry-run            Validate and compile without outputting script or writing files
-o, --output <file>  Output generated script to file
```

Behavior:

- Parsed the YAML workflow with validation enabled and non-strict parsing.
- Generated a bash script through `generateShellScript`.
- Scanned for missing environment variables and prepended warning comments to the generated script.
- Validated generated script syntax with `bash -n` before output.
- Wrote generated script to stdout by default.
- Wrote generated script to a file when `--output` was provided, creating parent directories when needed.
- In `--dry-run` mode, printed node count, edge count, generated line count, estimated complexity, and warning count without outputting the script.

README examples:

```bash
flowsh compile workflow.yaml > script.sh
flowsh compile workflow.yaml | bash
flowsh compile workflow.yaml --verbose
flowsh compile workflow.yaml -o script.sh
flowsh compile workflow.yaml --output script.sh
```

### Compile Internals

The old `compile` command was a pipeline over parser, generator, environment scanning, syntax validation, and output.

Pipeline:

```text
read workflow file
validate YAML security
parse YAML with js-yaml FAILSAFE_SCHEMA
validate parsed object against object-security rules
transform parsed YAML into FlowshWorkflow
validate FlowshWorkflow
generate shell script with registry-based generators
scan missing environment variables
prepend missing-environment comments when needed
validate generated shell with bash -n
write to stdout, write to --output path, or print --dry-run summary
```

Parser options used by `compile`:

```ts
{
  validate: true,
  strict: false,
}
```

Shell generation options used by `compile`:

```ts
{
  includeMocks: false,
  shell: 'bash',
  verbose: options.verbose || false,
  debug: options.debug || false,
  defaultTimeout: 60,
}
```

Generated script metadata tracked by `compile`:

```yaml
nodeCount: number
edgeCount: number
hasAgentNodes: boolean
hasLLMNodes: boolean
estimatedComplexity: low | medium | high
supportedNodeTypes: list of string
unsupportedNodeTypes: list of string
performance: optional compilation metrics
```

Complexity estimate:

```text
low     <= 5 nodes
medium  > 5 and <= 10 nodes
high    > 10 nodes
```

Dry-run output included:

```text
Dry-run successful for <workflow-file>
Nodes: <nodeCount>, Edges: <edgeCount>
Generated script: <lineCount> lines
Estimated complexity: <low|medium|high>
Warnings: <warningCount>
```

Output file handling:

```text
resolve output path
create parent directory recursively when missing
write UTF-8 script file
print generated script path
map EACCES, ENOSPC, ENOENT to user-facing errors
```

Generated shell script structure:

```text
#!/bin/bash or #!/bin/zsh
bash re-exec guard when not running under bash
set -euo pipefail
workflow start echo
associative arrays: workflow_vars, workflow_state
color constants: RED, GREEN, YELLOW, BLUE, CYAN, NC
configuration: VERBOSE, AGENT_TIMEOUT
variable management functions: set_var, get_var
environment/conversation variable setup
utility functions for loop/iteration support
workflow execution section
workflow completion echo
exit 0
```

Generated variable helpers:

```text
set_var "variable_name" "value" "node_id"
get_var "variable_name" "node_id"
```

Variable helper behavior:

```text
set_var uses declare -g and export
get_var uses indirect expansion
both emit debug logs when FLOWSH_DEBUG=true
```

Variable initialization sources:

```text
top-level environment_variables
spec.environment_variables
top-level conversation_variables
spec.conversation_variables
variables collected from registered node generators
defaults declared on start node variables
```

Conversation variables were resolved with:

```ts
{
  use_defaults: true,
  fail_on_missing_required: false,
  variable_sources: [{ type: 'environment' }, { type: 'defaults' }],
}
```

Execution organization:

```text
start and end nodes were excluded from executable nodes
iteration and loop nodes were treated as container nodes
child nodes were detected via isInIteration/iteration_id and isInLoop/loop_id
iteration containers attempted to embed child nodes in the iteration generator context
loop containers were explicitly marked not yet implemented in this path
remaining nodes ran as linear execution groups
function-based generated nodes were auto-called when they defined execute_* functions
```

Unsupported node handling:

```text
node types absent from the registry were collected as unsupported
generation failed before script assembly when unsupported types existed
warnings included the node id and missing generator type
```

Unbound variable warning scan:

```text
collected declared variables from workflow configuration and generator-discovered variables
collected exported variables from export statements
collected assigned uppercase shell variables
ignored known shell variables such as PATH, HOME, PWD, UID, RANDOM
warned for uppercase variable references not declared, assigned, exported, or known
```

## `flowsh validate`

```text
flowsh validate <workflow-file>
```

Purpose: validate workflow YAML.

Options: none.

Behavior:

- Parsed the workflow with validation enabled and non-strict parsing.
- On success, printed node and edge counts.
- On warnings, printed warning messages to stderr.
- On errors, printed validation errors and exited non-zero.

README example:

```bash
flowsh validate workflow.yaml
```

Success shape:

```text
workflow.yaml is valid (3 nodes, 2 edges)
```

### Validate Internals

The old `validate` command used the same parser stack as `compile`, but stopped before shell generation.

Pipeline:

```text
read workflow file
validate YAML security
parse YAML with FAILSAFE_SCHEMA
validate parsed object security
transform parsed YAML to FlowshWorkflow
validate workflow structure
print node and edge counts
print warnings when present
```

Parser security checks included:

```text
pre-parse YAML security validation
strict-mode option that could turn security warnings into errors
post-parse dangerous object-key validation
maximum object nesting depth of 10
dangerous key rejection: __proto__, constructor, prototype, valueOf, toString
suspicious key rejection for keys starting with __ or containing prototype
function-value rejection
```

Parse errors were normalized into codes such as:

```text
SECURITY_VALIDATION_FAILED
SECURITY_WARNING
INVALID_YAML_STRUCTURE
SECURITY_VIOLATION
YAML_PARSE_ERROR
UNEXPECTED_ERROR
PARSE_FILE_READ_ERROR
```

## `flowsh dsl`

```text
flowsh dsl [node-type] [options]
```

Purpose: explore the flowsh DSL structure and node types.

Arguments:

```text
[node-type]  Specific node type to explore in detail
```

Options:

```text
--format <format>  Output format: text | json, default text
```

Behavior:

- Without `node-type`, displayed the full DSL overview.
- With `node-type`, displayed detailed node specification for that type.
- Rejected unknown node types and suggested running `flowsh dsl`.
- Supported text and JSON output.

README examples:

```bash
flowsh dsl
flowsh dsl --format json
flowsh dsl llm
flowsh dsl llm --format json
flowsh dsl http-request
flowsh dsl http-request --format json
flowsh dsl circuit-breaker
flowsh dsl if-else
flowsh dsl --help
```

The old DSL overview documented:

- Root workflow structure.
- Graph nodes and edges.
- Edge properties.
- Variable types.
- Node types.
- Supporting model/template types.

### DSL Internals

The old `dsl` command was backed by `DSLIntrospector` and the active generator registry.

Overview JSON shape:

```yaml
version: 2.0.0-complete
dsl_structure:
  root_entities: list of DSLEntity
  graph_components: list of DSLEntity
  edge_properties: list of DSLEntity
  variable_types: list of { type: string, description: string }
  node_types: list of NodeTypeInfo
  supporting_types: list of { name: string, values: list, description: string }
  totals:
    node_types: number
    variable_types: number
    edge_properties: number
    root_entities: number
supported_formats:
  - text
  - json
next_commands:
  - flowsh dsl <node-type>
  - flowsh dsl --format json
```

`DSLEntity` shape:

```yaml
name: string
description: string
type: string
required: optional boolean
optional: optional boolean
```

`NodeTypeInfo` shape:

```yaml
nodeType: string
description: string
implemented: boolean
generator: string
```

Root entities exposed by `flowsh dsl`:

```text
version                 Workflow schema version
kind                    Workflow type identifier
metadata                Workflow metadata (name, description, labels, etc.)
workflow                Workflow definition metadata
environment_variables   Environment variable definitions
conversation_variables  Conversation variable definitions
graph                   Workflow execution graph
spec                    Alternative specification structure
```

Graph components exposed by `flowsh dsl`:

```text
nodes  Array of workflow nodes
edges  Array of workflow edges (node connections)
```

Edge properties exposed by `flowsh dsl`:

```text
source        Source node ID (required)
target        Target node ID (required)
sourceHandle  Source connection point (multi-output support)
targetHandle  Target connection point (multi-input support)
condition     Conditional routing (for if-else nodes)
label         Human-readable edge description
```

Supporting types exposed by `flowsh dsl`:

```text
ModelProvider   openai, anthropic, google, local
TemplateSource  library, customized, built-in, inline, file
```

Node detail JSON shape from `flowsh dsl <node-type> --format json`:

```yaml
nodeType: string
description: string
category: workflow | ai | execution | control | data | network | reliability | composition | misc
implemented: true
generator: string
schema:
  type: object
  required: list of string
  properties:
    propertyName:
      name: string
      type: string or list
      description: string
      required: boolean
      enum: optional list
      default: optional value
      examples: optional list
      properties: optional nested list
  supported:
    - "{{variable}}"
    - "{{#path.to.value#}}"
    - "${variable}"
  extraction: automatic
shellGeneration:
  features: list of string
relatedCommands:
  - flowsh dsl <node-type> --format json
  - flowsh dsl
  - flowsh compile workflow.yaml
```

Node categories:

```text
workflow      start, end, answer
ai            llm
execution     code, agent
control       if-else, loop, iteration, parallel-iteration
data          variable-assignment, variable-aggregation, template-transform
network       http-request, telegram
reliability   retry, fallback, circuit-breaker
composition   sub-workflow
misc          fallback category for unknown categorization
```

Generator name derivation:

```text
http-request -> HttpRequestNodeGenerator
variable-assignment -> VariableAssignmentNodeGenerator
llm -> LLMNodeGenerator by convention in code exports, though generic name derivation would produce LlmNodeGenerator
```

Text output for a node detail contained these sections:

```text
<NODE> Node - <description>
DESCRIPTION
REQUIRED PROPERTIES
OPTIONAL PROPERTIES
TEMPLATE VARIABLES
SHELL GENERATION
MORE COMMANDS
```

Shell generation features listed by `flowsh dsl <node-type>` included node-specific capabilities. Examples:

```text
llm: API authentication handling, JSON request/response processing, error handling and retries, variable substitution and validation
http-request: HTTP client with auth support, request/response handling, retry logic with backoff, error handling and validation
telegram: Telegram Bot API integration, message formatting and parsing, retry logic for network errors, error handling and validation
circuit-breaker: failure rate monitoring, circuit state management, request blocking logic, recovery mechanisms
code: shell command execution, environment variable handling, timeout management, success/failure routing
agent: CLI tool orchestration, template parameter injection, environment configuration, command execution
if-else: condition evaluation, comparison operations, logical operators, conditional routing
loop: loop condition evaluation, iteration counting, break condition handling, infinite loop protection
iteration: array processing, sequential/parallel execution, result collection, error handling per item
parallel-iteration: concurrent processing, resource management, progress tracking, error aggregation
retry: exponential backoff logic, retry condition evaluation, timeout handling, attempt counting
fallback: fallback path execution, strategy implementation, success detection, time limit management
sub-workflow: sub-process execution, variable mapping, isolated context, result integration
```

## `flowsh init`

```text
flowsh init [template] [target] [options]
```

Purpose: initialize workflow YAML from templates.

Arguments:

```text
[template]  Template name to use
[target]    Target workflow file path
```

Options:

```text
--help                  Display available templates and usage
-p, --preview           Display template content without creating files
-l, --list-templates    List all available templates
-s, --search <query>    Search templates by keyword
```

Behavior:

- `flowsh init` showed hierarchical template help/listing.
- `flowsh init --help` behaved like `flowsh init`.
- `flowsh init --list-templates` displayed a detailed template list.
- `flowsh init --search <query>` searched templates by keyword.
- `flowsh init <template> --preview` displayed template content without creating files.
- `flowsh init <template> <target>` created a workflow file from the selected template.
- Missing target outside preview mode failed with usage.
- Template creation used overwrite mode and stripped template comments.
- Template creation validated both template and result.

Usage emitted by the implementation on missing target:

```text
Usage: flowsh init [TEMPLATE] [TARGET_FILE]
       flowsh init [TEMPLATE] --preview
       flowsh init --list-templates
       flowsh init --search <query>
```

README examples:

```bash
flowsh init
flowsh init --help
flowsh init ai-to-telegram-simple --preview
flowsh init ai-chat-memory --preview
flowsh init ai-to-telegram-simple my-workflow.yaml
flowsh init ai-chat-memory api-protection.yaml
flowsh init data-pipeline-simple processor.yaml
```

### Init Internals

The old `init` command was a template discovery, display, preview, and processing pipeline.

Template discovery scanned:

```text
templates/**/*.yaml
```

Skipped directories during recursive scan:

```text
node_modules
.git
.vscode
dist
build
```

Template categories were inferred from path structure:

```text
templates/<category>/<file>.yaml
templates/<category>/<subcategory>/<file>.yaml
```

Template metadata fields extracted by discovery:

```yaml
name: file basename without .yaml
displayName: basename with trailing -template removed
filePath: absolute or resolved path
category: first path segment under templates
subcategory: second path segment when present
description: extracted from YAML or comments when available
```

Description extraction order:

```text
workflow.description
top-level description
comment matching # Description: ...
```

Template lookup supported multiple names:

```text
name
name-template
name with -template removed
name.yaml
name with .yaml removed
category/displayName
subcategory/displayName
category/subcategory/displayName
```

Template search matched lowercase query against:

```text
displayName
category
subcategory
```

Hierarchical display groups:

```text
basic
enhanced
advanced/<subcategory>
```

Template processing steps for `flowsh init <template> <target>`:

```text
validate target path for security
validate source template through parseWorkflowFile(validate=true, strict=false)
read template content
strip template-specific comments
write target file, overwriting by default
validate generated target through parseWorkflowFile(validate=true, strict=false)
print success or validation/processing error
```

Template-specific comments removed during processing matched patterns like:

```text
# template:
# this is a template
# template description:
# usage:
# replace ... with
# customize ... for
# todo:
# note:
# example usage
# template version
```

Workflow-related comments were explicitly kept when matching patterns like:

```text
# workflow
# description
# important
# warning
# security
# configuration
```

Generic comments containing these words were likely removed:

```text
change
modify
replace
customize
```

Template preview for `flowsh init <template> --preview` displayed:

```text
template id
category/subcategory
description
complexity
node count
edge count
required variables
estimated script length
node types
raw template content with placeholder annotations
```

Preview placeholder extraction recognized:

```text
{{variable}}
${variable}
```

Preview metadata came from `TemplateAnalyzer`, while required variables came from template analysis of the parsed YAML.

## Former Workflow Shape

The former TypeScript implementation accepted graph-style workflow YAML.

README example:

```yaml
workflow:
  name: 'Hello World'
  description: 'Simple greeting workflow'

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Start'

    - id: 'greet'
      type: 'code'
      data:
        title: 'Generate Greeting'
        command: 'echo "Hello, World!"'

    - id: 'end'
      type: 'end'
      data:
        title: 'Complete'

  edges:
    - source: 'start'
      target: 'greet'
    - source: 'greet'
      target: 'end'
```

The TypeScript `FlowshWorkflow` type also allowed newer structured fields:

```yaml
version: optional string
kind: optional string
metadata:
  id: optional string
  name: string
  description: optional string
  version: optional string
  created_by: optional string
  updated_by: optional string
  labels: optional map
  annotations: optional map
workflow:
  name: string
  description: optional string
  version: optional string
  template_dependencies: optional list
environment_variables: optional list
conversation_variables: optional list
graph:
  nodes: list
  edges: list
spec:
  template_dependencies: optional list
  environment_variables: optional list
  conversation_variables: optional list
  graph:
    nodes: list
    edges: list
```

## Graph Spec

Workflow node:

```yaml
id: string
type: NodeType
data: NodeData
```

Workflow edge:

```yaml
id: optional string
source: string
target: string
sourceHandle: optional string
targetHandle: optional string
condition: optional string
label: optional string
```

Common node data fields available on node data objects:

```yaml
title: optional string
desc: optional string
description: optional string
isInIteration: optional boolean
iteration_id: optional string
isInLoop: optional boolean
loop_id: optional string
```

## Variable Spec

Variable types:

```text
text
select
number
boolean
object
array
text-input
```

Base variable fields:

```yaml
variable: string
type: VariableType
label: optional string
description: optional string
required: optional boolean
```

Text variable:

```yaml
type: text | text-input
default: optional string
max_length: optional number
```

Select variable:

```yaml
type: select
options: list of string
default: optional string
```

Number variable:

```yaml
type: number
default: optional number
min: optional number
max: optional number
```

Boolean variable:

```yaml
type: boolean
default: optional boolean
```

Object variable:

```yaml
type: object
properties: optional map of variable definitions
```

Array variable:

```yaml
type: array
items: optional variable definition
```

Environment variable:

```yaml
variable: string
name: string
type: VariableType
description: optional string
options: optional list of string
```

Conversation variable:

```yaml
variable: string
name: string
type: VariableType
description: optional string
required: optional boolean
default: optional string | number | boolean
options: optional list of { value: string, label: string }
validation:
  min: optional number
  max: optional number
  pattern: optional string
```

## Template And Model Spec

Template sources:

```text
library
customized
built-in
inline
file
```

Prompt template:

```yaml
type: prompt
source: TemplateSource
template_id: optional string
version: optional string
content: optional string
file_path: optional string
```

Template parameters:

```yaml
key: string | number | boolean | undefined
```

Template dependency:

```yaml
template_id: string
type: prompt
source: TemplateSource
version: optional string
```

Prompt message:

```yaml
role: system | user | assistant
text: string
```

Model providers:

```text
openai
anthropic
google
local
```

Model config:

```yaml
provider: ModelProvider
name: string
mode: chat | completion
completion_params:
  temperature: optional number
  max_tokens: optional number
  top_p: optional number
  frequency_penalty: optional number
  presence_penalty: optional number
  stop: optional list of string
```

## Registered Node Types

The old TypeScript registry registered 19 node types:

```text
start
end
answer
code
agent
llm
variable-assignment
if-else
loop
iteration
variable-aggregation
template-transform
http-request
sub-workflow
parallel-iteration
retry
fallback
circuit-breaker
telegram
```

The old README only highlighted a smaller subset:

```text
start/end
answer
code
agent
llm
variable-assignment
if-else
loop
iteration
```

## Node Data Specs

### `start`

```yaml
variables: optional list of variables
```

Purpose: workflow boundary and initial variable definitions.

### `end`

```yaml
outputs: optional list of variables
```

Purpose: workflow boundary and output definitions.

### `answer`

```yaml
answer: string
type: optional text | json | markdown
```

Purpose: emit final workflow answer/output. `answer` could contain variable references.

### `code`

```yaml
command: string
args: optional list of string
working_directory: optional string
environment_variables: optional map of string to string
on_success: optional string
on_failure: optional string
timeout: optional number
```

Purpose: execute shell commands/scripts.

### `agent`

```yaml
command: string
args: optional list of string
prompt_template: optional prompt template
template_parameters: optional map
working_directory: optional string
environment_variables: optional map of string to string
timeout: optional number
```

Purpose: CLI tool orchestration, including AI agents and external command-line tools.

### `llm`

```yaml
model:
  provider: openai | anthropic | google | local
  name: string
  mode: chat | completion
  completion_params: optional completion params
prompt_template: optional prompt template or list of prompt messages
template_parameters: optional map
advanced_prompt_config:
  app_mode: optional string
  model_mode: optional string
  pre_prompt: optional string
  prompt_type: optional string
  chat_prompt_config: optional map
  completion_prompt_config: optional map
context:
  enabled: optional boolean
  variable: optional string
vision:
  enabled: optional boolean
  configs:
    detail: optional low | high | auto
memory:
  role_prefix:
    user: optional string
    assistant: optional string
  query_prompt_template: optional string
  window:
    enabled: optional boolean
    size: optional number
```

Purpose: AI model integration with prompt templates, context, vision, and memory options.

### `if-else`

```yaml
conditions:
  - variable: string
    comparison_operator: == | != | > | < | >= | <= | contains | not_contains | is_empty | is_not_empty
    value: optional string | number | boolean
logical_operator: optional and | or
```

Purpose: conditional workflow branching.

### `variable-assignment`

```yaml
variable: string
assignment_type: constant | variable | expression
value: optional string | number | boolean
source_variable: optional string
expression: optional string
write_mode: optional over-write | append | clear
on_empty: optional use_default | warn | fail
default_value: optional string | number | boolean
fail_on_empty: optional boolean
```

Purpose: dynamic variable management and templating.

### `loop`

```yaml
condition:
  variable: string
  comparison_operator: == | != | > | < | >= | <= | contains | not_contains | is_empty | is_not_empty
  value: optional string | number | boolean
max_iterations: optional number
break_on: optional condition | max_iterations
```

Purpose: conditional repetition with safety limits.

### `iteration`

```yaml
input_variable: string
output_variable: optional string
parallel: optional boolean
max_parallel: optional number
```

Purpose: array/list processing workflows.

### `variable-aggregation`

```yaml
input_variables: list of string
output_variable: string
aggregation_method: concat | sum | avg | merge | collect
separator: optional string
```

Purpose: collect and merge variable values/results.

### `template-transform`

```yaml
template: prompt template
template_parameters: map
output_variable: string
```

Purpose: render templates into variables.

### `http-request`

```yaml
url: string
method: GET | POST | PUT | DELETE | PATCH
headers: optional string
body: optional string
body_type: optional json | form | xml | text
auth_type: optional none | bearer | basic | api_key
auth_token: optional string
auth_credentials: optional string
auth_api_key: optional string
auth_key_header: optional string
timeout: optional number
retries: optional number
retry_delay: optional number
error_handling: optional fail | ignore | continue
```

Purpose: HTTP/API calls from generated shell scripts.

### `sub-workflow`

```yaml
workflow_file: string
input_mappings: optional string
output_mappings: optional string
```

Purpose: nested workflow execution. Mapping strings used newline-separated assignment-like mappings.

### `parallel-iteration`

```yaml
input_variable: string
output_variable: optional string
max_parallel: optional number
chunk_size: optional number
progress_tracking: optional boolean
error_handling: optional fail | ignore | continue
```

Purpose: concurrent batch processing.

### `retry`

```yaml
max_attempts: optional number
retry_delay: optional number
backoff_multiplier: optional number
retry_condition: optional any_failure | timeout_only | network_only
timeout: optional number
```

Purpose: retry behavior around downstream operations.

### `fallback`

```yaml
strategy: optional sequential | parallel
fallback_paths: list of string
max_fallback_time: optional number
continue_on_success: optional boolean
```

Purpose: fallback execution paths.

### `circuit-breaker`

```yaml
failure_threshold: optional number
timeout_duration: optional number
success_threshold: optional number
monitor_window: optional number
```

Purpose: circuit-breaker control for unreliable operations.

### `telegram`

```yaml
chat_id: optional string
message: string
bot_token: optional string
parse_mode: optional HTML | Markdown | MarkdownV2
max_retries: optional number
disable_notification: optional boolean
reply_to_message_id: optional number
error_handling: optional fail | ignore | continue
```

Purpose: send Telegram messages via bot API.

## Former Template Catalog Surface

The old README described template categories, but commit `05f399a` had already removed some redundant enhanced templates. The CLI still supported template discovery/search/preview via `flowsh init`.

Old README advertised examples including:

```text
ai-to-telegram-simple
data-pipeline-simple
ai-to-telegram
data-pipeline
ai-chat-memory
content-moderation
data-validation-cleanup
```

Other historical docs and PRPs referenced a unified template count of 33 templates, but that number came from earlier hardening/planning docs and was not a reliable snapshot of `05f399a` after template removals.

## Current Status

This legacy CLI and node surface is not active in the current Python blueprint project.

The current supported runtime surface is intentionally limited to:

```text
flowsh workflows.yml [--workflow wf_id] [--dry-run] [--force]
```

Current workflow step types are intentionally limited to:

```text
vars
bash
agent
```
