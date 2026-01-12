# PRP Phase 2: Create New Intelligent Templates for Advanced Patterns

## FEATURE:

Create 10 new intelligent workflow templates that cover advanced automation patterns not addressed by existing flowsh examples. This phase focuses on filling gaps in the template library with sophisticated workflows for production-ready automation systems.

### Additional Objective

Make the provided example/template scripts **actually run and pass** under real execution conditions.

### Hard Requirements

- Assume the scripts will be executed in a real environment.
- **Do not** stub, mock, fake, or simulate execution results.
- **Do not** produce demo-only, illustrative, or conceptual code.
- All dependencies, imports, configuration, and runtime assumptions must be corrected end-to-end.

### Execution Standard

- Treat any runtime error, failing test, missing dependency, or incorrect output as a **bug that must be fixed**.
- Perform **full-stack corrections**: code, configuration, environment assumptions, and interfaces may all be changed if required.
- If something cannot work as written, modify it until it does.

### Iteration Rule

- If an error would occur at runtime, fix it.
- Repeat until the scripts would pass under real execution.

### Output Rule

- Output only the **final corrected, working scripts** and any required setup steps.
- Do not explain what _would_ happen — assume it **must** happen.

### Best-Effort Clause

- If perfect execution is impossible due to external constraints, produce the closest **fully executable** version and explicitly state the remaining blocking constraint.

**Core Creation Strategy:**

- Design new templates for specialized use cases (reliability, multi-channel, stateful workflows)
- Leverage advanced flowsh node types (circuit-breaker, parallel-iteration, sub-workflow)
- Implement complex variable flow patterns with proven composition techniques
- Build on Phase 1's enhanced template infrastructure and skill integration
- Target 75%+ success rate for advanced patterns (vs 90%+ for foundation templates)
- **CRITICAL**: Ensure all new templates are production-ready and execute successfully in real environments

**Target New Templates:**

1. **Circuit Breaker Protection** - Production resilience patterns
2. **AI Chat with Memory** - Stateful conversation workflows
3. **Content Moderation Pipeline** - Safety and compliance automation
4. **Multi-Format Distribution** - Cross-channel content syndication
5. **Scheduled Content Generation** - Time-based automation workflows
6. **Interactive Workflow Builder** - Meta-workflow composition
7. **Data Validation & Cleanup** - Input sanitization and quality assurance
8. **Automated Testing & Monitoring** - DevOps automation patterns
9. **Multi-Stage AI Workflows** - Complex AI processing chains
10. **Parallel Processing with Aggregation** - Scalable data processing

**Success Metrics:**

- 7-10 minute deployment time for advanced templates
- 75%+ first-run success rate for complex workflows **with actual execution validation**
- Coverage of production reliability and scalability patterns
- Seamless integration with Phase 1 foundation templates
- **EXECUTION VALIDATION**: All new templates must compile and run successfully in real environments
- **PRODUCTION-GRADE**: Templates handle real API failures, network issues, and edge cases

## EXAMPLES:

### Example 1: Circuit Breaker Protection Template

