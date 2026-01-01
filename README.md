# flowsh

**A workflow-to-shell generator for AI agent orchestration**

flowsh converts visual AI workflows into portable shell-based agent harnesses, transforming complex workflow definitions into dependency-free bash scripts for seamless agent orchestration and automation.

## Vision

flowsh bridges the gap between visual workflow design and shell-based execution. It takes workflow YAML/DSL definitions and generates optimized, self-contained shell scripts that run anywhere with standard bash/zsh.

## Features

- 🔄 **Workflow-to-Shell Generation** - Convert workflows into native shell scripts
- 🤖 **Agent-First Design** - Optimize for AI agent CLI orchestration and harnesses  
- 🚀 **Zero Dependencies** - Generate scripts that run anywhere with bash/zsh
- 🔗 **Template System Support** - Support for template references and libraries
- 📦 **Portable Execution** - Self-contained scripts with embedded workflow logic
- 🛠️ **Shell Integration** - Seamless integration with existing shell toolchains
- 🎯 **Workflow Fidelity** - Preserve complex workflow patterns (iterations, loops, conditions)

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

## Development Roadmap

flowsh follows a phased implementation approach to ensure a solid, usable foundation while building toward full workflow specification support.

### Phase 1 (MVP) - Foundation 
Essential workflow control elements for basic agent orchestration:

- 📋 **Start/End Nodes** - Variable definitions and workflow boundaries
- 📋 **LLM Nodes** - AI model integration with prompt templates  
- 📋 **If-Else Nodes** - Conditional workflow branching
- 📋 **Variable Assignment** - Dynamic variable management
- 📋 **Code Nodes** - Bash command execution for system operations
- 📋 **Agent Nodes** - CLI tool orchestration and integration
- 📋 **Basic Template Substitution** - Variable interpolation in templates
- 📋 **System Variables** - Environment and runtime context

### Phase 2 (Intermediate) - Enhanced Control
Enhanced workflow control and iteration capabilities:

- 📋 **Loop Nodes** - Conditional repetition with break conditions
- 📋 **Iteration Nodes** - Array/list processing workflows
- 📋 **Variable Aggregation** - Collect and merge results across iterations
- 📋 **Template Transform Nodes** - Advanced template processing
- 📋 **Sub-Workflows** - Nested workflow execution with proper scoping

### Phase 3+ (Advanced) - Full Specification
Full workflow specification support:

- 📋 **HTTP Request Nodes** - REST API integration
- 📋 **Tool Nodes** - External service provider integration
- 📋 **Knowledge Retrieval** - Vector database and search integration
- 📋 **External Templates** - Remote template library support
- 📋 **Error Handling** - Comprehensive fallback and retry logic

## Current Status

This project is in early development. No features are currently implemented.

**Initial Capabilities:**
- Basic agent workflows with LLM calls and conditional logic
- Shell command execution for file operations and system tasks
- Variable management and template substitution
- Executable script generation for MVP use cases

**Use Cases:**
- Simple customer support agents with classification logic
- Data processing workflows with bash operations
- Basic decision trees with LLM integration
- Shell-based automation with AI augmentation

## Example Workflow Definition

### Input: flowsh Workflow YAML
```yaml
workflow:
  name: "Task Planning Assistant"
  nodes:
    - id: "start"
      type: "start"
      data:
        variables:
          - variable: "task_description"
            type: "text"
          - variable: "plan_file"
            type: "text"
            default: "task_plan.md"
          - variable: "iteration"
            type: "number"
            default: 1

    - id: "generate_plan"
      type: "agent"
      data:
        command: "opencode"
        args: ["run"]
        prompt_template:
          type: "prompt"
          source: "built-in"
          template_id: "task-planner"
        output_file: "${plan_file}"

    - id: "check_tasks"
      type: "code"
      data:
        command: "grep"
        args: ["-q", "\\[ \\]", "${plan_file}"]
        on_success: "execute_task"
        on_failure: "end"

    - id: "execute_task"
      type: "agent"
      data:
        command: "opencode"
        args: ["run"]
        prompt_template:
          type: "prompt"
          source: "built-in"
          template_id: "task-executor"
        
    - id: "increment_iteration"
      type: "variable_assignment"
      data:
        variable: "iteration"
        value: "${iteration} + 1"
        next_node: "check_tasks"

    - id: "end"
      type: "end"
      data:
        output_file: "${plan_file}"
```

