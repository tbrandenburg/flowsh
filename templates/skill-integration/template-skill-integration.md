# Template-Skill Integration Guide

## How Enhanced Templates Work with flowsh-workflow-intelligence Skill

### Integration Architecture

**Templates provide STRUCTURE** (working YAML):

```yaml
# Ready-to-execute workflow with proven variable flows
workflow:
  name: 'AI Content to Telegram - Production Ready'
  graph:
    nodes:
      - id: 'generate_content'
        type: 'llm'
        # ... working configuration
```

**Skills provide INTELLIGENCE** (contextual guidance):

- Variable flow understanding (`llm_content` → `telegram_message`)
- Anti-pattern prevention (environment variable validation)
- Context adaptation (content types, formatting options)
- Debug guidance (troubleshooting steps)

### Template Discovery Process

When a user makes a request, the skill maps intent to templates:

```markdown
User: "I want to generate riddles and send them to my Telegram chat"

Skill Analysis:

- Intent keywords: "generate" + "send" + "telegram"
- Pattern match: AI-to-Messaging Template
- Success prediction: 94% (based on real validation)
- Requirements: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

### Variable Flow Intelligence

**AI Content Template Flow**:

```
User Input → LLM Generation → Message Formatting → Telegram Delivery
    ↓              ↓                    ↓                   ↓
Environment    llm_content      telegram_message    telegram_success
Validation
```

**Data Pipeline Template Flow**:

```
Network Test → API Calls → Response Processing → Report Generation
     ↓            ↓              ↓                    ↓
Connectivity  http_response    processed_data    pipeline_report
Validation      _body
```

### Anti-Pattern Prevention

**Common Mistakes Prevented by Skill Guidance**:

1. **Variable Reference Errors**:
   - ❌ Wrong: `message: "${generate_riddle}"`
   - ✅ Right: `message: "${llm_content}"`

2. **Environment Variable Issues**:
   - ❌ Wrong: No validation, hardcoded secrets
   - ✅ Right: Pre-flight checks, environment variables

3. **Network Error Handling**:
   - ❌ Wrong: No timeouts, no retries
   - ✅ Right: Comprehensive error handling with fallbacks

### Context-Aware Customization

**AI Template Customization Points**:

- Content type: riddle → joke, summary, news, trivia
- Topic: space exploration → programming, history, science
- Format: HTML → Markdown (with guidance on reliability)
- AI model: gpt-4 → claude-3-5-sonnet-20241022

**Pipeline Template Customization Points**:

- API endpoints: public APIs → authenticated services
- Aggregation strategy: collect → sum, average, filter
- Error handling: continue → fail-fast
- Output format: template → JSON, CSV, database

### Success Prediction System

**High Success Probability Indicators** (90%+ rate):

- ✅ Uses standard flowsh variable patterns
- ✅ Includes environment validation
- ✅ Has comprehensive fallback strategies
- ✅ Based on templates with real execution validation

**Risk Factors** (requires additional guidance):

- ⚠️ Custom API integrations without testing
- ⚠️ Complex variable transformations
- ⚠️ Missing error handling strategies
- ⚠️ Network dependencies without validation

### Progressive Disclosure Pattern

**Level 1 - Basic Template**: Working YAML with minimal configuration
**Level 2 - Environment Setup**: Credential configuration and validation  
**Level 3 - Customization**: Content types, formats, parameters
**Level 4 - Production**: Monitoring, error handling, scaling

### Integration Examples

**Example 1: Fresh Agent Workflow**

```
1. User: "Create a workflow that generates jokes and posts to Telegram"
2. Skill: Recognizes "generate + post + Telegram" → AI-to-Messaging Template
3. Template: Provides working YAML with placeholder customization
4. Skill: Guides environment setup (bot token, chat ID)
5. Result: Working workflow in 3 minutes
```

**Example 2: Data Processing Request**

```
1. User: "I need to fetch data from multiple APIs and create a report"
2. Skill: Recognizes "fetch + multiple + APIs + report" → Data Pipeline Template
3. Template: Provides multi-source aggregation pattern
4. Skill: Guides API configuration and error handling
5. Result: Production-ready pipeline in 4 minutes
```

### Validation and Testing Integration

**Template Validation Process**:

1. ✅ YAML syntax validation with `flowsh validate`
2. ✅ Compilation testing with `flowsh compile`
3. ✅ Real execution testing with actual APIs
4. ✅ Error condition testing (network failures, invalid credentials)
5. ✅ Success rate measurement across multiple runs

**Skill Enhancement Process**:

1. Monitor common user mistakes and template failures
2. Update anti-pattern guidance based on real issues
3. Refine intent recognition based on user queries
4. Improve success prediction based on execution data

### Production Deployment Guidance

**Pre-Deployment Checklist**:

- [ ] Environment variables configured and validated
- [ ] API credentials tested with actual services
- [ ] Network connectivity and firewall rules verified
- [ ] Error handling and retry logic validated
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested

**Monitoring Integration**:

- Execution success/failure rates per template
- Average deployment time tracking
- Common error patterns identification
- User satisfaction and template effectiveness metrics

This integration creates a synergistic system where templates provide reliable structure and skills provide intelligent guidance, achieving the 5-minute golden path from idea to working automation.