```yaml
# circuit-breaker-protection-template.yaml
metadata:
  template_name: 'Circuit Breaker API Protection'
  category: 'reliability-advanced'
  intent_keywords:
    [
      'circuit breaker',
      'api protection',
      'failure handling',
      'resilience',
      'production reliability',
    ]
  success_rate: 78
  deployment_time: '7 minutes'
  complexity_level: 'advanced'

  skill_guidance:
    variable_flow_pattern: 'protected_request → circuit_state → response_or_fallback'
    reliability_strategy: 'fail-fast with automatic recovery'
    production_considerations:
      ['failure_threshold', 'timeout_configuration', 'monitoring_integration']

  customization_points:
    - name: 'failure_threshold'
      description: 'Number of failures before circuit opens'
      range: '3-10'
      default: 5
      production_recommendation: 'Start conservative, tune based on monitoring'
    - name: 'recovery_timeout'
      description: 'Time before attempting recovery'
      options: ['30s', '60s', '300s']
      default: '60s'

  requirements:
    environment_variables:
      - name: 'API_ENDPOINT'
        required: true
        description: 'Protected API endpoint URL'
      - name: 'MONITORING_WEBHOOK'
        required: false
        description: 'Optional circuit state monitoring'

workflow:
  name: 'Circuit Breaker API Protection'
  description: 'Protect external API calls with circuit breaker pattern'

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Initialize Circuit Breaker'
        description: 'Set up failure tracking and thresholds'

    - id: 'circuit_breaker_protection'
      type: 'circuit-breaker'
      data:
        title: 'Protected API Call'
        description: 'Call external API with circuit breaker protection'
        failure_threshold: 5
        timeout: '60s'
        recovery_timeout: '300s'
        sub_workflow:
          - id: 'protected_api_call'
            type: 'http-request'
            data:
              url: '${API_ENDPOINT}'
              method: 'GET'
              timeout: 30
              retries: 1

    - id: 'handle_circuit_state'
      type: 'if-else'
      data:
        title: 'Handle Circuit State'
        description: 'Route response based on circuit breaker state'
        condition: '${circuit_breaker_success} == true'
        if_branch: ['success_response']
        else_branch: ['circuit_open_fallback']

    - id: 'success_response'
      type: 'answer'
      data:
        title: 'API Success Response'
        answer: |
          ✅ **API Call Successful**

          **Response**: ${http_response_body}
          **Circuit State**: CLOSED
          **Response Time**: ${http_response_time}ms

    - id: 'circuit_open_fallback'
      type: 'answer'
      data:
        title: 'Circuit Open - Fallback Response'
        answer: |
          ⚠️ **Circuit Breaker Open**

          **Status**: API temporarily unavailable
          **Fallback**: Using cached/default response
          **Recovery**: Circuit will attempt recovery in ${recovery_timeout}

          Please try again later or use alternative endpoints.

  edges:
    - source: 'start'
      target: 'circuit_breaker_protection'
    - source: 'circuit_breaker_protection'
      target: 'handle_circuit_state'
    - source: 'handle_circuit_state'
      target: 'success_response'
    - source: 'handle_circuit_state'
      target: 'circuit_open_fallback'
```

### Example 2: AI Chat with Memory Template

```yaml
# ai-chat-with-memory-template.yaml
metadata:
  template_name: 'AI Conversation with Memory'
  category: 'ai-stateful'
  intent_keywords:
    ['ai chat', 'conversation memory', 'stateful ai', 'chat history', 'context awareness']
  success_rate: 77
  deployment_time: '8 minutes'
  complexity_level: 'advanced'

  skill_guidance:
    variable_flow_pattern: 'conversation_history → llm_with_context → updated_history'
    state_management: 'persistent conversation context across interactions'
    memory_strategy: 'sliding window with importance filtering'

workflow:
  name: 'AI Chat with Memory'
  description: 'Stateful AI conversation that maintains context across interactions'

variables:
  conversation_history: ''
  user_input: "Hello, I'd like to discuss workflow automation"
  max_history_tokens: 2000

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Initialize Conversation'
        variables:
          - variable: 'user_input'
            type: 'text'
            label: 'Your Message'
            required: true

    - id: 'load_conversation_history'
      type: 'variable-assignment'
      data:
        title: 'Load Conversation Context'
        variable: 'formatted_history'
        assignment_type: 'expression'
        expression: |
          if [ -n "${conversation_history}" ]; then
            echo "Previous conversation:\n${conversation_history}\n\nCurrent message: ${user_input}"
          else
            echo "New conversation. User message: ${user_input}"
          fi

    - id: 'ai_response_with_context'
      type: 'llm'
      data:
        title: 'Generate Contextual Response'
        model:
          name: 'gpt-4'
          completion_params:
            temperature: 0.7
            max_tokens: 500
        prompt: |
          You are a helpful AI assistant with memory of our previous conversation.

          ${formatted_history}

          Instructions:
          - Reference previous parts of our conversation when relevant
          - Build on topics we've discussed before
          - Maintain conversational continuity
          - Be helpful and informative

          Respond to the user's current message naturally, incorporating context from our conversation history.

    - id: 'update_conversation_history'
      type: 'variable-assignment'
      data:
        title: 'Update Conversation Memory'
        variable: 'updated_history'
        assignment_type: 'expression'
        expression: |
          echo "${conversation_history}
          User: ${user_input}
          Assistant: ${llm_content}
          " | tail -c ${max_history_tokens}

    - id: 'final_response'
      type: 'answer'
      data:
        title: 'AI Response with Memory'
        answer: |
          **AI Response:**
          ${llm_content}

          ---

          **Conversation Context:** ${conversation_history:0:200}...
          **Memory Status:** ✅ Context preserved for next interaction
          **History Size:** ${#updated_history} characters
```

