# flowsh

**Generate executable shell scripts from flowsh workflow definitions**

Convert visual AI workflows into portable shell-based agent harnesses. Transform complex flowsh DSL into dependency-free bash scripts for seamless agent orchestration and automation.

## Overview

flowsh is a generator that bridges the gap between visual workflow design and shell-based execution. It takes flowsh workflow YAML/DSL definitions and generates optimized, self-contained shell scripts that can run anywhere with standard bash/zsh.

## Key Features

- 🔄 **Workflow-to-Shell Generation** - Convert flowsh workflows into native shell scripts
- 🤖 **Agent-First Design** - Optimized for AI agent CLI orchestration and harnesses  
- 🚀 **Zero Dependencies** - Generated scripts run anywhere with bash/zsh
- 🔗 **Template System Support** - Full support for flowsh's template references and libraries
- 📦 **Portable Execution** - Self-contained scripts with embedded workflow logic
- 🛠️ **Shell Integration** - Seamless integration with existing shell toolchains
- 🎯 **Workflow Fidelity** - Preserves complex workflow patterns (iterations, loops, conditions)

## Use Cases

### Agent Orchestration
```bash
# Generate agent harness from workflow
flowsh generate agent-workflow.yaml --output agents/customer-support.sh

# Execute generated agent harness
./agents/customer-support.sh "Customer complaint about billing"

# Or generate and run in one step
flowsh run agent-workflow.yaml "Customer complaint about billing"
```

### Automated Workflows
```bash
# Generate complex workflow to portable script
flowsh generate data-processing-pipeline.yaml --output production.sh

# Run anywhere without flowsh installation
./production.sh --input data.csv --output results/

# Or run workflow directly without saving script
flowsh run data-processing-pipeline.yaml --input data.csv --output results/
```

### Development Integration
```bash
# Generate multiple scripts from directory
flowsh generate workflows/ --output-dir dist/scripts/

# Generate from wildcard pattern
flowsh generate workflows/*.yaml --output-dir dist/scripts/

# Integrate with existing shell toolchain
./dist/scripts/code-review.sh --pr-url $PR_URL --notify slack
```

## Quick Start

### Installation
```bash
npm install -g flowsh
```

### Basic Usage
```bash
# Generate shell script from flowsh workflow
flowsh generate workflow.yaml

# Generate and run workflow immediately
flowsh run workflow.yaml

# Generate and run with debug information
flowsh run workflow.yaml --debug

# Specify output file
flowsh generate workflow.yaml --output my-agent.sh

# Validate workflow without generating
flowsh validate workflow.yaml
```

## Generated Script Features

### Phase 1 Capabilities
Generated scripts currently include:
- **Variable Management** - Workflow variable declarations and assignments
- **Conditional Logic** - If-else branching with boolean evaluation  
- **LLM Integration** - AI model calls with prompt template rendering
- **Shell Operations** - Bash command execution for system tasks
- **Template System** - Basic variable substitution in templates

### Shell Integration
Scripts work with standard shell environments:
- Standard input/output handling
- Environment variable support
- Exit codes and error reporting
- Self-contained execution (no external dependencies)

## Implementation Roadmap

flowsh follows a phased implementation approach to ensure a solid, usable foundation while building toward full workflow specification support.

### Phase 1 (MVP) - Available Now
Essential workflow control elements for basic agent orchestration:

- ✅ **Start/End Nodes** - Variable definitions and workflow boundaries
- ✅ **LLM Nodes** - AI model integration with prompt templates  
- ✅ **If-Else Nodes** - Conditional workflow branching
- ✅ **Variable Assignment** - Dynamic variable management
- ✅ **Code Nodes** - Bash command execution for system operations
- ✅ **Basic Template Substitution** - Variable interpolation in templates
- ✅ **System Variables** - Environment and runtime context

### Phase 2 (Intermediate) - Coming Next
Enhanced workflow control and iteration capabilities:

- 🚧 **Loop Nodes** - Conditional repetition with break conditions
- 🚧 **Iteration Nodes** - Array/list processing workflows
- 🚧 **Agent Nodes** - CLI tool orchestration and integration
- 🚧 **Variable Aggregation** - Collect and merge results across iterations
- 🚧 **Template Transform Nodes** - Advanced template processing