### Output: Generated Shell Script
```bash
#!/bin/bash
# Generated by flowsh v1.0.0
# Source: Task Planning Assistant workflow

set -euo pipefail

# Workflow variables
declare -A workflow_vars

# Initialize workflow
init_workflow() {
    workflow_vars["task_description"]="${1:-}"
    workflow_vars["plan_file"]="task_plan.md"
    workflow_vars["iteration"]=1
    
    [[ -z "${workflow_vars["task_description"]}" ]] && {
        echo "Error: task_description is required" >&2
        exit 1
    }
    
    # Clean up previous plan
    rm -f "${workflow_vars["plan_file"]}"
}

# Execute agent node: generate_plan
execute_agent_node_generate_plan() {
    echo "Running Task Planner..."
    
    local template_content
    template_content=$(resolve_builtin_template "task-planner")
    
    local prompt=$(render_template "$template_content" "${workflow_vars["task_description"]}")
    
    # Call opencode to generate plan
    opencode run "$prompt"
    
    # Verify plan file was created
    [[ ! -f "${workflow_vars["plan_file"]}" ]] && {
        echo "ERROR: Plan file '${workflow_vars["plan_file"]}' was not created" >&2
        exit 1
    }
    
    echo "Planner completed: ${workflow_vars["plan_file"]}"
    echo ""
}

# Execute code node: check_tasks
execute_code_node_check_tasks() {
    # Count tasks for progress tracking
    local total_tasks=$(grep -c "^- \\[.\\]" "${workflow_vars["plan_file"]}" || echo "0")
    local completed_tasks=$(grep -c "^- \\[x\\]" "${workflow_vars["plan_file"]}" || echo "0") 
    local remaining_tasks=$(grep -c "^- \\[ \\]" "${workflow_vars["plan_file"]}" || echo "0")
    
    echo "Iteration ${workflow_vars["iteration"]}: ${completed_tasks}/${total_tasks} completed, ${remaining_tasks} remaining"
    
    # Check if unchecked tasks remain
    if grep -q "\\[ \\]" "${workflow_vars["plan_file"]}"; then
        execute_agent_node_execute_task
        execute_variable_assignment_increment_iteration
    else
        execute_end_node
    fi
}

# Execute agent node: execute_task
execute_agent_node_execute_task() {
    echo "Running Task Executor..."
    
    local template_content
    template_content=$(resolve_builtin_template "task-executor")
    
    local prompt=$(render_template "$template_content" "${workflow_vars["plan_file"]}")
    
    # Call opencode to execute next task
    opencode run "$prompt"
    
    # Verify plan file still exists
    [[ ! -f "${workflow_vars["plan_file"]}" ]] && {
        echo "ERROR: Plan file was not updated properly" >&2
        exit 1
    }
    
    echo "Executor iteration ${workflow_vars["iteration"]} finished"
    echo ""
}

# Execute variable assignment: increment_iteration
execute_variable_assignment_increment_iteration() {
    local current_iteration="${workflow_vars["iteration"]}"
    workflow_vars["iteration"]=$((current_iteration + 1))
    
    # Continue to next iteration
    execute_code_node_check_tasks
}

# Execute end node
execute_end_node() {
    local final_total=$(grep -c "^- \\[.\\]" "${workflow_vars["plan_file"]}" || echo "0")
    local final_completed=$(grep -c "^- \\[x\\]" "${workflow_vars["plan_file"]}" || echo "0")
    
    echo "All tasks completed! (${final_completed}/${final_total} tasks finished)"
    echo "Final plan: ${workflow_vars["plan_file"]}"
}

# Built-in template resolver
resolve_builtin_template() {
    local template_id="$1"
    
    case "$template_id" in
        "task-planner")
            cat <<'TEMPLATE'
You are a TASK PLANNER. Break down this high-level task into 3-5 specific, actionable steps:

"{{task_description}}"

Create a markdown file with:
1. ## Context - summarizing the overall objective
2. ## Task List - formatted as:
   - [ ] Step 1 description
   - [ ] Step 2 description
   - [ ] Step 3 description

Write the plan to: {{plan_file}}
TEMPLATE
            ;;
        "task-executor")  
            cat <<'TEMPLATE'
You are a TASK EXECUTOR. Read the plan file: {{plan_file}}

Find the FIRST unchecked task (line with - [ ]) and complete it.
After completion, update that line to - [x] and add a summary.

Complete only the first open task, then rewrite the updated plan back to the file.
TEMPLATE
            ;;
    esac
}

# Template rendering helper
render_template() {
    local template="$1"
    local task_description="$2"
    local plan_file="${workflow_vars["plan_file"]}"
    
    # Simple variable substitution
    echo "$template" | sed \
        -e "s|{{task_description}}|$task_description|g" \
        -e "s|{{plan_file}}|$plan_file|g"
}

# Main execution
main() {
    init_workflow "$@"
    execute_agent_node_generate_plan
    execute_code_node_check_tasks
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

Transform your visual workflows into portable, executable shell scripts with flowsh. 🚀