## DOCUMENTATION:

### Technical Foundation References

- **Phase 1 Enhanced Templates**: Foundation patterns and skill integration established
- **flowsh Advanced Node Types**: circuit-breaker, parallel-iteration, sub-workflow documentation
- **Variable Composition Patterns**: Complex variable flow design from Phase 1 learnings
- **Agent Skills Integration**: flowsh-workflow-intelligence skill for advanced pattern guidance

### Advanced Pattern Documentation

- **Circuit Breaker Pattern**: Microservices resilience patterns and failure handling
- **Stateful AI Workflows**: Conversation memory and context management techniques
- **Parallel Processing Architecture**: Concurrent execution and aggregation strategies
- **Multi-Channel Distribution**: Content optimization and platform-specific formatting

### Production Automation References

- **DevOps Automation Patterns**: Monitoring, testing, and deployment workflows
- **Content Distribution Systems**: Multi-platform publishing and syndication
- **AI Safety and Moderation**: Content filtering and compliance automation
- **Reliability Engineering**: Circuit breakers, retries, and graceful degradation

### Integration and Composition Guides

- **Template Composability**: How advanced templates work together
- **Sub-workflow Patterns**: Reusable workflow components
- **Variable Flow Optimization**: Complex data pipeline design
- **Error Handling Strategies**: Advanced failure modes and recovery patterns

## OTHER CONSIDERATIONS:

### Technical Implementation Requirements

**Advanced File Structure:**

```
flowsh/
├── templates/
│   ├── enhanced/                 # Phase 1 foundation templates
│   ├── advanced/                 # Phase 2 new templates
│   │   ├── reliability/          # Circuit breaker, monitoring
│   │   ├── ai-workflows/         # Stateful, multi-stage AI
│   │   ├── content-distribution/ # Multi-channel, moderation
│   │   ├── data-processing/      # Parallel, validation
│   │   └── meta-workflows/       # Interactive builders
│   ├── compositions/             # Template combination patterns
│   └── production/               # Enterprise-ready configurations
```

**Advanced Metadata Standards:**

- Complexity level indicators (beginner/intermediate/advanced)
- Dependency mapping between templates
- Production readiness scoring
- Resource requirement specifications (CPU, memory, network)
- Monitoring and observability integration points

### Critical Success Factors

**1. Build on Phase 1 Foundation**

- Leverage enhanced template infrastructure from Phase 1
- Extend skill integration patterns to advanced workflows
- Maintain consistency with foundation template metadata standards
- Use proven variable flow patterns where applicable

**2. Advanced Node Type Mastery**

- Master circuit-breaker configuration and failure thresholds
- Implement complex parallel-iteration patterns with proper aggregation
- Design sophisticated sub-workflow compositions
- Utilize advanced LLM features (memory, context, multi-stage)

**3. Production Readiness**

- Include comprehensive error handling and fallback strategies
- Design for scalability with resource-aware configurations
- Implement proper monitoring and observability patterns
- Provide security best practices for advanced workflows

**4. Template Composability**

- Design templates that work well together
- Create clear dependency and integration patterns
- Provide guidance for combining multiple advanced templates
- Maintain modularity for custom workflow composition

### Advanced Complexity Challenges

**1. State Management**

- Persistent conversation history in AI chat workflows
- Circuit breaker state tracking across multiple calls
- Multi-stage workflow context preservation
- Parallel execution coordination and synchronization

**2. Error Handling Sophistication**

- Graceful degradation in multi-channel distribution failures
- Circuit breaker recovery strategies
- Data validation and cleanup error scenarios
- Complex workflow rollback and compensation patterns

**3. Performance Considerations**

- Parallel processing optimization for large datasets
- Memory management in stateful AI workflows
- Network efficiency in multi-channel distribution
- Resource allocation for advanced automation patterns

**4. Integration Complexity**

- Multiple API integrations with different authentication patterns
- Webhook configuration and event handling
- Third-party service dependencies and fallbacks
- Cross-platform compatibility and format translation

### Security and Compliance Considerations

**Advanced Environment Variables:**

