/**
 * Telegram Node Generator
 *
 * Generates shell script code for sending messages to Telegram chats
 * with support for HTML/Markdown formatting and retry logic
 */

import { WorkflowNode, TelegramNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class TelegramNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'telegram';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as TelegramNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_telegram_${nodeId}`;

    // Extract configuration with defaults
    const message = data.message || '';
    const parseMode = data.parse_mode || 'HTML';
    const maxRetries = data.max_retries || 3;
    const disableNotification = data.disable_notification || false;
    const replyToMessageId = data.reply_to_message_id;
    const errorHandling = data.error_handling || 'fail';
    const title = data.title || node.id;

    // Handle chat_id and bot_token - can come from node data or environment variables
    const chatIdCode = this.generateChatIdCode(data, node.id);
    const botTokenCode = this.generateBotTokenCode(data, node.id);
    const escapingCode = this.generateEscapingCode(parseMode);

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "📱 Sending Telegram message: ${this.escapeShellValue(title)}"

    local message="${this.processTemplateVariables(message, node.id)}"
    local parse_mode="${parseMode}"
    local max_retries=${maxRetries}
    local disable_notification=${disableNotification}
    local error_handling="${errorHandling}"
    ${replyToMessageId ? `local reply_to_message_id=${replyToMessageId}` : ''}

    # Validate message is not empty
    if [[ -z "$message" ]]; then
        log_error "Telegram message content is empty"
        case "$error_handling" in
            "ignore")
                log_info "Ignoring Telegram error as configured"
                return 0
                ;;
            "continue")
                log_warning "Continuing despite Telegram error"
                return 0
                ;;
            *)
                return 1
                ;;
        esac
    fi

${chatIdCode}

${botTokenCode}

${escapingCode}

    # Escape message content for JSON payload (but preserve formatting tags)
    local escaped_message
    case "$parse_mode" in
        "HTML")
            # For HTML mode, convert literal \\n to actual newlines (Telegram HTML doesn't support <br> tags)
            local html_formatted
            html_formatted="\${message//\$'\\\\n'/\$'\\n'}"  # Convert literal \\n to actual newlines
            escaped_message=\$(escape_json "\$html_formatted")
            ;;
        "Markdown"|"MarkdownV2")
            # For Markdown modes, escape markdown then JSON
            local markdown_escaped
            markdown_escaped=$(escape_markdown "$message")
            escaped_message=$(escape_json "$markdown_escaped")
            ;;
        *)
            escaped_message=$(escape_json "$message")
            ;;
    esac

    # Prepare API request payload
    local api_url="https://api.telegram.org/bot\$bot_token/sendMessage"
    local payload
    payload=$(cat <<EOF
{
    "chat_id": "\$chat_id",
    "text": "\$escaped_message",
    "parse_mode": "\$parse_mode"${disableNotification ? ',\n    "disable_notification": true' : ''}${replyToMessageId ? ',\n    "reply_to_message_id": ' + replyToMessageId : ''}
}
EOF
)

    log_debug "Sending message to Telegram API: \$api_url"
    log_debug "Payload length: \${#payload} characters"

    # Retry logic with exponential backoff
    local attempt=1
    local delay=1
    
    while [[ \$attempt -le \$max_retries ]]; do
        log_debug "Telegram API attempt \$attempt of \$max_retries"
        
        # Make API request
        local response_file=\$(mktemp)
        local http_code
        
        http_code=\$(curl -s -w "%{http_code}" \\
            -X POST \\
            -H "Content-Type: application/json" \\
            -d "\$payload" \\
            --connect-timeout 10 \\
            --max-time 30 \\
            "\$api_url" \\
            -o "\$response_file" 2>/dev/null)
        
        local curl_exit_code=\$?
        local response_body=\$(cat "\$response_file" 2>/dev/null)
        
        # Clean up temp file
        rm -f "\$response_file" 2>/dev/null
        
        # Check if request was successful
        if [[ \$curl_exit_code -eq 0 && "\$http_code" =~ ^2[0-9][0-9]\$ ]]; then
            log_success "Telegram message sent successfully (HTTP \$http_code)"
            
            # Set success variables
            set_workflow_var "TELEGRAM_SUCCESS" "true"
            set_workflow_var "TELEGRAM_HTTP_CODE" "\$http_code"
            set_workflow_var "TELEGRAM_RESPONSE" "\$response_body"
            set_workflow_var "TELEGRAM_MESSAGE_SENT" "true"
            
            log_debug "Telegram API response: \$response_body"
            return 0
        else
            # Log the failure
            if [[ \$curl_exit_code -ne 0 ]]; then
                log_warning "Telegram API request failed (curl exit code: \$curl_exit_code) - attempt \$attempt/\$max_retries"
            else
                log_warning "Telegram API returned HTTP \$http_code - attempt \$attempt/\$max_retries"
                if [[ -n "\$response_body" ]]; then
                    log_warning "API error response: \$response_body"
                fi
            fi
            
            # Check if we should retry
            if [[ \$attempt -lt \$max_retries ]]; then
                log_info "Retrying in \${delay}s..."
                sleep \$delay
                delay=\$((delay * 2))  # Exponential backoff
                attempt=\$((attempt + 1))
            else
                # Final failure - handle based on error_handling setting
                log_error "Telegram message failed after \$max_retries attempts"
                
                # Set failure variables
                set_workflow_var "TELEGRAM_SUCCESS" "false"
                set_workflow_var "TELEGRAM_HTTP_CODE" "\${http_code:-0}"
                set_workflow_var "TELEGRAM_RESPONSE" "\$response_body"
                set_workflow_var "TELEGRAM_MESSAGE_SENT" "false"
                set_workflow_var "TELEGRAM_ERROR" "MAX_RETRIES_EXCEEDED"
                
                case "\$error_handling" in
                    "ignore")
                        log_info "Ignoring Telegram failure as configured"
                        return 0
                        ;;
                    "continue")
                        log_warning "Continuing despite Telegram failure"
                        return 0
                        ;;
                    *)
                        return 1
                        ;;
                esac
            fi
        fi
    done
}`;
  }

  private generateChatIdCode(data: TelegramNodeData, nodeId: string): string {
    const errorHandling = data.error_handling || 'fail';
    if (data.chat_id) {
      // Use chat_id from node configuration
      return `    # Use chat_id from node configuration
    local chat_id="${this.processTemplateVariables(data.chat_id, nodeId)}"`;
    } else {
      // Use chat_id from environment variable
      return `    # Use chat_id from environment variable
    local chat_id="\${TELEGRAM_CHAT_ID:-}"
    
    if [[ -z "\$chat_id" ]]; then
        log_error "Telegram chat_id is required - set TELEGRAM_CHAT_ID environment variable or provide chat_id in node configuration"
        case "${errorHandling}" in
            "ignore")
                log_info "Ignoring Telegram configuration error as configured"
                return 0
                ;;
            "continue")
                log_warning "Continuing despite Telegram configuration error"
                return 0
                ;;
            *)
                return 1
                ;;
        esac
    fi`;
    }
  }

  private generateBotTokenCode(data: TelegramNodeData, nodeId: string): string {
    const errorHandling = data.error_handling || 'fail';
    if (data.bot_token) {
      // Use bot_token from node configuration
      return `    # Use bot_token from node configuration
    local bot_token="${this.processTemplateVariables(data.bot_token, nodeId)}"`;
    } else {
      // Use bot_token from environment variable
      return `    # Use bot_token from environment variable
    local bot_token="\${TELEGRAM_BOT_TOKEN:-}"
    
    if [[ -z "\$bot_token" ]]; then
        log_error "Telegram bot token is required - set TELEGRAM_BOT_TOKEN environment variable or provide bot_token in node configuration"
        case "${errorHandling}" in
            "ignore")
                log_info "Ignoring Telegram configuration error as configured"
                return 0
                ;;
            "continue")
                log_warning "Continuing despite Telegram configuration error"
                return 0
                ;;
            *)
                return 1
                ;;
        esac
    fi`;
    }
  }

  private generateEscapingCode(_parseMode: string): string {
    return `    # Standardized escaping for Telegram using centralized utility
    escape_json() {
        # Use centralized JSON escaping
        local input="$1"
        # Apply standardized JSON escaping transformations
        input="\${input//\\\\/\\\\\\\\}"  # Escape backslashes first
        input="\${input//\"/\\\\\"}"      # Escape double quotes
        input="\${input//\$'\\n'/\\\\n}"  # Escape newlines
        input="\${input//\$'\\r'/\\\\r}"  # Escape carriage returns
        input="\${input//\$'\\t'/\\\\t}"  # Escape tabs
        printf '%s' "$input"
    }

    escape_markdown() {
        # Use centralized Markdown escaping
        local input="$1"
        input="\${input//\\\\/\\\\\\\\}"
        input="\${input//\\*/\\\\*}"
        input="\${input//_/\\\\_}"
        input="\${input//\\\`/\\\\\\\`}"
        input="\${input//~/\\\\~}"
        input="\${input//[/\\\\[}"
        input="\${input//]/\\\\]}"
        input="\${input//(/\\\\(}"
        input="\${input//)/\\\\)}"
        input="\${input//!/\\\\!}"
        input="\${input//#/\\\\#}"
        echo "$input"
     }`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as TelegramNodeData;

    // Telegram specific validation
    if (!data.message) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_MESSAGE',
        message: 'Telegram node must specify a message',
        nodeId: node.id,
      });
    }

    // Validate parse_mode
    if (data.parse_mode) {
      const validParseModes = ['HTML', 'Markdown', 'MarkdownV2'];
      if (!validParseModes.includes(data.parse_mode)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_PARSE_MODE',
          message: `Invalid parse mode "${data.parse_mode}". Must be one of: ${validParseModes.join(', ')}`,
          nodeId: node.id,
        });
      }
    }

    // Validate max_retries
    if (data.max_retries !== undefined) {
      if (data.max_retries < 0) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_MAX_RETRIES',
          message: 'max_retries must be a non-negative number',
          nodeId: node.id,
        });
      } else if (data.max_retries > 10) {
        result.warnings.push({
          type: 'warning',
          code: 'HIGH_MAX_RETRIES',
          message: 'max_retries is very high (>10), consider if this is intentional',
          nodeId: node.id,
        });
      }
    }

    // Validate reply_to_message_id
    if (data.reply_to_message_id !== undefined && data.reply_to_message_id < 1) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_REPLY_MESSAGE_ID',
        message: 'reply_to_message_id must be a positive number',
        nodeId: node.id,
      });
    }

    // Validate error handling
    if (data.error_handling) {
      const validErrorHandling = ['fail', 'ignore', 'continue'];
      if (!validErrorHandling.includes(data.error_handling)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_ERROR_HANDLING',
          message: `Invalid error handling "${data.error_handling}". Must be one of: ${validErrorHandling.join(', ')}`,
          nodeId: node.id,
        });
      }
    }

    // Warning if neither chat_id nor environment variable pattern is used
    if (!data.chat_id) {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_CHAT_ID_CONFIG',
        message:
          'No chat_id specified in node configuration - ensure TELEGRAM_CHAT_ID environment variable is set',
        nodeId: node.id,
      });
    }

    // Warning if neither bot_token nor environment variable pattern is used
    if (!data.bot_token) {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_BOT_TOKEN_CONFIG',
        message:
          'No bot_token specified in node configuration - ensure TELEGRAM_BOT_TOKEN environment variable is set',
        nodeId: node.id,
      });
    }

    // Update valid field based on errors
    result.valid = result.errors.length === 0;

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as TelegramNodeData;

    // Extract variables from template fields
    if (data.message) {
      variables.push(...this.extractTemplateVariables(data.message));
    }

    if (data.chat_id) {
      variables.push(...this.extractTemplateVariables(data.chat_id));
    }

    if (data.bot_token) {
      variables.push(...this.extractTemplateVariables(data.bot_token));
    }

    // Add Telegram response variables that this node provides
    variables.push('TELEGRAM_SUCCESS');
    variables.push('TELEGRAM_HTTP_CODE');
    variables.push('TELEGRAM_RESPONSE');
    variables.push('TELEGRAM_MESSAGE_SENT');
    variables.push('TELEGRAM_ERROR');

    return [...new Set(variables)];
  }
}
