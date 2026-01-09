/**
 * Shell Escaping Utilities for flowsh
 *
 * Provides consistent, secure shell value escaping and quoting strategies
 * to prevent injection attacks and handle edge cases with spaces, quotes,
 * and special characters.
 */

/**
 * Escape a shell value for safe use in double quotes
 * Handles: backslashes, double quotes, dollar signs, backticks
 */
export function escapeShellValue(value: string): string {
  // Defensive programming: ensure value is a string
  if (typeof value !== 'string') {
    value = String(value || '');
  }

  return value
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\$/g, '\\$') // Escape dollar signs
    .replace(/`/g, '\\`'); // Escape backticks
}

/**
 * Smart shell value escaping that preserves get_var call integrity
 * This function is aware of flowsh's template variable system and
 * won't escape the internal structure of get_var calls
 */
export function escapeShellValueSmart(value: string): string {
  // Defensive programming: ensure value is a string
  if (typeof value !== 'string') {
    value = String(value || '');
  }

  // Split on get_var calls and shell variable references to handle them separately
  const parts = value.split(
    /(get_var "[^"]*" "[^"]*"|get_workflow_var "[^"]*" "[^"]*"|\$[A-Z_][A-Z0-9_]*)/
  );

  return parts
    .map((part, index) => {
      // Even indices are regular text, odd indices are special patterns
      if (index % 2 === 0) {
        // Regular text - escape normally
        return escapeShellValue(part);
      } else {
        // get_var/get_workflow_var call or shell variable - don't escape
        return part;
      }
    })
    .join('');
}

/**
 * Quote a shell argument if it needs quoting
 * Returns the value wrapped in double quotes if it contains spaces or special chars
 */
export function quoteShellArgumentIfNeeded(value: string): string {
  // Defensive programming: ensure value is a string
  if (typeof value !== 'string') {
    value = String(value || '');
  }

  if (needsQuoting(value)) {
    return `"${escapeShellValueSmart(value)}"`;
  }

  return value;
}

/**
 * Determine if a value needs shell quoting
 * True if contains spaces, special chars, or command substitution
 */
export function needsQuoting(value: string): boolean {
  // Defensive programming: ensure value is a string
  if (typeof value !== 'string') {
    return false;
  }

  return (
    value.includes(' ') || // Spaces
    value.includes('\t') || // Tabs
    value.includes('\n') || // Newlines
    value.includes('*') || // Glob wildcards
    value.includes('?') || // Glob wildcards
    value.includes('(') || // Subshells/functions
    value.includes(')') || // Subshells/functions
    value.includes('[') || // Character classes
    value.includes(']') || // Character classes
    value.includes('{') || // Brace expansion
    value.includes('}') || // Brace expansion
    value.includes('|') || // Pipes
    value.includes('&') || // Background/logical operators
    value.includes(';') || // Command separators
    value.includes('<') || // Redirections
    value.includes('>') || // Redirections
    value.includes('$') || // Variable expansion
    value.includes('`') || // Command substitution
    value.includes('\\') || // Escapes
    value.includes('"') || // Quotes
    value.includes("'") // Single quotes
  );
}

/**
 * Escape a shell variable name to be safe for use
 * Converts problematic characters to underscores
 */
export function sanitizeVariableName(varName: string): string {
  // Defensive programming: ensure varName is a string
  if (typeof varName !== 'string') {
    varName = String(varName || 'var');
  }

  // Only allow alphanumeric and underscore, starting with letter/underscore
  const sanitized = varName.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    return `VAR_${sanitized}`;
  }
  return sanitized;
}

/**
 * Escape content for use in a bash heredoc
 * This prevents heredoc termination and variable substitution issues
 */
export function escapeHeredocContent(content: string): string {
  // Defensive programming: ensure content is a string
  if (typeof content !== 'string') {
    content = String(content || '');
  }

  // For heredocs, we mainly need to ensure the delimiter doesn't appear
  // and that variable substitutions are handled correctly
  return content
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/\$(?!\{)/g, '\\$'); // Escape lone dollar signs (but not ${var})
}

/**
 * Generate a unique heredoc delimiter that doesn't conflict with content
 */
export function generateHeredocDelimiter(content: string, baseDelimiter: string = 'EOF'): string {
  let delimiter = baseDelimiter;
  let counter = 0;

  // Keep generating new delimiters until we find one that doesn't appear in content
  while (content.includes(delimiter)) {
    counter++;
    delimiter = `${baseDelimiter}_${counter}`;
  }

  return delimiter;
}

/**
 * Safe shell command building with proper argument quoting
 * Takes a command and arguments array, returns a properly quoted command string
 */
export function buildShellCommand(command: string, args: string[] = []): string {
  // Defensive programming
  if (typeof command !== 'string') {
    command = String(command || 'echo');
  }

  if (!Array.isArray(args)) {
    args = [];
  }

  // Quote the command if needed
  const quotedCommand = quoteShellArgumentIfNeeded(command);

  // Quote each argument if needed
  const quotedArgs = args.map(arg => quoteShellArgumentIfNeeded(String(arg)));

  return [quotedCommand, ...quotedArgs].join(' ');
}
