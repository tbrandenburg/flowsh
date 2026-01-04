# PRP: Telegram Send Node Implementation for Flowsh

## CURRENT SITUATION ANALYSIS

Based on exploration of the flowsh codebase, I understand:

### Existing Node Architecture:

- **Base Interface**: `NodeGenerator` with methods: `generate()`, `validate()`, `getVariables()`
- **Implementation Pattern**: Extend `BaseNodeGenerator` from `/src/generation/generators/base-generator.ts`
- **Registration**: All generators registered in `registerDefaultGenerators()` in `/src/generation/generators/index.ts`
- **Type System**: Node types defined in `/src/dsl/types.ts` with corresponding data interfaces
- **Testing**: Comprehensive Vitest tests for each generator in dedicated test files

### Security and Shell Generation:

- Input sanitization via `sanitizeVariableName()` and `escapeShellValue()`
- Template variable processing with `{{variable}}` → `$(get_var "VARIABLE" "node_id")` pattern
- Generated bash scripts with proper error handling and logging
- Variable management through `set_var()` and `get_var()` functions

### Current Gap:

No Telegram messaging capability exists in flowsh. Need to implement a new `telegram` node type following established patterns.

## OBJECTIVES

### Primary Goal:

Implement a `telegram` node type that enables sending text messages to Telegram chats as part of flowsh workflows.

### Technical Objectives:

1. **Type Definition**: Add `TelegramNodeData` interface to type system
2. **Generator Implementation**: Create `TelegramNodeGenerator` class extending `BaseNodeGenerator`
3. **Registration**: Register the new generator in the default generators list
4. **Testing**: Comprehensive test coverage following existing patterns
5. **Documentation**: Integration with flowsh examples and documentation

### Functional Requirements:

- Send text messages only (no media support initially)
- Support HTML and Markdown parse modes with HTML as default
- Fire-and-forget execution with retry logic
- Environment variable configuration (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
- Node-specific configuration (parse_mode, max_retries)
- Automatic character escaping based on parse mode
- Variable substitution in message content

## DETAILED PLAN

### Phase 1: Type System Integration

**Location**: `/src/dsl/types.ts`

1. **Add NodeType**:

   ```typescript
   export type NodeType =
     | 'telegram' // ADD THIS
     | 'start'
     | 'end';
   // ... existing types
   ```

2. **Add TelegramNodeData Interface**:

   ```typescript
   export interface TelegramNodeData extends BaseNodeData {
     chat_id?: string; // Optional - can use env var
     message: string; // Required - message content
     bot_token?: string; // Optional - can use env var
     parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'; // Default: HTML
     max_retries?: number; // Default: 3
     disable_notification?: boolean; // Optional
     reply_to_message_id?: number; // Optional
   }
   ```

3. **Add to NodeData Union**:
   ```typescript
   export type NodeData =
     | TelegramNodeData // ADD THIS
     | StartNodeData;
   // ... existing data types
   ```

### Phase 2: Core Generator Implementation

**Location**: `/src/generation/generators/telegram-node.ts`

1. **Class Structure**:

   ```typescript
   export class TelegramNodeGenerator extends BaseNodeGenerator {
     readonly nodeType = 'telegram';

     generate(node: WorkflowNode, context: GenerationContext): string;
     validate(node: WorkflowNode): ValidationResult;
     getVariables(node: WorkflowNode): string[];
   }
   ```

2. **Generate Method Implementation**:
   - Create bash function `send_telegram_${nodeId}()`
   - Handle environment variable fallbacks for bot_token and chat_id
   - Implement character escaping based on parse_mode
   - Add retry logic with exponential backoff
   - Include proper error handling and logging
   - Use curl to send HTTP POST to Telegram Bot API

3. **Validation Logic**:
   - Ensure message content is provided
   - Validate parse_mode is valid value
   - Check that either chat_id is provided or TELEGRAM_CHAT_ID env var exists
   - Validate max_retries is positive number

4. **Variable Management**:
   - Extract template variables from message, chat_id, bot_token
   - Return list of variables this node consumes and produces

### Phase 3: Character Escaping Implementation

**Location**: Add helper methods to `TelegramNodeGenerator`

1. **HTML Escaping Function**:

   ```bash
   escape_html() {
     local text="$1"
     text="${text//&/&amp;}"
     text="${text//</&lt;}"
     text="${text//>/&gt;}"
     echo "$text"
   }
   ```

2. **Markdown Escaping Function**:
   ```bash
   escape_markdown() {
     local text="$1"
     # Escape special markdown characters
     text="${text//_/\\_}"
     text="${text//*/\\*}"
     # ... additional escaping
     echo "$text"
   }
   ```

### Phase 4: Registration and Export

**Location**: `/src/generation/generators/index.ts`

1. **Export Generator**:

   ```typescript
   export { TelegramNodeGenerator } from './telegram-node.js';
   ```

2. **Register in Default Generators**:
   ```typescript
   export function registerDefaultGenerators(registry: NodeGeneratorRegistry): void {
     registry.register(new StartNodeGenerator());
     registry.register(new TelegramNodeGenerator()); // ADD THIS
     // ... other registrations
   }
   ```

### Phase 5: Comprehensive Testing

**Location**: `/src/generation/generators/__tests__/telegram-node.test.ts`

1. **Test Structure**:

   ```typescript
   describe('TelegramNodeGenerator', () => {
     let generator: TelegramNodeGenerator;
     let mockContext: GenerationContext;

     beforeEach(() => {
       generator = new TelegramNodeGenerator();
       mockContext = createMockContext();
     });
   });
   ```

2. **Test Cases**:
   - **Generation Tests**: Basic message generation, environment variable handling, parse mode selection
   - **Validation Tests**: Required fields, invalid parse modes, malformed configuration
   - **Variable Extraction**: Template variables, output variables
   - **Edge Cases**: Empty messages, special characters, long messages
   - **Integration**: Generated bash script actually works with real API

3. **Mock Integration Test**:
   - Test actual HTTP call to Telegram API (with mock bot token)
   - Verify generated bash script executes without errors
   - Validate retry logic and error handling

### Phase 6: Documentation and Examples

**Location**: Add to flowsh documentation and examples

1. **Example Workflow Files**:

   ```yaml
   # telegram-notification.yaml
   name: telegram-notification
   nodes:
     - id: send_message
       type: telegram
       data:
         message: 'Hello from flowsh! Current time: {{CURRENT_TIME}}'
         parse_mode: 'HTML'
         max_retries: 3
   ```

2. **Integration Examples**:
   - Workflow completion notifications
   - Error alerting
   - Progress updates
   - Agent response forwarding

## IMPLEMENTATION STEPS

### Step 1: Type System Changes

1. Edit `/src/dsl/types.ts`
2. Add `telegram` to NodeType union
3. Add `TelegramNodeData` interface
4. Add to `NodeData` union type
5. Run type checking: `npm run type-check`

### Step 2: Generator Implementation

1. Create `/src/generation/generators/telegram-node.ts`
2. Implement `TelegramNodeGenerator` class
3. Implement all required methods with proper bash generation
4. Add character escaping helper functions
5. Include comprehensive error handling and logging

### Step 3: Registration

1. Export new generator in `/src/generation/generators/index.ts`
2. Register in `registerDefaultGenerators()` function
3. Verify registration works with test

### Step 4: Testing Implementation

1. Create comprehensive test file
2. Test all generation scenarios
3. Test validation logic
4. Test variable extraction
5. Add integration test with mock API
6. Run full test suite: `npm test`

### Step 5: Integration Testing

1. Create example workflow files
2. Test with real Telegram bot (using test credentials)
3. Verify generated bash scripts execute correctly
4. Test error scenarios and retry logic
5. Validate character escaping works properly

### Step 6: Documentation

1. Add node documentation to flowsh docs
2. Create usage examples
3. Document configuration options
4. Add to README or similar user documentation

## VALIDATION CRITERIA

### Technical Validation:

- [ ] All TypeScript types compile without errors
- [ ] Generator follows BaseNodeGenerator patterns exactly
- [ ] Generated bash scripts are syntactically valid
- [ ] All tests pass (unit and integration)
- [ ] Node appears in registry and can be used in workflows

### Functional Validation:

- [ ] Can send basic text message to Telegram
- [ ] Environment variables are properly handled
- [ ] Character escaping works for HTML and Markdown modes
- [ ] Retry logic functions correctly on API failures
- [ ] Variable substitution works in message content
- [ ] Error handling provides useful feedback

### Integration Validation:

- [ ] Node integrates seamlessly with existing flowsh workflows
- [ ] Works with flowsh CLI commands and tooling
- [ ] Follows flowsh coding standards and conventions
- [ ] Documentation is clear and includes working examples

## SUCCESS METRICS

### Primary Success Criteria:

1. **Functional**: Test message successfully sent via Telegram API (HTTP 200 response)
2. **Integration**: Node appears in flowsh registry and works in workflows
3. **Quality**: All tests pass and code follows established patterns
4. **Usability**: Clear documentation and working examples provided

### Quality Gates:

- Type checking passes: `npm run type-check`
- All tests pass: `npm test`
- Linting passes: `npm run lint`
- Integration test sends actual Telegram message successfully
- Generated bash script executes without syntax errors

## TECHNICAL CONSIDERATIONS

### API Integration:

- Use Telegram Bot API v6.0+ (current stable)
- Implement proper HTTP timeout handling (30s default)
- Handle rate limiting (20 messages per minute for groups)
- Support both chat_id and username formats

### Security:

- Never log bot tokens in error messages
- Sanitize all user input before shell execution
- Validate chat_id format to prevent injection
- Use environment variables for sensitive data

### Performance:

- Asynchronous execution (fire-and-forget)
- Reasonable timeout for API calls
- Efficient retry logic with exponential backoff
- Minimal resource usage for shell script generation

### Extensibility:

- Design allows future extension to support media, keyboards, etc.
- Configuration structure supports additional Telegram features
- Generator pattern supports easy customization and overrides

This PRP provides a complete roadmap for implementing the Telegram node in flowsh, following established patterns and ensuring high quality integration with the existing codebase.
