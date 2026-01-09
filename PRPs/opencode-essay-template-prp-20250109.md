# OpenCode Essay Writing Template - PRP

**Date**: January 9, 2025  
**Priority**: High  
**Type**: Simple Template Creation

## Goal

Create a simple essay writing template: Topic → Research → Write → Edit → Send via Telegram.

## What It Does

**Input**: User provides a topic  
**Output**: Polished essay delivered to Telegram

**Flow**: `[start] → [research] → [write content] → [edit] → [telegram] → [end]`

## Template Specification

**Template Name**: `opencode-essay-simple-template.yaml`  
**Category**: Enhanced (simple templates)  
**Complexity**: Medium  
**Time to Execute**: ~5 minutes

## Required Environment Variables

- `TELEGRAM_BOT_TOKEN` (user must configure)
- `TELEGRAM_CHAT_ID` (user must configure)

**Assumptions**:

- OpenCode has MCP configured (firecrawl or similar web research capability)
- User has set up Telegram bot credentials
- No mocking or fallbacks needed - must work with real setup

## Simple Architecture

### Agent 1: Researcher

- **Input**: User topic
- **Action**: Research with firecrawl, create 1-3 simple plan files
- **Output**: Planning files saved as `2025-01-09_Topic_Part_01.md`

### Agent 2: Writer (with Dynamic File Discovery)

- **Input**: Planning files from Agent 1 (discovered dynamically)
- **Action**: Iteration node finds all `*Part*.md` files, writer processes each
- **Output**: Combined content in `2025-01-09_Topic_Raw.md`
- **Key Feature**: Dynamic file discovery - no hardcoded file lists!

### Agent 3: Editor

- **Input**: Raw content file
- **Action**: Polish and improve the writing
- **Output**: Final essay as `2025-01-09_Topic.md`

### Telegram Delivery

- **Input**: Final essay file
- **Action**: Send essay content to Telegram
- **Output**: Message delivered with essay text

## Key Variables (Simple)

```yaml
user_topic: "The user's essay topic"
essay_date: '2025-01-09'
topic_name: 'Clean_Topic_Name'
part_count: 2 # How many sections to create (1-3)
```

## File Names (Simple Pattern)

All files follow: `[DATE]_[TOPIC]_[TYPE].md`

Examples:

- Plans: `2025-01-09_AI_Ethics_Part_01.md`
- Raw: `2025-01-09_AI_Ethics_Raw.md`
- Final: `2025-01-09_AI_Ethics.md`

## Simple Implementation

### Template YAML Structure

```yaml
workflow:
  name: 'Simple Essay Writer'
  description: 'Research → Write → Edit → Send essay via Telegram'

conversation_variables:
  - variable: user_topic
    name: Essay Topic
    type: text-input
    description: What should the essay be about?
    required: true

graph:
  nodes:
    - id: start
      type: start

    - id: researcher
      type: agent
      data:
        title: 'Research Topic'
        command: 'opencode'
        args: ['Research and create essay plan']
        # Simple prompt: research topic, make 2-3 plan files

    - id: writer_loop
      type: iteration
      data:
        title: 'Write Content Sections'
        input_variable: plan_files
        parallel: false

    - id: writer
      type: agent
      data:
        title: 'Write Section'
        command: 'opencode'
        args: ['Write essay section from plan']
        # Simple prompt: read plan, write content, append to raw file

    - id: editor
      type: agent
      data:
        title: 'Polish Essay'
        command: 'opencode'
        args: ['Edit and improve the essay']
        # Simple prompt: read raw file, improve, save final

    - id: telegram
      type: telegram
      data:
        title: 'Send Essay'
         message: |
           📝 Essay: {{user_topic}}

           {{file_content:{{essay_file}}}}

         error_handling: 'fail'

    - id: end
      type: end

  edges:
    - source: start
      target: researcher
    - source: researcher
      target: writer_loop
    - source: writer_loop
      target: writer
    - source: writer
      target: editor
    - source: editor
      target: telegram
    - source: telegram
      target: end
```

**Dynamic Variables** (generated during execution):

```yaml
# Set by research_planner agent
research_date: '2025-01-09'
topic_short: 'AI_Ethics'
part_count: 3
work_dir: '/tmp/flowsh_essay_work'

# Generated for iteration
planning_files: ['Part_01.md', 'Part_02.md', 'Part_03.md']
```

### File Naming Convention

**Standardized Pattern**: `[DATE]_[ShortTopic]_[Type]_[ID].md`

**Examples**:

- Research plans: `2025-01-09_AI_Ethics_Part_01.md`
- Raw content: `2025-01-09_AI_Ethics_Raw.md`
- Final essay: `2025-01-09_AI_Ethics.md`

### Smart Information Transfer

**Between Research → Writer**:

- Variable `part_count` tells iteration node how many files to process
- Variable `work_dir` provides file path context
- **Dynamic file discovery**: Iteration finds all `*Part*.md` files automatically
- No hardcoded file lists - adapts to 1, 2, or 3 parts seamlessly!

**Between Writer → Editor**:

- Single raw file accumulates all content sections
- File path variables ensure consistent access
- Content metadata passed through variables

**Between Editor → Telegram**:

- Final essay file path passed as variable
- Content length and metadata calculated dynamically

### Error Handling & Fallbacks

**File Discovery**:

```yaml
# Variable assignment with dynamic file discovery
- type: variable-assignment
  variable: planning_files
  assignment_type: expression
  expression: "find_files('{{work_dir}}/*Part*.md')"
# This discovers 1-3 files automatically - no hardcoding!
```

**Telegram Fallbacks**:

- None - must work with real credentials
- Fail if Telegram delivery fails

## Template Structure

```yaml
workflow:
  name: 'OpenCode Essay Writing'
  description: 'Multi-agent essay writing workflow with research, writing, and editorial phases'

graph:
  nodes:
    - id: start
      type: start
      data:
        title: 'Essay Writing Workflow'

    - id: research_planner
      type: agent
      data:
        title: 'Research & Planning Agent'
        command: 'opencode'
        args: ['Research topic and create content plans']
        prompt_template:
          type: prompt
          source: inline
          content: |
            You are a research and planning specialist using Firecrawl MCP for web research.

            Topic: {{user_topic}}

            Your tasks:
            1. Research the topic comprehensively using web search
            2. Create {{max_parts}} focused content sections 
            3. For each section, create a planning document with:
               - Research findings and sources
               - Key points and arguments
               - Structural outline
               - Word count target

            Save each plan as: {{work_dir}}/{{research_date}}_{{topic_short}}_Part_##.md

            Set these variables for next stage:
            - research_date (today's date YYYY-MM-DD)  
            - topic_short (sanitized topic name, max 20 chars)
            - part_count (actual number of parts created)
            - work_dir (working directory path)

    - id: content_iterator
      type: iteration
      data:
        title: 'Content Writing Iterator'
        input_variable: planning_files
        parallel: false

    - id: content_writer
      type: agent
      data:
        title: 'Content Writer Agent'
        command: 'opencode'
        args: ['Write content section from plan']
        prompt_template:
          type: prompt
          source: inline
          content: |
            You are a skilled content writer. 

            Current planning document: {{iteration_item}}

            Your tasks:
            1. Read and analyze the planning document thoroughly
            2. Write comprehensive, engaging content following the plan
            3. Maintain academic rigor while being accessible
            4. Append your section to: {{work_dir}}/{{research_date}}_{{topic_short}}_Raw.md
            5. Use clear section headers and logical flow
            6. Incorporate research findings naturally

            Write {{iteration_index}} of {{part_count}} total sections.
            Maintain consistency with previous sections.

    - id: editorial_agent
      type: agent
      data:
        title: 'Editorial Review Agent'
        command: 'opencode'
        args: ['Edit and polish the essay']
        prompt_template:
          type: prompt
          source: inline
          content: |
            You are a professional editor and writing specialist.

            Raw content file: {{work_dir}}/{{research_date}}_{{topic_short}}_Raw.md

            Your tasks:
            1. Read the complete raw content
            2. Perform comprehensive editorial review:
               - Structural coherence and flow
               - Argument clarity and strength  
               - Grammar, style, and tone
               - Transitions between sections
               - Conclusion that ties everything together
            3. Create the final polished essay
            4. Save as: {{work_dir}}/{{research_date}}_{{topic_short}}.md
            5. Ensure professional quality suitable for publication

            Topic: {{user_topic}}
            Target audience: Educated general readers

    - id: telegram_delivery
      type: telegram
      data:
        title: 'Essay Delivery'
        message: |
          📝 **Essay Complete!**

          **Topic**: {{user_topic}}
          **Date**: {{research_date}}
          **Parts Created**: {{part_count}}

          Here's your finished essay:

          {{file_content:{{work_dir}}/{{research_date}}_{{topic_short}}.md}}

          Generated by flowsh OpenCode Essay Template 🚀
        parse_mode: 'Markdown'
        error_handling: 'fail'

    - id: end
      type: end
      data:
        title: 'Essay Complete'

  edges:
    - source: start
      target: research_planner
    - source: research_planner
      target: content_iterator
    - source: content_iterator
      target: content_writer
    - source: content_writer
      target: editorial_agent
    - source: editorial_agent
      target: telegram_delivery
    - source: telegram_delivery
      target: end
```

## Success Criteria (Simple)

**Must Work**:

- ✅ User enters topic, gets essay back via Telegram
- ✅ Template compiles with flowsh in under 30 seconds
- ✅ Generated shell script runs without errors
- ✅ Real Telegram message received (not mocked)

**Must Be Simple**:

- ✅ Under 80 lines of YAML
- ✅ Clear, short prompts
- ✅ Easy to understand file flow
- ✅ Fast execution (under 5 minutes)
- ✅ **Dynamic file discovery** - showcases iteration node power!

## Implementation Plan (Simple)

**Day 1**:

1. Create basic YAML with 6 nodes
2. Write simple agent prompts
3. Test compilation

**Day 2**:

1. Test with real topics and real Telegram delivery
2. Fix any flowsh issues (small fixes allowed)
3. Create README
4. Add to template system

## PRP Success Definition

**This PRP is ONLY considered complete when**:

- ✅ Template successfully tested end-to-end
- ✅ Real essay received via Telegram message
- ✅ I can see the Telegram message with the essay content
- ✅ Template added to flowsh template system

**If major flowsh issues discovered**: Re-plan the PRP
**If minor flowsh issues**: Fix them and continue

## Done!

This is a simple, fast template that anyone can understand and use. No complex architecture - just: Research → Write → Edit → Send.