### Phase 3+ (Advanced) - Future Development
Full workflow specification support:

- 📋 **HTTP Request Nodes** - REST API integration
- 📋 **Tool Nodes** - External service provider integration
- 📋 **Knowledge Retrieval** - Vector database and search integration
- 📋 **External Templates** - Remote template library support
- 📋 **Nested Workflows** - Sub-workflow execution with scoping
- 📋 **Error Handling** - Comprehensive fallback and retry logic

### Current Capabilities

**What Works Today:**
- Basic agent workflows with LLM calls and conditional logic
- Shell command execution for file operations and system tasks
- Variable management and template substitution
- Executable script generation for MVP use cases

**Realistic Use Cases:**
- Simple customer support agents with classification logic
- Data processing workflows with bash operations
- Basic decision trees with LLM integration
- Shell-based automation with AI augmentation

## Example Output

### Input: flowsh Workflow YAML
```yaml
workflow:
  name: "Customer Support Agent"
  nodes:
    - id: "start"
      type: "start"
      data:
        variables:
          - variable: "customer_query"
            type: "text"
    
    - id: "classify"
      type: "llm"
      data:
        prompt_template:
          type: "prompt"
          source: "library"
          template_id: "customer-classifier-v2"
```

### Output: Generated Shell Script
```bash
#!/bin/bash
# Generated by flowsh v1.0.0
# Source: Customer Support Agent workflow

set -euo pipefail

# Workflow variables
declare -A workflow_vars
declare -A node_outputs

# Template cache
declare -A template_cache

# Initialize workflow
init_workflow() {
    workflow_vars["customer_query"]="${1:-}"
    [[ -z "${workflow_vars["customer_query"]}" ]] && {
        echo "Error: customer_query is required" >&2
        exit 1
    }
}

# Execute LLM node with template resolution
execute_llm_node_classify() {
    local template_content
    template_content=$(resolve_template "library" "customer-classifier-v2")
    
    local prompt=$(render_template "$template_content" "${workflow_vars["customer_query"]}")
    
    local response=$(call_llm_agent "$prompt")
    node_outputs["classify"]="$response"
}

# Template resolution
resolve_template() {
    local source="$1"
    local template_id="$2"
    
    # Check cache first
    [[ -n "${template_cache["$template_id"]:-}" ]] && {
        echo "${template_cache["$template_id"]}"
        return
    }
    
    # Resolve template based on source
    case "$source" in
        "library") resolve_library_template "$template_id" ;;
        "built-in") resolve_builtin_template "$template_id" ;;
        *) echo "Error: Unknown template source: $source" >&2; exit 1 ;;
    esac
}

# Main execution
main() {
    init_workflow "$@"
    execute_llm_node_classify
    echo "${node_outputs["classify"]}"
}

main "$@"
```

## Architecture

### Generation Pipeline
1. **Parse** - Read and validate YAML workflow files
2. **Transform** - Convert workflow nodes to shell functions  
3. **Generate** - Output executable shell script

### Generated Script Components
- **Variable Management** - Handle workflow variables
- **Agent Orchestration** - Call agent CLI tools
- **Error Handling** - Proper exit codes and error messages

## Integration with shai

flowsh is designed as a companion to [shai](https://github.com/tbrandenburg/shai):

- **shai**: Manual agent CLI orchestration with shell scripting
- **flowsh**: Automated generation of agent harnesses from visual workflows

Both projects focus on shell-based agent orchestration, with shai providing manual scripting capabilities and flowsh enabling automated workflow-to-shell generation.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [shai](https://github.com/tbrandenburg/shai) - Manual agent CLI orchestration

### dify

The flowsh DSL design was inspired by [Dify](https://github.com/langgenius/dify), an open-source LLM app development platform. Dify's workflow orchestration patterns and node-based architecture provided valuable insights for creating a shell-compatible workflow specification. While flowsh focuses on shell script generation rather than visual workflow execution, we appreciate Dify's contributions to the workflow automation space.

This project does not copy or reproduce Dify's code but rather implements original shell-based solutions inspired by their workflow design concepts.

---

Transform your visual workflows into portable, executable shell scripts with flowsh. Build once, run anywhere. 🚀