```bash
# Advanced API integrations
export OPENAI_API_KEY="sk-..."                    # Primary AI
export ANTHROPIC_API_KEY="sk-ant-..."             # Fallback AI
export CIRCUIT_BREAKER_CONFIG_URL="https://..."   # Circuit state

# Multi-channel distribution
export LINKEDIN_WEBHOOK_URL="https://..."         # LinkedIn API
export EMAIL_API_TOKEN="..."                      # Email service
export EMAIL_LIST_ID="..."                        # Newsletter list
export MONITORING_WEBHOOK="https://..."           # Observability

# Content moderation and compliance
export CONTENT_FILTER_API_KEY="..."               # Moderation API
export COMPLIANCE_WEBHOOK="https://..."           # Audit logging
```

**Advanced Security Patterns:**

- Content moderation and safety filtering
- API rate limiting and quota management
- Audit logging for compliance workflows
- Secure state persistence and encryption
- Cross-service authentication and authorization

### Potential Gotchas

**1. State Persistence Complexity**

- Conversation memory in AI workflows requires careful token management
- Circuit breaker state needs proper persistence across workflow runs
- Multi-stage workflows must handle intermediate state failures
- Parallel processing state coordination can lead to race conditions

**2. Advanced Node Configuration**

- Circuit breaker thresholds require tuning based on actual API behavior
- Parallel-iteration aggregation strategies must match data types
- Sub-workflow variable passing can create scoping issues
- Complex LLM prompt templates may exceed token limits

**3. Multi-Service Dependencies**

- Advanced templates often depend on multiple external APIs
- Service availability impacts workflow success rates significantly
- Authentication complexity increases with service count
- Network latency and timeout handling becomes critical

**4. Template Composition Conflicts**

- Advanced templates may have conflicting variable names
- Resource requirements may exceed system capabilities
- Execution order dependencies can create circular references
- Error handling strategies may interfere with each other

### Success Criteria

**Phase 2 Complete When:**

- [ ] 10 advanced templates created with unique workflow patterns
- [ ] All templates achieve 75%+ success rate in **real execution testing**
- [ ] Advanced templates integrate seamlessly with Phase 1 foundation
- [ ] Template composition patterns documented and tested
- [ ] Production readiness guidelines established
- [ ] Advanced skill integration completed
- [ ] Performance benchmarks established for complex workflows
- [ ] Security and compliance patterns validated
- [ ] **EXECUTION VALIDATION**: All advanced templates compile and execute successfully in real environments
- [ ] **RUNTIME RESILIENCE**: Templates handle actual API failures, network timeouts, and service unavailability
- [ ] **PRODUCTION DEPLOYMENT**: Templates verified to work in enterprise environments with real dependencies

**Measurable Outcomes:**

- **Advanced Speed**: 7-10 minutes from idea to complex working workflow
- **Success Rate**: 75%+ first-run success for advanced patterns **with actual execution**
- **Coverage**: All major advanced automation categories addressed with **production-ready implementations**
- **Composition**: Templates work together without conflicts **in real runtime environments**
- **Production**: Templates ready for enterprise deployment **with verified functionality**
- **Scalability**: Workflows handle realistic production loads **under actual stress testing**

### Dependencies and Prerequisites

**Technical Dependencies:**

- Phase 1 completion: Enhanced template infrastructure and skill integration
- flowsh advanced node types: circuit-breaker, parallel-iteration, sub-workflow **with verified functionality**
- Advanced API access: Multiple AI providers, messaging platforms, monitoring services **with real credentials**
- **REAL EXECUTION ENVIRONMENT**: Production-like environment for complex workflow validation with actual services
- **LIVE SERVICE TESTING**: Ability to test against actual APIs, databases, and external services
- **FAILURE SIMULATION**: Capability to test error handling with real service failures and network issues

**Knowledge Dependencies:**

- Advanced workflow design patterns and best practices
- Production automation requirements and reliability patterns
- Multi-service integration and orchestration techniques
- AI workflow optimization and state management strategies

**Resource Dependencies:**

- Development time: 2-3 weeks for comprehensive advanced template creation
- **LIVE TESTING RESOURCES**: Multiple real API keys, service accounts, monitoring access for actual execution
- **PRODUCTION VALIDATION**: Enterprise-grade testing environment with real network, database, and service access
- Documentation effort: Advanced pattern explanation and troubleshooting guides based on **real runtime issues**
- **EXECUTION VALIDATION**: Full end-to-end testing from YAML → shell script → actual execution → results verification
- **RUNTIME DEBUGGING**: Capability to diagnose and fix real execution errors, service failures, and configuration issues
